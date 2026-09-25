"""
Cấu hình cho Crawler DAU
"""
import os
from pathlib import Path
from typing import Optional, Dict

# Thư mục gốc dự án
BASE_DIR = Path(__file__).resolve().parent.parent
CRAWLER_DIR = Path(__file__).resolve().parent
DATA_DIR = CRAWLER_DIR / "data"
OUTPUT_FILE = DATA_DIR / "notifications.json"
INPUT_DIR = CRAWLER_DIR / "input"
DETAILS_DIR = INPUT_DIR / "details"
DETAILS_CACHE_DIR = DATA_DIR / "details"
DOCUMENTS_DIR = DATA_DIR / "documents"
EXTRACTED_DIR = DATA_DIR / "extracted"
NORMALIZED_DIR = DATA_DIR / "normalized"
NORMALIZED_DOCUMENTS_FILE = NORMALIZED_DIR / "documents.json"

# URLs
BASE_URL = "https://sinhvien.dau.edu.vn"
ANNOUNCEMENTS_URL = f"{BASE_URL}/sinh-vien/dm-tin/thong-bao.html"
LOGIN_URL = f"{BASE_URL}/sinh-vien-dang-nhap.html"

# Default params
DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 50
REQUEST_TIMEOUT = 20  # seconds
REQUEST_DELAY = 1.0   # seconds between requests to be polite

# HTTP Headers
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Connection": "keep-alive",
}

def load_env_file(filepath: Path = None) -> dict:
    """Đọc file .env đơn giản không cần cài thêm thư viện phụ thuộc."""
    if filepath is None:
        filepath = BASE_DIR / ".env"
    env_vars = {}
    if filepath.exists():
        for enc in ["utf-8-sig", "utf-8", "cp1258", "latin1"]:
            try:
                with open(filepath, "r", encoding=enc) as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            env_vars[k.strip()] = v.strip().strip("'\"")
                break
            except Exception:
                continue
    return env_vars


def parse_cookie_content(content: str) -> str:
    """
    Chuẩn hóa nội dung cookie từ chuỗi hoặc file sang định dạng header hợp lệ:
    - Loại bỏ BOM UTF-8 (\ufeff)
    - Loại bỏ tiền tố 'Cookie:' hoặc 'cookie:'
    - Hỗ trợ format 1 dòng: 'key1=val1; key2=val2'
    - Hỗ trợ format nhiều dòng: key1=val1\nkey2=val2
    - Hỗ trợ format Netscape / cURL (tab-separated)
    - Bỏ qua các dòng comment (# ...) và dòng trống
    """
    import re

    if not content:
        return ""

    content = content.lstrip("\ufeff").strip()
    content = re.sub(r"^[Cc]ookie:\s*", "", content).strip()

    lines = content.splitlines()
    cookies = {}
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        # Format Netscape (tab-separated, ít nhất 7 trường)
        if "\t" in line:
            parts = line.split("\t")
            if len(parts) >= 7:
                name = parts[5].strip()
                val = parts[6].strip()
                if name:
                    cookies[name] = val
                continue

        # Format thông thường: tách theo ';'
        for item in line.split(";"):
            item = item.strip()
            if not item or item.startswith("#"):
                continue
            if "=" in item:
                k, v = item.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k:
                    cookies[k] = v

    return "; ".join(f"{k}={v}" for k, v in cookies.items())


def load_cookie_from_file(filepath: Path) -> str:
    """Đọc và chuẩn hóa cookie từ một đường dẫn file cụ thể."""
    if not filepath:
        return ""
    p = Path(filepath)
    if not p.exists() or not p.is_file():
        return ""

    for enc in ["utf-8-sig", "utf-8", "cp1258", "latin1"]:
        try:
            with open(p, "r", encoding=enc) as f:
                content = f.read()
            parsed = parse_cookie_content(content)
            if parsed:
                return parsed
        except UnicodeDecodeError:
            continue
        except Exception:
            break
    return ""


def get_cookie_string(custom_file: Optional[Path] = None) -> str:
    """
    Lấy chuỗi Cookie từ nhiều nguồn theo thứ tự ưu tiên:
    1. File chỉ định tùy chọn (custom_file)
    2. Biến môi trường hệ thống DAU_COOKIE
    3. File .env (DAU_COOKIE=...)
    4. File crawler/cookies.txt
    5. File cookies.txt ở thư mục gốc (BASE_DIR / cookies.txt)
    """
    # 1. Custom file nếu được chỉ định
    if custom_file:
        cookie = load_cookie_from_file(custom_file)
        if cookie:
            return cookie

    # 2. Biến môi trường DAU_COOKIE
    if os.environ.get("DAU_COOKIE"):
        cookie = parse_cookie_content(os.environ.get("DAU_COOKIE", ""))
        if cookie:
            return cookie

    # 3. File .env
    env_vars = load_env_file()
    if env_vars.get("DAU_COOKIE"):
        cookie = parse_cookie_content(env_vars.get("DAU_COOKIE", ""))
        if cookie:
            return cookie

    # 4. File crawler/cookies.txt hoặc cookies.txt ở các vị trí khả dĩ
    candidate_paths = [
        CRAWLER_DIR / "cookies.txt",
        BASE_DIR / "crawler" / "cookies.txt",
        BASE_DIR / "cookies.txt",
        Path.cwd() / "crawler" / "cookies.txt",
        Path.cwd() / "cookies.txt",
    ]
    for p in candidate_paths:
        cookie = load_cookie_from_file(p)
        if cookie:
            return cookie

    return ""
