"""
Unit test cho module crawler/data_normalizer.py.

Kiểm tra:
1. Normalize thành công một document.
2. Không làm mất title.
3. Không làm mất source_url.
4. Không làm mất source_file.
5. Content lấy đúng từ OCR.
6. Page number được giữ nguyên.
7. Document không có metadata thì để null.
8. effective_status mặc định là unknown.
9. Không tự suy luận expired/effective.
10. Không ghép nhầm notification với PDF (strict matching).
11. Thiếu OCR phải tạo warning.
12. Output JSON đúng schema.
"""

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from crawler.data_normalizer import (
    DataNormalizer,
    extract_document_number_strict,
    extract_issuing_unit_strict,
    generate_document_id,
    match_notification_to_extracted,
    normalize_category_conservative,
    normalize_date_format,
    normalize_single_document,
)


class TestDataNormalizer(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.notif_file = Path(self.temp_dir) / "notifications.json"
        self.extracted_dir = Path(self.temp_dir) / "extracted"
        self.extracted_dir.mkdir(parents=True)
        self.normalized_dir = Path(self.temp_dir) / "normalized"
        self.details_dir = Path(self.temp_dir) / "details"
        self.details_dir.mkdir(parents=True)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_generate_document_id(self):
        id1 = generate_document_id("https://media.dau.edu.vn/doc1.pdf", "doc1.pdf", 0)
        id2 = generate_document_id("https://media.dau.edu.vn/doc1.pdf", "doc1.pdf", 0)
        id3 = generate_document_id("https://media.dau.edu.vn/doc2.pdf", "doc2.pdf", 1)
        self.assertTrue(id1.startswith("dau_doc_"))
        self.assertEqual(id1, id2)
        self.assertNotEqual(id1, id3)

    def test_normalize_date_format(self):
        self.assertEqual(normalize_date_format("28/08/2026"), "2026-08-28")
        self.assertEqual(normalize_date_format("03-08-2026"), "2026-08-03")
        self.assertIsNone(normalize_date_format(None))
        self.assertIsNone(normalize_date_format(""))

    def test_extract_document_number_strict(self):
        text = "TRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG\nSố: 43/TB-ĐHKTĐN\nNgày 28 tháng 8 năm 2026"
        self.assertEqual(extract_document_number_strict(text), "43/TB-ĐHKTĐN")
        self.assertIsNone(extract_document_number_strict("Văn bản không có số hiệu cụ thể"))

    def test_extract_issuing_unit_strict(self):
        text = "BỘ GIÁO DỤC VÀ ĐÀO TẠO\nTRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG\nTHÔNG BÁO"
        self.assertEqual(extract_issuing_unit_strict(text), "Trường Đại học Kiến trúc Đà Nẵng")
        self.assertIsNone(extract_issuing_unit_strict("Công ty TNHH Một Thành Viên"))

    def test_normalize_category_conservative(self):
        cat, subcat = normalize_category_conservative("Thông báo về việc nộp học phí học kỳ 1", "")
        self.assertEqual(cat, "Học phí")
        cat2, subcat2 = normalize_category_conservative("Thông báo chấm phúc khảo bài thi", "")
        self.assertEqual(cat2, "Khảo thí")
        cat3, subcat3 = normalize_category_conservative("Văn bản không xác định thể loại", "")
        self.assertIsNone(cat3)
        self.assertIsNone(subcat3)

    def test_effective_status_defaults_to_unknown(self):
        notif = {
            "title": "Thông báo kiểm tra học phí",
            "date": "10/10/2026",
            "detail_url": "https://sinhvien.dau.edu.vn/tin/tb1.html",
            "attachments": ["https://media.dau.edu.vn/doc1.pdf"],
        }
        doc, warnings = normalize_single_document(notif, None, index=0)
        self.assertEqual(doc["effective_status"], "unknown")
        self.assertIsNone(doc["effective_from"])
        self.assertIsNone(doc["effective_to"])
        self.assertIsNone(doc["replaced_by"])

    def test_normalize_single_document_preserves_all_core_fields(self):
        notif = {
            "title": "Thông báo tổ chức khảo sát năng lực Toán học",
            "date": "28/08/2026",
            "detail_url": "https://sinhvien.dau.edu.vn/tin/tb-toan.html",
            "attachments": ["https://media.dau.edu.vn/doc-toan.pdf"],
        }
        extracted_doc = {
            "source_file": "E:/data/doc-toan.pdf",
            "source_url": "https://media.dau.edu.vn/doc-toan.pdf",
            "file_format": "pdf",
            "total_pages": 2,
            "pages": [
                {
                    "page_number": 1,
                    "raw_text": "Trang 1 raw text",
                    "cleaned_text": "TRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG\nSố: 43/TB-ĐHKTĐN\nNội dung trang 1",
                },
                {
                    "page_number": 2,
                    "raw_text": "Trang 2 raw text",
                    "cleaned_text": "Nội dung trang 2",
                },
            ],
            "ocr_quality": {"score": 95, "label": "GOOD"},
        }

        doc, warnings = normalize_single_document(notif, extracted_doc, index=0)

        # Kiểm tra tính toàn vẹn
        self.assertEqual(doc["title"], notif["title"])
        self.assertEqual(doc["source_url"], "https://media.dau.edu.vn/doc-toan.pdf")
        self.assertEqual(doc["detail_url"], notif["detail_url"])
        self.assertEqual(doc["source_file"], "E:/data/doc-toan.pdf")
        self.assertEqual(doc["total_pages"], 2)
        self.assertEqual(len(doc["pages"]), 2)
        self.assertEqual(doc["pages"][0]["page_number"], 1)
        self.assertEqual(doc["pages"][1]["page_number"], 2)
        self.assertIn("Nội dung trang 1", doc["content"])
        self.assertIn("Nội dung trang 2", doc["content"])
        self.assertEqual(doc["document_number"], "43/TB-ĐHKTĐN")
        self.assertEqual(doc["issuing_unit"], "Trường Đại học Kiến trúc Đà Nẵng")
        self.assertEqual(doc["provenance"]["notification_index"], 0)

    def test_missing_ocr_produces_warning(self):
        notif = {
            "title": "Thông báo không có file đính kèm",
            "date": "01/01/2026",
            "detail_url": "https://sinhvien.dau.edu.vn/tin/tb-empty.html",
            "attachments": [],
        }
        doc, warnings = normalize_single_document(notif, None, index=0)
        self.assertTrue(any("không tìm thấy dữ liệu ocr" in w.lower() for w in warnings))
        self.assertEqual(doc["total_pages"], 0)
        self.assertEqual(doc["pages"], [])

    def test_match_notification_to_extracted_strict(self):
        notif = {
            "title": "Thông báo khảo sát",
            "attachments": ["https://media.dau.edu.vn/43-tb.pdf"],
            "attachments_downloaded": ["documents/2026/43-tb.pdf"],
        }
        extracted_list = [
            {
                "source_file": "E:/documents/2026/other.pdf",
                "source_url": "https://media.dau.edu.vn/other.pdf",
                "notification_title": "Khác",
            },
            {
                "source_file": "E:/documents/2026/43-tb.pdf",
                "source_url": "https://media.dau.edu.vn/43-tb.pdf",
                "notification_title": "Thông báo khảo sát",
            },
        ]
        matched = match_notification_to_extracted(notif, extracted_list, notif_index=0)
        self.assertIsNotNone(matched)
        self.assertEqual(matched["source_url"], "https://media.dau.edu.vn/43-tb.pdf")

    def test_data_normalizer_pipeline_end_to_end(self):
        notifs_data = [
            {
                "title": "Thông báo nộp học phí kỳ 1",
                "date": "03/08/2026",
                "detail_url": "https://sinhvien.dau.edu.vn/detail-hocphi.html",
                "attachments": ["https://media.dau.edu.vn/hocphi.pdf"],
                "attachments_downloaded": ["documents/2026/hocphi.pdf"],
            }
        ]
        with open(self.notif_file, "w", encoding="utf-8") as f:
            json.dump(notifs_data, f, ensure_ascii=False)

        extracted_sample = {
            "source_file": "documents/2026/hocphi.pdf",
            "source_url": "https://media.dau.edu.vn/hocphi.pdf",
            "notification_title": "Thông báo nộp học phí kỳ 1",
            "file_format": "pdf",
            "total_pages": 1,
            "pages": [
                {
                    "page_number": 1,
                    "raw_text": "TRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG\nSố: 31/TB-ĐHKTĐN\nNội dung học phí",
                    "cleaned_text": "TRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG\nSố: 31/TB-ĐHKTĐN\nNội dung học phí",
                }
            ],
        }
        extracted_file_path = self.extracted_dir / "hocphi.json"
        with open(extracted_file_path, "w", encoding="utf-8") as f:
            json.dump(extracted_sample, f, ensure_ascii=False)

        normalizer = DataNormalizer(
            notifications_file=self.notif_file,
            extracted_dir=self.extracted_dir,
            normalized_dir=self.normalized_dir,
            details_cache_dir=self.details_dir,
        )
        report = normalizer.run()

        self.assertEqual(report["total_notifications"], 1)
        self.assertEqual(report["total_documents_normalized"], 1)
        self.assertEqual(report["documents_matched_ocr"], 1)
        self.assertEqual(report["documents_missing_ocr"], 0)

        out_docs_file = self.normalized_dir / "documents.json"
        self.assertTrue(out_docs_file.exists())
        with open(out_docs_file, "r", encoding="utf-8") as f:
            docs = json.load(f)
        self.assertEqual(len(docs), 1)
        self.assertEqual(docs[0]["category"], "Học phí")
        self.assertEqual(docs[0]["document_number"], "31/TB-ĐHKTĐN")
        self.assertEqual(docs[0]["effective_status"], "unknown")
        self.assertEqual(docs[0]["provenance"]["notification_index"], 0)


if __name__ == "__main__":
    unittest.main()
