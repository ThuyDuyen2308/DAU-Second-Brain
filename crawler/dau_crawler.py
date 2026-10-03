# -*- coding: utf-8 -*-
"""
Module điều phối Crawler cho Trường Đại học Kiến trúc Đà Nẵng (DAU).
Phiên bản Bước 20:
- Hỗ trợ phân trang tự động (Multi-page Pagination) có giới hạn và chống vòng lặp (Loop Detection).
- Rate Limiting lịch sự (Delay giữa các request).
- Xử lý mã lỗi HTTP và nhận diện AUTH_REQUIRED / CAPTCHA_REQUIRED / ACCESS_BLOCKED mà không bypass trái phép.
- Phân loại trùng lặp đa tầng (EXACT_DUPLICATE, LIKELY_DUPLICATE, NEW).
- Tải file đính kèm an toàn (Safe Download, chặn file độc hại, tính SHA-256 checksum).
- Hỗ trợ chế độ chạy thử (Dry Run).
"""

import hashlib
import json
import logging
import mimetypes
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Set, Tuple
from urllib.parse import urlparse, urljoin

import requests

from .config import (
    BASE_URL,
    CRAWLER_SOURCE_URL,
    ANNOUNCEMENTS_URL,
    LOGIN_URL,
    DEFAULT_PAGE,
    DEFAULT_PAGE_SIZE,
    DEFAULT_HEADERS,
    REQUEST_TIMEOUT,
    REQUEST_DELAY,
    DAU_CRAWLER_MAX_FILE_SIZE_MB,
    SAFE_EXTENSIONS,
    UNSAFE_EXTENSIONS,
    WEB_UPLOADS_DIR,
    OUTPUT_FILE,
    DATA_DIR,
    NORMALIZED_DOCUMENTS_FILE,
    get_cookie_string,
)
from .parser import (
    parse_announcement_list,
    parse_announcement_detail,
    is_login_required,
    is_captcha_required,
    extract_doc_number_from_text,
    AuthenticationRequiredError,
    CaptchaRequiredError,
    AccessBlockedError,
)

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [CRAWLER] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("DAUCrawler")


def sanitize_filename(filename: str) -> str:
    """Làm sạch tên file để tránh path traversal và ký tự không an toàn."""
    clean = re.sub(r'[\\/*?:"<>|]', "_", filename)
    clean = re.sub(r"\s+", "_", clean).strip("._")
    return clean or "unnamed_document"


def extract_year_from_text(text: str) -> Optional[int]:
    """Trích xuất năm học hoặc năm dương lịch (ví dụ 2026, 2025, 2024)."""
    if not text:
        return None
    matches = re.findall(r"\b(20[2-3][0-9])\b", text)
    if matches:
        return int(matches[0])
    return None


class DAUCrawler:
    """
    Crawler thu thập thông báo từ cổng sinh viên DAU.
    """

    def __init__(
        self,
        cookie_string: Optional[str] = None,
        delay: float = REQUEST_DELAY,
        timeout: float = REQUEST_TIMEOUT,
        source_url: Optional[str] = None
    ):
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.delay = delay
        self.timeout = timeout
        self.source_url = source_url or CRAWLER_SOURCE_URL

        # Nạp Cookie phiên nếu có
        raw_cookie = cookie_string or get_cookie_string()
        if raw_cookie:
            self._apply_cookies(raw_cookie)
            logger.info("Đã cấu hình phiên làm việc với Cookie.")
        else:
            logger.info("Chạy ở chế độ Public (Không có Cookie đăng nhập).")

    def _apply_cookies(self, cookie_string: str):
        """Chuyển đổi chuỗi Cookie vào Session."""
        self.session.headers["Cookie"] = cookie_string.strip()
        pairs = cookie_string.split(";")
        for pair in pairs:
            if "=" in pair:
                key, val = pair.strip().split("=", 1)
                self.session.cookies.set(key.strip(), val.strip(), domain="dau.edu.vn")

    def fetch_page_html(self, page: int = DEFAULT_PAGE, page_size: int = DEFAULT_PAGE_SIZE) -> Tuple[str, str]:
        """
        Tải nội dung HTML của trang danh sách thông báo theo phân trang.
        Trả về (html_content, status_or_reason).
        Ném ngoại lệ thích hợp nếu gặp AUTH_REQUIRED / CAPTCHA_REQUIRED / ACCESS_BLOCKED.
        """
        sep = "&" if "?" in self.source_url else "?"
        target_url = f"{self.source_url}{sep}page={page}&pageSize={page_size}"
        logger.info(f"Fetch page {page}: {target_url}")

        try:
            response = self.session.get(target_url, timeout=self.timeout, allow_redirects=True)
        except requests.exceptions.Timeout:
            logger.error(f"Timeout khi kết nối tới: {target_url}")
            raise TimeoutError(f"Hết thời gian chờ phản hồi ({self.timeout}s) từ DAU.")
        except requests.RequestException as e:
            logger.error(f"Lỗi mạng khi kết nối: {e}")
            raise ConnectionError(f"Lỗi kết nối mạng tới DAU: {e}")

        # Kiểm tra HTTP status codes
        if response.status_code == 429:
            logger.warning("Máy chủ phản hồi HTTP 429 (Too Many Requests / Rate Limited).")
            raise AccessBlockedError("Server DAU giới hạn tần suất truy cập (HTTP 429 Rate Limit).")
        if response.status_code == 403:
            logger.warning("Máy chủ phản hồi HTTP 403 (Forbidden / Access Denied).")
            raise AccessBlockedError("Server DAU từ chối truy cập (HTTP 403 Forbidden).")
        if response.status_code >= 500:
            logger.warning(f"Máy chủ phản hồi mã lỗi hệ thống HTTP {response.status_code}.")
            raise requests.HTTPError(f"Máy chủ DAU gặp sự cố HTTP {response.status_code}.")
        if response.status_code != 200:
            raise requests.HTTPError(f"Máy chủ phản hồi mã HTTP {response.status_code}.")

        # Kiểm tra chuyển hướng hoặc nội dung đăng nhập
        if is_login_required(response):
            msg = f"Nguồn yêu cầu xác thực người dùng (Chuyển hướng đăng nhập: {response.url})."
            logger.warning(f"AUTH_REQUIRED: {msg}")
            raise AuthenticationRequiredError(msg)

        # Kiểm tra CAPTCHA
        if is_captcha_required(response):
            msg = "Website yêu cầu giải mã bảo mật CAPTCHA."
            logger.warning(f"CAPTCHA_REQUIRED: {msg}")
            raise CaptchaRequiredError(msg)

        return response.text, "OK"

    def fetch_detail_html(self, detail_url: str) -> Tuple[str, str]:
        """Tải mã nguồn HTML của một trang thông báo chi tiết."""
        logger.debug(f"Đang tải chi tiết: {detail_url}")
        try:
            response = self.session.get(detail_url, timeout=self.timeout, allow_redirects=True)
            if response.status_code in (403, 429):
                return "", "ACCESS_BLOCKED"
            if is_login_required(response):
                logger.warning(f"Trang chi tiết yêu cầu xác thực: {detail_url}")
                return "", "AUTH_REQUIRED"
            if is_captcha_required(response):
                logger.warning(f"Trang chi tiết yêu cầu CAPTCHA: {detail_url}")
                return "", "CAPTCHA_REQUIRED"
            if response.status_code != 200:
                return "", f"HTTP_{response.status_code}"
            return response.text, "OK"
        except Exception as e:
            logger.warning(f"Không thể tải chi tiết {detail_url}: {e}")
            return "", "NETWORK_ERROR"

    def download_attachment(
        self,
        attachment_url: str,
        dest_dir: Optional[Path] = None,
        max_size_mb: int = DAU_CRAWLER_MAX_FILE_SIZE_MB
    ) -> Dict[str, Any]:
        """
        Tải một tệp đính kèm an toàn từ server:
        - Kiểm tra Content-Length và Content-Type
        - Từ chối định dạng nguy hiểm (.exe, .bat,...)
        - Tính toán SHA-256 checksum trong luồng streaming
        - Lưu vào thư mục phân cấp an toàn
        """
        dest_dir = dest_dir or WEB_UPLOADS_DIR
        max_bytes = max_size_mb * 1024 * 1024

        parsed = urlparse(attachment_url)
        raw_name = Path(parsed.path).name or "document"
        ext = Path(raw_name).suffix.lower()

        if ext in UNSAFE_EXTENSIONS:
            return {
                "success": False,
                "error": "UNSAFE_FILE_EXTENSION",
                "message": f"Tệp có đuôi mở rộng không an toàn ({ext}). Từ chối tải xuống."
            }

        try:
            # Gửi HEAD hoặc GET stream để kiểm tra headers
            resp = self.session.get(attachment_url, stream=True, timeout=self.timeout)
            if resp.status_code != 200:
                return {
                    "success": False,
                    "error": f"HTTP_{resp.status_code}",
                    "message": f"Máy chủ phản hồi HTTP {resp.status_code}"
                }

            content_length = resp.headers.get("Content-Length")
            if content_length and int(content_length) > max_bytes:
                return {
                    "success": False,
                    "error": "FILE_TOO_LARGE",
                    "message": f"Dung lượng tệp ({int(content_length)} bytes) vượt quá giới hạn {max_size_mb}MB."
                }

            content_type = resp.headers.get("Content-Type", "").split(";")[0].strip().lower()

            # Nếu chưa có extension rõ ràng, suy luận từ content-type
            if not ext or ext not in SAFE_EXTENSIONS:
                guessed_ext = mimetypes.guess_extension(content_type)
                if guessed_ext in SAFE_EXTENSIONS:
                    ext = guessed_ext
                elif "pdf" in content_type:
                    ext = ".pdf"
                elif "word" in content_type or "officedocument" in content_type:
                    ext = ".docx"
                elif "html" in content_type:
                    ext = ".html"
                else:
                    ext = ".pdf"  # Fallback phổ biến cho thông báo DAU

            # Stream download và tính SHA-256
            hasher = hashlib.sha256()
            chunks = []
            total_size = 0

            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    total_size += len(chunk)
                    if total_size > max_bytes:
                        return {
                            "success": False,
                            "error": "FILE_TOO_LARGE",
                            "message": f"Dung lượng tệp vượt quá giới hạn {max_size_mb}MB trong khi tải."
                        }
                    hasher.update(chunk)
                    chunks.append(chunk)

            checksum = hasher.hexdigest()
            prefix = checksum[:2]
            target_sub_dir = dest_dir / prefix
            target_sub_dir.mkdir(parents=True, exist_ok=True)

            clean_base_name = sanitize_filename(Path(raw_name).stem)
            target_filename = f"{checksum}_{clean_base_name}{ext}"
            target_path = target_sub_dir / target_filename

            # Ghi file ra đĩa
            with open(target_path, "wb") as f:
                for c in chunks:
                    f.write(c)

            # Format định danh
            file_format = "pdf"
            if ext == ".docx":
                file_format = "docx"
            elif ext in (".html", ".htm"):
                file_format = "html"

            # Đường dẫn tương đối từ thư mục web
            relative_storage_path = f"uploads/imported/{prefix}/{target_filename}"

            logger.info(f"Download completed: {target_filename} ({total_size} bytes)")
            return {
                "success": True,
                "storage_path": relative_storage_path,
                "full_path": str(target_path),
                "filename": f"{clean_base_name}{ext}",
                "checksum": checksum,
                "size_bytes": total_size,
                "mime_type": content_type or "application/octet-stream",
                "file_format": file_format,
            }

        except Exception as e:
            logger.error(f"Lỗi khi tải file {attachment_url}: {e}")
            return {
                "success": False,
                "error": "DOWNLOAD_FAILED",
                "message": str(e)
            }

    def load_known_knowledge_base(self) -> Tuple[Set[str], Set[str], Dict[str, Dict[str, Any]]]:
        """
        Đọc các văn bản hiện có từ documents.json để phục vụ so sánh trùng lặp.
        Trả về (known_urls, known_checksums, known_doc_numbers).
        """
        known_urls = set()
        known_checksums = set()
        known_docs_by_num = {}

        if NORMALIZED_DOCUMENTS_FILE.exists():
            try:
                with open(NORMALIZED_DOCUMENTS_FILE, "r", encoding="utf-8") as f:
                    docs = json.load(f)
                    for d in docs:
                        url = d.get("source_url") or d.get("url") or ""
                        if url:
                            known_urls.add(url.strip().lower())
                        doc_num = d.get("document_number")
                        if doc_num:
                            norm_num = re.sub(r"\s+", "", doc_num).upper()
                            known_docs_by_num[norm_num] = d
            except Exception as e:
                logger.warning(f"Không thể đọc dataset chuẩn hóa documents.json: {e}")

        return known_urls, known_checksums, known_docs_by_num

    def classify_duplicate(
        self,
        item: Dict[str, Any],
        known_urls: Set[str],
        known_checksums: Set[str],
        known_docs_by_num: Dict[str, Dict[str, Any]],
        file_checksum: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Phân loại trùng lặp theo quy tắc đa tầng:
        - EXACT_DUPLICATE: Trùng URL chi tiết hoặc trùng file checksum SHA-256
        - LIKELY_DUPLICATE: Trùng số hiệu văn bản nhưng năm học / nội dung có khác biệt
        - NEW: Không phát hiện trùng lặp
        """
        detail_url = (item.get("detail_url") or "").strip().lower()

        # 1. Trùng chính xác URL
        if detail_url and detail_url in known_urls:
            return "EXACT_DUPLICATE", f"Trùng khớp URL chi tiết đã tồn tại: {detail_url}"

        # 2. Trùng chính xác SHA-256 checksum
        if file_checksum and file_checksum in known_checksums:
            return "EXACT_DUPLICATE", f"Trùng khớp mã băm SHA-256 của tệp đính kèm: {file_checksum}"

        # 3. Kiểm tra số hiệu văn bản
        doc_num = item.get("document_number")
        if doc_num:
            norm_num = re.sub(r"\s+", "", doc_num).upper()
            if norm_num in known_docs_by_num:
                existing_doc = known_docs_by_num[norm_num]
                existing_title = existing_doc.get("title", "")
                current_title = item.get("title", "")

                # Kiểm tra năm học
                year_existing = extract_year_from_text(existing_title)
                year_current = extract_year_from_text(current_title)

                if year_existing and year_current and year_existing != year_current:
                    # Khác năm học -> Văn bản mới cho năm học mới, KHÔNG coi là trùng tự động!
                    return "NEW", f"Trùng số hiệu {doc_num} nhưng khác năm học ({year_current} vs {year_existing})."
                else:
                    return "LIKELY_DUPLICATE", f"Trùng số hiệu {doc_num} với văn bản '{existing_title[:50]}...'. Cần Admin xem xét."

        return "NEW", "Văn bản mới hoàn toàn."

    def run_crawl(
        self,
        max_pages: int = 5,
        dry_run: bool = False,
        known_db_checksums: Optional[Set[str]] = None,
        known_db_urls: Optional[Set[str]] = None
    ) -> Dict[str, Any]:
        """
        Thực hiện toàn bộ quy trình crawl tự động:
        1. Phân trang từ page 1 đến max_pages với Loop Detection.
        2. Bóc tách metadata danh sách thông báo.
        3. Tải trang chi tiết để lấy đính kèm (có delay).
        4. Phân loại trùng lặp đa lớp.
        5. Tải file an toàn nếu không phải Dry Run.
        6. Trả về báo cáo tổng hợp.
        """
        logger.info(f"Starting crawl job: max_pages={max_pages}, dry_run={dry_run}")
        start_time = datetime.now()

        known_file_urls, known_file_checksums, known_docs_by_num = self.load_known_knowledge_base()
        all_known_urls = known_file_urls | (known_db_urls or set())
        all_known_checksums = known_file_checksums | (known_db_checksums or set())

        pages_scanned = 0
        items_found = 0
        new_items = 0
        duplicate_items = 0
        likely_duplicate_items = 0
        failed_items = 0
        downloaded_files = 0
        skipped_files = 0

        scanned_items_list = []
        downloaded_documents = []
        seen_page_signatures = set()

        crawl_status = "COMPLETED"
        error_message = None

        try:
            for page in range(1, max_pages + 1):
                try:
                    html, reason = self.fetch_page_html(page=page)
                except AuthenticationRequiredError as e:
                    logger.warning(f"AUTH_REQUIRED tại page {page}: {e}")
                    crawl_status = "AUTH_REQUIRED"
                    error_message = str(e)
                    break
                except CaptchaRequiredError as e:
                    logger.warning(f"CAPTCHA_REQUIRED tại page {page}: {e}")
                    crawl_status = "CAPTCHA_REQUIRED"
                    error_message = str(e)
                    break
                except AccessBlockedError as e:
                    logger.warning(f"ACCESS_BLOCKED tại page {page}: {e}")
                    crawl_status = "ACCESS_BLOCKED"
                    error_message = str(e)
                    break
                except Exception as e:
                    logger.error(f"Lỗi khi tải trang {page}: {e}")
                    crawl_status = "FAILED" if page == 1 else "PARTIAL"
                    error_message = str(e)
                    break

                pages_scanned += 1
                items = parse_announcement_list(html, base_url=BASE_URL, source_page=page)

                if not items:
                    logger.info(f"Không còn thông báo tại trang {page}. Dừng phân trang.")
                    break

                # Chống vòng lặp (Loop Detection) bằng chữ ký tập hợp URL
                page_signature = tuple(sorted(item.get("detail_url") for item in items if item.get("detail_url")))
                if page_signature and page_signature in seen_page_signatures:
                    logger.info(f"Phát hiện danh sách trang {page} trùng lặp với trang trước (Loop Detection). Dừng phân trang.")
                    break
                seen_page_signatures.add(page_signature)

                items_found += len(items)
                logger.info(f"Page {page}: Tìm thấy {len(items)} thông báo.")

                # Quét chi tiết và file đính kèm cho từng thông báo
                for idx, item in enumerate(items, 1):
                    detail_url = item.get("detail_url")
                    time.sleep(self.delay)  # Rate limiting lịch sự

                    if detail_url:
                        detail_html, detail_status = self.fetch_detail_html(detail_url)
                        if detail_html:
                            detail_info = parse_announcement_detail(detail_html, base_url=BASE_URL)
                            item["attachments"] = detail_info.get("attachments", [])
                            item["attachment_urls"] = detail_info.get("attachments", [])
                            if not item["published_date"] and detail_info.get("date"):
                                item["published_date"] = detail_info["date"]
                            if not item["document_number"]:
                                item["document_number"] = extract_doc_number_from_text(detail_info.get("title", "")) or extract_doc_number_from_text(detail_info.get("content", ""))

                    # Phân loại trùng lặp sơ bộ
                    dup_status, dup_reason = self.classify_duplicate(
                        item, all_known_urls, all_known_checksums, known_docs_by_num
                    )
                    item["duplicate_status"] = dup_status
                    item["duplicate_reason"] = dup_reason

                    # Tải file nếu có và không phải Dry Run
                    attachments = item.get("attachments", [])
                    item_downloaded = []

                    if attachments and not dry_run:
                        for att_url in attachments:
                            time.sleep(self.delay / 2.0)
                            dl_res = self.download_attachment(att_url)
                            if dl_res.get("success"):
                                dl_checksum = dl_res["checksum"]
                                # Kiểm tra lại trùng lặp theo SHA-256
                                if dl_checksum in all_known_checksums:
                                    item["duplicate_status"] = "EXACT_DUPLICATE"
                                    item["duplicate_reason"] = f"File trùng khớp SHA-256 đã có trong hệ thống: {dl_checksum}"
                                    skipped_files += 1
                                else:
                                    all_known_checksums.add(dl_checksum)
                                    downloaded_files += 1
                                    item_downloaded.append(dl_res)
                                    downloaded_documents.append({
                                        "source_type": "CRAWLER",
                                        "source_url": self.source_url,
                                        "detail_url": detail_url,
                                        "title": item.get("title"),
                                        "document_number": item.get("document_number"),
                                        "published_date": item.get("published_date"),
                                        "file_info": dl_res
                                    })
                            else:
                                failed_items += 1

                    if item["duplicate_status"] == "EXACT_DUPLICATE":
                        duplicate_items += 1
                    elif item["duplicate_status"] == "LIKELY_DUPLICATE":
                        likely_duplicate_items += 1
                    else:
                        new_items += 1

                    item["downloaded_files"] = item_downloaded
                    scanned_items_list.append(item)

        except Exception as e:
            logger.error(f"Lỗi ngoại lệ trong quá trình crawl: {e}")
            crawl_status = "FAILED"
            error_message = str(e)

        finished_time = datetime.now()
        duration_sec = (finished_time - start_time).total_seconds()

        summary = {
            "status": crawl_status,
            "source_url": self.source_url,
            "max_pages": max_pages,
            "is_dry_run": dry_run,
            "pages_scanned": pages_scanned,
            "items_found": items_found,
            "new_items": new_items,
            "duplicate_items": duplicate_items,
            "likely_duplicate_items": likely_duplicate_items,
            "failed_items": failed_items,
            "downloaded_files": downloaded_files,
            "skipped_files": skipped_files,
            "error_message": error_message,
            "started_at": start_time.isoformat(),
            "finished_at": finished_time.isoformat(),
            "duration_seconds": round(duration_sec, 2),
            "items": scanned_items_list,
            "downloaded_documents": downloaded_documents
        }

        logger.info(
            f"Crawl finished with status {crawl_status}: "
            f"pages={pages_scanned}, found={items_found}, new={new_items}, dup={duplicate_items}, downloaded={downloaded_files}"
        )
        return summary
