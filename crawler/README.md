# DAU-Second-Brain - Crawler Module

Module thu thập kho văn bản và thông báo chính thức từ Cổng thông tin Sinh viên Trường Đại học Kiến trúc Đà Nẵng (DAU).

## 1. Cấu trúc thư mục

```text
DAU-Second-Brain/
├── crawler/
│   ├── data/
│   │   ├── notifications.json      # File JSON lưu danh sách thông báo chính thức
│   │   ├── details/                # Cache HTML các trang chi tiết đã tải về
│   │   └── documents/              # Thư mục lưu tài liệu đính kèm (.pdf, .doc, .docx) theo năm
│   │       └── 2026/
│   ├── input/                      # Thư mục đặt các file HTML danh sách và tài liệu ngoại tuyến
│   │   ├── details/                # Thư mục đặt các file HTML trang chi tiết lưu từ trình duyệt
│   │   │   └── README.md           # Danh sách URL chi tiết và hướng dẫn lưu file
│   │   └── README.md               # Hướng dẫn đặt file vào input/
│   ├── __init__.py                 # Khởi tạo package
│   ├── config.py                   # Cấu hình URL, headers, cookie, thư mục mặc định
│   ├── parser.py                   # Bóc tách tiêu đề, ngày, URL chi tiết, nội dung, file đính kèm
│   ├── dau_crawler.py              # Class điều phối quá trình crawl trang danh sách
│   ├── local_importer.py           # Module import dữ liệu từ file danh sách cục bộ
│   ├── detail_processor.py         # Module xử lý file HTML chi tiết thủ công
│   ├── downloader.py               # MODULE MỚI: Tự động tải trang chi tiết và tài liệu đính kèm
│   ├── main.py                     # Giao diện dòng lệnh (CLI entrypoint) cho Crawler
│   ├── test_parser.py              # Bộ kiểm thử tự động cho Parser (6 tests)
│   ├── test_local_importer.py      # Bộ kiểm thử tự động cho LocalImporter (5 tests)
│   ├── test_detail_processor.py    # Bộ kiểm thử tự động cho DetailProcessor (4 tests)
│   ├── test_downloader.py          # Bộ kiểm thử tự động cho Downloader (24 tests)
│   └── README.md                   # Tài liệu hướng dẫn này
├── .env.example                    # File mẫu cấu hình biến môi trường
└── requirements.txt                # Thư viện phụ thuộc (requests, beautifulsoup4)
```

## 2. Cài đặt môi trường

Cài đặt các gói phụ thuộc:
```bash
pip install -r requirements.txt
```

---

## 3. Cơ chế hoạt động & Xác thực (Authentication)

Trang thông báo chính thức `https://sinhvien.dau.edu.vn/sinh-vien/dm-tin/thong-bao.html?page=1&pageSize=50` thuộc hệ thống Cổng thông tin sinh viên DAU (nền tảng OneUni/ASC), được bảo vệ nghiêm ngặt:
- Khi chưa đăng nhập hoặc phiên hết hạn, máy chủ trả về `HTTP 302` chuyển hướng đến `/SinhVien/Logout` và `/sinh-vien-dang-nhap.html`.
- Trang đăng nhập yêu cầu: `UserName` (Mã sinh viên), `Password` (Mật khẩu) và `Captcha` (Mã xác thực hình ảnh).
- Tuân thủ nguyên tắc an toàn: **TUYỆT ĐỐI KHÔNG tự ý bypass đăng nhập hoặc giải CAPTCHA.**
- Nếu không có phiên xác thực hợp lệ, module tự động dừng an toàn và thông báo:
  `"Website yêu cầu đăng nhập, cần cung cấp phiên đăng nhập hợp lệ."`

### Cách lấy chuỗi Cookie phiên làm việc từ trình duyệt:
1. Mở trình duyệt (Chrome/Edge/Firefox) và truy cập: [https://sinhvien.dau.edu.vn](https://sinhvien.dau.edu.vn)
2. Đăng nhập bằng tài khoản sinh viên và nhập CAPTCHA thành công.
3. Nhấn phím `F12` (Developer Tools) -> chuyển sang tab **Network** (hoặc tab **Application** -> Cookies).
4. Chọn một request bất kỳ đến `sinhvien.dau.edu.vn` (hoặc nhấn `F5` tải lại trang).
5. Trong phần **Headers** -> **Request Headers**, sao chép toàn bộ chuỗi của trường **`Cookie`** (gồm `ASP.NET_SessionId=...; .ASPXAUTH=...`).

---

## 4. Module Downloader Tự Động (`crawler/downloader.py`)

Module `crawler/downloader.py` chịu trách nhiệm tự động hóa pipeline thu thập dữ liệu chi tiết và tài liệu đính kèm:
1. Đọc danh sách thông báo từ `crawler/data/notifications.json`.
2. Với mỗi thông báo:
   - Lấy `detail_url` và tải trang HTML chi tiết.
   - Lưu cache HTML tại `crawler/data/details/<slug>.html` để không tải lại trong các lần chạy sau.
3. Trích xuất file đính kèm: Chỉ nhận các định dạng tài liệu hợp lệ (`.pdf`, `.doc`, `.docx`).
4. Chuẩn hóa URL đính kèm: Giải mã và bóc tách các link xem online dạng `/FileManager/ViewFileOnline?filePath=...` về URL file thực tế.
5. Chống tải trùng lặp:
   - Các link khác nhau trỏ về cùng một file thực tế chỉ được tải duy nhất 1 lần.
   - Nếu file tài liệu đã tồn tại trong `crawler/data/documents/<year>/` với kích thước > 0, hệ thống ghi nhận `[CACHE]` và bỏ qua tải lại.
6. Đảm bảo tên file an toàn trên Windows: Tự động loại bỏ các ký tự cấm (`< > : " / \ | ? *`), ký tự điều khiển, cắt bỏ dấu chấm/khoảng trắng ở đuôi, xử lý tên thiết bị bảo lưu (`CON`, `PRN`, `AUX`, `NUL`...).
7. Đối sánh CHÍNH XÁC (STRICT MATCHING):
   - Ưu tiên 1: `data-post-id` nếu có.
   - Ưu tiên 2: Canonical URL / `og:url` trùng `detail_url`.
   - Ưu tiên 3: URL hoặc slug trùng khớp 100%.
   - Ưu tiên 4: Tiêu đề chuẩn hóa trùng khớp 100% (độ dài >= 15 ký tự).
   - Nếu không chắc chắn: BỎ QUA, ghi WARNING, tuyệt đối không dùng fuzzy matching để ép ghép nội dung sai.
8. Xử lý mã HTTP:
   - `200`: Xử lý dữ liệu.
   - `401 / 403`: Báo yêu cầu đăng nhập và dừng an toàn.
   - `404`: Ghi log cảnh báo WARNING và bỏ qua.
   - `429`: Áp dụng exponential backoff (thử lại sau 1s, 2s, 4s tối đa 3 lần), nếu vượt quá sẽ dừng an toàn báo rate limit.
   - Chuyển hướng trang login / CAPTCHA: Dừng an toàn, không bypass.

### Chạy ở chế độ Chạy Thử (Dry-Run):
Chế độ dry-run chỉ phân tích, kiểm tra URL và attachment phát hiện được mà không tạo thư mục, không ghi cache HTML, không tải tài liệu và không sửa file `notifications.json`:
```bash
python -m crawler.downloader --dry-run
```

### Chạy tải thật:
Khi đã cung cấp cookie phiên làm việc:
```bash
# Cách 1: Truyền trực tiếp qua cờ --cookie
python -m crawler.downloader --cookie "ASP.NET_SessionId=...; .ASPXAUTH=..."

# Cách 2: Lưu chuỗi cookie vào crawler/cookies.txt và chạy:
python -m crawler.downloader

# Cách 3: Thiết lập biến môi trường DAU_COOKIE trong file .env
python -m crawler.downloader
```

### Mẫu báo cáo tổng kết sau khi chạy:
```text
=============================================================
 DAU SECOND BRAIN - DOWNLOADER
=============================================================
Danh sách thông báo       : 10
Trang chi tiết tải được   : X
Khớp chính xác            : X
Bỏ qua                    : X
Attachment phát hiện      : X
Attachment tải thành công : X
Attachment cache          : X
=============================================================
```

---

## 5. Các Module Bổ Trợ & Ngoại Tuyến (Offline)

### Module nhập liệu offline (`crawler/local_importer.py`)
Dành cho trường hợp bạn lưu trang danh sách thông báo từ trình duyệt về máy:
1. Đặt file HTML vào: `crawler/input/thong-bao.html`
2. Chạy lệnh:
   ```bash
   python -m crawler.local_importer
   ```

### Module xử lý trang chi tiết offline (`crawler/detail_processor.py`)
Dành cho trường hợp bạn lưu từng trang chi tiết từ trình duyệt vào thư mục:
1. Đặt các file HTML chi tiết vào: `crawler/input/details/`
2. Chạy lệnh:
   ```bash
   python -m crawler.detail_processor
   ```

---

## 6. Chạy Kiểm Thử Tự Động (Unit Tests)

Hệ thống được bảo vệ bởi 39 bài test tự động bao phủ 100% các tình huống biên:
```bash
# Chạy toàn bộ 39 unit tests
python -m unittest discover -s crawler

# Hoặc chạy riêng từng test suite:
python -m unittest crawler.test_downloader
python -m unittest crawler.test_detail_processor
python -m unittest crawler.test_local_importer
python -m unittest crawler.test_parser
```

---

## 7. Cấu trúc dữ liệu đầu ra (`crawler/data/notifications.json`)

```json
[
  {
    "title": "Thông báo tổ chức khảo sát năng lực Toán học cho sinh viên khóa tuyển sinh năm 2026.",
    "date": "28/08/2026",
    "detail_url": "https://sinhvien.dau.edu.vn/sinh-vien/tin/thong-bao-to-chuc-khao-sat-nang-luc-toan-hoc-cho-sinh-vien-khoa-tuyen-sinh-nam-2026.html",
    "content": "Thông báo tổ chức khảo sát năng lực Toán học cho sinh viên khóa tuyển sinh năm 2026...",
    "attachments": [
      "https://media.dau.edu.vn/Media/2_SVDAU/FolderFunc/202608/Documents/43-tb-dhktdn-to-chuc-khao-sat-danh-gia-nang-luc-hoc-phan-toan-20260828015324-e.pdf"
    ],
    "crawl_status": "success",
    "crawled_at": "2026-09-10T14:30:00.000000",
    "content_source": "cache",
    "attachments_downloaded": [
      "documents/2026/43-tb-dhktdn-to-chuc-khao-sat-danh-gia-nang-luc-hoc-phan-toan-20260828015324-e.pdf"
    ]
  }
]
```

---

## 8. Module Trích Xuất Văn Bản (`crawler/document_extractor.py`)

Module đọc nội dung từ file đính kèm (`.pdf`, `.docx`, `.doc`), giữ page number và phân tách text thô vs text làm sạch:
- PDF: Dùng PyMuPDF (`fitz`) đọc text layer. Nếu không có text layer (PDF scan), đánh dấu `needs_ocr`.
- DOCX: Dùng `python-docx` trích xuất paragraph và bảng.
- Kết quả lưu trung gian tại `crawler/data/extracted/<year>/<slug>.json`.

```bash
# Xử lý toàn bộ tài liệu
python -m crawler.document_extractor

# Xử lý một file cụ thể
python -m crawler.document_extractor --file crawler/data/documents/2026/43-tb-dhktdn-to-chuc-khao-sat-danh-gia-nang-luc-hoc-phan-toan-20260828015324-e.pdf
```

---

## 9. Module OCR Pipeline (`crawler/ocr_extractor.py`)

Xử lý các file PDF scan ảnh được đánh dấu `needs_ocr`:
1. Dùng PyMuPDF render trang PDF thành ảnh (mặc định 200 DPI).
2. Dùng `pytesseract` nhận dạng chữ (ưu tiên `vie+eng`, fallback `eng`).
3. Cập nhật `extraction_status = "ocr"` và lưu `raw_text`, `cleaned_text` vào file JSON tại `crawler/data/extracted/`.
4. Không bao giờ tự ý bịa, sửa, hoặc suy đoán nội dung pháp lý.

### Kiểm tra Tesseract và Gói Ngôn ngữ Tiếng Việt
- Kiểm tra cài đặt Tesseract trên máy:
  ```powershell
  tesseract --version
  ```
- Kiểm tra ngôn ngữ hỗ trợ:
  ```powershell
  tesseract --list-langs
  ```
- Nếu chưa có `vie.traineddata`:
  - Tải file từ [tesseract-ocr/tessdata](https://github.com/tesseract-ocr/tessdata/raw/main/vie.traineddata)
  - Đặt vào thư mục `tessdata` (ví dụ: `C:\Program Files\Tesseract-OCR\tessdata\` hoặc `C:\Program Files\Tesseract-OCR\tesseract.exe\tessdata\`).
  - Hoặc cấu hình đường dẫn qua biến môi trường:
    ```powershell
    $env:TESSDATA_PREFIX = "C:\Program Files\Tesseract-OCR\tessdata"
    $env:TESSERACT_CMD = "C:\Program Files\Tesseract-OCR\tesseract.exe"
    ```

### Lệnh thực thi OCR

```bash
# Chạy thử nghiệm không ghi đĩa
python -m crawler.ocr_extractor --dry-run

# Chạy OCR toàn bộ tài liệu needs_ocr
python -m crawler.ocr_extractor

# Chạy OCR một file cụ thể
python -m crawler.ocr_extractor --file crawler/data/documents/2026/43-tb-dhktdn-to-chuc-khao-sat-danh-gia-nang-luc-hoc-phan-toan-20260828015324-e.pdf

# Ép OCR lại ngay cả khi file đã được xử lý (mặc định dùng vie+eng)
python -m crawler.ocr_extractor --force --lang vie+eng
```

---

## 10. Module Đánh Giá Chất Lượng OCR (`crawler/ocr_quality.py`)

Module tự động kiểm tra, rà soát và đánh giá chất lượng văn bản sau OCR bằng phương pháp **Heuristic (Rule-based)**, tuyệt đối không dùng AI/LLM và không tự ý sửa đổi văn bản:
- Tính toán 10 nhóm chỉ số: độ dài văn bản, số ký tự không phải whitespace, tỷ lệ tiếng Việt có dấu, tỷ lệ chữ/số, tỷ lệ ký tự bất thường, tỷ lệ ký tự lặp, tỷ lệ trang rỗng, số dòng, số từ, và nhận diện mẫu pháp lý hành chính.
- Phát hiện các bất thường: trang bị rỗng, văn bản bị đứt gãy, tỷ lệ ký tự lạ tăng đột biến.
- Điểm số chất lượng phân theo các mức:
  - `90 - 100`: **GOOD** (Rất tốt, đầy đủ dấu tiếng Việt, ít rác)
  - `70 - 89`: **ACCEPTABLE** (Chấp nhận được, có thể có bảng biểu hoặc ký tự mờ)
  - `50 - 69`: **WARNING** (Cảnh báo: có trang rỗng hoặc nhiều ký tự lạ, cần kiểm tra thủ công)
  - `0 - 49`: **POOR** (Chất lượng kém, hầu như không có text hoặc OCR hỏng)

> **Lưu ý quan trọng:**  
> Quality score là heuristic để phát hiện OCR đáng ngờ, **không phải phần trăm độ chính xác OCR**.

### Lệnh thực thi Kiểm tra Chất lượng:

```bash
# Đánh giá toàn bộ tài liệu đã trích xuất và xuất báo cáo ocr_quality_report.json
python -m crawler.ocr_quality

# Kiểm tra chất lượng một file JSON cụ thể
python -m crawler.ocr_quality --file crawler/data/extracted/2026/43-tb-dhktdn-to-chuc-khao-sat-danh-gia-nang-luc-hoc-phan-toan-20260828015324-e.json

# Xuất báo cáo ra đường dẫn tùy chỉnh
python -m crawler.ocr_quality --output crawler/data/my_custom_report.json
```

---

## 11. Module Chuẩn Hóa Dữ Liệu (`crawler/data_normalizer.py`)

Module kết nối dữ liệu từ `notifications.json` và các tệp OCR extracted trong `crawler/data/extracted/` để đưa về **Data Schema chuẩn thống nhất**:

### Pipeline Tổng Thể
```text
Website DAU
    ↓ (Crawler / Downloader)
HTML Cache & PDF Files
    ↓ (Document Extractor)
Text Layer / needs_ocr JSON
    ↓ (OCR Extractor vie+eng)
Vietnamese OCR JSON
    ↓ (OCR Quality Audit)
Quality Scored Data
    ↓ (Data Normalizer)
Normalized Dataset (crawler/data/normalized/documents.json)
```

> **Lưu ý quan trọng về Dataset:**  
> Tập dữ liệu chuẩn hóa hiện tại là **DATASET MẪU (10 tài liệu)** dùng để kiểm thử toàn bộ luồng pipeline từ đầu đến cuối. Dữ liệu thật sẽ được thay thế hoặc bổ sung đầy đủ khi giảng viên / nhà trường cung cấp kho văn bản chính thức.

### Schema Chuẩn Của Document

```json
{
  "id": "dau_doc_6f16da4ce50f",
  "title": "Tiêu đề thông báo / văn bản",
  "document_number": "43/TB-ĐHKTĐN",
  "issue_date": "2026-08-28",
  "issuing_unit": "Trường Đại học Kiến trúc Đà Nẵng",
  "category": "Khảo sát",
  "subcategory": "Khảo sát sinh viên",
  "deadline": null,
  "effective_status": "unknown",
  "effective_from": null,
  "effective_to": null,
  "replaced_by": null,
  "source_url": "https://media.dau.edu.vn/...pdf",
  "detail_url": "https://sinhvien.dau.edu.vn/...html",
  "source_file": "E:/.../documents/2026/...pdf",
  "file_format": "pdf",
  "total_pages": 2,
  "content": "Nội dung đầy đủ gộp từ các trang OCR...",
  "pages": [
    {
      "page_number": 1,
      "raw_text": "...",
      "cleaned_text": "..."
    }
  ],
  "attachments": [ "https://..." ],
  "metadata": {
    "crawled_at": "...",
    "crawl_status": "success",
    "content_source": "cache",
    "raw_issue_date": "28/08/2026",
    "ocr_quality": { "score": 100, "label": "GOOD" }
  },
  "provenance": {
    "notification_index": 0,
    "notification_title": "...",
    "detail_file": "E:/.../details/...html",
    "document_file": "E:/.../documents/...pdf",
    "extracted_file": "E:/.../extracted/...json"
  }
}
```

### Ý Nghĩa Các Trường Dữ Liệu
- `id`: Mã định danh duy nhất (dựa trên SHA-256 của URL/File và index).
- `title`: Tiêu đề chính thức của thông báo/văn bản.
- `document_number`: Số hiệu văn bản hành chính (ví dụ: `43/TB-ĐHKTĐN`). Nếu không thể trích xuất chính xác thì để `null`.
- `issue_date`: Ngày ban hành văn bản định dạng chuẩn ISO `YYYY-MM-DD`.
- `issuing_unit`: Đơn vị ban hành (chỉ điền khi văn bản thể hiện rõ ràng, ngược lại để `null`).
- `category` & `subcategory`: Phân loại sơ bộ nếu tiêu đề thể hiện rõ ràng (ví dụ: `Học phí`, `Khảo thí`, `Chuẩn đầu ra`). Không tự ý đoán bừa.
- `deadline`: Hạn chót thực hiện (để `null` nếu chưa có dữ liệu cấu trúc rõ ràng).
- `effective_status`: Trạng thái hiệu lực (`unknown`, `effective`, `expired`). Với dữ liệu mẫu hiện tại, mặc định là `unknown` vì không được tự ý suy đoán theo thời gian thực.
- `effective_from`, `effective_to`, `replaced_by`: Ngày bắt đầu, kết thúc hiệu lực hoặc văn bản thay thế (để `null`).
- `source_url`, `detail_url`, `source_file`: Đường dẫn gốc trên web và đường dẫn tệp tài liệu cục bộ.
- `content`: Toàn bộ nội dung văn bản trích xuất nguyên gốc từ OCR, không tóm tắt, không dùng AI viết lại.
- `pages`: Danh sách từng trang giữ nguyên `page_number`, `raw_text`, `cleaned_text`.
- `provenance`: Nguồn gốc xuất xứ, cho phép truy vết ngược về tệp HTML trang chi tiết, tệp PDF gốc và tệp JSON kết quả OCR.

### Lệnh Thực Thi Chuẩn Hóa:

```bash
# Chuẩn hóa toàn bộ dataset và xuất ra crawler/data/normalized/documents.json
python -m crawler.data_normalizer

# Tùy chỉnh đường dẫn đầu vào và đầu ra:
python -m crawler.data_normalizer --notifications crawler/data/notifications.json --extracted-dir crawler/data/extracted --normalized-dir crawler/data/normalized
```

---

## 12. Module Kiểm Tra Chất Lượng Dữ Liệu (`crawler/data_quality.py`)

Module kiểm tra toàn diện chất lượng của dataset đã chuẩn hóa bằng **15 quy tắc deterministic (Checks 1 - 15)** trước khi đưa vào các hệ thống Second Brain, tuyệt đối không dùng AI/LLM:

### 15 Tiêu Chí Kiểm Tra (Checks 1 - 15)
1. **Title**: Tiêu đề bắt buộc tồn tại, không rỗng và là chuỗi hợp lệ (`ERROR` nếu thiếu).
2. **Document Number**: Số hiệu văn bản (chỉ cảnh báo `WARNING` nếu `null`, không tự đoán).
3. **Issue Date**: Ngày ban hành phải đúng chuẩn `YYYY-MM-DD` và hợp lệ (`ERROR` nếu sai định dạng, `WARNING` nếu thiếu).
4. **Source URL**: Bắt buộc tồn tại và không rỗng (`ERROR` nếu thiếu).
5. **Source File**: Đường dẫn tệp bắt buộc tồn tại và tệp phải có mặt trên filesystem (`ERROR` nếu thiếu hoặc không tìm thấy tệp).
6. **Content**: Nội dung văn bản bắt buộc không rỗng (`ERROR` nếu rỗng, `WARNING` nếu < 100 ký tự).
7. **Page Count**: So sánh `total_pages` với số phần tử trong `pages` (`ERROR` nếu không khớp).
8. **OCR Text Length**: Cảnh báo từng trang nếu văn bản quá ngắn (< 30 ký tự) (`WARNING`).
9. **Suspicious Characters**: Phát hiện chuỗi lặp bất thường hoặc pattern OCR hỏng (`WARNING`).
10. **Non-Alphanumeric Ratio**: Cảnh báo nếu tỷ lệ ký tự lạ / không phải chữ số quá cao (`WARNING`).
11. **Metadata vs OCR Consistency**: Rà soát mâu thuẫn giữa ngày/năm ban hành và nội dung OCR (`WARNING`).
12. **Title vs Content Relation**: Kiểm tra mức độ xuất hiện từ khóa tiêu đề trong văn bản (`WARNING`).
13. **Duplicate Detection**: Phát hiện trùng lặp document theo ID, URL hoặc tệp tài liệu (`WARNING`).
14. **Provenance**: Rà soát đầy đủ thông tin nguồn (`notification_index`, `detail_file`, `document_file`, `extracted_file`) (`WARNING`).
15. **Effective Status**: Kiểm tra trạng thái hiệu lực (phải là `unknown` nếu chưa có căn cứ chính thức) (`WARNING`).

### Phân Loại Trạng Thái & Điểm Số
- **Điểm số (0 - 100)**: Bắt đầu 100 điểm, mỗi `ERROR` trừ 25 điểm, mỗi `WARNING` trừ 5 điểm.
- **GOOD**: Không có lỗi `ERROR` và điểm >= 85 (Đạt chuẩn sẵn sàng sử dụng).
- **WARNING**: Có cảnh báo cần con người rà soát nhưng dataset vẫn sử dụng được.
- **ERROR**: Có lỗi nghiêm trọng, dữ liệu không đủ điều kiện sử dụng.

### Lệnh Thực Thi Kiểm Tra:

```bash
# Kiểm tra toàn bộ dataset chuẩn hóa và xuất báo cáo:
python -m crawler.data_quality

# Tùy chỉnh đường dẫn tệp kiểm tra và báo cáo:
python -m crawler.data_quality --file crawler/data/normalized/documents.json --output crawler/data/normalized/data_quality_report.json
```

