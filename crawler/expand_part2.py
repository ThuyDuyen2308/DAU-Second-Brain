import sys
import os
import json
import re
import time
import hashlib
import urllib.request
import ssl
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urljoin

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

DATASET_PATH = Path("E:/DAU-Second-Brain/crawler/data/normalized/documents.json")

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

EXTRA_SECTIONS = [
    ("Tin tức", "https://dau.edu.vn/tin-tuc-moi-nhat.html?page={p}"),
    ("Sự kiện", "https://dau.edu.vn/su-kien-090713.html?page={p}"),
    ("Hợp tác quốc tế", "https://dau.edu.vn/htqt-tt-tin-tuc.html?page={p}"),
    ("Hội thảo quốc tế", "https://dau.edu.vn/htqt-tt-hoi-thao.html?page={p}"),
    ("Đảm bảo chất lượng", "https://dau.edu.vn/tin-tuc-dbcl.html?page={p}"),
    ("Khoa học công nghệ", "https://dau.edu.vn/khcn-htqt-tin-tuc.html?page={p}"),
    ("Sinh viên", "https://dau.edu.vn/sv-hoat-dong-sinh-vien.html?page={p}"),
    ("Tuyển dụng", "https://dau.edu.vn/tuyen-dung-052747.html?page={p}"),
]

def clean_text(raw: str) -> str:
    if not raw:
        return ""
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    lines = [line.expandtabs(4).rstrip() for line in text.split("\n")]
    cleaned = []
    blank_count = 0
    for line in lines:
        if line == "":
            blank_count += 1
            if blank_count <= 1:
                cleaned.append("")
        else:
            blank_count = 0
            cleaned.append(line)
    return "\n".join(cleaned).strip()

def extract_date(text: str) -> str:
    m = re.search(r"ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})", text[:1200], re.IGNORECASE)
    if m:
        d, mth, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= d <= 31 and 1 <= mth <= 12 and 2000 <= y <= 2030:
            return f"{y:04d}-{mth:02d}-{d:02d}"
    m2 = re.search(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b", text[:1200])
    if m2:
        d, mth, y = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))
        if 1 <= d <= 31 and 1 <= mth <= 12 and 2000 <= y <= 2030:
            return f"{y:04d}-{mth:02d}-{d:02d}"
    return None

def extract_doc_number(text: str) -> str:
    m = re.search(r"(?:Số|SỐ|Số:)\s*[:\.]?\s*([0-9]{1,4}\s*[\/\-]\s*[A-Za-zĐđ0-9\-_]+)", text[:1200], re.IGNORECASE)
    if m:
        num = re.sub(r"\s+", "", m.group(1).strip())
        if len(num) >= 4 and ("/" in num or "-" in num):
            return num
    return None

def fetch_url(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=12, context=ctx) as resp:
        return resp.read().decode("utf-8", errors="ignore")

def main():
    existing_docs = []
    if DATASET_PATH.exists():
        with open(DATASET_PATH, "r", encoding="utf-8") as f:
            existing_docs = json.load(f)

    existing_urls = {d.get("detail_url") or d.get("source_url") for d in existing_docs}
    existing_titles = {d.get("title", "").strip().lower() for d in existing_docs}

    print(f"[*] Dữ liệu hiện có: {len(existing_docs)} văn bản.")
    target_total = 115
    needed = target_total - len(existing_docs)
    print(f"[*] Cần thu thập thêm khoảng {needed} văn bản nữa.")

    discovered = []
    for cat, tmpl in EXTRA_SECTIONS:
        for p in range(1, 15):
            url = tmpl.format(p=p)
            try:
                html = fetch_url(url)
                soup = BeautifulSoup(html, "html.parser")
                links = []
                for a in soup.find_all("a", href=True):
                    href = a["href"]
                    t = a.get_text(strip=True)
                    if href.endswith(".html") and len(t) > 15 and not href.startswith("http"):
                        full = urljoin("https://dau.edu.vn/", href)
                        links.append((cat, t, full))
                    elif "dau.edu.vn" in href and href.endswith(".html") and len(t) > 15:
                        links.append((cat, t, href))

                added = 0
                for c, t, u in links:
                    if u not in [x[2] for x in discovered] and u not in existing_urls:
                        discovered.append((c, t, u))
                        added += 1

                if added == 0 and p > 2:
                    break
                time.sleep(0.2)
            except Exception:
                break

    print(f"[+] Tìm thấy {len(discovered)} liên kết bài viết chưa crawl.")

    new_docs = []
    for idx, (cat_hint, link_text, url) in enumerate(discovered):
        if len(existing_docs) + len(new_docs) >= target_total:
            break

        try:
            html = fetch_url(url)
            soup = BeautifulSoup(html, "html.parser")

            for el in soup(["script", "style", "noscript", "svg", "nav", "footer", "header"]):
                el.decompose()

            h1 = soup.find("h1")
            title = h1.get_text(strip=True) if h1 else link_text
            title = re.sub(r"\s+", " ", title).strip()

            if not title or len(title) < 10 or title.lower() in existing_titles:
                continue

            art = (
                soup.find("article")
                or soup.find("div", class_=re.compile(r"detail|content|news-detail|post|article", re.I))
                or soup.find("div", id=re.compile(r"detail|content|main", re.I))
            )

            raw_text = art.get_text(separator="\n\n", strip=True) if art else soup.get_text(separator="\n\n", strip=True)
            cleaned = clean_text(raw_text)

            lines = [l for l in cleaned.split("\n") if not any(kw in l.lower() for kw in [
                "trang chủ", "sinh viên", "giảng viên", "tra cứu văn bằng", "đăng ký học phần",
                "tin liên quan", "xem tất cả", "hotline", "bản quyền thuộc về"
            ])]
            content_cleaned = "\n".join(lines).strip()

            if len(content_cleaned) < 100:
                continue

            doc_num = extract_doc_number(content_cleaned)
            issue_date = extract_date(content_cleaned)

            doc_hash = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]
            doc_id = f"dau_doc_{doc_hash}"

            doc_item = {
                "id": doc_id,
                "title": title,
                "document_number": doc_num,
                "issue_date": issue_date,
                "issuing_unit": "Trường Đại học Kiến trúc Đà Nẵng",
                "category": cat_hint,
                "subcategory": None,
                "deadline": None,
                "effective_status": "unknown",
                "effective_from": None,
                "effective_to": None,
                "replaced_by": None,
                "source_url": url,
                "detail_url": url,
                "source_file": Path(url).name,
                "file_format": "html",
                "total_pages": 1,
                "content": content_cleaned,
                "pages": [
                    {
                        "page_number": 1,
                        "raw_text": content_cleaned,
                        "cleaned_text": content_cleaned,
                    }
                ],
                "attachments": [],
                "metadata": {
                    "crawled_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "crawl_status": "success",
                    "content_source": "dau_website_portal",
                    "raw_issue_date": issue_date,
                },
                "provenance": {
                    "notification_title": title,
                    "detail_file": url,
                },
            }

            new_docs.append(doc_item)
            existing_titles.add(title.lower())
            print(f"  [{len(existing_docs) + len(new_docs):03d}/{target_total}] {title[:60]}... ({cat_hint})")
            time.sleep(0.2)

        except Exception:
            continue

    all_combined = existing_docs + new_docs
    print(f"\n[+] Tổng số văn bản sau đợt 2: {len(all_combined)} văn bản.")

    with open(DATASET_PATH, "w", encoding="utf-8") as f:
        json.dump(all_combined, f, ensure_ascii=False, indent=2)

    print(f"[THÀNH CÔNG] Đã ghi {len(all_combined)} văn bản vào: {DATASET_PATH}")

if __name__ == "__main__":
    main()