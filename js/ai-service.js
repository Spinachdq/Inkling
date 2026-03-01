// AI 服务模块 - 用于链接解析和内容总结
// 支持多种 AI 服务：OpenAI、通义千问、智谱、文心一言

(function () {
  'use strict';

  // 检查是否有配置文件（从全局作用域读取）
  var CONFIG = typeof window.CONFIG !== 'undefined' ? window.CONFIG : null;
  var USE_AI = CONFIG && CONFIG.useAI ? CONFIG.useAI : null;
  // 线上部署：从 /api/config 获取 useAI，Key 由服务端注入
  var SERVER_PROVIDES_KEY = false;
  var SERVER_CONFIG_FETCHED = false;

  /** 链导入/文上传共用：高保真结构化笔记 prompt（自适应内容解构专家） */
  var PROMPT_STRUCTURED_NOTE = [
    '# Role',
    '你是一位拥有顶级洞察力的【自适应内容解构专家】。你的核心能力是能够透视任何文本的底层逻辑，并以最适合该内容的形式进行高保真还原。',
    '',
    '# Objective',
    '对输入内容进行深度提炼。拒绝笼统概括，追求细节还原。目标是让未看过原内容的学习者能掌握 **80% 以上**的核心细节。',
    '',
    '# Execution Logic（自适应步骤）',
    '1. **内容属性识别**：首先判断内容类型（如：深度述评、技术教程、故事传记、数据报告等）。',
    '2. **逻辑骨架提取**：根据内容属性，自发构建最适合展示该内容的 **3-6 个维度**，标题直接写维度名称。',
    '3. **保留细节**：具体用词、数据与独特比喻等信息保留。',
    '',
    '# Visual Style & Formatting Guidelines',
    '',
    '## 1. 字号与层级 (Size & Hierarchy)',
    '- **大标题**：每一部分的起始必须使用 `## [Emoji] 标题内容`，这对应系统的最大字号。',
    '- **次级强调**：内部小节使用 `### [Emoji] 小标题`。',
    '- **视觉重点**：正文中的重要概念、结论与数据使用 **加粗**。',
    '',
    '## 2. 标准表格 (Strict Table Format) — 严格控制比例',
    '- **使用场景**：仅当内容天然适合表格时（如多维度对比、时间线、并列条目）才使用表格；其余一律用 **段落** 或 **列表** 呈现。',
    '- **硬性比例**：整篇提炼结果中，用表格呈现的内容占 **全文总字数/总篇幅的比例不得超过 40%**。禁止每一部分都用表格总结。',
    '- **优先段落与列表**：多数部分应使用 `##` 标题 + 段落/加粗要点/引用块；表格只是点缀，不是默认选项。',
    '表格格式示例（仅在确实需要时使用）：',
    '| 维度/时间 | 详细描述/要点 | 备注说明 |',
    '| :--- | :--- | :--- |',
    '| [加粗内容] | 详细描述细节 | 补充说明 |',
    '*注意：必须包含第二行的对齐符号 `:---`，确保在编辑器中能正确渲染。*',
    '',
    '## 3. 间距与呼吸感 (Spacing)',
    '- 不同 ## 标题块之间，必须保留【两个空行】，确保在卡片流中看起来不拥挤。',
    '- 使用 > 引用块来承载原文中的精彩表述或比喻，增加页面的视觉丰富度。',
    '',
    '# Output Style',
    '- 拒绝废话，直接输出提炼后的精华。',
    '- 不同主题段落之间保持双倍空行，增强呼吸感。',
    '- **再次强调**：表格总占比 ≤40%，不要所有信息都用表格；多数内容用段落和列表。',
    '- **禁止**：不要使用「核心观点」四个字作为标题或前缀；总结句直接写内容，不要加「核心观点：」或「核心观点:」。',
    '',
    '请对以下正文按上述逻辑进行结构化提炼并输出。',
    '',
    '【正文】',
    ''
  ].join('\n');

  function ensureServerConfig() {
    if (SERVER_CONFIG_FETCHED) return Promise.resolve();
    SERVER_CONFIG_FETCHED = true;
    return fetch('/api/config').then(function (res) {
      if (!res.ok) return {};
      return res.json();
    }).then(function (data) {
      if (data && data.useAI) {
        USE_AI = data.useAI;
        SERVER_PROVIDES_KEY = true;
      }
    }).catch(function (err) {
      console.warn('[AI] /api/config 请求失败，请确认已部署 api 并配置环境变量', err);
    });
  }

  // ========== 代理调用函数 ==========
  // 通过本地 Python 或 Vercel /api/proxy 转发，服务端可注入 API Key
  function callProxy(targetUrl, headers, body) {
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
        throw new Error('未检测到代理服务。请运行 "python server.py" 启动服务，或在 Vercel 上部署并配置环境变量。');
      }
      if (!res.ok) throw new Error('代理请求失败: ' + res.status);
      return res.json();
    });
  }

  // ========== OpenAI API ==========
  function callOpenAI(apiKey, prompt) {
    var url = 'https://api.openai.com/v1/chat/completions';
    var headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = 'Bearer ' + apiKey;
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
    var headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = 'Bearer ' + apiKey;
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
    var headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = 'Bearer ' + apiKey;
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
    var self = this;
    return ensureServerConfig().then(function () {
      if (!USE_AI) {
        return Promise.reject(new Error('未配置 AI 服务。本地：创建 config.js 并配置 API Key。线上（Vercel）：在项目 Settings → Environment Variables 添加 USE_AI=qwen 和 DASHSCOPE_API_KEY，保存后点 Redeploy 重新部署。'));
      }

      var apiKey = null;
      var callFn;
      if (SERVER_PROVIDES_KEY) {
        apiKey = null;
        if (USE_AI === 'openai') callFn = callOpenAI;
        else if (USE_AI === 'qwen') callFn = callQwen;
        else if (USE_AI === 'zhipu') callFn = callZhipu;
        else return Promise.reject(new Error('不支持的 AI 服务: ' + USE_AI));
      } else {
        if (USE_AI === 'openai') { apiKey = CONFIG && CONFIG.openai && CONFIG.openai.apiKey; callFn = callOpenAI; }
        else if (USE_AI === 'qwen') { apiKey = CONFIG && CONFIG.qwen && CONFIG.qwen.apiKey; callFn = callQwen; }
        else if (USE_AI === 'zhipu') { apiKey = CONFIG && CONFIG.zhipu && CONFIG.zhipu.apiKey; callFn = callZhipu; }
        else return Promise.reject(new Error('不支持的 AI 服务: ' + USE_AI));
        if (!apiKey || apiKey.includes('your-') || apiKey.includes('here')) {
          return Promise.reject(new Error('请先在 config.js 中配置有效的 API Key'));
        }
      }
      return doParseLink(url, callFn, apiKey);
    });
  };

  function doParseLink(url, callFn, apiKey) {
    return fetch('/api/fetch-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var content = (data && data.content) || '';
      var pageTitle = (data && data.title) || '';
      if (!content || content.length < 30) {
        var msg = (data && data.error) || '未能抓取到该链接的正文';
        throw new Error(msg + '。建议：复制链接在浏览器打开，把正文复制后使用「随手记」粘贴，再用 AI 总结。');
      }
      var prompt = PROMPT_STRUCTURED_NOTE + '\n\n' + content;
      var summaryPromise = callFn(apiKey, prompt);
      var catTagsPromise = typeof window.generateTagsAndParentCategory === 'function'
        ? window.generateTagsAndParentCategory(content)
        : Promise.resolve({ parent_category: '其他', tags: [] });
      return Promise.all([summaryPromise, catTagsPromise]).then(function (results) {
        var summary = results[0];
        var catResult = results[1] || {};
        return {
          title: pageTitle,
          content: content,
          summary: summary,
          category: (catResult.parent_category && String(catResult.parent_category).trim()) || '其他',
          tags: Array.isArray(catResult.tags) ? catResult.tags.slice(0, 3) : []
        };
      });
    })
    .catch(function (err) {
      console.error('链接解析失败:', err);
      throw new Error(err.message || 'AI 解析失败');
    });
  }

  function getApiKeyAndCallFn() {
    var apiKey = null, callFn;
    if (USE_AI === 'openai') { apiKey = SERVER_PROVIDES_KEY ? null : (CONFIG && CONFIG.openai && CONFIG.openai.apiKey); callFn = callOpenAI; }
    else if (USE_AI === 'qwen') { apiKey = SERVER_PROVIDES_KEY ? null : (CONFIG && CONFIG.qwen && CONFIG.qwen.apiKey); callFn = callQwen; }
    else if (USE_AI === 'zhipu') { apiKey = SERVER_PROVIDES_KEY ? null : (CONFIG && CONFIG.zhipu && CONFIG.zhipu.apiKey); callFn = callZhipu; }
    else return null;
    if (!SERVER_PROVIDES_KEY && (!apiKey || apiKey.includes('your-') || apiKey.includes('here'))) return null;
    return { apiKey: apiKey, callFn: callFn };
  }

  // ========== 用于编辑页的 AI 功能 ==========
  window.generateOutline = function (text) {
    return ensureServerConfig().then(function () {
      if (!USE_AI) return Promise.reject(new Error('未配置 AI 服务'));
      var pair = getApiKeyAndCallFn();
      if (!pair) return Promise.reject(new Error('未配置 AI 服务'));
      var prompt = '请为以下内容生成结构化大纲（一级和二级标题）：\n\n' + text.slice(0, 3000);
      return pair.callFn(pair.apiKey, prompt);
    });
  };

  /**
   * 判断是否为乱码：非中英文字符占比过高，或有效内容过短。
   * 用于金句兜底时决定是否降级到下一级。
   */
  function isGarbled(s) {
    if (!s || typeof s !== 'string') return true;
    var t = s.trim();
    if (t.length < 2) return true;
    var validCount = (t.match(/[\u4e00-\u9fff\u3400-\u4dbfa-zA-Z]/g) || []).length;
    return validCount < Math.min(3, Math.ceil(t.length * 0.5));
  }

  /**
   * 卡片核心信息（金句）多级兜底：
   * 第一级：金句提炼（从全文找最具代表性的感性/理性话语）
   * 第二级：摘要重写（若金句为乱码，则用 AI 总结核心观点）
   * 第三级：3 个关键词组合成「关于 [关键词] 的思考」
   * 第四级：正文前 20 字 + ...
   */
  window.generateCoreInsight = function (text) {
    var rawText = (text || '').trim();
    var plainForFallback = rawText.replace(/\s+/g, ' ').trim();
    var first20 = plainForFallback.slice(0, 20) + (plainForFallback.length > 20 ? '...' : '');

    /** 优先在第一个句号处截断，避免出现第二句残留（如 "Sav..."）；若无句号再按 30 字截断 */
    function normalizeLevel1(s) {
      s = (s || '').trim().replace(/^["「『"]|["」』"]$/g, '');
      var sentEnd = s.search(/[。！？.!?]/);
      if (sentEnd !== -1 && sentEnd < 60) {
        s = s.slice(0, sentEnd + 1);
      } else if (s.length > 30) {
        s = s.slice(0, 30) + '…';
      }
      return s;
    }

    return ensureServerConfig().then(function () {
      if (!USE_AI) return Promise.reject(new Error('未配置 AI 服务'));
      var pair = getApiKeyAndCallFn();
      if (!pair) return Promise.reject(new Error('未配置 AI 服务'));

      // 第一级：金句提炼
      var prompt1 = '请用 10-30 字提炼以下内容的核心信息，用于卡片展示。' +
        '从全文中找出一句最具代表性的感性或理性话语。' +
        '若为观点分享型：提炼最具代表性的单一核心观点；若为情感记录型：提炼最深刻的心情或核心事件。' +
        '直接输出一句金句，不要标点堆砌，不要引号。\n\n' + rawText.slice(0, 2000);

      return pair.callFn(pair.apiKey, prompt1)
        .then(function (s) {
          s = normalizeLevel1(s);
          if (s && !isGarbled(s)) return s;
          throw new Error('GARBLED_OR_EMPTY');
        })
        .catch(function (err) {
          if (err && err.message === 'GARBLED_OR_EMPTY') throw err;
          // 第二级：摘要重写
          var prompt2 = '请用自己的话，用一句话（10-30 字）总结以下这段话的核心观点。不要直接引用原文，只输出总结句，不要引号。\n\n' + rawText.slice(0, 2000);
          return pair.callFn(pair.apiKey, prompt2).then(function (s) {
            s = normalizeLevel1(s);
            if (s && !isGarbled(s)) return s;
            throw new Error('GARBLED_OR_EMPTY');
          });
        })
        .catch(function (err) {
          if (err && err.message === 'GARBLED_OR_EMPTY') throw err;
          // 第三级：3 个关键词
          var prompt3 = '请从以下内容中提取恰好 3 个关键词，用顿号分隔，只输出这 3 个词，不要其他文字、不要编号、不要引号。\n\n' + rawText.slice(0, 2000);
          return pair.callFn(pair.apiKey, prompt3).then(function (s) {
            s = (s || '').trim().replace(/^["「『"]|["」』"]$/g, '').replace(/\s+/g, '、');
            var keywords = s ? s.split(/[、,，\s]+/).filter(Boolean).slice(0, 3).join('、') : '';
            if (keywords && !isGarbled(keywords)) return '关于 ' + keywords + ' 的思考';
            throw new Error('GARBLED_OR_EMPTY');
          });
        })
        .catch(function () {
          // 第四级：文本截取
          return first20 || '无标题';
        });
    });
  };

  /** 编辑页「一句话核心」：兼容旧调用，内部使用金句 prompt */
  window.generateCore = function (text) {
    return window.generateCoreInsight ? window.generateCoreInsight(text) : Promise.reject(new Error('未配置 AI 服务'));
  };

  /**
   * AI 自动打标 + 父类（必须为标准分类之一，见 categories.js）
   * 返回 { tags: string[], parent_category: string }
   */
  window.generateTagsAndParentCategory = function (text) {
    return ensureServerConfig().then(function () {
      if (!USE_AI) return Promise.reject(new Error('未配置 AI 服务'));
      var pair = getApiKeyAndCallFn();
      if (!pair) return Promise.reject(new Error('未配置 AI 服务或 API Key'));

      var list = (typeof window.STANDARD_CATEGORIES !== 'undefined' && window.STANDARD_CATEGORIES) ? window.STANDARD_CATEGORIES : [];
      var categoryListText = list.length ? list.join('、') : '民俗、人类学、历史考古、传统习俗、绘画、雕塑、设计、建筑、摄影、音乐、舞蹈、电影、电视剧、综艺、纪录片、动画、短视频、诗歌、小说、散文、戏剧、写作、书籍、翻译、外语、语言学、宏观经济、微观经济、货币、证券投资、财政政策、行业研究、市场营销、品牌战略、创业、供应链、零售、电商、企业管理、人力资源、人工智能、机器人、互联网、半导体、通信、软件开发、数学、物理、化学、生物、地理、天文、汽车、能源、材料、机械工程、航天、社会议题、公共舆论、政治、外交、治理、法律、教育、医疗健康、临床医学、生物医药、公共卫生、药理、心理学、体育竞技、健身、美食、旅行、家居、时尚、美容、育儿、宠物、哲学、情感、价值观';

      var prompt = '分析以下笔记内容，完成两件事：\n' +
      '1. 提取 1-3 个核心分类标签，要求兼具「具体性」与「归属感」，例如「职场技巧」「AI 硬件」「文学感悟」。\n' +
      '2. 从下面【标准分类】中必须且只能选择恰好一个作为 parent_category（只填分类名称，与下列完全一致）：\n\n' +
      categoryListText + '\n\n' +
      '只输出一个 JSON 对象，不要其他文字。格式：\n' +
      '{"tags":["标签1","标签2"],"parent_category":"上列中某个分类名称"}\n\n' +
      '【笔记内容】\n\n' + (text || '').slice(0, 4000);

      return pair.callFn(pair.apiKey, prompt).then(function (raw) {
        var s = (raw || '').trim();
        var m = s.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('AI 未返回有效 JSON');
        var obj;
        try { obj = JSON.parse(m[0]); } catch (e) { throw new Error('解析标签结果失败'); }
        var tags = Array.isArray(obj.tags) ? obj.tags.slice(0, 3) : [];
        var parentRaw = (obj.parent_category && String(obj.parent_category).trim()) || '';
        var parent = (typeof window.normalizeParentCategory === 'function')
          ? window.normalizeParentCategory(parentRaw)
          : (parentRaw || '其他');
        return { tags: tags, parent_category: parent };
      });
    });
  };

  /**
   * 文上传用：对已提取的正文做「地毯式」结构化提炼（与链导入共用 PROMPT_STRUCTURED_NOTE）。
   * 接入真实文档解析后，在 app.js 中可用此函数替代 mock，将返回的结构化笔记传入编辑页。
   */
  window.structureContentWithAI = function (text) {
    if (!text || String(text).trim().length < 50) {
      return Promise.reject(new Error('正文过短，无法进行结构化提炼'));
    }
    return ensureServerConfig().then(function () {
      if (!USE_AI) return Promise.reject(new Error('未配置 AI 服务'));
      var pair = getApiKeyAndCallFn();
      if (!pair) return Promise.reject(new Error('未配置 AI 服务或 API Key'));
      var prompt = PROMPT_STRUCTURED_NOTE + '\n\n' + String(text).slice(0, 12000);
      return pair.callFn(pair.apiKey, prompt);
    });
  };

})();
