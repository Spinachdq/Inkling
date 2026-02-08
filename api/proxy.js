// 代理请求到 AI 服务，在服务端注入 API Key（不暴露给前端）
const https = require('https');
const http = require('http');

function request(urlStr, options, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const isHttps = u.protocol === 'https:';
    const lib = isHttps ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        method: options.method || 'POST',
        headers: options.headers || {}
      },
      (res) => {
        let data = '';
        res.on('data', (ch) => { data += ch; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ error: data || 'Parse error' });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  let body;
  try {
    body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }
  const targetUrl = body.url;
  let headers = body.headers || {};
  const data = body.body;

  if (!targetUrl) {
    res.status(400).json({ error: 'Missing url' });
    return;
  }

  // 服务端注入 Key：若前端未传 Authorization，则从环境变量补全
  if (!headers.Authorization || !headers['Authorization']) {
    if (targetUrl.includes('api.openai.com') && process.env.OPENAI_API_KEY) {
      headers = { ...headers, Authorization: 'Bearer ' + process.env.OPENAI_API_KEY };
    } else if (targetUrl.includes('dashscope.aliyuncs.com') && process.env.DASHSCOPE_API_KEY) {
      headers = { ...headers, Authorization: 'Bearer ' + process.env.DASHSCOPE_API_KEY };
    } else if (targetUrl.includes('open.bigmodel.cn') && process.env.ZHIPU_API_KEY) {
      headers = { ...headers, Authorization: 'Bearer ' + process.env.ZHIPU_API_KEY };
    }
  }

  try {
    const result = await request(targetUrl, { method: 'POST', headers }, data);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Proxy request failed' });
  }
};
