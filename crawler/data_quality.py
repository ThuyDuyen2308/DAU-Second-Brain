"""
Module Data Quality Validation cho DAU Second Brain.

Mục tiêu:
- Kiểm tra chất lượng của dataset đã chuẩn hóa tại crawler/data/normalized/documents.json
- Thực hiện 15 kiểm tra (Checks 1-15) dựa trên luật deterministic, hoàn toàn KHÔNG dùng AI/LLM.
- Chấm điểm chất lượng (Score 0-100), phân loại trạng thái (GOOD, WARNING, ERROR).
- Xuất báo cáo chi tiết ra crawler/data/normalized/data_quality_report.json.
- Không tự sửa dữ liệu, không tự suy luận hiệu lực hay số hiệu văn bản.
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

from .config import DATA_DIR, NORMALIZED_DIR, NORMALIZED_DOCUMENTS_FILE

logger = logging.getLogger("DataQuality")

# Regex kiểm tra định dạng ISO YYYY-MM-DD
DATE_ISO_REGEX = re.compile(r"^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")

# Ký tự bất thường hay xuất hiện khi OCR lỗi
SUSPICIOUS_CHAR_REGEX = re.compile(r"[~`^|\{\}\[\]\\_<>§¤¥¢©®™¶†‡•—–±≠≤≥√∞]")


def validate_document(
    doc: Dict[str, Any],
    seen_ids: Set[str],
    seen_urls: Set[str],
    seen_files: Set[str],
    check_filesystem: bool = True,
) -> Tuple[Dict[str, Any], List[str], List[str]]:
    """
    Thực hiện 15 kiểm tra trên một document cụ thể.

    Trả về:
        (checks_dict, issues_list, warnings_list)
        - issues_list chứa các lỗi nghiêm trọng (ERROR)
        - warnings_list chứa các cảnh báo cần con người kiểm tra (WARNING)
    """
    checks = {
        "title": True,
        "document_number": True,
        "issue_date": True,
        "source_url": True,
        "source_file": True,
        "content": True,
        "page_count": True,
        "ocr_text": True,
        "ocr_characters": True,
        "metadata_consistency": True,
        "title_content_relation": True,
        "duplicate": True,
        "provenance": True,
        "effective_status": True,
    }

    issues: List[str] = []
    warnings: List[str] = []

    # -------------------------------------------------------------
    # CHECK 1: TITLE (ERROR nếu thiếu/rỗng/không phải string)
    # -------------------------------------------------------------
    title = doc.get("title")
    if not isinstance(title, str) or not title.strip():
        checks["title"] = False
        issues.append("[CHECK 1 - TITLE] Tiêu đề bị thiếu, rỗng hoặc không phải chuỗi ký tự hợp lệ.")

    # -------------------------------------------------------------
    # CHECK 2: DOCUMENT NUMBER (WARNING nếu null, KHÔNG tự suy luận)
    # -------------------------------------------------------------
    doc_num = doc.get("document_number")
    if doc_num is None or not str(doc_num).strip():
        checks["document_number"] = False
        warnings.append("[CHECK 2 - DOCUMENT NUMBER] Văn bản không có số hiệu rõ ràng (document_number is null).")

    # -------------------------------------------------------------
    # CHECK 3: ISSUE DATE (WARNING nếu thiếu, ERROR nếu sai format)
    # -------------------------------------------------------------
    issue_date = doc.get("issue_date")
    if not issue_date or not str(issue_date).strip():
        checks["issue_date"] = False
        warnings.append("[CHECK 3 - ISSUE DATE] Không có ngày ban hành (issue_date is null).")
    else:
        issue_date_str = str(issue_date).strip()
        if not DATE_ISO_REGEX.match(issue_date_str):
            checks["issue_date"] = False
            issues.append(
                f"[CHECK 3 - ISSUE DATE] Ngày ban hành không đúng định dạng YYYY-MM-DD: '{issue_date_str}'."
            )
        else:
            try:
                datetime.strptime(issue_date_str, "%Y-%m-%d")
            except ValueError:
                checks["issue_date"] = False
                issues.append(f"[CHECK 3 - ISSUE DATE] Ngày không hợp lệ trên lịch: '{issue_date_str}'.")

    # -------------------------------------------------------------
    # CHECK 4: SOURCE URL (ERROR nếu thiếu/rỗng)
    # -------------------------------------------------------------
    src_url = doc.get("source_url")
    if not isinstance(src_url, str) or not src_url.strip():
        checks["source_url"] = False
        issues.append("[CHECK 4 - SOURCE URL] Đường dẫn nguồn source_url bị thiếu hoặc rỗng.")

    # -------------------------------------------------------------
    # CHECK 5: SOURCE FILE (ERROR nếu thiếu hoặc không có trên đĩa)
    # -------------------------------------------------------------
    src_file = doc.get("source_file")
    if not isinstance(src_file, str) or not src_file.strip():
        checks["source_file"] = False
        issues.append("[CHECK 5 - SOURCE FILE] Đường dẫn tệp source_file bị thiếu hoặc rỗng.")
    elif check_filesystem:
        path_obj = Path(src_file)
        if not path_obj.exists() or not path_obj.is_file():
            checks["source_file"] = False
            issues.append(f"[CHECK 5 - SOURCE FILE] Tệp tài liệu không tồn tại trên filesystem: '{src_file}'.")

    # -------------------------------------------------------------
    # CHECK 6: CONTENT (ERROR nếu rỗng, WARNING nếu quá ngắn)
    # -------------------------------------------------------------
    content = doc.get("content")
    if not isinstance(content, str) or not content.strip():
        checks["content"] = False
        issues.append("[CHECK 6 - CONTENT] Nội dung văn bản rỗng (content is empty).")
    elif len(content.strip()) < 100:
        checks["content"] = False
        warnings.append(f"[CHECK 6 - CONTENT] Nội dung văn bản quá ngắn ({len(content.strip())} ký tự).")

    # -------------------------------------------------------------
    # CHECK 7: SỐ TRANG (ERROR nếu total_pages != len(pages))
    # -------------------------------------------------------------
    total_pages = doc.get("total_pages", 0)
    pages = doc.get("pages", [])
    if not isinstance(pages, list) or total_pages != len(pages):
        checks["page_count"] = False
        issues.append(
            f"[CHECK 7 - SỐ TRANG] total_pages ({total_pages}) không khớp với số lượng phần tử pages ({len(pages)})."
        )

    # -------------------------------------------------------------
    # CHECK 8: OCR QUÁ ÍT TEXT (WARNING nếu page có < 30 ký tự)
    # -------------------------------------------------------------
    has_short_page = False
    for p in pages:
        p_num = p.get("page_number", "?")
        cl_text = (p.get("cleaned_text") or "").strip()
        if len(cl_text) < 30:
            has_short_page = True
            warnings.append(
                f"[CHECK 8 - OCR TEXT] Trang {p_num} có quá ít text ({len(cl_text)} ký tự < 30)."
            )
    if has_short_page:
        checks["ocr_text"] = False

    # -------------------------------------------------------------
    # CHECK 9 & 10: KÝ TỰ BẤT THƯỜNG & TỶ LỆ KÝ TỰ BẤT THƯỜNG (WARNING)
    # -------------------------------------------------------------
    if content:
        non_ws_chars = [c for c in content if not c.isspace()]
        total_non_ws = len(non_ws_chars)

        if total_non_ws > 0:
            suspicious_matches = SUSPICIOUS_CHAR_REGEX.findall(content)
            suspicious_ratio = len(suspicious_matches) / total_non_ws

            # Check 9: Chuỗi ký tự lặp bất thường (>= 5 ký tự giống nhau liên tiếp)
            repeated_matches = re.findall(r"(.)\1{4,}", content)
            if repeated_matches or suspicious_ratio > 0.05:
                checks["ocr_characters"] = False
                if repeated_matches:
                    warnings.append(
                        f"[CHECK 9 - KÝ TỰ BẤT THƯỜNG] Phát hiện chuỗi lặp ký tự bất thường ({len(repeated_matches)} chỗ)."
                    )
                if suspicious_ratio > 0.05:
                    warnings.append(
                        f"[CHECK 10 - TỶ LỆ KÝ TỰ BẤT THƯỜNG] Tỷ lệ ký tự bất thường cao ({suspicious_ratio * 100:.1f}%)."
                    )

            # Tỷ lệ ký tự không phải chữ/số (non-alphanumeric) quá cao (> 35%)
            alnum_count = sum(1 for c in non_ws_chars if c.isalnum())
            non_alnum_ratio = 1.0 - (alnum_count / total_non_ws)
            if non_alnum_ratio > 0.35:
                checks["ocr_characters"] = False
                warnings.append(
                    f"[CHECK 10 - TỶ LỆ KÝ TỰ BẤT THƯỜNG] Tỷ lệ ký tự không phải chữ/số cao ({non_alnum_ratio * 100:.1f}%)."
                )

    # -------------------------------------------------------------
    # CHECK 11: METADATA VS OCR CONSISTENCY (WARNING)
    # -------------------------------------------------------------
    if content:
        # Nếu có issue_date (YYYY-MM-DD), chuyển sang DD/MM/YYYY để kiểm tra sự xuất hiện trong OCR
        if issue_date and DATE_ISO_REGEX.match(str(issue_date)):
            parts = str(issue_date).split("-")
            d_fmt = f"{int(parts[2]):02d}/{int(parts[1]):02d}/{parts[0]}"
            d_short = f"{int(parts[2])}/{int(parts[1])}/{parts[0]}"
            # Kiểm tra năm có xuất hiện trong OCR không
            if parts[0] not in content:
                checks["metadata_consistency"] = False
                warnings.append(
                    f"[CHECK 11 - METADATA VS OCR] Năm ban hành ({parts[0]}) không tìm thấy trong nội dung OCR."
                )

    # -------------------------------------------------------------
    # CHECK 12: TITLE VS PDF CONTENT RELATION (WARNING nếu không thấy từ khóa)
    # -------------------------------------------------------------
    if title and content:
        # Tách các từ có độ dài >= 4 ký tự trong title để kiểm tra mức độ xuất hiện trong content
        t_words = [w.lower() for w in re.findall(r"\b[\wđĐ]{4,}\b", title)]
        if t_words:
            matched_words = sum(1 for w in t_words if w in content.lower())
            match_ratio = matched_words / len(t_words)
            if match_ratio < 0.25:
                checks["title_content_relation"] = False
                warnings.append(
                    f"[CHECK 12 - TITLE VS CONTENT] Mức độ tương đồng giữa tiêu đề và nội dung thấp ({match_ratio * 100:.0f}% từ khóa)."
                )

    # -------------------------------------------------------------
    # CHECK 13: DUPLICATE DETECTION (WARNING)
    # -------------------------------------------------------------
    doc_id = doc.get("id")
    is_duplicate = False

    if doc_id:
        if doc_id in seen_ids:
            is_duplicate = True
            warnings.append(f"[CHECK 13 - DUPLICATE] Trùng lặp document_id: '{doc_id}'.")
        seen_ids.add(doc_id)

    if src_url:
        if src_url in seen_urls:
            is_duplicate = True
            warnings.append(f"[CHECK 13 - DUPLICATE] Trùng lặp source_url: '{src_url}'.")
        seen_urls.add(src_url)

    if src_file:
        norm_f = Path(src_file).name.lower()
        if norm_f in seen_files:
            is_duplicate = True
            warnings.append(f"[CHECK 13 - DUPLICATE] Trùng lặp tệp tài liệu: '{norm_f}'.")
        seen_files.add(norm_f)

    if is_duplicate:
        checks["duplicate"] = False

    # -------------------------------------------------------------
    # CHECK 14: PROVENANCE (WARNING nếu thiếu thông tin nguồn)
    # -------------------------------------------------------------
    prov = doc.get("provenance")
    if not isinstance(prov, dict):
        checks["provenance"] = False
        warnings.append("[CHECK 14 - PROVENANCE] Không có thông tin truy vết nguồn gốc (provenance is missing).")
    else:
        req_keys = [
            "notification_index",
            "notification_title",
            "detail_file",
            "document_file",
            "extracted_file",
        ]
        missing_keys = [k for k in req_keys if k not in prov or prov[k] is None]
        if missing_keys:
            checks["provenance"] = False
            warnings.append(
                f"[CHECK 14 - PROVENANCE] Thiếu các trường truy vết nguồn: {', '.join(missing_keys)}."
            )

    # -------------------------------------------------------------
    # CHECK 15: EFFECTIVE STATUS (WARNING nếu khác 'unknown')
    # -------------------------------------------------------------
    eff_status = doc.get("effective_status")
    if eff_status != "unknown":
        checks["effective_status"] = False
        warnings.append(
            f"[CHECK 15 - EFFECTIVE STATUS] effective_status là '{eff_status}' thay vì 'unknown' (cần con người xác minh)."
        )

    return checks, issues, warnings


def calculate_quality_score(issues: List[str], warnings: List[str]) -> Tuple[int, str]:
    """
    Tính điểm chất lượng từ 0 - 100:
    - Bắt đầu: 100 điểm
    - Mỗi ERROR: trừ 25 điểm
    - Mỗi WARNING: trừ 5 điểm
    - Phân loại:
        * GOOD: Không có ERROR và không có WARNING nghiêm trọng (score >= 85, issues == 0)
        * WARNING: Có cảnh báo nhưng không có lỗi nghiêm trọng (score 50-84 hoặc warnings > 0)
        * ERROR: Có lỗi nghiêm trọng (issues > 0 hoặc score < 50)
    """
    score = 100
    score -= len(issues) * 25
    score -= len(warnings) * 5
    score = max(0, min(100, score))

    if len(issues) > 0 or score < 50:
        status = "ERROR"
    elif len(warnings) > 0 or score < 85:
        status = "WARNING"
    else:
        status = "GOOD"

    return score, status


class DataQualityValidator:
    """
    Điều phối việc kiểm tra chất lượng dataset tại crawler/data/normalized/documents.json
    và xuất báo cáo tại crawler/data/normalized/data_quality_report.json.
    """

    def __init__(
        self,
        documents_file: Path = NORMALIZED_DOCUMENTS_FILE,
        report_file: Optional[Path] = None,
        check_filesystem: bool = True,
    ):
        self.documents_file = Path(documents_file)
        self.report_file = (
            Path(report_file)
            if report_file
            else NORMALIZED_DIR / "data_quality_report.json"
        )
        self.check_filesystem = check_filesystem

    def run(self) -> Dict[str, Any]:
        report = {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_documents": 0,
                "good": 0,
                "warning": 0,
                "error": 0,
                "total_issues": 0,
            },
            "documents": [],
        }

        if not self.documents_file.exists():
            logger.error(f"Không tìm thấy dataset tại: {self.documents_file}")
            return report

        try:
            with open(self.documents_file, "r", encoding="utf-8") as f:
                documents = json.load(f)
        except Exception as e:
            logger.error(f"Lỗi đọc JSON {self.documents_file}: {e}")
            return report

        if not isinstance(documents, list):
            logger.error(f"Dữ liệu trong {self.documents_file} không phải list.")
            return report

        report["summary"]["total_documents"] = len(documents)

        seen_ids: Set[str] = set()
        seen_urls: Set[str] = set()
        seen_files: Set[str] = set()

        for idx, doc in enumerate(documents):
            checks, issues, warnings = validate_document(
                doc=doc,
                seen_ids=seen_ids,
                seen_urls=seen_urls,
                seen_files=seen_files,
                check_filesystem=self.check_filesystem,
            )

            score, status = calculate_quality_score(issues, warnings)

            if status == "GOOD":
                report["summary"]["good"] += 1
            elif status == "WARNING":
                report["summary"]["warning"] += 1
            else:
                report["summary"]["error"] += 1

            report["summary"]["total_issues"] += len(issues) + len(warnings)

            report["documents"].append({
                "document_id": doc.get("id", f"doc_{idx}"),
                "title": doc.get("title", ""),
                "status": status,
                "score": score,
                "issues": issues,
                "warnings": warnings,
                "checks": checks,
            })

        # Lưu file báo cáo
        try:
            self.report_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.report_file, "w", encoding="utf-8") as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            logger.info(f"Đã lưu báo cáo chất lượng dữ liệu tại: {self.report_file}")
        except Exception as e:
            logger.error(f"Lỗi lưu file báo cáo: {e}")

        self._print_summary(report)
        return report

    def _print_summary(self, report: Dict[str, Any]):
        sm = report["summary"]
        print("\n" + "=" * 62)
        print(" DAU SECOND BRAIN - BÁO CÁO KIỂM TRA CHẤT LƯỢNG DỮ LIỆU")
        print("=" * 62)
        print(f"Tổng tài liệu kiểm tra : {sm['total_documents']}")
        print(f"GOOD (Đạt chuẩn)        : {sm['good']}")
        print(f"WARNING (Cần kiểm tra)  : {sm['warning']}")
        print(f"ERROR (Lỗi nghiêm trọng): {sm['error']}")
        print(f"Tổng số vấn đề ghi nhận : {sm['total_issues']}")
        print("=" * 62)

        problem_docs = [
            d for d in report["documents"] if d["status"] in ("WARNING", "ERROR")
        ]
        if problem_docs:
            print(f"\n[!] CÓ {len(problem_docs)} TÀI LIỆU CẦN CON NGƯỜI KIỂM TRA:")
            for d in problem_docs:
                print(f"  - ID: {d['document_id']} | Status: {d['status']} | Score: {d['score']}")
                print(f"    Tiêu đề: {d.get('title', '')[:70]}...")
                for iss in d["issues"]:
                    print(f"      [ERROR] {iss}")
                for w in d["warnings"][:3]:
                    print(f"      [WARN]  {w}")
                if len(d["warnings"]) > 3:
                    print(f"      ... và {len(d['warnings']) - 3} cảnh báo khác.")
        else:
            print("\n[✓] Tất cả tài liệu đều đạt trạng thái GOOD!")
        print("=" * 62 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="Kiểm tra chất lượng dataset chuẩn hóa tại crawler/data/normalized/documents.json"
    )
    parser.add_argument(
        "--file",
        type=str,
        default=str(NORMALIZED_DOCUMENTS_FILE),
        help=f"File documents.json (mặc định: {NORMALIZED_DOCUMENTS_FILE})",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Đường dẫn file báo cáo JSON (mặc định: data_quality_report.json)",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    validator = DataQualityValidator(
        documents_file=Path(args.file),
        report_file=Path(args.output) if args.output else None,
    )
    validator.run()


if __name__ == "__main__":
    main()
