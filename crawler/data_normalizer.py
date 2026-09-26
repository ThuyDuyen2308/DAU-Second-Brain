"""
Module Data Normalizer cho DAU Second Brain.

Chức năng:
- Định nghĩa schema chuẩn cho một văn bản nhà trường.
- Đọc dữ liệu từ notifications.json và các file JSON OCR trong crawler/data/extracted/.
- Ghép nối dữ liệu chính xác (strict matching), không fuzzy matching nguy hiểm.
- Chuẩn hóa thành dataset thống nhất tại crawler/data/normalized/documents.json.
- Giữ nguyên nguồn gốc dữ liệu (provenance) và khả năng truy ngược về PDF/HTML ban đầu.
- Tuyệt đối không dùng AI để suy luận/thay đổi nội dung pháp lý.
- Nếu không có thông tin rõ ràng thì để null hoặc "unknown".
"""

import argparse
import hashlib
import json
import logging
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from .config import (
    DATA_DIR,
    DETAILS_CACHE_DIR,
    DOCUMENTS_DIR,
    EXTRACTED_DIR,
    NORMALIZED_DIR,
    NORMALIZED_DOCUMENTS_FILE,
    OUTPUT_FILE,
)
from .validity_extractor import analyze_document_validity

logger = logging.getLogger("DataNormalizer")

ALLOWED_EFFECTIVE_STATUSES = {
    "active",
    "deadline_passed",
    "expired",
    "replaced",
    "unverified",
    "unknown",
}


def generate_document_id(source_url: str, source_file: str, index: int) -> str:
    """
    Tạo ID duy nhất, ổn định và có thể tái tạo cho document.
    Sử dụng hash ngắn từ source_url hoặc source_file kết hợp index.
    """
    key = (source_url or source_file or f"doc_{index}").strip()
    h = hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]
    return f"dau_doc_{h}"


def extract_document_number_strict(text: str) -> Optional[str]:
    """
    Tìm số hiệu văn bản một cách cẩn trọng và chặt chẽ.
    Chỉ trích xuất khi có cấu trúc rõ ràng như:
    - Số: 43/TB-ĐHKTĐN hoặc Số: 43 /TB-DHKTDN
    - 31/TB-ĐHKTĐN
    Nếu không chắc chắn thì trả về None.
    """
    if not text:
        return None

    # Tìm trong 500 ký tự đầu tiên của văn bản
    header_text = text[:800]

    # Mẫu 1: Số: 43/TB-ĐHKTĐN hoặc Số: 31/TB-...
    m = re.search(
        r"(?:Số|SỐ|86|Số:)\s*[:\.]?\s*([0-9]{1,4}\s*[\/\-]\s*[A-Za-zĐđ0-9\-_]+)",
        header_text,
        re.IGNORECASE,
    )
    if m:
        num = m.group(1).strip()
        num = re.sub(r"\s+", "", num)  # Chuẩn hóa khoảng trắng bên trong số hiệu
        if len(num) >= 4 and ("/" in num or "-" in num):
            return num

    return None


def extract_issuing_unit_strict(text: str) -> Optional[str]:
    """
    Tìm đơn vị ban hành nếu văn bản thể hiện rõ ràng ở tiêu đề đầu trang.
    Không suy đoán bừa bãi.
    """
    if not text:
        return None

    header_text = text[:600].lower()
    if "trường đại học kiến trúc đà nẵng" in header_text or "đại học kiến trúc đà nẵng" in header_text:
        return "Trường Đại học Kiến trúc Đà Nẵng"

    return None


def normalize_category_conservative(title: str, text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Xác định category/subcategory một cách thận trọng, chỉ khi tiêu đề thể hiện rõ ràng.
    Nếu không chắc chắn 100% thì trả về (None, None).
    """
    t_lower = (title or "").lower()

    if "học phí" in t_lower or "bảo hiểm" in t_lower:
        return "Học phí", "Thu học phí & Bảo hiểm"
    elif "phúc khảo" in t_lower:
        return "Khảo thí", "Phúc khảo bài thi"
    elif "quy đổi" in t_lower or "chuẩn đầu ra" in t_lower:
        return "Chuẩn đầu ra", "Chứng chỉ ngoại ngữ - tin học"
    elif "khảo sát" in t_lower:
        return "Khảo sát", "Khảo sát sinh viên"

    return None, None


def normalize_date_format(date_str: Optional[str]) -> Optional[str]:
    """
    Chuẩn hóa ngày từ DD/MM/YYYY sang YYYY-MM-DD nếu hợp lệ.
    Nếu không hợp lệ thì giữ nguyên hoặc trả về None.
    """
    if not date_str or not date_str.strip():
        return None
    ds = date_str.strip()
    m = re.search(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b", ds)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return f"{year:04d}-{month:02d}-{day:02d}"
        except Exception:
            return ds
    return ds


def find_cached_detail_file(detail_url: str, details_dir: Path = DETAILS_CACHE_DIR) -> Optional[str]:
    """
    Tìm file HTML cache trong crawler/data/details/ khớp với detail_url.
    """
    if not detail_url or not details_dir.exists():
        return None

    from urllib.parse import urlparse
    parsed = urlparse(detail_url)
    slug = Path(parsed.path).stem.strip().lower()

    if slug:
        candidate = details_dir / f"{slug}.html"
        if candidate.exists():
            return str(candidate.resolve())

    # Quét trong thư mục
    for html_file in details_dir.glob("*.html"):
        if slug and slug in html_file.stem.lower():
            return str(html_file.resolve())

    return None


def match_notification_to_extracted(
    notif: Dict[str, Any],
    extracted_docs: List[Dict[str, Any]],
    notif_index: int,
) -> Optional[Dict[str, Any]]:
    """
    Đối sánh CHÍNH XÁC giữa 1 thông báo và danh sách các file extracted JSON.
    Quy tắc so khớp nghiêm ngặt (Strict Matching):
    1. Trùng notification_index nếu có và >= 0.
    2. Trùng source_url của attachment.
    3. Trùng tên file attachment (basename).
    4. Trùng tiêu đề thông báo chính xác 100%.
    Tuyệt đối không fuzzy match.
    """
    notif_title = (notif.get("title") or "").strip().lower()
    notif_attachments = notif.get("attachments", [])
    notif_downloaded = notif.get("attachments_downloaded", [])

    notif_att_basenames = {Path(u).name.lower() for u in notif_attachments if u}
    notif_down_basenames = {Path(u).name.lower() for u in notif_downloaded if u}
    all_notif_basenames = notif_att_basenames | notif_down_basenames

    # 1. So khớp qua notification_index
    for doc in extracted_docs:
        if doc.get("notification_index") == notif_index and notif_index >= 0:
            return doc

    # 2. So khớp qua source_url
    for doc in extracted_docs:
        doc_src_url = (doc.get("source_url") or "").strip().lower()
        if doc_src_url and any(doc_src_url == a.strip().lower() for a in notif_attachments):
            return doc

    # 3. So khớp qua tên file attachment
    for doc in extracted_docs:
        doc_src_file = Path(doc.get("source_file", "")).name.lower()
        if doc_src_file and doc_src_file in all_notif_basenames:
            return doc

    # 4. So khớp tiêu đề chính xác 100% (độ dài >= 15 ký tự)
    if len(notif_title) >= 15:
        for doc in extracted_docs:
            doc_title = (doc.get("notification_title") or "").strip().lower()
            if doc_title and doc_title == notif_title:
                return doc

    return None


def normalize_single_document(
    notif: Dict[str, Any],
    extracted_doc: Optional[Dict[str, Any]],
    index: int,
    details_cache_dir: Path = DETAILS_CACHE_DIR,
) -> Tuple[Dict[str, Any], List[str]]:
    """
    Chuẩn hóa dữ liệu của một thông báo + tài liệu OCR thành cấu trúc document chuẩn.
    Trả về: (document_dict, warnings_list)
    """
    warnings: List[str] = []

    title = (notif.get("title") or "").strip()
    detail_url = (notif.get("detail_url") or "").strip()
    issue_date_raw = notif.get("date")
    issue_date = normalize_date_format(issue_date_raw)
    attachments = notif.get("attachments", [])

    if not title:
        warnings.append("Thông báo không có tiêu đề (title rỗng).")

    source_url = ""
    source_file = ""
    file_format = "pdf"
    total_pages = 0
    pages: List[Dict[str, Any]] = []
    content = ""
    ocr_quality = {}
    extracted_json_path = ""

    if extracted_doc:
        source_url = extracted_doc.get("source_url") or (attachments[0] if attachments else "")
        source_file = extracted_doc.get("source_file", "")
        file_format = extracted_doc.get("file_format", "pdf")
        total_pages = extracted_doc.get("total_pages", 0)
        raw_pages = extracted_doc.get("pages", [])
        ocr_quality = extracted_doc.get("ocr_quality", {})
        extracted_json_path = extracted_doc.get("_file_path", "")

        for p in raw_pages:
            pages.append({
                "page_number": p.get("page_number", len(pages) + 1),
                "raw_text": p.get("raw_text", ""),
                "cleaned_text": p.get("cleaned_text", ""),
            })

        # Ghép content từ cleaned_text của các trang (không tóm tắt, không sửa)
        content = "\n\n".join(p["cleaned_text"] for p in pages if p.get("cleaned_text"))
    else:
        warnings.append("Không tìm thấy dữ liệu OCR extracted tương ứng với thông báo.")
        # Fallback lấy nội dung ngắn từ notification nếu có
        content = notif.get("content", "")
        if attachments:
            source_url = attachments[0]

    # Trích xuất metadata thận trọng
    doc_number = extract_document_number_strict(content)
    issuing_unit = extract_issuing_unit_strict(content)
    category, subcategory = normalize_category_conservative(title, content)

    # Tìm file cache HTML trang chi tiết
    detail_file = find_cached_detail_file(detail_url, details_cache_dir)

    # Document ID
    doc_id = generate_document_id(source_url, source_file, index)

    # Phân tích tình trạng hiệu lực và căn cứ văn bản qua ValidityExtractor
    validity_info = analyze_document_validity({
        "title": title,
        "content": content,
        "pages": pages,
        "issue_date": issue_date,
        "document_number": doc_number,
    })

    # Tạo đối tượng chuẩn theo đúng Schema
    doc = {
        "id": doc_id,
        "title": title,
        "document_number": doc_number,
        "issue_date": validity_info["issue_date"] or issue_date,
        "issuing_unit": issuing_unit,
        "category": category,
        "subcategory": subcategory,
        "deadline": validity_info["deadline"],
        "effective_status": validity_info["suggested_status"],
        "effective_from": validity_info["effective_from"],
        "effective_to": validity_info["effective_to"],
        "replaced_by": validity_info["replaced_by"],
        "suggested_status": validity_info["suggested_status"],
        "status_evidence": validity_info["status_evidence"],
        "status_rationale": validity_info["status_rationale"],
        "certainty": validity_info["certainty"],
        "is_verified": False,
        "verified_by": None,
        "verified_at": None,
        "status_history": [],
        "source_url": source_url,
        "detail_url": detail_url,
        "source_file": source_file,
        "file_format": file_format,
        "total_pages": total_pages,
        "content": content,
        "pages": pages,
        "attachments": attachments,
        "metadata": {
            "crawled_at": notif.get("crawled_at"),
            "crawl_status": notif.get("crawl_status"),
            "content_source": notif.get("content_source"),
            "raw_issue_date": issue_date_raw,
            "ocr_quality": ocr_quality,
        },
        "provenance": {
            "notification_index": index,
            "notification_title": title,
            "detail_file": detail_file,
            "document_file": source_file,
            "extracted_file": extracted_json_path,
        },
    }

    return doc, warnings


class DataNormalizer:
    """
    Điều phối việc chuẩn hóa toàn bộ dữ liệu crawler:
    Đọc notifications.json + extracted/*.json -> xuất normalized/documents.json
    """

    def __init__(
        self,
        notifications_file: Path = OUTPUT_FILE,
        extracted_dir: Path = EXTRACTED_DIR,
        normalized_dir: Path = NORMALIZED_DIR,
        details_cache_dir: Path = DETAILS_CACHE_DIR,
    ):
        self.notifications_file = Path(notifications_file)
        self.extracted_dir = Path(extracted_dir)
        self.normalized_dir = Path(normalized_dir)
        self.details_cache_dir = Path(details_cache_dir)
        self.output_documents_file = self.normalized_dir / "documents.json"
        self.output_report_file = self.normalized_dir / "normalization_report.json"

    def _load_extracted_docs(self) -> List[Dict[str, Any]]:
        """Tải toàn bộ file extracted JSON vào bộ nhớ."""
        docs = []
        if not self.extracted_dir.exists():
            return docs

        for jf in sorted(self.extracted_dir.rglob("*.json")):
            try:
                with open(jf, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    data["_file_path"] = str(jf.resolve())
                    docs.append(data)
            except Exception as e:
                logger.error(f"Không thể đọc file extracted {jf}: {e}")

        return docs

    def run(self) -> Dict[str, Any]:
        report = {
            "generated_at": datetime.now().isoformat(),
            "total_notifications": 0,
            "total_documents_normalized": 0,
            "documents_matched_ocr": 0,
            "documents_missing_ocr": 0,
            "warnings_count": 0,
            "errors_count": 0,
            "warnings": [],
            "errors": [],
            "documents_summary": [],
        }

        if not self.notifications_file.exists():
            err_msg = f"Không tìm thấy file notifications: {self.notifications_file}"
            logger.error(err_msg)
            report["errors"].append(err_msg)
            report["errors_count"] += 1
            self._save_report(report)
            return report

        try:
            with open(self.notifications_file, "r", encoding="utf-8") as f:
                notifications = json.load(f)
        except Exception as e:
            err_msg = f"Lỗi đọc JSON {self.notifications_file}: {e}"
            logger.error(err_msg)
            report["errors"].append(err_msg)
            report["errors_count"] += 1
            self._save_report(report)
            return report

        if not isinstance(notifications, list):
            err_msg = f"Dữ liệu trong {self.notifications_file} không phải dạng list."
            logger.error(err_msg)
            report["errors"].append(err_msg)
            report["errors_count"] += 1
            self._save_report(report)
            return report

        report["total_notifications"] = len(notifications)
        extracted_docs = self._load_extracted_docs()
        logger.info(f"Đã tải {len(notifications)} thông báo và {len(extracted_docs)} tệp OCR extracted.")

        normalized_documents: List[Dict[str, Any]] = []

        for idx, notif in enumerate(notifications):
            extracted_doc = match_notification_to_extracted(notif, extracted_docs, idx)

            if extracted_doc:
                report["documents_matched_ocr"] += 1
            else:
                report["documents_missing_ocr"] += 1

            doc, doc_warnings = normalize_single_document(
                notif=notif,
                extracted_doc=extracted_doc,
                index=idx,
                details_cache_dir=self.details_cache_dir,
            )

            normalized_documents.append(doc)

            for w in doc_warnings:
                report["warnings"].append(f"[Doc #{idx} - {doc['id']}] {w}")
                report["warnings_count"] += 1

            report["documents_summary"].append({
                "id": doc["id"],
                "title": doc["title"],
                "document_number": doc["document_number"],
                "category": doc["category"],
                "has_ocr": extracted_doc is not None,
                "total_pages": doc["total_pages"],
                "content_chars": len(doc["content"]),
            })

        report["total_documents_normalized"] = len(normalized_documents)

        # Lưu output normalized documents
        self.normalized_dir.mkdir(parents=True, exist_ok=True)
        try:
            with open(self.output_documents_file, "w", encoding="utf-8") as f:
                json.dump(normalized_documents, f, ensure_ascii=False, indent=2)
            logger.info(f"Đã lưu dataset chuẩn hóa thành công: {self.output_documents_file}")
        except Exception as e:
            err_msg = f"Lỗi khi lưu {self.output_documents_file}: {e}"
            logger.error(err_msg)
            report["errors"].append(err_msg)
            report["errors_count"] += 1

        self._save_report(report)
        self._print_summary(report)
        return report

    def _save_report(self, report: Dict[str, Any]):
        try:
            self.normalized_dir.mkdir(parents=True, exist_ok=True)
            with open(self.output_report_file, "w", encoding="utf-8") as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Không thể lưu report: {e}")

    def _print_summary(self, report: Dict[str, Any]):
        print("\n" + "=" * 62)
        print(" DAU SECOND BRAIN - DATA NORMALIZER")
        print("=" * 62)
        print(f"Tổng thông báo ban đầu     : {report['total_notifications']}")
        print(f"Văn bản chuẩn hóa thành công: {report['total_documents_normalized']}")
        print(f"Khớp thành công dữ liệu OCR: {report['documents_matched_ocr']}")
        print(f"Thiếu OCR                   : {report['documents_missing_ocr']}")
        print(f"Cảnh báo (Warnings)         : {report['warnings_count']}")
        print(f"Lỗi (Errors)                : {report['errors_count']}")
        print(f"File kết quả                : {self.output_documents_file}")
        print("=" * 62 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="DAU Second Brain - Chuẩn hóa dữ liệu sang Data Schema thống nhất."
    )
    parser.add_argument(
        "--notifications",
        type=str,
        default=str(OUTPUT_FILE),
        help=f"File notifications.json (mặc định: {OUTPUT_FILE})",
    )
    parser.add_argument(
        "--extracted-dir",
        type=str,
        default=str(EXTRACTED_DIR),
        help=f"Thư mục OCR extracted (mặc định: {EXTRACTED_DIR})",
    )
    parser.add_argument(
        "--normalized-dir",
        type=str,
        default=str(NORMALIZED_DIR),
        help=f"Thư mục lưu dataset chuẩn hóa (mặc định: {NORMALIZED_DIR})",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    normalizer = DataNormalizer(
        notifications_file=Path(args.notifications),
        extracted_dir=Path(args.extracted_dir),
        normalized_dir=Path(args.normalized_dir),
    )
    normalizer.run()


if __name__ == "__main__":
    main()
