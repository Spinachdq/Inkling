# Vercel 部署后仍提示「未配置 AI 服务」— 自查清单

## 1. 确认代码已推送到 GitHub

线上用的必须是**包含 api 接口和最新前端**的版本，否则不会请求 `/api/config`。

在本地项目根目录执行：

```bash
git status
```

确认以下内容**已提交并推送**（在 GitHub 上能看到）：

- 文件夹 **`api/`**（内有 `config.js`、`proxy.js`、`fetch-page.js`）
- 文件 **`js/ai-service.js`**（会请求 `/api/config` 的版本）

若没有，执行：

```bash
git add api/ js/ai-service.js
git commit -m "Add Vercel API and server-side AI config"
git push origin main
```

推送后 Vercel 会自动重新部署（或到 Vercel 控制台手动点一次 **Redeploy**）。

---

## 2. 确认环境变量

在 Vercel 项目 → **Settings** → **Environment Variables** 中要有：

| Key | Value | 环境 |
|-----|--------|------|
| **USE_AI** | `qwen` | Production（建议勾选） |
| **DASHSCOPE_API_KEY** | 你的通义千问 API Key | Production（建议勾选） |

保存后，**无需**为了环境变量再点 Redeploy（运行时即可生效），但若你刚加变量，可以点一次 **Redeploy** 确保用的是最新代码。

---

## 3. 用浏览器检查 /api/config 是否正常

1. 打开你部署好的网站（例如 `https://xxx.vercel.app`）。
2. 按 **F12** 打开开发者工具，切到 **Network（网络）** 面板。
3. 在页面上点一次 **「解析」**（或任意会触发 AI 的操作）。
4. 在请求列表里找 **`config`**（或 `api/config`）。

看结果：

- **有 `config` 请求且状态 200、响应里 `useAI: "qwen"`**  
  → 接口和环境变量都正常，若仍提示未配置，多半是前端缓存，可强刷（Ctrl+F5）或换无痕窗口再试。
- **有 `config` 请求但状态 404**  
  → 说明当前部署里没有 `api` 接口，回到第 1 步确认 `api/` 已提交并推送，且 Vercel 已重新部署。
- **根本没有 `config` 请求**  
  → 说明线上还是旧版前端（没有「先请求 /api/config」的逻辑），确认 `js/ai-service.js` 已推送并重新部署。

---

## 4. 仍不行时

- 在 Vercel 的 **Deployments** 里点进**最新一次**部署，看 **Build Logs** 是否有报错。
- 确认 **Root Directory** 为项目根目录（一般为 `./` 或留空），不要指向子目录，否则可能漏掉 `api/`。
