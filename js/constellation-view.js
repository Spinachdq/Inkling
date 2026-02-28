/**
 * 星空知识图谱视图：D3 力导向图，节点=笔记，边=共享标签。
 * 纯原生 JS + D3（CDN），无 React。
 */
(function () {
  'use strict';

  var TINT_NAMES = ['rose', 'sky', 'sage', 'amber', 'plum'];
  var TINT_COLORS = {
    rose: { glow: 'hsl(10, 40%, 65%)', fill: 'hsl(10, 40%, 55%)', text: 'hsl(10, 40%, 90%)' },
    sky: { glow: 'hsl(205, 35%, 68%)', fill: 'hsl(205, 35%, 55%)', text: 'hsl(205, 35%, 90%)' },
    sage: { glow: 'hsl(140, 20%, 58%)', fill: 'hsl(140, 20%, 48%)', text: 'hsl(140, 20%, 88%)' },
    amber: { glow: 'hsl(38, 70%, 60%)', fill: 'hsl(38, 60%, 50%)', text: 'hsl(38, 60%, 90%)' },
    plum: { glow: 'hsl(330, 25%, 58%)', fill: 'hsl(330, 25%, 48%)', text: 'hsl(330, 25%, 90%)' }
  };

  function hashIdToTint(id) {
    var h = 0;
    var s = String(id);
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
    return TINT_NAMES[Math.abs(h) % TINT_NAMES.length];
  }

  function getContent(note) {
    return (note.core || note.body || note.title || '').trim() || '无标题';
  }

  /**
   * 分类得分 S_cat（三阶）：同二级小类=1.0，同一级大类=0.5，否则=0
   * 依赖 window.SUB_TO_PARENT（二级小类 -> 一级大类）
   */
  function categoryScore(catA, catB) {
    var sa = String(catA || '').trim();
    var sb = String(catB || '').trim();
    if (!sa || !sb || sa === '其他' || sb === '其他') return 0;
    if (sa === sb) return 1.0;
    var subToParent = (typeof window !== 'undefined' && window.SUB_TO_PARENT) ? window.SUB_TO_PARENT : {};
    var parentA = subToParent[sa];
    var parentB = subToParent[sb];
    if (parentA && parentB && parentA === parentB) return 0.5;
    return 0;
  }

  /** 中文 bigram 集合（相邻两字），用于近似语义相似 */
  function bigrams(s) {
    var str = String(s || '').trim();
    var set = {};
    for (var i = 0; i < str.length - 1; i++) {
      set[str.slice(i, i + 2)] = true;
    }
    return set;
  }

  /** 单字集合 */
  function chars(s) {
    var str = String(s || '').trim();
    var set = {};
    for (var i = 0; i < str.length; i++) {
      set[str[i]] = true;
    }
    return set;
  }

  /** Jaccard 相似度 |A cap B| / |A cup B| */
  function jaccard(keysA, keysB) {
    var inter = 0;
    for (var k in keysA) {
      if (keysB[k]) inter++;
    }
    var union = 0;
    var seen = {};
    for (var k in keysA) { if (!seen[k]) { seen[k] = true; union++; } }
    for (var k in keysB) { if (!seen[k]) { seen[k] = true; union++; } }
    return union === 0 ? 0 : inter / union;
  }

  /**
   * 标签语义相似度 0~1（纯前端，无 Embedding）：
   * 完全相同=1，包含关系=0.9，否则用 bigram+单字 Jaccard 近似（如「医疗系统能力」与「医疗旅游」共享「医疗」）
   */
  function tagSimilarityScore(ta, tb) {
    var sa = String(ta || '').trim();
    var sb = String(tb || '').trim();
    if (!sa || !sb) return 0;
    if (sa === sb) return 1;
    if (sa.indexOf(sb) !== -1 || sb.indexOf(sa) !== -1) return 0.9;
    var bgA = bigrams(sa);
    var bgB = bigrams(sb);
    var chA = chars(sa);
    var chB = chars(sb);
    var jaccardBg = jaccard(bgA, bgB);
    var jaccardCh = jaccard(chA, chB);
    return Math.min(1, jaccardBg * 1.2 + jaccardCh * 0.5);
  }

  /**
   * 综合权重 W = S_cat * 0.8 + S_tag * 0.2；仅 W >= 0.15 连线
   * 同宗同源 W>=0.8 / 同门师兄 0.4~0.8 / 跨界邂逅 0.15~0.4
   */
  function buildGraph(notes) {
    var nodes = notes.map(function (note) {
      var content = getContent(note);
      var len = content.length;
      var id = note.id == null ? '' : String(note.id);
      return {
        id: id,
        note: note,
        radius: Math.min(8 + len / 20, 18),
        tint: hashIdToTint(id)
      };
    });
    var links = [];
    var normalizeCat = (typeof window.normalizeParentCategory === 'function') ? window.normalizeParentCategory : function (v) { return (v && String(v).trim()) || ''; };
    for (var i = 0; i < notes.length; i++) {
      for (var j = i + 1; j < notes.length; j++) {
        var catA = normalizeCat(notes[i].parent_category);
        var catB = normalizeCat(notes[j].parent_category);
        var sCat = categoryScore(catA, catB);

        var a = (notes[i].tags || []).filter(function (t) {
          return t && String(t).trim() !== '' && String(t) !== '未分类';
        });
        var b = (notes[j].tags || []).filter(function (t) {
          return t && String(t).trim() !== '' && String(t) !== '未分类';
        });
        var tagScore = 0;
        var bestPair = null;
        for (var ai = 0; ai < a.length; ai++) {
          for (var bi = 0; bi < b.length; bi++) {
            var sim = tagSimilarityScore(a[ai], b[bi]);
            if (sim > tagScore) {
              tagScore = sim;
              bestPair = { ta: a[ai], tb: b[bi] };
            }
          }
        }
        var weighted = (sCat * 0.8) + (tagScore * 0.2);
        if (weighted < 0.15) continue;

        var srcId = notes[i].id == null ? '' : String(notes[i].id);
        var tgtId = notes[j].id == null ? '' : String(notes[j].id);
        if (!srcId || !tgtId) continue;

        var sharedLabels = [];
        if (sCat >= 0.5) sharedLabels.push('\u3010' + (catA || catB) + '\u3011');
        if (bestPair && bestPair.ta !== bestPair.tb) {
          sharedLabels.push(bestPair.ta + '\u2248' + bestPair.tb);
        } else if (bestPair) {
          sharedLabels.push(bestPair.ta);
        }
        var strength = Math.max(0.5, Math.min(weighted * 2.5, 4));
        links.push({
          source: srcId,
          target: tgtId,
          weighted: weighted,
          sharedTags: sharedLabels,
          strength: strength
        });
      }
    }
    return { nodes: nodes, links: links };
  }

  function render(containerEl, notes) {
    if (!containerEl || !window.d3) return;
    var d3 = window.d3;
    containerEl.innerHTML = '';
    /* 只使用带 id 的笔记，避免 forceLink 无法解析导致节点/连线不显示 */
    notes = (notes || []).filter(function (n) { return n && (n.id != null && n.id !== ''); });
    if (notes.length === 0) {
      containerEl.classList.add('constellation-empty');
      containerEl.innerHTML = '<p>暂无笔记，无法生成图谱。<br>点击上方功能键开始记录吧</p>';
      return;
    }
    containerEl.classList.remove('constellation-empty');

    var wrap = containerEl.closest('.constellation-wrap');
    var wrapWidth = wrap && wrap.clientWidth ? wrap.clientWidth : 0;
    var width = containerEl.clientWidth || wrapWidth || 800;
    var height = Math.max(560, (wrap && wrap.clientHeight ? wrap.clientHeight : 0) || window.innerHeight - 280);
    if (width <= 0) width = 800;
    if (height <= 0) height = 560;

    var svg = d3.select(containerEl).append('svg').attr('width', width).attr('height', height).attr('class', 'constellation-svg').attr('display', 'block');
    var defs = svg.append('defs');

    var filter = defs.append('filter').attr('id', 'constellation-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    var merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'coloredBlur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    var bgGrad = defs.append('radialGradient').attr('id', 'constellation-bg').attr('cx', '50%').attr('cy', '50%').attr('r', '60%');
    bgGrad.append('stop').attr('offset', '0%').attr('stop-color', 'hsl(25, 15%, 22%)');
    bgGrad.append('stop').attr('offset', '100%').attr('stop-color', 'hsl(25, 12%, 14%)');

    /* 背景不参与缩放，保持固定；带 class 供双击全屏仅背景触发 */
    var bgRect = svg.append('rect').attr('class', 'constellation-bg-rect').attr('width', width).attr('height', height).attr('rx', 16).attr('fill', 'url(#constellation-bg)');

    /* 缩放层：粒子、连线、节点都放在 zoomGroup 内，支持滚轮/双指/拖拽画布 */
    var zoomGroup = svg.append('g').attr('class', 'zoom-group');
    var particleCount = 60;
    for (var i = 0; i < particleCount; i++) {
      zoomGroup.append('circle')
        .attr('cx', Math.random() * width)
        .attr('cy', Math.random() * height)
        .attr('r', Math.random() * 1.2 + 0.3)
        .attr('fill', 'hsla(35, 30%, 80%, ' + (Math.random() * 0.3 + 0.05) + ')')
        .attr('class', 'ambient-particle');
    }

    var graph = buildGraph(notes);
    var nodes = graph.nodes;
    var links = graph.links;

    /* 先给节点赋初始位置，否则力模拟首帧前 d.x/d.y 为 undefined 会导致节点不显示 */
    var cx = width / 2;
    var cy = height / 2;
    nodes.forEach(function (n, i) {
      if (n.x != null && n.y != null) return;
      var angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
      n.x = cx + Math.cos(angle) * Math.min(width, height) * 0.3;
      n.y = cy + Math.sin(angle) * Math.min(width, height) * 0.3;
    });

    var simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(function (d) { return d.id; })
        .distance(function (d) {
          var w = d.weighted != null ? d.weighted : 0.5;
          if (w >= 0.8) return 150;   /* 同宗同源 */
          if (w >= 0.4) return 330;   /* 同门师兄（与 50→150 同倍数） */
          return 675;                 /* 跨界邂逅 */
        })
        .strength(function (d) { return 0.3 + (d.strength || 1) * 0.15; }))
      .force('charge', d3.forceManyBody().strength(-550))
      .force('center', d3.forceCenter(cx, cy))
      .force('collision', d3.forceCollide().radius(function (d) { return d.radius + 32; }))
      .force('x', d3.forceX(cx).strength(0.04))
      .force('y', d3.forceY(cy).strength(0.04));

    var linkGroup = zoomGroup.append('g').attr('class', 'links');
    var linkEls = linkGroup.selectAll('line').data(links).enter().append('line')
      .attr('stroke', function (d) {
        var w = d.weighted != null ? d.weighted : 0.5;
        if (w >= 0.4) return 'hsla(35, 22%, 58%, 0.35)';
        return 'hsla(35, 20%, 50%, 0.1)';
      })
      .attr('stroke-width', function (d) {
        var w = d.weighted != null ? d.weighted : 0.5;
        if (w >= 0.4) return 1 + (d.strength || 1) * 0.4;
        return 0.6;
      })
      .attr('stroke-dasharray', function (d) {
        var w = d.weighted != null ? d.weighted : 0.5;
        return w >= 0.4 ? 'none' : '5 8';
      })
      .attr('stroke-linecap', 'round');
    var linkSel = linkGroup.selectAll('line');

    var nodeGroup = zoomGroup.append('g').attr('class', 'nodes');
    var nodeEls = nodeGroup.selectAll('g').data(nodes).enter().append('g')
      .attr('class', 'constellation-node')
      .attr('cursor', 'pointer')
      .attr('transform', function (d) { return 'translate(' + (Number(d.x) || cx) + ',' + (Number(d.y) || cy) + ')'; });

    nodeEls.append('circle')
      .attr('r', function (d) { return d.radius + 6; })
      .attr('fill', function (d) {
        var c = TINT_COLORS[d.tint];
        var glow = c && c.glow ? c.glow : 'hsl(0,0%,50%)';
        return glow.replace(/\)$/, ', 0.15)').replace(/^hsl/, 'hsla');
      })
      .attr('filter', 'url(#constellation-glow)');
    nodeEls.append('circle')
      .attr('r', function (d) { return d.radius; })
      .attr('fill', function (d) { return (TINT_COLORS[d.tint] || TINT_COLORS.sage).fill; })
      .attr('stroke', function (d) { return (TINT_COLORS[d.tint] || TINT_COLORS.sage).glow; })
      .attr('stroke-width', 1.5)
      .attr('class', 'node-main');
    nodeEls.append('circle')
      .attr('r', function (d) { return d.radius * 0.4; })
      .attr('fill', function (d) {
        var c = TINT_COLORS[d.tint] || TINT_COLORS.sage;
        var txt = c && c.text ? c.text : 'hsl(0,0%,90%)';
        return txt.replace(/\)$/, ', 0.4)').replace(/^hsl/, 'hsla');
      })
      .attr('cy', function (d) { return -d.radius * 0.15; });
    nodeEls.append('text')
      .text(function (d) {
        var content = getContent(d.note);
        return content.length > 8 ? content.slice(0, 8) + '…' : content;
      })
      .attr('dy', function (d) { return d.radius + 16; })
      .attr('text-anchor', 'middle')
      .attr('fill', 'hsla(35, 30%, 80%, 0.7)')
      .attr('font-size', '11px');

    var tooltip = document.createElement('div');
    tooltip.className = 'constellation-tooltip';
    tooltip.style.display = 'none';
    containerEl.style.position = 'relative';
    containerEl.appendChild(tooltip);

    /* 缩放与平移：滚轮缩放、双指捏合、拖拽画布；缩放时隐藏 tooltip */
    var zoomBehavior = d3.zoom()
      .scaleExtent([0.3, 4])
      .on('zoom', function (event) {
        zoomGroup.attr('transform', event.transform);
        tooltip.style.display = 'none';
      });
    svg.call(zoomBehavior);
    containerEl._constellationZoom = zoomBehavior;
    containerEl._constellationSvg = svg;
    containerEl._constellationSimulation = simulation;

    nodeEls
      .on('mouseenter', function (event, d) {
        d3.select(this).select('.node-main')
          .transition().duration(200)
          .attr('r', d.radius * 1.4)
          .attr('stroke-width', 2.5);
        linkSel.transition().duration(200)
          .attr('stroke', function (l) {
            var src = l.source.id || l.source;
            var tgt = l.target.id || l.target;
            return (src === d.id || tgt === d.id) ? 'hsla(18, 55%, 55%, 0.6)' : 'hsla(35, 25%, 65%, 0.08)';
          })
          .attr('stroke-width', function (l) {
            var src = l.source.id || l.source;
            var tgt = l.target.id || l.target;
            return (src === d.id || tgt === d.id) ? 1.5 + l.strength : 0.5;
          });
        var rect = containerEl.getBoundingClientRect();
        var content = getContent(d.note);
        var preview = content.length > 60 ? content.slice(0, 60) + '…' : content;
        var tags = (d.note.tags || []).slice(0, 8);
        tooltip.innerHTML = '<p class="constellation-tooltip-content">' + escapeHtml(preview) + '</p>' +
          (tags.length ? '<div class="constellation-tooltip-tags">' + tags.map(function (t) { return '<span class="constellation-tooltip-tag">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' : '') +
          '<time class="constellation-tooltip-date">' + escapeHtml(d.note.date || '') + '</time>';
        tooltip.style.left = (event.clientX - rect.left + 16) + 'px';
        tooltip.style.top = (event.clientY - rect.top - 12) + 'px';
        if (event.clientX - rect.left > width / 2) tooltip.style.transform = 'translateX(-110%)';
        else tooltip.style.transform = 'none';
        tooltip.style.display = 'block';
      })
      .on('mouseleave', function (_, d) {
        d3.select(this).select('.node-main')
          .transition().duration(300)
          .attr('r', d.radius)
          .attr('stroke-width', 1.5);
        linkSel.transition().duration(300)
          .attr('stroke', function (l) {
            var w = l.weighted != null ? l.weighted : 0.5;
            return w >= 0.4 ? 'hsla(35, 22%, 58%, 0.35)' : 'hsla(35, 20%, 50%, 0.1)';
          })
          .attr('stroke-width', function (l) {
            var w = l.weighted != null ? l.weighted : 0.5;
            return w >= 0.4 ? 1 + (l.strength || 1) * 0.4 : 0.6;
          })
          .attr('stroke-dasharray', function (l) {
            var w = l.weighted != null ? l.weighted : 0.5;
            return w >= 0.4 ? 'none' : '5 8';
          });
        tooltip.style.display = 'none';
      })
      .on('click', function (event, d) {
        event.stopPropagation();
        window.location.href = 'edit.html?id=' + encodeURIComponent(d.id);
      });

    var drag = d3.drag()
      .on('start', function (event, d) {
        if (event.sourceEvent) event.sourceEvent.stopPropagation();
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        tooltip.style.display = 'none';
      })
      .on('drag', function (event, d) {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', function (event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    nodeEls.call(drag);

    simulation.on('tick', function () {
      function nodeX(n) { return (n && typeof n.x === 'number' && Number.isFinite(n.x)) ? n.x : cx; }
      function nodeY(n) { return (n && typeof n.y === 'number' && Number.isFinite(n.y)) ? n.y : cy; }
      linkSel
        .attr('x1', function (d) { return nodeX(d.source); })
        .attr('y1', function (d) { return nodeY(d.source); })
        .attr('x2', function (d) { return nodeX(d.target); })
        .attr('y2', function (d) { return nodeY(d.target); });
      nodeEls.attr('transform', function (d) {
        var x = (typeof d.x === 'number' && Number.isFinite(d.x)) ? d.x : cx;
        var y = (typeof d.y === 'number' && Number.isFinite(d.y)) ? d.y : cy;
        return 'translate(' + x + ',' + y + ')';
      });
    });

    function escapeHtml(s) {
      if (s == null) return '';
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    /* 双击全屏：仅当双击「黑域」（非节点、非连线）时触发；点击节点只查看节点 */
    function isNodeOrLink(el) {
      if (!el) return false;
      if (typeof el.closest === 'function')
        return el.closest('.constellation-node') || el.closest('.links');
      var n = el;
      while (n) {
        if (n.classList && (n.classList.contains('constellation-node') || n.classList.contains('links'))) return true;
        if (n.tagName === 'line') return true;
        n = n.parentNode;
      }
      return false;
    }
    if (wrap) {
      svg.on('dblclick', function (event) {
        if (isNodeOrLink(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        if (document.fullscreenElement === wrap) {
          document.exitFullscreen();
        } else {
          wrap.requestFullscreen().catch(function () {});
        }
      });
      if (!wrap._constellationFullscreenHandler) {
        wrap._constellationFullscreenHandler = function () {
          var inner = wrap.querySelector('.constellation-inner');
          if (!inner || !inner._constellationSvg || !inner._constellationSimulation) return;
          var d3 = window.d3;
          var isFull = document.fullscreenElement === wrap;
          var fsBtn = wrap.querySelector('[data-zoom="fullscreen"]');
          if (fsBtn) {
            fsBtn.setAttribute('title', isFull ? '退出全屏' : '进入全屏');
            fsBtn.setAttribute('aria-label', isFull ? '退出全屏' : '进入全屏');
          }
          if (isFull) {
            var w = window.innerWidth;
            var h = window.innerHeight;
            if (w <= 0) w = 800;
            if (h <= 0) h = 560;
            var svgEl = inner._constellationSvg;
            var sim = inner._constellationSimulation;
            svgEl.attr('width', w).attr('height', h);
            svgEl.select('.constellation-bg-rect').attr('width', w).attr('height', h);
            var cx = w / 2;
            var cy = h / 2;
            sim.force('center', d3.forceCenter(cx, cy));
            sim.force('x', d3.forceX(cx).strength(0.04));
            sim.force('y', d3.forceY(cy).strength(0.04));
            sim.alphaTarget(0.12).restart();
          } else {
            /* 退出全屏：等一帧回流后恢复为 CSS 定义的容器尺寸，不保留全屏时的 window 尺寸 */
            requestAnimationFrame(function () {
              var w = inner.clientWidth || 800;
              var h = inner.clientHeight || 560;
              if (w <= 0) w = 800;
              if (h <= 0) h = 560;
              var svgEl = inner._constellationSvg;
              var sim = inner._constellationSimulation;
              svgEl.attr('width', w).attr('height', h);
              svgEl.select('.constellation-bg-rect').attr('width', w).attr('height', h);
              var cx = w / 2;
              var cy = h / 2;
              sim.force('center', d3.forceCenter(cx, cy));
              sim.force('x', d3.forceX(cx).strength(0.04));
              sim.force('y', d3.forceY(cy).strength(0.04));
              sim.restart();
            });
          }
        };
        document.addEventListener('fullscreenchange', wrap._constellationFullscreenHandler);
      }
    }

    /* 右下角三个按钮：【放大】【缩小】【进入全屏/退出全屏】；d3.zoom 已支持触控板双指缩放 */
    if (wrap && window.d3) {
      var zoomInBtn = wrap.querySelector('[data-zoom="in"]');
      var zoomOutBtn = wrap.querySelector('[data-zoom="out"]');
      var fullscreenBtn = wrap.querySelector('[data-zoom="fullscreen"]');
      var zoomIn = function () {
        svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.2);
      };
      var zoomOut = function () {
        svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.8);
      };
      var toggleFullscreen = function () {
        if (document.fullscreenElement === wrap) {
          document.exitFullscreen();
        } else {
          wrap.requestFullscreen().catch(function () {});
        }
      };
      if (zoomInBtn) zoomInBtn.onclick = zoomIn;
      if (zoomOutBtn) zoomOutBtn.onclick = zoomOut;
      if (fullscreenBtn) fullscreenBtn.onclick = toggleFullscreen;
    }

    /* 初始视口 Zoom to Fit：切换进星空视图时立即用当前节点边界做一次适配；simulation 稳定后再微调一次 */
    var zoomToFitPadding = 80;
    function applyZoomToFit() {
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      nodes.forEach(function (n) {
        var x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : cx;
        var y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : cy;
        var r = (n.radius || 10) + 10;
        if (x - r < minX) minX = x - r;
        if (x + r > maxX) maxX = x + r;
        if (y - r < minY) minY = y - r;
        if (y + r > maxY) maxY = y + r;
      });
      var W_content = maxX - minX;
      var H_content = maxY - minY;
      if (W_content <= 0) W_content = width;
      if (H_content <= 0) H_content = height;
      var W_view = width;
      var H_view = height;
      var S = Math.min(
        W_view / (W_content + zoomToFitPadding),
        H_view / (H_content + zoomToFitPadding)
      );
      S = Math.max(0.1, Math.min(4, S));
      var cxContent = (minX + maxX) / 2;
      var cyContent = (minY + maxY) / 2;
      var tx = W_view / 2 - S * cxContent;
      var ty = H_view / 2 - S * cyContent;
      var initialTransform = d3.zoomIdentity.translate(tx, ty).scale(S);
      var duration = arguments[0] === true ? 0 : 600;
      svg.transition().duration(duration).ease(d3.easeCubicInOut).call(zoomBehavior.transform, initialTransform);
    }
    /* 刚进入星空视图：用初始圆形布局立即适配，无动画瞬间到位 */
    applyZoomToFit(true);
    /* 力导向稳定后再适配一次，使最终星团形状也完整入框 */
    simulation.on('end', function () {
      setTimeout(function () { applyZoomToFit(false); }, 50);
    });
  }

  window.ConstellationView = { render: render };
})();
