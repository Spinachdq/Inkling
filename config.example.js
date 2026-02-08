// 配置文件示例
// 复制此文件为 config.js，并填入你的 API Key

// 方案 A：前端直接调用（仅个人测试使用）
// ⚠️ 警告：API Key 会暴露在浏览器中，不要用于生产环境！

var CONFIG = {
  // OpenAI API（需要科学上网）
  openai: {
    apiKey: 'sk-your-openai-api-key-here',
    baseURL: 'https://api.openai.com/v1'
  },
  
  // 通义千问（阿里云，国内可用）
  qwen: {
    apiKey: 'your-qwen-api-key-here',
    baseURL: 'https://dashscope.aliyuncs.com/api/v1'
  },
  
  // 智谱 AI（国内可用）
  zhipu: {
    apiKey: 'your-zhipu-api-key-here',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4'
  },
  
  // 文心一言（百度，国内可用）
  wenxin: {
    apiKey: 'your-wenxin-api-key-here',
    apiSecret: 'your-wenxin-api-secret-here',
    baseURL: 'https://aip.baidubce.com'
  },
  
  // 使用哪个 AI 服务（可选：'openai', 'qwen', 'zhipu', 'wenxin'）
  useAI: 'qwen',
  
  // 网页内容提取服务（可选，用于先提取网页正文，再交给 AI）
  // 如果不需要，可以留空，直接让 AI 处理 URL
  extractor: {
    // 使用 Readability API（免费，但需要后端代理）
    // 或使用其他网页提取服务
    enabled: false,
    apiURL: ''
  }
};
