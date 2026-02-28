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
  extractor: { enabled: false, apiURL: '' },

  // 登录鉴权（Supabase）：未配置时视为「无鉴权」
  // 在 Supabase 控制台 → API Keys 拿到 anon public，Data API 拿到 Project URL
  supabase: {
    url: '',      // 如：https://xxxx.supabase.co
    anonKey: ''   // 如：eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  }
};
