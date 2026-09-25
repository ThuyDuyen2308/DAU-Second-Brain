# Thư mục chứa dữ liệu cục bộ được cấp quyền (crawler/input/)

Thư mục này dùng để lưu trữ các file HTML, PDF, DOC, DOCX được tải về từ Cổng thông tin sinh viên DAU sau khi bạn đã đăng nhập hợp lệ trên trình duyệt.

## Hướng dẫn sử dụng:

1. **Lưu trang danh sách thông báo:**
   - Mở trình duyệt, đăng nhập vào `https://sinhvien.dau.edu.vn`.
   - Truy cập: `https://sinhvien.dau.edu.vn/sinh-vien/dm-tin/thong-bao.html?page=1&pageSize=50`
   - Nhấn `Ctrl + S` (hoặc chuột phải -> Lưu trang dưới dạng...)
   - Chọn định dạng: **"Webpage, HTML Only"** (Chỉ HTML) hoặc **"Webpage, Complete"**.
   - Lưu file vào thư mục này: ví dụ `crawler/input/thong-bao-trang-1.html`.

2. **Lưu các file đính kèm hoặc trang chi tiết (tùy chọn):**
   - Bạn có thể đặt trực tiếp các file `.pdf`, `.doc`, `.docx` tải về vào thư mục này hoặc thư mục con `crawler/input/attachments/`.
   - Bạn cũng có thể lưu các trang chi tiết bài viết (ví dụ `chi-tiet-hoc-phi.html`) vào đây để trích xuất link và nội dung đính kèm.

3. **Thực thi module import:**
   ```powershell
   python -m crawler.local_importer
   ```
   Kết quả sẽ được tự động trích xuất và xuất ra file:
   `crawler/data/notifications.json`
