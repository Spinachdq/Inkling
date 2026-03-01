// 文上传：解析 TXT / PDF / DOCX，与 server.py 行为一致，供线上部署（如 Vercel）使用
const fs = require('fs');
const path = require('path');

function setCors(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseTxt(buffer) {
  try {
    return buffer.toString('utf-8');
  } catch (e) {
    try {
      return buffer.toString('gbk');
    } catch (e2) {
      return buffer.toString('utf-8', 'replace');
    }
  }
}

function parsePdf(buffer) {
  try {
    const pdf = require('pdf-parse');
    return pdf(buffer).then((data) => (data && data.text) ? data.text : '');
  } catch (e) {
    return Promise.reject(new Error('未安装 pdf-parse，请执行: npm install pdf-parse'));
  }
}

function parseDocx(buffer) {
  return new Promise((resolve, reject) => {
    try {
      const mammoth = require('mammoth');
      mammoth.extractRawText({ buffer }).then((result) => {
        resolve(result.value || '');
      }).catch(reject);
    } catch (e) {
      reject(new Error('未安装 mammoth，请执行: npm install mammoth'));
    }
  });
}

function parseDocFile(buffer, filename) {
  const name = (filename || '').toLowerCase();
  if (name.endsWith('.txt')) {
    return Promise.resolve(parseTxt(buffer).trim());
  }
  if (name.endsWith('.pdf')) {
    return parsePdf(buffer);
  }
  if (name.endsWith('.docx')) {
    return parseDocx(buffer);
  }
  if (name.endsWith('.doc')) {
    return Promise.reject(new Error('仅支持 .docx，请将 .doc 另存为 .docx 后重试'));
  }
  return Promise.reject(new Error('不支持的文件格式，仅支持 .txt / .pdf / .docx'));
}

module.exports = async function (req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).end(JSON.stringify({ error: '请使用 POST 上传文件' }));
    return;
  }
  const contentType = (req.headers['content-type'] || '');
  if (!contentType.includes('multipart/form-data')) {
    res.status(400).end(JSON.stringify({ error: '请使用 multipart/form-data 上传文件' }));
    return;
  }

  let formidable;
  try {
    formidable = require('formidable');
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: '服务未安装 formidable，请执行: npm install formidable' }));
    return;
  }

  const form = formidable.IncomingForm({ maxFileSize: 15 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(200).end(JSON.stringify({ error: '解析请求失败: ' + (err.message || String(err)), text: '' }));
      return;
    }
    let file = files.file;
    if (!file && files && typeof files === 'object') {
      const keys = Object.keys(files);
      for (let i = 0; i < keys.length; i++) {
        const f = files[keys[i]];
        if (f && (f.filepath || f.path)) {
          file = Array.isArray(f) ? f[0] : f;
          break;
        }
      }
    }
    if (!file || (!file.filepath && !file.path)) {
      res.status(200).end(JSON.stringify({ error: '未收到文件，请用字段名 file 上传', text: '' }));
      return;
    }
    const filepath = file.filepath != null ? file.filepath : file.path;
    const filename = (file.originalFilename || file.name || 'document').replace(/\s/g, '_');
    let buffer;
    try {
      buffer = fs.readFileSync(filepath);
    } catch (e) {
      res.status(200).end(JSON.stringify({ error: '读取文件失败', text: '' }));
      return;
    }
    try {
      const text = await parseDocFile(buffer, filename);
      const out = text ? text.slice(0, 50000) : '';
      res.status(200).end(JSON.stringify({ text: out, filename: filename }));
    } catch (e) {
      res.status(200).end(JSON.stringify({ error: (e && e.message) || String(e), text: '' }));
    }
  });
};
