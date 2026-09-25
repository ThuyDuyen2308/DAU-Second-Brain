"""
Module phân tích cú pháp HTML cho Crawler DAU
Trích xuất: Tiêu đề, Ngày đăng, URL chi tiết, File đính kèm (PDF/DOC/DOCX/...)
"""

import re
from urllib.parse import urljoin, urlparse, parse_qs, unquote
from bs4 import BeautifulSoup

DATE_REGEX = re.compile(r"\b(\d{1,2}/\d{1,2}/\d{4}(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?)\b")
ATTACHMENT_EXT_REGEX = re.compile(
    r"\.(pdf|docx?|xlsx?|pptx?|zip|rar)($|\?|#)",
    re.IGNORECASE,
)

class AuthenticationRequiredError(Exception):
    """Ngoại lệ khi trang yêu cầu đăng nhập hoặc phiên làm việc hết hạn."""
    pass

def normalize_attachment_url(url: str, base_url: str = "https://sinhvien.dau.edu.vn") -> str:
    r"""
    Chuẩn hóa URL file đính kèm:
    - Nếu là URL dạng /FileManager/ViewFileOnline?filePath=... thì bóc tách lấy link file PDF/DOC thực tế bên trong.
    - Chuẩn hóa dấu gạch chéo ngược (\) thành (/), loại bỏ dấu gạch chéo kép sau domain.
    - Loại bỏ tham số rác để trả về URL tải trực tiếp duy nhất.
    """

    if not url:
        return ""
    url = url.strip().replace("\\\\", "/").replace("\\", "/")

    parsed = urlparse(url)
    # Nếu là link xem file online của FileManager
    if "viewfile" in parsed.path.lower() or "filemanager" in parsed.path.lower():
        qs = parse_qs(parsed.query)
        for param in ["filePath", "filepath", "file", "path", "url"]:
            if param in qs and qs[param]:
                target = unquote(qs[param][0]).strip().replace("\\\\", "/").replace("\\", "/")
                if target.startswith("http://") or target.startswith("https://"):
                    url = target
                else:
                    url = urljoin(base_url, target)
                break
    elif not (url.startswith("http://") or url.startswith("https://")):
        url = urljoin(base_url, url)

    parsed = urlparse(url)
    clean_path = re.sub(r"/+", "/", parsed.path)
    clean_url = f"{parsed.scheme}://{parsed.netloc}{clean_path}"
    if parsed.query and not ("viewfile" in clean_path.lower() or "filemanager" in clean_path.lower()):
        clean_url += f"?{parsed.query}"
    return clean_url

def is_valid_announcement_item(title: str, href: str, date: str = "") -> bool:
    """Kiểm tra một mục trích xuất có thực sự là thông báo hợp lệ hay chỉ là link điều hướng/menu."""
    if not title:
        return False
    clean_t = clean_text(title).replace("&nbsp;", " ").replace("&nbsp", " ").strip()
    if len(clean_t) < 8:
        return False

    lower_t = clean_t.lower()
    generic_titles = [
        "tin tức", "thông báo", "trang chủ", "menu", "đăng nhập", "dashboard",
        "tra cứu thông tin", "tin tức thông báo", "văn bản thông báo"
    ]
    if lower_t in generic_titles or lower_t.startswith("&nbsp"):
        return False

    lower_href = href.lower()
    navigation_pages = [
        "sinh-vien-tin-tuc-thong-bao.html",
        "thong-bao.html",
        "dang-nhap.html",
        "dashboard.html",
        "tra-cuu",
        "dm-tin"
    ]
    if any(nav in lower_href for nav in navigation_pages):
        return False

    return True


def is_login_required(response_or_soup, current_url: str = "") -> bool:
    """
    Kiểm tra xem trang có yêu cầu đăng nhập hay không:
    - URL chuyển hướng đến trang đăng nhập (/sinh-vien-dang-nhap.html, /SinhVien/Logout)
    - Tồn tại form đăng nhập chứa input UserName/Password/Captcha
    - Thông báo flash warning yêu cầu đăng nhập
    """
    # 1. Kiểm tra URL nếu truyền vào đối tượng response của requests
    resp_url = getattr(response_or_soup, "url", None)
    if isinstance(resp_url, str):
        url_lower = resp_url.lower()
        if "dang-nhap" in url_lower or "logout" in url_lower:
            return True

    # 2. Kiểm tra cookies nếu có
    cookies = getattr(response_or_soup, "cookies", None)
    if cookies and hasattr(cookies, "get"):
        warning = cookies.get("Flash.Warning", "")
        if warning and ("dang nhap" in warning.lower() or "đăng nhập" in warning.lower()):
            return True

    # 3. Phân tích nội dung HTML
    if isinstance(response_or_soup, BeautifulSoup):
        soup = response_or_soup
    elif hasattr(response_or_soup, "text"):
        soup = BeautifulSoup(response_or_soup.text, "html.parser")
    else:
        soup = BeautifulSoup(str(response_or_soup), "html.parser")

    # Kiểm tra form đăng nhập
    has_user_input = soup.find("input", {"name": re.compile(r"username", re.I)}) is not None
    has_pass_input = soup.find("input", {"name": re.compile(r"password", re.I)}) is not None
    if has_user_input and has_pass_input:
        return True

    # Kiểm tra chữ trên trang
    text = soup.get_text()
    if ("Vui lòng đăng nhập lại hệ thống" in text) or ("Đăng nhập" in text and has_user_input):
        return True

    return False


def extract_date_from_text(text: str) -> str:
    """Tìm chuỗi ngày tháng (DD/MM/YYYY) trong đoạn văn bản."""
    if not text:
        return ""
    match = DATE_REGEX.search(text)
    if match:
        return match.group(1).strip()
    return ""


def clean_text(text: str) -> str:
    """Làm sạch khoảng trắng thừa và ký tự đặc biệt."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def parse_announcement_list(html_content: str, base_url: str = "https://sinhvien.dau.edu.vn") -> list[dict]:
    """
    Trích xuất danh sách thông báo từ mã nguồn HTML trang danh mục thông báo.
    Hỗ trợ cấu trúc Bảng (Table), Khối danh sách (Cards/List items) và Fallback liên kết.

    Trả về danh sách dict:
    [
        {
            "title": "...",
            "date": "...",
            "detail_url": "...",
            "attachments": []
        },
        ...
    ]
    """
    soup = BeautifulSoup(html_content, "html.parser")

    # Kiểm tra nếu đây là trang đăng nhập
    if is_login_required(soup):
        raise AuthenticationRequiredError(
            "Trang web chuyển hướng đến trang đăng nhập hoặc yêu cầu xác thực phiên làm việc."
        )

    results = []
    seen_urls = set()

    # CHIẾN LƯỢC 1: Tìm theo thẻ bảng <table> (Cấu trúc phổ biến của OneUni / ASC)
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all(["td", "th"])
            if not cells:
                continue

            link_tag = row.find("a", href=True)
            if not link_tag:
                continue

            href = link_tag.get("href", "").strip()
            # Bỏ qua các liên kết phân trang, sắp xếp, javascript
            if not href or href.startswith("javascript:") or href == "#" or "page=" in href:
                continue

            full_url = urljoin(base_url, href)
            if full_url in seen_urls:
                continue

            title = clean_text(link_tag.get_text() or link_tag.get("title", ""))
            if not is_valid_announcement_item(title, href):
                continue

            # Tìm ngày đăng trong các ô của hàng
            date_str = ""
            for cell in cells:
                date_found = extract_date_from_text(cell.get_text())
                if date_found:
                    date_str = date_found
                    break

            seen_urls.add(full_url)
            results.append({
                "title": title,
                "date": date_str,
                "detail_url": full_url,
                "attachments": []
            })

    if results:
        return results

    # CHIẾN LƯỢC 2: Tìm theo các khối danh sách / cards (.news-item, .tin-tuc-item, .item, li, etc.)
    item_selectors = [
        ".tin-tuc-item", ".news-item", ".item-news", ".item-thong-bao",
        ".list-group-item", ".media", ".post-item", ".article-item"
    ]
    items = []
    for sel in item_selectors:
        found = soup.select(sel)
        if found:
            items = found
            break

    if items:
        for item in items:
            link_tag = item.find("a", href=True)
            if not link_tag:
                continue

            href = link_tag.get("href", "").strip()
            if not href or href.startswith("javascript:") or href == "#":
                continue

            full_url = urljoin(base_url, href)
            if full_url in seen_urls:
                continue

            title = clean_text(link_tag.get_text() or link_tag.get("title", ""))
            if not is_valid_announcement_item(title, href):
                continue

            # Tìm ngày trong khối
            date_str = extract_date_from_text(item.get_text())

            seen_urls.add(full_url)
            results.append({
                "title": title,
                "date": date_str,
                "detail_url": full_url,
                "attachments": []
            })

    if results:
        return results

    # CHIẾN LƯỢC 3: Fallback quét tất cả các liên kết có dạng bài viết / chi tiết
    detail_patterns = re.compile(r"(chi-tiet|thong-bao|tin-tuc|bai-viet)", re.IGNORECASE)
    for a in soup.find_all("a", href=True):
        href = a.get("href", "").strip()
        if not href or href.startswith("javascript:") or href == "#":
            continue

        # Kiểm tra nếu href có dạng bài viết chi tiết và có đuôi .html
        if detail_patterns.search(href) and href.endswith(".html") and "dm-tin" not in href:
            full_url = urljoin(base_url, href)
            if full_url in seen_urls:
                continue

            title = clean_text(a.get_text() or a.get("title", ""))
            if not is_valid_announcement_item(title, href):
                continue

            # Tìm ngày ở phần tử cha hoặc lân cận
            parent = a.find_parent(["div", "li", "tr", "article"])
            date_str = extract_date_from_text(parent.get_text()) if parent else ""

            seen_urls.add(full_url)
            results.append({
                "title": title,
                "date": date_str,
                "detail_url": full_url,
                "attachments": []
            })

    return results


def extract_main_content(soup: BeautifulSoup) -> str:
    """Trích xuất nội dung văn bản chính của thông báo từ mã HTML trang chi tiết."""
    import copy
    work_soup = copy.copy(soup)

    # Loại bỏ các thẻ và khối không thuộc nội dung bài viết
    for tag in work_soup(["script", "style", "header", "footer", "nav", "aside", "noscript"]):
        tag.decompose()

    unwanted_classes = [
        "header", "footer", "menu", "user-account", "search-bar", "breadcrumb",
        "sidebar", "menu-btn", "notification", "notification2", "tin-lien-quan",
        "tin-tuc-khac", "right-sidebar"
    ]
    for unwanted_cls in unwanted_classes:
        for el in work_soup.find_all(class_=lambda c: c and any(cls == unwanted_cls for cls in c.lower().split())):
            el.decompose()

    content_selectors = [
        ".detail-Tin",
        ".portlet-body.detail-Tin",
        ".detail-content",
        ".news-detail",
        ".post-content",
        ".article-content",
        ".content-detail",
        ".noidung-tin",
        ".noidung",
        ".content-txt",
        "article",
        ".main-content",
        "#content",
        ".content",
    ]

    content_elem = None
    for sel in content_selectors:
        found = work_soup.select_one(sel)
        if found and len(found.get_text(strip=True)) > 20:
            content_elem = found
            break

    if not content_elem:
        content_elem = work_soup.body or work_soup

    # Trích xuất văn bản có phân cách dòng rõ ràng
    text = content_elem.get_text(separator="\n", strip=True)
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    return "\n".join(lines).strip()


def parse_announcement_detail(html_content: str, base_url: str = "https://sinhvien.dau.edu.vn") -> dict:
    """
    Trích xuất thông tin chi tiết của một thông báo từ mã HTML trang chi tiết:
    - Tiêu đề (title)
    - Ngày đăng (date)
    - URL trang chi tiết (detail_url nếu có trong meta/canonical)
    - Nội dung thông báo (content)
    - Danh sách file đính kèm chuẩn hóa duy nhất (PDF, DOC, DOCX, XLS, XLSX, ZIP, RAR,...)

    Trả về dict:
    {
        "title": "...",
        "date": "...",
        "detail_url": "...",
        "content": "...",
        "attachments": ["https://...file.pdf", ...]
    }
    """
    soup = BeautifulSoup(html_content, "html.parser")
    attachments = []
    seen_attachments = set()

    # 1. Tìm trong tất cả thẻ <a>
    for a in soup.find_all("a", href=True):
        href = a.get("href", "").strip()
        if not href or href.startswith("javascript:") or href == "#":
            continue

        text = a.get_text(strip=True).lower()

        # Kiểm tra đuôi mở rộng của file
        is_attach = bool(ATTACHMENT_EXT_REGEX.search(href))

        # Kiểm tra từ khóa đính kèm hoặc thư mục download
        if not is_attach:
            is_download_folder = any(kw in href.lower() for kw in ["/download/", "/upload/", "/files/", "/van-ban/", "viewfile", "filemanager"])
            is_download_text = any(kw in text for kw in ["tải về", "đính kèm", "download", "tải file", ".pdf", ".doc", "xem:"])
            if is_download_folder or is_download_text or a.has_attr("download"):
                is_attach = True

        if is_attach:
            clean_file_url = normalize_attachment_url(href, base_url=base_url)
            # Chỉ nhận nếu URL sau chuẩn hóa trỏ tới file tài liệu hợp lệ
            if clean_file_url and clean_file_url not in seen_attachments:
                if ATTACHMENT_EXT_REGEX.search(clean_file_url) or any(kw in clean_file_url.lower() for kw in ["/upload/", "/media/", "/files/"]):
                    seen_attachments.add(clean_file_url)
                    attachments.append(clean_file_url)

    # 2. Tìm trong các thẻ nhúng tài liệu (iframe, embed, object)
    for tag in soup.find_all(["iframe", "embed", "object"]):
        src = tag.get("src") or tag.get("data")
        if src and ATTACHMENT_EXT_REGEX.search(src):
            clean_file_url = normalize_attachment_url(src.strip(), base_url=base_url)
            if clean_file_url and clean_file_url not in seen_attachments:
                seen_attachments.add(clean_file_url)
                attachments.append(clean_file_url)

    # 3. Trích xuất tiêu đề nếu có trong thẻ h1/h2/h3
    detail_title = ""
    for heading in soup.find_all(["h1", "h2", "h3"]):
        heading_text = clean_text(heading.get_text())
        if len(heading_text) > 10 and not any(kw in heading_text.lower() for kw in ["trường đại học", "cổng thông tin"]):
            detail_title = heading_text
            break

    # Nếu chưa tìm được tiêu đề từ heading, lấy từ <title>
    if not detail_title and soup.title:
        title_text = clean_text(soup.title.get_text())
        if len(title_text) > 5 and "đăng nhập" not in title_text.lower():
            detail_title = title_text

    # 4. Trích xuất ngày từ trang chi tiết
    detail_date = extract_date_from_text(soup.get_text())

    # 5. Trích xuất detail_url từ metadata nếu có
    detail_url = ""
    canon = soup.find("link", rel=lambda r: r and "canonical" in r)
    if canon and canon.get("href"):
        detail_url = urljoin(base_url, canon.get("href").strip())
    else:
        og_url = soup.find("meta", property=lambda p: p and "og:url" in p.lower())
        if og_url and og_url.get("content"):
            detail_url = urljoin(base_url, og_url.get("content").strip())

    # 6. Trích xuất nội dung văn bản chính
    content = extract_main_content(soup)

    return {
        "title": detail_title,
        "date": detail_date,
        "detail_url": detail_url,
        "content": content,
        "attachments": attachments
    }

