# DAU Second Brain – Web Application

Giao diện tra cứu văn bản số hóa dành cho sinh viên và giảng viên **Trường Đại học Kiến trúc Đà Nẵng**.

---

## 1. Giới thiệu tổng quan

Hệ thống được thiết kế theo tiêu chuẩn chuyên nghiệp, học thuật và hiện đại, đóng vai trò là giao diện trung tâm (Frontend) kết nối với kho văn bản đã qua các tầng chuẩn hóa:

```text
Crawler & PDF Download
         ↓
Document Extraction & OCR Tiếng Việt
         ↓
Data Normalizer (Schema chuẩn)
         ↓
Data Quality Validation
         ↓
DAU Second Brain Web (Next.js + TypeScript + Tailwind CSS)
```

Dataset hiện tại gồm **10 văn bản mẫu** tại `crawler/data/normalized/documents.json`. Khi có kho dữ liệu chính thức từ nhà trường, toàn bộ số liệu thống kê, danh mục và nội dung sẽ tự động cập nhật mà không cần sửa giao diện.

---

## 2. Các trang chính trong hệ thống

- **Trang chủ (`/`)**:
  - Hero Section với tiêu đề học thuật, thanh tìm kiếm thông minh và gợi ý từ khóa.
  - Visual mockup thẻ văn bản số hóa.
  - Thống kê tự động từ dataset: Số lượng văn bản, tổng số trang tài liệu, số nhóm chủ đề, tỉ lệ nguồn dữ liệu.
  - Khám phá theo nhóm chủ đề và danh sách văn bản mới nhất.
- **Tra cứu văn bản (`/documents`)**:
  - Bố cục 2 cột (Desktop): Sidebar bộ lọc chuyên sâu (Chủ đề, Trạng thái hiệu lực, Năm ban hành) và Danh sách thẻ văn bản.
  - Hỗ trợ drawer bộ lọc trên thiết bị di động (Mobile).
  - Trạng thái hiệu lực hiển thị chính xác `Chưa xác định hiệu lực` (màu amber).
- **Chi tiết văn bản (`/documents/[id]`)**:
  - Breadcrumb điều hướng, metadata chi tiết (Số hiệu, Ngày ban hành, Đơn vị, Quy mô).
  - Nội dung OCR phân tách theo từng trang (`Trang 1`, `Trang 2`...) với kiểu chữ học thuật dễ đọc.
  - Nút **"Xem văn bản gốc"** mở trực tiếp file PDF chính thức.
  - Khung truy vết nguồn gốc (Provenance) và điểm chất lượng OCR.
- **Khám phá chủ đề (`/categories`)**:
  - Phân loại trực tiếp từ dữ liệu: Học phí, Khảo thí, Chuẩn đầu ra, Khảo sát.
- **Hỏi đáp trợ lý (`/ask`)**:
  - Giao diện khung hội thoại hiện đại với các câu hỏi gợi ý thường gặp của sinh viên.
  - Thông báo minh bạch: Chức năng hỏi đáp AI đang được xây dựng.
- **Đăng nhập (`/login`) & Đăng ký (`/register`)**:
  - Bố cục 2 cột (Panel thương hiệu DAU bên trái, Form thẻ bên phải).
  - Validation dữ liệu phía client (email sinh viên, độ dài mật khẩu, xác nhận mật khẩu, điều khoản).
- **Quên mật khẩu (`/forgot-password`)**:
  - Tiếp nhận yêu cầu khôi phục mật khẩu sinh viên.

---

## 3. Khởi chạy môi trường phát triển

Di chuyển vào thư mục `web` và chạy dev server:

```bash
cd web
npm run dev
```

Truy cập website trên trình duyệt:  
👉 **`http://localhost:3000`**

---

## 4. Biên dịch Production Build

```bash
cd web
npm run build
```

Hệ thống hỗ trợ Static Site Generation (SSG) kết hợp Dynamic Rendering với thời gian build tối ưu và kiểm tra 100% kiểu dữ liệu TypeScript.
