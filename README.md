# DAU Second Brain — Hệ Thống Trợ Lý Tra Cứu Văn Bản Nhà Trường

Hệ thống hỏi đáp và tra cứu văn bản quy định nhà trường tích hợp **Second Brain / RAG (Retrieval-Augmented Generation)**, **PostgreSQL 17**, **Prisma ORM**, **Bảo mật phân quyền Server-Side** và **Lưu trữ lịch sử hội thoại có trích dẫn nguồn** dành cho Trường Đại học Kiến trúc Đà Nẵng (DAU).

---

## 1. Kiến Trúc Tổng Thể

```text
Crawler & PDF Parser (OCR Tiếng Việt)
                 ↓
Kho dữ liệu chuẩn hóa (crawler/data/normalized/documents.json)
                 ↓
        ┌────────┴────────┐
        ↓                 ↓
Hybrid Retrieval      PostgreSQL 17 (Prisma ORM)
(Keyword + Semantic)   - users (bcrypt hash, Role)
        ↓              - conversations & messages (Citations JSON)
Context Builder        - sessions & password_reset_tokens
        ↓
AI Provider & Synthesizer
        ↓
Giao diện ChatGPT-like (Next.js 16 App Router)
```

---

## 2. Công Nghệ Sử Dụng

- **Frontend & Backend:** Next.js 16.3.5 (App Router, Turbopack), React 19, TypeScript 5, Tailwind CSS v4.
- **Database & ORM:** PostgreSQL 17.2, Prisma ORM 6.19.3.
- **Bảo mật & Xác thực:**
  - `bcryptjs` (12 salt rounds) băm mật khẩu người dùng.
  - HMAC-SHA256 Server-Side Session Token lưu trong HTTP-Only Cookie.
  - Next.js Middleware bảo vệ toàn bộ tuyến đường `/admin/*`.
  - Phân quyền dữ liệu (Cross-user isolation): Sinh viên A không thể xem/sửa/xóa lịch sử của Sinh viên B.
  - Chống Open Redirect & Anti-spoofing chữ ký token.

---

## 3. Cấu Hình Môi Trường

Sao chép file `.env.example` thành `.env.local` bên trong thư mục `web/`:

```bash
cd web
cp .env.example .env.local
```

Nội dung cấu hình trong `web/.env.local`:

```env
# 1. Cơ sở dữ liệu PostgreSQL
DATABASE_URL="postgresql://dau_user:MatKhauCuaBan@localhost:5432/dau_second_brain?schema=public"

# 2. Quản trị viên hệ thống (Seed bảo mật)
ADMIN_EMAIL=admin@dau.edu.vn
ADMIN_PASSWORD=MatKhauAdminBaoMat123

# 3. Khóa bí mật ký Session HMAC-SHA256
AUTH_SECRET=dau_second_brain_session_secret_hmac_2026
```

---

## 4. Khởi Tạo Cơ Sở Dữ Liệu & Tài Khoản Admin

Di chuyển vào thư mục `web/`:

```bash
cd web

# 1. Chạy Migration tạo các bảng trong PostgreSQL
npm run db:migrate

# 2. Khởi tạo tài khoản Quản trị viên (Admin Seed)
npm run db:seed-admin

# 3. (Tùy chọn) Mở giao diện xem Database trực quan Prisma Studio
npm run db:studio
```

---

## 5. Chạy Ứng Dụng

```bash
cd web
npm run dev
```

Truy cập: `http://localhost:3000`

---

## 6. Luồng Nghiệp Vụ Người Dùng

### 6.1. Sinh viên
1. Truy cập `/register` để đăng ký tài khoản sinh viên (Họ tên, Email, Mật khẩu >= 6 ký tự).
2. Dữ liệu được lưu vào bảng `users` trong PostgreSQL với mật khẩu đã băm bằng `bcrypt`, role mặc định luôn là `STUDENT`.
3. Hệ thống tự động tạo session và đăng nhập an toàn.
4. Sinh viên hỏi đáp tại `/`: Toàn bộ câu hỏi, câu trả lời của AI và trích dẫn nguồn văn bản (Citations) được lưu vào PostgreSQL.
5. Khi đổi trình duyệt hoặc thiết bị, chỉ cần đăng nhập lại để xem toàn bộ lịch sử trò chuyện.

### 6.2. Quản trị viên (Admin)
1. Tài khoản Admin được khởi tạo qua lệnh `npm run db:seed-admin` từ biến môi trường (không cho phép đăng ký Admin công khai).
2. Đăng nhập tại `/login` bằng email Admin và mật khẩu đã seed.
3. Truy cập phân hệ quản trị `/admin`:
   - `/admin/documents`: Quản lý kho văn bản.
   - `/admin/ai`: Trực quan hóa quy trình 7 bước Second Brain RAG Pipeline.
   - `/admin/users`: Quản lý tài khoản người dùng.
4. Nếu tài khoản sinh viên cố tình truy cập `/admin/*`, Middleware sẽ tự động chuyển hướng về trang `403 Forbidden`.
5. Nếu chưa đăng nhập truy cập `/admin/*`, hệ thống chuyển hướng về `/login?redirect=/admin`.

### 6.3. Khách vãng lai (Guest Mode)
- Người dùng chưa đăng nhập vẫn có thể trải nghiệm hỏi đáp AI.
- Hệ thống hiển thị rõ nhãn "Chế độ Khách" và lưu tạm thời trên trình duyệt (localStorage).
- Khi đăng nhập, lịch sử khách không bị tự động hòa lẫn để bảo vệ tính toàn vẹn dữ liệu.

---

## 7. Bộ Kiểm Thử Tự Động (Automated Tests)

Chạy toàn bộ các bộ kiểm thử tự động trong thư mục `web/`:

```bash
cd web

# 1. Bộ kiểm thử Bước 16 (28 test cases: Auth, DB, Authorization, Conversations, RAG):
node test-step16.js

# 2. Bộ kiểm thử phân quyền Session HMAC (7 test cases):
node test-auth.js

# 3. Bộ kiểm thử trích dẫn và chống ảo giác RAG (7 test cases):
node test-citations.js
```

---

## 8. Cấu Trúc Bảng Database (Prisma Models)

- `users`: id, name, email (unique), passwordHash, role (STUDENT, ADMIN), createdAt, updatedAt.
- `sessions`: id, userId, tokenHash (unique), expiresAt, createdAt.
- `conversations`: id, userId, title, createdAt, updatedAt (onDelete: Cascade).
- `messages`: id, conversationId, role (USER, ASSISTANT), content, citations (Json), modelUsed, createdAt (onDelete: Cascade).
- `password_reset_tokens`: id, userId, tokenHash (unique), expiresAt, usedAt, createdAt.