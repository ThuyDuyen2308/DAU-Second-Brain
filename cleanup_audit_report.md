# BÁO CÁO AUDIT VÀ DỌN DẸP TOÀN BỘ PROJECT (BƯỚC 22)

**Dự án:** DAU-Second-Brain  
**Thời gian thực hiện:** 2026-10-03  
**Nguyên tắc cốt lõi:** AN TOÀN > DỌN SẠCH. Tuyệt đối không xóa nếu có bất kỳ nghi ngờ nào.

---

## TỔNG QUAN PHÂN LOẠI FILE

### 1. GROUP A — ĐANG ĐƯỢC SỬ DỤNG (KEEP - 100% GIỮ LẠI)
- **Next.js App & Pages:**
  - `web/app/layout.tsx`, `web/app/page.tsx`, `web/app/globals.css`
  - `web/app/ask/page.tsx`, `web/app/categories/page.tsx`, `web/app/documents/page.tsx`, `web/app/documents/[id]/page.tsx`
  - `web/app/login/page.tsx`, `web/app/register/page.tsx`, `web/app/forgot-password/page.tsx`, `web/app/403/page.tsx`
  - `web/app/admin/layout.tsx`, `web/app/admin/page.tsx`, `web/app/admin/ai/page.tsx`, `web/app/admin/categories/page.tsx`
  - `web/app/admin/documents/page.tsx`, `web/app/admin/documents/[id]/page.tsx`, `web/app/admin/documents/new/page.tsx`
  - `web/app/admin/import/page.tsx`, `web/app/admin/questions/page.tsx`, `web/app/admin/settings/page.tsx`, `web/app/admin/users/page.tsx`
- **Next.js Route Handlers & APIs:**
  - `web/app/api/ask/route.ts`
  - `web/app/api/conversations/route.ts`, `web/app/api/conversations/[id]/route.ts`, `web/app/api/conversations/[id]/messages/route.ts`
  - `web/app/api/auth/login/route.ts`, `web/app/api/auth/logout/route.ts`, `web/app/api/auth/me/route.ts`, `web/app/api/auth/register/route.ts`, `web/app/api/auth/forgot-password/route.ts`, `web/app/api/auth/reset-password/route.ts`
  - `web/app/api/admin/crawler/run/route.ts`, `web/app/api/admin/crawler/jobs/route.ts`, `web/app/api/admin/crawler/jobs/[id]/route.ts`
  - `web/app/api/admin/import/route.ts`, `web/app/api/admin/import/[id]/route.ts`, `web/app/api/admin/import/[id]/process/route.ts`, `web/app/api/admin/import/[id]/publish/route.ts`
  - `web/app/api/admin/import/bulk-process/route.ts`, `web/app/api/admin/import/bulk-verify/route.ts`, `web/app/api/admin/import/upload/route.ts`
  - `web/app/api/admin/documents/[id]/status/route.ts`, `web/app/api/admin/documents/bulk-verify/route.ts`, `web/app/api/admin/users/route.ts`
- **Components:**
  - `web/components/CategoryCard.tsx`, `web/components/ChatBox.tsx`, `web/components/DocumentCard.tsx`, `web/components/DocumentList.tsx`, `web/components/Footer.tsx`, `web/components/Header.tsx`, `web/components/SearchBar.tsx`, `web/components/StatCard.tsx`, `web/components/StatusBadge.tsx`
  - `web/components/admin/*` (AdminConfirmDialog, AdminDocumentsClient, AdminEmptyState, AdminHeader, AdminSidebar, AdminToast, CrawlerPanel, ImportDropzone, ImportQueue)
  - `web/components/auth/*` (AuthLayout, LoginForm, RegisterForm)
  - `web/components/chat/*` (ChatInterface, ChatMessageItem, ChatSidebar)
  - `web/components/ui/*` (Badge, Button, Input)
- **Libraries & Business Logic:**
  - `web/lib/auth.ts`, `web/lib/chat_storage.ts`, `web/lib/db.ts`, `web/lib/documents.ts`, `web/lib/utils.ts`
  - `web/lib/ai/*` (chunking, context_builder, embedding_cache, embedding_provider, hybrid_retrieval, provider, retrieval, semantic_search, service, test_ai)
  - `web/lib/auth/*` (adminFetch, config, password, server, session, types)
  - `web/lib/crawler/index.ts`
  - `web/lib/storage/*` (adapter, index)
- **Database & Prisma:**
  - `web/prisma/schema.prisma`
  - `web/prisma/migrations/**/*` (20260925135936_init, 20260925162748_add_imported_documents, 20260925164344_add_imported_documents, migration_lock.toml)
- **Crawler Python Core:**
  - `crawler/config.py`, `crawler/parser.py`, `crawler/dau_crawler.py`, `crawler/run_crawler_cli.py`, `crawler/document_extractor.py`, `crawler/ocr_extractor.py`, `crawler/ocr_quality.py`, `crawler/data_normalizer.py`, `crawler/data_quality.py`, `crawler/validity_extractor.py`, `crawler/extract_for_import.py`, `crawler/apply_validity_analysis.py`, `crawler/downloader.py`, `crawler/local_importer.py`, `crawler/detail_processor.py`, `crawler/main.py`
- **Data & Datasets (Kho tri thức & Hồ sơ Crawl):**
  - `crawler/data/normalized/documents.json` (116 văn bản chuẩn hóa)
  - `crawler/data/normalized/notifications.json`
  - `crawler/data/normalized/normalization_report.json`, `crawler/data/normalized/data_quality_report.json`
  - `crawler/data/documents/crawled/*.html` (43 files cache HTML)
  - `crawler/data/extracted/**/*.json` (10 files metadata trích xuất)
  - `crawler/input/**/*.html` (HTML mẫu thông báo)
  - `web/uploads/imported/**/*` (Các file PDF gốc import)
- **Config & Build Setup:**
  - `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `next-env.d.ts`, `requirements.txt`, `.gitignore`, `web/.gitignore`
- **Documentation & Secrets (Bảo toàn tuyệt đối):**
  - `README.md`, `ADMIN_GUIDE.md`, `DEFENSE_QA.md`, `crawler/README.md`, `crawler/input/README.md`, `web/README.md`, `web/AGENTS.md`
  - `.env.example`, `web/.env.example`, `web/.env`, `web/.env.local`, `web/.env.txt`, `crawler/cookies.txt`

---

### 2. GROUP B — CÓ THỂ DƯ THỪA (NEEDS_REVIEW - GIỮ LẠI ĐỂ ĐẢM BẢO AN TOÀN)
- `crawler/expand_dataset.py`, `crawler/expand_part2.py` (Script mở rộng dữ liệu lịch sử)
- `web/test-step16.js`, `web/test-auth.js`, `web/test-retrieval.js` (Test scripts các giai đoạn trước)
- `web/scripts/audit_dataset.js`, `web/scripts/build_embeddings.js`, `web/scripts/check-db.js`, `web/scripts/seed-admin.js`, `web/scripts/worker.js`
- **Đánh giá rủi ro:** Có thể là tiện ích phục vụ bảo trì, benchmark hoặc audit thủ công.
- **Hành động:** **KEEP (GIỮ LẠI)** theo nguyên tắc *AN TOÀN > DỌN SẠCH*.

---

### 3. GROUP C — FILE TEST / REGRESSION (KEEP - 100% GIỮ LẠI)
- `web/test-step21-bulk-import.js`
- `web/test-step20-crawler.js`
- `web/test-step19-validity.js`
- `web/test-step18.js`
- `web/test-step17.js`
- `web/test-bulk-verify-documents.js`
- `web/test-bulk-verify.js`
- `web/test-citations.js`
- `web/test-e2e.js`
- `web/test-semantic.js`
- `crawler/test_parser.py`
- `crawler/test_data_normalizer.py`
- `crawler/test_data_quality.py`
- `crawler/test_detail_processor.py`
- `crawler/test_document_extractor.py`
- `crawler/test_downloader.py`
- `crawler/test_local_importer.py`
- `crawler/test_ocr_extractor.py`
- `crawler/test_ocr_quality.py`

---

### 4. GROUP D — FILE SINH TỰ ĐỘNG / CACHE / BUILD (SAFE_TO_DELETE)
- `crawler/__pycache__/*.pyc` (28 file bytecode Python biên dịch tự động)
- **Lý do xóa:** Python bytecode tự sinh trong quá trình chạy unittest/pytest, không chứa mã nguồn gốc, an toàn 100% khi dọn dẹp.

---

## BẢNG CHI TIẾT ĐỐI TƯỢNG CLEANUP

| STT | File / Đường dẫn | Phân loại | Mục đích / Vai trò | Đánh giá | Quyết định |
|:---|:---|:---|:---|:---|:---|
| 1 | `crawler/__pycache__/*.pyc` | GROUP D (Cache) | Bytecode biên dịch Python runtime | Cache tự sinh, tự tái tạo khi chạy Python | **SAFE_TO_DELETE** |
| 2 | Tất cả file source, data, config, test, doc | GROUP A, B, C | Mã nguồn, dữ liệu RAG, test regression, configs | Thành phần cốt lõi của hệ thống | **KEEP** |

---

## KẾ HOẠCH DỌN DẸP AN TOÀN
1. Dọn dẹp các file cache compiled Python bytecode trong `crawler/__pycache__`.
2. Giữ nguyên 100% source code TypeScript, Python, schema Prisma, migrations, dữ liệu JSON, PDF uploads, và test suite.
3. Chạy lại toàn bộ regression test suite và Next.js build để đảm bảo 0 lỗi phát sinh.
