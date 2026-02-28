(function () {
  'use strict';

  var STORAGE_KEY = 'notes';
  var CARD_BGS = ['var(--bg-card-1)', 'var(--bg-card-2)', 'var(--bg-card-3)', 'var(--bg-card-4)', 'var(--bg-card-5)'];

  function getNotes() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; }
  }
  function setNotes(arr) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  function generateId() {
    return 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 2200);
  }
  window.toast = toast;

  var params = {};
  (location.search || '').slice(1).split('&').forEach(function (p) {
    var i = p.indexOf('=');
    if (i > 0) params[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1));
  });

  var mode = params.mode || 'note';
  var bodyFromUrl = params.body || '';
  var id = params.id || '';
  var sourceUrlFromParams = (params.sourceUrl || '').trim();
  var sourceTitleFromParams = (params.sourceTitle || '').trim();
  var sourceTypeFromParams = (params.sourceType || '').trim() || 'link';

  var bodyEl = document.getElementById('editBody');
  var parsedActions = document.getElementById('parsedActions');
  var isParsed = mode === 'link' || mode === 'doc';

  /** 标题多行自适应高度，完整展示不截断 */
  function resizeTitleTextarea(el) {
    if (!el || el.nodeName !== 'TEXTAREA') return;
    el.style.height = 'auto';
    el.style.height = Math.max(40, el.scrollHeight) + 'px';
  }

  var editTitleEl = document.getElementById('editTitle');
  if (editTitleEl && editTitleEl.nodeName === 'TEXTAREA') {
    editTitleEl.addEventListener('input', function () { resizeTitleTextarea(editTitleEl); });
    editTitleEl.addEventListener('focus', function () { resizeTitleTextarea(editTitleEl); });
  }

  /** 将 Markdown 转为 HTML 并渲染；无 marked 时退回为换行转 <br> */
  function renderMarkdownToHtml(md) {
    if (!md) return '';
    if (typeof window.marked !== 'undefined') {
      try {
        if (window.marked.setOptions) window.marked.setOptions({ gfm: true, breaks: true });
        return window.marked.parse(String(md));
      } catch (e) { return String(md).replace(/\n/g, '<br>'); }
    }
    return String(md).replace(/\n/g, '<br>');
  }

  /** 内容是否为已渲染的 HTML（含标题/表格/引用等） */
  function looksLikeHtml(s) {
    if (!s || typeof s !== 'string') return false;
    return /<h[2-6]|<table|<blockquote|<ul|<ol/i.test(s);
  }

  // 解析完成 → 同时填充：正文、标题、分类与标签（分类/标签在下方同一同步流程中从 params 填充，无异步时差）
  if (isParsed && bodyFromUrl) {
    parsedActions.style.display = 'flex';
    bodyEl.innerHTML = renderMarkdownToHtml(bodyFromUrl);
    bodyEl.classList.add('prose', 'prose-slate');
    var titleInput = document.getElementById('editTitle');
    if (titleInput) {
      var titleValue = (params.title && String(params.title).trim()) || (params.sourceTitle && String(params.sourceTitle).trim()) || '';
      if (titleValue) {
        titleInput.value = titleValue;
        resizeTitleTextarea(titleInput);
      }
    }
  }

  var note = null;
  if (id) {
    var list = getNotes();
    note = list.find(function (n) { return n.id === id; });
    if (note) {
      var rawBody = note.body || '';
      if (looksLikeHtml(rawBody)) {
        bodyEl.innerHTML = rawBody;
      } else {
        bodyEl.innerHTML = renderMarkdownToHtml(rawBody);
      }
      bodyEl.classList.add('prose', 'prose-slate');
      var titleInput = document.getElementById('editTitle');
      if (titleInput) {
        titleInput.value = (note.core || note.title || '').trim();
        resizeTitleTextarea(titleInput);
      }
      var wrap = document.getElementById('editSourceWrap');
      var linkEl = document.getElementById('editSourceLink');
      var titleEl = document.getElementById('editSourceTitle');
      var hasSourceUrl = (note.sourceUrl || '').trim();
      var isFileNote = (note.sourceType || '').toLowerCase() === 'file';
      var hasSourceTitle = (note.sourceTitle || '').trim();
      if (wrap && linkEl && (hasSourceUrl || (isFileNote && hasSourceTitle))) {
        wrap.style.display = 'block';
        var displayText = (note.sourceTitle || '').trim() || '正在获取标题...';
        var label = '【' + displayText + '】';
        if (titleEl) titleEl.textContent = label;
        else linkEl.textContent = label;
        if (hasSourceUrl) {
          linkEl.href = note.sourceUrl;
          linkEl.setAttribute('data-source-type', (note.sourceType || 'link'));
          linkEl.setAttribute('data-source-url', note.sourceUrl);
          linkEl.setAttribute('data-source-title', displayText);
          linkEl.title = note.sourceType === 'file' ? '点击预览原文件' : '点击查看原文';
          linkEl.style.pointerEvents = '';
          linkEl.classList.remove('edit-source-card-plain');
        } else {
          linkEl.removeAttribute('href');
          linkEl.style.pointerEvents = 'none';
          linkEl.classList.add('edit-source-card-plain');
          linkEl.title = '原文件未上传，仅显示文件名';
        }
      }
    }
  }

  if (!note && (sourceUrlFromParams || (sourceTypeFromParams === 'file' && sourceTitleFromParams))) {
    var wrap = document.getElementById('editSourceWrap');
    var linkEl = document.getElementById('editSourceLink');
    var titleEl = document.getElementById('editSourceTitle');
    if (wrap && linkEl) {
      wrap.style.display = 'block';
      var displayText = sourceTitleFromParams || '正在获取标题...';
      var label = '【' + displayText + '】';
      if (titleEl) titleEl.textContent = label;
      else linkEl.textContent = label;
      if (sourceUrlFromParams) {
        linkEl.href = sourceUrlFromParams;
        linkEl.setAttribute('data-source-type', sourceTypeFromParams);
        linkEl.setAttribute('data-source-url', sourceUrlFromParams);
        linkEl.setAttribute('data-source-title', sourceTitleFromParams);
        linkEl.title = sourceTypeFromParams === 'file' ? '点击预览原文件' : '点击查看原文';
        linkEl.style.pointerEvents = '';
      } else {
        linkEl.removeAttribute('href');
        linkEl.style.pointerEvents = 'none';
        linkEl.classList.add('edit-source-card-plain');
        linkEl.title = '原文件未上传，仅显示文件名';
      }
    }
  }

  var headerTitleEl = document.getElementById('editHeaderTitle');
  if (headerTitleEl) headerTitleEl.textContent = (mode === 'note' && !id) ? '随手记' : '编辑笔记';

  // 标准分类下拉：20 选 1，保存时必为其中之一
  var editParentCategoryEl = document.getElementById('editParentCategory');
  if (editParentCategoryEl && typeof window.STANDARD_CATEGORIES !== 'undefined') {
    window.STANDARD_CATEGORIES.forEach(function (cat) {
      var opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      editParentCategoryEl.appendChild(opt);
    });
    var initialCat = (note && note.parent_category) || '';
    if (isParsed && !note && params.category) initialCat = params.category; /* 与上方解析块同次同步填充 */
    editParentCategoryEl.value = (typeof window.normalizeParentCategory === 'function')
      ? window.normalizeParentCategory(initialCat)
      : (initialCat || '其他');
  }

  // 文上传来源链接：点击时拦截，打开 FilePreview 弹窗（不直接跳转）
  document.addEventListener('click', function (e) {
    var link = e.target.closest('#editSourceLink');
    if (!link || link.getAttribute('data-source-type') !== 'file') return;
    e.preventDefault();
    if (typeof window.openFilePreview === 'function') {
      window.openFilePreview(link.getAttribute('data-source-url'), link.getAttribute('data-source-title'));
    } else {
      window.open(link.href, '_blank', 'noopener');
    }
  });

  // 编辑页标签状态（手动编辑后保存时优先使用）；链导入/文上传可带 category、tags 预填
  var editPageTags = Array.isArray(note && note.tags) ? note.tags.slice(0, 3) : [];
  if (isParsed && !note && params.tags) { /* 与解析块同次同步填充 */
    var t = params.tags;
    if (typeof t === 'string') t = t.split(',').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 3);
    else if (Array.isArray(t)) t = t.slice(0, 3);
    else t = [];
    editPageTags = t;
  }
  var tagsDirty = false;

  function renderEditTags() {
    var listEl = document.getElementById('editTagsList');
    var addBtn = document.getElementById('editTagAdd');
    if (!listEl) return;
    listEl.innerHTML = '';
    editPageTags.forEach(function (t, i) {
      var span = document.createElement('span');
      span.className = 'edit-tag-pill';
      span.textContent = t;
      span.setAttribute('data-index', i);
      span.setAttribute('data-value', t);
      listEl.appendChild(span);
    });
    if (addBtn) addBtn.style.display = editPageTags.length >= 3 ? 'none' : 'inline-flex';
  }

  function setTagAt(index, value) {
    var v = (value || '').trim();
    if (!v) return;
    if (editPageTags[index] !== v) {
      editPageTags[index] = v;
      tagsDirty = true;
      renderEditTags();
    }
  }

  function removeTagAt(index) {
    editPageTags.splice(index, 1);
    tagsDirty = true;
    renderEditTags();
  }

  function addTag() {
    if (editPageTags.length >= 3) return;
    var v = (prompt('输入新标签名称（最多 3 个标签）') || '').trim();
    if (!v) return;
    editPageTags.push(v);
    tagsDirty = true;
    renderEditTags();
  }

  var editTagsWrap = document.getElementById('editTagsWrap');
  var editTagsList = document.getElementById('editTagsList');
  if (editTagsList) {
    editTagsList.addEventListener('click', function (e) {
      var pill = e.target.closest('.edit-tag-pill');
      if (!pill) return;
      var i = parseInt(pill.getAttribute('data-index'), 10);
      if (e.detail === 2) {
        var newVal = (prompt('修改标签名称', pill.getAttribute('data-value') || '') || '').trim();
        if (newVal) setTagAt(i, newVal);
      }
    });
    editTagsList.addEventListener('contextmenu', function (e) {
      var pill = e.target.closest('.edit-tag-pill');
      if (!pill) return;
      e.preventDefault();
      if (confirm('删除该标签？')) removeTagAt(parseInt(pill.getAttribute('data-index'), 10));
    });
  }
  if (document.getElementById('editTagAdd')) {
    document.getElementById('editTagAdd').addEventListener('click', addTag);
  }
  renderEditTags();

  // 进入页面时焦点直接定位到正文
  setTimeout(function () {
    if (bodyEl) bodyEl.focus();
  }, 0);

  function getBodyHtml() { return (bodyEl && bodyEl.innerHTML) || ''; }
  function getBodyText() {
    var d = document.createElement('div');
    d.innerHTML = getBodyHtml();
    return (d.textContent || d.innerText || '').trim();
  }

  // 加粗、斜体、下划线、删除线、对齐（左/中/右/两端）
  document.querySelectorAll('.edit-toolbar [data-cmd]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cmd = btn.getAttribute('data-cmd');
      document.execCommand(cmd, false, null);
      bodyEl.focus();
    });
  });

  // 调色盘：Lovable 风格预设色 + 自定义（字体颜色 / 背景颜色）
  var textColors = [
    { name: '墨色', value: 'hsl(25, 15%, 25%)' },
    { name: '赤陶', value: 'hsl(18, 55%, 55%)' },
    { name: '鼠尾草', value: 'hsl(140, 18%, 45%)' },
    { name: '天青', value: 'hsl(205, 45%, 50%)' },
    { name: '梅紫', value: 'hsl(330, 30%, 48%)' },
    { name: '琥珀', value: 'hsl(38, 70%, 50%)' },
    { name: '深灰', value: 'hsl(0, 0%, 40%)' },
    { name: '砖红', value: 'hsl(5, 65%, 50%)' },
    { name: '松绿', value: 'hsl(165, 35%, 42%)' },
    { name: '靛蓝', value: 'hsl(220, 50%, 45%)' },
    { name: '紫罗兰', value: 'hsl(275, 35%, 50%)' },
    { name: '橙金', value: 'hsl(30, 80%, 50%)' }
  ];
  var highlightColors = [
    { name: '浅粉', value: 'hsl(10, 40%, 93%)' },
    { name: '浅蓝', value: 'hsl(205, 40%, 91%)' },
    { name: '浅绿', value: 'hsl(140, 22%, 91%)' },
    { name: '浅黄', value: 'hsl(48, 60%, 91%)' },
    { name: '浅紫', value: 'hsl(270, 28%, 93%)' },
    { name: '浅橙', value: 'hsl(28, 50%, 92%)' },
    { name: '浅青', value: 'hsl(175, 35%, 91%)' },
    { name: '浅玫瑰', value: 'hsl(340, 38%, 93%)' },
    { name: '浅茶', value: 'hsl(38, 30%, 91%)' },
    { name: '浅天', value: 'hsl(195, 38%, 91%)' },
    { name: '浅梅', value: 'hsl(320, 25%, 92%)' },
    { name: '浅杏', value: 'hsl(22, 45%, 92%)' }
  ];
  function hslToHex(hslStr) {
    var m = (hslStr || '').match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
    if (!m) return hslStr;
    var h = parseInt(m[1], 10) / 360;
    var s = parseInt(m[2], 10) / 100;
    var l = parseInt(m[3], 10) / 100;
    var r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      }
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return '#' + [r, g, b].map(function (x) {
      var hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  function applyTextColor(hex) {
    document.execCommand('foreColor', false, hex);
    bodyEl.focus();
  }
  function applyBgColor(hex) {
    if (document.queryCommandSupported('hiliteColor')) {
      document.execCommand('hiliteColor', false, hex);
    } else {
      document.execCommand('backColor', false, hex);
    }
    bodyEl.focus();
  }
  var RECENT_TEXT_KEY = 'recentTextColors';
  var RECENT_BG_KEY = 'recentHighlightColors';
  var RECENT_MAX = 8;
  function normalizeHex(hex) {
    if (!hex || typeof hex !== 'string') return '';
    hex = hex.trim().toLowerCase();
    if (hex.indexOf('#') !== 0) hex = '#' + hex;
    if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
    if (/^#[0-9a-f]{3}$/.test(hex)) {
      var r = hex[1] + hex[1], g = hex[2] + hex[2], b = hex[3] + hex[3];
      return '#' + r + g + b;
    }
    return hex;
  }
  function getRecentColors(key) {
    try {
      var raw = localStorage.getItem(key);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.slice(0, RECENT_MAX) : [];
    } catch (e) { return []; }
  }
  function addRecentColor(hex, type) {
    hex = normalizeHex(hex);
    if (!hex) return;
    var key = type === 'text' ? RECENT_TEXT_KEY : RECENT_BG_KEY;
    var prev = getRecentColors(key);
    var next = [hex].concat(prev.filter(function (c) { return c !== hex; })).slice(0, RECENT_MAX);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch (e) {}
    if (type === 'text') renderRecentTextColors(); else renderRecentBgColors();
  }
  var popoverText = document.getElementById('popoverTextColor');
  var popoverBg = document.getElementById('popoverBgColor');
  var btnTextColor = document.getElementById('btnTextColor');
  var btnBgColor = document.getElementById('btnBgColor');
  var textPresetsEl = document.getElementById('textColorPresets');
  var bgPresetsEl = document.getElementById('bgColorPresets');
  var textRecentEl = document.getElementById('textColorRecent');
  var bgRecentEl = document.getElementById('bgColorRecent');
  var textRecentWrap = document.getElementById('textColorRecentWrap');
  var bgRecentWrap = document.getElementById('bgColorRecentWrap');
  var inputTextCustom = document.getElementById('inputTextColorCustom');
  var inputBgCustom = document.getElementById('inputBgColorCustom');
  function renderRecentTextColors() {
    if (!textRecentEl) return;
    var list = getRecentColors(RECENT_TEXT_KEY);
    if (textRecentWrap) textRecentWrap.hidden = list.length === 0;
    textRecentEl.innerHTML = '';
    list.forEach(function (hex) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'edit-color-swatch';
      btn.title = hex;
      btn.style.backgroundColor = hex;
      btn.addEventListener('click', function () {
        applyTextColor(hex);
        addRecentColor(hex, 'text');
        popoverText.setAttribute('hidden', '');
        if (btnTextColor) btnTextColor.setAttribute('aria-expanded', 'false');
      });
      textRecentEl.appendChild(btn);
    });
  }
  function renderRecentBgColors() {
    if (!bgRecentEl) return;
    var list = getRecentColors(RECENT_BG_KEY);
    if (bgRecentWrap) bgRecentWrap.hidden = list.length === 0;
    bgRecentEl.innerHTML = '';
    list.forEach(function (hex) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'edit-color-swatch';
      btn.title = hex;
      btn.style.backgroundColor = hex;
      btn.addEventListener('click', function () {
        applyBgColor(hex);
        addRecentColor(hex, 'highlight');
        popoverBg.setAttribute('hidden', '');
        if (btnBgColor) btnBgColor.setAttribute('aria-expanded', 'false');
      });
      bgRecentEl.appendChild(btn);
    });
  }
  renderRecentTextColors();
  renderRecentBgColors();
  if (textPresetsEl) {
    textColors.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'edit-color-swatch';
      btn.title = c.name;
      btn.style.backgroundColor = c.value;
      var hex = hslToHex(c.value);
      btn.addEventListener('click', function () {
        applyTextColor(hex);
        addRecentColor(hex, 'text');
        popoverText.setAttribute('hidden', '');
        if (btnTextColor) btnTextColor.setAttribute('aria-expanded', 'false');
      });
      textPresetsEl.appendChild(btn);
    });
  }
  if (bgPresetsEl) {
    highlightColors.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'edit-color-swatch';
      btn.title = c.name;
      btn.style.backgroundColor = c.value;
      var hex = hslToHex(c.value);
      btn.addEventListener('click', function () {
        applyBgColor(hex);
        addRecentColor(hex, 'highlight');
        popoverBg.setAttribute('hidden', '');
        if (btnBgColor) btnBgColor.setAttribute('aria-expanded', 'false');
      });
      bgPresetsEl.appendChild(btn);
    });
  }
  if (btnTextColor && popoverText) {
    btnTextColor.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !popoverText.hasAttribute('hidden');
      popoverText.toggleAttribute('hidden', open);
      if (!open) renderRecentTextColors();
      if (popoverBg) popoverBg.setAttribute('hidden', '');
      btnTextColor.setAttribute('aria-expanded', !open);
      if (btnBgColor) btnBgColor.setAttribute('aria-expanded', 'false');
    });
  }
  if (btnBgColor && popoverBg) {
    btnBgColor.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !popoverBg.hasAttribute('hidden');
      popoverBg.toggleAttribute('hidden', open);
      if (!open) renderRecentBgColors();
      if (popoverText) popoverText.setAttribute('hidden', '');
      btnBgColor.setAttribute('aria-expanded', !open);
      if (btnTextColor) btnTextColor.setAttribute('aria-expanded', 'false');
    });
  }
  if (document.getElementById('btnTextColorConfirm') && inputTextCustom) {
    document.getElementById('btnTextColorConfirm').addEventListener('click', function () {
      var hex = normalizeHex(inputTextCustom.value);
      if (hex) {
        applyTextColor(hex);
        addRecentColor(hex, 'text');
        popoverText.setAttribute('hidden', '');
        if (btnTextColor) btnTextColor.setAttribute('aria-expanded', 'false');
      }
    });
  }
  if (document.getElementById('btnBgColorConfirm') && inputBgCustom) {
    document.getElementById('btnBgColorConfirm').addEventListener('click', function () {
      var hex = normalizeHex(inputBgCustom.value);
      if (hex) {
        applyBgColor(hex);
        addRecentColor(hex, 'highlight');
        popoverBg.setAttribute('hidden', '');
        if (btnBgColor) btnBgColor.setAttribute('aria-expanded', 'false');
      }
    });
  }
  document.addEventListener('click', function () {
    if (popoverText && !popoverText.hasAttribute('hidden')) {
      popoverText.setAttribute('hidden', '');
      if (btnTextColor) btnTextColor.setAttribute('aria-expanded', 'false');
    }
    if (popoverBg && !popoverBg.hasAttribute('hidden')) {
      popoverBg.setAttribute('hidden', '');
      if (btnBgColor) btnBgColor.setAttribute('aria-expanded', 'false');
    }
  });
  if (popoverText) popoverText.addEventListener('click', function (e) { e.stopPropagation(); });
  if (popoverBg) popoverBg.addEventListener('click', function (e) { e.stopPropagation(); });

  // 插入图片（本地文件）
  var inputImage = document.getElementById('inputImage');
  if (document.getElementById('btnInsertImage') && inputImage) {
    document.getElementById('btnInsertImage').addEventListener('click', function () { inputImage.click(); });
    inputImage.addEventListener('change', function () {
      var file = inputImage.files && inputImage.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        document.execCommand('insertImage', false, reader.result);
        bodyEl.focus();
      };
      reader.readAsDataURL(file);
      inputImage.value = '';
    });
  }

  // 插入视频（本地文件）
  var inputVideo = document.getElementById('inputVideo');
  if (document.getElementById('btnInsertVideo') && inputVideo) {
    document.getElementById('btnInsertVideo').addEventListener('click', function () { inputVideo.click(); });
    inputVideo.addEventListener('change', function () {
      var file = inputVideo.files && inputVideo.files[0];
      if (!file) return;
      var url = URL.createObjectURL(file);
      var html = '<video src="' + url + '" controls style="max-width:100%;height:auto;display:block;margin:8px 0;"></video>';
      document.execCommand('insertHTML', false, html);
      bodyEl.focus();
      inputVideo.value = '';
    });
  }

  // 插入视频（链接）
  if (document.getElementById('btnInsertVideoUrl')) {
    document.getElementById('btnInsertVideoUrl').addEventListener('click', function () {
      var url = (prompt('请输入视频链接（支持直链或嵌入链接）') || '').trim();
      if (!url) return;
      var html = '<video src="' + escapeHtmlAttr(url) + '" controls style="max-width:100%;height:auto;display:block;margin:8px 0;"></video>';
      document.execCommand('insertHTML', false, html);
      bodyEl.focus();
    });
  }

  function escapeHtmlAttr(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML.replace(/"/g, '&quot;');
  }

  function runAiPlaceholder(name, fn) {
    toast('AI 模拟：' + name + '…');
    setTimeout(function () { fn(); toast(name + ' 已应用'); }, 1500);
  }

  function doAiOutline() {
    var text = getBodyText();
    if (!text) {
      toast('请先输入或导入内容再使用此功能。');
      return;
    }

    // 检查是否有真实 AI 服务
    if (typeof window.generateOutline === 'function') {
      toast('AI 生成大纲中…');
      window.generateOutline(text)
        .then(function (result) {
          bodyEl.innerHTML = (bodyEl.innerHTML || '') + '<br><br><strong>【AI 生成大纲】</strong><br>' + result.replace(/\n/g, '<br>');
          toast('大纲已生成');
        })
        .catch(function (err) {
          toast(err.message || '生成失败，使用模拟结果');
          var mock = '基于当前内容生成的大纲示例：\n\n一、核心观点\n二、要点一\n三、要点二\n四、总结\n\n（实际由 AI 生成）';
          bodyEl.innerHTML = (bodyEl.innerHTML || '') + '<br><br><strong>【大纲】</strong><br>' + mock.replace(/\n/g, '<br>');
        });
    } else {
      // 降级：模拟
      var mock = '基于当前内容生成的大纲示例：\n\n一、核心观点\n二、要点一\n三、要点二\n四、总结\n\n（实际由 AI 生成）';
      bodyEl.innerHTML = (bodyEl.innerHTML || '') + '<br><br><strong>【大纲】</strong><br>' + mock.replace(/\n/g, '<br>');
      toast('提示：配置 AI 服务后可生成真实大纲');
    }
  }

  var lastAiCore = null;

  function doAiCore() {
    var text = getBodyText();
    if (!text) {
      toast('请先输入或导入内容。');
      return;
    }

    if (typeof window.generateCoreInsight === 'function') {
      toast('AI 提炼卡片金句中…');
      window.generateCoreInsight(text)
        .then(function (result) {
          lastAiCore = result;
          bodyEl.innerHTML = (bodyEl.innerHTML || '') + '<br><br><strong>【卡片金句 10-30 字】</strong> ' + result;
          toast('已生成，保存后将在首页卡片中心展示');
        })
        .catch(function (err) {
          toast(err.message || '提炼失败');
          lastAiCore = null;
        });
    } else if (typeof window.generateCore === 'function') {
      toast('AI 提炼核心中…');
      window.generateCore(text)
        .then(function (result) {
          lastAiCore = result;
          bodyEl.innerHTML = (bodyEl.innerHTML || '') + '<br><br><strong>【一句话核心】</strong> ' + result;
          toast('核心已提炼');
        })
        .catch(function (err) {
          toast(err.message || '提炼失败');
          lastAiCore = null;
        });
    } else {
      lastAiCore = null;
      toast('请配置 AI 服务后使用');
    }
  }

  var outlineBtns = [document.getElementById('aiOutline'), document.getElementById('aiOutline2')];
  var coreBtns = [document.getElementById('aiCore'), document.getElementById('aiCore2')];
  outlineBtns.forEach(function (b) { if (b) b.addEventListener('click', function () { doAiOutline(); }); });
  coreBtns.forEach(function (b) {
    if (!b) return;
    b.addEventListener('click', function () {
      if (window.Auth && window.Auth.requireLogin) {
        window.Auth.requireLogin(doAiCore, '登录后可使用 AI 提炼核心');
      } else {
        doAiCore();
      }
    });
  });

  // 保存：未登录时弹出登录框（登录后可永久存入知识图谱）；已登录则正常保存
  function save() {
    if (window.Auth && window.Auth.isLoggedIn && !window.Auth.isLoggedIn()) {
      window.Auth.openLoginModal('登录后即可将此笔记永久存入你的知识图谱');
      return;
    }
    var saveBtn = document.getElementById('saveBtn');
    var saveBtnLabel = saveBtn && saveBtn.querySelector('.edit-save-text');
    var body = getBodyHtml().replace(/<br\s*\/?>/gi, '\n');
    var text = getBodyText();
    var titleEl = document.getElementById('editTitle');
    var titleInputTrimmed = titleEl ? titleEl.value.trim() : '';
    var title = titleInputTrimmed.slice(0, 300) || (text.trim() ? (text.trim().split('\n')[0] || '').trim().slice(0, 80) : '无标题') || '无标题';
    var date = (note && note.date) || new Date().toISOString().slice(0, 10);
    var bg = (note && note.bg) || CARD_BGS[Math.floor(Math.random() * CARD_BGS.length)];

    var list = getNotes();
    var existing = list.find(function (n) { return n.id === (id || (note && note.id)); });
    var targetId = (existing && existing.id) || id || generateId();

    function doSave(aiCoreResult, tagResult) {
      var coreVal = titleInputTrimmed ? titleInputTrimmed.slice(0, 300) : ((typeof aiCoreResult === 'string' && aiCoreResult.trim()) ? aiCoreResult.trim() : (note && note.core) || text.slice(0, 80) || title);
      /* 优先：用户改过用编辑区；否则 AI 结果；否则已有笔记的 tags；否则链导入/文上传预填的 editPageTags（线上 AI 失败时保留解析时的标签） */
      var finalTags = tagsDirty ? editPageTags.slice(0, 3) : (tagResult && tagResult.tags && tagResult.tags.length) ? tagResult.tags : (note && note.tags && note.tags.length) ? note.tags : (editPageTags.length ? editPageTags.slice(0, 3) : ['未分类']);
      var parentFromUi = editParentCategoryEl && editParentCategoryEl.value ? editParentCategoryEl.value.trim() : '';
      var finalParent = (typeof window.normalizeParentCategory === 'function')
        ? window.normalizeParentCategory(parentFromUi || (tagResult && tagResult.parent_category) || (note && note.parent_category) || '')
        : (parentFromUi || (tagResult && tagResult.parent_category) || (note && note.parent_category) || '其他');
      var obj = {
        id: targetId,
        title: title,
        body: body,
        core: coreVal,
        tags: finalTags,
        parent_category: finalParent,
        date: date,
        bg: bg
      };
      if ((sourceUrlFromParams || (note && note.sourceUrl)) || sourceTypeFromParams === 'file' || (note && (note.sourceType || '').toLowerCase() === 'file')) {
        obj.sourceUrl = (note && note.sourceUrl) || sourceUrlFromParams || '';
        obj.sourceTitle = (note && note.sourceTitle) || sourceTitleFromParams || '';
        obj.sourceType = (note && note.sourceType) || sourceTypeFromParams || 'link';
      }
      var idx = list.findIndex(function (n) { return n.id === targetId; });
      if (idx >= 0) list[idx] = obj;
      else list.push(obj);
      setNotes(list);
      try { sessionStorage.removeItem(autosaveKey); } catch (e) {}
      if (saveBtn) saveBtn.disabled = false;
      if (saveBtnLabel) saveBtnLabel.textContent = '保存';
      toast('保存成功');
      setTimeout(function () { location.href = 'index.html?justCreated=' + encodeURIComponent(targetId); }, 400);
    }

    if (saveBtn) saveBtn.disabled = true;
    if (saveBtnLabel) saveBtnLabel.textContent = '保存中…';
    toast('正在生成金句与标签…');

    var hasAi = typeof window.generateCoreInsight === 'function' && typeof window.generateTagsAndParentCategory === 'function' && text && text.length >= 10;
    if (hasAi) {
      Promise.all([
        window.generateCoreInsight(text).catch(function () { return null; }),
        window.generateTagsAndParentCategory(text).catch(function () { return null; })
      ]).then(function (results) {
        var tagResult = results[1];
        /* 保存时不再用 AI 结果覆盖下拉框，以用户当前选择的分类为准 */
        doSave(results[0], tagResult);
      });
    } else {
      doSave(null, null);
    }
  }

  document.getElementById('saveBtn').addEventListener('click', save);

  // 自动保存草稿（仅存到 sessionStorage，避免覆盖已保存的）
  var autosaveKey = 'edit_draft_' + (id || 'new');
  function loadDraft() {
    try {
      var d = sessionStorage.getItem(autosaveKey);
      if (d && !id && !bodyFromUrl) {
        var o = JSON.parse(d);
        if (o.body) bodyEl.innerHTML = o.body.replace(/\n/g, '<br>');
      }
    } catch (e) {}
  }
  function storeDraft() {
    try {
      sessionStorage.setItem(autosaveKey, JSON.stringify({
        body: getBodyHtml().replace(/<br\s*\/?>/gi, '\n')
      }));
    } catch (e) {}
  }
  loadDraft();
  setInterval(storeDraft, 30000);

  // 删除
  var confirmEl = document.getElementById('confirmDelete');
  document.getElementById('deleteNote').addEventListener('click', function () {
    if (!id && !note) { toast('当前为新建，直接返回即可'); return; }
    confirmEl.classList.add('open');
  });
  if (confirmEl) {
    confirmEl.querySelector('.cancel-btn').addEventListener('click', function () { confirmEl.classList.remove('open'); });
    confirmEl.querySelector('.confirm-btn').addEventListener('click', function () {
      var target = id || (note && note.id);
      if (target) {
        var list = getNotes().filter(function (n) { return n.id !== target; });
        setNotes(list);
        try { sessionStorage.removeItem(autosaveKey); } catch (e) {}
        toast('已删除');
        setTimeout(function () { location.href = 'index.html'; }, 400);
      }
      confirmEl.classList.remove('open');
    });
    confirmEl.addEventListener('click', function (e) { if (e.target === confirmEl) confirmEl.classList.remove('open'); });
  }
})();
