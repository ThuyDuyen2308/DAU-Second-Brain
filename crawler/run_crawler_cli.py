# -*- coding: utf-8 -*-
"""
CLI wrapper để thực thi DAUCrawler từ dòng lệnh hoặc từ Node.js child_process.
Nhận các tham số cấu hình và trả về JSON kết quả chuẩn hóa ra stdout.
"""

import argparse
import json
import sys
from pathlib import Path

# Đảm bảo mã hóa UTF-8 trên Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Thêm thư mục gốc vào PYTHONPATH
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from crawler.dau_crawler import DAUCrawler
from crawler.config import (
    CRAWLER_SOURCE_URL,
    DAU_CRAWLER_MAX_PAGES,
    DAU_CRAWLER_DELAY_MS,
    DAU_CRAWLER_TIMEOUT_MS,
)


def main():
    parser = argparse.ArgumentParser(description="DAU Notice Crawler CLI")
    parser.add_argument("--max-pages", type=int, default=DAU_CRAWLER_MAX_PAGES, help="Số trang tối đa cần quét")
    parser.add_argument("--dry-run", action="store_true", help="Chạy thử không tải file và không ghi DB")
    parser.add_argument("--source-url", type=str, default=CRAWLER_SOURCE_URL, help="URL nguồn thông báo DAU")
    parser.add_argument("--delay-ms", type=int, default=DAU_CRAWLER_DELAY_MS, help="Thời gian trễ giữa các request (ms)")
    parser.add_argument("--timeout-ms", type=int, default=DAU_CRAWLER_TIMEOUT_MS, help="Timeout mỗi request (ms)")
    parser.add_argument("--known-checksums", type=str, default="", help="Chuỗi JSON mảng SHA-256 đã có")
    parser.add_argument("--known-urls", type=str, default="", help="Chuỗi JSON mảng URL chi tiết đã có")
    parser.add_argument("--output-json", type=str, default="", help="Đường dẫn lưu kết quả JSON ra file")

    args = parser.parse_args()

    known_checksums = set()
    if args.known_checksums:
        try:
            parsed = json.loads(args.known_checksums)
            if isinstance(parsed, list):
                known_checksums = set(parsed)
        except Exception:
            pass

    known_urls = set()
    if args.known_urls:
        try:
            parsed = json.loads(args.known_urls)
            if isinstance(parsed, list):
                known_urls = set(parsed)
        except Exception:
            pass

    crawler = DAUCrawler(
        delay=args.delay_ms / 1000.0,
        timeout=args.timeout_ms / 1000.0,
        source_url=args.source_url
    )

    result = crawler.run_crawl(
        max_pages=args.max_pages,
        dry_run=args.dry_run,
        known_db_checksums=known_checksums,
        known_db_urls=known_urls
    )

    output_str = json.dumps(result, ensure_ascii=False, indent=2)

    if args.output_json:
        try:
            p = Path(args.output_json)
            p.parent.mkdir(parents=True, exist_ok=True)
            with open(p, "w", encoding="utf-8") as f:
                f.write(output_str)
        except Exception as e:
            sys.stderr.write(f"Không thể lưu output-json: {e}\n")

    # In kết quả chuẩn ra stdout
    print(output_str)


if __name__ == "__main__":
    main()
