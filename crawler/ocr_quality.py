"""
Module đánh giá chất lượng OCR tự động dựa trên Heuristic cho DAU Second Brain.

Nguyên tắc:
- Đánh giá bằng luật & heuristic, TUYỆT ĐỐI KHÔNG dùng AI/LLM.
- Không tự sửa text, không suy diễn câu từ bị mờ.
- Chỉ FLAG và phát hiện các bất thường, chấm điểm để con người kiểm tra.
- Quality score là heuristic để phát hiện OCR đáng ngờ, KHÔNG phải phần trăm độ chính xác OCR.
"""

import argparse
import json
import logging
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from .config import DATA_DIR, EXTRACTED_DIR

logger = logging.getLogger("OCRQuality")

# Tập ký tự tiếng Việt có dấu (lowercase + uppercase)
VIETNAMESE_DIACRITICS = set(
    "àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ"
    "ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ"
)

# Các mẫu pháp lý thường gặp trong văn bản hành chính trường học
LEGAL_PATTERNS = [
    (r"\bĐiều\s+\d+\b", "Điều X"),
    (r"\bKhoản\s+\d+\b", "Khoản X"),
    (r"\bĐiểm\s+[a-zđ]\b", "Điểm X"),
    (r"\bCăn\s+cứ\b", "Căn cứ"),
    (r"\bQuyết\s+định\b", "Quyết định"),
    (r"\bThông\s+báo\b", "Thông báo"),
    (r"\bSố:\s*[\w\d\-/]+", "Số hiệu văn bản"),
    (r"\bngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4}\b", "Ngày tháng năm"),
    (r"\b\d{1,2}/\d{1,2}/\d{4}\b", "Ngày dạng số DD/MM/YYYY"),
    (r"\b\d+([\.,]\d+)*\s*(đồng|đ|VNĐ|VND)\b", "Số tiền"),
    (r"\b\d+([,\.]\d+)?\s*%", "Phần trăm"),
    (r"\bhạn\s+(chót|nộp|cuối)\b", "Thời hạn"),
]

# Ký tự bất thường hay xuất hiện khi OCR lỗi (garbage symbols, control characters, v.v.)
SUSPICIOUS_CHAR_REGEX = re.compile(r"[~`^|\{\}\[\]\\_<>§¤¥¢©®™¶†‡•—–±≠≤≥√∞]")


def compute_text_metrics(text: str) -> Dict[str, Any]:
    """
    Tính toán các chỉ số thống kê từ văn bản trích xuất:
    1. text_length
    2. non_whitespace_chars
    3. vietnamese_character_ratio
    4. alphanumeric_ratio
    5. suspicious_character_ratio
    6. repeated_character_ratio
    7. line_count
    8. word_count
    9. detected_legal_patterns
    """
    if not text:
        return {
            "text_length": 0,
            "non_whitespace_chars": 0,
            "vietnamese_character_ratio": 0.0,
            "alphanumeric_ratio": 0.0,
            "suspicious_character_ratio": 0.0,
            "repeated_character_ratio": 0.0,
            "line_count": 0,
            "word_count": 0,
            "detected_legal_patterns": [],
        }

    total_len = len(text)
    non_ws_chars = [c for c in text if not c.isspace()]
    non_ws_len = len(non_ws_chars)

    if non_ws_len == 0:
        return {
            "text_length": total_len,
            "non_whitespace_chars": 0,
            "vietnamese_character_ratio": 0.0,
            "alphanumeric_ratio": 0.0,
            "suspicious_character_ratio": 0.0,
            "repeated_character_ratio": 0.0,
            "line_count": len(text.splitlines()),
            "word_count": 0,
            "detected_legal_patterns": [],
        }

    # Đếm ký tự tiếng Việt có dấu
    vie_count = sum(1 for c in non_ws_chars if c in VIETNAMESE_DIACRITICS)
    vie_ratio = round(vie_count / non_ws_len, 4)

    # Đếm ký tự alphanumeric
    alnum_count = sum(1 for c in non_ws_chars if c.isalnum())
    alnum_ratio = round(alnum_count / non_ws_len, 4)

    # Đếm ký tự bất thường
    suspicious_matches = SUSPICIOUS_CHAR_REGEX.findall(text)
    suspicious_ratio = round(len(suspicious_matches) / non_ws_len, 4)

    # Phát hiện lặp ký tự (ví dụ: aaaa, ......, ----- gồm >= 4 ký tự giống nhau liên tiếp)
    repeated_chars_count = sum(len(m.group(0)) for m in re.finditer(r"(.)\1{3,}", text))
    repeated_ratio = round(repeated_chars_count / non_ws_len, 4)

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    line_count = len(lines)

    words = text.split()
    word_count = len(words)

    # Nhận diện các pattern văn bản pháp lý
    detected_patterns = []
    for pattern, name in LEGAL_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            detected_patterns.append(name)

    return {
        "text_length": total_len,
        "non_whitespace_chars": non_ws_len,
        "vietnamese_character_ratio": vie_ratio,
        "alphanumeric_ratio": alnum_ratio,
        "suspicious_character_ratio": suspicious_ratio,
        "repeated_character_ratio": repeated_ratio,
        "line_count": line_count,
        "word_count": word_count,
        "detected_legal_patterns": detected_patterns,
    }


def evaluate_page_quality(page: Dict[str, Any]) -> Tuple[int, str, List[str], Dict[str, Any]]:
    """
    Đánh giá chất lượng OCR cho một trang đơn lẻ:
    Trả về: (score: 0-100, label: "GOOD"|"ACCEPTABLE"|"WARNING"|"POOR", warnings: list[str], metrics: dict)
    """
    cleaned = page.get("cleaned_text", "")
    raw = page.get("raw_text", "")
    text = cleaned if cleaned else raw

    metrics = compute_text_metrics(text)
    warnings: List[str] = []
    score = 100

    # 1. Kiểm tra trang rỗng hoặc quá ngắn
    if metrics["non_whitespace_chars"] == 0:
        score = 0
        warnings.append("Trang hoàn toàn không có ký tự nào (rỗng).")
        return score, "POOR", warnings, metrics

    if metrics["text_length"] < 80:
        score -= 40
        warnings.append(f"Văn bản quá ngắn (chỉ {metrics['text_length']} ký tự).")

    # 2. Tỷ lệ ký tự bất thường
    if metrics["suspicious_character_ratio"] > 0.08:
        score -= 30
        warnings.append(
            f"Tỷ lệ ký tự bất thường cao ({metrics['suspicious_character_ratio']*100:.1f}%)."
        )
    elif metrics["suspicious_character_ratio"] > 0.03:
        score -= 15
        warnings.append(
            f"Có xuất hiện một số ký tự bất thường ({metrics['suspicious_character_ratio']*100:.1f}%)."
        )

    # 3. Tỷ lệ ký tự lặp
    if metrics["repeated_character_ratio"] > 0.10:
        score -= 20
        warnings.append(
            f"Tỷ lệ ký tự lặp bất thường ({metrics['repeated_character_ratio']*100:.1f}%)."
        )

    # 4. Tỷ lệ alphanumeric quá thấp (toàn dấu và khoảng trắng)
    if metrics["alphanumeric_ratio"] < 0.65:
        score -= 25
        warnings.append(
            f"Tỷ lệ chữ và số thấp bất thường ({metrics['alphanumeric_ratio']*100:.1f}%)."
        )

    # 5. Dòng quá ngắn (nhiều dòng chỉ 1-2 ký tự)
    lines = [l for l in text.splitlines() if l.strip()]
    if lines:
        short_lines = sum(1 for l in lines if len(l) <= 3)
        if (short_lines / len(lines)) > 0.40 and len(lines) > 5:
            score -= 15
            warnings.append("Nhiều dòng bị đứt đoạn ngắn (nghi vấn OCR vỡ dòng).")

    # 6. Tỷ lệ tiếng Việt (văn bản tiếng Việt thường có ít nhất 2% ký tự có dấu nếu OCR vie)
    if metrics["vietnamese_character_ratio"] < 0.01 and metrics["text_length"] > 150:
        warnings.append(
            "Tỷ lệ ký tự tiếng Việt có dấu rất thấp (<1%), có thể là OCR bằng tiếng Anh hoặc văn bản không dấu."
        )
        score -= 10

    # 7. Thiếu các dấu hiệu văn bản hành chính thông thường
    if not metrics["detected_legal_patterns"] and metrics["text_length"] > 300:
        score -= 10
        warnings.append("Không phát hiện mẫu văn bản hành chính phổ biến (Số hiệu, Ngày tháng, Điều/Khoản...).")

    # Đảm bảo score trong khoảng 0-100
    score = max(0, min(100, score))

    if score >= 90:
        label = "GOOD"
    elif score >= 70:
        label = "ACCEPTABLE"
    elif score >= 50:
        label = "WARNING"
    else:
        label = "POOR"

    return score, label, warnings, metrics


def evaluate_document_quality(doc_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Đánh giá chất lượng toàn bộ document từ nội dung JSON extracted.
    Không chỉnh sửa nội dung văn bản.
    """
    pages = doc_json.get("pages", [])
    total_pages = doc_json.get("total_pages", len(pages))

    if not pages or total_pages == 0:
        return {
            "score": 0,
            "label": "POOR",
            "warnings": ["Tài liệu không có trang nào."],
            "metrics": {
                "text_length": 0,
                "word_count": 0,
                "empty_page_ratio": 1.0,
                "suspicious_character_ratio": 0.0,
                "vietnamese_character_ratio": 0.0,
            },
            "pages_evaluation": [],
        }

    page_evals = []
    page_scores = []
    doc_warnings: List[str] = []

    total_chars = 0
    total_non_ws = 0
    total_words = 0
    total_vie = 0
    total_suspicious = 0
    empty_pages = 0

    all_detected_patterns: Set[str] = set()

    for p in pages:
        p_num = p.get("page_number", len(page_evals) + 1)
        p_score, p_label, p_warn, p_metrics = evaluate_page_quality(p)
        page_scores.append(p_score)

        page_evals.append({
            "page_number": p_num,
            "score": p_score,
            "label": p_label,
            "warnings": p_warn,
            "metrics": p_metrics,
        })

        if p_metrics["non_whitespace_chars"] == 0:
            empty_pages += 1

        total_chars += p_metrics["text_length"]
        total_non_ws += p_metrics["non_whitespace_chars"]
        total_words += p_metrics["word_count"]
        all_detected_patterns.update(p_metrics.get("detected_legal_patterns", []))

        # Gom cảnh báo trang có điểm WARNING/POOR vào doc warnings
        if p_label in ("WARNING", "POOR"):
            for w in p_warn:
                doc_warnings.append(f"Trang {p_num}: {w}")

    # Tính điểm trung bình trang
    avg_score = int(round(sum(page_scores) / len(page_scores)))
    empty_page_ratio = round(empty_pages / total_pages, 4)

    # Đánh giá lại toàn cục
    if empty_page_ratio > 0.5:
        avg_score = min(avg_score, 45)
        doc_warnings.append(f"Hơn 50% số trang rỗng ({empty_pages}/{total_pages}).")

    if total_chars < 100:
        avg_score = min(avg_score, 40)
        doc_warnings.append(f"Toàn bộ tài liệu quá ngắn (tổng {total_chars} ký tự).")

    # Tính lại tổng hợp metrics của document
    full_text = "\n\n".join(p.get("cleaned_text", "") for p in pages)
    doc_metrics = compute_text_metrics(full_text)
    doc_metrics["empty_page_ratio"] = empty_page_ratio

    if avg_score >= 90:
        doc_label = "GOOD"
    elif avg_score >= 70:
        doc_label = "ACCEPTABLE"
    elif avg_score >= 50:
        doc_label = "WARNING"
    else:
        doc_label = "POOR"

    return {
        "score": avg_score,
        "label": doc_label,
        "warnings": doc_warnings,
        "metrics": doc_metrics,
        "pages_evaluation": page_evals,
    }


class OCRQualityEvaluator:
    """
    Pipeline đánh giá chất lượng OCR cho tất cả các file JSON trong crawler/data/extracted/.
    Cập nhật ocr_quality vào từng file JSON và xuất báo cáo ocr_quality_report.json.
    """

    def __init__(
        self,
        extracted_dir: Path = EXTRACTED_DIR,
        report_output_path: Optional[Path] = None,
    ):
        self.extracted_dir = Path(extracted_dir)
        self.report_output_path = (
            Path(report_output_path)
            if report_output_path
            else DATA_DIR / "ocr_quality_report.json"
        )

    def run(self) -> Dict[str, Any]:
        report = {
            "generated_at": datetime.now().isoformat(),
            "language": "vie+eng",
            "summary": {
                "total_documents": 0,
                "good": 0,
                "acceptable": 0,
                "warning": 0,
                "poor": 0,
                "total_pages": 0,
                "total_characters": 0,
            },
            "documents": [],
        }

        if not self.extracted_dir.exists():
            logger.warning(f"Thư mục không tồn tại: {self.extracted_dir}")
            return report

        json_files = sorted(self.extracted_dir.rglob("*.json"))
        report["summary"]["total_documents"] = len(json_files)

        for jf in json_files:
            try:
                with open(jf, "r", encoding="utf-8") as f:
                    doc_data = json.load(f)
            except Exception as e:
                logger.error(f"Không thể đọc {jf}: {e}")
                continue

            eval_res = evaluate_document_quality(doc_data)

            # Cập nhật ocr_quality vào JSON tài liệu
            doc_data["ocr_quality"] = {
                "score": eval_res["score"],
                "label": eval_res["label"],
                "warnings": eval_res["warnings"],
                "metrics": eval_res["metrics"],
            }

            try:
                with open(jf, "w", encoding="utf-8") as f:
                    json.dump(doc_data, f, ensure_ascii=False, indent=2)
            except Exception as e:
                logger.error(f"Lỗi khi cập nhật {jf}: {e}")

            # Thống kê tổng hợp
            label = eval_res["label"]
            if label == "GOOD":
                report["summary"]["good"] += 1
            elif label == "ACCEPTABLE":
                report["summary"]["acceptable"] += 1
            elif label == "WARNING":
                report["summary"]["warning"] += 1
            else:
                report["summary"]["poor"] += 1

            total_pages = doc_data.get("total_pages", len(doc_data.get("pages", [])))
            report["summary"]["total_pages"] += total_pages
            report["summary"]["total_characters"] += eval_res["metrics"]["text_length"]

            report["documents"].append({
                "source_file": doc_data.get("source_file", str(jf)),
                "notification_title": doc_data.get("notification_title", ""),
                "total_pages": total_pages,
                "quality_score": eval_res["score"],
                "quality_label": eval_res["label"],
                "warnings": eval_res["warnings"],
                "metrics": {
                    "text_length": eval_res["metrics"]["text_length"],
                    "word_count": eval_res["metrics"]["word_count"],
                    "empty_page_ratio": eval_res["metrics"]["empty_page_ratio"],
                    "suspicious_character_ratio": eval_res["metrics"]["suspicious_character_ratio"],
                    "vietnamese_character_ratio": eval_res["metrics"]["vietnamese_character_ratio"],
                },
            })

        # Lưu file báo cáo JSON
        try:
            self.report_output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.report_output_path, "w", encoding="utf-8") as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            logger.info(f"Đã lưu báo cáo chất lượng OCR tại: {self.report_output_path}")
        except Exception as e:
            logger.error(f"Lỗi khi lưu báo cáo: {e}")

        self._print_summary(report)
        return report

    def _print_summary(self, report: Dict[str, Any]):
        sm = report["summary"]
        print("\n" + "=" * 62)
        print(" DAU SECOND BRAIN - BÁO CÁO CHẤT LƯỢNG OCR (QUALITY AUDIT)")
        print("=" * 62)
        print(f"Tổng tài liệu kiểm tra : {sm['total_documents']}")
        print(f"Tổng số trang           : {sm['total_pages']}")
        print(f"Tổng ký tự              : {sm['total_characters']:,}")
        print(f"GOOD (90-100)           : {sm['good']}")
        print(f"ACCEPTABLE (70-89)      : {sm['acceptable']}")
        print(f"WARNING (50-69)         : {sm['warning']}")
        print(f"POOR (0-49)             : {sm['poor']}")
        print("=" * 62)

        # In các tài liệu có warning/poor
        problem_docs = [
            d for d in report["documents"] if d["quality_label"] in ("WARNING", "POOR")
        ]
        if problem_docs:
            print(f"\n[!] CÓ {len(problem_docs)} TÀI LIỆU CẦN KIỂM TRA THỦ CÔNG:")
            for d in problem_docs:
                p_name = Path(d["source_file"]).name
                print(f"  - {p_name} | Score: {d['quality_score']} ({d['quality_label']})")
                for w in d["warnings"][:3]:
                    print(f"      • {w}")
        else:
            print("\n[✓] Tất cả tài liệu đều đạt mức GOOD hoặc ACCEPTABLE!")
        print("=" * 62 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="Đánh giá chất lượng OCR cho các tài liệu đã trích xuất."
    )
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Đường dẫn file JSON đơn lẻ cần kiểm tra",
    )
    parser.add_argument(
        "--extracted-dir",
        type=str,
        default=str(EXTRACTED_DIR),
        help=f"Thư mục chứa các file JSON extracted (mặc định: {EXTRACTED_DIR})",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help=f"Đường dẫn file báo cáo JSON (mặc định: {DATA_DIR / 'ocr_quality_report.json'})",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    if args.file:
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"Lỗi: Không tìm thấy file {file_path}")
            sys.exit(1)
        with open(file_path, "r", encoding="utf-8") as f:
            doc_data = json.load(f)
        eval_res = evaluate_document_quality(doc_data)
        print(json.dumps(eval_res, ensure_ascii=False, indent=2))
        return

    evaluator = OCRQualityEvaluator(
        extracted_dir=Path(args.extracted_dir),
        report_output_path=Path(args.output) if args.output else None,
    )
    evaluator.run()


if __name__ == "__main__":
    main()
