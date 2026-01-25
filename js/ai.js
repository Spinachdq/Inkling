(function () {
  'use strict';

  var STORAGE_KEY = 'ai_chats';
  var CURRENT_KEY = 'ai_current_chat';

  function getChats() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; }
  }
  function setChats(arr) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  function getCurrentId() { return sessionStorage.getItem(CURRENT_KEY) || ''; }
  function setCurrentId(id) { try { sessionStorage.setItem(CURRENT_KEY, id || ''); } catch (e) {} }

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function generateId() { return 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }

  var chats = getChats();
  var currentId = getCurrentId();
  if (!currentId && chats.length) currentId = chats[0].id;
  if (!currentId) {
    currentId = generateId();
    chats.unshift({ id: currentId, title: '新对话', messages: [] });
    setChats(chats);
  }
  setCurrentId(currentId);

  var cur = chats.find(function (c) { return c.id === currentId; });
  if (!cur) {
    cur = { id: currentId, title: '新对话', messages: [] };
    chats.unshift(cur);
    setChats(chats);
  }

  var historyEl = document.getElementById('historyList');
  var messagesEl = document.getElementById('aiMessages');
  var inputEl = document.getElementById('aiInput');
  var sendBtn = document.getElementById('sendBtn');

  function renderHistory() {
    var list = getChats();
    historyEl.innerHTML = list.map(function (c) {
      var t = (c.title || '新对话').slice(0, 12);
      return '<div class="history-item" data-id="' + c.id + '">' +
        '<span class="hist-title">' + escapeHtml(t) + '</span>' +
        '<button type="button" class="hist-del" title="删除该对话">×</button>' +
      '</div>';
    }).join('');

    historyEl.querySelectorAll('.history-item').forEach(function (el) {
      var cid = el.getAttribute('data-id');
      el.addEventListener('click', function (e) {
        if (e.target.closest('.hist-del')) return;
        setCurrentId(cid);
        loadChat(cid);
        renderHistory();
      });
      var del = el.querySelector('.hist-del');
      if (del) del.addEventListener('click', function (e) {
        e.stopPropagation();
        var arr = getChats().filter(function (x) { return x.id !== cid; });
        setChats(arr);
        if (getCurrentId() === cid) {
          var next = arr[0];
          setCurrentId(next ? next.id : '');
          if (next) loadChat(next.id);
          else { var n = { id: generateId(), title: '新对话', messages: [] }; setCurrentId(n.id); setChats([n]); loadChat(n.id); }
        }
        renderHistory();
      });
    });
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : s;
    return d.innerHTML;
  }

  function loadChat(id) {
    var c = getChats().find(function (x) { return x.id === id; });
    if (!c) return;
    messagesEl.innerHTML = (c.messages || []).map(function (m) {
      return '<div class="ai-msg ' + (m.role === 'user' ? 'user' : 'assistant') + '">' +
        '<div class="bubble">' + escapeHtml(m.text) + '</div>' +
        (m.role === 'assistant' ? '<button type="button" class="copy-btn">复制到剪贴板</button> <button type="button" class="copy-to-note-btn">复制到笔记</button>' : '') +
      '</div>';
    }).join('');

    messagesEl.querySelectorAll('.copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var b = btn.closest('.ai-msg');
        var t = b && b.querySelector('.bubble');
        var text = (t && t.textContent) || '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { toast('已复制'); });
        } else {
          var ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          toast('已复制');
        }
      });
    });
    messagesEl.querySelectorAll('.copy-to-note-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var b = btn.closest('.ai-msg');
        var t = b && b.querySelector('.bubble');
        var text = (t && t.textContent) || '';
        location.href = 'edit.html?mode=note&body=' + encodeURIComponent(text);
      });
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  document.querySelector('.new-chat').addEventListener('click', function () {
    var id = generateId();
    var list = getChats();
    list.unshift({ id: id, title: '新对话', messages: [] });
    setChats(list);
    setCurrentId(id);
    renderHistory();
    loadChat(id);
  });

  function send() {
    var text = (inputEl && inputEl.value || '').trim();
    if (!text) return;

    inputEl.value = '';
    var list = getChats();
    var c = list.find(function (x) { return x.id === getCurrentId(); });
    if (!c) return;

    c.messages = c.messages || [];
    c.messages.push({ role: 'user', text: text });
    if (c.title === '新对话') c.title = text.slice(0, 12);
    setChats(list);

    var div = document.createElement('div');
    div.className = 'ai-msg user';
    div.innerHTML = '<div class="bubble">' + escapeHtml(text) + '</div>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // 模拟 AI 回复
    var reply = '这是针对「' + text.slice(0, 20) + '…」的模拟回复。在实际产品中，这里会接入真实的 AI 能力，提供笔记优化、大纲生成、核心总结、分类标签建议、扩写缩写等能力。您可以点击下方「复制到剪贴板」将内容复制到笔记中使用。';
    setTimeout(function () {
      c.messages.push({ role: 'assistant', text: reply });
      setChats(list);

      var adiv = document.createElement('div');
      adiv.className = 'ai-msg assistant';
      adiv.innerHTML = '<div class="bubble">' + escapeHtml(reply) + '</div><button type="button" class="copy-btn">复制到剪贴板</button> <button type="button" class="copy-to-note-btn">复制到笔记</button>';
      adiv.querySelector('.copy-btn').addEventListener('click', function () {
        var t = adiv.querySelector('.bubble');
        var str = (t && t.textContent) || '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(str).then(function () { toast('已复制'); });
        } else {
          var ta = document.createElement('textarea');
          ta.value = str;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          toast('已复制');
        }
      });
      adiv.querySelector('.copy-to-note-btn').addEventListener('click', function () {
        var t = adiv.querySelector('.bubble');
        var str = (t && t.textContent) || '';
        location.href = 'edit.html?mode=note&body=' + encodeURIComponent(str);
      });
      messagesEl.appendChild(adiv);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 800);
  }

  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  renderHistory();
  loadChat(getCurrentId());
})();
