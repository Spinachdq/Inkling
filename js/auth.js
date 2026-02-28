/**
 * 鉴权模块（Supabase）：登录弹窗、requireLogin 钩子、用户菜单
 * 未配置 supabase 时视为无鉴权，isLoggedIn() 恒为 true，不拦截保存与 AI。
 */
(function () {
  'use strict';

  var supabase = null;
  var currentUser = null;
  var pendingAction = null;
  var loginMessage = '';

  function getSupabaseConfig() {
    var c = typeof window.CONFIG !== 'undefined' && window.CONFIG ? window.CONFIG.supabase : null;
    if (!c || !c.url || !c.anonKey) return null;
    return { url: c.url, anonKey: c.anonKey };
  }

  function isAuthEnabled() {
    return !!getSupabaseConfig();
  }

  function initSupabase() {
    if (supabase !== null) return supabase;
    var config = getSupabaseConfig();
    if (!config || typeof window.supabase === 'undefined') return null;
    supabase = window.supabase.createClient(config.url, config.anonKey);
    supabase.auth.onAuthStateChange(function (_event, session) {
      currentUser = session && session.user ? session.user : null;
      if (currentUser && pendingAction) {
        var fn = pendingAction;
        pendingAction = null;
        try { fn(); } catch (e) { console.error(e); }
      }
      renderUserMenu();
    });
    supabase.auth.getSession().then(function (_ref) {
      var session = _ref.data.session;
      currentUser = session && session.user ? session.user : null;
      renderUserMenu();
    });
    return supabase;
  }

  /** 是否已登录（未配置鉴权时恒为 true，不拦截） */
  function isLoggedIn() {
    if (!isAuthEnabled()) return true;
    initSupabase();
    return !!currentUser;
  }

  /** 当前用户 id（未配置或未登录时返回空字符串） */
  function getUserId() {
    if (!isAuthEnabled() || !currentUser) return '';
    return (currentUser.id || '').toString();
  }

  function signOut() {
    if (!supabase) return Promise.resolve();
    return supabase.auth.signOut().then(function () {
      currentUser = null;
      renderUserMenu();
    });
  }

  /** 打开登录弹窗；message 显示在弹窗说明处 */
  function openLoginModal(message) {
    loginMessage = message || '登录后可永久保存笔记并同步至所有设备';
    var modal = document.getElementById('loginModal');
    var desc = document.getElementById('loginModalDesc');
    if (modal) {
      if (desc) desc.textContent = loginMessage;
      modal.classList.add('open');
    }
    showLoginView('options');
  }

  function closeLoginModal() {
    var modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('open');
    loginMessage = '';
    pendingAction = null;
  }

  /**
   * 鉴权钩子：若已登录则执行 callback，否则弹出登录框；登录成功后会自动执行 callback。
   */
  function requireLogin(callback, message) {
    if (isLoggedIn()) {
      try { callback(); } catch (e) { console.error(e); }
      return;
    }
    pendingAction = callback;
    openLoginModal(message);
  }

  function showLoginView(view) {
    var opts = document.getElementById('loginViewOptions');
    var form = document.getElementById('loginViewEmail');
    if (opts) opts.style.display = view === 'options' ? 'block' : 'none';
    if (form) form.style.display = view === 'email' ? 'block' : 'none';
  }

  function bindLoginModal() {
    var modal = document.getElementById('loginModal');
    if (!modal) return;

    modal.querySelectorAll('[data-login-close]').forEach(function (btn) {
      btn.addEventListener('click', closeLoginModal);
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeLoginModal();
    });

    var btnGoogle = document.getElementById('loginBtnGoogle');
    if (btnGoogle) {
      btnGoogle.addEventListener('click', function () {
        if (!isAuthEnabled()) {
          if (typeof window.toast === 'function') window.toast('未配置登录，请在 config.js 中填写 supabase');
          return;
        }
        initSupabase();
        btnGoogle.disabled = true;
        supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + (window.location.pathname || '') } })
          .then(function (r) {
            if (r.data && r.data.url) window.location.href = r.data.url;
          })
          .catch(function (err) {
            if (typeof window.toast === 'function') window.toast('登录失败：' + (err.message || '请稍后重试'));
          })
          .then(function () { btnGoogle.disabled = false; });
      });
    }

    var btnEmail = document.getElementById('loginBtnEmail');
    if (btnEmail) {
      btnEmail.addEventListener('click', function () { showLoginView('email'); });
    }

    var backLink = document.getElementById('loginBackToOptions');
    if (backLink) {
      backLink.addEventListener('click', function (e) { e.preventDefault(); showLoginView('options'); });
    }

    var formEl = document.getElementById('loginEmailForm');
    if (formEl) {
      formEl.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = (document.getElementById('loginEmailInput') && document.getElementById('loginEmailInput').value) || '';
        var password = (document.getElementById('loginPasswordInput') && document.getElementById('loginPasswordInput').value) || '';
        var isSignup = document.getElementById('loginFormSubmit') && document.getElementById('loginFormSubmit').getAttribute('data-mode') === 'signup';
        if (!email || !password) return;
        if (!isAuthEnabled() || !supabase) return;
        var btn = document.getElementById('loginFormSubmit');
        if (btn) btn.disabled = true;
        var fn = isSignup ? supabase.auth.signUp({ email: email, password: password, options: { emailRedirectTo: window.location.origin } })
          : supabase.auth.signInWithPassword({ email: email, password: password });
        fn.then(function (res) {
          if (res.error) throw res.error;
          closeLoginModal();
          if (typeof window.toast === 'function') window.toast(isSignup ? '请查收邮件完成验证' : '登录成功');
        }).catch(function (err) {
          if (typeof window.toast === 'function') window.toast((err && err.message) || '登录失败');
        }).then(function () { if (btn) btn.disabled = false; });
      });
    }

    var toggleSignup = document.getElementById('loginToggleSignup');
    var toggleHint = document.getElementById('loginToggleHint');
    if (toggleSignup) {
      toggleSignup.addEventListener('click', function (e) {
        e.preventDefault();
        var submitBtn = document.getElementById('loginFormSubmit');
        if (!submitBtn) return;
        if (submitBtn.getAttribute('data-mode') === 'signup') {
          submitBtn.setAttribute('data-mode', 'login');
          submitBtn.textContent = '登录';
          if (toggleHint) toggleHint.textContent = '还没有账号？';
          toggleSignup.textContent = '注册';
        } else {
          submitBtn.setAttribute('data-mode', 'signup');
          submitBtn.textContent = '注册';
          if (toggleHint) toggleHint.textContent = '已有账号？';
          toggleSignup.textContent = '登录';
        }
      });
    }
  }

  function renderUserMenu() {
    var container = document.getElementById('userMenuContainer');
    var topBar = container && container.closest('.top-bar');
    if (!container) return;
    if (!isAuthEnabled()) {
      container.innerHTML = '';
      if (topBar) topBar.classList.add('top-bar-hidden');
      return;
    }
    if (topBar) topBar.classList.remove('top-bar-hidden');
    if (currentUser) {
      var avatar = (currentUser.user_metadata && (currentUser.user_metadata.avatar_url || currentUser.user_metadata.picture)) || '';
      var name = (currentUser.user_metadata && (currentUser.user_metadata.full_name || currentUser.user_metadata.name)) || (currentUser.email && currentUser.email.split('@')[0]) || '用户';
      container.innerHTML =
        '<div class="user-menu-trigger" id="userMenuTrigger" title="' + (name || '') + '">' +
          (avatar ? '<img src="' + avatar + '" alt="" class="user-menu-avatar"/>' : '<span class="user-menu-avatar user-menu-avatar-letter">' + (name.charAt(0) || '?') + '</span>') +
        '</div>' +
        '<div class="user-menu-dropdown" id="userMenuDropdown">' +
          '<div class="user-menu-name">' + (name || '') + '</div>' +
          '<button type="button" class="user-menu-item user-menu-signout">退出登录</button>' +
        '</div>';
      var trigger = document.getElementById('userMenuTrigger');
      var dropdown = document.getElementById('userMenuDropdown');
      if (trigger && dropdown) {
        trigger.addEventListener('click', function (e) {
          e.stopPropagation();
          dropdown.classList.toggle('open');
        });
        document.addEventListener('click', function () { dropdown.classList.remove('open'); });
      }
      container.querySelector('.user-menu-signout').addEventListener('click', function () {
        signOut();
        if (typeof window.toast === 'function') window.toast('已退出登录');
      });
    } else {
      container.innerHTML = '<button type="button" class="user-menu-login-btn" id="userMenuLoginBtn">登录</button>';
      document.getElementById('userMenuLoginBtn').addEventListener('click', function () {
        openLoginModal('登录后可永久保存笔记并同步至所有设备');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initSupabase();
      bindLoginModal();
      renderUserMenu();
    });
  } else {
    initSupabase();
    bindLoginModal();
    renderUserMenu();
  }

  /** 获取 Supabase 客户端（用于 Storage 等），未配置时返回 null */
  function getSupabase() {
    return initSupabase();
  }

  window.Auth = {
    isLoggedIn: isLoggedIn,
    getUserId: getUserId,
    getSupabase: getSupabase,
    signOut: signOut,
    openLoginModal: openLoginModal,
    requireLogin: requireLogin,
    isAuthEnabled: isAuthEnabled
  };
})();
