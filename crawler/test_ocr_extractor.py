"""
Unit test cho module crawler/ocr_extractor.py.

Kiểm tra:
- Render PDF page thành ảnh
- OCR mock (không cần Tesseract thật)
- Page number giữ đúng và thứ tự tuần tự
- Cleaned text không làm mất nội dung pháp lý
- PDF không tồn tại báo lỗi rõ ràng
- Tesseract không có xử lý an toàn
- vie language không có fallback eng / báo lỗi
- OCR failure không crash toàn bộ pipeline
- Dry-run không ghi đè JSON
"""

import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from crawler.document_extractor import clean_text
from crawler.ocr_extractor import (
    OCR_STATUS_FAILED,
    OCR_STATUS_OK,
    OCRExtractor,
    check_language_available,
    check_tesseract_available,
    get_ocr_lang,
    ocr_image,
    ocr_pdf,
    ocr_pdf_page,
    render_pdf_page_to_image,
)


class TestOCRExtractor(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.docs_dir = Path(self.temp_dir) / "documents" / "2026"
        self.docs_dir.mkdir(parents=True)
        self.extracted_dir = Path(self.temp_dir) / "extracted" / "2026"
        self.extracted_dir.mkdir(parents=True)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _create_sample_pdf(self, filename: str, text: str = "Trang 1 thong bao") -> Path:
        try:
            import pymupdf as fitz
        except ImportError:
            import fitz
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 720), text)
        pdf_path = self.docs_dir / filename
        doc.save(str(pdf_path))
        doc.close()
        return pdf_path

    def _create_sample_json(self, filename: str, pdf_path: Path, num_pages: int = 1) -> Path:
        json_path = self.extracted_dir / filename
        data = {
            "source_file": str(pdf_path.resolve()),
            "source_url": "https://media.dau.edu.vn/test.pdf",
            "notification_title": "Test Thông báo",
            "file_format": "pdf",
            "extraction_status": "needs_ocr",
            "total_pages": num_pages,
            "pages": [
                {
                    "page_number": i + 1,
                    "raw_text": "",
                    "cleaned_text": "",
                    "extraction_status": "needs_ocr",
                }
                for i in range(num_pages)
            ],
        }
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return json_path

    def test_render_pdf_page_to_image(self):
        pdf_path = self._create_sample_pdf("render_test.pdf")
        img = render_pdf_page_to_image(pdf_path, 1, dpi=100)
        self.assertIsNotNone(img)
        self.assertGreater(img.width, 0)
        self.assertGreater(img.height, 0)

    def test_render_pdf_page_invalid_page_raises(self):
        pdf_path = self._create_sample_pdf("render_invalid.pdf")
        with self.assertRaises(ValueError):
            render_pdf_page_to_image(pdf_path, 99, dpi=100)

    @patch("crawler.ocr_extractor.ocr_image")
    def test_ocr_mock_success_keeps_page_number(self, mock_ocr):
        mock_ocr.return_value = "Số: 43/TB-ĐHKTĐN\nNgày 28/08/2026\nHọc phí: 1.200.000đ"
        pdf_path = self._create_sample_pdf("mock_test.pdf")

        page_res = ocr_pdf_page(pdf_path, page_number=1)
        self.assertEqual(page_res["page_number"], 1)
        self.assertEqual(page_res["extraction_status"], OCR_STATUS_OK)
        self.assertIn("43/TB-ĐHKTĐN", page_res["cleaned_text"])
        self.assertIn("1.200.000đ", page_res["cleaned_text"])

    @patch("crawler.ocr_extractor.ocr_image", side_effect=RuntimeError("Tesseract OCR timeout"))
    def test_ocr_failure_does_not_crash(self, mock_ocr):
        pdf_path = self._create_sample_pdf("mock_fail.pdf")
        page_res = ocr_pdf_page(pdf_path, page_number=1)
        self.assertEqual(page_res["page_number"], 1)
        self.assertEqual(page_res["extraction_status"], OCR_STATUS_FAILED)
        self.assertIn("Tesseract OCR timeout", page_res.get("ocr_error", ""))

    def test_pdf_nonexistent_returns_error(self):
        res = ocr_pdf(
            pdf_path=Path(self.temp_dir) / "ghost.pdf",
            extracted_json_path=Path(self.temp_dir) / "ghost.json",
        )
        self.assertTrue(res["status"].startswith("error:pdf_not_found"))

    @patch("crawler.ocr_extractor.ocr_image")
    def test_dry_run_does_not_modify_json(self, mock_ocr):
        mock_ocr.return_value = "Mock OCR Text"
        pdf_path = self._create_sample_pdf("dry_run.pdf")
        json_path = self._create_sample_json("dry_run.json", pdf_path, num_pages=1)

        res = ocr_pdf(
            pdf_path=pdf_path,
            extracted_json_path=json_path,
            dry_run=True,
        )
        self.assertEqual(res["status"], OCR_STATUS_OK)

        # Đảm bảo JSON trên đĩa không bị thay đổi trạng thái needs_ocr
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertEqual(data["extraction_status"], "needs_ocr")
        self.assertEqual(data["pages"][0]["cleaned_text"], "")

    @patch("crawler.ocr_extractor.find_tesseract_cmd", return_value=None)
    @patch("pytesseract.get_tesseract_version", side_effect=Exception("Not found"))
    def test_tesseract_unavailable_handled_gracefully(self, mock_ver, mock_cmd):
        avail, reason, ver = check_tesseract_available()
        self.assertFalse(avail)
        self.assertIsNone(ver)

        extractor = OCRExtractor(
            documents_dir=Path(self.temp_dir) / "documents",
            extracted_dir=Path(self.temp_dir) / "extracted",
        )
        stats = extractor.run()
        self.assertEqual(stats["total_pdfs"], 0)

    @patch("crawler.ocr_extractor.find_tessdata_dir", return_value=None)
    def test_vie_lang_fallback(self, mock_dir):
        self.assertFalse(check_language_available("vie"))
        self.assertEqual(get_ocr_lang(prefer_vie=True), "eng")

    @patch("crawler.ocr_extractor.find_tessdata_dir", return_value=None)
    @patch("crawler.ocr_extractor.find_tesseract_cmd", return_value="dummy_tesseract")
    @patch("pytesseract.get_tesseract_version", return_value="5.5.0")
    def test_vie_missing_stops_safely_in_run(self, mock_ver, mock_cmd, mock_dir):
        extractor = OCRExtractor(
            documents_dir=Path(self.temp_dir) / "documents",
            extracted_dir=Path(self.temp_dir) / "extracted",
            lang="vie+eng",
        )
        self.assertFalse(extractor.language_available)
        stats = extractor.run()
        self.assertEqual(stats["total_pdfs"], 0)


if __name__ == "__main__":
    unittest.main()
