# BỘ CÂU HỎI & TRẢ LỜI BẢO VỆ ĐỒ ÁN (DEFENSE Q&A)
## DAU Second Brain — Hệ Thống Trợ Lý Tra Cứu Văn Bản Nhà Trường

Tài liệu chuẩn bị câu trả lời ngắn gọn, chuẩn xác, khiêm tốn và đúng trọng tâm kỹ thuật dành cho sinh viên khi phản biện trước Hội đồng chấm đồ án.

---

### Q1. Đề tài của em là gì?
**Trả lời:**  
Dạ thưa Thầy/Cô, đề tài của em là **"Xây dựng hệ thống trợ lý tra cứu và hỏi đáp văn bản quy định nhà trường có trích dẫn nguồn"** dành cho Trường Đại học Kiến trúc Đà Nẵng, ứng dụng kiến trúc RAG (Retrieval-Augmented Generation) kết hợp bóc tách OCR tiếng Việt.

---

### Q2. "Second Brain" nghĩa là gì trong ngữ cảnh đề tài này?
**Trả lời:**  
Dạ, "Second Brain" (Bộ nội thứ hai) là khái niệm quản trị tri thức số. Trong đề tài này, hệ thống đóng vai trò như một bộ lưu trữ và xử lý tri thức tập trung, giúp sinh viên không cần phải tự nhớ hay lục tìm thủ công hàng trăm tệp PDF thông báo, mà có thể truy truy vấn nhanh chóng và chính xác bất cứ lúc nào.

---

### Q3. Tại sao không dùng chatbot thông thường như ChatGPT hay Gemini trực tiếp mà phải làm hệ thống này?
**Trả lời:**  
Dạ, các mô hình ngôn ngữ lớn (LLM) thông thường không được huấn luyện trên dữ liệu nội bộ riêng của nhà trường và rất dễ gặp hiện tượng ** ảo giác (hallucination)** — tự bịa thông tin khi không biết. Hệ thống của em cung cấp cơ chế RAG để neo giữ câu trả lời dựa trên chính xác văn bản hành chính của trường và bắt buộc phải có trích dẫn nguồn đối chứng.

---

### Q4. RAG là gì?
**Trả lời:**  
Dạ, RAG là viết tắt của **Retrieval-Augmented Generation** (Tạo sinh tăng cường truy xuất). Quy trình gồm 2 bước: Bước 1 (*Retrieval*) là tìm kiếm các đoạn văn bản liên quan nhất từ kho dữ liệu; Bước 2 (*Generation*) là nạp các đoạn văn bản đó làm ngữ cảnh (Context) để mô hình AI đọc và tổng hợp câu trả lời cho người dùng.

---

### Q5. Retrieval trong hệ thống của em hoạt động như thế nào?
**Trả lời:**  
Dạ, Retrieval là tầng truy xuất tài liệu. Khi sinh viên đặt câu hỏi, module Retrieval sẽ phân tích từ khóa, số hiệu công văn và ý định ngữ nghĩa, sau đó quét qua kho văn bản đã số hóa để chọn ra từ 3 đến 4 đoạn văn bản (chunks) có điểm số phù hợp nhất.

---

### Q6. Hybrid Search là gì? Tại sao lại dùng Hybrid Search?
**Trả lời:**  
Dạ, Hybrid Search là sự kết hợp giữa **Keyword Search** (tìm kiếm theo từ khóa chính xác) và **Semantic Search** (tìm kiếm theo ý nghĩa ngữ nghĩa). Sự kết hợp này mang lại độ chính xác cao nhất: vừa bắt chính xác các số hiệu công văn hay năm học (như `34/TB-ĐHKTĐN`), vừa hiểu được câu hỏi khi sinh viên dùng từ ngữ đời thường (như dùng "tiền học" thay vì "học phí").

---

### Q7. Keyword Search dùng để làm gì trong hệ thống?
**Trả lời:**  
Dạ, Keyword Search phụ trách tìm kiếm chính xác các thực thể định danh cố định, đặc biệt là **Số hiệu văn bản** (như `607/QĐ`, `34/TB`), **Năm học** (như `2026-2027`), và **Chủ đề đào tạo** đã được chuẩn hóa.

---

### Q8. Semantic Search dùng để làm gì?
**Trả lời:**  
Dạ, Semantic Search dùng để thấu hiểu ngữ cảnh và câu hỏi có cách diễn đạt tự nhiên, giúp hệ thống vẫn tìm ra văn bản liên quan ngay cả khi người dùng không gõ đúng từ ngữ hành chính có trong tiêu đề.

---

### Q9. Embedding là gì?
**Trả lời:**  
Dạ, Embedding là kỹ thuật chuyển đổi một câu hoặc đoạn văn bản thành một vector số nhiều chiều trong không gian toán học. Các đoạn văn có ý nghĩa tương đồng nhau sẽ có khoảng cách vector gần nhau, được đo lường bằng thuật toán Cosine Similarity.

---

### Q10. Context Builder làm gì?
**Trả lời:**  
Dạ, Context Builder có nhiệm vụ thu gom các đoạn văn bản đạt điểm cao nhất từ bước Retrieval, đính kèm số trang và số hiệu cụ thể, sau đó đóng gói thành một Prompt ngữ cảnh có rào chắn chống ảo giác gửi đến mô hình tổng hợp.

---

### Q11. Tại sao cần trích dẫn nguồn (Citation) trong hệ thống giáo dục?
**Trả lời:**  
Dạ, trong môi trường học thuật và thủ tục nhà trường, độ tin cậy là ưu tiên số 1. Trích dẫn nguồn kèm số trang (`#page-n`) giúp sinh viên và phụ huynh có thể tự mình kiểm chứng ngay trên văn bản gốc có mộc đỏ, đảm bảo tính pháp lý và yên tâm khi thực hiện nghĩa vụ học tập.

---

### Q12. Làm sao hệ thống của em hạn chế được việc AI bịa đặt thông tin?
**Trả lời:**  
Dạ, hệ thống áp dụng 3 lớp bảo vệ:
1. **System Prompt nghiêm ngặt:** Cấm AI suy đoán ngoài ngữ cảnh.
2. **Compound Phrase Gating:** Nếu câu hỏi chứa các chủ đề lạ ngoài kho dữ liệu, hệ thống ngắt truy vấn và từ chối trả lời ngay từ tầng Retrieval.
3. **Backend Citation Mapping:** Nguồn trích dẫn do Backend tự động lấy từ cơ sở dữ liệu thật, mô hình AI hoàn toàn không có quyền tự sinh nguồn.

---

### Q13. Nếu không tìm thấy văn bản liên quan trong kho dữ liệu thì hệ thống xử lý ra sao?
**Trả lời:**  
Dạ, hệ thống sẽ trả về câu thông báo rõ ràng: *"Tôi chưa tìm thấy thông tin phù hợp trong dữ liệu văn bản hiện có của DAU."* và không hiển thị nguồn trích dẫn nào, tuyệt đối không bịa đặt câu trả lời.

---

### Q14. Dữ liệu văn bản hiện tại của đề tài lấy từ đâu?
**Trả lời:**  
Dạ, dữ liệu hiện tại gồm 10 văn bản mẫu được thu thập từ các thông báo công khai của Trường Đại học Kiến trúc Đà Nẵng, bao gồm các chủ đề học phí, khảo thí, chuẩn đầu ra và khảo sát sinh viên, sau đó được bóc tách và chuẩn hóa vào tệp JSON có phân trang chi tiết.

---

### Q15. Tại sao không crawl tự động toàn bộ website và portal sinh viên của trường?
**Trả lời:**  
Dạ, vì cổng thông tin sinh viên yêu cầu tài khoản bảo mật và cơ chế chống bot. Đề tài tuân thủ nguyên tắc an toàn thông tin mạng, không thực hiện hành vi tấn công hay bypass trái phép, mà sử dụng cơ chế import dữ liệu có kiểm soát và xác minh nguồn gốc.

---

### Q16. Google Gemini nằm ở vị trí nào trong hệ thống?
**Trả lời:**  
Dạ, Gemini nằm ở bước cuối cùng của pipeline (tầng Generation), nhận nhiệm vụ đọc ngữ cảnh đã được chuẩn bị sẵn và viết lại câu trả lời thành văn phong tiếng Việt tự nhiên, súc tích cho sinh viên.

---

### Q17. Nếu Google Gemini hết hạn ngạch (quota limit) hoặc mất kết nối thì sao?
**Trả lời:**  
Dạ, hệ thống đã thiết lập cơ chế **Fallback an toàn**: tự động bắt mã lỗi 429 hoặc timeout sau 15 giây, sau đó lập tức chuyển đổi sang bộ trích xuất cục bộ (Local Extractive Synthesizer) để trả lời người dùng mà không bị crash hay retry vô hạn.

---

### Q18. Tại sao cần có bộ trích xuất cục bộ (Local Extractive Synthesizer)?
**Trả lời:**  
Dạ, để hệ thống có khả năng hoạt động ngoại tuyến (offline) hoàn toàn khi đi demo, không bị gián đoạn bởi đường truyền mạng hay chi phí API của bên thứ ba, đồng thời chứng minh kiến trúc phần mềm hoàn toàn độc lập và linh hoạt.

---

### Q19. Hệ thống này có thay thế cổng thông tin hay website chính thức của nhà trường không?
**Trả lời:**  
Dạ không ạ. Hệ thống này đóng vai trò là một **công cụ tra cứu bổ trợ** giúp sinh viên tìm kiếm thông tin nhanh hơn. Trong mọi trường hợp, văn bản có dấu mộc đỏ và các thông báo trên cổng thông tin chính thức của nhà trường vẫn là căn cứ pháp lý cao nhất.

---

### Q20. Hạn chế hiện tại của đề tài là gì và hướng phát triển tiếp theo?
**Trả lời:**  
Dạ, hạn chế hiện tại là tập dữ liệu thử nghiệm mới gồm 10 văn bản với 20 trang để làm nguyên mẫu kiểm chứng; chức năng xác thực người dùng mới dừng ở tầng giao diện. Hướng phát triển tiếp theo là kết nối cơ sở dữ liệu vector hoàn chỉnh, mở rộng toàn bộ kho văn bản lưu trữ các năm học và tích hợp phân quyền sinh viên / cán bộ quản lý.

---

### Q21. Khu vực Admin dùng để làm gì?
**Trả lời:**  
Dạ, phân hệ Admin được thiết kế làm trung tâm điều hành kho tri thức cho cán bộ quản lý:
1. Giám sát tổng quan số lượng văn bản, trang bóc tách và các đoạn tri thức (chunks).
2. Kiểm tra siêu dữ liệu, phân loại văn bản và theo dõi tiến độ số hóa tài liệu.
3. Giám sát cấu hình mô hình AI, trọng số tìm kiếm Hybrid (40% Keyword + 60% Semantic) và xem nhật ký câu hỏi để cải thiện chất lượng dữ liệu.

---

### Q22. AI nằm ở đâu trong kiến trúc toàn hệ thống?
**Trả lời:**  
Dạ, AI không can thiệp vào tầng lưu trữ quản trị, mà được tổ chức thành một Pipeline 9 bước độc lập ở tầng Backend:
- **Tầng RAG & Retrieval:** Nằm tại `web/lib/ai/`, phụ trách phân tích từ khóa, tính toán độ tương đồng vector (Semantic Search) và tạo ngữ cảnh chuẩn hóa (Context Builder).
- **Tầng Generation (LLM):** Nằm tại `web/lib/ai/provider.ts`, nhận ngữ cảnh để tổng hợp câu trả lời qua Gemini API, hoặc tự động kích hoạt bộ trích xuất cục bộ (Local Synthesizer) khi ngoại tuyến.
- **Tầng Admin:** Chỉ đóng vai trò bảng điều khiển hiển thị cấu hình tham số, trực quan hóa pipeline và cho phép kích hoạt quy trình re-index tri thức.

---

### Q23. Hệ thống đã có cơ sở dữ liệu thật chưa?
**Trả lời:**  
Dạ có ạ. Ở Bước 16, hệ thống đã được tích hợp **Cơ sở dữ liệu quan hệ PostgreSQL 17** kết hợp **Prisma ORM** để quản trị dữ liệu người dùng và lịch sử trò chuyện:
- **Bảng `users`**: Lưu trữ tài khoản sinh viên và quản trị viên, mật khẩu được băm an toàn bằng thuật toán `bcrypt` (12 salt rounds), phân quyền `Role` (`STUDENT` / `ADMIN`).
- **Bảng `conversations`**: Lưu trữ các cuộc trò chuyện của từng người dùng, hỗ trợ xem lại và đổi tên.
- **Bảng `messages`**: Lưu trữ từng tin nhắn (câu hỏi của sinh viên và câu trả lời của AI) kèm mảng `citations` JSON trích dẫn nguồn gốc văn bản chuẩn xác.
- **Bảng `sessions`** và **`password_reset_tokens`**: Hỗ trợ quản lý phiên làm việc và quy trình khôi phục mật khẩu bảo mật một lần (One-Time Token).

---

### Q24. Phân hệ Admin có đăng nhập và bảo mật thật không?
**Trả lời:**  
Dạ có ạ. Hệ thống đã được tích hợp cơ chế xác thực và phân quyền Server-Side hoàn chỉnh cho phân hệ Admin:
- Sử dụng **HTTP-Only Session Cookie** được ký HMAC-SHA256 phía Server để lưu trữ phiên làm việc an toàn, chống giả mạo token.
- Sử dụng Next.js Middleware để bảo vệ toàn bộ tuyến đường `/admin/*`. Khi chưa đăng nhập, hệ thống tự động chuyển hướng về `/login`; nếu đăng nhập tài khoản sinh viên không có quyền Admin, hệ thống sẽ tự động chặn và trả về trang 403 Forbidden.
- Tài khoản Admin được khởi tạo qua script seed bảo mật riêng biệt (`npm run db:seed-admin`), tuyệt đối không cho phép đăng ký Admin công khai trên giao diện người dùng.

---

### Q25. Sinh viên có thể tự biến tài khoản của mình thành Admin bằng cách sửa localStorage hay URL không?
**Trả lời:**  
Dạ không ạ. Quyền Admin được kiểm tra và xác thực nghiêm ngặt 100% phía Server bằng chữ ký mã hóa HMAC kết hợp kiểm tra `role: "ADMIN"` trong cơ sở dữ liệu PostgreSQL. Client không thể tự đổi vai trò bằng `localStorage` hay truyền tham số URL `?role=admin`. Mọi thay đổi trái phép trên Cookie đều khiến chữ ký HMAC bị sai và bị từ chối lập tức.

---

### Q26. Lịch sử chat được lưu trữ như thế nào? Sinh viên đổi máy khác có xem lại được không?
**Trả lời:**  
Dạ có ạ. Khi sinh viên đã đăng nhập tài khoản:
- Toàn bộ cuộc trò chuyện và câu hỏi đều được lưu trữ trực tiếp vào bảng `conversations` và `messages` trong cơ sở dữ liệu PostgreSQL gắn chặt với `userId` đã được xác thực phía server.
- Khi sinh viên đăng nhập ở thiết bị hoặc trình duyệt khác, hệ thống sẽ tự động truy vấn từ PostgreSQL và hiển thị đầy đủ lịch sử cùng với các trích dẫn nguồn (citations) như thời điểm ban đầu.
- Đồng thời, hệ thống áp dụng cơ chế phân quyền dữ liệu nghiêm ngặt (Data Isolation): Sinh viên A tuyệt đối không thể xem, sửa hoặc xóa cuộc trò chuyện của Sinh viên B (trả về lỗi 403 Forbidden nếu cố tình truy cập trái phép qua API).

---

### Q27. Mật khẩu người dùng được lưu trữ như thế nào? Có nguy cơ lộ mật khẩu thuần không?
**Trả lời:**  
Dạ, mật khẩu thuần tuyệt đối **không bao giờ** được lưu trữ trong cơ sở dữ liệu hoặc ghi log:
- Toàn bộ mật khẩu người dùng (cả sinh viên đăng ký và tài khoản Admin được seed) đều được băm bằng thuật toán **bcrypt** với hệ số `salt rounds = 12`.
- Khi người dùng đăng nhập, hệ thống dùng hàm `bcrypt.compare` để đối chiếu chuỗi băm mà không cần đảo ngược về mật khẩu gốc.
- Các API trả về thông tin người dùng (`/api/auth/me`, `/api/auth/login`, `/api/auth/register`) luôn loại bỏ hoàn toàn trường `passwordHash` để ngăn chặn rò rỉ dữ liệu.

---

### Q28. Khi một cuộc trò chuyện bị xóa thì dữ liệu liên quan được xử lý ra sao?
**Trả lời:**  
Dạ, trong thiết kế Prisma Schema, quan hệ giữa `Conversation` và `Message` được cấu hình ràng buộc toàn vẹn dữ liệu `onDelete: Cascade`. Khi sinh viên thực hiện xóa một cuộc trò chuyện, toàn bộ các tin nhắn và trích dẫn liên quan đến cuộc trò chuyện đó sẽ tự động được xóa sạch trong PostgreSQL trong cùng một thao tác, không để lại rác dữ liệu mồ côi (orphan records). Thao tác này hoàn toàn độc lập và không ảnh hưởng đến kho tài liệu gốc hay Second Brain.
