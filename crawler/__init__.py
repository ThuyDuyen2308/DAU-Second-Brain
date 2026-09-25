"""
DAU Second Brain - Crawler Module
Module thu thập văn bản, thông báo từ Trường Đại học Kiến trúc Đà Nẵng (DAU).
"""

from .config import BASE_URL, ANNOUNCEMENTS_URL, DEFAULT_PAGE_SIZE, INPUT_DIR, DETAILS_DIR
from .parser import (
    parse_announcement_list,
    parse_announcement_detail,
    is_login_required,
    AuthenticationRequiredError,
)
from .dau_crawler import DAUCrawler


__all__ = [
    "BASE_URL",
    "ANNOUNCEMENTS_URL",
    "DEFAULT_PAGE_SIZE",
    "INPUT_DIR",
    "DETAILS_DIR",
    "parse_announcement_list",
    "parse_announcement_detail",
    "is_login_required",
    "AuthenticationRequiredError",
    "DAUCrawler",
]



