// 线上环境：从 Vercel 环境变量读取 useAI，不暴露 API Key
module.exports = function (req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(200).end();
    return;
  }
  const useAI = (process.env.USE_AI || '').toLowerCase().trim();
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasQwen = !!process.env.DASHSCOPE_API_KEY;
  const hasZhipu = !!process.env.ZHIPU_API_KEY;
  let effective = null;
  if (useAI === 'openai' && hasOpenAI) effective = 'openai';
  else if (useAI === 'qwen' && hasQwen) effective = 'qwen';
  else if (useAI === 'zhipu' && hasZhipu) effective = 'zhipu';
  else if (hasOpenAI) effective = 'openai';
  else if (hasQwen) effective = 'qwen';
  else if (hasZhipu) effective = 'zhipu';
  const body = {
    useAI: effective,
    debug: {
      envHasUSE_AI: !!process.env.USE_AI,
      envHasDASHSCOPE_API_KEY: hasQwen,
      envHasOPENAI_API_KEY: hasOpenAI,
      envHasZHIPU_API_KEY: hasZhipu
    }
  };
  res.writeHead(200);
  res.end(JSON.stringify(body));
};
