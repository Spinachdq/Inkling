(function () {
  'use strict';

  var STORAGE_KEY = 'notes';
  var CARD_BGS = ['var(--bg-card-1)', 'var(--bg-card-2)', 'var(--bg-card-3)', 'var(--bg-card-4)', 'var(--bg-card-5)'];

  function getNotes() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : [];
    } catch (e) { return []; }
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

  // ——— 4 个功能键 ———
  document.querySelectorAll('.action-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-id');
      if (id === 'note') {
        location.href = 'edit.html?mode=note';
      } else if (id === 'link') {
        document.getElementById('modalLink').classList.add('open');
        document.getElementById('linkInput').value = '';
        document.getElementById('linkLoader').classList.remove('show');
      } else if (id === 'doc') {
        document.getElementById('modalDoc').classList.add('open');
        document.getElementById('uploadProgress').classList.remove('show');
        document.getElementById('uploadBar').style.width = '0%';
      } else if (id === 'ai') {
        location.href = 'ai.html';
      }
    });
  });

  // ——— 链导入：解析（模拟） ———
  var modalLink = document.getElementById('modalLink');
  var linkInput = document.getElementById('linkInput');
  var linkLoader = document.getElementById('linkLoader');
  var parseBtn = modalLink && modalLink.querySelector('.parse-btn');
  var cancelLink = modalLink && modalLink.querySelectorAll('.cancel-btn')[0];

  if (parseBtn) {
    parseBtn.addEventListener('click', function () {
      var url = (linkInput && linkInput.value || '').trim();
      if (!url) { toast('请输入链接'); return; }
      linkLoader.classList.add('show');
      parseBtn.disabled = true;
      // 模拟解析 2–4 秒
      setTimeout(function () {
        linkLoader.classList.remove('show');
        parseBtn.disabled = false;
        modalLink.classList.remove('open');
        var mockBody = '【解析自链接的示例内容】\n\n这是一段从外部链接解析得到的文本。在实际产品中，这里会展示从公众号、小红书、知乎或普通网页提取出的正文。\n\n你可以在下方补充自己的感悟，或使用「AI 生成大纲」「AI 提炼核心」进行加工。';
        var q = 'mode=link&body=' + encodeURIComponent(mockBody);
        location.href = 'edit.html?' + q;
      }, 2500);
    });
  }
  if (cancelLink) cancelLink.addEventListener('click', function () { modalLink.classList.remove('open'); });
  if (modalLink) modalLink.addEventListener('click', function (e) { if (e.target === modalLink) modalLink.classList.remove('open'); });

  // ——— 文上传：拖拽与选择（模拟提取） ———
  var modalDoc = document.getElementById('modalDoc');
  var uploadZone = document.getElementById('uploadZone');
  var fileInput = document.getElementById('fileInput');
  var uploadProgress = document.getElementById('uploadProgress');
  var uploadBar = document.getElementById('uploadBar');
  var cancelDoc = modalDoc && modalDoc.querySelector('.cancel-btn');

  function finishUpload(text) {
    uploadProgress.classList.add('show');
    uploadBar.style.width = '100%';
    setTimeout(function () {
      modalDoc.classList.remove('open');
      uploadProgress.classList.remove('show');
      uploadBar.style.width = '0%';
      var q = 'mode=doc&body=' + encodeURIComponent(text);
      location.href = 'edit.html?' + q;
    }, 600);
  }

  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', function () { fileInput.click(); });
    uploadZone.addEventListener('dragover', function (e) { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', function () { uploadZone.classList.remove('dragover'); });
    uploadZone.addEventListener('drop', function (e) {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      handleFiles(files);
    });
    fileInput.addEventListener('change', function () {
      var files = fileInput.files;
      if (files && files.length) handleFiles(files);
      fileInput.value = '';
    });
  }

  function handleFiles(files) {
    var allowed = /\.(doc|docx|pdf|txt)$/i;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (!allowed.test(f.name)) {
        toast('仅支持 Word、PDF、TXT 格式文件');
        return;
      }
    }
    // 模拟：用第一个文件名的占位正文（真实产品需后端解析）
    var name = files[0] ? files[0].name : 'document';
    var mock = '【从「' + name + '」提取的示例文本】\n\n此处模拟从 Word / PDF / TXT 中解析出的内容。实际环境中将保留原有分段，并过滤页眉页脚等。\n\n可在此编辑、分段，并使用底部工具栏进行 AI 辅助。';
    finishUpload(mock);
  }

  if (cancelDoc) cancelDoc.addEventListener('click', function () { modalDoc.classList.remove('open'); });
  if (modalDoc) modalDoc.addEventListener('click', function (e) { if (e.target === modalDoc) modalDoc.classList.remove('open'); });

  // ——— 排序 ———
  var sortBtns = document.querySelectorAll('.sort-btn');
  var currentSort = 'date';
  sortBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      sortBtns.forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      currentSort = b.getAttribute('data-sort') || 'date';
      renderCards();
    });
  });

  // ——— 卡片渲染 ———
  function renderCards() {
    var list = getNotes();
    if (currentSort === 'tag') {
      list = list.slice().sort(function (a, b) {
        var ta = (a.tags && a.tags[0]) || '';
        var tb = (b.tags && b.tags[0]) || '';
        return ta.localeCompare(tb);
      });
    } else {
      list = list.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    }

    var grid = document.getElementById('cardsGrid');
    var empty = document.getElementById('cardsEmpty');
    if (!grid) return;

    grid.innerHTML = '';
    if (list.length === 0) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    list.forEach(function (n) {
      var card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('data-id', n.id);
      if (n.bg) card.style.background = n.bg;
      else card.style.background = CARD_BGS[Math.floor(Math.random() * CARD_BGS.length)];

      var tags = (n.tags || []).slice(0, 3);
      var tagsHtml = tags.map(function (t, i) {
        return '<span class="tag t' + ((i % 3) + 1) + '">' + escapeHtml(t) + '</span>';
      }).join('');
      var core = (n.core || n.title || '无标题').replace(/\n/g, ' ');
      var date = (n.date || '').slice(0, 10);

      card.innerHTML =
        '<div class="quick-actions">' +
          '<button type="button" class="qa-edit" title="编辑标签">✎</button>' +
          '<button type="button" class="qa-del" title="删除">×</button>' +
        '</div>' +
        '<div class="tags">' + tagsHtml + '</div>' +
        '<div class="core" title="' + escapeHtml(core) + '">' + escapeHtml(core) + '</div>' +
        '<div class="date">' + escapeHtml(date) + '</div>';

      card.querySelector('.core').addEventListener('click', function (e) { e.stopPropagation(); });
      card.querySelector('.qa-edit').addEventListener('click', function (e) {
        e.stopPropagation();
        location.href = 'edit.html?id=' + encodeURIComponent(n.id);
      });
      card.querySelector('.qa-del').addEventListener('click', function (e) {
        e.stopPropagation();
        askDelete(n.id);
      });

      card.addEventListener('click', function (e) {
        if (e.target.closest('.quick-actions')) return;
        location.href = 'edit.html?id=' + encodeURIComponent(n.id);
      });
      grid.appendChild(card);
    });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ——— 删除确认 ———
  var confirmEl = document.getElementById('confirmDelete');
  var toDeleteId = null;
  function askDelete(id) {
    toDeleteId = id;
    if (confirmEl) confirmEl.classList.add('open');
  }
  if (confirmEl) {
    confirmEl.querySelector('.cancel-confirm').addEventListener('click', function () {
      toDeleteId = null;
      confirmEl.classList.remove('open');
    });
    confirmEl.querySelector('.confirm-delete').addEventListener('click', function () {
      if (toDeleteId) {
        var list = getNotes().filter(function (n) { return n.id !== toDeleteId; });
        setNotes(list);
        toast('已删除');
        renderCards();
      }
      toDeleteId = null;
      confirmEl.classList.remove('open');
    });
    confirmEl.addEventListener('click', function (e) { if (e.target === confirmEl) { toDeleteId = null; confirmEl.classList.remove('open'); } });
  }

  renderCards();
})();
