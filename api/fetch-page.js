// 抓取网页正文与标题（与 server.py 逻辑一致）
const https = require('https');
const http = require('http');

function normalizeTitle(s) {
  if (!s) return '';
  return s.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function extractTitle(html) {
  let m;
  m = html.match(/var\s+msg_title\s*=\s*["']([^"']+)["']/i);
  if (m) return normalizeTitle(m[1]);
  m = html.match(/<meta[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:title["']/i);
  if (m) return normalizeTitle(m[1]);
  m = html.match(/<span[^>]*class\s*=[^>]*js_title_inner[^>]*>([^<]+)<\/span>/is);
  if (m) return normalizeTitle(m[1]);
  m = html.match(/<title[^>]*>([^<]+)<\/title>/is);
  if (m) return normalizeTitle(m[1]);
  return '';
}

function extractContent(html) {
  let s = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, '\n').trim();
  return s.slice(0, 15000);
}

function fetchUrl(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const isHttps = u.protocol === 'https:';
    const lib = isHttps ? https : http;
    const req = lib.get(
      urlStr,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } },
      (res) => {
        const chunks = [];
        res.on('data', (ch) => chunks.push(ch));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const html = (res.headers['content-type'] || '').toLowerCase().includes('gbk')
            ? buf.toString('gbk')
            : buf.toString('utf-8');
          resolve(html);
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', title: '', content: '' });
    return;
  }
  let body;
  try {
    body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
  } catch (e) {
    res.status(200).json({ error: 'Invalid JSON', title: '', content: '' });
    return;
  }
  const url = (body.url || '').trim();
  if (!url) {
    res.status(200).json({ error: '缺少 url', title: '', content: '' });
    return;
  }
  try {
    const html = await fetchUrl(url);
    const title = extractTitle(html);
    const content = extractContent(html);
    res.status(200).json({ title, content });
  } catch (err) {
    res.status(200).json({ error: err.message || '抓取失败', title: '', content: '' });
  }
};
