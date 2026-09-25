import { RetrievedChunk } from "@/types/ask";

export const DAU_AI_SYSTEM_PROMPT = `Bạn là Trợ lý số DAU Second Brain của Trường Đại học Kiến trúc Đà Nẵng (DAU).
Nhiệm vụ của bạn là hỗ trợ sinh viên và giảng viên tra cứu, giải đáp các thắc mắc dựa trên kho văn bản chính thức của nhà trường.

CÁC NGUYÊN TẮC BẮT BUỘC (TUYỆT ĐỐI KHÔNG VI PHẠM):
1. CHỈ SỬ DỤNG thông tin được cung cấp trong phần [VĂN BẢN NGUỒN LIÊN QUAN] dưới đây.
2. KHÔNG TỰ BỊA ĐẶT bất kỳ thông tin nào (ngày tháng, số tiền, điều kiện, tên người, số hiệu, địa điểm).
3. KHÔNG sử dụng kiến thức bên ngoài không được kiểm chứng để bổ sung cho quy định nhà trường.
4. NẾU CONTEXT KHÔNG ĐỦ THÔNG TIN để trả lời câu hỏi: Hãy nêu rõ và lịch sự rằng: "Tôi chưa tìm thấy thông tin này trong dữ liệu văn bản hiện có của DAU."
5. TRÍCH DẪN NGUỒN RÕ RÀNG: Khi đưa ra thông tin trích từ văn bản nào, hãy ghi rõ [Nguồn X] hoặc trích dẫn tiêu đề văn bản và số trang tương ứng.
6. KHÔNG tự tạo số trang giả, không tạo nguồn giả.
7. KHÔNG tự suy đoán trạng thái hiệu lực (còn hiệu lực / hết hiệu lực) nếu văn bản không nêu rõ.
8. Trả lời bằng tiếng Việt lịch sự, rõ ràng, gãy gọn, chuẩn văn phong học thuật đại học.`;

/**
 * Ghép các chunk tài liệu thành context chuẩn cho AI Model
 */
export function buildContextFromChunks(chunks: RetrievedChunk[]): string {
  if (!chunks.length) {
    return "Không có văn bản nào liên quan được tìm thấy trong kho dữ liệu.";
  }

  const formattedDocs = chunks.map((chunk, index) => {
    const docNum = chunk.documentNumber ? `Số hiệu: ${chunk.documentNumber}` : "Số hiệu: Chưa xác định";
    const date = chunk.issueDate ? `Ngày ban hành: ${chunk.issueDate}` : "Ngày ban hành: Chưa rõ";
    const cat = chunk.category ? `Chủ đề: ${chunk.category}` : "Chủ đề: Chưa phân loại";

    return `[VĂN BẢN ${index + 1}]
ID: ${chunk.documentId}
TIÊU ĐỀ: ${chunk.title}
${docNum} | ${date} | ${cat}
TRANG: ${chunk.pageNumber}
NỘI DUNG:
${chunk.text}
[/VĂN BẢN ${index + 1}]`;
  });

  return `[VĂN BẢN NGUỒN LIÊN QUAN]
${formattedDocs.join("\n\n")}
[/VĂN BẢN NGUỒN LIÊN QUAN]`;
}

/**
 * Tạo User Prompt hoàn chỉnh
 */
export function buildUserPrompt(question: string, context: string): string {
  return `Dưới đây là các tài liệu chính thức của Trường Đại học Kiến trúc Đà Nẵng:

${context}

CÂU HỎI CỦA SINH VIÊN:
"${question}"

HÃY TRẢ LỜI CÂU HỎI TRÊN DỰA HOÀN TOÀN VÀO CÁC VĂN BẢN NGUỒN Ở TRÊN. NẾU THÔNG TIN KHÔNG CÓ TRONG NGUỒN, HÃY NÓI RÕ LÀ KHÔNG TÌM THẤY.`;
}
