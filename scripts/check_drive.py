import urllib.request
import re
import json

urls = [
    ('Thư mục Global', 'drive/folders/1PoSGGsS9T9hyEN2GOAZAXqiIchC5Z61n'),
    ('Link Tổng (Root)', 'drive/folders/1WxXT6Mx7ZdknKh_gd-dQr0Jturtkypyq'),
    ('Thư mục China', 'drive/folders/1gSFtHeF7SAINCDG5lBJ5o3RBMS-s90St')
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

for name, path in urls:
    url = f"https://drive.google.com/{path}"
    req = urllib.request.Request(url, headers=headers)
    try:
        html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        title_m = re.search(r'<meta property="og:title" content="(.*?)"', html) or re.search(r'<title>(.*?)</title>', html)
        title = title_m.group(1) if title_m else "Unknown"
        print(f"=== {name} ===")
        print(f"Tiêu đề thư mục: {title}")
        
        # Search for all filenames displayed in UI
        strongs = re.findall(r'<strong class="DNoYtb">([^<]+)</strong>', html)
        print(f"Tổng số file hiển thị trong UI: {len(strongs)}")
        for s in strongs:
            if any(k in s.lower() for k in ['nezha', '310', '309', 'wpacnxm']):
                print("  * MATCH:", s)
            elif not s.startswith('UR_'):
                print("  * NON-UR FILE:", s)
    except Exception as e:
        print(f"Lỗi khi đọc {name}: {e}")
