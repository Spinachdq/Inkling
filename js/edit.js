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

  var bodyEl = document.getElementById('editBody');
  var parsedActions = document.getElementById('parsedActions');
  var isParsed = mode === 'link' || mode === 'doc';

  if (isParsed && bodyFromUrl) {
    parsedActions.style.display = 'flex';
    bodyEl.innerHTML = bodyFromUrl.replace(/\n/g, '<br>');
  }

  var note = null;
  if (id) {
    var list = getNotes();
    note = list.find(function (n) { return n.id === id; });
    if (note) {
      bodyEl.innerHTML = (note.body || '').replace(/\n/g, '<br>');
      var titleInput = document.getElementById('editTitle');
      if (titleInput) titleInput.value = (note.core || note.title || '').trim();
      var wrap = document.getElementById('editSourceWrap');
      var linkEl = document.getElementById('editSourceLink');
      var titleEl = document.getElementById('editSourceTitle');
      if (wrap && linkEl && (note.sourceUrl || '').trim()) {
        wrap.style.display = 'block';
        linkEl.href = note.sourceUrl;
        var displayText = (note.sourceTitle || '').trim() || '正在获取标题...';
        var label = '【' + displayText + '】';
        if (titleEl) titleEl.textContent = label;
        else linkEl.textContent = label;
        linkEl.title = '点击查看原文';
      }
    }
  }

  if (!note && sourceUrlFromParams) {
    var wrap = document.getElementById('editSourceWrap');
    var linkEl = document.getElementById('editSourceLink');
    var titleEl = document.getElementById('editSourceTitle');
    if (wrap && linkEl) {
      wrap.style.display = 'block';
      linkEl.href = sourceUrlFromParams;
      var displayText = sourceTitleFromParams || '正在获取标题...';
      var label = '【' + displayText + '】';
      if (titleEl) titleEl.textContent = label;
      else linkEl.textContent = label;
      linkEl.title = '点击查看原文';
    }
  }

  var headerTitleEl = document.getElementById('editHeaderTitle');
  if (headerTitleEl) headerTitleEl.textContent = (mode === 'note' && !id) ? '随手记' : '编辑笔记';

  // 编辑页标签状态（手动编辑后保存时优先使用）
  var editPageTags = Array.isArray(note && note.tags) ? note.tags.slice(0, 3) : [];
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

  // 文字颜色
  var inputTextColor = document.getElementById('inputTextColor');
  var inputBgColor = document.getElementById('inputBgColor');
  if (document.getElementById('btnTextColor') && inputTextColor) {
    document.getElementById('btnTextColor').addEventListener('click', function () {
      inputTextColor.click();
    });
    inputTextColor.addEventListener('change', function () {
      var hex = inputTextColor.value;
      document.execCommand('foreColor', false, hex);
      bodyEl.focus();
    });
  }
  // 文字背景色
  if (document.getElementById('btnBgColor') && inputBgColor) {
    document.getElementById('btnBgColor').addEventListener('click', function () {
      inputBgColor.click();
    });
    inputBgColor.addEventListener('change', function () {
      var hex = inputBgColor.value;
      if (document.queryCommandSupported('hiliteColor')) {
        document.execCommand('hiliteColor', false, hex);
      } else {
        document.execCommand('backColor', false, hex);
      }
      bodyEl.focus();
    });
  }

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
  coreBtns.forEach(function (b) { if (b) b.addEventListener('click', function () { doAiCore(); }); });

  // 保存：卡片核心 = 用户输入标题则用标题，未输入则用 AI 金句；再次打开编辑页时标题栏显示该核心
  function save() {
    var saveBtn = document.getElementById('saveBtn');
    var saveBtnLabel = saveBtn && saveBtn.querySelector('.edit-save-text');
    var body = getBodyHtml().replace(/<br\s*\/?>/gi, '\n');
    var text = getBodyText();
    var titleEl = document.getElementById('editTitle');
    var titleInputTrimmed = titleEl ? titleEl.value.trim() : '';
    var title = titleInputTrimmed.slice(0, 80) || (text.trim() ? (text.trim().split('\n')[0] || '').trim().slice(0, 30) : '无标题') || '无标题';
    var date = (note && note.date) || new Date().toISOString().slice(0, 10);
    var bg = (note && note.bg) || CARD_BGS[Math.floor(Math.random() * CARD_BGS.length)];

    var list = getNotes();
    var existing = list.find(function (n) { return n.id === (id || (note && note.id)); });
    var targetId = (existing && existing.id) || id || generateId();

    function doSave(aiCoreResult, tagResult) {
      var coreVal = titleInputTrimmed ? titleInputTrimmed.slice(0, 80) : ((typeof aiCoreResult === 'string' && aiCoreResult.trim()) ? aiCoreResult.trim() : (note && note.core) || text.slice(0, 30) || title);
      var finalTags = tagsDirty ? editPageTags.slice(0, 3) : (tagResult && tagResult.tags && tagResult.tags.length) ? tagResult.tags : (note && note.tags) || ['未分类'];
      var finalParent = tagsDirty ? ((note && note.parent_category) || '其他') : (tagResult && tagResult.parent_category) || (note && note.parent_category) || '其他';
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
      if ((sourceUrlFromParams || (note && note.sourceUrl))) {
        obj.sourceUrl = (note && note.sourceUrl) || sourceUrlFromParams;
        obj.sourceTitle = (note && note.sourceTitle) || sourceTitleFromParams || '';
      }
      var idx = list.findIndex(function (n) { return n.id === targetId; });
      if (idx >= 0) list[idx] = obj;
      else list.push(obj);
      setNotes(list);
      try { sessionStorage.removeItem(autosaveKey); } catch (e) {}
      if (saveBtn) saveBtn.disabled = false;
      if (saveBtnLabel) saveBtnLabel.textContent = '保存';
      toast('保存成功');
      setTimeout(function () { location.href = 'index.html'; }, 400);
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
        doSave(results[0], results[1]);
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
