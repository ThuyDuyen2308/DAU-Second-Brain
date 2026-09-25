"""
Module Downloader cho DAU Second Brain.
Tự động tải danh sách thông báo, trang chi tiết HTML (có cache) và tài liệu đính kèm (PDF/DOC/DOCX).

Tính năng:
- Đọc danh sách thông báo từ crawler/data/notifications.json
- Tải và lưu cache HTML trang chi tiết tại crawler/data/details/
- Trích xuất file đính kèm (PDF, DOC, DOCX)
- Chuẩn hóa URL đính kèm và khử trùng lặp (kể cả link ViewFileOnline)
- Lưu file đính kèm vào crawler/data/documents/<year>/
- Tên file an toàn tuyệt đối trên Windows (loại bỏ ký tự cấm, bảo lưu tên thiết bị)
- Đối sánh CHÍNH XÁC (strict matching): post-id, canonical URL, exact slug, exact title. Tuyệt đối không fuzzy match
- Xử lý HTTP: 200 tiếp tục, 401/403 yêu cầu auth, 404 cảnh báo & bỏ qua, 429 exponential backoff, CAPTCHA/login dừng an toàn
- Hỗ trợ chế độ --dry-run (không ghi đĩa, chỉ phân tích)
"""

import argparse
import copy
import json
import logging
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup

# Đảm bảo mã hóa UTF-8 cho terminal Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from .config import (
    BASE_URL,
    DATA_DIR,
    OUTPUT_FILE,
    DETAILS_CACHE_DIR,
    DOCUMENTS_DIR,
    DEFAULT_HEADERS,
    REQUEST_TIMEOUT,
    REQUEST_DELAY,
    get_cookie_string,
    parse_cookie_content,
    load_cookie_from_file,
)
from .parser import (
    parse_announcement_detail,
    is_login_required,
    AuthenticationRequiredError,
    normalize_attachment_url,
    clean_text,
    extract_date_from_text,
    extract_main_content,
    ATTACHMENT_EXT_REGEX,
)

logger = logging.getLogger("DAUDownloader")

# Danh sách phần mở rộng tài liệu hợp lệ
ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".doc", ".docx"}

# Tên thiết bị bảo lưu trong Windows (không được dùng làm tên file)
WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
}


class RateLimitExceededError(Exception):
    """Ngoại lệ khi máy chủ trả HTTP 429 và đã vượt quá số lần retry cho phép."""
    pass


def sanitize_filename(filename: str, max_length: int = 200) -> str:
    """
    Chuẩn hóa tên file an toàn tuyệt đối trên Windows:
    - Loại bỏ các ký tự cấm: < > : " / \\ | ? * và ký tự điều khiển ASCII
    - Cắt bỏ khoảng trắng và dấu chấm ở cuối tên file
    - Tránh các tên thiết bị bảo lưu trong Windows (CON, PRN, AUX, NUL...)
    - Giới hạn độ dài an toàn tối đa max_length ký tự
    """
    if not filename or not filename.strip():
        return "unnamed_file"

    # Giải mã URL encoded nếu có (%20, %C4%90...)
    try:
        filename = unquote(filename)
    except Exception:
        pass

    filename = filename.strip()

    # Nhận diện phần mở rộng (đuôi file gồm chữ/số từ 1-8 ký tự)
    ext_match = re.search(r"\.([a-zA-Z0-9]{1,8})$", filename)
    if ext_match:
        ext = f".{ext_match.group(1).lower()}"
        base = filename[:ext_match.start()]
    else:
        ext = ""
        base = filename

    # Thay thế ký tự cấm trên Windows
    base = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", base)
    # Rút gọn khoảng trắng và gạch dưới liên tiếp, bỏ dấu chấm và khoảng trắng ở đầu/cuối
    base = re.sub(r"[\s_]+", "_", base).strip(" ._")

    if not base:
        base = "unnamed_file" if not ext else "unnamed"

    # Kiểm tra tên bảo lưu trong Windows
    if base.upper() in WINDOWS_RESERVED_NAMES:
        base = f"{base}_file"

    # Giới hạn độ dài an toàn
    allowed_base_len = max(10, max_length - len(ext))
    if len(base) > allowed_base_len:
        base = base[:allowed_base_len].rstrip(" ._")

    return f"{base}{ext}"


def normalize_title_for_comparison(title: str) -> str:
    """
    Chuẩn hóa tiêu đề phục vụ so khớp CHÍNH XÁC:
    - Loại bỏ thực thể HTML (&nbsp;)
    - Loại bỏ ngày tháng ở đuôi (- 28/08/2026)
    - Loại bỏ dấu câu ở đuôi và khoảng trắng thừa
    """
    if not title:
        return ""
    title = title.replace("&nbsp;", " ").replace("&nbsp", " ")
    title = re.sub(r"[-–—\s]*\b\d{1,2}/\d{1,2}/\d{4}\b.*$", "", title)
    title = re.sub(r"[.\s\-_–—]+$", "", title)
    return re.sub(r"\s+", " ", title).strip().lower()


def extract_slug_from_url(url: str) -> str:
    """Trích xuất slug từ URL bài viết (ví dụ: thong-bao-xyz.html -> thong-bao-xyz)."""
    if not url:
        return ""
    parsed = urlparse(url)
    stem = Path(parsed.path).stem
    return stem.strip().lower()


def determine_document_year(attachment_url: str, date_str: str = "") -> str:
    """
    Xác định năm phát hành văn bản để tạo thư mục lưu trữ theo năm:
    1. Lấy từ date_str (DD/MM/YYYY) nếu có.
    2. Lấy từ đường dẫn attachment_url (ví dụ /202608/, /2026/...).
    3. Trả về rỗng nếu không xác định được.
    """
    if date_str:
        m = re.search(r"\b(20\d{2})\b", date_str)
        if m:
            return m.group(1)

    if attachment_url:
        m = re.search(r"/(20\d{2})(?:\d{2})?/", attachment_url)
        if m:
            return m.group(1)

    return ""


def is_allowed_document(url_or_filename: str) -> bool:
    """Kiểm tra file có đúng định dạng tài liệu yêu cầu (PDF, DOC, DOCX) hay không."""
    if not url_or_filename:
        return False
    parsed = urlparse(url_or_filename)
    path = parsed.path.lower()
    return any(path.endswith(ext) for ext in ALLOWED_DOCUMENT_EXTENSIONS)


def match_detail_to_notification(
    detail_info: Dict[str, Any],
    detail_url: str,
    notification: Dict[str, Any],
) -> bool:
    """
    Đối sánh CHÍNH XÁC (STRICT MATCHING) giữa trang chi tiết và thông báo:
    1. Ưu tiên 1: data-post-id nếu cả hai bên đều có.
    2. Ưu tiên 2: Canonical URL hoặc og:url từ metadata HTML khớp chính xác với notification['detail_url'].
    3. Ưu tiên 3: URL chi tiết hoặc slug URL khớp chính xác 100%.
    4. Ưu tiên 4: Tiêu đề chuẩn hóa khớp chính xác 100% (độ dài >= 15 ký tự).

    TUYỆT ĐỐI KHÔNG DÙNG FUZZY MATCHING.
    Nếu không xác định được: trả về False (bỏ qua, không tự ghép).
    """
    notif_url = (notification.get("detail_url") or "").strip().lower()
    notif_slug = extract_slug_from_url(notif_url)
    notif_title_norm = normalize_title_for_comparison(notification.get("title", ""))
    notif_post_id = str(notification.get("post_id", "")).strip()

    detail_canonical = (detail_info.get("detail_url") or "").strip().lower()
    detail_slug = extract_slug_from_url(detail_url)
    detail_title_norm = normalize_title_for_comparison(detail_info.get("title", ""))
    detail_post_id = str(detail_info.get("post_id", "")).strip()

    # Ưu tiên 1: Khớp post-id
    if notif_post_id and detail_post_id:
        return notif_post_id == detail_post_id

    # Ưu tiên 2: Khớp canonical URL / og:url
    if detail_canonical and notif_url and detail_canonical == notif_url:
        return True

    # Ưu tiên 3: Khớp URL hoặc slug chính xác 100%
    if detail_url and notif_url and detail_url.strip().lower() == notif_url:
        return True
    if notif_slug and detail_slug and notif_slug == detail_slug:
        return True

    # Ưu tiên 4: Khớp tiêu đề chuẩn hóa chính xác 100%
    if (
        detail_title_norm
        and notif_title_norm
        and detail_title_norm == notif_title_norm
        and len(detail_title_norm) >= 15
    ):
        return True

    # Không xác định chắc chắn -> BỎ QUA
    return False



# Các MIME type của binary document, không bao giờ phải parse HTML
_BINARY_DOCUMENT_MIME_TYPES = frozenset({
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "application/x-rar-compressed",
    "application/octet-stream",
})

# Magic bytes (header nhận dạng định dạng file) cho từng loại tài liệu
_DOCUMENT_MAGIC_BYTES: list = [
    b"%PDF",           # PDF
    b"\xd0\xcf\x11\xe0",  # OLE2 (DOC, XLS, PPT cũ)
    b"PK\x03\x04",    # ZIP-based (DOCX, XLSX, PPTX)
]


def _is_binary_content_type(content_type: str) -> bool:
    """
    Kiểm tra Content-Type header có phải là binary document hay không.
    Trả về True nếu response là file nhị phân (PDF/DOC/DOCX/...) và
    tuyệt đối không nên parse bằng BeautifulSoup.
    """
    if not content_type:
        return False
    # Lấy phần MIME chính (bỏ qua charset=..., boundary=... v.v.)
    mime = content_type.split(";")[0].strip().lower()
    # Kiểm tra danh sách binary MIME types đã biết
    if mime in _BINARY_DOCUMENT_MIME_TYPES:
        return True
    # Kiểm tra các MIME kiểu "application/..." không phải JSON/XML/text
    if mime.startswith("application/") and "html" not in mime and "json" not in mime and "xml" not in mime:
        return True
    return False


def _is_html_login_page_by_headers(response: "requests.Response") -> bool:
    """
    Phát hiện login redirect chỉ dựa vào URL và header, KHÔNG đọc body.
    Dùng an toàn cho cả stream response binary.
    """
    resp_url = getattr(response, "url", "") or ""
    url_lower = resp_url.lower()
    if "dang-nhap" in url_lower or "logout" in url_lower:
        return True

    # Kiểm tra Flash.Warning cookie nếu có
    cookies = getattr(response, "cookies", None)
    if cookies and hasattr(cookies, "get"):
        warning = cookies.get("Flash.Warning", "")
        if warning and ("dang nhap" in warning.lower() or "đăng nhập" in warning.lower()):
            return True

    return False


class DAUDownloader:

    """
    Bộ tải tự động danh sách, trang chi tiết và tài liệu đính kèm DAU.
    Tuân thủ nghiêm ngặt nguyên tắc: ĐÚNG DỮ LIỆU > ĐỦ DỮ LIỆU > TỐC ĐỘ.
    """

    def __init__(
        self,
        cookie_string: Optional[str] = None,
        cookie_file: Optional[Path] = None,
        notifications_file: Path = OUTPUT_FILE,
        details_dir: Path = DETAILS_CACHE_DIR,
        documents_dir: Path = DOCUMENTS_DIR,
        base_url: str = BASE_URL,
        delay: float = REQUEST_DELAY,
        timeout: int = REQUEST_TIMEOUT,
        dry_run: bool = False,
    ):
        self.notifications_file = Path(notifications_file)
        self.details_dir = Path(details_dir)
        self.documents_dir = Path(documents_dir)
        self.base_url = base_url
        self.delay = delay
        self.timeout = timeout
        self.dry_run = dry_run

        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)

        # Cấu hình Cookie từ cookie_string, cookie_file, hoặc tự động tìm kiếm
        raw_cookie = ""
        if cookie_string:
            raw_cookie = parse_cookie_content(cookie_string)
        elif cookie_file:
            raw_cookie = load_cookie_from_file(Path(cookie_file))

        if not raw_cookie:
            raw_cookie = get_cookie_string(custom_file=Path(cookie_file) if cookie_file else None)

        if raw_cookie:
            self._apply_cookies(raw_cookie)
            logger.info("Đã cấu hình phiên làm việc với Cookie được cung cấp.")
        else:
            logger.info("Không có Cookie xác thực. Hoạt động với phiên unauthenticated.")

    def _apply_cookies(self, cookie_string: str):
        """Gán chuỗi cookie vào Session sau khi đã làm sạch và chuẩn hóa."""
        clean_cookie = parse_cookie_content(cookie_string)
        if not clean_cookie:
            return

        self.session.headers["Cookie"] = clean_cookie
        pairs = clean_cookie.split(";")
        for pair in pairs:
            if "=" in pair:
                key, val = pair.strip().split("=", 1)
                k = key.strip()
                v = val.strip()
                self.session.cookies.set(k, v, domain="dau.edu.vn")
                self.session.cookies.set(k, v, domain="sinhvien.dau.edu.vn")
                self.session.cookies.set(k, v, domain=".dau.edu.vn")

    def fetch_url(
        self,
        url: str,
        stream: bool = False,
        max_retries: int = 3,
    ) -> Optional[requests.Response]:
        """
        Thực hiện HTTP GET có xử lý an toàn:
        - 200: Trả về response
        - 401/403: Báo AuthenticationRequiredError
        - 404: Cảnh báo và bỏ qua (trả về None)
        - 429: Exponential backoff có giới hạn (tối đa max_retries), sau đó dừng an toàn
        - Chuyển hướng login/CAPTCHA: Dừng an toàn, không bypass

        Khi stream=True (tải attachment binary): chỉ kiểm tra URL redirect và header,
        KHÔNG đọc response.text để tránh crash khi parse PDF/DOC binary bằng BeautifulSoup.
        """
        for attempt in range(max_retries + 1):
            if attempt > 0:
                backoff = self.delay * (2 ** (attempt - 1))
                logger.warning(
                    f"[429 Rate Limit] Đợi {backoff:.1f}s trước khi thử lại URL: {url} "
                    f"(lần {attempt}/{max_retries})..."
                )
                time.sleep(backoff)

            try:
                response = self.session.get(
                    url,
                    timeout=self.timeout,
                    stream=stream,
                    allow_redirects=True,
                )
            except requests.RequestException as e:
                if attempt < max_retries:
                    logger.warning(f"Lỗi mạng khi tải {url}: {e}. Thử lại...")
                    continue
                logger.error(f"Lỗi mạng không thể khắc phục tại {url}: {e}")
                return None

            # Xử lý HTTP 429 (Rate Limit)
            if response.status_code == 429:
                if attempt < max_retries:
                    continue
                logger.error("Máy chủ phản hồi 429 Too Many Requests và đã vượt số lần retry.")
                raise RateLimitExceededError(
                    "Máy chủ giới hạn tốc độ (HTTP 429). Đã dừng an toàn."
                )

            # Xử lý HTTP 401/403 (Cần xác thực)
            if response.status_code in (401, 403):
                logger.error(f"Truy cập bị từ chối (HTTP {response.status_code}) tại: {url}")
                raise AuthenticationRequiredError(
                    "Website yêu cầu đăng nhập, cần cung cấp phiên đăng nhập hợp lệ."
                )

            # Xử lý HTTP 404 (Không tìm thấy)
            if response.status_code == 404:
                logger.warning(f"[WARNING] Không tìm thấy tài nguyên (HTTP 404): {url}")
                return None

            # Kiểm tra chuyển hướng đăng nhập hoặc CAPTCHA
            # - Khi stream=True (tải binary/PDF): CHỈ kiểm tra URL redirect + Cookie header.
            #   Tuyệt đối không gọi response.text hay BeautifulSoup vì sẽ crash trên binary.
            # - Khi stream=False (tải HTML): có thể phân tích nội dung đầy đủ qua is_login_required().
            content_type = response.headers.get("Content-Type", "")
            if stream or _is_binary_content_type(content_type):
                # An toàn: chỉ kiểm tra URL redirect và cookie header
                if _is_html_login_page_by_headers(response):
                    logger.error(f"Website yêu cầu đăng nhập hoặc CAPTCHA tại URL: {url}")
                    raise AuthenticationRequiredError(
                        "Website yêu cầu đăng nhập, cần cung cấp phiên đăng nhập hợp lệ."
                    )
            else:
                # HTML response: phân tích đầy đủ qua is_login_required()
                if is_login_required(response):
                    logger.error(f"Website yêu cầu đăng nhập hoặc CAPTCHA tại URL: {url}")
                    raise AuthenticationRequiredError(
                        "Website yêu cầu đăng nhập, cần cung cấp phiên đăng nhập hợp lệ."
                    )

            if response.status_code != 200:
                logger.warning(f"Mã HTTP không mong muốn {response.status_code} tại: {url}")
                return None

            return response

        return None


    def get_cached_detail_path(self, detail_url: str) -> Path:
        """Xác định đường dẫn file cache HTML cho một URL chi tiết."""
        slug = extract_slug_from_url(detail_url)
        if not slug or slug == "tin":
            import hashlib
            slug = hashlib.md5(detail_url.encode("utf-8")).hexdigest()
        filename = sanitize_filename(f"{slug}.html")
        return self.details_dir / filename

    def fetch_and_cache_detail_html(self, detail_url: str) -> Tuple[str, bool]:
        """
        Lấy mã nguồn HTML trang chi tiết:
        - Kiểm tra cache trong crawler/data/details/ trước
        - Nếu có cache: trả về (html, is_cached=True)
        - Nếu chưa có: tải về từ web, lưu cache (nếu không dry_run), trả về (html, is_cached=False)
        """
        cache_path = self.get_cached_detail_path(detail_url)

        # 1. Kiểm tra cache cục bộ
        if cache_path.exists() and cache_path.stat().st_size > 0:
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    content = f.read()
                return content, True
            except Exception as e:
                logger.warning(f"Không thể đọc file cache {cache_path}: {e}")

        # 2. Nếu ở chế độ dry-run và chưa có cache: chỉ tải nếu cần phân tích nhưng không ghi file
        time.sleep(self.delay)
        resp = self.fetch_url(detail_url, stream=False)
        if not resp:
            return "", False

        html = resp.text

        # 3. Lưu cache vào đĩa (chỉ khi không phải dry-run)
        if not self.dry_run and html:
            try:
                self.details_dir.mkdir(parents=True, exist_ok=True)
                with open(cache_path, "w", encoding="utf-8") as f:
                    f.write(html)
            except Exception as e:
                logger.warning(f"Lỗi khi lưu cache HTML {cache_path}: {e}")

        return html, False

    def download_attachment(
        self,
        attachment_url: str,
        year: str = "",
    ) -> Tuple[Optional[Path], bool]:
        """
        Tải file đính kèm (PDF/DOC/DOCX) về crawler/data/documents/<year>/<safe_filename>:
        - Khử trùng lặp và kiểm tra file đã tồn tại trên đĩa (cache hit)
        - Tên file an toàn trên Windows
        - Trả về (target_path, is_cached)
        """
        if not is_allowed_document(attachment_url):
            return None, False

        # Xác định thư mục đích
        if year:
            dest_dir = self.documents_dir / year
        else:
            dest_dir = self.documents_dir

        parsed = urlparse(attachment_url)
        raw_name = parsed.path.split("/")[-1]
        safe_name = sanitize_filename(raw_name)
        target_path = dest_dir / safe_name

        # 1. Kiểm tra nếu file đã tồn tại và hợp lệ (cache hit)
        if target_path.exists() and target_path.stat().st_size > 0:
            return target_path, True

        # 2. Nếu ở chế độ dry-run: không tạo thư mục, không tải file
        if self.dry_run:
            return target_path, False

        # 3. Tải file từ mạng
        dest_dir.mkdir(parents=True, exist_ok=True)
        time.sleep(self.delay)

        resp = self.fetch_url(attachment_url, stream=True)
        if not resp:
            return None, False

        # Kiểm tra Content-Type trước khi ghi file.
        # Server đôi khi trả về trang HTML đăng nhập (200 OK) thay vì file binary.
        # Không được lưu HTML thành .pdf / .doc / .docx.
        resp_content_type = resp.headers.get("Content-Type", "")
        if not _is_binary_content_type(resp_content_type):
            # Content-Type không phải binary → có thể là HTML login page
            # Đọc tối đa 512 bytes đầu để kiểm tra magic bytes, không đọc toàn bộ body
            try:
                peek = next(resp.iter_content(chunk_size=512), b"")
            except Exception:
                peek = b""

            # Nếu không có magic bytes hợp lệ của tài liệu → từ chối ghi file
            is_valid_doc = any(peek.startswith(magic) for magic in _DOCUMENT_MAGIC_BYTES)
            if not is_valid_doc:
                logger.warning(
                    f"[CẢNH BÁO] Server trả về Content-Type '{resp_content_type}' "
                    f"(không phải binary document) cho URL: {attachment_url}. "
                    f"Có thể là trang đăng nhập. Bỏ qua, KHÔNG lưu file."
                )
                return None, False

            # Có magic bytes hợp lệ → ghi phần đã peek + phần còn lại
            part_path = target_path.with_suffix(target_path.suffix + ".part")
            try:
                with open(part_path, "wb") as f:
                    if peek:
                        f.write(peek)
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                if part_path.exists():
                    part_path.replace(target_path)
                return target_path, False
            except Exception as e:
                logger.error(f"Lỗi khi lưu file đính kèm {target_path}: {e}")
                if part_path.exists():
                    try:
                        part_path.unlink()
                    except Exception:
                        pass
                return None, False

        # Content-Type là binary document hợp lệ → ghi stream trực tiếp
        # Ghi file nguyên tử bằng file tạm .part
        part_path = target_path.with_suffix(target_path.suffix + ".part")
        try:
            with open(part_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            if part_path.exists():
                part_path.replace(target_path)
            return target_path, False
        except Exception as e:
            logger.error(f"Lỗi khi lưu file đính kèm {target_path}: {e}")
            if part_path.exists():
                try:
                    part_path.unlink()
                except Exception:
                    pass
            return None, False

    def run(self) -> Dict[str, Any]:
        """
        Điều phối toàn bộ quá trình:
        1. Đọc danh sách từ notifications.json
        2. Tải HTML trang chi tiết (hoặc đọc cache)
        3. Khớp chính xác với thông báo
        4. Trích xuất và tải file đính kèm PDF/DOC/DOCX
        5. Cập nhật notifications.json
        6. Hiển thị tổng kết
        """
        stats = {
            "total_notifications": 0,
            "details_fetched": 0,
            "strictly_matched": 0,
            "skipped": 0,
            "attachments_found": 0,
            "attachments_downloaded": 0,
            "attachments_cached": 0,
            "html_cached": 0,
        }

        # 1. Đọc notifications.json
        if not self.notifications_file.exists():
            logger.error(f"Không tìm thấy file: {self.notifications_file}")
            return stats

        with open(self.notifications_file, "r", encoding="utf-8") as f:
            notifications = json.load(f)

        if not isinstance(notifications, list):
            logger.error(f"Nội dung file {self.notifications_file} không phải danh sách.")
            return stats

        stats["total_notifications"] = len(notifications)
        logger.info(f"Đã nạp {len(notifications)} thông báo từ {self.notifications_file}")

        # Tập hợp URL đính kèm đã tải trong toàn phiên để chống tải trùng
        session_processed_attachments: Set[str] = set()
        updated_notifications = copy.deepcopy(notifications)
        any_updates = False

        for idx, notif in enumerate(updated_notifications, 1):
            detail_url = notif.get("detail_url", "").strip()
            title = notif.get("title", "")
            date_str = notif.get("date", "")

            if not detail_url:
                logger.warning(f"[{idx}/{len(notifications)}] Thông báo không có detail_url: '{title[:40]}'")
                stats["skipped"] += 1
                continue

            logger.info(f"\n[{idx}/{len(notifications)}] Đang xử lý: '{title[:45]}...'")

            # 2. Tải HTML trang chi tiết (hoặc đọc từ cache)
            try:
                html, is_html_cached = self.fetch_and_cache_detail_html(detail_url)
            except AuthenticationRequiredError as e:
                logger.error(f"Dừng an toàn: {e}")
                raise
            except RateLimitExceededError as e:
                logger.error(f"Dừng an toàn do Rate Limit: {e}")
                raise

            if not html:
                logger.warning(f"Không lấy được HTML chi tiết cho: {detail_url}")
                stats["skipped"] += 1
                continue

            if is_html_cached:
                stats["html_cached"] += 1
                logger.info(f"[CACHE] Trang chi tiết: {detail_url}")
            else:
                stats["details_fetched"] += 1
                logger.info(f"[DOWNLOAD] Trang chi tiết: {detail_url}")

            # 3. Phân tích chi tiết HTML
            detail_info = parse_announcement_detail(html, base_url=self.base_url)

            # 4. Đối sánh CHÍNH XÁC (STRICT MATCHING)
            is_matched = match_detail_to_notification(
                detail_info=detail_info,
                detail_url=detail_url,
                notification=notif,
            )

            if not is_matched:
                stats["skipped"] += 1
                logger.warning(
                    f"[BỎ QUA - KHÔNG KHỚP CHÍNH XÁC] Trang chi tiết không khớp chắc chắn với "
                    f"thông báo #{idx} ('{title[:40]}...'). Tuyệt đối không tự ý ghép nội dung."
                )
                continue

            stats["strictly_matched"] += 1

            # 5. Lọc và chuẩn hóa file đính kèm (chỉ PDF, DOC, DOCX)
            candidate_attachments = detail_info.get("attachments", [])
            valid_attachments: List[str] = []

            for raw_att in candidate_attachments:
                norm_att = normalize_attachment_url(raw_att, base_url=self.base_url)
                if norm_att and is_allowed_document(norm_att):
                    if norm_att not in valid_attachments:
                        valid_attachments.append(norm_att)

            stats["attachments_found"] += len(valid_attachments)
            logger.info(f"Phát hiện {len(valid_attachments)} file đính kèm hợp lệ (PDF/DOC/DOCX).")

            # 6. Tải từng file đính kèm và chống tải trùng
            year = determine_document_year(
                attachment_url=valid_attachments[0] if valid_attachments else "",
                date_str=date_str,
            )
            downloaded_local_paths: List[str] = []

            for att_url in valid_attachments:
                # Nếu file URL này đã xử lý trong phiên hiện tại -> bỏ qua
                if att_url in session_processed_attachments:
                    logger.debug(f"[TRÙNG LẶP ĐÃ XỬ LÝ] Bỏ qua URL đính kèm: {att_url}")
                    continue

                session_processed_attachments.add(att_url)

                local_path, is_att_cached = self.download_attachment(att_url, year=year)

                if is_att_cached:
                    stats["attachments_cached"] += 1
                    logger.info(f"[CACHE] File đính kèm: {local_path.name if local_path else att_url}")
                elif local_path:
                    if self.dry_run:
                        logger.info(f"[DRY-RUN] Phát hiện file cần tải: {local_path.name}")
                    else:
                        stats["attachments_downloaded"] += 1
                        logger.info(f"[DOWNLOAD] Tải thành công: {local_path.name}")

                if local_path:
                    try:
                        rel = local_path.relative_to(DATA_DIR).as_posix()
                    except Exception:
                        rel = str(local_path.as_posix())
                    downloaded_local_paths.append(rel)

            # 7. Cập nhật dữ liệu vào thông báo
            if not self.dry_run:
                # Cập nhật nội dung văn bản chính
                if detail_info.get("content"):
                    notif["content"] = detail_info["content"]

                # Cập nhật danh sách attachment URLs
                seen_att = set(notif.get("attachments", []))
                for a_url in valid_attachments:
                    if a_url not in seen_att:
                        seen_att.add(a_url)
                        notif["attachments"].append(a_url)

                # Bổ sung metadata
                notif["crawl_status"] = "success"
                notif["crawled_at"] = datetime.now().isoformat()
                notif["content_source"] = "cache" if is_html_cached else "web"
                notif["attachments_downloaded"] = downloaded_local_paths

                any_updates = True

        # 8. Lưu cập nhật ra file notifications.json (nếu không phải dry-run)
        if not self.dry_run and any_updates:
            with open(self.notifications_file, "w", encoding="utf-8") as f:
                json.dump(updated_notifications, f, ensure_ascii=False, indent=2)
            logger.info(f"\nĐã lưu cập nhật thành công vào: {self.notifications_file}")

        # 9. In bảng tổng kết đúng mẫu yêu cầu
        self.print_summary(stats)

        return stats

    def print_summary(self, stats: Dict[str, Any]):
        """In báo cáo tổng kết theo đúng mẫu yêu cầu."""
        print("\n" + "=" * 61)
        print(" DAU SECOND BRAIN - DOWNLOADER")
        print("=" * 61)
        print(f"Danh sách thông báo       : {stats['total_notifications']}")
        print(f"Trang chi tiết tải được   : {stats['details_fetched']}")
        print(f"Khớp chính xác            : {stats['strictly_matched']}")
        print(f"Bỏ qua                    : {stats['skipped']}")
        print(f"Attachment phát hiện      : {stats['attachments_found']}")
        print(f"Attachment tải thành công : {stats['attachments_downloaded']}")
        print(f"Attachment cache          : {stats['attachments_cached']}")
        print("=" * 61 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="DAU Second Brain - Downloader tự động tải trang chi tiết và văn bản đính kèm"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Chế độ chạy thử: phân tích và kiểm tra URL/attachments mà không ghi file hay tải về máy",
    )
    parser.add_argument(
        "--notifications",
        type=str,
        default=str(OUTPUT_FILE),
        help=f"Đường dẫn file notifications.json (mặc định: {OUTPUT_FILE})",
    )
    parser.add_argument(
        "--details-dir",
        type=str,
        default=str(DETAILS_CACHE_DIR),
        help=f"Thư mục lưu cache HTML trang chi tiết (mặc định: {DETAILS_CACHE_DIR})",
    )
    parser.add_argument(
        "--documents-dir",
        type=str,
        default=str(DOCUMENTS_DIR),
        help=f"Thư mục lưu tài liệu đính kèm (mặc định: {DOCUMENTS_DIR})",
    )
    parser.add_argument(
        "--cookie",
        type=str,
        default=None,
        help="Chuỗi Cookie phiên đăng nhập của sinh viên",
    )
    parser.add_argument(
        "--cookie-file",
        type=str,
        default=None,
        help="File chứa Cookie đăng nhập (mặc định đọc crawler/cookies.txt hoặc .env)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=REQUEST_DELAY,
        help=f"Thời gian nghỉ giữa các request (giây, mặc định: {REQUEST_DELAY})",
    )

    args = parser.parse_args()

    # Thiết lập logging
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    cookie_file_path = Path(args.cookie_file) if args.cookie_file else None

    downloader = DAUDownloader(
        cookie_string=args.cookie,
        cookie_file=cookie_file_path,
        notifications_file=Path(args.notifications),
        details_dir=Path(args.details_dir),
        documents_dir=Path(args.documents_dir),
        delay=args.delay,
        dry_run=args.dry_run,
    )

    try:
        downloader.run()
    except AuthenticationRequiredError as e:
        print("\n" + "!" * 65)
        print("[THÔNG BÁO QUAN TRỌNG: YÊU CẦU PHIÊN ĐĂNG NHẬP]")
        print("!" * 65)
        print("Website yêu cầu đăng nhập, cần cung cấp phiên đăng nhập hợp lệ.")
        print("Hệ thống tuân thủ nguyên tắc an toàn: KHÔNG bypass đăng nhập hoặc CAPTCHA.")
        print("CÁCH CUNG CẤP COOKIE:")
        print("  1. Đăng nhập https://sinhvien.dau.edu.vn trên trình duyệt.")
        print("  2. Lấy cookie từ DevTools (F12) -> Application -> Cookies.")
        print("  3. Chạy lệnh:")
        print('     python -m crawler.downloader --cookie "ASP.NET_SessionId=...; .ASPXAUTH=..."')
        print("     Hoặc lưu cookie vào file 'crawler/cookies.txt' hoặc biến DAU_COOKIE trong '.env'.")
        print("!" * 65)
        sys.exit(1)
    except RateLimitExceededError as e:
        print(f"\n[-] Dừng an toàn: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
