// AI 服务模块 - 用于链接解析和内容总结
// 支持多种 AI 服务：OpenAI、通义千问、智谱、文心一言

(function () {
  'use strict';

  // 检查是否有配置文件（从全局作用域读取）
  var CONFIG = typeof window.CONFIG !== 'undefined' ? window.CONFIG : null;
  var USE_AI = CONFIG && CONFIG.useAI ? CONFIG.useAI : null;

  // ========== 代理调用函数 ==========
  // 通过本地 Python 服务器转发请求，绕过浏览器跨域限制
  function callProxy(targetUrl, headers, body) {
    // 尝试连接本地代理 /api/proxy
    return fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetUrl,
        headers: headers,
        body: body
      })
    }).then(function (res) {
      if (res.status === 404) {
        throw new Error('未检测到代理服务。请运行 "python server.py" 启动服务。');
      }
      if (!res.ok) throw new Error('代理请求失败: ' + res.status);
      return res.json();
    });
  }

  // ========== OpenAI API ==========
  function callOpenAI(apiKey, prompt) {
    var url = 'https://api.openai.com/v1/chat/completions';
    var headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    };
    var body = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000
    };

    return callProxy(url, headers, body)
    .then(function (data) {
      if (data.error) throw new Error(JSON.stringify(data.error));
      return data.choices[0].message.content;
    });
  }

  // ========== 通义千问 API ==========
  function callQwen(apiKey, prompt) {
    var url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
    var headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    };
    var body = {
      model: 'qwen-turbo',
      input: {
        messages: [{ role: 'user', content: prompt }]
      },
      parameters: {
        temperature: 0.7,
        max_tokens: 2000
      }
    };

    return callProxy(url, headers, body)
    .then(function (data) {
      if (data.code) throw new Error(data.message || '通义千问 API 错误');
      return data.output.text || data.output.choices[0].message.content;
    });
  }

  // ========== 智谱 AI ==========
  function callZhipu(apiKey, prompt) {
    var url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    var headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    };
    var body = {
      model: 'glm-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000
    };

    return callProxy(url, headers, body)
    .then(function (data) {
      if (data.error) throw new Error(JSON.stringify(data.error));
      return data.choices[0].message.content;
    });
  }

  // ========== 统一调用接口 ==========
  window.parseLinkWithAI = function (url) {
    if (!CONFIG || !USE_AI) {
      return Promise.reject(new Error('未配置 AI 服务，请创建 config.js 并配置 API Key'));
    }

    var apiKey, callFn;
    
    if (USE_AI === 'openai') {
      apiKey = CONFIG.openai && CONFIG.openai.apiKey;
      callFn = callOpenAI;
    } else if (USE_AI === 'qwen') {
      apiKey = CONFIG.qwen && CONFIG.qwen.apiKey;
      callFn = callQwen;
    } else if (USE_AI === 'zhipu') {
      apiKey = CONFIG.zhipu && CONFIG.zhipu.apiKey;
      callFn = callZhipu;
    } else {
      return Promise.reject(new Error('不支持的 AI 服务: ' + USE_AI));
    }

    if (!apiKey || apiKey.includes('your-') || apiKey.includes('here')) {
      return Promise.reject(new Error('请先在 config.js 中配置有效的 API Key'));
    }

    // 第一步：先由服务器抓取网页正文
    return fetch('/api/fetch-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('抓取网页失败');
      return res.json();
    })
    .then(function (data) {
      var content = (data && data.content) || '';
      var pageTitle = (data && data.title) || '';
      if (!content || content.length < 30) {
        var msg = (data && data.error) || '未能抓取到该链接的正文';
        throw new Error(msg + '。建议：复制链接在浏览器打开，把正文复制后使用「随手记」粘贴，再用 AI 总结。');
      }
      // 第二步：把正文发给 AI 总结
      var prompt = '请对以下网页正文进行解析与总结。\n\n要求：\n1. 提炼主要观点和结构；\n2. 写一段 200–500 字的总结；\n3. 保持逻辑清晰、段落分明。\n\n【正文】\n\n' + content;
      return callFn(apiKey, prompt).then(function (summary) {
        return { summary: summary, title: pageTitle };
      });
    })
    .catch(function (err) {
      console.error('链接解析失败:', err);
      throw new Error(err.message || 'AI 解析失败');
    });
  };

  // ========== 用于编辑页的 AI 功能 ==========
  window.generateOutline = function (text) {
    if (!CONFIG || !USE_AI) {
      return Promise.reject(new Error('未配置 AI 服务'));
    }
    // ... 代码逻辑与上面类似，复用 callFn
    
    var apiKey, callFn;
    if (USE_AI === 'openai') { apiKey = CONFIG.openai.apiKey; callFn = callOpenAI; }
    else if (USE_AI === 'qwen') { apiKey = CONFIG.qwen.apiKey; callFn = callQwen; }
    else if (USE_AI === 'zhipu') { apiKey = CONFIG.zhipu.apiKey; callFn = callZhipu; }
    
    var prompt = '请为以下内容生成结构化大纲（一级和二级标题）：\n\n' + text.slice(0, 3000);
    return callFn(apiKey, prompt);
  };

  /** 卡片核心信息（金句）：10-30 字，用于首页卡片中心展示 */
  window.generateCoreInsight = function (text) {
    if (!CONFIG || !USE_AI) {
      return Promise.reject(new Error('未配置 AI 服务'));
    }
    var apiKey, callFn;
    if (USE_AI === 'openai') { apiKey = CONFIG.openai.apiKey; callFn = callOpenAI; }
    else if (USE_AI === 'qwen') { apiKey = CONFIG.qwen.apiKey; callFn = callQwen; }
    else if (USE_AI === 'zhipu') { apiKey = CONFIG.zhipu.apiKey; callFn = callZhipu; }
    var prompt = '请用 10-30 字提炼以下内容的核心信息，用于卡片展示。' +
      '若为观点分享型：提炼最具代表性的单一核心观点；若为情感记录型：提炼最深刻的心情或核心事件。' +
      '直接输出一句金句，不要标点堆砌，不要引号。\n\n' + text.slice(0, 2000);
    return callFn(apiKey, prompt).then(function (s) {
      s = (s || '').trim().replace(/^["「『"]|["」』"]$/g, '');
      if (s.length > 30) s = s.slice(0, 30) + '…';
      return s;
    });
  };

  /** 编辑页「一句话核心」：兼容旧调用，内部使用金句 prompt */
  window.generateCore = function (text) {
    return window.generateCoreInsight ? window.generateCoreInsight(text) : Promise.reject(new Error('未配置 AI 服务'));
  };

  /**
   * AI 自动打标 + 父类（语义聚合用）
   * 返回 { tags: string[], parent_category: string }
   * 单张卡片标签上限 3 个；parent_category 用于「按分类展示」时聚合（如「人工智能 / AI」）
   */
  window.generateTagsAndParentCategory = function (text) {
    if (!CONFIG || !USE_AI) {
      return Promise.reject(new Error('未配置 AI 服务'));
    }
    var apiKey, callFn;
    if (USE_AI === 'openai') { apiKey = CONFIG.openai && CONFIG.openai.apiKey; callFn = callOpenAI; }
    else if (USE_AI === 'qwen') { apiKey = CONFIG.qwen && CONFIG.qwen.apiKey; callFn = callQwen; }
    else if (USE_AI === 'zhipu') { apiKey = CONFIG.zhipu && CONFIG.zhipu.apiKey; callFn = callZhipu; }
    else { return Promise.reject(new Error('不支持的 AI 服务: ' + USE_AI)); }
    if (!apiKey || apiKey.includes('your-') || apiKey.includes('here')) {
      return Promise.reject(new Error('请先在 config.js 中配置有效的 API Key'));
    }

    var prompt = '分析以下笔记内容，提取 1-3 个核心分类标签。\n' +
      '要求：标签兼具「具体性」与「归属感」，例如「职场技巧」「AI 硬件」「文学感悟」。\n' +
      '同时给出一个用于聚合展示的父类名称（如「人工智能 / AI」「职场」「文学」），将主题相关的标签归入该父类。\n' +
      '只输出一个 JSON 对象，不要其他文字。格式：\n' +
      '{"tags":["标签1","标签2"],"parent_category":"父类名"}\n\n' +
      '【笔记内容】\n\n' + (text || '').slice(0, 4000);

    return callFn(apiKey, prompt).then(function (raw) {
      var s = (raw || '').trim();
      var m = s.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('AI 未返回有效 JSON');
      var obj;
      try { obj = JSON.parse(m[0]); } catch (e) { throw new Error('解析标签结果失败'); }
      var tags = Array.isArray(obj.tags) ? obj.tags.slice(0, 3) : [];
      var parent = (obj.parent_category && String(obj.parent_category).trim()) || '其他';
      return { tags: tags, parent_category: parent };
    });
  };

})();
