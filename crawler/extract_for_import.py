"""
crawler/extract_for_import.py

Module độc lập phục vụ bóc tách tài liệu upload từ Admin.
Hỗ trợ: PDF (text layer & scan OCR), DOCX, HTML.
Nhận input qua stdin hoặc file argument JSON:
  python extract_for_import.py --input-json '{"file_path": "...", "file_format": "pdf"}'

Output qua stdout JSON:
  {
    "success": true,
    "file_format": "pdf",
    "total_pages": 1,
    "needs_ocr": false,
    "ocr_performed": false,
    "pages": [...],
    "metadata_hints": {...},
    "warnings": [],
    "error": null
  }
"""

import sys
import os
import json
import re
import argparse
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Thiết lập đường dẫn Tesseract nếu có
TESSERACT_EXE = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
TESSDATA_DIR = r"C:\Program Files\Tesseract-OCR\tesseract.exe\tessdata"
if os.path.exists(TESSERACT_EXE):
    try:
        import pytesseract
        pytesseract.pytesseract.tesseract_cmd = TESSERACT_EXE
        if os.path.exists(TESSDATA_DIR):
            os.environ["TESSDATA_PREFIX"] = TESSDATA_DIR
    except ImportError:
        pass


def clean_text(raw: str) -> str:
    """Làm sạch ký tự điều khiển và dòng thừa, giữ nguyên pháp lý và văn phong."""
    if not raw:
        return ""
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    lines = [line.expandtabs(4).rstrip() for line in text.split("\n")]
    cleaned_lines = []
    blank_count = 0
    for line in lines:
        if line == "":
            blank_count += 1
            if blank_count <= 1:
                cleaned_lines.append("")
        else:
            blank_count = 0
            cleaned_lines.append(line)
    return "\n".join(cleaned_lines).strip()


def extract_document_number_strict(text: str) -> Optional[str]:
    """Tìm số hiệu văn bản (chỉ khi có cấu trúc Số: .../...)"""
    if not text:
        return None
    header = text[:1000]
    m = re.search(
        r"(?:Số|SỐ|Số:)\s*[:\.]?\s*([0-9]{1,4}\s*[\/\-]\s*[A-Za-zĐđ0-9\-_]+)",
        header,
        re.IGNORECASE,
    )
    if m:
        num = re.sub(r"\s+", "", m.group(1).strip())
        if len(num) >= 4 and ("/" in num or "-" in num):
            return num
    return None


def extract_issue_date_strict(text: str) -> Optional[str]:
    """Tìm ngày tháng ban hành trong phần mở đầu văn bản: ngày ... tháng ... năm ..."""
    if not text:
        return None
    header = text[:1500]
    # Mẫu ngày ... tháng ... năm ...
    m = re.search(
        r"ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})",
        header,
        re.IGNORECASE,
    )
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= day <= 31 and 1 <= month <= 12 and 1990 <= year <= 2050:
            return f"{year:04d}-{month:02d}-{day:02d}"
    
    # Mẫu DD/MM/YYYY
    m2 = re.search(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b", header)
    if m2:
        day, month, year = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))
        if 1 <= day <= 31 and 1 <= month <= 12 and 1990 <= year <= 2050:
            return f"{year:04d}-{month:02d}-{day:02d}"
    return None


def extract_issuing_unit_strict(text: str) -> Optional[str]:
    """Nhận diện đơn vị ban hành nếu văn bản nêu rõ ràng."""
    if not text:
        return None
    h = text[:800].lower()
    if "trường đại học kiến trúc đà nẵng" in h or "đại học kiến trúc đà nẵng" in h:
        return "Trường Đại học Kiến trúc Đà Nẵng"
    return None


def extract_category_hint(title: str, text: str) -> Optional[str]:
    combined = f"{title}\n{text[:500]}".lower()
    if "học phí" in combined or "bảo hiểm" in combined or "miễn giảm" in combined:
        return "Học phí"
    elif "phúc khảo" in combined:
        return "Khảo thí"
    elif "quy đổi" in combined or "chuẩn đầu ra" in combined:
        return "Chuẩn đầu ra"
    elif "khảo sát" in combined:
        return "Khảo sát"
    elif "tốt nghiệp" in combined or "xét tốt nghiệp" in combined:
        return "Đào tạo"
    elif "học bổng" in combined:
        return "Học bổng"
    return None


def extract_pdf(file_path: Path) -> Tuple[List[Dict[str, Any]], bool, bool, List[str]]:
    warnings = []
    needs_ocr = False
    ocr_performed = False

    try:
        import pymupdf as fitz
    except ImportError:
        try:
            import fitz
        except ImportError:
            raise RuntimeError("Thư viện PyMuPDF chưa được cài đặt trong môi trường Python.")

    doc = fitz.open(str(file_path))
    pages = []
    total_chars = 0

    try:
        for page_num in range(len(doc)):
            page = doc[page_num]
            raw = page.get_text("text") or ""
            cleaned = clean_text(raw)
            total_chars += len(cleaned)
            pages.append({
                "page_number": page_num + 1,
                "raw_text": raw,
                "cleaned_text": cleaned,
                "extraction_status": "ok" if len(cleaned) >= 20 else "empty",
            })
    finally:
        doc.close()

    # Nếu tổng ký tự quá ít (< 50 ký tự cho cả tài liệu), kiểm tra khả năng OCR
    if total_chars < 50 and len(pages) > 0:
        needs_ocr = True
        has_tesseract = False
        try:
            import pytesseract
            from PIL import Image
            import io
            has_tesseract = os.path.exists(pytesseract.pytesseract.tesseract_cmd)
        except Exception:
            has_tesseract = False

        if has_tesseract:
            try:
                doc = fitz.open(str(file_path))
                ocr_pages = []
                for page_num in range(len(doc)):
                    page = doc[page_num]
                    # Render trang ra ảnh với zoom 2.0 (DPI ~ 144-200)
                    pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
                    img_bytes = pix.tobytes("png")
                    img = Image.open(io.BytesIO(img_bytes))
                    
                    # Ngôn ngữ: kiểm tra vie
                    lang = "vie+eng"
                    try:
                        text_ocr = pytesseract.image_to_string(img, lang=lang)
                    except Exception as ocr_err:
                        warnings.append(f"OCR trang {page_num + 1} lỗi với vie: {ocr_err}, fallback sang eng")
                        try:
                            text_ocr = pytesseract.image_to_string(img, lang="eng")
                        except Exception:
                            text_ocr = ""

                    cleaned_ocr = clean_text(text_ocr)
                    ocr_pages.append({
                        "page_number": page_num + 1,
                        "raw_text": text_ocr,
                        "cleaned_text": cleaned_ocr,
                        "extraction_status": "ocr" if len(cleaned_ocr) >= 20 else "ocr_empty",
                    })
                pages = ocr_pages
                ocr_performed = True
            except Exception as e:
                warnings.append(f"Không thể thực hiện OCR scan: {str(e)}")
            finally:
                doc.close()
        else:
            warnings.append("PDF không có text layer (file scan/ảnh) nhưng Tesseract OCR chưa sẵn sàng.")
            for p in pages:
                p["extraction_status"] = "needs_ocr"

    return pages, needs_ocr, ocr_performed, warnings


def extract_docx(file_path: Path) -> Tuple[List[Dict[str, Any]], List[str]]:
    warnings = []
    try:
        import docx
    except ImportError:
        raise RuntimeError("Thư viện python-docx chưa được cài đặt trong môi trường Python.")

    doc = docx.Document(str(file_path))
    paragraphs = []
    for p in doc.paragraphs:
        txt = p.text.strip()
        if txt:
            paragraphs.append(txt)

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                cell_txt = cell.text.strip()
                if cell_txt and cell_txt not in paragraphs:
                    paragraphs.append(cell_txt)

    full_text = "\n\n".join(paragraphs)
    cleaned = clean_text(full_text)

    pages = [{
        "page_number": 1,
        "raw_text": full_text,
        "cleaned_text": cleaned,
        "extraction_status": "ok" if len(cleaned) > 0 else "empty",
    }]
    return pages, warnings


def extract_html(file_path: Path) -> Tuple[List[Dict[str, Any]], List[str]]:
    warnings = []
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        raise RuntimeError("Thư viện beautifulsoup4 chưa được cài đặt trong môi trường Python.")

    encodings = ["utf-8", "utf-8-sig", "cp1258", "latin1"]
    raw_html = ""
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                raw_html = f.read()
            break
        except Exception:
            continue

    soup = BeautifulSoup(raw_html, "html.parser")
    for el in soup(["script", "style", "noscript", "svg"]):
        el.decompose()

    text = soup.get_text(separator="\n\n")
    cleaned = clean_text(text)

    pages = [{
        "page_number": 1,
        "raw_text": text,
        "cleaned_text": cleaned,
        "extraction_status": "ok" if len(cleaned) > 0 else "empty",
    }]
    return pages, warnings


def main():
    parser = argparse.ArgumentParser(description="Extract text and metadata from document")
    parser.add_argument("--file", type=str, help="Path to document file")
    parser.add_argument("--format", type=str, help="Format: pdf, docx, html")
    parser.add_argument("--input-json", type=str, help="JSON input string")

    args = parser.parse_args()

    file_path_str = None
    file_format = None

    if args.input_json:
        data = json.loads(args.input_json)
        file_path_str = data.get("file_path")
        file_format = data.get("file_format")
    elif args.file:
        file_path_str = args.file
        file_format = args.format

    if not file_path_str:
        # Đọc từ stdin
        try:
            stdin_data = sys.stdin.read()
            if stdin_data.strip():
                data = json.loads(stdin_data)
                file_path_str = data.get("file_path")
                file_format = data.get("file_format")
        except Exception:
            pass

    if not file_path_str:
        result = {
            "success": False,
            "error": "Thiếu tham số đường dẫn file (--file hoặc --input-json hoặc stdin)",
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

    file_path = Path(file_path_str).resolve()
    if not file_path.exists():
        result = {
            "success": False,
            "error": f"File không tồn tại trên đĩa: {file_path}",
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

    if not file_format:
        ext = file_path.suffix.lower()
        if ext == ".pdf":
            file_format = "pdf"
        elif ext == ".docx":
            file_format = "docx"
        elif ext in [".html", ".htm"]:
            file_format = "html"
        elif ext == ".doc":
            result = {
                "success": False,
                "error": "Định dạng file .doc cũ (binary Word 97-2003) chưa được hỗ trợ trực tiếp. Vui lòng mở bằng Microsoft Word hoặc LibreOffice và Lưu dưới dạng (Save As) .docx rồi upload lại.",
                "file_format": "doc",
            }
            print(json.dumps(result, ensure_ascii=False))
            sys.exit(0)
        else:
            result = {
                "success": False,
                "error": f"Định dạng {ext} không được hỗ trợ. Chỉ hỗ trợ .pdf, .docx, .html.",
            }
            print(json.dumps(result, ensure_ascii=False))
            sys.exit(1)

    file_format = file_format.lower()
    needs_ocr = False
    ocr_performed = False
    warnings = []
    pages = []

    try:
        if file_format == "pdf":
            pages, needs_ocr, ocr_performed, warnings = extract_pdf(file_path)
        elif file_format == "docx":
            pages, warnings = extract_docx(file_path)
        elif file_format == "html":
            pages, warnings = extract_html(file_path)
        elif file_format == "doc":
            result = {
                "success": False,
                "error": "Định dạng file .doc cũ (binary Word 97-2003) chưa được hỗ trợ trực tiếp. Vui lòng chuyển đổi sang .docx.",
                "file_format": "doc",
            }
            print(json.dumps(result, ensure_ascii=False))
            sys.exit(0)
        else:
            raise ValueError(f"Định dạng {file_format} không được hỗ trợ.")

        # Tổng hợp text từ các trang
        all_text = "\n\n".join([p["cleaned_text"] for p in pages if p.get("cleaned_text")])

        # Metadata hints căn cứ chính xác trên text
        first_page_text = pages[0]["cleaned_text"] if pages else ""
        doc_num = extract_document_number_strict(first_page_text)
        issue_date = extract_issue_date_strict(first_page_text)
        issuing_unit = extract_issuing_unit_strict(first_page_text)

        # Tiêu đề tạm từ tên file hoặc dòng đầu
        stem_title = file_path.stem.replace("_", " ").replace("-", " ")
        category_hint = extract_category_hint(stem_title, first_page_text)

        metadata_hints = {
            "title_candidate": stem_title,
            "document_number": doc_num,
            "issue_date": issue_date,
            "issuing_unit": issuing_unit,
            "category_hint": category_hint,
        }

        result = {
            "success": True,
            "file_format": file_format,
            "total_pages": len(pages),
            "needs_ocr": needs_ocr,
            "ocr_performed": ocr_performed,
            "pages": pages,
            "metadata_hints": metadata_hints,
            "warnings": warnings,
            "error": None,
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)

    except Exception as e:
        result = {
            "success": False,
            "file_format": file_format,
            "total_pages": len(pages),
            "needs_ocr": False,
            "ocr_performed": False,
            "pages": [],
            "metadata_hints": {},
            "warnings": warnings,
            "error": str(e),
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()