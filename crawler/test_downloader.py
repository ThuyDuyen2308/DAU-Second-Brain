"""
Unit test cho module crawler/downloader.py.
Kiểm tra toàn diện:
- URL normalization & attachment URL resolution (ViewFileOnline)
- Attachment filtering (.pdf, .doc, .docx only)
- Duplicate attachment detection
- Windows-safe filename sanitization
- Strict notification matching (post-id, canonical, slug, exact title, negative test)
- Cache detection (HTML cache and document cache)
- Dry-run mode (không tạo hay ghi file lên đĩa)
- HTTP error handling (401/403, 404, 429 backoff, login/CAPTCHA redirect)
"""

import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

import requests

from crawler.config import (
    BASE_URL,
    parse_cookie_content,
    load_cookie_from_file,
    get_cookie_string,
)
from crawler.parser import AuthenticationRequiredError, normalize_attachment_url
from crawler.downloader import (
    DAUDownloader,
    RateLimitExceededError,
    sanitize_filename,
    normalize_title_for_comparison,
    extract_slug_from_url,
    determine_document_year,
    is_allowed_document,
    match_detail_to_notification,
)


class TestSanitizeFilename(unittest.TestCase):
    """Kiểm tra làm sạch và chuẩn hóa tên file an toàn trên hệ điều hành Windows."""

    def test_forbidden_characters_replaced(self):
        raw = 'thong:bao*dau?2026<hoc_phi>|"test".pdf'
        safe = sanitize_filename(raw)
        for char in r'<>:"/\|?*':
            self.assertNotIn(char, safe)
        self.assertTrue(safe.endswith(".pdf"))

    def test_windows_reserved_names(self):
        self.assertEqual(sanitize_filename("con.pdf"), "con_file.pdf")
        self.assertEqual(sanitize_filename("AUX.docx"), "AUX_file.docx")
        self.assertEqual(sanitize_filename("prn.doc"), "prn_file.doc")
        self.assertEqual(sanitize_filename("nul.pdf"), "nul_file.pdf")

    def test_trailing_dots_and_spaces_stripped(self):
        self.assertEqual(sanitize_filename("thong-bao... .pdf"), "thong-bao.pdf")
        self.assertEqual(sanitize_filename("bao_cao ..."), "bao_cao")

    def test_long_filename_truncated_safely(self):
        long_name = "a" * 250 + ".pdf"
        safe = sanitize_filename(long_name, max_length=100)
        self.assertLessEqual(len(safe), 100)
        self.assertTrue(safe.endswith(".pdf"))

    def test_empty_filename(self):
        self.assertEqual(sanitize_filename(""), "unnamed_file")
        self.assertEqual(sanitize_filename("   "), "unnamed_file")

    def test_url_encoded_filename(self):
        raw = "43%20Tb-%C4%9DHKT%C4%90N%20To%20chuc.pdf"
        safe = sanitize_filename(raw)
        self.assertTrue(safe.endswith(".pdf"))
        self.assertNotIn("%20", safe)


class TestUrlAndAttachmentNormalization(unittest.TestCase):
    """Kiểm tra chuẩn hóa URL và lọc định dạng tài liệu."""

    def test_viewfile_online_resolution(self):
        raw = "https://sinhvien.dau.edu.vn/FileManager/ViewFileOnline?filePath=https%3A%2F%2Fmedia.dau.edu.vn%2FMedia%2FDoc%2F43-tb.pdf"
        clean = normalize_attachment_url(raw, base_url=BASE_URL)
        self.assertEqual(clean, "https://media.dau.edu.vn/Media/Doc/43-tb.pdf")

    def test_slash_normalization(self):
        raw = "https://media.dau.edu.vn\\Media\\2_SVDAU\\FolderFunc\\202608\\file.pdf"
        clean = normalize_attachment_url(raw, base_url=BASE_URL)
        self.assertEqual(clean, "https://media.dau.edu.vn/Media/2_SVDAU/FolderFunc/202608/file.pdf")

    def test_allowed_document_extensions(self):
        self.assertTrue(is_allowed_document("https://example.com/file.pdf"))
        self.assertTrue(is_allowed_document("https://example.com/file.doc"))
        self.assertTrue(is_allowed_document("https://example.com/file.docx"))
        self.assertTrue(is_allowed_document("/Media/file.PDF"))

        # Các định dạng khác không phải tài liệu văn bản thông báo
        self.assertFalse(is_allowed_document("https://example.com/image.png"))
        self.assertFalse(is_allowed_document("https://example.com/photo.jpg"))
        self.assertFalse(is_allowed_document("https://example.com/index.html"))
        self.assertFalse(is_allowed_document("https://example.com/setup.exe"))


class TestDuplicateAttachmentDetection(unittest.TestCase):
    """Kiểm tra phát hiện và khử trùng lặp file đính kèm."""

    def test_duplicate_url_deduplication(self):
        urls = [
            "https://media.dau.edu.vn/Media/Doc/43-tb.pdf",
            "https://sinhvien.dau.edu.vn/FileManager/ViewFileOnline?filePath=https%3A%2F%2Fmedia.dau.edu.vn%2FMedia%2FDoc%2F43-tb.pdf",
            "https://media.dau.edu.vn/Media/Doc/43-tb.pdf",
        ]
        seen = set()
        unique = []
        for u in urls:
            norm = normalize_attachment_url(u, base_url=BASE_URL)
            if norm not in seen:
                seen.add(norm)
                unique.append(norm)

        self.assertEqual(len(unique), 1)
        self.assertEqual(unique[0], "https://media.dau.edu.vn/Media/Doc/43-tb.pdf")


class TestStrictNotificationMatching(unittest.TestCase):
    """Kiểm tra nguyên tắc đối sánh CHÍNH XÁC (STRICT MATCHING)."""

    def setUp(self):
        self.notif = {
            "title": "Thông báo tổ chức khảo sát năng lực Toán học cho sinh viên khóa tuyển sinh năm 2026.",
            "date": "28/08/2026",
            "detail_url": "https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-to-chuc-khao-sat-nang-luc-toan-hoc-cho-sinh-vien-khoa-tuyen-sinh-nam-2026.html",
            "post_id": "4528",
        }

    def test_priority1_post_id_matching(self):
        detail_info = {
            "title": "Tiêu đề khác",
            "detail_url": "https://sinhvien.dau.edu.vn/other.html",
            "post_id": "4528",
        }
        self.assertTrue(match_detail_to_notification(detail_info, "https://sinhvien.dau.edu.vn/other.html", self.notif))

    def test_priority2_canonical_matching(self):
        detail_info = {
            "title": "Khảo sát Toán 2026",
            "detail_url": self.notif["detail_url"],
        }
        self.assertTrue(match_detail_to_notification(detail_info, "https://sinhvien.dau.edu.vn/alias.html", self.notif))

    def test_priority3_slug_matching(self):
        detail_info = {"title": "Khảo sát", "detail_url": ""}
        requested_url = "https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-to-chuc-khao-sat-nang-luc-toan-hoc-cho-sinh-vien-khoa-tuyen-sinh-nam-2026.html"
        self.assertTrue(match_detail_to_notification(detail_info, requested_url, self.notif))

    def test_priority4_normalized_title_matching(self):
        detail_info = {
            "title": "Thông báo tổ chức khảo sát năng lực Toán học cho sinh viên khóa tuyển sinh năm 2026. - 28/08/2026",
            "detail_url": "",
        }
        self.assertTrue(match_detail_to_notification(detail_info, "https://other.com/123.html", self.notif))

    def test_negative_no_fuzzy_matching(self):
        """Khác tiêu đề, khác URL, khác slug -> BỎ QUA, không ghép nhầm."""
        detail_info = {
            "title": "Về mức thu học phí theo chương trình Kiến trúc - Kiến tạo trong học kỳ 1 năm học 2026-2027",
            "detail_url": "https://sinhvien.dau.edu.vn/sinh-vien/tin/ve-muc-thu-hoc-phi.html",
        }
        notif_hoc_phi = {
            "title": "Thông báo về việc nộp học phí và bảo hiểm trong học kỳ I năm học 2026-2027 đối với sinh viên các khóa đang theo học tại trường",
            "detail_url": "https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-ve-viec-nop-hoc-phi-va-bao-hiem.html",
        }
        self.assertFalse(
            match_detail_to_notification(
                detail_info,
                "https://sinhvien.dau.edu.vn/sinh-vien/tin/ve-muc-thu-hoc-phi.html",
                notif_hoc_phi,
            )
        )


class TestDetermineDocumentYear(unittest.TestCase):
    """Kiểm tra trích xuất năm của tài liệu."""

    def test_from_date_string(self):
        self.assertEqual(determine_document_year("", "28/08/2026"), "2026")
        self.assertEqual(determine_document_year("", "15/12/2025"), "2025")

    def test_from_url_path(self):
        self.assertEqual(
            determine_document_year("https://media.dau.edu.vn/Media/2_SVDAU/FolderFunc/202608/doc.pdf"),
            "2026",
        )
        self.assertEqual(
            determine_document_year("https://media.dau.edu.vn/Media/2_SVDAU/FolderFunc/2025/doc.pdf"),
            "2025",
        )


class TestCacheDetection(unittest.TestCase):
    """Kiểm tra phát hiện cache HTML và cache file đính kèm."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.details_dir = Path(self.temp_dir) / "details"
        self.documents_dir = Path(self.temp_dir) / "documents"
        self.notif_file = Path(self.temp_dir) / "notifications.json"

        self.details_dir.mkdir(parents=True, exist_ok=True)
        self.documents_dir.mkdir(parents=True, exist_ok=True)

        self.downloader = DAUDownloader(
            notifications_file=self.notif_file,
            details_dir=self.details_dir,
            documents_dir=self.documents_dir,
            delay=0.0,
        )

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_html_cache_hit(self):
        """Khi file HTML chi tiết đã tồn tại trong details/, đọc từ cache mà không gọi mạng."""
        detail_url = "https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-test.html"
        cache_path = self.downloader.get_cached_detail_path(detail_url)
        cache_path.write_text("<html><body>Cached Content</body></html>", encoding="utf-8")

        with patch.object(self.downloader, "fetch_url") as mock_fetch:
            content, is_cached = self.downloader.fetch_and_cache_detail_html(detail_url)
            self.assertTrue(is_cached)
            self.assertIn("Cached Content", content)
            mock_fetch.assert_not_called()

    def test_attachment_cache_hit(self):
        """Khi file đính kèm đã có trên đĩa và size > 0, phát hiện cache hit mà không tải lại."""
        att_url = "https://media.dau.edu.vn/Media/Doc/test_file.pdf"
        doc_year_dir = self.documents_dir / "2026"
        doc_year_dir.mkdir(parents=True, exist_ok=True)
        target_file = doc_year_dir / "test_file.pdf"
        target_file.write_bytes(b"%PDF-1.4 dummy binary content")

        with patch.object(self.downloader, "fetch_url") as mock_fetch:
            res_path, is_cached = self.downloader.download_attachment(att_url, year="2026")
            self.assertTrue(is_cached)
            self.assertEqual(res_path, target_file)
            mock_fetch.assert_not_called()


class TestDryRunMode(unittest.TestCase):
    """Kiểm tra chế độ Dry-Run: chỉ phân tích, tuyệt đối không ghi file lên đĩa."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.details_dir = Path(self.temp_dir) / "details"
        self.documents_dir = Path(self.temp_dir) / "documents"
        self.notif_file = Path(self.temp_dir) / "notifications.json"

        notifs = [
            {
                "title": "Thông báo tổ chức khảo sát năng lực Toán học cho sinh viên khóa tuyển sinh năm 2026.",
                "date": "28/08/2026",
                "detail_url": "https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-to-chuc-khao-sat-nang-luc-toan-hoc-cho-sinh-vien-khoa-tuyen-sinh-nam-2026.html",
                "attachments": [],
                "content": "",
            }
        ]
        with open(self.notif_file, "w", encoding="utf-8") as f:
            json.dump(notifs, f)

        self.downloader = DAUDownloader(
            notifications_file=self.notif_file,
            details_dir=self.details_dir,
            documents_dir=self.documents_dir,
            delay=0.0,
            dry_run=True,
        )

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_dry_run_does_not_create_files(self):
        sample_html = """
        <html>
        <head><link rel="canonical" href="https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-to-chuc-khao-sat-nang-luc-toan-hoc-cho-sinh-vien-khoa-tuyen-sinh-nam-2026.html" /></head>
        <body>
            <div class="detail-Tin">
                <h1>Thông báo tổ chức khảo sát năng lực Toán học cho sinh viên khóa tuyển sinh năm 2026.</h1>
                <p>Nội dung chi tiết khảo sát môn Toán.</p>
                <a href="https://media.dau.edu.vn/Media/Folder/43-tb.pdf">Tải về</a>
            </div>
        </body>
        </html>
        """
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = sample_html

        with patch.object(self.downloader, "fetch_url", return_value=mock_resp):
            stats = self.downloader.run()

        self.assertEqual(stats["total_notifications"], 1)
        self.assertEqual(stats["strictly_matched"], 1)
        self.assertEqual(stats["attachments_found"], 1)
        self.assertEqual(stats["attachments_downloaded"], 0)

        # Đảm bảo không có file nào được tạo trong details/ hoặc documents/
        self.assertFalse(self.details_dir.exists())
        self.assertFalse(self.documents_dir.exists())


class TestHttpErrorHandling(unittest.TestCase):
    """Kiểm tra xử lý các mã lỗi HTTP và cơ chế backoff."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.downloader = DAUDownloader(
            notifications_file=Path(self.temp_dir) / "notif.json",
            details_dir=Path(self.temp_dir) / "details",
            documents_dir=Path(self.temp_dir) / "documents",
            delay=0.01,
        )

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_http_401_403_raises_auth_error(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 403
        with patch.object(self.downloader.session, "get", return_value=mock_resp):
            with self.assertRaises(AuthenticationRequiredError):
                self.downloader.fetch_url("https://sinhvien.dau.edu.vn/protected.html")

    def test_http_404_logs_warning_and_returns_none(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        with patch.object(self.downloader.session, "get", return_value=mock_resp):
            res = self.downloader.fetch_url("https://sinhvien.dau.edu.vn/notfound.html")
            self.assertIsNone(res)

    def test_http_429_exponential_backoff_and_stop(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        with patch.object(self.downloader.session, "get", return_value=mock_resp):
            with self.assertRaises(RateLimitExceededError):
                self.downloader.fetch_url("https://sinhvien.dau.edu.vn/api", max_retries=2)

    def test_login_redirect_raises_auth_error(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.url = "https://sinhvien.dau.edu.vn/sinh-vien-dang-nhap.html"
        mock_resp.text = "<html><body><form><input name='UserName' /><input name='Password' /></form></body></html>"

        with patch.object(self.downloader.session, "get", return_value=mock_resp):
            with self.assertRaises(AuthenticationRequiredError):
                self.downloader.fetch_url("https://sinhvien.dau.edu.vn/detail.html")


class TestCookieLoading(unittest.TestCase):
    """Kiểm tra cơ chế đọc và chuẩn hóa cookie từ cookies.txt và chuỗi cấu hình."""

    def test_parse_cookie_content_standard(self):
        raw = "ASP.NET_SessionId=abcdef123; .ASPXAUTH=ABCDEF987"
        clean = parse_cookie_content(raw)
        self.assertIn("ASP.NET_SessionId=abcdef123", clean)
        self.assertIn(".ASPXAUTH=ABCDEF987", clean)

    def test_parse_cookie_content_multiline(self):
        raw = "ASP.NET_SessionId=abcdef123\n.ASPXAUTH=ABCDEF987\n"
        clean = parse_cookie_content(raw)
        self.assertEqual(clean, "ASP.NET_SessionId=abcdef123; .ASPXAUTH=ABCDEF987")

    def test_parse_cookie_content_with_header_prefix(self):
        raw = "Cookie: ASP.NET_SessionId=abcdef123; .ASPXAUTH=ABCDEF987"
        clean = parse_cookie_content(raw)
        self.assertFalse(clean.lower().startswith("cookie:"))
        self.assertIn("ASP.NET_SessionId=abcdef123", clean)

    def test_parse_cookie_content_netscape_format(self):
        netscape_raw = (
            "# Netscape HTTP Cookie File\n"
            "# http://curl.haxx.se/rfc/cookie_spec.html\n"
            ".dau.edu.vn\tTRUE\t/\tFALSE\t1735689600\tASP.NET_SessionId\tabcdef123\n"
            "sinhvien.dau.edu.vn\tFALSE\t/\tFALSE\t1735689600\t.ASPXAUTH\tABCDEF987\n"
        )
        clean = parse_cookie_content(netscape_raw)
        self.assertIn("ASP.NET_SessionId=abcdef123", clean)
        self.assertIn(".ASPXAUTH=ABCDEF987", clean)

    def test_parse_cookie_content_utf8_bom(self):
        raw_with_bom = "\ufeffASP.NET_SessionId=abcdef123; .ASPXAUTH=ABCDEF987"
        clean = parse_cookie_content(raw_with_bom)
        self.assertNotIn("\ufeff", clean)
        self.assertTrue(clean.startswith("ASP.NET_SessionId=abcdef123"))

    def test_load_cookie_from_file(self):
        with tempfile.NamedTemporaryFile("w", encoding="utf-8-sig", delete=False) as f:
            f.write("# Session Cookie\nASP.NET_SessionId=abcdef123;\n.ASPXAUTH=ABCDEF987;\n")
            temp_path = Path(f.name)

        try:
            loaded = load_cookie_from_file(temp_path)
            self.assertEqual(loaded, "ASP.NET_SessionId=abcdef123; .ASPXAUTH=ABCDEF987")
        finally:
            temp_path.unlink(missing_ok=True)

    def test_downloader_auto_reads_cookie_file(self):
        with tempfile.NamedTemporaryFile("w", encoding="utf-8-sig", delete=False) as f:
            f.write("ASP.NET_SessionId=sess123456; .ASPXAUTH=auth654321")
            temp_path = Path(f.name)

        try:
            downloader = DAUDownloader(cookie_file=temp_path, delay=0.0, dry_run=True)
            cookie_hdr = downloader.session.headers.get("Cookie", "")
            self.assertIn("ASP.NET_SessionId=sess123456", cookie_hdr)
            self.assertIn(".ASPXAUTH=auth654321", cookie_hdr)
        finally:
            temp_path.unlink(missing_ok=True)




class TestAttachmentBinaryHandling(unittest.TestCase):
    """
    Regression tests cho lỗi ParserRejectedMarkup khi download_attachment()
    gọi BeautifulSoup trên response binary (PDF/DOC/DOCX).

    Đảm bảo:
    - PDF binary stream=True không crash và tải thành công
    - HTML login page giả dạng attachment bị phát hiện và bỏ qua
    - DOC/DOCX binary không crash
    - fetch_url với stream=True không gọi BeautifulSoup
    """

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.downloader = DAUDownloader(
            notifications_file=Path(self.temp_dir) / "notif.json",
            details_dir=Path(self.temp_dir) / "details",
            documents_dir=Path(self.temp_dir) / "documents",
            delay=0.0,
        )

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _make_mock_response(self, status=200, content_type="", url="", content=b""):
        """Tạo mock response với iter_content trả về chunk binary."""
        mock_resp = MagicMock()
        mock_resp.status_code = status
        mock_resp.headers = {"Content-Type": content_type}
        mock_resp.url = url
        mock_resp.cookies = MagicMock()
        mock_resp.cookies.get.return_value = ""
        # iter_content trả về chunk đúng kiểu
        mock_resp.iter_content.return_value = iter([content] if content else [])
        return mock_resp

    def test_pdf_binary_stream_does_not_crash(self):
        """PDF binary với Content-Type application/pdf → tải thành công, KHÔNG crash."""
        pdf_bytes = b"%PDF-1.4 binary content here\x00\x01\x02\x03"
        mock_resp = self._make_mock_response(
            status=200,
            content_type="application/pdf",
            url="https://sinhvien.dau.edu.vn/upload/file.pdf",
            content=pdf_bytes,
        )
        pdf_url = "https://sinhvien.dau.edu.vn/upload/file.pdf"
        with patch.object(self.downloader, "fetch_url", return_value=mock_resp):
            # KHÔNG được raise exception, KHÔNG được crash
            result_path, is_cached = self.downloader.download_attachment(pdf_url, year="2026")
        self.assertIsNotNone(result_path, "PDF binary phải tải thành công, không được trả None")
        self.assertFalse(is_cached)
        self.assertTrue(result_path.exists(), "File PDF phải được ghi ra đĩa")

    def test_html_login_page_disguised_as_pdf_rejected(self):
        """Server trả về HTML login page (Content-Type text/html) giả dạng .pdf → bị từ chối, không lưu file."""
        html_content = b"<html><body><form><input name='UserName'/><input name='Password'/></form></body></html>"
        mock_resp = self._make_mock_response(
            status=200,
            content_type="text/html; charset=utf-8",
            url="https://sinhvien.dau.edu.vn/sinh-vien-dang-nhap.html",
            content=html_content,
        )
        pdf_url = "https://sinhvien.dau.edu.vn/upload/secret.pdf"
        with patch.object(self.downloader, "fetch_url", return_value=mock_resp):
            result_path, is_cached = self.downloader.download_attachment(pdf_url, year="2026")
        self.assertIsNone(result_path, "HTML login page giả dạng PDF phải bị từ chối (trả None)")
        self.assertFalse(is_cached)

    def test_docx_binary_does_not_crash(self):
        """DOCX binary (PK magic bytes) với Content-Type OOXML → tải thành công, không crash."""
        # PK\x03\x04 là magic bytes của ZIP-based Office formats (DOCX, XLSX, PPTX)
        docx_bytes = b"PK\x03\x04" + b"\x00" * 100
        mock_resp = self._make_mock_response(
            status=200,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            url="https://sinhvien.dau.edu.vn/upload/file.docx",
            content=docx_bytes,
        )
        docx_url = "https://sinhvien.dau.edu.vn/upload/file.docx"
        with patch.object(self.downloader, "fetch_url", return_value=mock_resp):
            result_path, is_cached = self.downloader.download_attachment(docx_url, year="2026")
        self.assertIsNotNone(result_path, "DOCX binary phải tải thành công")
        self.assertFalse(is_cached)

    def test_fetch_url_stream_true_does_not_call_beautifulsoup(self):
        """
        Regression: fetch_url(stream=True) với Content-Type application/pdf
        KHÔNG được gọi response.text hay BeautifulSoup.
        Đây là root cause của lỗi ParserRejectedMarkup.
        """
        pdf_bytes = b"%PDF-1.4 fake binary"
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"Content-Type": "application/pdf"}
        mock_resp.url = "https://sinhvien.dau.edu.vn/upload/file.pdf"
        mock_resp.cookies = MagicMock()
        mock_resp.cookies.get.return_value = ""

        with patch.object(self.downloader.session, "get", return_value=mock_resp):
            result = self.downloader.fetch_url(
                "https://sinhvien.dau.edu.vn/upload/file.pdf",
                stream=True,
            )
        self.assertIsNotNone(result, "fetch_url stream=True phải thành công với PDF")
        # Đảm bảo response.text KHÔNG bao giờ được gọi (tránh crash BeautifulSoup)
        mock_resp.text.assert_not_called()


if __name__ == "__main__":
    unittest.main()
