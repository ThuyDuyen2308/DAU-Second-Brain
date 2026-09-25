"""
Module xử lý các trang chi tiết HTML được lưu cục bộ (crawler/input/details/).
Trích xuất: title, date, detail_url, nội dung thông báo (content), file đính kèm (attachments)
và cập nhật chính xác vào file crawler/data/notifications.json.
"""

import argparse
import json
import logging
import re
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin, urlparse, parse_qs, unquote

# Đảm bảo mã hóa UTF-8 cho terminal Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from .config import BASE_URL, DATA_DIR, OUTPUT_FILE, DETAILS_DIR
from .parser import (
    parse_announcement_detail,
    clean_text,
    extract_date_from_text,
    normalize_attachment_url,
    is_valid_announcement_item,
)
from .local_importer import read_file_safely

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("DetailProcessor")


def normalize_title_for_comparison(title: str) -> str:
    """
    Chuẩn hóa tiêu đề phục vụ so khớp CHÍNH XÁC 100%:
    - Loại bỏ thực thể HTML (&nbsp;)
    - Loại bỏ ngày tháng phụ lục ở đuôi dạng '- 28/08/2026' hoặc '(28/08/2026)'
    - Loại bỏ dấu câu ở đuôi (dấu chấm, phẩy, gạch ngang)
    - Loại bỏ khoảng trắng thừa và chuyển về chữ thường
    """
    if not title:
        return ""
    title = title.replace("&nbsp;", " ").replace("&nbsp", " ")
    # Bỏ ngày tháng dạng DD/MM/YYYY ở cuối tiêu đề
    title = re.sub(r"[-–—\s]*\b\d{1,2}/\d{1,2}/\d{4}\b.*$", "", title)
    # Bỏ dấu câu ở đuôi
    title = re.sub(r"[.\s\-_–—]+$", "", title)
    return re.sub(r"\s+", " ", title).strip().lower()


def is_valid_announcement_record(item: Dict[str, Any]) -> bool:
    """
    Kiểm tra một bản ghi trong notifications.json có phải là thông báo hợp lệ không.
    Loại bỏ các link điều hướng (ví dụ: '&nbspTin tức', link chuyên mục).
    """
    title = item.get("title", "")
    url = item.get("detail_url", "")
    return is_valid_announcement_item(title=title, href=url, date=item.get("date", ""))


class DetailProcessor:
    """
    Xử lý các trang chi tiết HTML trong crawler/input/details/ và bổ sung vào notifications.json.
    Tuân thủ nguyên tắc đối sánh CHÍNH XÁC (strict matching), không đoán mò theo substring.
    """

    def __init__(
        self,
        details_dir: Path = DETAILS_DIR,
        notifications_file: Path = OUTPUT_FILE,
        base_url: str = BASE_URL,
    ):
        self.details_dir = Path(details_dir)
        self.notifications_file = Path(notifications_file)
        self.base_url = base_url

    def load_notifications(self) -> List[Dict[str, Any]]:
        """
        Đọc danh sách thông báo hiện có trong notifications.json:
        1. Tự động loại bỏ các bản ghi điều hướng không hợp lệ (như '&nbspTin tức').
        2. Chuẩn hóa cấu trúc 5 trường.
        3. Dọn dẹp các nội dung bị ghép sai trước đó nếu có.
        """
        if not self.notifications_file.exists():
            return []

        try:
            with open(self.notifications_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    valid_items = []
                    for item in data:
                        # Vấn đề 1: Loại bỏ các bản ghi không phải thông báo
                        if not is_valid_announcement_record(item):
                            logger.info(f"[LOẠI BỎ] Đã lọc bản ghi điều hướng: '{item.get('title')}' ({item.get('detail_url')})")
                            continue

                        # Đảm bảo cấu trúc đủ 5 trường
                        if "content" not in item:
                            item["content"] = ""
                        if "attachments" not in item or not isinstance(item["attachments"], list):
                            item["attachments"] = []

                        # Chuẩn hóa lại các attachment hiện có
                        norm_attachments = []
                        seen_att = set()
                        for att in item["attachments"]:
                            clean_att = normalize_attachment_url(att, base_url=self.base_url)
                            if clean_att and clean_att not in seen_att:
                                seen_att.add(clean_att)
                                norm_attachments.append(clean_att)
                        item["attachments"] = norm_attachments

                        # Vấn đề 2: Dọn dẹp nội dung bị ghép sai trước đây nếu có
                        # Nếu tiêu đề về "nộp học phí và bảo hiểm" mà nội dung lại nói về "Giáo dục Quốc phòng"
                        if "bảo hiểm" in item.get("title", "").lower() and "giáo dục quốc phòng" in item.get("content", "").lower():
                            logger.warning(f"[DỌN DẸP] Phát hiện nội dung ghép sai trong '{item.get('title')[:40]}...'. Đang reset lại content và attachments.")
                            item["content"] = ""
                            item["attachments"] = []

                        valid_items.append(item)

                    return valid_items
        except Exception as e:
            logger.error(f"Lỗi khi đọc file {self.notifications_file}: {e}")

        return []

    def match_detail_to_notification(
        self,
        detail_info: Dict[str, Any],
        file_path: Path,
        notifications: List[Dict[str, Any]],
    ) -> int:
        """
        Đối sánh CHÍNH XÁC (strict matching) giữa file HTML chi tiết và notifications.json:
        1. Ưu tiên 1: Khớp chính xác 100% slug URL (file_stem == notif_slug).
        2. Ưu tiên 2: Khớp chính xác 100% detail_url từ metadata HTML (canonical/og:url).
        3. Ưu tiên 3: Khớp chính xác 100% tiêu đề chuẩn hóa (loại bỏ ngày tháng phụ lục).
        
        TUYỆT ĐỐI KHÔNG dùng substring / tìm kiếm tương đồng mờ để tránh ghép sai nội dung.
        Nếu không xác định chắc chắn được thông báo tương ứng thì trả về -1 (KHÔNG cập nhật).
        """
        file_stem = file_path.stem.strip().lower()
        detail_url = (detail_info.get("detail_url") or "").strip().lower()
        detail_title_norm = normalize_title_for_comparison(detail_info.get("title", ""))

        for idx, notif in enumerate(notifications):
            notif_url = notif.get("detail_url", "").strip().lower()
            notif_slug = notif_url.rsplit("/", 1)[-1].replace(".html", "").replace(".htm", "").strip().lower()
            notif_title_norm = normalize_title_for_comparison(notif.get("title", ""))

            # 1. Khớp chính xác 100% theo slug URL
            if file_stem and notif_slug and file_stem == notif_slug:
                return idx

            # 2. Khớp chính xác 100% theo detail_url
            if detail_url and notif_url and detail_url == notif_url:
                return idx

            # 3. Khớp chính xác 100% theo toàn bộ tiêu đề chuẩn hóa
            # (Độ dài >= 15 ký tự để đảm bảo tính định danh rõ ràng)
            if detail_title_norm and notif_title_norm and detail_title_norm == notif_title_norm and len(detail_title_norm) >= 15:
                return idx

        # Không xác định chắc chắn
        return -1

    def process_single_file(self, file_path: Path) -> Dict[str, Any]:
        """Đọc và bóc tách thông tin từ một file HTML trang chi tiết."""
        html_content = read_file_safely(file_path)
        if not html_content:
            return {}

        parsed = parse_announcement_detail(html_content, base_url=self.base_url)

        # Nếu chưa tìm thấy title, lấy tên file làm fallback
        if not parsed.get("title"):
            parsed["title"] = file_path.stem

        # Chuẩn hóa và khử trùng lặp attachments
        clean_attachments = []
        seen_att = set()
        for att in parsed.get("attachments", []):
            norm_att = normalize_attachment_url(att, base_url=self.base_url)
            if norm_att and norm_att not in seen_att:
                seen_att.add(norm_att)
                clean_attachments.append(norm_att)
        parsed["attachments"] = clean_attachments

        return parsed

    def process_all_details(self, save: bool = True) -> List[Dict[str, Any]]:
        """
        Quét các file HTML trong details/, đối sánh chính xác và cập nhật notifications.json.
        """
        notifications = self.load_notifications()
        self.details_dir.mkdir(parents=True, exist_ok=True)

        detail_files = sorted(
            list(self.details_dir.glob("*.html")) + list(self.details_dir.glob("*.htm"))
        )

        if not detail_files:
            logger.info(f"Chưa có file HTML chi tiết nào trong: {self.details_dir}")
            if save:
                with open(self.notifications_file, "w", encoding="utf-8") as f:
                    json.dump(notifications, f, ensure_ascii=False, indent=2)
            return notifications

        logger.info(f"Tìm thấy {len(detail_files)} file HTML chi tiết trong {self.details_dir}")

        updated_count = 0
        skipped_count = 0

        for df in detail_files:
            detail_info = self.process_single_file(df)
            if not detail_info:
                continue

            match_idx = self.match_detail_to_notification(detail_info, df, notifications)

            if match_idx >= 0:
                # Đối sánh chính xác thành công -> cập nhật
                target = notifications[match_idx]
                target["content"] = detail_info.get("content", "")

                # Bổ sung các file đính kèm đã được chuẩn hóa duy nhất
                seen_target_att = set(target.get("attachments", []))
                for att in detail_info.get("attachments", []):
                    if att not in seen_target_att:
                        seen_target_att.add(att)
                        target["attachments"].append(att)

                # Bổ sung ngày nếu trước đó chưa có
                if not target.get("date") and detail_info.get("date"):
                    target["date"] = detail_info["date"]

                # Cập nhật title sạch hơn nếu title cũ có ngày hoặc rác
                if detail_info.get("title") and len(detail_info["title"]) >= 15:
                    target["title"] = detail_info["title"]

                updated_count += 1
                logger.info(f"[CẬP NHẬT CHÍNH XÁC] Khớp thông báo #{match_idx + 1}: '{target['title'][:45]}...' -> Nội dung: {len(target['content'])} ký tự, {len(target['attachments'])} file.")

            else:
                # Vấn đề 2: Không đoán mò -> Bỏ qua không cập nhật vào thông báo khác
                skipped_count += 1
                logger.warning(
                    f"[BỎ QUA - KHÔNG KHỚP CHÍNH XÁC] File '{df.name}' không khớp chính xác với bất kỳ "
                    f"thông báo nào trong danh sách. Không tự ý ghép nội dung."
                )

        if save:
            self.notifications_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.notifications_file, "w", encoding="utf-8") as f:
                json.dump(notifications, f, ensure_ascii=False, indent=2)
            logger.info(f"Đã cập nhật thành công {updated_count} thông báo (bỏ qua {skipped_count} file không khớp). Lưu tại: {self.notifications_file}")

        return notifications


def main():
    parser = argparse.ArgumentParser(
        description="DAU Second Brain - Xử lý các trang chi tiết HTML và cập nhật notifications.json"
    )
    parser.add_argument(
        "--details-dir",
        type=str,
        default=str(DETAILS_DIR),
        help=f"Thư mục chứa các file HTML trang chi tiết (mặc định: {DETAILS_DIR})"
    )
    parser.add_argument(
        "--notifications",
        type=str,
        default=str(OUTPUT_FILE),
        help=f"Đường dẫn file notifications.json (mặc định: {OUTPUT_FILE})"
    )
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Xử lý 1 file HTML chi tiết cụ thể"
    )

    args = parser.parse_args()
    details_path = Path(args.details_dir)
    notif_path = Path(args.notifications)

    print("=" * 65)
    print("   DAU SECOND BRAIN - XỬ LÝ TRANG CHI TIẾT THÔNG BÁO (HTML)")
    print("=" * 65)
    print(f"[*] Thư mục chi tiết: {details_path}")
    print(f"[*] File thông báo   : {notif_path}")

    processor = DetailProcessor(details_dir=details_path, notifications_file=notif_path)

    if args.file:
        single_file = Path(args.file)
        if not single_file.exists():
            print(f"[-] Lỗi: Không tìm thấy file: {single_file}")
            sys.exit(1)

        print(f"[*] Đang xử lý file đơn lẻ: {single_file.name}")
        notifications = processor.load_notifications()
        detail_info = processor.process_single_file(single_file)
        match_idx = processor.match_detail_to_notification(detail_info, single_file, notifications)
        if match_idx >= 0:
            target = notifications[match_idx]
            target["content"] = detail_info.get("content", "")
            seen_att = set(target.get("attachments", []))
            for att in detail_info.get("attachments", []):
                if att not in seen_att:
                    seen_att.add(att)
                    target["attachments"].append(att)
            print(f"[+] Đã cập nhật chính xác vào thông báo #{match_idx + 1}: {target['title']}")
            with open(notif_path, "w", encoding="utf-8") as f:
                json.dump(notifications, f, ensure_ascii=False, indent=2)
            print(f"[+] Đã lưu vào: {notif_path}")
        else:
            print(f"[-] Cảnh báo: File '{single_file.name}' không khớp chính xác với bất kỳ thông báo nào. Không cập nhật để tránh sai lệch dữ liệu.")
        return

    results = processor.process_all_details(save=True)

    total_items = len(results)
    with_content = sum(1 for it in results if it.get("content"))
    total_attachments = sum(len(it.get("attachments", [])) for it in results)

    print("\n" + "-" * 65)
    print(f"[KẾT QUẢ] Tổng số thông báo hợp lệ          : {total_items}")
    print(f"[KẾT QUẢ] Số thông báo đã có nội dung chi tiết : {with_content}")
    print(f"[KẾT QUẢ] Tổng số file đính kèm (PDF/DOC/DOCX) : {total_attachments}")
    print(f"[KẾT QUẢ] File dữ liệu kết quả                : {notif_path}")
    print("-" * 65)


if __name__ == "__main__":
    main()
