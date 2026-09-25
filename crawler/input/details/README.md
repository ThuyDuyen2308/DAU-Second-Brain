# Thư mục chứa các file HTML trang chi tiết (crawler/input/details/)

Thư mục này dùng để lưu trữ các file HTML của từng thông báo chi tiết do bạn tải về từ trình duyệt sau khi đăng nhập tài khoản sinh viên DAU.

## 11 URL chi tiết cần thu thập (từ notifications.json):

1. `https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-to-chuc-khao-sat-nang-luc-toan-hoc-cho-sinh-vien-khoa-tuyen-sinh-nam-2026.html`
2. `https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-xet-quy-doi-tuong-duong-chung-chi-ngoai-ngu-tin-hoc-chuan-dau-ra-hoc-ky-1-nam-hoc-2026-2027.html`
3. `https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-cham-phuc-khao-bai-thi-ket-thuc-hoc-phan-dot-2-nam-hoc-2025-2026.html`
4. `https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-ve-viec-nop-hoc-phi-cac-hoc-phan-hoc-lai-va-hoc-cai-thien-doi-voi-sinh-vien-cac-khoa-trong-nam-hoc-2026-2027.html`
5. `https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-ve-viec-nop-hoc-phi-va-bao-hiem-trong-hoc-ky-i-nam-hoc-2026-2027-doi-voi-sinh-vien-cac-khoa-dang-theo-hoc-tai-truong.html`
6. `https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-nop-chung-chi-quy-doi-chuan-dau-ra-ngoai-ngu-tin-hoc.html`
7. `https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-trien-khai-phuc-khao-dot-thi-1-hoc-ky-2-nam-hoc-2025-2026.html`
8. `https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-trien-khai-khao-sat-su-hai-long-cua-sinh-vien-nam-hoc-2025-2026.html`
9. `https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-trien-khai-phuc-khao-dot-thi-1-2-hoc-ky-1-nam-hoc-2025-2026-020757.html`
10. `https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-trien-khai-phuc-khao-dot-thi-1-2-hoc-ky-1-nam-hoc-2025-2026.html`
11. `https://sinhvien.dau.edu.vn/sinh-vien-tin-tuc-thong-bao.html`

## Hướng dẫn lưu file từ trình duyệt:

1. Đăng nhập https://sinhvien.dau.edu.vn trên trình duyệt.
2. Mở từng liên kết chi tiết ở trên.
3. Nhấn `Ctrl + S` (hoặc chuột phải -> Lưu trang dưới dạng...).
4. Chọn định dạng: **"Webpage, HTML Only"** (Chỉ HTML).
5. Đặt file vào thư mục này (`crawler/input/details/`).
6. Chạy lệnh xử lý:
   ```powershell
   python -m crawler.detail_processor
   ```
   Dữ liệu nội dung và link file đính kèm (PDF/DOC/DOCX) sẽ tự động được cập nhật vào `crawler/data/notifications.json`.
