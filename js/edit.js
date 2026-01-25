(function () {
  'use strict';

  var STORAGE_KEY = 'notes';
  var CARD_BGS = ['#fefdfb', '#f0f7fa', '#fdf5f5', '#f5f9f0', '#f8f5f0'];

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

  var titleEl = document.getElementById('titleInput');
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
      titleEl.value = note.title || '';
      bodyEl.innerHTML = (note.body || '').replace(/\n/g, '<br>');
    }
  }

  function getBodyHtml() { return (bodyEl && bodyEl.innerHTML) || ''; }
  function getBodyText() {
    var d = document.createElement('div');
    d.innerHTML = getBodyHtml();
    return (d.textContent || d.innerText || '').trim();
  }

  // 加粗、斜体
  document.querySelectorAll('.edit-toolbar [data-cmd]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cmd = btn.getAttribute('data-cmd');
      document.execCommand(cmd, false, null);
      bodyEl.focus();
    });
  });

  function runAiPlaceholder(name, fn) {
    toast('AI 模拟：' + name + '…');
    setTimeout(function () { fn(); toast(name + ' 已应用'); }, 1500);
  }

  function doAiOutline() {
    var text = getBodyText();
    var mock = (text ? '基于当前内容生成的大纲示例：\n\n一、核心观点\n二、要点一\n三、要点二\n四、总结\n\n（实际由 AI 生成）' : '请先输入或导入内容再使用此功能。');
    bodyEl.innerHTML = (bodyEl.innerHTML || '') + '<br><br><strong>【大纲】</strong><br>' + mock.replace(/\n/g, '<br>');
  }
  function doAiCore() {
    var text = getBodyText().slice(0, 200);
    var mock = text ? '这是一句基于原文提炼的核心概括。（实际由 AI 生成）' : '请先输入或导入内容。';
    // 写入到“核心”的临时位置，保存时会用 core 字段；这里仅作演示，在页面上append一句提示
    bodyEl.innerHTML = (bodyEl.innerHTML || '') + '<br><br><strong>【一句话核心】</strong> ' + mock;
  }

  var outlineBtns = [document.getElementById('aiOutline'), document.getElementById('aiOutline2')];
  var coreBtns = [document.getElementById('aiCore'), document.getElementById('aiCore2')];
  outlineBtns.forEach(function (b) { if (b) b.addEventListener('click', function () { runAiPlaceholder('AI 生成大纲', doAiOutline); }); });
  coreBtns.forEach(function (b) { if (b) b.addEventListener('click', function () { runAiPlaceholder('AI 提炼核心', doAiCore); }); });

  // 保存
  function save() {
    var title = (titleEl && titleEl.value || '').trim() || '无标题';
    var body = getBodyHtml().replace(/<br\s*\/?>/gi, '\n');
    var text = getBodyText();
    var core = (note && note.core) || text.slice(0, 80) || title;
    var tags = (note && note.tags) || ['未分类'];
    var date = (note && note.date) || new Date().toISOString().slice(0, 10);
    var bg = (note && note.bg) || CARD_BGS[Math.floor(Math.random() * CARD_BGS.length)];

    var list = getNotes();
    var existing = list.find(function (n) { return n.id === (id || (note && note.id)); });
    var targetId = (existing && existing.id) || id || generateId();

    var obj = {
      id: targetId,
      title: title,
      body: body,
      core: core,
      tags: tags,
      date: date,
      bg: bg
    };

    var idx = list.findIndex(function (n) { return n.id === targetId; });
    if (idx >= 0) list[idx] = obj;
    else list.push(obj);
    setNotes(list);
    try { sessionStorage.removeItem(autosaveKey); } catch (e) {}
    toast('保存成功');
    setTimeout(function () { location.href = 'index.html'; }, 400);
  }

  document.getElementById('saveBtn').addEventListener('click', save);

  // 自动保存草稿（仅存到 sessionStorage，避免覆盖已保存的）
  var autosaveKey = 'edit_draft_' + (id || 'new');
  function loadDraft() {
    try {
      var d = sessionStorage.getItem(autosaveKey);
      if (d && !id && !bodyFromUrl) {
        var o = JSON.parse(d);
        if (o.title) titleEl.value = o.title;
        if (o.body) bodyEl.innerHTML = o.body.replace(/\n/g, '<br>');
      }
    } catch (e) {}
  }
  function storeDraft() {
    try {
      sessionStorage.setItem(autosaveKey, JSON.stringify({
        title: titleEl.value,
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
