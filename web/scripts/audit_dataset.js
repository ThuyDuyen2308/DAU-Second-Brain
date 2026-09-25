// web/scripts/audit_dataset.js
const fs = require("fs");
const path = require("path");

const DATASET_PATH = path.resolve(__dirname, "../../crawler/data/normalized/documents.json");

function auditDataset() {
  console.log("=================================================");
  console.log("DAU SECOND BRAIN - BÁO CÁO AUDIT DỮ LIỆU (BƯỚC 12)");
  console.log("=================================================");

  if (!fs.existsSync(DATASET_PATH)) {
    console.error("LỖI: Không tìm thấy tệp dataset tại:", DATASET_PATH);
    process.exit(1);
  }

  const raw = fs.readFileSync(DATASET_PATH, "utf-8");
  const documents = JSON.parse(raw);

  const totalDocs = documents.length;
  let totalPages = 0;
  let totalAttachments = 0;
  const docIds = new Set();
  let missingTitles = 0;
  let missingDocNumbers = 0;
  let missingIssueDates = 0;
  let docsMissingPages = 0;
  let docsWithEmptyContent = 0;

  for (const doc of documents) {
    if (doc.id) docIds.add(doc.id);
    if (!doc.title || !doc.title.trim()) missingTitles++;
    if (!doc.document_number) missingDocNumbers++;
    if (!doc.issue_date) missingIssueDates++;
    if (doc.attachments && Array.isArray(doc.attachments)) {
      totalAttachments += doc.attachments.length;
    }

    if (!doc.pages || !Array.isArray(doc.pages) || doc.pages.length === 0) {
      docsMissingPages++;
    } else {
      totalPages += doc.pages.length;
    }

    if (!doc.content && (!doc.pages || doc.pages.length === 0)) {
      docsWithEmptyContent++;
    }
  }

  // Đo lường số chunk sinh ra từ chunking logic
  let totalChunks = 0;
  for (const doc of documents) {
    if (doc.pages && doc.pages.length > 0) {
      for (const p of doc.pages) {
        const text = (p.cleaned_text || p.raw_text || "").trim();
        if (text) {
          totalChunks += Math.ceil(text.length / 650) || 1;
        }
      }
    } else if (doc.content && doc.content.trim()) {
      totalChunks += Math.ceil(doc.content.trim().length / 650) || 1;
    }
  }

  console.log(`- Tổng số văn bản (Documents): ${totalDocs}`);
  console.log(`- Tổng số trang (Pages): ${totalPages}`);
  console.log(`- Tổng số mã định danh duy nhất (Unique IDs): ${docIds.size}`);
  console.log(`- Số văn bản có Tiêu đề (Titles): ${totalDocs - missingTitles}/${totalDocs}`);
  console.log(`- Số văn bản có Số hiệu (Document Numbers): ${totalDocs - missingDocNumbers}/${totalDocs} (${missingDocNumbers} văn bản chưa có số hiệu)`);
  console.log(`- Số văn bản có Ngày ban hành (Issue Dates): ${totalDocs - missingIssueDates}/${totalDocs} (${missingIssueDates} văn bản chưa có ngày)`);
  console.log(`- Tổng số tệp đính kèm (Attachments): ${totalAttachments}`);
  console.log(`- Ước lượng Text Chunks: ~${totalChunks} chunks`);
  console.log(`- Văn bản thiếu trang (Missing pages): ${docsMissingPages}`);
  console.log(`- Văn bản hoàn toàn rỗng nội dung: ${docsWithEmptyContent}`);

  console.log("\nChi tiết từng văn bản trong dataset:");
  documents.forEach((d, idx) => {
    console.log(`[${idx + 1}] ID: ${d.id}`);
    console.log(`    Tiêu đề: ${d.title}`);
    console.log(`    Số hiệu: ${d.document_number || "(trống)"} | Ngày: ${d.issue_date || "(trống)"} | Danh mục: ${d.category || "(trống)"}`);
    console.log(`    Số trang: ${d.pages ? d.pages.length : 0} | Tổng trang khai báo: ${d.total_pages}`);
  });

  console.log("=================================================");
}

auditDataset();
