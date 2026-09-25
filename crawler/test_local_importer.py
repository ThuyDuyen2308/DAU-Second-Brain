"""
Unit tests cho module nhập dữ liệu cục bộ (LocalImporter)
Kiểm tra khả năng đọc các file HTML từ thư mục input, trích xuất 4 trường bắt buộc
(title, date, detail_url, attachments) và xuất ra file JSON.
"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

# Đảm bảo import được package crawler khi chạy trực tiếp file test
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from crawler.local_importer import LocalImporter

SAMPLE_LIST_HTML = """
<!DOCTYPE html>
<html>
<head><title>Danh mục thông báo sinh viên</title></head>
<body>
    <table class="table">
        <tbody>
            <tr>
                <td>1</td>
                <td>
                    <a href="/sinh-vien/chi-tiet-tin/thong-bao-hoc-bong-ky-1.html">
                        Thông báo về việc xét cấp học bổng khuyến khích học tập học kỳ 1
                    </a>
                </td>
                <td>15/09/2024</td>
            </tr>
            <tr>
                <td>2</td>
                <td>
                    <a href="/sinh-vien/chi-tiet-tin/lich-thi-hoc-ky.html">
                        Lịch thi kết thúc học phần đợt 1 năm học 2024 - 2025
                    </a>
                </td>
                <td>20/09/2024 09:15</td>
            </tr>
        </tbody>
    </table>
</body>
</html>
"""

SAMPLE_DETAIL_HTML = """
<!DOCTYPE html>
<html>
<head><title>Chi tiết thông báo</title></head>
<body>
    <h1>Thông báo về việc xét cấp học bổng khuyến khích học tập học kỳ 1</h1>
    <div class="date">15/09/2024</div>
    <div class="content">
        <p>Danh sách sinh viên được nhận học bổng đính kèm bên dưới:</p>
        <div class="attachments">
            <a href="/Upload/ThongBao/DanhSachHocBong_HK1.pdf">1. DanhSachHocBong_HK1.pdf</a>
            <a href="/Upload/ThongBao/BieuMauKhieuNai.docx">2. BieuMauKhieuNai.docx</a>
        </div>
    </div>
</body>
</html>
"""

SAMPLE_LOGIN_HTML = """
<!DOCTYPE html>
<html>
<head><title>Đăng nhập hệ thống</title></head>
<body>
    <form action="/sinh-vien-dang-nhap.html" method="post">
        <input type="text" name="UserName" />
        <input type="password" name="Password" />
        <button type="submit">Đăng nhập</button>
    </form>
</body>
</html>
"""

class TestLocalImporter(unittest.TestCase):

    def setUp(self):
        # Tạo thư mục tạm để chạy test an toàn không ảnh hưởng tới dữ liệu thật
        self.temp_dir = tempfile.TemporaryDirectory()
        self.input_dir = Path(self.temp_dir.name) / "input"
        self.input_dir.mkdir(parents=True, exist_ok=True)
        self.output_file = Path(self.temp_dir.name) / "data" / "notifications.json"

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_import_empty_directory(self):
        importer = LocalImporter(input_dir=self.input_dir, output_file=self.output_file)
        results = importer.import_and_save()
        self.assertEqual(results, [])
        self.assertTrue(self.output_file.exists())
        with open(self.output_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertEqual(data, [])

    def test_import_from_list_html(self):
        list_file = self.input_dir / "thong-bao-trang-1.html"
        list_file.write_text(SAMPLE_LIST_HTML, encoding="utf-8")

        importer = LocalImporter(input_dir=self.input_dir, output_file=self.output_file)
        results = importer.import_and_save()

        self.assertEqual(len(results), 2)
        
        item1 = results[0]
        self.assertEqual(item1["title"], "Thông báo về việc xét cấp học bổng khuyến khích học tập học kỳ 1")
        self.assertEqual(item1["date"], "15/09/2024")
        self.assertEqual(item1["detail_url"], "https://sinhvien.dau.edu.vn/sinh-vien/chi-tiet-tin/thong-bao-hoc-bong-ky-1.html")
        self.assertEqual(item1["attachments"], [])

        item2 = results[1]
        self.assertEqual(item2["date"], "20/09/2024 09:15")

    def test_import_with_detail_html_enrichment(self):
        # Đặt cả trang danh sách và trang chi tiết vào thư mục input
        (self.input_dir / "list.html").write_text(SAMPLE_LIST_HTML, encoding="utf-8")
        (self.input_dir / "detail_hocbong.html").write_text(SAMPLE_DETAIL_HTML, encoding="utf-8")

        importer = LocalImporter(input_dir=self.input_dir, output_file=self.output_file)
        results = importer.import_and_save()

        self.assertEqual(len(results), 2)
        # Thông báo học bổng phải được bổ sung các file đính kèm từ trang chi tiết
        hocbong_notif = next(it for it in results if "học bổng" in it["title"].lower())
        self.assertEqual(len(hocbong_notif["attachments"]), 2)
        self.assertIn("https://sinhvien.dau.edu.vn/Upload/ThongBao/DanhSachHocBong_HK1.pdf", hocbong_notif["attachments"])
        self.assertIn("https://sinhvien.dau.edu.vn/Upload/ThongBao/BieuMauKhieuNai.docx", hocbong_notif["attachments"])

    def test_output_json_schema(self):
        list_file = self.input_dir / "page.html"
        list_file.write_text(SAMPLE_LIST_HTML, encoding="utf-8")

        importer = LocalImporter(input_dir=self.input_dir, output_file=self.output_file)
        importer.import_and_save()

        with open(self.output_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)
        for item in data:
            self.assertIn("title", item)
            self.assertIn("date", item)
            self.assertIn("detail_url", item)
            self.assertIn("attachments", item)
            self.assertIsInstance(item["attachments"], list)

    def test_unauthenticated_page_ignored_gracefully(self):
        login_file = self.input_dir / "login.html"
        login_file.write_text(SAMPLE_LOGIN_HTML, encoding="utf-8")

        importer = LocalImporter(input_dir=self.input_dir, output_file=self.output_file)
        results = importer.scan_and_import()
        self.assertEqual(results, [])


if __name__ == "__main__":
    unittest.main()
