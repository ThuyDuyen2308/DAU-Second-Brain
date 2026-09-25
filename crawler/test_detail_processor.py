"""
Unit tests cho module xử lý trang chi tiết (DetailProcessor)
Kiểm tra:
1. Lọc bỏ các bản ghi không phải thông báo (&nbspTin tức, link menu/điều hướng).
2. Logic đối sánh CHÍNH XÁC (strict matching): không ghép nhầm nội dung khi chỉ trùng một vài từ khóa (như 'học phí').
3. Chuẩn hóa và khử trùng lặp file đính kèm: URL trực tiếp vs URL qua FileManager/ViewFileOnline.
"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

# Đảm bảo import được package crawler
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from crawler.detail_processor import DetailProcessor, normalize_title_for_comparison, is_valid_announcement_record
from crawler.parser import normalize_attachment_url, parse_announcement_detail

SAMPLE_DETAIL_TOAN_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Thông báo tổ chức khảo sát năng lực Toán học cho sinh viên khóa tuyển sinh năm 2026</title>
</head>
<body>
    <header class="header"><div class="menu">Trang chủ</div></header>
    <div class="portlet-body detail-Tin">
        <h1 class="title">Thông báo tổ chức khảo sát năng lực Toán học cho sinh viên khóa tuyển sinh năm 2026.</h1>
        <div class="date-time">Ngày đăng: 28/08/2026</div>
        <div class="post-content">
            <p>Trường Đại học Kiến trúc Đà Nẵng thông báo kế hoạch khảo sát năng lực Toán học như sau:</p>
            <p>1. Đối tượng tham gia: Toàn bộ tân sinh viên khóa 2026.</p>
            <p>2. Thời gian và địa điểm: Xem chi tiết trong danh sách đính kèm.</p>
            <div class="attachment-box">
                <h4>Tài liệu đính kèm:</h4>
                <a href="/Upload/ThongBao/KeHoachKhaoSatToan2026.pdf">1. Kế hoạch khảo sát Toán (KeHoachKhaoSatToan2026.pdf)</a>
                <a href="/FileManager/ViewFileOnline?filePath=/Upload/ThongBao/KeHoachKhaoSatToan2026.pdf&fileName=KeHoachKhaoSatToan2026.pdf">Xem online</a>
                <a href="https://media.dau.edu.vn//Media\\2_SVDAU\\FolderFunc\\202608\\Documents/DanhSachPhongThi.docx">2. Danh sách phòng thi (DanhSachPhongThi.docx)</a>
            </div>
        </div>
    </div>
    <div class="notification2">
        <div class="desc-txt">Tin tức liên quan khác không được tính là nội dung bài viết</div>
    </div>
    <footer class="footer">Bản quyền thuộc DAU</footer>
</body>
</html>
"""

# Trang chi tiết về chương trình kiến trúc - không thuộc danh sách
SAMPLE_DETAIL_KIEN_TRUC_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Về mức thu học phí theo chương trình Kiến trúc - Kiến tạo trong học kỳ 1 năm học 2026-2027</title>
</head>
<body>
    <div class="portlet-body detail-Tin">
        <h1 class="title">Về mức thu học phí theo chương trình Kiến trúc - Kiến tạo trong học kỳ 1 năm học 2026-2027</h1>
        <div class="content">
            <p>Quy định mức thu học phí chương trình kiến trúc kiến tạo.</p>
            <a href="https://media.dau.edu.vn//Media\\2_SVDAU\\Documents/qd-hoc-phi.pdf">Tải về</a>
            <a href="/FileManager/ViewFileOnline?filePath=https://media.dau.edu.vn//Media\\2_SVDAU\\Documents/qd-hoc-phi.pdf&fileName=qd.pdf">Xem online</a>
        </div>
    </div>
</body>
</html>
"""

class TestDetailProcessorIssues(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.details_dir = Path(self.temp_dir.name) / "details"
        self.details_dir.mkdir(parents=True, exist_ok=True)
        self.notif_file = Path(self.temp_dir.name) / "notifications.json"

        # Khởi tạo mock notifications.json chứa cả bản ghi điều hướng và 2 thông báo thật
        self.mock_notifications = [
            {
                "title": "&nbspTin tức",
                "date": "",
                "detail_url": "https://sinhvien.dau.edu.vn/sinh-vien-tin-tuc-thong-bao.html",
                "attachments": [],
                "content": ""
            },
            {
                "title": "Thông báo tổ chức khảo sát năng lực Toán học cho sinh viên khóa tuyển sinh năm 2026. - 28/08/2026",
                "date": "28/08/2026",
                "detail_url": "https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-to-chuc-khao-sat-nang-luc-toan-hoc-cho-sinh-vien-khoa-tuyen-sinh-nam-2026.html",
                "attachments": [],
                "content": ""
            },
            {
                "title": "Thông báo về việc nộp học phí và bảo hiểm trong học kỳ I năm học 2026-2027 đối với sinh viên các khóa đang theo học tại trường - 03/08/2026",
                "date": "03/08/2026",
                "detail_url": "https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-ve-viec-nop-hoc-phi-va-bao-hiem-trong-hoc-ky-i-nam-hoc-2026-2027-doi-voi-sinh-vien-cac-khoa-dang-theo-hoc-tai-truong.html",
                "attachments": [],
                "content": ""
            }
        ]
        with open(self.notif_file, "w", encoding="utf-8") as f:
            json.dump(self.mock_notifications, f, ensure_ascii=False, indent=2)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_issue_1_filter_navigation_record(self):
        """Vấn đề 1: Đảm bảo bản ghi điều hướng '&nbspTin tức' bị loại khỏi notifications."""
        processor = DetailProcessor(details_dir=self.details_dir, notifications_file=self.notif_file)
        notifications = processor.load_notifications()

        # Ban đầu có 3 mục, sau khi lọc phải còn 2 mục hợp lệ
        self.assertEqual(len(notifications), 2)
        urls = [item["detail_url"] for item in notifications]
        self.assertNotIn("https://sinhvien.dau.edu.vn/sinh-vien-tin-tuc-thong-bao.html", urls)
        titles = [item["title"] for item in notifications]
        self.assertNotIn("&nbspTin tức", titles)

    def test_issue_2_strict_matching_no_mismatched_content(self):
        """Vấn đề 2: Không được ghép nội dung của trang chi tiết khác dù có chung từ khóa 'học phí'."""
        processor = DetailProcessor(details_dir=self.details_dir, notifications_file=self.notif_file)
        notifications = processor.load_notifications()

        # Đặt file chi tiết 'Về mức thu học phí theo chương trình Kiến trúc - Kiến tạo...'
        file_path = self.details_dir / "Về mức thu học phí theo chương trình Kiến trúc - Kiến tạo trong học kỳ 1 năm học 2026-2027.html"
        file_path.write_text(SAMPLE_DETAIL_KIEN_TRUC_HTML, encoding="utf-8")

        detail_info = processor.process_single_file(file_path)
        matched_idx = processor.match_detail_to_notification(detail_info, file_path, notifications)

        # Vì không có trong danh sách notifications và không trùng slug/title chính xác -> Phải trả về -1 (không khớp)
        self.assertEqual(matched_idx, -1)

        # Chạy process_all_details -> Thông báo về 'nộp học phí và bảo hiểm' không được bị thay đổi content
        updated_items = processor.process_all_details(save=True)
        hocphi_notif = next(it for it in updated_items if "bảo hiểm" in it["title"].lower())
        self.assertEqual(hocphi_notif["content"], "")
        self.assertEqual(hocphi_notif["attachments"], [])

    def test_issue_2_exact_slug_and_title_matching_success(self):
        """Vấn đề 2: Khi slug hoặc title chính xác thì ghép đúng thông báo tương ứng."""
        processor = DetailProcessor(details_dir=self.details_dir, notifications_file=self.notif_file)
        notifications = processor.load_notifications()

        # File có slug trùng với thông báo Toán học
        file_path = self.details_dir / "thong-bao-to-chuc-khao-sat-nang-luc-toan-hoc-cho-sinh-vien-khoa-tuyen-sinh-nam-2026.html"
        file_path.write_text(SAMPLE_DETAIL_TOAN_HTML, encoding="utf-8")

        detail_info = processor.process_single_file(file_path)
        matched_idx = processor.match_detail_to_notification(detail_info, file_path, notifications)

        # Phải khớp với thông báo Toán học (vị trí 0 trong danh sách đã lọc)
        self.assertEqual(matched_idx, 0)
        self.assertIn("Toán học", notifications[matched_idx]["title"])

    def test_issue_3_attachment_deduplication(self):
        """Vấn đề 3: Khử trùng lặp link PDF trực tiếp và link qua FileManager/ViewFileOnline."""
        processor = DetailProcessor(details_dir=self.details_dir, notifications_file=self.notif_file)
        file_path = self.details_dir / "thong-bao-to-chuc-khao-sat-nang-luc-toan-hoc-cho-sinh-vien-khoa-tuyen-sinh-nam-2026.html"
        file_path.write_text(SAMPLE_DETAIL_TOAN_HTML, encoding="utf-8")

        detail_info = processor.process_single_file(file_path)
        attachments = detail_info["attachments"]

        # File mẫu có 3 link trong HTML: 1 PDF trực tiếp, 1 PDF qua ViewFileOnline, và 1 DOCX
        # Sau khi khử trùng lặp, chỉ còn 2 file duy nhất: 1 PDF và 1 DOCX
        self.assertEqual(len(attachments), 2)
        # Link PDF phải là link tải trực tiếp, không còn chứa ViewFileOnline
        self.assertTrue(any(att.endswith("KeHoachKhaoSatToan2026.pdf") for att in attachments))
        self.assertFalse(any("ViewFileOnline" in att for att in attachments))
        # Link DOCX phải được chuẩn hóa bỏ dấu gạch chéo ngược
        self.assertIn("https://media.dau.edu.vn/Media/2_SVDAU/FolderFunc/202608/Documents/DanhSachPhongThi.docx", attachments)


if __name__ == "__main__":
    unittest.main()
