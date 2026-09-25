"""
Module OCR Pipeline cho DAU Second Brain.

Render từng trang PDF thành ảnh bằng PyMuPDF, OCR bằng Tesseract/pytesseract
(ưu tiên tiếng Việt, fallback tiếng Anh), làm sạch text, cập nhật JSON extracted.

Nguyên tắc bất biến:
- Chỉ ghi lại text mà OCR đọc được. Tuyệt đối không suy luận, thêm, sửa nội dung.
- Không gọi LLM, Gemini, OpenAI, embedding hay RAG.
- Không xác định hiệu lực văn bản.
- Nếu Tesseract không có → báo lỗi rõ ràng, không crash toàn bộ pipeline.
- Mỗi page giữ nguyên page_number riêng biệt.
"""

import argparse
import json
import logging
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from .config import DATA_DIR, DOCUMENTS_DIR, EXTRACTED_DIR, OUTPUT_FILE
from .document_extractor import clean_text

logger = logging.getLogger("OCRExtractor")

# --------------------------------------------------------------------------- #
#  Đường dẫn Tesseract mặc định trên Windows                                  #
# --------------------------------------------------------------------------- #

_TESSERACT_DEFAULT_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe\tesseract.exe",
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    r"C:\Users\ACER\AppData\Local\Programs\Tesseract-OCR\tesseract.exe",
]

_TESSDATA_DEFAULT_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe\tessdata",
    r"C:\Program Files\Tesseract-OCR\tessdata",
    r"C:\Program Files (x86)\Tesseract-OCR\tessdata",
]

OCR_STATUS_OK = "ocr"
OCR_STATUS_FAILED = "ocr_failed"
OCR_STATUS_SKIPPED = "ocr_skipped"
OCR_STATUS_NEEDS_OCR = "needs_ocr"
OCR_STATUS_QUALITY_WARNING = "ocr_quality_warning"

DEFAULT_LANG = "vie+eng"

# --------------------------------------------------------------------------- #
#  Phát hiện Tesseract                                                         #
# --------------------------------------------------------------------------- #

def find_tesseract_cmd() -> Optional[str]:
    """
    Tìm đường dẫn binary Tesseract theo thứ tự:
    1. Biến môi trường TESSERACT_CMD
    2. Các đường dẫn mặc định trên Windows
    3. PATH (để pytesseract tự tìm)
    """
    import os
    env_cmd = os.environ.get("TESSERACT_CMD", "")
    if env_cmd and Path(env_cmd).is_file():
        return env_cmd

    for p in _TESSERACT_DEFAULT_PATHS:
        if Path(p).is_file():
            return p

    return None


def find_tessdata_dir() -> Optional[str]:
    """Tìm thư mục tessdata chứa .traineddata files."""
    import os
    env_dir = os.environ.get("TESSDATA_PREFIX", "")
    if env_dir and Path(env_dir).is_dir():
        return env_dir

    for p in _TESSDATA_DEFAULT_PATHS:
        if Path(p).is_dir():
            return p

    return None


def check_tesseract_available() -> Tuple[bool, str, Optional[str]]:
    """
    Kiểm tra Tesseract có sẵn không.

    Trả về:
        (is_available, tesseract_cmd_or_reason, version_string)
    """
    try:
        import pytesseract

        cmd = find_tesseract_cmd()
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd

        version = pytesseract.get_tesseract_version()
        return True, cmd or "tesseract", str(version)
    except Exception as e:
        return False, str(e), None


def check_language_available(lang: str = "vie") -> bool:
    """Kiểm tra gói ngôn ngữ Tesseract có sẵn không."""
    tessdata = find_tessdata_dir()
    if not tessdata:
        return False
    traineddata = Path(tessdata) / f"{lang}.traineddata"
    return traineddata.is_file()


def get_ocr_lang(prefer_vie: bool = True) -> str:
    """
    Chọn ngôn ngữ OCR:
    - Nếu vie.traineddata có → "vie+eng"
    - Nếu không → "eng" (fallback)
    """
    if prefer_vie and check_language_available("vie"):
        return "vie+eng"
    return "eng"


# --------------------------------------------------------------------------- #
#  Render PDF page → PIL Image                                                 #
# --------------------------------------------------------------------------- #

def render_pdf_page_to_image(pdf_path: Path, page_number: int, dpi: int = 200):
    """
    Render một trang PDF (1-indexed) thành PIL Image bằng PyMuPDF.

    Tham số:
        pdf_path    - Đường dẫn file PDF
        page_number - Số trang (1-indexed)
        dpi         - Độ phân giải render (mặc định 200 DPI)

    Trả về PIL Image hoặc raise Exception nếu thất bại.
    """
    try:
        import pymupdf as fitz
    except ImportError:
        import fitz

    from PIL import Image
    import io

    doc = fitz.open(str(pdf_path))
    try:
        if page_number < 1 or page_number > len(doc):
            raise ValueError(
                f"Page {page_number} không hợp lệ. PDF có {len(doc)} trang."
            )
        page = doc[page_number - 1]
        # Zoom = DPI / 72 (PDF point = 1/72 inch)
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
        img_data = pix.tobytes("png")
        return Image.open(io.BytesIO(img_data))
    finally:
        doc.close()


# --------------------------------------------------------------------------- #
#  OCR một trang                                                               #
# --------------------------------------------------------------------------- #

def ocr_image(image, lang: str = "vie+eng", tesseract_cmd: Optional[str] = None) -> str:
    """
    OCR một PIL Image bằng pytesseract.

    Tham số:
        image          - PIL Image
        lang           - Ngôn ngữ Tesseract (ví dụ: "vie+eng", "eng")
        tesseract_cmd  - Đường dẫn binary Tesseract (None = dùng PATH)

    Trả về raw_text từ OCR (chưa làm sạch).
    """
    import pytesseract

    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    config = "--psm 3"  # Fully automatic page segmentation
    text = pytesseract.image_to_string(image, lang=lang, config=config)
    return text


def ocr_pdf_page(
    pdf_path: Path,
    page_number: int,
    lang: str = "vie+eng",
    dpi: int = 200,
    tesseract_cmd: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Render + OCR một trang PDF. Trả về dict page entry.

    {
        "page_number": int,
        "raw_text": str,      # text thô từ OCR
        "cleaned_text": str,  # text sau clean_text()
        "extraction_status":  # "ocr" | "ocr_failed"
    }
    """
    try:
        image = render_pdf_page_to_image(pdf_path, page_number, dpi=dpi)
    except Exception as e:
        logger.warning(f"Không thể render trang {page_number}: {e}")
        return {
            "page_number": page_number,
            "raw_text": "",
            "cleaned_text": "",
            "extraction_status": OCR_STATUS_FAILED,
            "ocr_error": str(e),
        }

    try:
        raw = ocr_image(image, lang=lang, tesseract_cmd=tesseract_cmd)
    except Exception as e:
        logger.warning(f"OCR thất bại trang {page_number}: {e}")
        return {
            "page_number": page_number,
            "raw_text": "",
            "cleaned_text": "",
            "extraction_status": OCR_STATUS_FAILED,
            "ocr_error": str(e),
        }

    cleaned = clean_text(raw)
    return {
        "page_number": page_number,
        "raw_text": raw,
        "cleaned_text": cleaned,
        "extraction_status": OCR_STATUS_OK,
    }


# --------------------------------------------------------------------------- #
#  Pipeline OCR cho một PDF                                                    #
# --------------------------------------------------------------------------- #

def ocr_pdf(
    pdf_path: Path,
    extracted_json_path: Path,
    lang: str = "vie+eng",
    dpi: int = 200,
    tesseract_cmd: Optional[str] = None,
    force: bool = False,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """
    Chạy OCR toàn bộ PDF và cập nhật file JSON extracted tương ứng.

    Tham số:
        pdf_path           - File PDF gốc
        extracted_json_path - File JSON trong extracted/ cần cập nhật
        lang               - Ngôn ngữ Tesseract
        dpi                - Độ phân giải render (200 DPI đủ cho hầu hết tài liệu văn phòng)
        tesseract_cmd      - Đường dẫn Tesseract
        force              - Bỏ qua cache, OCR lại dù đã có ocr status
        dry_run            - Không ghi file, chỉ phân tích

    Trả về dict thống kê cho PDF này.
    """
    result = {
        "pdf_path": str(pdf_path),
        "pages_total": 0,
        "pages_ok": 0,
        "pages_failed": 0,
        "chars_total": 0,
        "status": "ok",
    }

    if not pdf_path.exists():
        logger.error(f"File PDF không tồn tại: {pdf_path}")
        result["status"] = "error:pdf_not_found"
        return result

    if not extracted_json_path.exists():
        logger.error(f"File JSON extracted không tồn tại: {extracted_json_path}")
        result["status"] = "error:json_not_found"
        return result

    # Đọc JSON hiện tại
    try:
        with open(extracted_json_path, "r", encoding="utf-8") as f:
            doc_data = json.load(f)
    except Exception as e:
        logger.error(f"Không thể đọc {extracted_json_path}: {e}")
        result["status"] = f"error:json_read:{e}"
        return result

    # Kiểm tra đã OCR chưa (nếu không force)
    current_status = doc_data.get("extraction_status", "")
    if not force and current_status == OCR_STATUS_OK:
        logger.info(f"  [SKIP] {pdf_path.name} đã có OCR thành công (dùng --force để chạy lại)")
        result["status"] = "skipped"
        existing_pages = doc_data.get("pages", [])
        result["pages_total"] = len(existing_pages)
        result["pages_ok"] = len(existing_pages)
        result["chars_total"] = sum(
            len(p.get("cleaned_text", "")) for p in existing_pages
        )
        return result

    # Xác định số trang từ JSON (đã có từ document_extractor)
    existing_pages = doc_data.get("pages", [])
    total_pages = len(existing_pages)

    if total_pages == 0:
        # Fallback: đếm trang trực tiếp từ PDF
        try:
            try:
                import pymupdf as fitz
            except ImportError:
                import fitz
            doc = fitz.open(str(pdf_path))
            total_pages = len(doc)
            doc.close()
        except Exception as e:
            logger.error(f"Không thể đọc PDF: {e}")
            result["status"] = f"error:pdf_open:{e}"
            return result

    result["pages_total"] = total_pages
    logger.info(f"  Bắt đầu OCR: {pdf_path.name} ({total_pages} trang, lang={lang})")

    ocr_pages = []
    pages_ok = 0
    pages_failed = 0
    chars_total = 0

    for pg in range(1, total_pages + 1):
        logger.info(f"    Trang {pg}/{total_pages}...")
        page_result = ocr_pdf_page(
            pdf_path=pdf_path,
            page_number=pg,
            lang=lang,
            dpi=dpi,
            tesseract_cmd=tesseract_cmd,
        )
        ocr_pages.append(page_result)

        if page_result["extraction_status"] == OCR_STATUS_OK:
            pages_ok += 1
            chars_total += len(page_result.get("cleaned_text", ""))
        else:
            pages_failed += 1

    result["pages_ok"] = pages_ok
    result["pages_failed"] = pages_failed
    result["chars_total"] = chars_total

    # Quyết định overall status
    if pages_ok == total_pages:
        overall_status = OCR_STATUS_OK
    elif pages_ok > 0:
        overall_status = "ocr_partial"
    else:
        overall_status = OCR_STATUS_FAILED

    # Cập nhật JSON (nếu không dry-run)
    if not dry_run:
        doc_data["pages"] = ocr_pages
        doc_data["extraction_status"] = overall_status
        doc_data["ocr_lang"] = lang
        doc_data["ocr_at"] = datetime.now().isoformat()
        doc_data["total_pages"] = total_pages

        try:
            with open(extracted_json_path, "w", encoding="utf-8") as f:
                json.dump(doc_data, f, ensure_ascii=False, indent=2)
            logger.info(
                f"  → Cập nhật {extracted_json_path.name}: "
                f"{pages_ok}/{total_pages} trang OK, "
                f"{chars_total} ký tự, status={overall_status}"
            )
        except Exception as e:
            logger.error(f"Lỗi khi lưu {extracted_json_path}: {e}")
            result["status"] = f"error:json_write:{e}"
            return result
    else:
        logger.info(
            f"  [DRY-RUN] {pdf_path.name}: "
            f"{pages_ok}/{total_pages} trang OK, {chars_total} ký tự"
        )

    result["status"] = overall_status
    return result


# --------------------------------------------------------------------------- #
#  Pipeline chính                                                              #
# --------------------------------------------------------------------------- #

class OCRExtractor:
    """
    Pipeline OCR tất cả PDF needs_ocr trong crawler/data/documents/.
    Cập nhật JSON trong crawler/data/extracted/.
    """

    def __init__(
        self,
        documents_dir: Path = DOCUMENTS_DIR,
        extracted_dir: Path = EXTRACTED_DIR,
        notifications_file: Path = OUTPUT_FILE,
        dpi: int = 200,
        lang: Optional[str] = None,
        force: bool = False,
        dry_run: bool = False,
    ):
        self.documents_dir = Path(documents_dir)
        self.extracted_dir = Path(extracted_dir)
        self.dpi = dpi
        self.force = force
        self.dry_run = dry_run

        # Phát hiện Tesseract
        self.tesseract_available, self.tesseract_cmd, self.tesseract_version = (
            check_tesseract_available()
        )

        if not self.tesseract_available:
            logger.error(
                "[TESSERACT KHÔNG TÌM THẤY] " + self.tesseract_cmd
            )
        else:
            tess_path = self.tesseract_cmd or "PATH"
            logger.info(f"Tesseract {self.tesseract_version} tại: {tess_path}")

        # Chọn ngôn ngữ: mặc định là DEFAULT_LANG ("vie+eng")
        requested_lang = lang if lang else DEFAULT_LANG
        self.lang = requested_lang

        # Kiểm tra nếu ngôn ngữ yêu cầu có chứa tiếng Việt mà máy chưa có vie.traineddata
        if "vie" in requested_lang:
            vie_ok = check_language_available("vie")
            if not vie_ok:
                tessdata_path = find_tessdata_dir() or "[tessdata dir]"
                logger.error(
                    f"[VIE LANGUAGE PACK THIẾU] Yêu cầu ngôn ngữ '{requested_lang}' nhưng vie.traineddata "
                    f"chưa được cài đặt tại: {tessdata_path}.\n"
                    f"  Hệ thống KHÔNG âm thầm fallback sang tiếng Anh để tránh sai lệch dữ liệu tiếng Việt.\n"
                    f"  Vui lòng tải vie.traineddata từ:\n"
                    f"    https://github.com/tesseract-ocr/tessdata_fast/raw/main/vie.traineddata\n"
                    f"  và lưu vào: {tessdata_path}"
                )
                self.language_available = False
            else:
                self.language_available = True
        else:
            self.language_available = True

        logger.info(f"Ngôn ngữ OCR đã cấu hình: {self.lang}")

    def _find_pdf_json_pairs(self) -> List[Tuple[Path, Path]]:
        """
        Tìm tất cả cặp (pdf_path, json_path) cần xử lý.
        Chỉ chọn PDF có JSON extracted tương ứng với status needs_ocr
        (hoặc tất cả nếu force=True).
        """
        pairs = []
        if not self.documents_dir.exists():
            return pairs

        for pdf_path in sorted(self.documents_dir.rglob("*.pdf")):
            # Xác định json tương ứng (giữ cấu trúc thư mục con)
            try:
                rel = pdf_path.relative_to(self.documents_dir)
            except ValueError:
                rel = Path(pdf_path.name)

            json_path = self.extracted_dir / rel.with_suffix(".json")

            if not json_path.exists():
                logger.debug(f"Bỏ qua {pdf_path.name}: không có JSON extracted")
                continue

            # Đọc status
            if not self.force:
                try:
                    with open(json_path, "r", encoding="utf-8") as f:
                        status = json.load(f).get("extraction_status", "")
                    if status == OCR_STATUS_OK:
                        logger.debug(f"Bỏ qua {pdf_path.name}: đã OCR thành công")
                        continue
                except Exception:
                    pass

            pairs.append((pdf_path, json_path))

        return pairs

    def run(self) -> Dict[str, Any]:
        """Chạy toàn bộ pipeline OCR."""
        t_start = time.time()

        stats = {
            "total_pdfs": 0,
            "ocr_ok": 0,
            "ocr_partial": 0,
            "ocr_failed": 0,
            "skipped": 0,
            "errors": 0,
            "total_pages": 0,
            "total_chars": 0,
            "duration_sec": 0.0,
            "lang": self.lang,
            "dry_run": self.dry_run,
        }

        if not self.tesseract_available:
            self._print_tesseract_install_guide()
            self._print_summary(stats, time.time() - t_start)
            return stats

        if not getattr(self, "language_available", True):
            logger.error(
                f"Không thể thực hiện OCR với ngôn ngữ '{self.lang}' vì thiếu tệp traineddata tương ứng.\n"
                "Đã dừng an toàn. Không đánh dấu tài liệu là OCR tiếng Việt thành công."
            )
            self._print_summary(stats, time.time() - t_start)
            return stats

        pairs = self._find_pdf_json_pairs()
        stats["total_pdfs"] = len(pairs)

        if not pairs:
            logger.info("Không có PDF nào cần OCR.")
            self._print_summary(stats, time.time() - t_start)
            return stats

        logger.info(f"Tìm thấy {len(pairs)} PDF cần OCR.")

        for pdf_path, json_path in pairs:
            logger.info(f"\n[{pairs.index((pdf_path, json_path)) + 1}/{len(pairs)}] {pdf_path.name}")
            result = ocr_pdf(
                pdf_path=pdf_path,
                extracted_json_path=json_path,
                lang=self.lang,
                dpi=self.dpi,
                tesseract_cmd=self.tesseract_cmd if self.tesseract_available else None,
                force=self.force,
                dry_run=self.dry_run,
            )

            status = result.get("status", "")
            stats["total_pages"] += result.get("pages_total", 0)
            stats["total_chars"] += result.get("chars_total", 0)

            if status == "skipped":
                stats["skipped"] += 1
            elif status == OCR_STATUS_OK:
                stats["ocr_ok"] += 1
            elif status == "ocr_partial":
                stats["ocr_partial"] += 1
            elif status == OCR_STATUS_FAILED:
                stats["ocr_failed"] += 1
            elif status.startswith("error:"):
                stats["errors"] += 1
                logger.error(f"  [ERROR] {pdf_path.name}: {status}")

        self._print_summary(stats, time.time() - t_start)
        return stats

    @staticmethod
    def _print_tesseract_install_guide():
        print("\n" + "!" * 60)
        print(" TESSERACT OCR CHƯA ĐƯỢC CÀI ĐẶT HOẶC KHÔNG TRONG PATH")
        print("!" * 60)
        print("Hướng dẫn cài Tesseract trên Windows:")
        print("  1. Tải installer tại: https://github.com/UB-Mannheim/tesseract/wiki")
        print("     (chọn bản tesseract-ocr-w64-setup-*.exe)")
        print("  2. Trong quá trình cài, TICK chọn 'Vietnamese' language pack.")
        print("  3. Thêm vào PATH hoặc set biến môi trường:")
        print("     TESSERACT_CMD=C:\\Program Files\\Tesseract-OCR\\tesseract.exe")
        print("  4. Hoặc đặt TESSERACT_CMD trong file .env:")
        print('     TESSERACT_CMD="C:\\Program Files\\Tesseract-OCR\\tesseract.exe"')
        print("!" * 60 + "\n")

    def _print_summary(self, stats: Dict[str, Any], duration: float):
        stats["duration_sec"] = round(duration, 2)
        print("\n" + "=" * 60)
        print(" DAU SECOND BRAIN - OCR EXTRACTOR")
        print("=" * 60)
        print(f"Tổng PDF xử lý          : {stats['total_pdfs']}")
        print(f"Tổng trang               : {stats['total_pages']}")
        print(f"OCR thành công           : {stats['ocr_ok']}")
        print(f"OCR một phần (partial)   : {stats['ocr_partial']}")
        print(f"OCR thất bại             : {stats['ocr_failed']}")
        print(f"Bỏ qua (đã có OCR)       : {stats['skipped']}")
        print(f"Lỗi                      : {stats['errors']}")
        print(f"Tổng ký tự OCR được      : {stats['total_chars']:,}")
        print(f"Ngôn ngữ                 : {stats['lang']}")
        print(f"Dry-run                  : {stats['dry_run']}")
        print(f"Thời gian                : {stats['duration_sec']}s")
        print("=" * 60 + "\n")


# --------------------------------------------------------------------------- #
#  CLI                                                                         #
# --------------------------------------------------------------------------- #

def main():
    parser = argparse.ArgumentParser(
        description=(
            "DAU Second Brain - OCR Extractor: "
            "OCR PDF scan → cập nhật JSON extracted."
        )
    )
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Chỉ xử lý một file PDF cụ thể",
    )
    parser.add_argument(
        "--documents-dir",
        type=str,
        default=str(DOCUMENTS_DIR),
        help=f"Thư mục PDF (mặc định: {DOCUMENTS_DIR})",
    )
    parser.add_argument(
        "--extracted-dir",
        type=str,
        default=str(EXTRACTED_DIR),
        help=f"Thư mục JSON extracted (mặc định: {EXTRACTED_DIR})",
    )
    parser.add_argument(
        "--lang",
        type=str,
        default=None,
        help="Ngôn ngữ OCR (ví dụ: vie+eng, eng). Mặc định: tự chọn",
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=200,
        help="Độ phân giải render trang PDF (mặc định: 200)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="OCR lại ngay cả những file đã có ocr status",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Phân tích và OCR nhưng không ghi file",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    if args.file:
        # Chế độ một file
        pdf_path = Path(args.file)
        try:
            rel = pdf_path.relative_to(Path(args.documents_dir))
        except ValueError:
            rel = Path(pdf_path.name)
        json_path = Path(args.extracted_dir) / rel.with_suffix(".json")

        tess_cmd = find_tesseract_cmd()
        lang = args.lang or DEFAULT_LANG
        if "vie" in lang and not check_language_available("vie"):
            logger.error(
                f"[LỖI] Yêu cầu ngôn ngữ '{lang}' nhưng vie.traineddata chưa có trên hệ thống.\n"
                "Không thực hiện OCR để tránh nhầm lẫn kết quả tiếng Việt."
            )
            print(json.dumps({"status": "error:vie_language_not_found"}, ensure_ascii=False, indent=2))
            return

        result = ocr_pdf(
            pdf_path=pdf_path,
            extracted_json_path=json_path,
            lang=lang,
            dpi=args.dpi,
            tesseract_cmd=tess_cmd,
            force=args.force,
            dry_run=args.dry_run,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    extractor = OCRExtractor(
        documents_dir=Path(args.documents_dir),
        extracted_dir=Path(args.extracted_dir),
        lang=args.lang,
        dpi=args.dpi,
        force=args.force,
        dry_run=args.dry_run,
    )
    extractor.run()


if __name__ == "__main__":
    main()
