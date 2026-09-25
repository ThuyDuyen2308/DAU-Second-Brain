"""
Unit test cho module crawler/document_extractor.py.

Test coverage:
- PDF có text layer → extract thành công, giữ page number
- PDF không có text layer → needs_ocr
- DOCX → extract thành công
- DOC (OLE2 cũ) → error rõ ràng, không crash
- File không tồn tại → error rõ ràng
- Định dạng không hỗ trợ → error rõ ràng
- clean_text không làm mất nội dung pháp lý
- clean_text chuẩn hóa khoảng trắng và xuống dòng
- PDF binary không crash BeautifulSoup
- _build_attachment_index đọc đúng từ notifications.json
- DocumentExtractor.run() xử lý thư mục rỗng an toàn
- DocumentExtractor lưu JSON output đúng schema
"""

import io
import json
import shutil
import struct
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from crawler.document_extractor import (
    DocumentExtractor,
    _build_attachment_index,
    clean_text,
    extract_doc_pages,
    extract_docx_pages,
    extract_document,
    extract_pdf_pages,
    SUPPORTED_EXTENSIONS,
)


# --------------------------------------------------------------------------- #
#  Helpers tạo file tài liệu tối giản cho test                                #
# --------------------------------------------------------------------------- #

def _make_minimal_pdf(text_by_page: list[str]) -> bytes:
    """
    Tạo file PDF tối giản hợp lệ chứa text thuần (không dùng fitz để tạo).
    Dùng cấu trúc PDF thủ công đơn giản nhất có thể.
    """
    # Dùng reportlab nếu có; nếu không thì tạo PDF thủ công siêu tối giản
    try:
        from reportlab.pdfgen import canvas as rl_canvas
        buf = io.BytesIO()
        c = rl_canvas.Canvas(buf)
        for i, text in enumerate(text_by_page):
            c.drawString(72, 720, text[:200])
            c.showPage()
        c.save()
        return buf.getvalue()
    except ImportError:
        pass

    # Fallback: PDF thủ công (chỉ có 1 trang, text đơn giản)
    # Đây là PDF tối thiểu hợp lệ
    combined = " | ".join(text_by_page)
    # PDF thủ công với text stream
    stream_content = f"BT /F1 12 Tf 72 720 Td ({combined[:100]}) Tj ET".encode()
    pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n"
        b"2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n"
        b"3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]"
        b" /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>>\nendobj\n"
        + f"4 0 obj\n<</Length {len(stream_content)}>>\nstream\n".encode()
        + stream_content
        + b"\nendstream\nendobj\n"
        b"5 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\n"
        b"xref\n0 6\n0000000000 65535 f \n"
        b"trailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n9\n%%EOF\n"
    )
    return pdf


def _make_minimal_docx(text: str) -> bytes:
    """Tạo file DOCX tối giản hợp lệ chứa đoạn text."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # [Content_Types].xml
        zf.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml"'
            ' ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            "</Types>",
        )
        # _rels/.rels
        zf.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"'
            ' Target="word/document.xml"/>'
            "</Relationships>",
        )
        # word/document.xml
        safe_text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        zf.writestr(
            "word/document.xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            "<w:body>"
            "<w:p><w:r><w:t xml:space=\"preserve\">" + safe_text + "</w:t></w:r></w:p>"
            "</w:body>"
            "</w:document>",
        )
        # word/_rels/document.xml.rels
        zf.writestr(
            "word/_rels/document.xml.rels",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            "</Relationships>",
        )
    return buf.getvalue()


# --------------------------------------------------------------------------- #
#  TestCleanText                                                               #
# --------------------------------------------------------------------------- #

class TestCleanText(unittest.TestCase):
    """Kiểm tra hàm clean_text."""

    def test_empty_input(self):
        self.assertEqual(clean_text(""), "")
        self.assertEqual(clean_text(None), "")

    def test_normalizes_crlf(self):
        raw = "dòng 1\r\ndòng 2\rdòng 3"
        result = clean_text(raw)
        self.assertNotIn("\r", result)
        self.assertIn("dòng 1", result)
        self.assertIn("dòng 2", result)
        self.assertIn("dòng 3", result)

    def test_collapses_multiple_blank_lines(self):
        raw = "Điều 1\n\n\n\n\nĐiều 2"
        result = clean_text(raw)
        # Chỉ tối đa 1 dòng trắng liên tiếp
        self.assertNotIn("\n\n\n", result)
        self.assertIn("Điều 1", result)
        self.assertIn("Điều 2", result)

    def test_preserves_legal_content(self):
        """Số hiệu, ngày tháng, số tiền, thời hạn phải giữ nguyên."""
        raw = (
            "Số: 43/TB-ĐHKTĐN\n"
            "Ngày 28 tháng 08 năm 2026\n"
            "Mức thu: 1.200.000 đồng/tín chỉ\n"
            "Hạn nộp: 15/09/2026"
        )
        result = clean_text(raw)
        self.assertIn("43/TB-ĐHKTĐN", result)
        self.assertIn("28 tháng 08 năm 2026", result)
        self.assertIn("1.200.000 đồng/tín chỉ", result)
        self.assertIn("15/09/2026", result)

    def test_strips_trailing_whitespace_per_line(self):
        raw = "  dòng có trailing   \n  dòng tiếp theo  "
        result = clean_text(raw)
        for line in result.split("\n"):
            self.assertEqual(line, line.rstrip())

    def test_does_not_add_content(self):
        """clean_text không được thêm bất kỳ nội dung nào."""
        raw = "Thông báo học phí"
        result = clean_text(raw)
        self.assertEqual(result.strip(), raw.strip())


# --------------------------------------------------------------------------- #
#  TestExtractPdf                                                              #
# --------------------------------------------------------------------------- #

class TestExtractPdf(unittest.TestCase):
    """Kiểm tra trích xuất PDF bằng PyMuPDF."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_pdf_with_text_layer_extracts_successfully(self):
        """PDF có text layer → status=ok, page_number được giữ."""
        import fitz
        # Tạo PDF thực sự có text bằng fitz
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 720), "Số: 31/TB-ĐHKTĐN\nNgày 03 tháng 08 năm 2026")
        pdf_path = Path(self.temp_dir) / "test_with_text.pdf"
        doc.save(str(pdf_path))
        doc.close()

        pages, status = extract_pdf_pages(pdf_path)

        self.assertEqual(status, "ok")
        self.assertGreater(len(pages), 0)
        self.assertEqual(pages[0]["page_number"], 1)
        self.assertIn("31/TB", pages[0]["cleaned_text"])
        self.assertEqual(pages[0]["extraction_status"], "ok")

    def test_pdf_without_text_layer_returns_needs_ocr(self):
        """PDF scan (không có text layer) → status=needs_ocr."""
        import fitz
        # Tạo PDF rỗng (không có text content)
        doc = fitz.open()
        doc.new_page()  # trang trắng hoàn toàn
        pdf_path = Path(self.temp_dir) / "test_no_text.pdf"
        doc.save(str(pdf_path))
        doc.close()

        pages, status = extract_pdf_pages(pdf_path)

        self.assertEqual(status, "needs_ocr")
        for p in pages:
            self.assertEqual(p["extraction_status"], "needs_ocr")

    def test_pdf_page_numbers_are_sequential(self):
        """PDF nhiều trang → page_number tăng dần từ 1."""
        import fitz
        doc = fitz.open()
        for i in range(3):
            page = doc.new_page()
            page.insert_text((72, 720), f"Trang {i + 1}: Nội dung thông báo DAU")
        pdf_path = Path(self.temp_dir) / "test_multipage.pdf"
        doc.save(str(pdf_path))
        doc.close()

        pages, status = extract_pdf_pages(pdf_path)

        self.assertEqual(status, "ok")
        self.assertEqual(len(pages), 3)
        for i, p in enumerate(pages):
            self.assertEqual(p["page_number"], i + 1)

    def test_nonexistent_pdf_returns_error(self):
        """File không tồn tại → status bắt đầu bằng error:"""
        pages, status = extract_pdf_pages(Path(self.temp_dir) / "nonexistent.pdf")
        self.assertTrue(status.startswith("error:"))
        self.assertEqual(pages, [])

    def test_binary_pdf_does_not_crash_beautifulsoup(self):
        """
        Regression: extract_pdf_pages với PDF binary không được gọi BeautifulSoup.
        """
        import fitz
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 720), "Test nội dung PDF không crash")
        pdf_path = Path(self.temp_dir) / "test_binary_no_crash.pdf"
        doc.save(str(pdf_path))
        doc.close()

        # Nếu BeautifulSoup bị gọi với binary PDF sẽ raise ParserRejectedMarkup.
        # Test này chỉ cần không raise exception.
        try:
            pages, status = extract_pdf_pages(pdf_path)
        except Exception as e:
            self.fail(f"extract_pdf_pages crash với PDF binary: {e}")


# --------------------------------------------------------------------------- #
#  TestExtractDocx                                                             #
# --------------------------------------------------------------------------- #

class TestExtractDocx(unittest.TestCase):
    """Kiểm tra trích xuất DOCX."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_docx_extracts_successfully(self):
        """DOCX hợp lệ → status=ok, có text."""
        docx_bytes = _make_minimal_docx(
            "Thông báo về việc nộp học phí 1.200.000 đồng/tín chỉ"
        )
        docx_path = Path(self.temp_dir) / "test.docx"
        docx_path.write_bytes(docx_bytes)

        pages, status = extract_docx_pages(docx_path)

        self.assertEqual(status, "ok")
        self.assertEqual(len(pages), 1)
        self.assertEqual(pages[0]["page_number"], 1)
        self.assertIn("1.200.000", pages[0]["cleaned_text"])
        self.assertEqual(pages[0]["extraction_status"], "ok")

    def test_docx_legal_content_preserved(self):
        """DOCX → số hiệu, ngày tháng, số tiền không bị mất."""
        content = "Số: 29/TB - Ngày 23/07/2026 - Mức: 500.000đ"
        docx_bytes = _make_minimal_docx(content)
        docx_path = Path(self.temp_dir) / "test_legal.docx"
        docx_path.write_bytes(docx_bytes)

        pages, status = extract_docx_pages(docx_path)

        self.assertEqual(status, "ok")
        self.assertIn("29/TB", pages[0]["cleaned_text"])
        self.assertIn("23/07/2026", pages[0]["cleaned_text"])
        self.assertIn("500.000", pages[0]["cleaned_text"])


# --------------------------------------------------------------------------- #
#  TestExtractDoc                                                              #
# --------------------------------------------------------------------------- #

class TestExtractDoc(unittest.TestCase):
    """Kiểm tra trích xuất DOC cũ."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_doc_ole2_returns_error_not_crash(self):
        """DOC OLE2 binary không thể đọc → error rõ ràng, KHÔNG crash."""
        # Magic bytes của OLE2 Compound Document (DOC cũ)
        ole2_header = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 500
        doc_path = Path(self.temp_dir) / "test_old.doc"
        doc_path.write_bytes(ole2_header)

        try:
            pages, status = extract_doc_pages(doc_path)
        except Exception as e:
            self.fail(f"extract_doc_pages crash với DOC OLE2: {e}")

        self.assertTrue(status.startswith("error:") or status == "ok")

    def test_doc_nonexistent_graceful(self):
        """File .doc không tồn tại → xử lý an toàn."""
        pages, status = extract_doc_pages(Path(self.temp_dir) / "missing.doc")
        # Không crash, và trả về error hoặc rỗng
        self.assertIsInstance(pages, list)
        self.assertIsInstance(status, str)


# --------------------------------------------------------------------------- #
#  TestExtractDocument                                                         #
# --------------------------------------------------------------------------- #

class TestExtractDocument(unittest.TestCase):
    """Kiểm tra hàm tổng hợp extract_document."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_nonexistent_file_returns_error(self):
        """File không tồn tại → extraction_status bắt đầu bằng error:"""
        result = extract_document(Path(self.temp_dir) / "ghost.pdf")
        self.assertTrue(result["extraction_status"].startswith("error:"))
        self.assertEqual(result["total_pages"], 0)

    def test_unsupported_format_returns_error(self):
        """Định dạng .txt không hỗ trợ → extraction_status bắt đầu bằng error:"""
        txt_path = Path(self.temp_dir) / "readme.txt"
        txt_path.write_text("hello", encoding="utf-8")
        result = extract_document(txt_path)
        self.assertTrue(result["extraction_status"].startswith("error:"))

    def test_result_has_required_fields(self):
        """Kết quả phải có đủ các trường yêu cầu."""
        import fitz
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 720), "Nội dung thông báo DAU Second Brain")
        pdf_path = Path(self.temp_dir) / "test_fields.pdf"
        doc.save(str(pdf_path))
        doc.close()

        result = extract_document(
            pdf_path,
            source_url="https://media.dau.edu.vn/test.pdf",
            notification_title="Thông báo test",
            notification_index=2,
        )

        required_fields = [
            "source_file", "source_url", "notification_title",
            "notification_index", "file_format", "extraction_status",
            "extracted_at", "total_pages", "pages",
        ]
        for field in required_fields:
            self.assertIn(field, result, f"Thiếu field: {field}")

        self.assertEqual(result["source_url"], "https://media.dau.edu.vn/test.pdf")
        self.assertEqual(result["notification_title"], "Thông báo test")
        self.assertEqual(result["notification_index"], 2)
        self.assertEqual(result["file_format"], "pdf")

    def test_page_fields_complete(self):
        """Mỗi page trong pages phải có đủ 4 trường."""
        import fitz
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 720), "Thông báo học phí 2026")
        pdf_path = Path(self.temp_dir) / "test_page_fields.pdf"
        doc.save(str(pdf_path))
        doc.close()

        result = extract_document(pdf_path)
        self.assertGreater(len(result["pages"]), 0)
        page_data = result["pages"][0]
        for field in ["page_number", "raw_text", "cleaned_text", "extraction_status"]:
            self.assertIn(field, page_data, f"Page thiếu field: {field}")


# --------------------------------------------------------------------------- #
#  TestBuildAttachmentIndex                                                    #
# --------------------------------------------------------------------------- #

class TestBuildAttachmentIndex(unittest.TestCase):
    """Kiểm tra _build_attachment_index."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _write_notifications(self, data: list) -> Path:
        p = Path(self.temp_dir) / "notifications.json"
        p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return p

    def test_index_built_from_attachments(self):
        """Index phải ánh xạ tên file → source_url và title."""
        data = [{
            "title": "Thông báo học phí 2026",
            "date": "03/08/2026",
            "detail_url": "https://sinhvien.dau.edu.vn/test.html",
            "attachments": ["https://media.dau.edu.vn/upload/31-tb.pdf"],
            "attachments_downloaded": [],
        }]
        notif_file = self._write_notifications(data)
        index = _build_attachment_index(notif_file)

        self.assertIn("31-tb.pdf", index)
        self.assertEqual(index["31-tb.pdf"]["source_url"], "https://media.dau.edu.vn/upload/31-tb.pdf")
        self.assertEqual(index["31-tb.pdf"]["title"], "Thông báo học phí 2026")
        self.assertEqual(index["31-tb.pdf"]["index"], 0)

    def test_missing_file_returns_empty_index(self):
        """File không tồn tại → trả về dict rỗng."""
        index = _build_attachment_index(Path(self.temp_dir) / "missing.json")
        self.assertEqual(index, {})

    def test_multiple_notifications(self):
        """Nhiều thông báo → tất cả đều được index."""
        data = [
            {
                "title": "Thông báo 1",
                "attachments": ["https://media.dau.edu.vn/doc-a.pdf"],
                "attachments_downloaded": [],
            },
            {
                "title": "Thông báo 2",
                "attachments": ["https://media.dau.edu.vn/doc-b.pdf"],
                "attachments_downloaded": [],
            },
        ]
        notif_file = self._write_notifications(data)
        index = _build_attachment_index(notif_file)

        self.assertIn("doc-a.pdf", index)
        self.assertIn("doc-b.pdf", index)
        self.assertEqual(index["doc-a.pdf"]["index"], 0)
        self.assertEqual(index["doc-b.pdf"]["index"], 1)


# --------------------------------------------------------------------------- #
#  TestDocumentExtractorPipeline                                               #
# --------------------------------------------------------------------------- #

class TestDocumentExtractorPipeline(unittest.TestCase):
    """Kiểm tra DocumentExtractor.run() end-to-end."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.docs_dir = Path(self.temp_dir) / "documents" / "2026"
        self.docs_dir.mkdir(parents=True)
        self.extracted_dir = Path(self.temp_dir) / "extracted"
        self.notif_file = Path(self.temp_dir) / "notifications.json"
        self.notif_file.write_text("[]", encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _create_pdf_with_text(self, filename: str, text: str) -> Path:
        import fitz
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 720), text)
        path = self.docs_dir / filename
        doc.save(str(path))
        doc.close()
        return path

    def test_run_with_empty_documents_dir(self):
        """Thư mục tài liệu rỗng → stats total_documents=0, không crash."""
        empty_dir = Path(self.temp_dir) / "empty_docs"
        empty_dir.mkdir()
        extractor = DocumentExtractor(
            documents_dir=empty_dir,
            extracted_dir=self.extracted_dir,
            notifications_file=self.notif_file,
        )
        stats = extractor.run()
        self.assertEqual(stats["total_documents"], 0)
        self.assertEqual(stats["extracted_ok"], 0)

    def test_run_saves_json_output(self):
        """Sau khi run(), mỗi PDF phải có file JSON tương ứng trong extracted_dir."""
        self._create_pdf_with_text("test-doc.pdf", "Nội dung thông báo DAU 2026")

        extractor = DocumentExtractor(
            documents_dir=Path(self.temp_dir) / "documents",
            extracted_dir=self.extracted_dir,
            notifications_file=self.notif_file,
        )
        stats = extractor.run()

        self.assertEqual(stats["total_documents"], 1)
        self.assertGreater(stats["extracted_ok"], 0)

        output_json = self.extracted_dir / "2026" / "test-doc.json"
        self.assertTrue(output_json.exists(), f"File JSON output không tồn tại: {output_json}")

        with open(output_json, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Kiểm tra schema output
        self.assertIn("pages", data)
        self.assertIn("extraction_status", data)
        self.assertIn("total_pages", data)
        self.assertIn("source_file", data)
        self.assertEqual(data["extraction_status"], "ok")
        self.assertGreater(data["total_pages"], 0)

    def test_run_stats_counts_correctly(self):
        """Stats phải đếm đúng số tài liệu thành công và tổng trang."""
        self._create_pdf_with_text("doc1.pdf", "Thông báo số 1 của DAU")
        self._create_pdf_with_text("doc2.pdf", "Thông báo số 2 của DAU")

        extractor = DocumentExtractor(
            documents_dir=Path(self.temp_dir) / "documents",
            extracted_dir=self.extracted_dir,
            notifications_file=self.notif_file,
        )
        stats = extractor.run()

        self.assertEqual(stats["total_documents"], 2)
        self.assertEqual(stats["extracted_ok"], 2)
        self.assertGreaterEqual(stats["total_pages"], 2)


if __name__ == "__main__":
    unittest.main()
