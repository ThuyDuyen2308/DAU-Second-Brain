"""
Module trích xuất nội dung văn bản từ tài liệu đính kèm (PDF, DOCX, DOC).

Nguyên tắc:
- Chỉ đọc những gì THỰC TẾ có trong tài liệu, không suy diễn, không bổ sung.
- Giữ nguyên số hiệu văn bản, ngày tháng, số tiền, thời hạn.
- Không gửi dữ liệu lên LLM hoặc AI bất kỳ.
- Không tự xác định hiệu lực văn bản.
- PDF không có text layer → đánh dấu needs_ocr, không tự OCR.

Output: crawler/data/extracted/<stem>.json
Mỗi file JSON chứa danh sách các trang, mỗi trang giữ:
    source_file, source_url, notification_title, notification_index,
    page_number, raw_text, cleaned_text, extraction_status
"""

import argparse
import json
import logging
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Đảm bảo UTF-8 trên terminal Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from .config import (
    DATA_DIR,
    DOCUMENTS_DIR,
    EXTRACTED_DIR,
    OUTPUT_FILE,
)

logger = logging.getLogger("DocumentExtractor")

# --------------------------------------------------------------------------- #
#  Hằng số                                                                     #
# --------------------------------------------------------------------------- #

# Ngưỡng tối thiểu ký tự có nghĩa để trang được coi là có text layer
_MIN_TEXT_CHARS = 20

# Các định dạng hỗ trợ
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc"}


# --------------------------------------------------------------------------- #
#  Làm sạch văn bản                                                            #
# --------------------------------------------------------------------------- #

def clean_text(raw: str) -> str:
    """
    Làm sạch văn bản trích xuất từ tài liệu:
    - Chuẩn hóa xuống dòng (\r\n, \r → \n)
    - Loại bỏ khoảng trắng thừa trên mỗi dòng
    - Gộp nhiều dòng trắng liên tiếp thành tối đa 1 dòng trắng
    - Giữ nguyên toàn bộ nội dung pháp lý: số hiệu, ngày tháng, số tiền, thời hạn

    KHÔNG sửa câu chữ, KHÔNG diễn giải, KHÔNG thêm bất kỳ nội dung nào.
    """
    if not raw:
        return ""

    # Chuẩn hóa xuống dòng
    text = raw.replace("\r\n", "\n").replace("\r", "\n")

    # Loại bỏ ký tự điều khiển không in được (giữ lại \n và \t)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Loại bỏ khoảng trắng thừa ở đầu/cuối mỗi dòng (tab → space)
    lines = [line.expandtabs(4).rstrip() for line in text.split("\n")]

    # Gộp nhiều dòng trắng liên tiếp thành tối đa 1 dòng trắng
    cleaned_lines: List[str] = []
    blank_count = 0
    for line in lines:
        if line == "":
            blank_count += 1
            if blank_count <= 1:
                cleaned_lines.append("")
        else:
            blank_count = 0
            cleaned_lines.append(line)

    result = "\n".join(cleaned_lines).strip()
    return result


# --------------------------------------------------------------------------- #
#  Trích xuất PDF bằng PyMuPDF                                                 #
# --------------------------------------------------------------------------- #

def extract_pdf_pages(pdf_path: Path) -> Tuple[List[Dict[str, Any]], str]:
    """
    Trích xuất text từng trang của file PDF bằng PyMuPDF (fitz).

    Trả về:
        (pages, status)
        - pages: list dict per page với raw_text, cleaned_text, page_number
        - status: "ok" | "needs_ocr" | "empty" | "error:<msg>"

    Nếu tổng text < _MIN_TEXT_CHARS → PDF scan/ảnh → status = "needs_ocr"
    """
    try:
        import pymupdf as fitz  # PyMuPDF >= 1.24 (tên mới)
    except ImportError:
        try:
            import fitz  # PyMuPDF < 1.24 (tên cũ)
        except ImportError:
            return [], "error:PyMuPDF chưa được cài đặt. Chạy: pip install pymupdf"

    pages: List[Dict[str, Any]] = []
    total_chars = 0

    try:
        doc = fitz.open(str(pdf_path))
    except Exception as e:
        return [], f"error:Không thể mở file PDF: {e}"

    try:
        for page_num in range(len(doc)):
            try:
                page = doc[page_num]
                raw = page.get_text("text")  # text layer, không OCR
            except Exception as e:
                logger.warning(f"Lỗi khi đọc trang {page_num + 1} của {pdf_path.name}: {e}")
                raw = ""

            total_chars += len(raw.strip())
            cleaned = clean_text(raw)

            pages.append({
                "page_number": page_num + 1,
                "raw_text": raw,
                "cleaned_text": cleaned,
            })
    finally:
        doc.close()

    if not pages:
        return [], "empty"

    # Nếu toàn bộ PDF không có đủ text → likely scanned image
    if total_chars < _MIN_TEXT_CHARS:
        for p in pages:
            p["extraction_status"] = "needs_ocr"
        return pages, "needs_ocr"

    for p in pages:
        p["extraction_status"] = "ok"

    return pages, "ok"


# --------------------------------------------------------------------------- #
#  Trích xuất DOCX bằng python-docx                                            #
# --------------------------------------------------------------------------- #

def extract_docx_pages(docx_path: Path) -> Tuple[List[Dict[str, Any]], str]:
    """
    Trích xuất text từ file DOCX bằng python-docx.
    DOCX không có khái niệm trang vật lý → toàn bộ nội dung là "page_number": 1.

    Trả về:
        (pages, status)
        - pages: list với 1 phần tử (toàn bộ văn bản)
        - status: "ok" | "empty" | "error:<msg>"
    """
    try:
        import docx as python_docx
    except ImportError:
        return [], "error:python-docx chưa được cài đặt. Chạy: pip install python-docx"

    try:
        doc = python_docx.Document(str(docx_path))
    except Exception as e:
        return [], f"error:Không thể mở file DOCX: {e}"

    paragraphs: List[str] = []
    for para in doc.paragraphs:
        text = para.text
        if text.strip():
            paragraphs.append(text)

    # Đọc thêm text trong các bảng (table cells)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                cell_text = cell.text.strip()
                if cell_text and cell_text not in paragraphs:
                    paragraphs.append(cell_text)

    raw = "\n".join(paragraphs)
    cleaned = clean_text(raw)

    if not raw.strip():
        return [{
            "page_number": 1,
            "raw_text": "",
            "cleaned_text": "",
            "extraction_status": "empty",
        }], "empty"

    return [{
        "page_number": 1,
        "raw_text": raw,
        "cleaned_text": cleaned,
        "extraction_status": "ok",
    }], "ok"


# --------------------------------------------------------------------------- #
#  Trích xuất DOC (thô, không dùng LibreOffice)                               #
# --------------------------------------------------------------------------- #

def extract_doc_pages(doc_path: Path) -> Tuple[List[Dict[str, Any]], str]:
    """
    Cố gắng đọc file DOC (binary OLE2 format cũ) bằng cách:
    1. Thử đọc bằng python-docx (sẽ fail nếu không phải DOCX)
    2. Nếu fail → trả về error với hướng dẫn chuyển đổi

    DOC cũ cần LibreOffice hoặc antiword để extract đúng.
    Ở bước này chỉ xử lý an toàn, không crash.
    """
    # Thử python-docx (đôi khi hoạt động với .doc mới hơn)
    try:
        import docx as python_docx
        doc = python_docx.Document(str(doc_path))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        raw = "\n".join(paragraphs)
        cleaned = clean_text(raw)
        if raw.strip():
            return [{
                "page_number": 1,
                "raw_text": raw,
                "cleaned_text": cleaned,
                "extraction_status": "ok",
            }], "ok"
    except Exception:
        pass

    # Không thể đọc .doc binary → báo lỗi rõ ràng
    return [], (
        "error:File .doc (định dạng Word cũ OLE2) không thể đọc trực tiếp. "
        "Vui lòng chuyển sang .docx bằng LibreOffice hoặc Microsoft Word."
    )


# --------------------------------------------------------------------------- #
#  Hàm extract tổng hợp                                                        #
# --------------------------------------------------------------------------- #

def extract_document(
    file_path: Path,
    source_url: str = "",
    notification_title: str = "",
    notification_index: int = -1,
) -> Dict[str, Any]:
    """
    Trích xuất toàn bộ nội dung một tài liệu (PDF/DOCX/DOC) và trả về dict.

    Fields:
        source_file         - Đường dẫn tuyệt đối
        source_url          - URL attachment gốc
        notification_title  - Tiêu đề thông báo liên quan
        notification_index  - Vị trí trong notifications.json (0-based), -1 nếu không rõ
        file_format         - "pdf" | "docx" | "doc" | "unknown"
        extraction_status   - "ok" | "needs_ocr" | "empty" | "error:..."
        extracted_at        - ISO 8601 timestamp
        total_pages         - Số trang
        pages               - list[{page_number, raw_text, cleaned_text, extraction_status}]
    """
    file_path = Path(file_path)
    ext = file_path.suffix.lower()

    result: Dict[str, Any] = {
        "source_file": str(file_path.resolve()),
        "source_url": source_url,
        "notification_title": notification_title,
        "notification_index": notification_index,
        "file_format": ext.lstrip(".") if ext else "unknown",
        "extraction_status": "ok",
        "extracted_at": datetime.now().isoformat(),
        "total_pages": 0,
        "pages": [],
    }

    if not file_path.exists():
        result["extraction_status"] = "error:File không tồn tại trên đĩa"
        return result

    if ext not in SUPPORTED_EXTENSIONS:
        result["extraction_status"] = (
            f"error:Định dạng '{ext}' chưa được hỗ trợ. "
            f"Hỗ trợ: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )
        return result

    # Chọn extractor theo định dạng
    if ext == ".pdf":
        pages, status = extract_pdf_pages(file_path)
    elif ext == ".docx":
        pages, status = extract_docx_pages(file_path)
    elif ext == ".doc":
        pages, status = extract_doc_pages(file_path)
    else:
        pages, status = [], f"error:Không xử lý được định dạng {ext}"

    result["pages"] = pages
    result["total_pages"] = len(pages)
    result["extraction_status"] = status

    return result


# --------------------------------------------------------------------------- #
#  Xây dựng index từ notifications.json                                        #
# --------------------------------------------------------------------------- #

def _build_attachment_index(notifications_file: Path) -> Dict[str, Dict[str, Any]]:
    """
    Đọc notifications.json → dict map: tên file basename → metadata.
    Dùng để tra cứu source_url và notification_title cho từng file tài liệu.
    """
    index: Dict[str, Dict[str, Any]] = {}
    if not notifications_file.exists():
        return index

    try:
        with open(notifications_file, "r", encoding="utf-8") as f:
            notifications = json.load(f)
    except Exception as e:
        logger.warning(f"Không thể đọc {notifications_file}: {e}")
        return index

    if not isinstance(notifications, list):
        return index

    for i, notif in enumerate(notifications):
        title = notif.get("title", "")
        attachments = notif.get("attachments", [])
        for att_url in attachments:
            basename = Path(att_url).name
            if basename and basename not in index:
                index[basename] = {
                    "source_url": att_url,
                    "title": title,
                    "index": i,
                }
        # Cũng index theo tên file local (attachments_downloaded)
        for local_rel in notif.get("attachments_downloaded", []):
            basename = Path(local_rel).name
            if basename and basename not in index:
                first_url = attachments[0] if attachments else ""
                index[basename] = {
                    "source_url": first_url,
                    "title": title,
                    "index": i,
                }

    return index


# --------------------------------------------------------------------------- #
#  Pipeline chính                                                               #
# --------------------------------------------------------------------------- #

class DocumentExtractor:
    """
    Pipeline trích xuất text từ tất cả tài liệu trong crawler/data/documents/.
    Lưu kết quả JSON vào crawler/data/extracted/.
    """

    def __init__(
        self,
        documents_dir: Path = DOCUMENTS_DIR,
        extracted_dir: Path = EXTRACTED_DIR,
        notifications_file: Path = OUTPUT_FILE,
    ):
        self.documents_dir = Path(documents_dir)
        self.extracted_dir = Path(extracted_dir)
        self.notifications_file = Path(notifications_file)

    def _find_documents(self) -> List[Path]:
        """Tìm tất cả file tài liệu hỗ trợ trong documents_dir (đệ quy)."""
        found: List[Path] = []
        if not self.documents_dir.exists():
            logger.warning(f"Thư mục tài liệu không tồn tại: {self.documents_dir}")
            return found

        for ext in sorted(SUPPORTED_EXTENSIONS):
            found.extend(sorted(self.documents_dir.rglob(f"*{ext}")))

        return found

    def _output_path(self, source_file: Path) -> Path:
        """Xác định đường dẫn file JSON output cho một tài liệu."""
        try:
            rel = source_file.relative_to(self.documents_dir)
        except ValueError:
            rel = Path(source_file.name)
        output_name = rel.with_suffix(".json")
        return self.extracted_dir / output_name

    def _save_result(self, result: Dict[str, Any], output_path: Path) -> bool:
        """Lưu kết quả extraction ra file JSON."""
        try:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            logger.error(f"Lỗi khi lưu {output_path}: {e}")
            return False

    def run(self) -> Dict[str, Any]:
        """Chạy extraction cho toàn bộ tài liệu. Trả về dict thống kê."""
        stats = {
            "total_documents": 0,
            "extracted_ok": 0,
            "needs_ocr": 0,
            "errors": 0,
            "empty": 0,
            "total_pages": 0,
            "output_dir": str(self.extracted_dir),
        }

        att_index = _build_attachment_index(self.notifications_file)
        logger.info(
            f"Đã tạo index {len(att_index)} attachment từ {self.notifications_file.name}"
        )

        documents = self._find_documents()
        stats["total_documents"] = len(documents)

        if not documents:
            logger.warning(f"Không tìm thấy tài liệu nào trong: {self.documents_dir}")
            self._print_summary(stats)
            return stats

        logger.info(f"Tìm thấy {len(documents)} tài liệu cần xử lý.")
        self.extracted_dir.mkdir(parents=True, exist_ok=True)

        for doc_path in documents:
            output_path = self._output_path(doc_path)
            meta = att_index.get(doc_path.name, {})

            logger.info(f"  Đang xử lý: {doc_path.name}")

            result = extract_document(
                file_path=doc_path,
                source_url=meta.get("source_url", ""),
                notification_title=meta.get("title", ""),
                notification_index=meta.get("index", -1),
            )

            status = result["extraction_status"]
            if status == "ok":
                stats["extracted_ok"] += 1
            elif status == "needs_ocr":
                stats["needs_ocr"] += 1
                logger.warning(f"    [NEEDS OCR] {doc_path.name}")
            elif status == "empty":
                stats["empty"] += 1
                logger.warning(f"    [EMPTY] {doc_path.name}")
            elif status.startswith("error:"):
                stats["errors"] += 1
                logger.error(f"    [ERROR] {doc_path.name}: {status[6:]}")

            stats["total_pages"] += result["total_pages"]

            saved = self._save_result(result, output_path)
            if saved:
                try:
                    rel_out = output_path.relative_to(DATA_DIR)
                except ValueError:
                    rel_out = output_path
                logger.info(
                    f"    → {rel_out} ({result['total_pages']} trang, {status})"
                )

        self._print_summary(stats)
        return stats

    def _print_summary(self, stats: Dict[str, Any]):
        """In bảng tổng kết."""
        print("\n" + "=" * 60)
        print(" DAU SECOND BRAIN - DOCUMENT EXTRACTOR")
        print("=" * 60)
        print(f"Tổng tài liệu           : {stats['total_documents']}")
        print(f"Trích xuất thành công   : {stats['extracted_ok']}")
        print(f"Cần OCR (không có text) : {stats['needs_ocr']}")
        print(f"Tài liệu trống          : {stats['empty']}")
        print(f"Lỗi                     : {stats['errors']}")
        print(f"Tổng số trang           : {stats['total_pages']}")
        print(f"Output                  : {stats['output_dir']}")
        print("=" * 60 + "\n")


# --------------------------------------------------------------------------- #
#  CLI                                                                          #
# --------------------------------------------------------------------------- #

def main():
    parser = argparse.ArgumentParser(
        description=(
            "DAU Second Brain - Document Extractor: "
            "Trích xuất text từ PDF/DOCX/DOC sang JSON trung gian."
        )
    )
    parser.add_argument(
        "--documents-dir",
        type=str,
        default=str(DOCUMENTS_DIR),
        help=f"Thư mục tài liệu đính kèm (mặc định: {DOCUMENTS_DIR})",
    )
    parser.add_argument(
        "--extracted-dir",
        type=str,
        default=str(EXTRACTED_DIR),
        help=f"Thư mục lưu JSON kết quả (mặc định: {EXTRACTED_DIR})",
    )
    parser.add_argument(
        "--notifications",
        type=str,
        default=str(OUTPUT_FILE),
        help=f"File notifications.json (mặc định: {OUTPUT_FILE})",
    )
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Chỉ xử lý một file cụ thể",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    if args.file:
        result = extract_document(Path(args.file))
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    extractor = DocumentExtractor(
        documents_dir=Path(args.documents_dir),
        extracted_dir=Path(args.extracted_dir),
        notifications_file=Path(args.notifications),
    )
    extractor.run()


if __name__ == "__main__":
    main()

