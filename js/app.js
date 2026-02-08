(function () {
  'use strict';

  var STORAGE_KEY = 'notes';
  // 卡片 tint：rose(terracotta) / sky / sage / amber / plum，对应 CSS data-bg-index 0~4
  var CARD_BGS = ['var(--bg-card-1)', 'var(--bg-card-2)', 'var(--bg-card-3)', 'var(--bg-card-4)', 'var(--bg-card-5)'];
  var GRID_COLUMNS = 3;

  /** Fisher-Yates 洗牌，返回新数组 */
  function shuffleTints() {
    var arr = [0, 1, 2, 3, 4];
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  /**
   * 受控随机（瀑布流布局）：column-count 下内容按列填充，邻居 = 同列上方 + 左侧列同行。
   * @param {number[]} assigned - 已分配的颜色索引列表 assigned[0..index-1]
   * @param {number} index - 当前卡片在列表中的下标
   * @param {number} totalCount - 当前列表总条数（用于算 numRows）
   * @param {number} columns - 列数
   * @param {number[]} shuffledOrder - 洗牌后的 tint 顺序 [0..4] 的排列
   * @returns {number} 0~4 的 data-bg-index
   */
  function getNextDiverseColor(assigned, index, totalCount, columns, shuffledOrder) {
    var numRows = Math.ceil(totalCount / columns) || 1;
    var col = Math.floor(index / numRows);
    var row = index % numRows;
    var above = row > 0 ? assigned[index - 1] : null;
    var left = col > 0 ? assigned[index - numRows] : null;
    var forbidden = {};
    if (above != null) forbidden[above] = true;
    if (left != null) forbidden[left] = true;
    var allowed = [];
    for (var i = 0; i < shuffledOrder.length; i++) {
      var c = shuffledOrder[i];
      if (!forbidden[c]) allowed.push(c);
    }
    if (allowed.length === 0) return shuffledOrder[0];
    return allowed[Math.floor(Math.random() * allowed.length)];
  }

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

      // 检查是否有 AI 配置
      if (typeof window.parseLinkWithAI === 'function') {
        // 使用真实 AI 解析
        window.parseLinkWithAI(url)
          .then(function (result) {
            linkLoader.classList.remove('show');
            parseBtn.disabled = false;
            modalLink.classList.remove('open');
            var summary = (result && typeof result === 'object' && result.summary) ? result.summary : (typeof result === 'string' ? result : '');
            var sourceTitle = (result && typeof result === 'object' && result.title) ? String(result.title).trim() : '';
            var body = '【AI 解析结果】\n\n' + summary + '\n\n---\n\n你可以在下方补充自己的感悟，或使用「AI 生成大纲」「AI 提炼核心」进行进一步加工。';
            var q = 'mode=link&body=' + encodeURIComponent(body) + '&sourceUrl=' + encodeURIComponent(url);
            if (sourceTitle) q += '&sourceTitle=' + encodeURIComponent(sourceTitle);
            location.href = 'edit.html?' + q;
          })
          .catch(function (err) {
            linkLoader.classList.remove('show');
            parseBtn.disabled = false;
            toast(err.message || '解析失败，请检查配置或稍后重试');
            console.error('链接解析错误:', err);
          });
      } else {
        // 降级：使用模拟（未配置 AI 时）
        setTimeout(function () {
          linkLoader.classList.remove('show');
          parseBtn.disabled = false;
          modalLink.classList.remove('open');
          var mockBody = '【解析自链接的示例内容】\n\n这是一段从外部链接解析得到的文本。在实际产品中，这里会展示从公众号、小红书、知乎或普通网页提取出的正文。\n\n提示：要使用真实 AI 解析，请创建 config.js 并配置 API Key（参考 config.example.js）。';
          var q = 'mode=link&body=' + encodeURIComponent(mockBody) + '&sourceUrl=' + encodeURIComponent(url);
          location.href = 'edit.html?' + q;
        }, 2500);
      }
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

  // ——— 展示切换：按日期 / 按分类展示（语义聚合，按 parent_category） ———
  var sortBtns = document.querySelectorAll('.sort-btn');
  var currentSort = 'date';
  var cardsView = document.getElementById('cardsView');
  sortBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      sortBtns.forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      currentSort = b.getAttribute('data-sort') || 'date';
      if (cardsView) cardsView.classList.toggle('view-by-category', currentSort === 'category');
      renderCards();
    });
  });

  function buildCardElement(n, index, gridIndex, bgIndex) {
    var card = document.createElement('div');
    var coreText = (n.core || n.title || '无标题').toString().replace(/\n/g, ' ');
    var cls = 'card card-masonry';
    card.className = cls;
    card.setAttribute('data-id', n.id);
    if (typeof bgIndex !== 'number' || bgIndex < 0 || bgIndex >= CARD_BGS.length) {
      bgIndex = (gridIndex !== undefined ? gridIndex : index) % CARD_BGS.length;
    }
    card.setAttribute('data-bg-index', String(bgIndex));

    var tagIcon = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17-7.17a2 2 0 0 0-2.83 0L2 16.59V22h5.41L20.59 13.41a2 2 0 0 0 0-2.83z"/></svg>';
    var tags = Array.isArray(n.tags) ? n.tags.slice(0, 3) : [];
    var tagsHtml = tags.map(function (t, i) {
      return '<span class="tag" data-index="' + i + '" data-value="' + escapeHtml(t) + '">' + tagIcon + escapeHtml(t) + '<button type="button" class="tag-del" aria-label="删除标签">×</button></span>';
    }).join('');
    if (tags.length < 3) tagsHtml += '<span class="card-tag-add" title="添加标签（最多 3 个）">+</span>';
    var date = (n.date || '').slice(0, 10);
    var sourceUrl = (n.sourceUrl || '').trim();
    var sourceDisplay = (n.sourceTitle || '').trim() || '正在获取标题...';
    var footerSourceHtml = sourceUrl ? '<a class="card-source" href="' + escapeAttr(sourceUrl) + '" target="_blank" rel="noopener" title="' + escapeAttr(sourceUrl) + '">【' + escapeHtml(sourceDisplay) + '】</a>' : '';

    card.innerHTML =
      '<div class="card-header">' +
        '<div class="tags">' + tagsHtml + '</div>' +
        '<div class="quick-actions">' +
          '<button type="button" class="qa-edit" title="编辑">✎</button>' +
          '<button type="button" class="qa-del" title="删除">×</button>' +
        '</div>' +
      '</div>' +
      '<div class="core-wrap">' +
        '<div class="core" title="' + escapeHtml(coreText) + '">' + escapeHtml(coreText) + '</div>' +
      '</div>' +
      '<div class="card-footer">' +
        (footerSourceHtml ? '<div class="card-source-wrap">' + footerSourceHtml + '</div>' : '') +
        '<div class="date">' + escapeHtml(date) + '</div>' +
      '</div>';

    return { card: card, n: n, coreText: coreText, tags: tags };
  }

  function bindCardActions(cardEl, data) {
    var n = data.n;

    cardEl.querySelector('.qa-edit').addEventListener('click', function (e) {
      e.stopPropagation();
      location.href = 'edit.html?id=' + encodeURIComponent(n.id);
    });
    cardEl.querySelector('.qa-del').addEventListener('click', function (e) {
      e.stopPropagation();
      askDelete(n.id);
    });

    cardEl.addEventListener('click', function (e) {
      if (e.target.closest('.quick-actions') || e.target.closest('.tag') || e.target.closest('.card-tag-add')) return;
      // 点击「来源标题」时只打开外部链接，不进入编辑页
      if (e.target.closest('.card-source-wrap')) return;
      location.href = 'edit.html?id=' + encodeURIComponent(n.id);
    });

    // 卡片上标签编辑：双击改名、× 删除、+ 添加（最多 3 个）
    function refreshCardTags() {
      var list = getNotes();
      var note = list.find(function (x) { return x.id === n.id; });
      if (!note) return;
      var tagIcon = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17-7.17a2 2 0 0 0-2.83 0L2 16.59V22h5.41L20.59 13.41a2 2 0 0 0 0-2.83z"/></svg>';
      var tags = Array.isArray(note.tags) ? note.tags.slice(0, 3) : [];
      var tagsHtml = tags.map(function (t, i) {
        return '<span class="tag" data-index="' + i + '" data-value="' + escapeHtml(t) + '">' + tagIcon + escapeHtml(t) + '<button type="button" class="tag-del" aria-label="删除标签">×</button></span>';
      }).join('');
      if (tags.length < 3) tagsHtml += '<span class="card-tag-add" title="添加标签（最多 3 个）">+</span>';
      var tagsContainer = cardEl.querySelector('.card-header .tags');
      if (tagsContainer) tagsContainer.innerHTML = tagsHtml;
      bindTagEditListeners(cardEl, n);
      requestAnimationFrame(function () { truncateCardTags(cardEl); });
    }

    function bindTagEditListeners(cardEl, note) {
      var tagsContainer = cardEl.querySelector('.card-header .tags');
      if (!tagsContainer) return;
      tagsContainer.querySelectorAll('.tag').forEach(function (span) {
        var idx = parseInt(span.getAttribute('data-index'), 10);
        span.querySelectorAll('.tag-del').forEach(function (btn) {
          btn.onclick = function (e) {
            e.stopPropagation();
            e.preventDefault();
            var list = getNotes();
            var idxList = list.findIndex(function (x) { return x.id === note.id; });
            if (idxList < 0) return;
            var t = (list[idxList].tags || []).slice();
            t.splice(idx, 1);
            list[idxList].tags = t.length ? t : ['未分类'];
            setNotes(list);
            toast('已删除标签');
            refreshCardTags();
          };
        });
        span.ondblclick = function (e) {
          e.stopPropagation();
          e.preventDefault();
          var cur = (span.getAttribute('data-value') || '').trim();
          var newVal = (prompt('修改标签名称', cur) || '').trim();
          if (!newVal || newVal === cur) return;
          var list = getNotes();
          var idxList = list.findIndex(function (x) { return x.id === note.id; });
          if (idxList < 0) return;
          var t = (list[idxList].tags || []).slice();
          t[idx] = newVal;
          list[idxList].tags = t;
          setNotes(list);
          toast('已保存');
          refreshCardTags();
        };
      });
      var addBtn = tagsContainer.querySelector('.card-tag-add');
      if (addBtn) {
        addBtn.onclick = function (e) {
          e.stopPropagation();
          e.preventDefault();
          var list = getNotes();
          var idxList = list.findIndex(function (x) { return x.id === note.id; });
          if (idxList < 0) return;
          var t = (list[idxList].tags || []).slice();
          if (t.length >= 3) return;
          var v = (prompt('输入新标签名称（最多 3 个）') || '').trim();
          if (!v) return;
          t.push(v);
          list[idxList].tags = t.slice(0, 3);
          setNotes(list);
          toast('已添加标签');
          refreshCardTags();
        };
      }
    }

    bindTagEditListeners(cardEl, n);

    requestAnimationFrame(function () { truncateCardTags(cardEl); });
  }

  function truncateCardTags(cardEl) {
    var container = cardEl && cardEl.querySelector('.card-header .tags');
    if (!container) return;
    var children = container.children;
    var i;
    for (i = 0; i < children.length; i++) children[i].style.display = '';
    if (container.scrollWidth <= container.clientWidth) return;
    for (i = children.length - 1; i >= 0; i--) {
      children[i].style.display = 'none';
      if (container.scrollWidth <= container.clientWidth) return;
    }
  }

  // ——— 卡片渲染（按日期 或 按分类展示） ———
  function renderCards() {
    var list = getNotes();
    var empty = document.getElementById('cardsEmpty');
    var viewEl = document.getElementById('cardsView');
    if (!viewEl) return;

    if (list.length === 0) {
      viewEl.innerHTML = '<div class="cards-grid cards-grid-date" id="cardsGrid"></div>';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    var shuffledTints = shuffleTints();

    if (currentSort === 'category') {
      var byCategory = {};
      list.forEach(function (n) {
        var parent = (n.parent_category && String(n.parent_category).trim()) || '其他';
        if (!byCategory[parent]) byCategory[parent] = [];
        byCategory[parent].push(n);
      });
      var categories = Object.keys(byCategory).sort(function (a, b) {
        if (a === '其他') return 1;
        if (b === '其他') return -1;
        return a.localeCompare(b);
      });
      viewEl.innerHTML = '';
      var gridIndex = 0;
      categories.forEach(function (cat) {
        var section = document.createElement('div');
        section.className = 'category-section';
        section.innerHTML = '<h3 class="category-title">' + escapeHtml(cat) + '</h3><div class="cards-grid cards-grid-category"></div>';
        var grid = section.querySelector('.cards-grid');
        var items = byCategory[cat].slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
        var assigned = [];
        for (var i = 0; i < items.length; i++) assigned[i] = getNextDiverseColor(assigned, i, items.length, GRID_COLUMNS, shuffledTints);
        items.forEach(function (n, i) {
          var data = buildCardElement(n, i, gridIndex++, assigned[i]);
          grid.appendChild(data.card);
          bindCardActions(data.card, data);
        });
        viewEl.appendChild(section);
      });
    } else {
      var sorted = list.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      var assigned = [];
      for (var i = 0; i < sorted.length; i++) assigned[i] = getNextDiverseColor(assigned, i, sorted.length, GRID_COLUMNS, shuffledTints);
      viewEl.innerHTML = '<div class="cards-grid cards-grid-date" id="cardsGrid"></div>';
      var grid = document.getElementById('cardsGrid');
      sorted.forEach(function (n, index) {
        try {
          var data = buildCardElement(n, index, index, assigned[index]);
          grid.appendChild(data.card);
          bindCardActions(data.card, data);
        } catch (err) {
          console.error('渲染卡片出错:', err, n);
        }
      });
    }
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  function escapeAttr(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
