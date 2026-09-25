"""
Module import dữ liệu thông báo DAU từ các file lưu cục bộ (HTML/PDF/DOCX).
Dành cho trường hợp người dùng đã đăng nhập bằng tài khoản được cấp quyền trên trình duyệt
và lưu trang web về máy (không cần gọi mạng hoặc vượt CAPTCHA).
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin

# Đảm bảo mã hóa UTF-8 cho terminal Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from .config import BASE_URL, DATA_DIR, OUTPUT_FILE
from .parser import (
    parse_announcement_list,
    parse_announcement_detail,
    AuthenticationRequiredError,
    clean_text,
)

# Thư mục input mặc định
INPUT_DIR = Path(__file__).resolve().parent / "input"

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("LocalImporter")


def read_file_safely(file_path: Path) -> str:
    """Đọc file với nhiều phương án mã hóa fallback (utf-8, cp1258, utf-16, latin1)."""
    encodings = ["utf-8", "utf-8-sig", "cp1258", "utf-16", "latin1"]
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
        except Exception as e:
            logger.error(f"Lỗi khi đọc file {file_path}: {e}")
            return ""
    logger.error(f"Không thể giải mã file {file_path} bằng các bảng mã thông dụng.")
    return ""


class LocalImporter:
    """
    Trình nhập dữ liệu thông báo DAU từ thư mục cục bộ (crawler/input/).
    Hỗ trợ:
    - Bóc tách trang danh sách HTML (list pages)
    - Bóc tách trang chi tiết HTML (detail pages) để lấy attachments
    - Liên kết file đính kèm thực tế (.pdf, .doc, .docx) nằm trong input/
    """

    def __init__(
        self,
        input_dir: Path = INPUT_DIR,
        output_file: Path = OUTPUT_FILE,
        base_url: str = BASE_URL,
    ):
        self.input_dir = Path(input_dir)
        self.output_file = Path(output_file)
        self.base_url = base_url

    def parse_single_html(self, file_path: Path) -> Dict[str, Any]:
        """
        Phân tích 1 file HTML đơn lẻ.
        Tự động nhận diện xem là trang danh sách (list page) hay trang chi tiết (detail page).
        """
        html_content = read_file_safely(file_path)
        if not html_content:
            return {"type": "empty", "items": []}

        try:
            # 1. Thử bóc tách theo dạng trang danh sách
            items = parse_announcement_list(html_content, base_url=self.base_url)
            if items:
                return {"type": "list", "items": items}
        except AuthenticationRequiredError:
            logger.warning(f"File {file_path.name} chứa nội dung trang đăng nhập (chưa xác thực).")
            return {"type": "login_page", "items": []}
        except Exception as e:
            logger.debug(f"Không thể parse theo dạng danh sách cho {file_path.name}: {e}")

        # 2. Thử bóc tách theo dạng trang chi tiết
        try:
            detail = parse_announcement_detail(html_content, base_url=self.base_url)
            if detail.get("title") or detail.get("attachments"):
                item = {
                    "title": detail.get("title") or file_path.stem,
                    "date": detail.get("date", ""),
                    "detail_url": str(file_path.as_posix()),
                    "attachments": detail.get("attachments", []),
                }
                return {"type": "detail", "items": [item]}
        except Exception as e:
            logger.debug(f"Không thể parse theo dạng chi tiết cho {file_path.name}: {e}")

        return {"type": "unknown", "items": []}

    def scan_and_import(self) -> List[Dict[str, Any]]:
        """
        Quét toàn bộ thư mục input/ để tìm các file HTML và file đính kèm.
        Tổng hợp, khử trùng lặp và liên kết file đính kèm.
        """
        if not self.input_dir.exists():
            logger.warning(f"Thư mục input không tồn tại: {self.input_dir}")
            self.input_dir.mkdir(parents=True, exist_ok=True)
            return []

        # 1. Tìm tất cả các file HTML trong thư mục input và các thư mục con
        html_files = sorted(
            list(self.input_dir.glob("**/*.html")) + list(self.input_dir.glob("**/*.htm"))
        )

        if not html_files:
            logger.info(f"Không tìm thấy file HTML nào trong thư mục: {self.input_dir}")
            return []

        logger.info(f"Tìm thấy {len(html_files)} file HTML trong {self.input_dir}")

        all_notifications = []
        detail_pages = []
        seen_keys = set()

        for hf in html_files:
            parsed = self.parse_single_html(hf)
            p_type = parsed.get("type")
            items = parsed.get("items", [])

            if p_type == "list":
                logger.info(f"Trích xuất được {len(items)} thông báo từ trang danh sách: {hf.name}")
                for it in items:
                    key = it.get("detail_url") or it.get("title")
                    if key not in seen_keys:
                        seen_keys.add(key)
                        all_notifications.append(it)

            elif p_type == "detail":
                logger.info(f"Phát hiện trang chi tiết: {hf.name}")
                detail_pages.extend(items)

        # 2. Liên kết các trang chi tiết với danh sách thông báo nếu có
        for d in detail_pages:
            matched = False
            for notif in all_notifications:
                # Khớp theo tiêu đề nếu giống nhau
                if d["title"] and notif["title"] and (d["title"] in notif["title"] or notif["title"] in d["title"]):
                    # Bổ sung attachments
                    for att in d.get("attachments", []):
                        if att not in notif["attachments"]:
                            notif["attachments"].append(att)
                    if not notif["date"] and d["date"]:
                        notif["date"] = d["date"]
                    matched = True
                    break

            if not matched:
                # Nếu trang chi tiết chưa có trong danh sách, thêm vào như 1 mục độc lập
                key = d.get("detail_url") or d.get("title")
                if key not in seen_keys:
                    seen_keys.add(key)
                    all_notifications.append(d)

        # 3. Kiểm tra các file đính kèm cục bộ (.pdf, .doc, .docx, .xlsx, .zip) có sẵn trong input/
        attachment_extensions = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".zip", ".rar"}
        local_attachment_files = [
            f for f in self.input_dir.glob("**/*")
            if f.is_file() and f.suffix.lower() in attachment_extensions
        ]

        if local_attachment_files:
            logger.info(f"Tìm thấy {len(local_attachment_files)} file tài liệu đính kèm cục bộ trong {self.input_dir}")
            for att_file in local_attachment_files:
                att_rel_path = att_file.relative_to(self.input_dir).as_posix()
                # Kiểm tra xem file này đã nằm trong thông báo nào chưa
                matched = False
                for notif in all_notifications:
                    for att in notif["attachments"]:
                        if att_file.name.lower() in att.lower():
                            matched = True
                            break
                    if matched:
                        break

                # Nếu chưa khớp vào đâu và có thông báo, có thể ghi nhận vào attachments
                if not matched and all_notifications:
                    # Gán vào thông báo có tiêu đề tương đồng nhất nếu có
                    for notif in all_notifications:
                        if att_file.stem.lower() in notif["title"].lower():
                            notif["attachments"].append(att_rel_path)
                            matched = True
                            break

        # 4. Chuẩn hóa dữ liệu theo cấu trúc 4 trường bắt buộc
        formatted_results = []
        for it in all_notifications:
            formatted_results.append({
                "title": clean_text(it.get("title", "")),
                "date": it.get("date", "").strip(),
                "detail_url": it.get("detail_url", "").strip(),
                "attachments": it.get("attachments", [])
            })

        return formatted_results

    def import_and_save(self) -> List[Dict[str, Any]]:
        """
        Thực hiện quét, trích xuất và xuất dữ liệu ra file JSON đích.
        """
        self.output_file.parent.mkdir(parents=True, exist_ok=True)
        results = self.scan_and_import()

        with open(self.output_file, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        logger.info(f"Đã xuất thành công {len(results)} thông báo ra: {self.output_file}")
        return results


def main():
    parser = argparse.ArgumentParser(
        description="DAU Second Brain - Module nhập dữ liệu thông báo từ các file HTML/tài liệu cục bộ"
    )
    parser.add_argument(
        "--input",
        type=str,
        default=str(INPUT_DIR),
        help=f"Thư mục chứa file HTML/PDF/DOCX cần import (mặc định: {INPUT_DIR})"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(OUTPUT_FILE),
        help=f"Đường dẫn file kết quả JSON (mặc định: {OUTPUT_FILE})"
    )
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Đường dẫn đến 1 file HTML cụ thể cần import"
    )

    args = parser.parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    print("=" * 65)
    print("   DAU SECOND BRAIN - LOCAL IMPORTER (NHẬP DỮ LIỆU CỤC BỘ)")
    print("=" * 65)

    importer = LocalImporter(input_dir=input_path, output_file=output_path)

    if args.file:
        target_file = Path(args.file)
        if not target_file.exists():
            print(f"[-] Lỗi: Không tìm thấy file: {target_file}")
            sys.exit(1)

        print(f"[*] Đang xử lý file đơn lẻ: {target_file}")
        res = importer.parse_single_html(target_file)
        items = res.get("items", [])
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)

        print(f"[+] Đã import thành công {len(items)} thông báo vào: {output_path}")
        return

    print(f"[*] Thư mục quét: {input_path}")
    print(f"[*] File xuất dữ liệu: {output_path}")

    results = importer.import_and_save()

    total_notifs = len(results)
    total_details = sum(1 for it in results if it.get("detail_url"))
    total_attachments = sum(len(it.get("attachments", [])) for it in results)

    print("\n" + "-" * 65)
    print(f"[KẾT QUẢ] Số thông báo trích xuất được : {total_notifs}")
    print(f"[KẾT QUẢ] Số URL chi tiết              : {total_details}")
    print(f"[KẾT QUẢ] Số file đính kèm trích xuất  : {total_attachments}")
    print(f"[KẾT QUẢ] Đã lưu dữ liệu vào           : {output_path}")
    print("-" * 65)

    if total_notifs == 0:
        print("\n[LƯU Ý] Chưa có file HTML nào được tìm thấy trong 'crawler/input/'.")
        print("Cách đưa dữ liệu vào:")
        print("1. Đăng nhập https://sinhvien.dau.edu.vn trên trình duyệt.")
        print("2. Vào trang thông báo, nhấn Ctrl + S để lưu file HTML.")
        print("3. Đặt file HTML vào thư mục: crawler/input/")
        print("4. Chạy lại lệnh: python -m crawler.local_importer")


if __name__ == "__main__":
    main()
