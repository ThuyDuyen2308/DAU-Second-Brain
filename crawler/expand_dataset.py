"""
crawler/expand_dataset.py

Thu thập bổ sung 90 - 120 thông báo, tin tức và quy chế thực tế từ website
Trường Đại học Kiến trúc Đà Nẵng (https://dau.edu.vn).
Chuẩn hóa theo đúng schema Document của Second Brain và hợp nhất vào
crawler/data/normalized/documents.json.
"""

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
BACKUP_PATH = Path("E:/DAU-Second-Brain/crawler/data/normalized/documents.json.bak_step19")

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
}

SECTION_TEMPLATES = [
    ("Thông báo", "https://dau.edu.vn/thong-bao.html?page={p}"),
    ("Tin tức", "https://dau.edu.vn/tin-tuc-moi-nhat.html?page={p}"),
    ("Văn bản - Thông báo", "https://dau.edu.vn/van-ban-thong-bao-052747.html?page={p}"),
    ("Quy chế - Quy định", "https://dau.edu.vn/quy-che-cua-truong.html?page={p}"),
    ("Sinh viên", "https://dau.edu.vn/sv-hoat-dong-sinh-vien.html?page={p}"),
    ("Sự kiện", "https://dau.edu.vn/su-kien-090713.html?page={p}"),
    ("Tuyển dụng", "https://dau.edu.vn/nhan-su-thong-bao-tuyen-dung.html?page={p}"),
    ("Khoa học công nghệ", "https://dau.edu.vn/khoa-hoc-cong-nghe-052747.html?page={p}"),
    ("Đảm bảo chất lượng", "https://dau.edu.vn/kiem-dinh-chat-luong.html?page={p}"),
]

STATIC_MAJOR_PAGES = [
    ("Đào tạo", "CHƯƠNG TRÌNH ĐÀO TẠO, CHUẨN ĐẦU RA", "https://dau.edu.vn/dao-tao-chuong-trinh-dao-tao.html"),
    ("Quy chế - Quy định", "QUY ĐỊNH 3 CÔNG KHAI CỦA NHÀ TRƯỜNG", "https://dau.edu.vn/quy-dinh-3-cong-khai.html"),
    ("Đảm bảo chất lượng", "KIỂM ĐỊNH CHẤT LƯỢNG CHƯƠNG TRÌNH ĐÀO TẠO", "https://dau.edu.vn/kiem-dinh-chuong-trinh-dao-tao.html"),
    ("Đảm bảo chất lượng", "KIỂM ĐỊNH CƠ SỞ GIÁO DỤC", "https://dau.edu.vn/kiem-dinh-co-so-giao-duc.html"),
    ("Khoa học công nghệ", "KỶ YẾU KHOA HỌC VÀ GIÁO DỤC D.A.U", "https://dau.edu.vn/ky-yeu-khoa-hoc-va-giao-duc-dau.html"),
    ("Đào tạo", "NGÀNH CÔNG NGHỆ THÔNG TIN - DAU", "https://dau.edu.vn/nganh-cong-nghe-thong-tin.html"),
    ("Đào tạo", "NGÀNH KIẾN TRÚC - DAU", "https://dau.edu.vn/nganh-kien-truc.html"),
    ("Đào tạo", "NGÀNH THIẾT KẾ ĐỒ HỌA - DAU", "https://dau.edu.vn/nganh-thiet-ke-do-hoa.html"),
    ("Đào tạo", "NGÀNH THIẾT KẾ NỘI THẤT - DAU", "https://dau.edu.vn/nganh-thiet-ke-noi-that-110942.html"),
    ("Đào tạo", "NGÀNH KỸ THUẬT XÂY DỰNG - DAU", "https://dau.edu.vn/nganh-ky-thuat-xay-dung-041152.html"),
    ("Đào tạo", "NGÀNH QUẢN LÝ XÂY DỰNG - DAU", "https://dau.edu.vn/nganh-quan-ly-xay-dung-054821.html"),
    ("Đào tạo", "NGÀNH LOGISTICS VÀ QUẢN LÝ CHUỖI CUNG ỨNG", "https://dau.edu.vn/nganh-logistics-va-quan-ly-chuoi-cung-ung.html"),
    ("Đào tạo", "NGÀNH NGÔN NGỮ ANH - DAU", "https://dau.edu.vn/nganh-ngon-ngu-anh.html"),
    ("Đào tạo", "NGÀNH NGÔN NGỮ TRUNG QUỐC - DAU", "https://dau.edu.vn/nganh-ngon-ngu-trung-quoc-113320.html"),
    ("Đào tạo", "NGÀNH KẾ TOÁN - DAU", "https://dau.edu.vn/nganh-ke-toan-043615.html"),
    ("Đào tạo", "NGÀNH TÀI CHÍNH - NGÂN HÀNG - DAU", "https://dau.edu.vn/nganh-tai-chinh-ngan-hang-100040.html"),
    ("Đào tạo", "NGÀNH QUẢN TRỊ KINH DOANH - DAU", "https://dau.edu.vn/quan-tri-kinh-doanh.html"),
    ("Đào tạo", "NGÀNH QUẢN TRỊ DỊCH VỤ DU LỊCH VÀ LỮ HÀNH", "https://dau.edu.vn/nganh-quan-tri-dich-vu-du-lich-va-lu-hanh.html"),
    ("Đào tạo", "NGÀNH QUẢN TRỊ KHÁCH SẠN - DAU", "https://dau.edu.vn/nganh-quan-tri-khach-san.html"),
    ("Đào tạo", "NGÀNH CÔNG NGHỆ KỸ THUẬT ĐIỆN - ĐIỆN TỬ", "https://dau.edu.vn/nganh-cong-nghe-ky-thuat-dien-dien-tu.html"),
    ("Đào tạo", "NGÀNH KỸ THUẬT CƠ SỞ HẠ TẦNG - DAU", "https://dau.edu.vn/nganh-ky-thuat-co-so-ha-tang.html"),
    ("Đào tạo", "NGÀNH KỸ THUẬT XÂY DỰNG CÔNG TRÌNH GIAO THÔNG", "https://dau.edu.vn/nganh-ky-thuat-xay-dung-cong-trinh-giao-thong-025030.html"),
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


def extract_document_number(text: str) -> str:
    m = re.search(r"(?:Số|SỐ|Số:)\s*[:\.]?\s*([0-9]{1,4}\s*[\/\-]\s*[A-Za-zĐđ0-9\-_]+)", text[:1200], re.IGNORECASE)
    if m:
        num = re.sub(r"\s+", "", m.group(1).strip())
        if len(num) >= 4 and ("/" in num or "-" in num):
            return num
    return None


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


def categorize(title: str, text: str, default_cat: str) -> str:
    combined = f"{title}\n{text[:600]}".lower()
    if "học phí" in combined or "bảo hiểm" in combined or "học bổng" in combined or "công nợ" in combined:
        return "Học phí"
    elif "phúc khảo" in combined or "điểm thi" in combined or "khảo thí" in combined:
        return "Khảo thí"
    elif "quy đổi" in combined or "chuẩn đầu ra" in combined or "chứng chỉ" in combined:
        return "Chuẩn đầu ra"
    elif "khảo sát" in combined:
        return "Khảo sát"
    elif "tốt nghiệp" in combined or "xét tốt nghiệp" in combined or "đào tạo" in combined or "học phần" in combined:
        return "Đào tạo"
    elif "tuyển dụng" in combined or "việc làm" in combined:
        return "Tuyển dụng"
    elif "sinh viên" in combined or "hoạt động" in combined or "đoàn" in combined:
        return "Sinh viên"
    elif "nghiên cứu" in combined or "khoa học" in combined:
        return "Khoa học công nghệ"
    return default_cat or "Thông báo"


def fetch_url(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=12, context=ctx) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def main():
    print("=" * 65)
    print("  DAU SECOND BRAIN -- BỔ SUNG 90-120 DỮ LIỆU MẪU TỪ WEBSITE TRƯỜNG")
    print("=" * 65)

    # 1. Đọc dữ liệu hiện có
    existing_docs = []
    if DATASET_PATH.exists():
        with open(DATASET_PATH, "r", encoding="utf-8") as f:
            existing_docs = json.load(f)
        print(f"[*] Dữ liệu hiện có: {len(existing_docs)} văn bản.")
        # Backup
        with open(BACKUP_PATH, "w", encoding="utf-8") as f:
            json.dump(existing_docs, f, ensure_ascii=False, indent=2)
        print(f"[*] Đã tạo backup tại: {BACKUP_PATH}")

    existing_urls = {d.get("detail_url") or d.get("source_url") for d in existing_docs}
    existing_titles = {d.get("title", "").strip().lower() for d in existing_docs}

    # 2. Thu thập danh sách URLs bài viết
    print("\n[*] Đang quét danh mục các trang thông báo...")
    discovered = []

    # Thêm các trang ngành / chính sách lớn trước
    for cat, title, url in STATIC_MAJOR_PAGES:
        discovered.append((cat, title, url))

    # Quét qua các section với pagination
    for cat, tmpl in SECTION_TEMPLATES:
        for p in range(1, 10):
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
                time.sleep(0.3)
            except Exception as e:
                break

    print(f"[+] Tìm thấy {len(discovered)} liên kết bài viết tiềm năng.")

    # 3. Lấy nội dung chi tiết từng bài viết (mục tiêu ~100-110 bài mới)
    target_count = 105
    new_documents = []
    print(f"\n[*] Đang trích xuất nội dung chi tiết (Mục tiêu: ~{target_count} tài liệu)...")

    for idx, (cat_hint, link_text, url) in enumerate(discovered):
        if len(new_documents) >= target_count:
            break

        try:
            html = fetch_url(url)
            soup = BeautifulSoup(html, "html.parser")

            # Xóa menu, script, style, nav, footer
            for el in soup(["script", "style", "noscript", "svg", "nav", "footer", "header"]):
                el.decompose()

            # Tìm tiêu đề
            h1 = soup.find("h1")
            title = h1.get_text(strip=True) if h1 else link_text
            title = re.sub(r"\s+", " ", title).strip()

            if not title or len(title) < 10:
                continue

            if title.lower() in existing_titles:
                continue

            # Tìm vùng nội dung chính
            art = (
                soup.find("article")
                or soup.find("div", class_=re.compile(r"detail|content|news-detail|post|article", re.I))
                or soup.find("div", id=re.compile(r"detail|content|main", re.I))
            )

            raw_text = art.get_text(separator="\n\n", strip=True) if art else soup.get_text(separator="\n\n", strip=True)
            cleaned = clean_text(raw_text)

            # Lọc bớt các dòng lặp lại của template chung
            lines = [l for l in cleaned.split("\n") if not any(kw in l.lower() for kw in [
                "trang chủ", "sinh viên", "giảng viên", "tra cứu văn bằng", "đăng ký học phần",
                "tin liên quan", "xem tất cả", "hotline", "bản quyền thuộc về"
            ])]
            content_cleaned = "\n".join(lines).strip()

            if len(content_cleaned) < 120:
                continue

            # Metadata trích xuất
            doc_num = extract_document_number(content_cleaned)
            issue_date = extract_date(content_cleaned)
            final_cat = categorize(title, content_cleaned, cat_hint)

            # Checksum
            doc_hash = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]
            doc_id = f"dau_doc_{doc_hash}"

            # Document item
            doc_item = {
                "id": doc_id,
                "title": title,
                "document_number": doc_num,
                "issue_date": issue_date,
                "issuing_unit": "Trường Đại học Kiến trúc Đà Nẵng",
                "category": final_cat,
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

            new_documents.append(doc_item)
            existing_titles.add(title.lower())
            print(f"  [{len(new_documents):03d}/{target_count}] {title[:60]}... ({final_cat})")
            time.sleep(0.3)

        except Exception as e:
            continue

    print(f"\n[+] Đã trích xuất thành công {len(new_documents)} văn bản mới từ website trường.")

    # 4. Hợp nhất với dữ liệu cũ
    all_combined = existing_docs + new_documents
    print(f"[*] Tổng số văn bản sau khi bổ sung: {len(all_combined)} văn bản (Cũ: {len(existing_docs)}, Mới: {len(new_documents)}).")

    with open(DATASET_PATH, "w", encoding="utf-8") as f:
        json.dump(all_combined, f, ensure_ascii=False, indent=2)

    print(f"[THÀNH CÔNG] Đã ghi {len(all_combined)} văn bản vào: {DATASET_PATH}")


if __name__ == "__main__":
    main()