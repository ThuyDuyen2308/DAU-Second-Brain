"""
Unit test cho module crawler/data_quality.py.

Kiểm tra tối thiểu 15 yêu cầu:
1. documents.json đọc được
2. tất cả document có document_id
3. title được kiểm tra
4. source_url được kiểm tra
5. source_file được kiểm tra
6. content được kiểm tra
7. total_pages khớp pages
8. page OCR quá ngắn được cảnh báo
9. effective_status unknown được chấp nhận
10. document_number null không làm crash (chỉ warning)
11. duplicate detection hoạt động
12. provenance được kiểm tra
13. report được tạo đúng schema
14. summary tính đúng
15. score nằm trong 0-100
"""

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from crawler.data_quality import (
    DataQualityValidator,
    calculate_quality_score,
    validate_document,
)


class TestDataQuality(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.doc_file = Path(self.temp_dir) / "documents.json"
        self.report_file = Path(self.temp_dir) / "data_quality_report.json"
        self.dummy_pdf = Path(self.temp_dir) / "dummy.pdf"
        self.dummy_pdf.write_text("dummy pdf content", encoding="utf-8")

        self.valid_doc = {
            "id": "dau_doc_test01",
            "title": "Thông báo tổ chức khảo sát năng lực Toán học năm 2026",
            "document_number": "43/TB-ĐHKTĐN",
            "issue_date": "2026-08-28",
            "issuing_unit": "Trường Đại học Kiến trúc Đà Nẵng",
            "category": "Khảo sát",
            "subcategory": "Khảo sát sinh viên",
            "deadline": None,
            "effective_status": "unknown",
            "effective_from": None,
            "effective_to": None,
            "replaced_by": None,
            "source_url": "https://media.dau.edu.vn/doc.pdf",
            "detail_url": "https://sinhvien.dau.edu.vn/doc.html",
            "source_file": str(self.dummy_pdf.resolve()),
            "file_format": "pdf",
            "total_pages": 1,
            "content": "TRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG\nSố: 43/TB-ĐHKTĐN\nNgày 28 tháng 8 năm 2026.\nThông báo tổ chức khảo sát năng lực Toán học cho sinh viên khóa tuyển sinh năm 2026.",
            "pages": [
                {
                    "page_number": 1,
                    "raw_text": "...",
                    "cleaned_text": "TRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG\nSố: 43/TB-ĐHKTĐN\nNgày 28 tháng 8 năm 2026.\nThông báo tổ chức khảo sát năng lực Toán học cho sinh viên khóa tuyển sinh năm 2026.",
                }
            ],
            "attachments": ["https://media.dau.edu.vn/doc.pdf"],
            "metadata": {},
            "provenance": {
                "notification_index": 0,
                "notification_title": "Thông báo tổ chức khảo sát năng lực Toán học",
                "detail_file": "detail.html",
                "document_file": str(self.dummy_pdf.resolve()),
                "extracted_file": "extracted.json",
            },
        }

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_1_and_2_documents_json_readable_and_ids_present(self):
        with open(self.doc_file, "w", encoding="utf-8") as f:
            json.dump([self.valid_doc], f, ensure_ascii=False)

        validator = DataQualityValidator(
            documents_file=self.doc_file,
            report_file=self.report_file,
            check_filesystem=True,
        )
        report = validator.run()
        self.assertEqual(report["summary"]["total_documents"], 1)
        self.assertEqual(report["documents"][0]["document_id"], "dau_doc_test01")

    def test_3_title_validation(self):
        bad_doc = dict(self.valid_doc)
        bad_doc["title"] = ""
        checks, issues, warnings = validate_document(
            bad_doc, set(), set(), set(), check_filesystem=False
        )
        self.assertFalse(checks["title"])
        self.assertTrue(any("TITLE" in i for i in issues))

    def test_4_source_url_validation(self):
        bad_doc = dict(self.valid_doc)
        bad_doc["source_url"] = "   "
        checks, issues, warnings = validate_document(
            bad_doc, set(), set(), set(), check_filesystem=False
        )
        self.assertFalse(checks["source_url"])
        self.assertTrue(any("SOURCE URL" in i for i in issues))

    def test_5_source_file_validation(self):
        bad_doc = dict(self.valid_doc)
        bad_doc["source_file"] = "C:/non_existent/file.pdf"
        checks, issues, warnings = validate_document(
            bad_doc, set(), set(), set(), check_filesystem=True
        )
        self.assertFalse(checks["source_file"])
        self.assertTrue(any("SOURCE FILE" in i for i in issues))

    def test_6_content_validation(self):
        empty_doc = dict(self.valid_doc)
        empty_doc["content"] = ""
        checks, issues, warnings = validate_document(
            empty_doc, set(), set(), set(), check_filesystem=False
        )
        self.assertFalse(checks["content"])
        self.assertTrue(any("CONTENT" in i for i in issues))

        short_doc = dict(self.valid_doc)
        short_doc["content"] = "Quá ngắn"
        checks, issues, warnings = validate_document(
            short_doc, set(), set(), set(), check_filesystem=False
        )
        self.assertFalse(checks["content"])
        self.assertTrue(any("CONTENT" in w for w in warnings))

    def test_7_total_pages_matches_pages_list(self):
        bad_doc = dict(self.valid_doc)
        bad_doc["total_pages"] = 5  # nhưng pages chỉ có 1 phần tử
        checks, issues, warnings = validate_document(
            bad_doc, set(), set(), set(), check_filesystem=False
        )
        self.assertFalse(checks["page_count"])
        self.assertTrue(any("SỐ TRANG" in i for i in issues))

    def test_8_page_ocr_too_short_warned(self):
        bad_doc = dict(self.valid_doc)
        bad_doc["pages"] = [{"page_number": 1, "cleaned_text": "ngắn"}]
        checks, issues, warnings = validate_document(
            bad_doc, set(), set(), set(), check_filesystem=False
        )
        self.assertFalse(checks["ocr_text"])
        self.assertTrue(any("quá ít text" in w.lower() for w in warnings))

    def test_9_effective_status_unknown_accepted(self):
        checks, issues, warnings = validate_document(
            self.valid_doc, set(), set(), set(), check_filesystem=False
        )
        self.assertTrue(checks["effective_status"])

        bad_doc = dict(self.valid_doc)
        bad_doc["effective_status"] = "effective"
        checks, issues, warnings = validate_document(
            bad_doc, set(), set(), set(), check_filesystem=False
        )
        self.assertFalse(checks["effective_status"])
        self.assertTrue(any("EFFECTIVE STATUS" in w for w in warnings))

    def test_10_document_number_null_handled_without_crash(self):
        doc = dict(self.valid_doc)
        doc["document_number"] = None
        checks, issues, warnings = validate_document(
            doc, set(), set(), set(), check_filesystem=False
        )
        self.assertFalse(checks["document_number"])
        self.assertTrue(any("DOCUMENT NUMBER" in w for w in warnings))
        self.assertEqual(len(issues), 0)

    def test_11_duplicate_detection(self):
        seen_ids = {"dau_doc_test01"}
        seen_urls = set()
        seen_files = set()
        checks, issues, warnings = validate_document(
            self.valid_doc, seen_ids, seen_urls, seen_files, check_filesystem=False
        )
        self.assertFalse(checks["duplicate"])
        self.assertTrue(any("DUPLICATE" in w for w in warnings))

    def test_12_provenance_validation(self):
        bad_doc = dict(self.valid_doc)
        bad_doc["provenance"] = {}  # Thiếu các trường cần thiết
        checks, issues, warnings = validate_document(
            bad_doc, set(), set(), set(), check_filesystem=False
        )
        self.assertFalse(checks["provenance"])
        self.assertTrue(any("PROVENANCE" in w for w in warnings))

    def test_13_and_14_report_schema_and_summary_counts(self):
        with open(self.doc_file, "w", encoding="utf-8") as f:
            json.dump([self.valid_doc], f, ensure_ascii=False)

        validator = DataQualityValidator(
            documents_file=self.doc_file,
            report_file=self.report_file,
            check_filesystem=True,
        )
        report = validator.run()

        self.assertTrue(self.report_file.exists())
        self.assertIn("generated_at", report)
        self.assertIn("summary", report)
        self.assertIn("documents", report)

        sm = report["summary"]
        self.assertEqual(sm["total_documents"], 1)
        self.assertEqual(sm["good"], 1)
        self.assertEqual(sm["warning"], 0)
        self.assertEqual(sm["error"], 0)

    def test_15_score_bounds_and_calculation(self):
        score_good, status_good = calculate_quality_score([], [])
        self.assertEqual(score_good, 100)
        self.assertEqual(status_good, "GOOD")

        score_warn, status_warn = calculate_quality_score([], ["warn 1", "warn 2"])
        self.assertEqual(score_warn, 90)
        self.assertEqual(status_warn, "WARNING")

        score_err, status_err = calculate_quality_score(["err 1"], [])
        self.assertEqual(score_err, 75)
        self.assertEqual(status_err, "ERROR")

        # Giới hạn 0 - 100
        score_min, _ = calculate_quality_score(["err"] * 10, ["warn"] * 10)
        self.assertEqual(score_min, 0)


if __name__ == "__main__":
    unittest.main()
