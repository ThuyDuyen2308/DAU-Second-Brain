# HƯỚNG DẪN BẢO VỆ & QUẢN TRỊ HỆ THỐNG (ADMIN GUIDE)
## DAU Second Brain — Trợ Lý Tra Cứu Văn Bản & Phân Hệ Quản Trị Kho Tri Thức

Tài liệu này hướng dẫn chi tiết các chức năng quản trị, cấu trúc phân hệ `/admin`, cơ chế bảo mật xác thực (Authentication & Authorization) và các lưu ý kỹ thuật khi trình diễn demo đồ án.

---

### 1. Phân Hệ Admin Dùng Để Làm Gì?

Phân hệ **Admin** của DAU Second Brain đóng vai trò là trung tâm kiểm soát và quản trị kho tri thức số hóa của nhà trường:
* **Theo dõi tình trạng kho tài liệu:** Số lượng văn bản, tổng số trang scan OCR, số lượng đoạn ngữ cảnh (chunks) phục vụ RAG.
* **Quản lý văn bản & Danh mục:** Kiểm tra chi tiết bóc tách OCR theo từng trang, phân loại theo chuyên mục đào tạo (Học phí, Khảo thí, Chuẩn đầu ra, Khảo sát).
* **Giám sát Pipeline AI:** Trực quan hóa quy trình 9 bước từ văn bản gốc đến câu trả lời và nguồn trích dẫn; cấu hình trọng số Hybrid Retrieval (40% Keyword + 60% Semantic).
* **Kiểm tra chất lượng & An toàn:** Xem xét nhật ký truy vấn mẫu, kiểm tra tính toàn vẹn trích dẫn và chống sinh ảo giác (Anti-hallucination).

---

### 2. Đăng Nhập & Bảo Vệ Phân Hệ Admin (Bước 15)

#### 2.1. Luồng đăng nhập Admin
1. Mở trang đăng nhập tại tuyến đường `/login`.
2. Nhập tài khoản Admin:
   * **Email:** `admin@dau.edu.vn`
   * **Mật khẩu:** Xem giá trị biến môi trường `ADMIN_PASSWORD` trong tệp `web/.env.local` (Mặc định demo: `admin123`).
3. Nhấn **Đăng nhập**.
4. Server xác thực thông tin, tạo **HTTP-Only Cookie Session** được ký HMAC-SHA256 an toàn và chuyển hướng về `/admin`.

#### 2.2. Cơ chế bảo vệ Route Server-Side (Middleware Guard)
* Tất cả các tuyến đường quản trị bắt đầu bằng `/admin` và `/admin/*` đều được bảo vệ nghiêm ngặt phía Server.
* **Chưa đăng nhập:** Truy cập `/admin` tự động chuyển hướng về `/login?redirect=/admin`.
* **Đã đăng nhập tài khoản Sinh viên (`role=student`):** Truy cập `/admin` bị hệ thống từ chối và chuyển hướng sang trang **403 Forbidden** (`/403`).
* **Bảo mật tuyệt đối:** Quyền hạn (`role`) được kiểm tra phía Server từ Session Cookie signed HMAC, tuyệt đối không phụ thuộc vào `localStorage` hay tham số query client.

#### 2.3. Quy trình Đăng xuất (Logout)
* Nhấn nút **Đăng xuất** ở phần góc dưới Sidebar hoặc trên trang 403.
* Hệ thống kích hoạt API `POST /api/auth/logout`, thu hồi và xóa bỏ Session Cookie (`Max-Age=0`).
* Mọi nỗ lực truy cập lại `/admin` sau khi đăng xuất đều bị đẩy về `/login`.

---

### 3. Cấu Trúc Các Tuyến Đường Quản Trị (Admin Routes)

Toàn bộ phân hệ quản trị nằm dưới tiền tố `/admin` với layout riêng biệt:

| Route | Tên màn hình | Chức năng chính |
| :--- | :--- | :--- |
| `/admin` | **Tổng quan hệ thống** | Dashboard 4 thẻ chỉ số, thao tác nhanh, tình trạng kho tri thức và hoạt động hệ thống. |
| `/admin/documents` | **Quản lý văn bản** | Bảng danh sách văn bản, tìm kiếm theo tiêu đề/số hiệu/ngày, lọc danh mục và trạng thái. |
| `/admin/documents/new`| **Thêm văn bản** | Biểu mẫu nhập liệu metadata và giao diện kéo thả tệp tài liệu OCR (mô phỏng). |
| `/admin/documents/[id]`| **Chi tiết văn bản** | Xem thông tin chi tiết, trạng thái xử lý và nội dung OCR bóc tách từng trang. |
| `/admin/categories` | **Quản lý danh mục** | Xem thống kê số lượng văn bản theo nhóm, thêm/sửa/xóa danh mục đào tạo. |
| `/admin/users` | **Quản lý người dùng** | Danh sách tài khoản mẫu, phân quyền (Admin, Biên tập viên, Cán bộ), đổi trạng thái hoạt động. |
| `/admin/questions` | **Nhật ký hỏi đáp** | Lịch sử câu hỏi của sinh viên, xem câu trả lời trích xuất, nguồn trích dẫn và thời gian phản hồi. |
| `/admin/ai` | **Cấu hình & Xử lý AI** | Trực quan hóa 9 bước của Pipeline RAG, hiển thị trọng số Hybrid Search và nút Re-index tri thức. |
| `/admin/settings` | **Cài đặt hệ thống** | Cấu hình tham số Gemini AI, trạng thái chỉ mục Vector Embedding và tùy chọn hệ thống. |

---

### 4. Giới Hạn Hiện Tại & Định Hướng Phát Triển

> [!IMPORTANT]
> Phân hệ Admin đạt trạng thái **"Demo-Ready trong phạm vi dataset kiểm thử hiện tại"**.

1. **Authentication:** Đã xây dựng luồng xác thực server-side hoàn chỉnh với HTTP-only Cookie và mã hóa HMAC cho các tài khoản cấu hình qua biến môi trường. Chưa kết nối DB người dùng production để lưu hàng ngàn sinh viên.
2. **Dữ liệu thao tác (Mutation):** Các thao tác thêm, sửa, xóa tài liệu trên Admin được mô phỏng trên bộ nhớ phiên làm việc (Local State/Session) của trình duyệt để phục vụ báo cáo.
3. **Database:** Kho văn bản hiện tại vẫn đọc từ tệp JSON đã được chuẩn hóa (`crawler/data/normalized/documents.json`).
