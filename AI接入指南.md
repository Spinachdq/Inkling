# AI 能力接入指南

## 📋 快速开始

### 步骤 1：选择 AI 服务并获取 API Key

推荐国内可用的服务：

| 服务 | 获取地址 | 价格 | 备注 |
|------|---------|------|------|
| **通义千问**（推荐） | https://dashscope.console.aliyun.com/ | 有免费额度 | 阿里云，国内稳定 |
| **智谱 AI** | https://open.bigmodel.cn/ | 有免费额度 | 国内可用 |
| **OpenAI** | https://platform.openai.com/ | 按量付费 | 需要科学上网 |
| **文心一言** | https://cloud.baidu.com/ | 有免费额度 | 百度，需配置较复杂 |

### 步骤 2：创建配置文件

1. 复制 `config.example.js` 为 `config.js`
2. 在 `config.js` 中填入你的 API Key
3. 设置 `useAI` 为你选择的服务（如 `'qwen'`）

示例（通义千问）：

```javascript
var CONFIG = {
  qwen: {
    apiKey: 'sk-你的实际API密钥',
    baseURL: 'https://dashscope.aliyuncs.com/api/v1'
  },
  useAI: 'qwen'
};
```

### 步骤 3：测试

1. 打开 `index.html`
2. 点击「链导入」
3. 粘贴一个网页链接（如：`https://www.example.com/article`）
4. 点击「解析」
5. 等待几秒，应该能看到 AI 解析的结果

---

## 🔒 安全说明

### ⚠️ 当前方案（前端直接调用）的限制

- **API Key 会暴露**：浏览器中可以看到 `config.js`，任何人都能获取你的 API Key
- **仅适合个人测试**：不要在生产环境或公开网站使用
- **有配额风险**：API Key 泄露后可能被滥用，产生费用

### ✅ 推荐方案：后端代理（生产环境）

如果你要部署到线上，应该：

1. **创建后端服务**（Node.js / Python / 其他）
2. **在后端存储 API Key**（环境变量或配置文件）
3. **前端调用后端接口**，后端再调用 AI API
4. **后端做限流、鉴权**，防止滥用

示例后端接口：

```javascript
// 后端：/api/parse-link
POST /api/parse-link
Body: { "url": "https://..." }
Response: { "content": "AI解析的内容..." }
```

然后前端调用：

```javascript
fetch('/api/parse-link', {
  method: 'POST',
  body: JSON.stringify({ url: url })
})
```

---

## 🛠️ 各服务详细配置

### 通义千问（推荐）

1. 注册阿里云账号：https://www.aliyun.com/
2. 开通 DashScope：https://dashscope.console.aliyun.com/
3. 创建 API Key
4. 在 `config.js` 中设置：

```javascript
qwen: {
  apiKey: 'sk-你的密钥',
  baseURL: 'https://dashscope.aliyuncs.com/api/v1'
},
useAI: 'qwen'
```

### 智谱 AI

1. 注册：https://open.bigmodel.cn/
2. 创建 API Key
3. 配置：

```javascript
zhipu: {
  apiKey: '你的密钥',
  baseURL: 'https://open.bigmodel.cn/api/paas/v4'
},
useAI: 'zhipu'
```

### OpenAI

1. 注册：https://platform.openai.com/
2. 创建 API Key
3. 配置（需要科学上网）：

```javascript
openai: {
  apiKey: 'sk-你的密钥',
  baseURL: 'https://api.openai.com/v1'
},
useAI: 'openai'
```

---

## 🐛 常见问题

### Q: 点击解析后提示「未配置 AI 服务」

**A:** 检查是否创建了 `config.js`（不是 `config.example.js`），并且 `useAI` 设置正确。

### Q: 提示「API Key 无效」或「401 错误」

**A:** 
- 检查 API Key 是否正确
- 检查 API Key 是否有余额/配额
- 检查服务是否开通（如通义千问需要先开通 DashScope）

### Q: 解析很慢或超时

**A:** 
- AI 调用通常需要 3-10 秒，请耐心等待
- 如果经常超时，检查网络连接
- 可以尝试其他 AI 服务（如通义千问通常比 OpenAI 快）

### Q: 跨域错误（CORS）

**A:** 
- 某些 AI 服务可能不允许浏览器直接调用
- 解决方案：使用后端代理（见上方「推荐方案」）

### Q: 想同时支持多个 AI 服务

**A:** 修改 `config.js` 中的 `useAI` 即可切换，或修改代码添加「选择服务」的 UI。

---

## 📝 代码结构

- `config.example.js` - 配置模板
- `config.js` - 你的实际配置（需自己创建，不要提交到 Git）
- `js/ai-service.js` - AI 服务调用逻辑
- `js/app.js` - 链导入功能（已更新）
- `js/edit.js` - 编辑页 AI 功能（已更新）

---

## 🎯 下一步

1. ✅ 完成基础配置，测试链接解析
2. 🔄 如需部署，搭建后端代理
3. 🚀 接入更多功能：文档解析、图片识别等

如有问题，查看浏览器控制台（F12）的错误信息。
