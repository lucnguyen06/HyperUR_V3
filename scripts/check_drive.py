import urllib.request
import re
import json

urls = [
    ('Link Tổng (Root)', '1WxXT6Mx7ZdknKh_gd-dQr0Jturtkypyq'),
    ('Thư mục 1', '1gSFtHeF7SAINCDG5lBJ5o3RBMS-s90St'),
    ('Thư mục 2', '1PoSGGsS9T9hyEN2GOAZAXqiIchC5Z61n')
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

for name, folder_id in urls:
    url = f"https://drive.google.com/drive/folders/{folder_id}"
    req = urllib.request.Request(url, headers=headers)
    try:
        html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        title_m = re.search(r'<meta property="og:title" content="(.*?)"', html) or re.search(r'<title>(.*?)</title>', html)
        title = title_m.group(1) if title_m else "Unknown"
        print(f"=== {name} (ID: {folder_id}) ===")
        print(f"Tiêu đề thư mục: {title}")
        
        # Try to find file names or folder names in the embedded javascript data
        items = set(re.findall(r'([a-zA-Z0-9_\-.]+\.(?:zip|tar|rar|7z))', html))
        if items:
            print(f"Tìm thấy các file: {list(items)[:10]}")
        else:
            print("Không tìm thấy file trực tiếp trong HTML tĩnh (cần Google Apps Script API để quét sâu).")
    except Exception as e:
        print(f"Lỗi khi đọc {name}: {e}")
