/**
 * FilePreview 组件：点击文上传来源链接时弹出 Modal，PDF 内置渲染，Word 用 Office Viewer
 */
(function () {
  'use strict';

  var modal = null;
  var iframe = null;
  var titleEl = null;
  var fallbackEl = null;

  function ensureModal() {
    if (modal) return modal;
    modal = document.getElementById('filePreviewModal');
    if (modal) {
      iframe = document.getElementById('filePreviewIframe');
      titleEl = document.getElementById('filePreviewTitle');
      fallbackEl = document.getElementById('filePreviewFallback');
    }
    return modal;
  }

  function getExt(filename) {
    if (!filename || typeof filename !== 'string') return '';
    var i = filename.lastIndexOf('.');
    return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
  }

  /**
   * 打开文件预览弹窗
   * @param {string} url - 文件公网 URL（如 Supabase Storage public URL）
   * @param {string} filename - 文件名，用于判断类型和显示标题
   */
  function openFilePreview(url, filename) {
    if (!url || !url.trim()) return;
    var el = ensureModal();
    if (!el) return;
    var ext = getExt(filename || '');
    var displayName = (filename || url).trim() || '原文件';

    if (titleEl) titleEl.textContent = displayName;
    if (iframe) {
      iframe.style.display = 'none';
      iframe.removeAttribute('src');
    }
    if (fallbackEl) {
      fallbackEl.style.display = 'none';
      fallbackEl.innerHTML = '';
    }

    if (ext === 'pdf') {
      if (iframe) {
        iframe.style.display = 'block';
        iframe.src = url;
      }
    } else if (ext === 'doc' || ext === 'docx') {
      var officeUrl = 'https://view.officeapps.live.com/op/view.aspx?src=' + encodeURIComponent(url);
      if (iframe) {
        iframe.style.display = 'block';
        iframe.src = officeUrl;
      }
    } else {
      if (fallbackEl) {
        fallbackEl.style.display = 'block';
        fallbackEl.innerHTML = '<p class="file-preview-fallback-msg">当前格式不支持在线预览</p><a class="file-preview-download" href="' + escapeHtmlAttr(url) + '" target="_blank" rel="noopener">下载原文件</a>';
      }
    }

    el.classList.add('open');
  }

  function closeFilePreview() {
    var el = ensureModal();
    if (!el) return;
    el.classList.remove('open');
    if (iframe) {
      iframe.removeAttribute('src');
      iframe.style.display = 'none';
    }
  }

  function escapeHtmlAttr(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  window.openFilePreview = openFilePreview;
  window.closeFilePreview = closeFilePreview;

  document.addEventListener('DOMContentLoaded', function () {
    ensureModal();
    var btn = document.getElementById('filePreviewClose');
    if (btn) btn.addEventListener('click', closeFilePreview);
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeFilePreview();
      });
    }
  });
})();
