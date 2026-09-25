"""
Unit test cho module crawler/ocr_quality.py.

Kiểm tra:
- empty text detection
- short text detection
- suspicious character detection
- repeated character detection
- Vietnamese character detection
- legal pattern detection
- page-level metrics & score
- document-level metrics & score
- quality label mapping (GOOD, ACCEPTABLE, WARNING, POOR)
- report generation
- JSON serialization
- Unicode tiếng Việt xử lý an toàn
"""

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from crawler.ocr_quality import (
    OCRQualityEvaluator,
    compute_text_metrics,
    evaluate_document_quality,
    evaluate_page_quality,
)


class TestOCRQuality(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.extracted_dir = Path(self.temp_dir) / "extracted" / "2026"
        self.extracted_dir.mkdir(parents=True)
        self.report_path = Path(self.temp_dir) / "report.json"

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_compute_text_metrics_empty(self):
        metrics = compute_text_metrics("")
        self.assertEqual(metrics["text_length"], 0)
        self.assertEqual(metrics["non_whitespace_chars"], 0)
        self.assertEqual(metrics["vietnamese_character_ratio"], 0.0)

    def test_compute_text_metrics_vietnamese_and_legal_patterns(self):
        text = (
            "TRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG\n"
            "Số: 43/TB-ĐHKTĐN\n"
            "Thông báo về việc nộp học phí ngày 28/08/2026\n"
            "Mức học phí: 1.200.000 đồng/tín chỉ.\n"
            "Điều 1: Quy định chung. Khoản 2: Đối tượng áp dụng."
        )
        metrics = compute_text_metrics(text)
        self.assertGreater(metrics["vietnamese_character_ratio"], 0.05)
        self.assertIn("Số hiệu văn bản", metrics["detected_legal_patterns"])
        self.assertIn("Thông báo", metrics["detected_legal_patterns"])
        self.assertIn("Số tiền", metrics["detected_legal_patterns"])
        self.assertIn("Điều X", metrics["detected_legal_patterns"])
        self.assertIn("Khoản X", metrics["detected_legal_patterns"])

    def test_suspicious_characters_detection(self):
        text = "Văn bản có lỗi ~~~ ^^^ ||| {{{ }}} [[[ ]]] § © ®"
        metrics = compute_text_metrics(text)
        self.assertGreater(metrics["suspicious_character_ratio"], 0.20)

    def test_repeated_characters_detection(self):
        text = "Lặp ký tự bất thường: aaaaaaaaaaaaaa và bbbbbbbbbbb"
        metrics = compute_text_metrics(text)
        self.assertGreater(metrics["repeated_character_ratio"], 0.30)

    def test_evaluate_page_empty_returns_poor(self):
        score, label, warnings, metrics = evaluate_page_quality({"cleaned_text": "   "})
        self.assertEqual(score, 0)
        self.assertEqual(label, "POOR")
        self.assertTrue(any("rỗng" in w.lower() for w in warnings))

    def test_evaluate_page_good(self):
        text = (
            "TRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG\n"
            "Số: 31/TB-ĐHKTĐN\n"
            "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\n"
            "Độc lập - Tự do - Hạnh phúc\n\n"
            "THÔNG BÁO\n"
            "Về việc nộp học phí và bảo hiểm y tế năm học 2026-2027 đối với sinh viên.\n"
            "Căn cứ quyết định số 123/QĐ-ĐHKTĐN ngày 15 tháng 08 năm 2026.\n"
            "Điều 1. Mức thu học phí đối với các học phần lý thuyết là 500.000 đồng.\n"
            "Khoản 1. Thời hạn nộp học phí đến hết ngày 30/09/2026."
        )
        score, label, warnings, metrics = evaluate_page_quality({"cleaned_text": text})
        self.assertGreaterEqual(score, 70)
        self.assertIn(label, ("GOOD", "ACCEPTABLE"))

    def test_evaluate_document_quality(self):
        doc = {
            "source_file": "test.pdf",
            "notification_title": "Test Title",
            "total_pages": 1,
            "pages": [
                {
                    "page_number": 1,
                    "cleaned_text": "Thông báo nộp học phí số: 43/TB-ĐHKTĐN ngày 28/08/2026 với số tiền 1.000.000 đồng.",
                }
            ],
        }
        res = evaluate_document_quality(doc)
        self.assertIn("score", res)
        self.assertIn("label", res)
        self.assertIn("metrics", res)
        self.assertEqual(res["metrics"]["empty_page_ratio"], 0.0)

    def test_pipeline_run_generates_report(self):
        doc_json_path = self.extracted_dir / "sample.json"
        doc = {
            "source_file": "sample.pdf",
            "notification_title": "Thông báo mẫu",
            "total_pages": 1,
            "pages": [
                {
                    "page_number": 1,
                    "cleaned_text": "Thông báo khảo sát tiếng Việt có dấu đầy đủ và chuẩn xác.",
                }
            ],
        }
        with open(doc_json_path, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False)

        evaluator = OCRQualityEvaluator(
            extracted_dir=Path(self.temp_dir) / "extracted",
            report_output_path=self.report_path,
        )
        report = evaluator.run()

        self.assertTrue(self.report_path.exists())
        self.assertEqual(report["summary"]["total_documents"], 1)

        # Kiểm tra file json tài liệu được cập nhật ocr_quality
        with open(doc_json_path, "r", encoding="utf-8") as f:
            updated_doc = json.load(f)
        self.assertIn("ocr_quality", updated_doc)
        self.assertIn("score", updated_doc["ocr_quality"])


if __name__ == "__main__":
    unittest.main()
