// 文上传：解析 TXT / PDF / DOCX，供线上部署（如 Vercel）使用
const fs = require('fs');

function setCors(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, statusCode, message) {
  res.status(statusCode).end(JSON.stringify({ error: message, text: '' }));
}

// 启动时加载依赖，缺失时立刻报错便于排查
let formidable;
let pdfParse;
let mammoth;
try {
  formidable = require('formidable');
} catch (e) {
  console.error('[parse-doc] formidable 加载失败:', e.message);
}
try {
  pdfParse = require('pdf-parse');
  if (pdfParse && typeof pdfParse.default === 'function') pdfParse = pdfParse.default;
} catch (e) {
  console.error('[parse-doc] pdf-parse 加载失败:', e.message);
}
try {
  mammoth = require('mammoth');
} catch (e) {
  console.error('[parse-doc] mammoth 加载失败:', e.message);
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
  if (!pdfParse || typeof pdfParse !== 'function') {
    return Promise.reject(new Error('pdf-parse 未安装或加载失败，请执行 npm install pdf-parse'));
  }
  return pdfParse(buffer).then((data) => (data && data.text) ? data.text : '');
}

function parseDocx(buffer) {
  if (!mammoth || !mammoth.extractRawText) {
    return Promise.reject(new Error('mammoth 未安装或加载失败，请执行 npm install mammoth'));
  }
  return mammoth.extractRawText({ buffer }).then((result) => result.value || '');
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
  try {
    setCors(res);
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    if (req.method !== 'POST') {
      sendError(res, 405, '请使用 POST 上传文件');
      return;
    }
    const contentType = (req.headers['content-type'] || '');
    if (!contentType.includes('multipart/form-data')) {
      sendError(res, 400, '请使用 multipart/form-data 上传文件');
      return;
    }
    if (!formidable) {
      sendError(res, 500, 'formidable 未安装或加载失败，请在项目根目录执行 npm install');
      return;
    }

    const form = formidable.IncomingForm({ maxFileSize: 15 * 1024 * 1024 });
    await new Promise((resolve, reject) => {
      form.parse(req, async (err, fields, files) => {
        try {
          if (err) {
            sendError(res, 200, '解析请求失败: ' + (err.message || String(err)));
            resolve();
            return;
          }
          let file = files && files.file;
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
            sendError(res, 200, '未收到文件，请用字段名 file 上传');
            resolve();
            return;
          }
          const filepath = file.filepath != null ? file.filepath : file.path;
          const filename = (file.originalFilename || file.name || 'document').replace(/\s/g, '_');
          let buffer;
          try {
            buffer = fs.readFileSync(filepath);
          } catch (e) {
            sendError(res, 200, '读取文件失败: ' + (e.message || ''));
            resolve();
            return;
          }
          const text = await parseDocFile(buffer, filename);
          const out = text ? text.slice(0, 50000) : '';
          res.status(200).end(JSON.stringify({ text: out, filename: filename }));
        } catch (e) {
          const msg = (e && e.message) || String(e);
          console.error('[parse-doc] 解析异常:', msg);
          res.status(200).end(JSON.stringify({ error: msg, text: '' }));
        }
        resolve();
      });
    });
  } catch (e) {
    const msg = (e && e.message) || String(e);
    console.error('[parse-doc] 处理异常:', msg);
    setCors(res);
    res.status(500).end(JSON.stringify({ error: 'parse-doc 异常: ' + msg, text: '' }));
  }
};
