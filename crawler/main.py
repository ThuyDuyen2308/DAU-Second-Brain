"""
Điểm vào thực thi (Entry point) cho Crawler DAU
Cách dùng:
    python -m crawler.main
    python -m crawler.main --cookie "ASP.NET_SessionId=...; .ASPXAUTH=..."
    python -m crawler.main --local-html path/to/saved_page.html
"""

import argparse
import json
import sys
from pathlib import Path

# Đảm bảo mã hóa UTF-8 cho terminal Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from .config import (
    DEFAULT_PAGE,
    DEFAULT_PAGE_SIZE,
    OUTPUT_FILE,
    DATA_DIR,
    BASE_URL,
)
from .parser import (
    parse_announcement_list,
    parse_announcement_detail,
    AuthenticationRequiredError,
)
from .dau_crawler import DAUCrawler


def run_local_html(html_path: str, output_path: Path):
    """Phân tích file HTML được lưu từ trình duyệt (khi sinh viên đã đăng nhập)."""
    p = Path(html_path)
    if not p.exists():
        print(f"[-] Lỗi: Không tìm thấy file HTML tại: {html_path}")
        return

    print(f"[*] Đang đọc file HTML: {html_path}")
    with open(p, "r", encoding="utf-8") as f:
        html = f.read()

    try:
        items = parse_announcement_list(html, base_url=BASE_URL)
    except AuthenticationRequiredError as e:
        print(f"[-] Lỗi: {e}")
        return

    print(f"[+] Trích xuất thành công {len(items)} thông báo từ file HTML.")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"[+] Đã lưu dữ liệu vào: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="DAU Second Brain - Bộ thu thập thông báo Trường Đại học Kiến trúc Đà Nẵng"
    )
    parser.add_argument(
        "--cookie",
        type=str,
        default=None,
        help="Chuỗi Cookie từ trình duyệt sau khi đăng nhập (e.g. 'ASP.NET_SessionId=...; .ASPXAUTH=...')"
    )
    parser.add_argument(
        "--cookie-file",
        type=str,
        default=None,
        help="Đường dẫn đến file chứa chuỗi Cookie (mặc định đọc crawler/cookies.txt hoặc .env)"
    )
    parser.add_argument(
        "--page",
        type=int,
        default=DEFAULT_PAGE,
        help=f"Số trang cần crawl (mặc định: {DEFAULT_PAGE})"
    )
    parser.add_argument(
        "--page-size",
        type=int,
        default=DEFAULT_PAGE_SIZE,
        help=f"Số lượng thông báo mỗi trang (mặc định: {DEFAULT_PAGE_SIZE})"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(OUTPUT_FILE),
        help=f"Đường dẫn file kết quả JSON (mặc định: {OUTPUT_FILE})"
    )
    parser.add_argument(
        "--no-attachments",
        action="store_true",
        help="Chỉ lấy danh sách tiêu đề, không truy cập từng trang chi tiết để tìm file đính kèm"
    )
    parser.add_argument(
        "--local-html",
        type=str,
        default=None,
        help="Phân tích trực tiếp từ file HTML lưu sẵn (offline) thay vì gọi mạng trực tiếp"
    )

    args = parser.parse_args()
    output_path = Path(args.output)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Chế độ offline: Đọc từ file HTML nội bộ
    if args.local_html:
        run_local_html(args.local_html, output_path)
        return

    # Lấy cookie nếu có file chỉ định
    cookie_str = args.cookie
    if not cookie_str and args.cookie_file:
        cfp = Path(args.cookie_file)
        if cfp.exists():
            cookie_str = cfp.read_text(encoding="utf-8").strip()

    print("=" * 65)
    print("      DAU SECOND BRAIN - CRAWLER KHO VĂN BẢN THÔNG BÁO")
    print("=" * 65)
    print(f"Trang mục tiêu: https://sinhvien.dau.edu.vn/sinh-vien/dm-tin/thong-bao.html?page={args.page}&pageSize={args.page_size}")
    print(f"File lưu kết quả: {output_path}")

    crawler = DAUCrawler(cookie_string=cookie_str)

    try:
        items = crawler.crawl_page(
            page=args.page,
            page_size=args.page_size,
            fetch_attachments=not args.no_attachments
        )

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)

        print("\n" + "-" * 65)
        print(f"[THÀNH CÔNG] Đã crawl được {len(items)} thông báo.")
        total_attachments = sum(len(item.get("attachments", [])) for item in items)
        print(f"[THÀNH CÔNG] Tổng số file đính kèm tìm thấy: {total_attachments}")
        print(f"[KẾT QUẢ] Đã lưu tại: {output_path}")
        print("-" * 65)

    except AuthenticationRequiredError as e:
        print("\n" + "!" * 65)
        print("[THÔNG BÁO QUAN TRỌNG: YÊU CẦU XÁC THỰC ĐĂNG NHẬP]")
        print("!" * 65)
        print("Trang thông báo sinh viên của Trường Đại học Kiến trúc Đà Nẵng")
        print("yêu cầu tài khoản sinh viên đã đăng nhập và có mã CAPTCHA.")
        print("Theo quy tắc hệ thống: KHÔNG tự ý bypass đăng nhập hoặc giải CAPTCHA.\n")
        print("HƯỚNG DẪN CUNG CẤP SESSION/COOKIE:")
        print("1. Mở trình duyệt và đăng nhập vào: https://sinhvien.dau.edu.vn")
        print("2. Nhấn F12 (Developer Tools) -> Chuyển sang tab 'Network' (hoặc 'Application' -> Cookies)")
        print("3. Tải lại trang thông báo hoặc bấm vào 1 liên kết bất kỳ.")
        print("4. Copy toàn bộ giá trị header 'Cookie' (bao gồm ASP.NET_SessionId, .ASPXAUTH, ...)")
        print("5. Cung cấp cookie cho crawler bằng 1 trong các cách:")
        print("   - Cách 1: Tạo file .env với nội dung:")
        print("             DAU_COOKIE=\"ASP.NET_SessionId=...; .ASPXAUTH=...\"")
        print("   - Cách 2: Lưu chuỗi cookie vào file: crawler/cookies.txt")
        print("   - Cách 3: Chạy trực tiếp với tham số:")
        print("             python -m crawler.main --cookie \"...\"")
        print("!" * 65)

        # Đảm bảo file notifications.json được khởi tạo sẵn (rỗng) theo yêu cầu bước 6
        if not output_path.exists():
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump([], f, ensure_ascii=False, indent=2)
            print(f"[*] Đã khởi tạo file rỗng tại: {output_path}")

    except Exception as e:
        print(f"\n[-] Xảy ra lỗi ngoài ý muốn: {e}")
        if not output_path.exists():
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump([], f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
