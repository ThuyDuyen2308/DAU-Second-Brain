"""
Unit tests để kiểm tra độ chính xác của bộ phân tích cú pháp (Parser)
Kiểm tra khả năng bóc tách: Tiêu đề, Ngày, URL chi tiết, File đính kèm (.pdf, .doc, .docx)
"""

import unittest
from crawler.parser import (
    parse_announcement_list,
    parse_announcement_detail,
    is_login_required,
    AuthenticationRequiredError,
)

SAMPLE_TABLE_HTML = """
<!DOCTYPE html>
<html>
<head><title>Danh mục thông báo</title></head>
<body>
    <table class="table-content">
        <thead>
            <tr><th>STT</th><th>Tiêu đề</th><th>Ngày đăng</th></tr>
        </thead>
        <tbody>
            <tr>
                <td>1</td>
                <td>
                    <a href="/sinh-vien/chi-tiet-tin/thong-bao-hoc-phi-hk1-2024-2025.html">
                        Thông báo về việc thu học phí học kỳ 1 năm học 2024 - 2025
                    </a>
                </td>
                <td>15/08/2024</td>
            </tr>
            <tr>
                <td>2</td>
                <td>
                    <a href="/sinh-vien/chi-tiet-tin/thong-bao-xet-hoc-bong-khuyen-khich.html">
                        Thông báo v/v xét cấp học bổng khuyến khích học tập học kỳ 2
                    </a>
                </td>
                <td>20/08/2024 14:30</td>
            </tr>
        </tbody>
    </table>
</body>
</html>
"""

SAMPLE_CARD_HTML = """
<!DOCTYPE html>
<html>
<head><title>Danh mục thông báo</title></head>
<body>
    <div class="news-list">
        <div class="tin-tuc-item">
            <h4 class="title">
                <a href="/sinh-vien/chi-tiet-tin/lich-thi-tot-nghiep-dot-2.html">
                    Thông báo kế hoạch tổ chức thi tốt nghiệp đợt 2 năm 2024
                </a>
            </h4>
            <span class="date"><i class="fa fa-calendar"></i> 05/09/2024</span>
        </div>
    </div>
</body>
</html>
"""

SAMPLE_DETAIL_HTML = """
<!DOCTYPE html>
<html>
<head><title>Chi tiết thông báo</title></head>
<body>
    <div class="main-content">
        <h1 class="page-title">Thông báo về việc thu học phí học kỳ 1 năm học 2024 - 2025</h1>
        <div class="meta-date">Ngày đăng: 15/08/2024</div>
        <div class="article-body">
            <p>Trường Đại học Kiến trúc Đà Nẵng thông báo đến toàn thể sinh viên kế hoạch thu học phí...</p>
            <div class="attachments-section">
                <h4>Văn bản đính kèm:</h4>
                <ul>
                    <li><a href="/Upload/ThongBao/KeHoachThuHocPhi_HK1.pdf">1. Kế hoạch thu học phí (KeHoachThuHocPhi_HK1.pdf)</a></li>
                    <li><a href="/Upload/ThongBao/BieuMauGiaHan.docx">2. Mẫu đơn xin gia hạn nộp học phí (BieuMauGiaHan.docx)</a></li>
                    <li><a href="/Upload/ThongBao/HuongDanThanhToan.doc">3. Hướng dẫn chuyển khoản ngân hàng (HuongDanThanhToan.doc)</a></li>
                </ul>
            </div>
            <iframe src="/Upload/ThongBao/XemTruocThongBao.pdf" width="100%" height="500"></iframe>
        </div>
    </div>
</body>
</html>
"""

SAMPLE_LOGIN_PAGE_HTML = """
<!DOCTYPE html>
<html>
<head><title>Đăng nhập hệ thống</title></head>
<body>
    <div class="login-box">
        <form action="/sinh-vien-dang-nhap.html" method="post">
            <input type="text" name="UserName" placeholder="Mã sinh viên" />
            <input type="password" name="Password" placeholder="Mật khẩu" />
            <input type="text" name="Captcha" placeholder="Mã xác nhận" />
            <button type="submit">Đăng nhập</button>
        </form>
    </div>
</body>
</html>
"""

class TestCrawlerParser(unittest.TestCase):

    def test_parse_announcement_list_table_format(self):
        items = parse_announcement_list(SAMPLE_TABLE_HTML, base_url="https://sinhvien.dau.edu.vn")
        self.assertEqual(len(items), 2)
        
        item1 = items[0]
        self.assertEqual(item1["title"], "Thông báo về việc thu học phí học kỳ 1 năm học 2024 - 2025")
        self.assertEqual(item1["date"], "15/08/2024")
        self.assertEqual(item1["detail_url"], "https://sinhvien.dau.edu.vn/sinh-vien/chi-tiet-tin/thong-bao-hoc-phi-hk1-2024-2025.html")
        self.assertEqual(item1["attachments"], [])

        item2 = items[1]
        self.assertEqual(item2["date"], "20/08/2024 14:30")

    def test_parse_announcement_list_card_format(self):
        items = parse_announcement_list(SAMPLE_CARD_HTML, base_url="https://sinhvien.dau.edu.vn")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["title"], "Thông báo kế hoạch tổ chức thi tốt nghiệp đợt 2 năm 2024")
        self.assertEqual(items[0]["date"], "05/09/2024")
        self.assertEqual(items[0]["detail_url"], "https://sinhvien.dau.edu.vn/sinh-vien/chi-tiet-tin/lich-thi-tot-nghiep-dot-2.html")

    def test_parse_announcement_detail_attachments(self):
        detail = parse_announcement_detail(SAMPLE_DETAIL_HTML, base_url="https://sinhvien.dau.edu.vn")
        attachments = detail["attachments"]
        
        # Phải phát hiện đủ các link PDF, DOC, DOCX và cả iframe PDF
        expected_urls = [
            "https://sinhvien.dau.edu.vn/Upload/ThongBao/KeHoachThuHocPhi_HK1.pdf",
            "https://sinhvien.dau.edu.vn/Upload/ThongBao/BieuMauGiaHan.docx",
            "https://sinhvien.dau.edu.vn/Upload/ThongBao/HuongDanThanhToan.doc",
            "https://sinhvien.dau.edu.vn/Upload/ThongBao/XemTruocThongBao.pdf",
        ]
        for url in expected_urls:
            self.assertIn(url, attachments)

    def test_attachment_with_query_params_and_relative_path(self):
        html = """
        <div>
            <a href="../files/quyet-dinh.PDF?version=2">Tải quyết định</a>
            <a href="/api/download?file=danh-sach.xlsx">Danh sách đính kèm</a>
            <a href="https://media.dau.edu.vn/files/huong-dan.docx">Hướng dẫn</a>
        </div>
        """
        detail = parse_announcement_detail(html, base_url="https://sinhvien.dau.edu.vn/sinh-vien/chi-tiet-tin/")
        self.assertEqual(len(detail["attachments"]), 3)
        self.assertIn("https://sinhvien.dau.edu.vn/sinh-vien/files/quyet-dinh.PDF?version=2", detail["attachments"])
        self.assertIn("https://sinhvien.dau.edu.vn/api/download?file=danh-sach.xlsx", detail["attachments"])
        self.assertIn("https://media.dau.edu.vn/files/huong-dan.docx", detail["attachments"])

    def test_extract_date(self):
        from crawler.parser import extract_date_from_text
        self.assertEqual(extract_date_from_text("Ngày đăng: 01/02/2025"), "01/02/2025")
        self.assertEqual(extract_date_from_text("Đăng lúc 28/12/2024 08:30:00"), "28/12/2024 08:30:00")
        self.assertEqual(extract_date_from_text("Không có ngày"), "")

    def test_detect_login_page(self):
        self.assertTrue(is_login_required(SAMPLE_LOGIN_PAGE_HTML))
        with self.assertRaises(AuthenticationRequiredError):
            parse_announcement_list(SAMPLE_LOGIN_PAGE_HTML)


if __name__ == "__main__":
    unittest.main()
