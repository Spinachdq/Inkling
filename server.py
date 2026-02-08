import http.server
import socketserver
import urllib.request
import json
import os
import sys
import re

# 配置
PORT = 8080

def _normalize_title(s):
    if not s:
        return ''
    return re.sub(r'\s+', ' ', s.strip())[:500]

def fetch_page(url):
    """抓取网页，返回 title 和 content。标题按优先级：微信公众号 msg_title -> og:title -> js_title_inner -> <title>"""
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read()
        try:
            html = raw.decode('utf-8')
        except UnicodeDecodeError:
            html = raw.decode('gbk', errors='replace')

    title = ''
    # 1. 微信公众号常用变量 var msg_title = "..."
    m = re.search(r'var\s+msg_title\s*=\s*["\']([^"\']+)["\']', html, re.I)
    if m:
        title = _normalize_title(m.group(1))
    # 2. Open Graph <meta property="og:title" content="...">
    if not title:
        m = re.search(r'<meta\s+[^>]*property\s*=\s*["\']og:title["\'][^>]*content\s*=\s*["\']([^"\']+)["\']', html, re.I)
        if not m:
            m = re.search(r'<meta\s+[^>]*content\s*=\s*["\']([^"\']+)["\'][^>]*property\s*=\s*["\']og:title["\']', html, re.I)
        if m:
            title = _normalize_title(m.group(1))
    # 3. 微信正文标题 <span class="js_title_inner">...</span>
    if not title:
        m = re.search(r'<span\s+[^>]*class\s*=[^>]*js_title_inner[^>]*>([^<]+)</span>', html, re.I | re.S)
        if m:
            title = _normalize_title(m.group(1))
    # 4. 标准 <title>...</title>
    if not title:
        m = re.search(r'<title[^>]*>([^<]+)</title>', html, re.I | re.S)
        if m:
            title = _normalize_title(m.group(1))

    # 简单提取正文：去掉 script/style，再取可见文本
    no_script = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.I | re.S)
    no_style = re.sub(r'<style[^>]*>.*?</style>', '', no_script, flags=re.I | re.S)
    text = re.sub(r'<[^>]+>', ' ', no_style)
    text = re.sub(r'\s+', '\n', text).strip()
    content = text[:15000] if text else ''
    return {'title': title, 'content': content}

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/fetch-page':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            try:
                data = json.loads(post_data.decode('utf-8'))
                url = data.get('url', '').strip()
                if not url:
                    self.wfile.write(json.dumps({'error': '缺少 url'}, ensure_ascii=False).encode('utf-8'))
                    return
                out = fetch_page(url)
                self.wfile.write(json.dumps(out, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.wfile.write(json.dumps({'error': str(e), 'content': '', 'title': ''}, ensure_ascii=False).encode('utf-8'))
            return
        # 拦截 /api/proxy 请求，转发给 AI 服务
        if self.path == '/api/proxy':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data)
                url = data.get('url')
                headers = data.get('headers', {})
                body = data.get('body')
                
                # 转发请求
                req = urllib.request.Request(
                    url, 
                    data=json.dumps(body).encode('utf-8'),
                    headers=headers,
                    method='POST'
                )
                
                with urllib.request.urlopen(req) as response:
                    response_data = response.read()
                    
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(response_data)
                    
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
        else:
            # 其他请求作为静态文件服务
            super().do_POST()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

print(f"启动服务: http://localhost:{PORT}")
print("请在浏览器中访问此地址，不要直接双击打开 HTML 文件")

with socketserver.TCPServer(("", PORT), ProxyHandler) as httpd:
    httpd.serve_forever()
