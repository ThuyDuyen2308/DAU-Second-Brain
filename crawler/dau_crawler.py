"""
Module điều phối Crawler cho Trường Đại học Kiến trúc Đà Nẵng (DAU).
Thực hiện thu thập danh sách thông báo và tải trang chi tiết để lấy link đính kèm (PDF/DOC/DOCX).
"""

import json
import logging
import time
from pathlib import Path
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse

import requests

from .config import (
    BASE_URL,
    ANNOUNCEMENTS_URL,
    DEFAULT_PAGE,
    DEFAULT_PAGE_SIZE,
    DEFAULT_HEADERS,
    REQUEST_TIMEOUT,
    REQUEST_DELAY,
    OUTPUT_FILE,
    DATA_DIR,
    get_cookie_string,
)
from .parser import (
    parse_announcement_list,
    parse_announcement_detail,
    is_login_required,
    AuthenticationRequiredError,
)

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("DAUCrawler")


class DAUCrawler:
    """
    Crawler thu thập thông báo từ cổng sinh viên DAU.
    Hỗ trợ kiểm tra phiên đăng nhập và crawl đính kèm.
    """

    def __init__(self, cookie_string: Optional[str] = None, delay: float = REQUEST_DELAY):
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.delay = delay

        # Thiết lập Cookie phiên nếu có
        raw_cookie = cookie_string or get_cookie_string()
        if raw_cookie:
            self._apply_cookies(raw_cookie)
            logger.info("Đã cấu hình phiên làm việc với Cookie được cung cấp.")
        else:
            logger.warning("Không tìm thấy Cookie đăng nhập. Website DAU yêu cầu xác thực để xem thông báo.")

    def _apply_cookies(self, cookie_string: str):
        """Chuyển đổi chuỗi Cookie (từ browser DevTools hoặc file) vào Session."""
        # Gán trực tiếp vào header Cookie để đảm bảo gửi chính xác
        self.session.headers["Cookie"] = cookie_string.strip()
        
        # Đồng thời parse các cặp key=val vào session.cookies
        pairs = cookie_string.split(";")
        for pair in pairs:
            if "=" in pair:
                key, val = pair.strip().split("=", 1)
                self.session.cookies.set(key.strip(), val.strip(), domain="dau.edu.vn")

    def fetch_page_html(self, page: int = DEFAULT_PAGE, page_size: int = DEFAULT_PAGE_SIZE) -> str:
        """
        Tải nội dung HTML của trang danh sách thông báo theo số trang.
        Nếu website yêu cầu đăng nhập, ném ra AuthenticationRequiredError.
        """
        target_url = f"{ANNOUNCEMENTS_URL}?page={page}&pageSize={page_size}"
        logger.info(f"Đang tải trang thông báo: {target_url}")

        try:
            response = self.session.get(target_url, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        except requests.RequestException as e:
            logger.error(f"Lỗi mạng khi kết nối tới DAU: {e}")
            raise

        # Kiểm tra chuyển hướng đăng nhập
        if is_login_required(response):
            msg = (
                "YÊU CẦU ĐĂNG NHẬP: Website DAU chuyển hướng đến trang đăng nhập "
                f"({response.url}). Cần cung cấp Cookie/Session của sinh viên đã đăng nhập thành công."
            )
            logger.error(msg)
            raise AuthenticationRequiredError(msg)

        if response.status_code != 200:
            raise requests.HTTPError(f"Máy chủ phản hồi mã lỗi HTTP: {response.status_code}")

        return response.text

    def fetch_detail_html(self, detail_url: str) -> str:
        """Tải mã nguồn HTML của một trang thông báo chi tiết."""
        logger.debug(f"Đang tải chi tiết: {detail_url}")
        try:
            response = self.session.get(detail_url, timeout=REQUEST_TIMEOUT, allow_redirects=True)
            if is_login_required(response):
                logger.warning(f"Trang chi tiết yêu cầu xác thực: {detail_url}")
                return ""
            return response.text
        except requests.RequestException as e:
            logger.warning(f"Không thể tải chi tiết {detail_url}: {e}")
            return ""

    def crawl_page(
        self,
        page: int = DEFAULT_PAGE,
        page_size: int = DEFAULT_PAGE_SIZE,
        fetch_attachments: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Crawl toàn bộ thông báo của 1 trang:
        1. Lấy danh sách thông báo (title, date, detail_url).
        2. Tải trang chi tiết từng thông báo để trích xuất file đính kèm (PDF/DOC/DOCX).
        """
        html = self.fetch_page_html(page=page, page_size=page_size)
        items = parse_announcement_list(html, base_url=BASE_URL)
        logger.info(f"Tìm thấy {len(items)} thông báo trên trang {page}.")

        if not items:
            logger.warning("Không trích xuất được thông báo nào từ HTML. Vui lòng kiểm tra lại cấu trúc trang.")
            return []

        if fetch_attachments:
            logger.info(f"Đang bắt đầu quét file đính kèm cho {len(items)} thông báo...")
            for idx, item in enumerate(items, 1):
                detail_url = item.get("detail_url")
                if detail_url:
                    time.sleep(self.delay)  # Tạm dừng tránh quá tải server
                    detail_html = self.fetch_detail_html(detail_url)
                    if detail_html:
                        detail_info = parse_announcement_detail(detail_html, base_url=BASE_URL)
                        item["attachments"] = detail_info.get("attachments", [])
                        # Nếu ngày hoặc tiêu đề lúc đầu chưa có, bổ sung từ trang chi tiết
                        if not item["date"] and detail_info.get("date"):
                            item["date"] = detail_info["date"]
                        if not item["title"] and detail_info.get("title"):
                            item["title"] = detail_info["title"]
                        
                        attach_count = len(item["attachments"])
                        if attach_count > 0:
                            logger.info(f"[{idx}/{len(items)}] '{item['title'][:40]}...' -> Có {attach_count} file đính kèm.")
                        else:
                            logger.debug(f"[{idx}/{len(items)}] '{item['title'][:40]}...' -> 0 file.")

        return items

    def crawl_and_save(
        self,
        page: int = DEFAULT_PAGE,
        page_size: int = DEFAULT_PAGE_SIZE,
        output_file: Path = OUTPUT_FILE
    ) -> List[Dict[str, Any]]:
        """
        Crawl thử 1 trang và lưu kết quả ra file JSON.
        """
        DATA_DIR.mkdir(parents=True, exist_ok=True)

        try:
            notifications = self.crawl_page(page=page, page_size=page_size)
        except AuthenticationRequiredError:
            # Lưu file rỗng hợp lệ nếu chưa có quyền truy cập
            if not output_file.exists():
                with open(output_file, "w", encoding="utf-8") as f:
                    json.dump([], f, ensure_ascii=False, indent=2)
            raise

        # Lưu file kết quả
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(notifications, f, ensure_ascii=False, indent=2)

        logger.info(f"Đã lưu thành công {len(notifications)} thông báo vào: {output_file}")
        return notifications
