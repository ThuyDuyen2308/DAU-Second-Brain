# -*- coding: utf-8 -*-
"""
Module trích xuất và phân tích tình trạng hiệu lực văn bản (Validity Extractor)
Phục vụ DAU-Second-Brain - Tuân thủ nguyên tắc chính xác pháp lý & không suy diễn bừa bãi.
"""

import re
from datetime import datetime, date
from typing import Dict, Any, Optional, Tuple, List

# Các trạng thái hiệu lực pháp lý chuẩn trong hệ thống
STATUS_ACTIVE = "active"
STATUS_DEADLINE_PASSED = "deadline_passed"
STATUS_EXPIRED = "expired"
STATUS_REPLACED = "replaced"
STATUS_UNVERIFIED = "unverified"


def parse_date_vietnamese(d_str: str, m_str: str, y_str: str) -> Optional[str]:
    try:
        d, m, y = int(d_str), int(m_str), int(y_str)
        return f"{y:04d}-{m:02d}-{d:02d}"
    except Exception:
        return None


def extract_dates_from_pages(pages: List[Dict[str, Any]]) -> Dict[str, Any]:
    result = {
        "issue_date": None,
        "effective_from": None,
        "effective_to": None,
        "deadline": None,
        "replaced_by": None,
        "status_evidence": None,
        "evidence_page": None,
        "clause_type": None,
    }

    if not pages:
        return result

    full_text_list = []
    for p in pages:
        p_num = p.get("page_number", 1)
        text = p.get("cleaned_text") or p.get("raw_text") or ""
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        full_text_list.append((p_num, lines, text))

    # 1. Tìm ngày ban hành ở trang đầu hoặc trang cuối (chữ ký)
    for p_num, lines, p_text in full_text_list:
        m_dn = re.search(r"(?:Đà\s*Nẵng|Da\s*Nang)[,\.]?\s*ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})", p_text, re.IGNORECASE)
        if m_dn:
            parsed = parse_date_vietnamese(m_dn.group(1), m_dn.group(2), m_dn.group(3))
            if parsed:
                result["issue_date"] = parsed
                break

    # 2. Quét tìm các điều khoản hiệu lực pháp lý
    for p_num, lines, p_text in full_text_list:
        flat_p_text = re.sub(r"\s+", " ", p_text)

        # Mẫu thay thế văn bản: 'thay thế Quyết định số...'
        m_rep = re.search(r"thay\s+thế\s+(?:cho\s+)?(?:Quyết\s+định|Quy\s+định|văn\s+bản|Thông\s+báo)?\s*(?:số)?\s*([0-9\/\-A-Za-zĐđ_]+)", flat_p_text, re.IGNORECASE)
        if m_rep and not result["replaced_by"]:
            cand = m_rep.group(1).strip()
            if len(cand) >= 3 and ("/" in cand or "-" in cand or cand.isdigit()):
                result["replaced_by"] = cand
                result["status_evidence"] = f"Trang {p_num}: {m_rep.group(0)}"
                result["evidence_page"] = p_num

        # Mẫu hiệu lực lâu dài: 'Thông báo này có hiệu lực từ ... cho đến khi có thông báo mới'
        m_eff_long = re.search(r"(?:Thông\s+báo|Quy\s+định|Quyết\s+định)\s+này\s+có\s+hiệu\s+lực\s+từ\s+([^,\.\n\r]+?)\s+cho\s+đến\s+khi\s+có\s+(?:thông\s+báo|quyết\s+định)\s+mới", flat_p_text, re.IGNORECASE)
        if m_eff_long and not result["status_evidence"]:
            result["clause_type"] = "regulatory"
            result["status_evidence"] = f"Trang {p_num}: {m_eff_long.group(0)}"
            result["evidence_page"] = p_num
            if result["issue_date"]:
                result["effective_from"] = result["issue_date"]

        # Mẫu hiệu lực từ ngày ký
        if re.search(r"có\s+hiệu\s+lực\s+(?:thi\s+hành\s+)?kể\s+từ\s+ngày\s+ký", flat_p_text, re.IGNORECASE) and not result["status_evidence"]:
            result["clause_type"] = "regulatory"
            result["status_evidence"] = f"Trang {p_num}: Có hiệu lực kể từ ngày ký"
            result["evidence_page"] = p_num
            if result["issue_date"]:
                result["effective_from"] = result["issue_date"]

        # Mẫu hiệu lực từ ngày cụ thể
        m_eff = re.search(r"có\s+hiệu\s+lực\s+(?:thi\s+hành\s+)?(?:kể\s+)?từ\s+ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})", flat_p_text, re.IGNORECASE)
        if m_eff and not result["effective_from"]:
            parsed = parse_date_vietnamese(m_eff.group(1), m_eff.group(2), m_eff.group(3))
            if parsed:
                result["effective_from"] = parsed
                result["clause_type"] = "regulatory"
                result["status_evidence"] = f"Trang {p_num}: {m_eff.group(0)}"
                result["evidence_page"] = p_num

        # Mẫu hết hiệu lực
        m_exp = re.search(r"hết\s+hiệu\s+lực\s+(?:kể\s+từ|từ|vào)?\s*ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})", flat_p_text, re.IGNORECASE)
        if m_exp and not result["effective_to"]:
            parsed = parse_date_vietnamese(m_exp.group(1), m_exp.group(2), m_exp.group(3))
            if parsed:
                result["effective_to"] = parsed
                result["status_evidence"] = f"Trang {p_num}: {m_exp.group(0)}"
                result["evidence_page"] = p_num

    # 3. Quét tìm mốc hạn thực hiện (Deadline) với thứ tự ưu tiên chính xác
    for p_num, lines, p_text in full_text_list:
        flat_p_text = re.sub(r"\s+", " ", p_text)

        # Ưu tiên 1: Thời hạn nộp học phí / thời hạn nộp / thời hạn nhận đơn
        m_hp = re.search(r"(?:thời\s+hạn\s+nộp\s+học\s+phí|thời\s+hạn\s+nộp|hạn\s+nộp\s+học\s+phí|thời\s+hạn\s+nhận\s+đơn|hạn\s+cuối|hạn\s+chót)\s*[:\.]?\s*.*?(?:đến|–|-|trước|vào)?\s*(?:(?:hết\s+)?ngày\s+)?(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", flat_p_text, re.IGNORECASE)
        if m_hp:
            parsed = parse_date_vietnamese(m_hp.group(1), m_hp.group(2), m_hp.group(3))
            if parsed:
                result["deadline"] = parsed
                result["clause_type"] = "deadline"
                result["status_evidence"] = f"Trang {p_num}: {m_hp.group(0)}"
                result["evidence_page"] = p_num
                break

    # Nếu chưa tìm thấy ở Ưu tiên 1, quét các mẫu thời gian khác
    if not result["deadline"]:
        for p_num, lines, p_text in full_text_list:
            flat_p_text = re.sub(r"\s+", " ", p_text)

            # Khảo sát / Lịch thi
            m_survey = re.search(r"(?:Thời\s+gian\s+(?:khảo\s+sát|thi|tổ\s+chức)|diễn\s+ra\s+vào)[\s\S]{0,100}?ngày\s+(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", flat_p_text, re.IGNORECASE)
            if m_survey:
                parsed = parse_date_vietnamese(m_survey.group(1), m_survey.group(2), m_survey.group(3))
                if parsed:
                    result["deadline"] = parsed
                    result["clause_type"] = "deadline"
                    result["status_evidence"] = f"Trang {p_num}: {m_survey.group(0)}"
                    result["evidence_page"] = p_num
                    break

            # Mẫu dải thời gian: từ ngày ... đến ngày DD/MM/YYYY
            m_range = re.search(r"(?:(?:đến|trước)\s+(?:hết\s+)?ngày\s+)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", flat_p_text, re.IGNORECASE)
            if m_range:
                parsed = parse_date_vietnamese(m_range.group(1), m_range.group(2), m_range.group(3))
                if parsed:
                    result["deadline"] = parsed
                    result["clause_type"] = "deadline"
                    result["status_evidence"] = f"Trang {p_num}: {m_range.group(0)}"
                    result["evidence_page"] = p_num
                    break

    return result


def analyze_document_validity(doc_or_title: Any, current_date_or_text: Any = "2026-09-26", source_page: int = 1) -> Dict[str, Any]:
    if isinstance(doc_or_title, str):
        title = doc_or_title
        text = str(current_date_or_text) if current_date_or_text else ""
        doc = {
            "title": title,
            "pages": [{"page_number": source_page, "cleaned_text": text}]
        }
        current_date_str = "2026-09-26"
    else:
        doc = doc_or_title
        current_date_str = current_date_or_text if isinstance(current_date_or_text, str) else "2026-09-26"

    pages = doc.get("pages", [])
    title = doc.get("title", "")
    content = doc.get("content", "")
    existing_issue_date = doc.get("issue_date")
    existing_doc_num = doc.get("document_number")

    extracted = extract_dates_from_pages(pages)

    issue_date = existing_issue_date or extracted["issue_date"]
    effective_from = extracted["effective_from"]
    effective_to = extracted["effective_to"]
    deadline = extracted["deadline"] or doc.get("deadline")
    replaced_by = extracted["replaced_by"] or doc.get("replaced_by")
    status_evidence = extracted["status_evidence"]

    suggested_status = "unverified"
    certainty = "LOW"
    status_rationale = ""

    current_dt = datetime.strptime(current_date_str, "%Y-%m-%d").date()

    # 1. Có điều khoản hết hiệu lực rõ ràng
    if effective_to:
        exp_dt = datetime.strptime(effective_to, "%Y-%m-%d").date()
        if current_dt >= exp_dt:
            suggested_status = "expired"
            certainty = "HIGH"
            status_rationale = f"Văn bản có điều khoản hết hiệu lực từ ngày {effective_to} (đã qua mốc thời gian)."
        else:
            suggested_status = "active"
            certainty = "HIGH"
            status_rationale = f"Văn bản có hiệu lực đến ngày {effective_to} (vẫn trong thời hạn hiệu lực)."

    # 2. Có văn bản thay thế
    elif replaced_by:
        suggested_status = "replaced"
        certainty = "HIGH"
        status_rationale = f"Văn bản đã được ghi nhận thay thế bởi: {replaced_by}."

    # 3. Là thông báo có mốc thời hạn thực hiện (Deadline)
    elif deadline:
        dl_dt = datetime.strptime(deadline, "%Y-%m-%d").date()
        if current_dt > dl_dt:
            suggested_status = "deadline_passed"
            certainty = "HIGH"
            status_rationale = f"Thông báo có thời hạn thực hiện đến ngày {deadline} (mốc thời gian này đã qua). Lưu ý: Không đồng nghĩa với việc văn bản bị bãi bỏ."
        else:
            suggested_status = "active"
            certainty = "HIGH"
            status_rationale = f"Thông báo có thời hạn thực hiện đến ngày {deadline} (vẫn còn trong thời hạn)."

    # 4. Là văn bản quy phạm / quy chế dài hạn (có điều khoản có hiệu lực từ ngày ký hoặc từ ngày ban hành)
    elif extracted["clause_type"] == "regulatory" and (effective_from or issue_date):
        eff_dt_str = effective_from or issue_date
        eff_dt = datetime.strptime(eff_dt_str, "%Y-%m-%d").date()
        if current_dt >= eff_dt:
            suggested_status = "active"
            certainty = "MEDIUM"
            status_rationale = f"Văn bản quy định/quy chế có hiệu lực từ ngày {eff_dt_str} và chưa ghi nhận văn bản bãi bỏ/thay thế."

    # 5. Các văn bản quy định chung không có hạn nộp ngắn hạn
    elif any(k in title.lower() for k in ["quy định", "quy chế", "quy trình", "chiến lược"]):
        suggested_status = "active"
        certainty = "MEDIUM"
        if not status_evidence and issue_date:
            status_evidence = f"Văn bản quy định/quy chế ban hành ngày {issue_date}, áp dụng dài hạn trong toàn trường."
        status_rationale = "Văn bản thuộc nhóm quy chế/quy định/quy trình nội bộ áp dụng liên tục cho đến khi có văn bản mới."

    # 6. Mặc định: Giữ UNVERIFIED
    else:
        suggested_status = "unverified"
        certainty = "LOW"
        status_rationale = "Nội dung văn bản chưa đủ dữ kiện điều khoản hiệu lực hoặc thời hạn cụ thể, cần Admin kiểm tra và xác nhận thủ công."
        if not status_evidence:
            status_evidence = "Chưa tìm thấy điều khoản hiệu lực hoặc hạn thực hiện rõ ràng trong nội dung bóc tách."

    return {
        "issue_date": issue_date,
        "effective_from": effective_from,
        "effective_to": effective_to,
        "deadline": deadline,
        "replaced_by": replaced_by,
        "suggested_status": suggested_status,
        "status": suggested_status,
        "status_evidence": status_evidence,
        "evidence": status_evidence,
        "certainty": certainty,
        "status_rationale": status_rationale,
    }