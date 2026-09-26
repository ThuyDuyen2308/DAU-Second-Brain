# -*- coding: utf-8 -*-
import json, sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from crawler.validity_extractor import analyze_document_validity

DATASET_FILE = Path("crawler/data/normalized/documents.json")

with open(DATASET_FILE, "r", encoding="utf-8") as f:
    docs = json.load(f)

print(f"Bắt đầu phân tích hiệu lực cho {len(docs)} văn bản...")

status_counts = {
    "active": 0,
    "deadline_passed": 0,
    "expired": 0,
    "replaced": 0,
    "unverified": 0,
}

for doc in docs:
    # Nếu doc đã được Admin xác minh thủ công trước đó, bảo toàn 100% không ghi đè
    if doc.get("is_verified") is True:
        continue

    res = analyze_document_validity(doc)

    doc["issue_date"] = res["issue_date"]
    doc["effective_from"] = res["effective_from"]
    doc["effective_to"] = res["effective_to"]
    doc["deadline"] = res["deadline"]
    doc["replaced_by"] = res["replaced_by"]
    doc["suggested_status"] = res["suggested_status"]
    doc["effective_status"] = res["suggested_status"]
    doc["status_evidence"] = res["status_evidence"]
    doc["status_rationale"] = res["status_rationale"]
    doc["certainty"] = res["certainty"]
    if "is_verified" not in doc:
        doc["is_verified"] = False
    if "status_history" not in doc:
        doc["status_history"] = []

    st = doc["effective_status"]
    status_counts[st] = status_counts.get(st, 0) + 1

with open(DATASET_FILE, "w", encoding="utf-8") as f:
    json.dump(docs, f, ensure_ascii=False, indent=2)

print("\n=== THỐNG KÊ KẾT QUẢ PHÂN TÍCH HIỆU LỰC TOÀN BỘ DATASET ===")
for st, cnt in status_counts.items():
    print(f"  - {st:16s}: {cnt} văn bản")
print(f"Tổng số: {len(docs)} văn bản.")