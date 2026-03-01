(function () {
  'use strict';

  var STORAGE_KEY = 'notes';
  var CARD_BG_COUNT = 5;

  function getNotes() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY) || '[]';
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function getCategories() {
    return (typeof window.STANDARD_CATEGORIES !== 'undefined' && window.STANDARD_CATEGORIES) ? window.STANDARD_CATEGORIES : ['产品思考', '阅读笔记', '生活随想', '设计理念', '创新', '市场营销', '其他'];
  }

  function getTintIndex(note) {
    var id = (note && note.id) || '';
    var h = 0;
    for (var i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i) | 0;
    return Math.abs(h) % CARD_BG_COUNT;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function stripHtml(html) {
    if (!html) return '';
    var d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent || d.innerText || '').trim();
  }

  /** 将纯文本中的 **加粗** 转为 <strong>，双换行为段落，用于预览弹窗 */
  function renderSimpleMarkdown(text) {
    if (!text) return '';
    var s = escapeHtml(text);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    var paras = s.split(/\n\n+/);
    return paras.map(function (p) {
      var line = p.trim().replace(/\n/g, '<br/>');
      return line ? '<p>' + line + '</p>' : '';
    }).filter(Boolean).join('');
  }

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  // ---------- 状态 ----------
  var welcomeContent = '你好，我是你的灵感启发者。✨\n\n我不会直接给你答案——我更喜欢用问题来帮你发现答案。\n\n你可以用 **@** 来引用你知识库中的任何卡片，我会基于你已有的知识体系，帮你建立新的连接。\n\n**今天想探索什么？**';
  var messages = [
    { id: 'welcome', role: 'assistant', content: welcomeContent, jumpWords: ['#产品思考', '#设计理念', '#灵感'] }
  ];
  var input = '';
  var mentionQuery = '';
  var showMention = false;
  var selectedMentions = [];
  var isTyping = false;
  var leftOpen = true;
  var rightOpen = true;

  var chatInner = document.getElementById('aiChatInner');
  var chatScroll = document.getElementById('aiChatScroll');
  var chatEnd = document.getElementById('aiChatEnd');
  var aiInput = document.getElementById('aiInput');
  var aiSendBtn = document.getElementById('aiSendBtn');
  var mentionPopup = document.getElementById('aiMentionPopup');
  var mentionList = document.getElementById('aiMentionList');
  var mentionEmpty = document.getElementById('aiMentionEmpty');
  var selectedMentionsEl = document.getElementById('aiSelectedMentions');
  var anchorWrap = document.getElementById('aiAnchorWrap');
  var anchorList = document.getElementById('aiAnchorList');
  var anchorOpenBtn = document.getElementById('aiAnchorOpen');
  var anchorCloseBtn = document.getElementById('aiAnchorClose');
  var tagsWrap = document.getElementById('aiTagsWrap');
  var tagsCloseBtn = document.getElementById('aiTagsClose');
  var tagsOpenBtn = document.getElementById('aiTagsOpen');
  var previewOverlay = document.getElementById('aiPreviewOverlay');
  var previewCard = document.getElementById('aiPreviewCard');

  var allNotes = getNotes();
  var allTags = [];
  var tagSet = {};
  allNotes.forEach(function (n) {
    var t = Array.isArray(n.tags) ? n.tags : [];
    t.forEach(function (tag) {
      if (tag && !tagSet[tag]) { tagSet[tag] = true; allTags.push(tag); }
    });
  });
  var allCategories = getCategories();

  function uniqueMentionedCards() {
    var seen = {};
    var out = [];
    messages.forEach(function (m) {
      (m.mentionedCards || []).forEach(function (c) {
        if (!seen[c.id]) { seen[c.id] = true; out.push(c); }
      });
    });
    return out;
  }

  function conversationText() {
    return messages.map(function (m) { return m.content || ''; }).join(' ');
  }

  function relevantTags() {
    var text = conversationText().toLowerCase();
    var mentioned = uniqueMentionedCards();
    var mentionedTags = {};
    mentioned.forEach(function (c) {
      (c.tags || []).forEach(function (t) { mentionedTags[t] = true; });
    });
    return allTags.filter(function (tag) {
      return text.indexOf(tag.toLowerCase()) !== -1 || mentionedTags[tag];
    });
  }

  function otherTags() {
    var rel = relevantTags();
    return allTags.filter(function (t) { return rel.indexOf(t) === -1; });
  }

  function renderContent(str) {
    if (!str) return '';
    return str.split(/(\*\*[^*]+\*\*)/g).map(function (part, i) {
      if (part.startsWith('**') && part.endsWith('**')) {
        return '<strong>' + escapeHtml(part.slice(2, -2)) + '</strong>';
      }
      return escapeHtml(part);
    }).join('');
  }

  function renderMessages() {
    if (!chatInner) return;
    var html = '';
    messages.forEach(function (msg) {
      var isUser = msg.role === 'user';
      html += '<div class="ai-msg ' + (isUser ? 'user' : 'assistant') + '" data-id="' + escapeHtml(msg.id) + '">';
      html += '<div class="ai-bubble">';
      if (msg.mentionedCards && msg.mentionedCards.length > 0) {
        html += '<div class="ai-bubble-mentions">';
        msg.mentionedCards.forEach(function (c) {
          var core = (c.core || c.title || '').toString().slice(0, 12);
          if (core.length >= 12) core += '…';
          html += '<span class="ai-bubble-mention-chip">' + escapeHtml(core) + '</span>';
        });
        html += '</div>';
      }
      html += '<div class="ai-bubble-content">' + renderContent(msg.content) + '</div>';
      if (msg.jumpWords && msg.jumpWords.length > 0) {
        html += '<div class="ai-bubble-jump">';
        msg.jumpWords.forEach(function (w) {
          html += '<button type="button" class="ai-bubble-jump-btn" data-word="' + escapeHtml(w) + '">' + escapeHtml(w) + '</button>';
        });
        html += '</div>';
      }
      html += '</div></div>';
    });
    chatInner.innerHTML = html;

    chatInner.querySelectorAll('.ai-bubble-jump-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var w = btn.getAttribute('data-word') || '';
        aiInput.value = (aiInput.value || '') + ' ' + w + ' ';
        aiInput.focus();
      });
    });
  }

  function renderTyping() {
    var container = document.getElementById('aiChatInner');
    if (!container) return;
    var existing = container.querySelector('.ai-typing');
    if (existing) existing.remove();
    if (!isTyping) return;
    var div = document.createElement('div');
    div.className = 'ai-typing';
    div.innerHTML = '<div class="ai-bubble">' +
      '<div class="ai-typing-dots"><span></span><span></span><span></span></div>' +
      '<span>思考中…</span></div>';
    container.appendChild(div);
  }

  function scrollToEnd() {
    if (chatEnd) chatEnd.scrollIntoView({ behavior: 'smooth' });
  }

  function renderLeftSidebar() {
    var list = uniqueMentionedCards();
    if (!anchorList) return;
    if (list.length === 0) {
      if (anchorWrap) anchorWrap.classList.add('hidden');
      if (anchorOpenBtn) anchorOpenBtn.style.display = 'none';
      return;
    }
    if (anchorWrap) anchorWrap.classList.remove('hidden');
    if (anchorOpenBtn) anchorOpenBtn.style.display = 'none';
    anchorList.innerHTML = list.map(function (note) {
      var tags = (note.tags || []).slice(0, 2);
      var core = stripHtml(note.core || note.body || note.title || '无标题').slice(0, 80);
      if (core.length >= 80) core += '…';
      var date = (note.date || '').slice(0, 10);
      var idx = getTintIndex(note);
      var bgVar = 'var(--bg-card-' + (idx + 1) + ')';
      return '<button type="button" class="ai-anchor-card" data-id="' + escapeHtml(note.id) + '" style="border-color:hsl(var(--ink)/0.12);background:' + bgVar + '">' +
        '<div class="ai-anchor-card-tags">' + tags.map(function (t) {
          return '<span class="ai-anchor-card-tag">' + escapeHtml(t) + '</span>';
        }).join('') + '</div>' +
        '<div class="ai-anchor-card-core">' + escapeHtml(core) + '</div>' +
        '<time class="ai-anchor-card-date">' + escapeHtml(date) + '</time></button>';
    }).join('');

    anchorList.querySelectorAll('.ai-anchor-card').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var note = list.find(function (n) { return n.id === id; }) || allNotes.find(function (n) { return n.id === id; });
        if (!note || !previewOverlay || !previewCard) return;
        var title = (note.core || note.title || '无标题').toString().trim();
        var bodyRaw = note.body || '';
        var bodyText = stripHtml(bodyRaw).trim();
        if (!bodyText && (note.core || note.title)) bodyText = (note.core || note.title).toString();
        var bodyHtml = bodyText ? renderSimpleMarkdown(bodyText) : '<p class="ai-preview-empty">暂无总结内容</p>';
        previewCard.innerHTML =
          '<div class="ai-preview-card-header">' + escapeHtml(title) + '</div>' +
          '<div class="ai-preview-card-body">' + bodyHtml + '</div>';
        previewOverlay.classList.add('show');
      });
    });
  }

  function renderRightSidebar() {
    var rel = relevantTags();
    var other = otherTags();
    var relList = document.getElementById('aiTagsRelevantList');
    var catList = document.getElementById('aiTagsCategoriesList');
    var moreList = document.getElementById('aiTagsMoreList');
    if (relList) {
      relList.innerHTML = rel.slice(0, 15).map(function (tag, i) {
        return '<button type="button" class="ai-tag-btn twinkle" data-tag="' + escapeHtml(tag) + '">#' + escapeHtml(tag) + '</button>';
      }).join('');
      relList.querySelectorAll('.ai-tag-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var tag = btn.getAttribute('data-tag') || '';
          aiInput.value = (aiInput.value || '') + ' #' + tag + ' ';
          aiInput.focus();
        });
      });
    }
    if (catList) {
      catList.innerHTML = allCategories.slice(0, 12).map(function (cat) {
        return '<button type="button" class="ai-tag-btn sky" data-cat="' + escapeHtml(cat) + '">' + escapeHtml(cat) + '</button>';
      }).join('');
      catList.querySelectorAll('.ai-tag-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var cat = btn.getAttribute('data-cat') || '';
          aiInput.value = (aiInput.value || '') + ' [' + cat + '] ';
          aiInput.focus();
        });
      });
    }
    if (moreList) {
      moreList.innerHTML = other.slice(0, 20).map(function (tag) {
        return '<button type="button" class="ai-tag-btn muted" data-tag="' + escapeHtml(tag) + '">#' + escapeHtml(tag) + '</button>';
      }).join('');
      moreList.querySelectorAll('.ai-tag-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var tag = btn.getAttribute('data-tag') || '';
          aiInput.value = (aiInput.value || '') + ' #' + tag + ' ';
          aiInput.focus();
        });
      });
    }
  }

  function renderSelectedMentions() {
    if (!selectedMentionsEl) return;
    selectedMentionsEl.innerHTML = selectedMentions.map(function (note) {
      var core = (note.core || note.title || '').toString().slice(0, 12);
      if (core.length >= 12) core += '…';
      return '<span class="ai-selected-chip">' + escapeHtml(core) +
        '<button type="button" class="ai-selected-chip-remove" data-id="' + escapeHtml(note.id) + '">×</button></span>';
    }).join('');
    selectedMentionsEl.querySelectorAll('.ai-selected-chip-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        selectedMentions = selectedMentions.filter(function (c) { return c.id !== id; });
        renderSelectedMentions();
      });
    });
  }

  function refreshNotes() {
    allNotes = getNotes();
    tagSet = {};
    allTags = [];
    allNotes.forEach(function (n) {
      (Array.isArray(n.tags) ? n.tags : []).forEach(function (tag) {
        if (tag && !tagSet[tag]) { tagSet[tag] = true; allTags.push(tag); }
      });
    });
  }

  function filteredCardsForMention() {
    var q = mentionQuery.toLowerCase().trim();
    if (!q) return allNotes;
    return allNotes.filter(function (n) {
      var core = (n.core || n.title || '').toString().toLowerCase();
      var body = stripHtml(n.body || '').toLowerCase();
      var tags = (n.tags || []).join(' ').toLowerCase();
      return core.indexOf(q) !== -1 || body.indexOf(q) !== -1 || tags.indexOf(q) !== -1;
    });
  }

  function updateMentionPopup() {
    var cards = filteredCardsForMention();
    if (!mentionPopup || !mentionList || !mentionEmpty) return;
    if (cards.length === 0) {
      mentionPopup.classList.add('empty');
      mentionList.innerHTML = '';
    } else {
      mentionPopup.classList.remove('empty');
      mentionList.innerHTML = cards.map(function (note) {
        var core = (note.core || note.title || '无标题').toString();
        var tags = (note.tags || []).slice(0, 3);
        return '<button type="button" class="ai-mention-item" data-id="' + escapeHtml(note.id) + '">' +
          '<span class="ai-mention-item-core">' + escapeHtml(core.slice(0, 60)) + (core.length > 60 ? '…' : '') + '</span>' +
          '<div class="ai-mention-item-tags">' + tags.map(function (t) { return '<span>#' + escapeHtml(t) + '</span>'; }).join('') + '</div>' +
          '</button>';
      }).join('');
      mentionList.querySelectorAll('.ai-mention-item').forEach(function (btn) {
        btn.addEventListener('click', function () { selectMention(btn.getAttribute('data-id')); });
      });
    }
  }

  function selectMention(noteId) {
    var note = allNotes.find(function (n) { return n.id === noteId; });
    if (!note) return;
    var cursorPos = aiInput.selectionStart || aiInput.value.length;
    var textBefore = aiInput.value.slice(0, cursorPos);
    var atIdx = textBefore.lastIndexOf('@');
    var core = (note.core || note.title || '无标题').toString().slice(0, 15);
    if (core.length >= 15) core += '…';
    aiInput.value = aiInput.value.slice(0, atIdx) + '@[' + core + '] ' + aiInput.value.slice(cursorPos);
    showMention = false;
    mentionPopup.classList.remove('show');
    if (selectedMentions.indexOf(note) === -1) selectedMentions.push(note);
    renderSelectedMentions();
    renderLeftSidebar();
    aiInput.focus();
  }

  /** 从助手回复中解析 JUMP_WORDS 行，返回 { content, jumpWords } */
  function parseAssistantResponse(raw) {
    if (!raw || typeof raw !== 'string') return { content: '', jumpWords: [] };
    var text = raw.trim();
    var jumpWords = [];
    var jumpMatch = text.match(/JUMP_WORDS:\s*([^\n]+)/i);
    if (jumpMatch) {
      text = text.replace(/\s*JUMP_WORDS:\s*[^\n]+/gi, '').trim();
      var part = jumpMatch[1].trim();
      part.split(/\s+/).forEach(function (w) {
        w = w.trim();
        if (w) jumpWords.push(w.indexOf('#') === 0 ? w : '#' + w);
      });
    }
    jumpWords = jumpWords.slice(0, 3);
    if (jumpWords.length === 0) jumpWords = ['#元认知', '#灵感', '#记录'];
    return { content: text, jumpWords: jumpWords };
  }

  /** 构建发给大模型的消息列表：system + 近期历史 + 当前用户（含 @ 卡片 context） */
  function buildChatMessagesForAPI(userContent, mentionedCards, userTags, userCategories) {
    var systemPrompt = (typeof window.getInklingOracleSystemPrompt === 'function' ? window.getInklingOracleSystemPrompt() : '') ||
      '你是用户的灵感启发者与灵魂陪伴者。用提问引导思考，用温暖接住情绪。';
    if (userTags && userTags.length) {
      systemPrompt += '\n\n【用户知识库中的真实标签（思维跳跃词须优先从中选取）】\n' + userTags.slice(0, 60).join('、');
    }
    if (userCategories && userCategories.length) {
      systemPrompt += '\n\n【用户分类】\n' + userCategories.slice(0, 30).join('、');
    }
    var apiMessages = [{ role: 'system', content: systemPrompt }];

    var conv = [];
    for (var k = 0; k < messages.length; k++) {
      var m = messages[k];
      if (m.role === 'user') conv.push({ role: 'user', content: m.content || '' });
      else if (m.role === 'assistant' && m.content) conv.push({ role: 'assistant', content: m.content });
    }
    var lastN = 6;
    var start = Math.max(0, conv.length - lastN);
    for (var idx = start; idx < conv.length; idx++) apiMessages.push(conv[idx]);

    var currentUserText = userContent;
    if (mentionedCards && mentionedCards.length > 0) {
      var contextBlock = '【用户引用的知识卡片】\n';
      mentionedCards.forEach(function (c, i) {
        var core = (c.core || c.title || '无标题').toString();
        var tags = (c.tags || []).join('、');
        var cat = c.parent_category || '';
        var bodySnippet = stripHtml(c.body || '').slice(0, 400);
        contextBlock += '卡片' + (i + 1) + ' - 核心: ' + core + '\n标签: ' + tags + (cat ? '\n分类: ' + cat : '') + '\n正文摘要: ' + bodySnippet + '\n\n';
      });
      contextBlock += '【用户说】\n';
      currentUserText = contextBlock + userContent;
    }
    apiMessages.push({ role: 'user', content: currentUserText });
    return apiMessages;
  }

  function generateMockResponse(userMsg, mentioned) {
    var hasMention = mentioned && mentioned.length > 0;
    var content, jumpWords = [];
    if (hasMention) {
      var card = mentioned[0];
      var snip = (card.core || card.title || '').toString().slice(0, 20);
      content = '很有意思，你提到了「' + snip + '…」这个观点。\n\n我想问你一个问题：**当你第一次读到这段话的时候，是什么让你决定把它收藏下来？** 是因为它验证了你已有的认知，还是因为它挑战了某种你一直以来的假设？\n\n另外，这是否让你联想到你知识库中其他笔记？两者之间似乎存在一个共同的底层逻辑——**本质的回归**。';
      jumpWords = ['#具身智能', '#本质主义', '#' + ((card.tags && card.tags[0]) || '思考')];
    } else if (/人工智能|AI|智能/.test(userMsg)) {
      content = '关于人工智能，我注意到你的知识库里有不少相关的收藏。\n\n但我更好奇的是：**你怎么看待「AI原生」这个概念？** 它是一种技术路线的描述，还是一种思维方式的转变？\n\n你之前在笔记中，似乎也在探索「数字时代的创造力」。这两者之间，有没有让你觉得意外的交叉点？';
      jumpWords = ['#AI原生硬件', '#创造力悖论', '#人机共生'];
    } else {
      content = '这是一个值得深入思考的方向。\n\n不过在我回答之前，我想先了解：**你提出这个问题的背景是什么？** 是源于最近的某个阅读，还是工作中遇到的具体场景？\n\n有时候，问题的上下文比问题本身更有价值。';
      jumpWords = ['#元认知', '#知识迁移', '#第一性原理'];
    }
    return { content: content, jumpWords: jumpWords };
  }

  function send() {
    var text = (aiInput && aiInput.value || '').trim();
    if (!text && selectedMentions.length === 0) return;
    refreshNotes();

    var userMsg = {
      id: 'm_' + Date.now(),
      role: 'user',
      content: text,
      mentionedCards: selectedMentions.length ? selectedMentions.slice() : undefined
    };
    messages.push(userMsg);
    aiInput.value = '';
    selectedMentions = [];
    renderSelectedMentions();
    renderMessages();
    renderLeftSidebar();
    renderRightSidebar();
    scrollToEnd();

    isTyping = true;
    renderTyping();
    scrollToEnd();
    if (aiSendBtn) aiSendBtn.disabled = true;

    function done(res) {
      isTyping = false;
      var typingEl = chatInner && chatInner.querySelector('.ai-typing');
      if (typingEl) typingEl.remove();
      messages.push({
        id: 'm_' + Date.now(),
        role: 'assistant',
        content: res.content,
        jumpWords: res.jumpWords || []
      });
      renderMessages();
      renderLeftSidebar();
      renderRightSidebar();
      scrollToEnd();
      if (aiSendBtn) aiSendBtn.disabled = false;
    }

    if (typeof window.invokeAIChat === 'function') {
      var apiMessages = buildChatMessagesForAPI(text, userMsg.mentionedCards, allTags, allCategories);
      window.invokeAIChat(apiMessages)
        .then(function (raw) {
          var parsed = parseAssistantResponse(raw);
          done(parsed);
        })
        .catch(function (err) {
          toast(err.message || 'AI 回复失败，已切换为模拟回复');
          var res = generateMockResponse(text, userMsg.mentionedCards);
          done(res);
        });
    } else {
      setTimeout(function () {
        var res = generateMockResponse(text, userMsg.mentionedCards);
        done(res);
      }, 1200 + Math.random() * 800);
    }
  }

  function onInputChange() {
    input = aiInput.value || '';
    var cursorPos = aiInput.selectionStart != null ? aiInput.selectionStart : input.length;
    var textBefore = input.slice(0, cursorPos);
    var match = textBefore.match(/@([^@\s]*)$/);
    if (match) {
      showMention = true;
      mentionQuery = match[1];
      refreshNotes();
      mentionPopup.classList.add('show');
      updateMentionPopup();
    } else {
      showMention = false;
      mentionPopup.classList.remove('show');
    }
  }

  if (aiInput) {
    aiInput.addEventListener('input', onInputChange);
    aiInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }
  if (aiSendBtn) aiSendBtn.addEventListener('click', send);

  if (anchorCloseBtn) anchorCloseBtn.addEventListener('click', function () {
    anchorWrap.classList.add('hidden');
    if (anchorOpenBtn) anchorOpenBtn.style.display = 'block';
  });
  if (anchorOpenBtn) anchorOpenBtn.addEventListener('click', function () {
    anchorWrap.classList.remove('hidden');
    anchorOpenBtn.style.display = 'none';
  });
  if (tagsCloseBtn) tagsCloseBtn.addEventListener('click', function () {
    tagsWrap.classList.add('hidden');
    if (tagsOpenBtn) tagsOpenBtn.style.display = 'block';
  });
  if (tagsOpenBtn) tagsOpenBtn.addEventListener('click', function () {
    tagsWrap.classList.remove('hidden');
    tagsOpenBtn.style.display = 'none';
  });

  if (previewOverlay) {
    previewOverlay.addEventListener('click', function (e) {
      if (e.target === previewOverlay) previewOverlay.classList.remove('show');
    });
  }

  (function () {
    var list = uniqueMentionedCards();
    if (list.length === 0 && anchorWrap) anchorWrap.classList.add('hidden');
    if (anchorOpenBtn) anchorOpenBtn.style.display = list.length > 0 ? 'block' : 'none';
  })();

  renderMessages();
  renderLeftSidebar();
  renderRightSidebar();
  renderSelectedMentions();
})();
