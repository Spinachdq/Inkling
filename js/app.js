(function () {
  'use strict';

  var STORAGE_KEY = 'notes';
  var SESSION_SEED_KEY = 'home_display_seed';
  var SESSION_CARD_IDS_KEY = 'home_random_card_ids';
  // 卡片 tint：rose(terracotta) / sky / sage / amber / plum，对应 CSS data-bg-index 0~4
  var CARD_BGS = ['var(--bg-card-1)', 'var(--bg-card-2)', 'var(--bg-card-3)', 'var(--bg-card-4)', 'var(--bg-card-5)'];
  var GRID_COLUMNS = 3;

  /** 简易 seeded PRNG（同一 seed 同一会话内得到相同序列） */
  function createSeededRandom(seed) {
    return function () {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  }

  /** Fisher-Yates 洗牌，使用传入的 random 函数 */
  function shuffleWithRandom(arr, randomFn) {
    arr = arr.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(randomFn() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  /** 按日期/按分类展示时：卡片颜色由 note.id 稳定决定，切换或多次点击不会变 */
  function stableBgIndexForNote(id) {
    var h = 0;
    var s = String(id || '');
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
    return Math.abs(h) % CARD_BGS.length;
  }

  /** 无 seed 时使用 Math.random（仅冷启动时用一次） */
  function shuffleTints() {
    return shuffleWithRandom([0, 1, 2, 3, 4], Math.random);
  }

  /** 有 seed 时确定性洗牌 tint 顺序，同一会话内同一张卡片背景色一致 */
  function shuffleTintsWithSeed(seed) {
    var s = (typeof seed === 'number' && Number.isFinite(seed)) ? seed : 0;
    return shuffleWithRandom([0, 1, 2, 3, 4], createSeededRandom(s));
  }

  /**
   * 受控随机（瀑布流布局）：column-count 下内容按列填充，邻居 = 同列上方 + 左侧列同行。
   * @param {number[]} assigned - 已分配的颜色索引列表 assigned[0..index-1]
   * @param {number} index - 当前卡片在列表中的下标
   * @param {number} totalCount - 当前列表总条数（用于算 numRows）
   * @param {number} columns - 列数
   * @param {number[]} shuffledOrder - 洗牌后的 tint 顺序 [0..4] 的排列
   * @param {function} [randomFn] - 可选，用于确定性配色（如 createSeededRandom(seed)），同 seed 同顺序则同颜色
   * @returns {number} 0~4 的 data-bg-index
   */
  function getNextDiverseColor(assigned, index, totalCount, columns, shuffledOrder, randomFn) {
    var rnd = randomFn || Math.random;
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
    return allowed[Math.floor(rnd() * allowed.length)];
  }

  function getNotes() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : [];
    } catch (e) { return []; }
  }

  /** 一次性将存量笔记的 parent_category 迁移到最新标准分类（一级大类 + 二级小类） */
  (function tryMigrateCategories() {
    var MIGRATE_KEY = 'categories_migrated_v4';
    if (localStorage.getItem(MIGRATE_KEY)) return;
    if (typeof window.migrateNotesToStandardCategories !== 'function') return;
    var result = window.migrateNotesToStandardCategories();
    if (result.ok) {
      try { localStorage.setItem(MIGRATE_KEY, '1'); } catch (e) {}
    }
  })();

  /** 从 URL 读取 justCreated，用于随机模式下的虚拟置顶（新手保护期）；读后清除 URL 参数 */
  var justCreatedCardId = '';
  (function () {
    var search = location.search || '';
    var match = search.slice(1).split('&').find(function (p) { return p.indexOf('justCreated=') === 0; });
    if (match) {
      justCreatedCardId = decodeURIComponent(match.split('=')[1] || '').trim();
      var rest = search.slice(1).split('&').filter(function (p) { return p.indexOf('justCreated=') !== 0; });
      var newSearch = rest.length ? '?' + rest.join('&') : '';
      if (typeof history.replaceState === 'function') history.replaceState(null, '', location.pathname + newSearch + location.hash);
    }
  })();

  /** 从卡片 id 解析创建时间戳（id 格式 n_<timestamp>_<random>） */
  function getCreatedTs(note) {
    if (!note || !note.id) return 0;
    var parts = String(note.id).split('_');
    if (parts[0] === 'n' && parts[1]) return parseInt(parts[1], 10) || 0;
    return 0;
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
        // 使用真实 AI 解析；解析完成后自动触发金句提炼，金句作为标题，原文标题兜底
        window.parseLinkWithAI(url)
          .then(function (result) {
            var summary = (result && typeof result === 'object' && result.summary) ? result.summary : (typeof result === 'string' ? result : '');
            var sourceTitle = (result && typeof result === 'object' && result.title) ? String(result.title).trim() : '';
            var body = '【AI 解析结果】\n\n' + summary + '\n\n---\n\n你可以在下方补充自己的感悟，或使用「AI 生成大纲」「AI 提炼核心」进行进一步加工。';
            var goldenPromise = (typeof window.generateCoreInsight === 'function' && summary && summary.length > 20)
              ? window.generateCoreInsight(summary).then(function (s) { return (s && String(s).trim()) || sourceTitle; }, function () { return sourceTitle; })
              : Promise.resolve(sourceTitle);
            return goldenPromise.then(function (title) {
              var titleToUse = title || sourceTitle;
              linkLoader.classList.remove('show');
              parseBtn.disabled = false;
              modalLink.classList.remove('open');
              var q = 'mode=link&body=' + encodeURIComponent(body) + '&sourceUrl=' + encodeURIComponent(url);
              if (sourceTitle) q += '&sourceTitle=' + encodeURIComponent(sourceTitle);
              q += '&title=' + encodeURIComponent(titleToUse);
              if (result && typeof result === 'object' && result.category) q += '&category=' + encodeURIComponent(result.category);
              if (result && typeof result === 'object' && Array.isArray(result.tags) && result.tags.length) q += '&tags=' + encodeURIComponent(result.tags.join(','));
              location.href = 'edit.html?' + q;
            });
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
          var q = 'mode=link&body=' + encodeURIComponent(mockBody) + '&sourceUrl=' + encodeURIComponent(url) + '&title=' + encodeURIComponent('链接解析示例');
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

  function finishUpload(text, opts) {
    opts = opts || {};
    uploadProgress.classList.add('show');
    uploadBar.style.width = '100%';
    setTimeout(function () {
      modalDoc.classList.remove('open');
      uploadProgress.classList.remove('show');
      uploadBar.style.width = '0%';
      var q = 'mode=doc&body=' + encodeURIComponent(text);
      if (opts.sourceUrl) q += '&sourceUrl=' + encodeURIComponent(opts.sourceUrl);
      if (opts.sourceTitle) q += '&sourceTitle=' + encodeURIComponent(opts.sourceTitle);
      if (opts.sourceType) q += '&sourceType=' + encodeURIComponent(opts.sourceType);
      if (opts.category) q += '&category=' + encodeURIComponent(opts.category);
      if (opts.tags && opts.tags.length) q += '&tags=' + encodeURIComponent(opts.tags.join(','));
      if (opts.title) q += '&title=' + encodeURIComponent(opts.title);
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
    var file = files[0];
    uploadProgress.classList.add('show');
    uploadBar.style.width = '20%';
    var form = new FormData();
    form.append('file', file);
    fetch('/api/parse-doc', { method: 'POST', body: form })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = {};
          try { data = JSON.parse(text); } catch (e) { data = { error: text || ('HTTP ' + res.status) }; }
          if (!res.ok) {
            var msg = (data.error && data.error.trim()) ? data.error : ('解析服务返回 ' + res.status);
            throw new Error(msg);
          }
          return data;
        });
      })
      .then(function (data) {
        uploadBar.style.width = '50%';
        if (data.error && !data.text) {
          uploadProgress.classList.remove('show');
          uploadBar.style.width = '0%';
          toast(data.error || '解析失败');
          return;
        }
        var text = (data.text || '').trim();
        if (!text) {
          uploadProgress.classList.remove('show');
          uploadBar.style.width = '0%';
          toast('未能从文件中提取到正文');
          return;
        }
        var fileName = file.name || '文档';
        var firstLine = text.trim().split('\n')[0].trim().slice(0, 80) || fileName;
        function doFinish(aiText, fileUrl, category, tags) {
          var opts = { sourceTitle: fileName, sourceType: 'file', title: firstLine };
          if (fileUrl) opts.sourceUrl = fileUrl;
          if (category) opts.category = category;
          if (tags && tags.length) opts.tags = tags.slice(0, 3);
          finishUpload(aiText, opts);
        }
        uploadBar.style.width = '70%';
        var fileUrlPromise = uploadDocToSupabase(file);
        var catTagsPromise = (typeof window.generateTagsAndParentCategory === 'function' && text.length >= 10)
          ? window.generateTagsAndParentCategory(text)
          : Promise.resolve({ parent_category: '其他', tags: [] });
        Promise.all([fileUrlPromise, catTagsPromise]).then(function (results) {
          var fileUrl = results[0];
          var catResult = results[1] || {};
          var category = (catResult.parent_category && String(catResult.parent_category).trim()) || '其他';
          var tags = Array.isArray(catResult.tags) ? catResult.tags.slice(0, 3) : [];
          if (typeof window.structureContentWithAI === 'function' && text.length >= 50) {
            window.structureContentWithAI(text)
              .then(function (aiText) { doFinish(aiText, fileUrl, category, tags); })
              .catch(function () { doFinish(text, fileUrl, category, tags); });
          } else {
            doFinish(text, fileUrl, category, tags);
          }
        });
      })
      .catch(function (err) {
        uploadProgress.classList.remove('show');
        uploadBar.style.width = '0%';
        var msg = (err && err.message) ? err.message : '解析服务不可用：本地请运行 server.py，线上请确认已部署 api/parse-doc 并执行 npm install';
        toast(msg);
      });
  }

  /** 上传文件到 Supabase Storage，返回 publicUrl；失败返回 null */
  function uploadDocToSupabase(file) {
    var supabase = window.Auth && typeof window.Auth.getSupabase === 'function' ? window.Auth.getSupabase() : null;
    if (!supabase) return Promise.resolve(null);
    var bucket = 'documents';
    var userId = window.Auth && window.Auth.getUserId ? window.Auth.getUserId() : 'anon';
    var safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    var path = (userId || 'anon') + '/' + Date.now() + '_' + safeName;
    return supabase.storage.from(bucket).upload(path, file, { upsert: false })
      .then(function (res) {
        if (res.error) return null;
        return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      })
      .catch(function () { return null; });
  }

  if (cancelDoc) cancelDoc.addEventListener('click', function () { modalDoc.classList.remove('open'); });
  if (modalDoc) modalDoc.addEventListener('click', function (e) { if (e.target === modalDoc) modalDoc.classList.remove('open'); });

  // ——— 展示切换：随机展示 / 按日期 / 按分类展示 ———
  var sortBtns = document.querySelectorAll('.sort-btn');
  var viewMode = 'random'; // 默认随机展示
  var cardsView = document.getElementById('cardsView');
  var constellationWrap = document.getElementById('constellationWrap');
  var constellationInner = document.getElementById('constellationInner');
  var cardsEmpty = document.getElementById('cardsEmpty');
  sortBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var newMode = b.getAttribute('data-sort') || 'random';
      /* 再次点击随机展示：清空已存顺序与 seed，使本次渲染重新洗牌并允许颜色变化 */
      if (newMode === 'random' && viewMode === 'random') {
        try {
          sessionStorage.removeItem(SESSION_CARD_IDS_KEY);
          sessionStorage.removeItem(SESSION_SEED_KEY);
        } catch (e) {}
      }
      sortBtns.forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      viewMode = newMode;
      if (cardsView) {
        cardsView.classList.toggle('view-by-category', viewMode === 'category');
        cardsView.classList.toggle('view-random', viewMode === 'random');
      }
      renderCards();
    });
  });
  // 初始化：设置随机展示按钮为 active（默认模式）
  var randomBtn = Array.from(sortBtns).find(function (b) { return b.getAttribute('data-sort') === 'random'; });
  if (randomBtn) {
    randomBtn.classList.add('active');
    // 移除其他按钮的 active
    sortBtns.forEach(function (b) {
      if (b !== randomBtn) b.classList.remove('active');
    });
  }
  if (cardsView) {
    cardsView.classList.add('view-random');
  }

  // ——— 视图切换：卡片 / 星空图谱 ———
  var currentViewMode = 'card';
  var viewToggleBtns = document.querySelectorAll('.view-toggle-btn');
  function setViewMode(mode) {
    currentViewMode = mode;
    viewToggleBtns.forEach(function (btn) {
      var v = btn.getAttribute('data-view');
      btn.classList.toggle('active', v === mode);
    });
    if (cardsView) cardsView.style.display = mode === 'card' ? '' : 'none';
    if (constellationWrap) constellationWrap.style.display = mode === 'graph' ? 'block' : 'none';
    if (cardsEmpty) cardsEmpty.style.display = 'none';
    if (mode === 'card') {
      renderCards();
    } else if (mode === 'graph' && constellationInner && typeof window.ConstellationView !== 'undefined') {
      /* 延迟一帧再渲染，确保 display:block 后容器已完成布局，避免 clientWidth 为 0 导致白屏 */
      requestAnimationFrame(function () {
        if (currentViewMode !== 'graph') return;
        window.ConstellationView.render(constellationInner, getNotes());
      });
    }
  }
  viewToggleBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var view = btn.getAttribute('data-view') || 'card';
      setViewMode(view);
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
    var sourceType = (n.sourceType || 'link').toLowerCase();
    var isFileSource = sourceType === 'file';
    var footerSourceHtml = '';
    if (sourceUrl) {
      var cardSourceTitle = isFileSource ? '点击预览原文件' : escapeAttr(sourceUrl);
      var dataAttrs = isFileSource ? ' data-source-type="file" data-source-url="' + escapeAttr(sourceUrl) + '" data-source-title="' + escapeAttr(sourceDisplay) + '"' : '';
      footerSourceHtml = '<a class="card-source" href="' + escapeAttr(sourceUrl) + '" target="_blank" rel="noopener" title="' + cardSourceTitle + '"' + dataAttrs + '>【' + escapeHtml(sourceDisplay) + '】</a>';
    } else if (isFileSource && sourceDisplay) {
      footerSourceHtml = '<span class="card-source card-source-plain">【' + escapeHtml(sourceDisplay) + '】</span>';
    }

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
      var sourceLink = e.target.closest('.card-source');
      if (sourceLink && sourceLink.closest('.card-source-wrap')) {
        if (sourceLink.getAttribute('data-source-type') === 'file' && typeof window.openFilePreview === 'function') {
          e.preventDefault();
          e.stopPropagation();
          window.openFilePreview(sourceLink.getAttribute('data-source-url'), sourceLink.getAttribute('data-source-title'));
        }
        return;
      }
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

  // ——— 卡片渲染（随机展示 / 按日期 / 按分类展示） ———
  function renderCards() {
    var list = getNotes();
    var empty = document.getElementById('cardsEmpty');
    var viewEl = document.getElementById('cardsView');
    if (!viewEl) return;

    if (list.length === 0) {
      var gridClass = viewMode === 'random' ? 'cards-grid-random' : (viewMode === 'category' ? 'cards-grid-category' : 'cards-grid-date');
      viewEl.innerHTML = '<div class="cards-grid ' + gridClass + '" id="cardsGrid"></div>';
      if (empty) empty.style.display = currentViewMode === 'card' ? 'block' : 'none';
      if (currentViewMode === 'graph' && constellationInner && window.ConstellationView) {
        window.ConstellationView.render(constellationInner, list);
      }
      return;
    }
    if (empty) empty.style.display = 'none';

    var shuffledTints = shuffleTints();
    if (viewMode === 'random') {
      var storedIdsRaw = null;
      var storedSeedRaw = null;
      try {
        storedIdsRaw = sessionStorage.getItem(SESSION_CARD_IDS_KEY);
        storedSeedRaw = sessionStorage.getItem(SESSION_SEED_KEY);
      } catch (e) {}
      var storedIds = (storedIdsRaw && (function () {
        try { return JSON.parse(storedIdsRaw); } catch (e) { return null; }
      })());
      var seed = (storedSeedRaw !== null && storedSeedRaw !== '') ? (parseInt(storedSeedRaw, 10) || Date.now()) : null;
      var idToNote = {};
      list.forEach(function (n) { idToNote[n.id] = n; });
      var finalOrder = [];
      var orderIds = [];
      if (justCreatedCardId) {
        /* 新卡片例外：unshift 到已排序序列最前面，不打乱 */
        if (storedIds && Array.isArray(storedIds)) {
          orderIds = [justCreatedCardId].concat(storedIds.filter(function (id) { return id !== justCreatedCardId; }));
        } else {
          orderIds = [justCreatedCardId].concat(list.filter(function (n) { return n.id !== justCreatedCardId; }).map(function (n) { return n.id; }));
        }
        try { sessionStorage.setItem(SESSION_CARD_IDS_KEY, JSON.stringify(orderIds)); } catch (e) {}
        if (seed == null) {
          seed = Date.now();
          try { sessionStorage.setItem(SESSION_SEED_KEY, String(seed)); } catch (e) {}
        }
      } else if (storedIds && Array.isArray(storedIds) && storedIds.length > 0) {
        /* 路由回退：直接使用 session 中的顺序，严禁重新打乱 */
        orderIds = storedIds.slice();
        if (seed == null) {
          seed = Date.now();
          try { sessionStorage.setItem(SESSION_SEED_KEY, String(seed)); } catch (e) {}
        }
      } else {
        /* 冷启动/手动刷新：重新生成随机顺序并存入 sessionStorage */
        var listIds = list.map(function (n) { return n.id; });
        if (seed == null) {
          seed = Date.now();
          try { sessionStorage.setItem(SESSION_SEED_KEY, String(seed)); } catch (e) {}
        }
        orderIds = shuffleWithRandom(listIds, createSeededRandom(seed));
        try { sessionStorage.setItem(SESSION_CARD_IDS_KEY, JSON.stringify(orderIds)); } catch (e) {}
      }
      for (var oi = 0; oi < orderIds.length; oi++) {
        var note = idToNote[orderIds[oi]];
        if (note) finalOrder.push(note);
      }
      var notInOrder = list.filter(function (n) { return orderIds.indexOf(n.id) === -1; });
      finalOrder = finalOrder.concat(notInOrder);
      shuffledTints = (seed != null) ? shuffleTintsWithSeed(seed) : shuffleTints();
      var seededRnd = (seed != null) ? createSeededRandom(seed + 1) : null;
      var assigned = [];
      for (var idx = 0; idx < finalOrder.length; idx++) {
        assigned[idx] = getNextDiverseColor(assigned, idx, finalOrder.length, GRID_COLUMNS, shuffledTints, seededRnd);
      }
      viewEl.innerHTML = '<div class="cards-grid cards-grid-random" id="cardsGrid"></div>';
      var grid = document.getElementById('cardsGrid');
      finalOrder.forEach(function (n, index) {
        try {
          var data = buildCardElement(n, index, index, assigned[index]);
          grid.appendChild(data.card);
          bindCardActions(data.card, data);
        } catch (err) {
          console.error('渲染卡片出错:', err, n);
        }
      });
    } else if (viewMode === 'category') {
      var byCategory = {};
      var normalizeCat = (typeof window.normalizeParentCategory === 'function') ? window.normalizeParentCategory : function (v) { return (v && String(v).trim()) || '其他'; };
      list.forEach(function (n) {
        var parent = normalizeCat(n.parent_category);
        if (!byCategory[parent]) byCategory[parent] = [];
        byCategory[parent].push(n);
      });
      var categories = Object.keys(byCategory).sort(function (a, b) {
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
        items.forEach(function (n, i) {
          var data = buildCardElement(n, i, gridIndex++, stableBgIndexForNote(n.id));
          grid.appendChild(data.card);
          bindCardActions(data.card, data);
        });
        viewEl.appendChild(section);
      });
    } else {
      // 按日期展示模式：时间倒序（越近越靠前），卡片颜色按 note.id 稳定不变
      var sorted = list.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      viewEl.innerHTML = '<div class="cards-grid cards-grid-date" id="cardsGrid"></div>';
      var grid = document.getElementById('cardsGrid');
      sorted.forEach(function (n, index) {
        try {
          var data = buildCardElement(n, index, index, stableBgIndexForNote(n.id));
          grid.appendChild(data.card);
          bindCardActions(data.card, data);
        } catch (err) {
          console.error('渲染卡片出错:', err, n);
        }
      });
    }
    if (currentViewMode === 'graph' && constellationInner && window.ConstellationView) {
      window.ConstellationView.render(constellationInner, getNotes());
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
