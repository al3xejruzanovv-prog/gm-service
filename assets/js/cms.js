/* ============ GM Service — CMS ============
   Публикует правки из Supabase на всех страницах и включает
   режим редактирования «прямо на сайте» при ?edit=1.

   Ключ правки = «тег#порядковый номер» среди редактируемых блоков
   страницы. Пока структура страницы не меняется, ключи стабильны.
*/
(function () {
  'use strict';

  var cfg = window.GM_CMS || {};
  var SB_URL = String(cfg.supabaseUrl || '').trim().replace(/\/+$/, '');
  var ANON = String(cfg.supabaseAnonKey || '').trim();
  var CONFIGURED = /^https?:\/\//.test(SB_URL) && !!ANON &&
    !/YOUR-|ВАШ|PASTE|ВСТАВЬТЕ/i.test(SB_URL + ANON);

  var SESSION_KEY = 'gm_cms_session';
  var TABLE = '/rest/v1/page_content';

  var EDITABLE_SELECTOR = [
    'h1', 'h2', 'h3', 'h4',
    'p', 'li', 'td', 'th',
    'blockquote', 'cite',
    '.price-from', '.price-note', '.section-tag',
    '.gate-kicker', '.lead', '.btn'
  ].join(',');

  var SKIP = [
    'header', 'footer', 'nav',
    '.device-gate', '.cookie-banner', '.model-modal',
    '.cms-bar', '.cms-toast', '.cms-dialog',
    '[data-cms-skip]'
  ].join(',');

  var PAGES = [
    ['index.html', 'Ремонт телефонов'],
    ['remont-apple.html', 'Apple'],
    ['remont-samsung.html', 'Samsung'],
    ['remont-xiaomi.html', 'Xiaomi'],
    ['remont-huawei.html', 'Huawei'],
    ['remont-honor.html', 'Honor'],
    ['remont-oppo.html', 'OPPO'],
    ['remont-sony-lg.html', 'Sony / LG'],
    ['remont-drugih-brendov.html', 'Другие бренды'],
    ['remont-planshetov.html', 'Планшеты'],
    ['remont-noutbukov.html', 'Ноутбуки'],
    ['vosstanovlenie-dannyh.html', 'Восстановление данных'],
    ['ceny.html', 'Цены'],
    ['otzyvy.html', 'Отзывы'],
    ['kontakty.html', 'Контакты'],
    ['politika-konfidencialnosti.html', 'Политика конфиденциальности']
  ];

  /* ---------- утилиты ---------- */
  function pageName() {
    var name = location.pathname.split('/').pop() || 'index.html';
    return name.split('?')[0] || 'index.html';
  }

  function pageLabel() {
    var name = pageName();
    for (var i = 0; i < PAGES.length; i++) {
      if (PAGES[i][0] === name) return PAGES[i][1];
    }
    return name;
  }

  function isEditable(el) {
    if (!el || !el.textContent || !el.textContent.trim()) return false;
    if (el.closest(SKIP)) return false;
    return true;
  }

  function collect() {
    var all = document.querySelectorAll(EDITABLE_SELECTOR);
    return Array.prototype.filter.call(all, isEditable);
  }

  function keyOf(el, index) {
    return el.tagName.toLowerCase() + '#' + index;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- HTTP к Supabase ---------- */
  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ apikey: ANON }, opts.headers || {});
    return fetch(SB_URL + path, Object.assign({}, opts, { headers: headers }))
      .then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
          if (!res.ok) {
            var msg = (data && (data.msg || data.message || data.error_description || data.error)) || ('HTTP ' + res.status);
            var err = new Error(msg);
            err.status = res.status;
            throw err;
          }
          return data;
        });
      });
  }

  /* ---------- сессия ---------- */
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { return null; }
  }

  function saveSession(session) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function signIn(email, password) {
    if (!CONFIGURED) {
      return Promise.resolve({
        ok: false,
        error: 'CMS не настроена: заполните assets/js/config.js (см. README-admin.md).'
      });
    }
    return api('/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (data) {
      var session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        email: (data.user && data.user.email) || email
      };
      saveSession(session);
      return { ok: true, session: session };
    }).catch(function (err) {
      return { ok: false, error: err.message || 'Ошибка авторизации' };
    });
  }

  function ensureToken() {
    var session = getSession();
    if (!session || !session.access_token) return Promise.resolve(null);

    if (session.expires_at && session.expires_at - 60000 > Date.now()) {
      return Promise.resolve(session.access_token);
    }
    if (!session.refresh_token) {
      clearSession();
      return Promise.resolve(null);
    }
    return api('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    }).then(function (data) {
      session.access_token = data.access_token;
      session.refresh_token = data.refresh_token || session.refresh_token;
      session.expires_at = Date.now() + (data.expires_in || 3600) * 1000;
      saveSession(session);
      return session.access_token;
    }).catch(function () {
      clearSession();
      return null;
    });
  }

  /* ---------- публикация правок ---------- */
  function applyRows(rows) {
    var list = collect();
    var applied = 0;
    rows.forEach(function (row) {
      var parts = String(row.key || '').split('#');
      var index = parseInt(parts.pop(), 10);
      var tag = parts.join('#').toLowerCase();
      var el = list[index];
      if (!el || isNaN(index)) return;
      if (tag && el.tagName.toLowerCase() !== tag) return;
      if (el.innerHTML !== row.html) {
        el.innerHTML = row.html;
        applied++;
      }
    });
    return applied;
  }

  function loadAndApply() {
    if (!CONFIGURED) return Promise.resolve(0);
    return api(TABLE + '?select=key,html&page=eq.' + encodeURIComponent(pageName()), {
      headers: { Accept: 'application/json' }
    }).then(function (rows) {
      return Array.isArray(rows) ? applyRows(rows) : 0;
    }).catch(function (err) {
      console.warn('[CMS] Не удалось загрузить правки:', err.message);
      return 0;
    });
  }

  /* ---------- интерфейс редактора ---------- */
  function toast(text, isError) {
    var el = document.querySelector('.cms-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'cms-toast';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.toggle('is-error', !!isError);
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  function buildBar(els, baseline) {
    var bar = document.createElement('div');
    bar.className = 'cms-bar';
    bar.innerHTML =
      '<span class="cms-dot" aria-hidden="true"></span>' +
      '<span class="cms-label">Редактирование · <b>' + escapeHtml(pageLabel()) + '</b></span>' +
      '<select class="cms-pages" aria-label="Перейти к другой странице">' +
        PAGES.map(function (p) {
          return '<option value="' + p[0] + '"' + (p[0] === pageName() ? ' selected' : '') + '>' + escapeHtml(p[1]) + '</option>';
        }).join('') +
      '</select>' +
      '<button type="button" class="cms-btn cms-primary" data-act="save">Сохранить</button>' +
      '<button type="button" class="cms-btn cms-danger" data-act="reset">Сбросить правки</button>' +
      '<a class="cms-btn" href="' + pageName() + '">Выйти из режима</a>' +
      '<button type="button" class="cms-btn" data-act="logout">Выйти из аккаунта</button>';
    document.body.appendChild(bar);

    bar.querySelector('.cms-pages').addEventListener('change', function (e) {
      location.href = e.target.value + '?edit=1';
    });

    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'save') saveEdits(els, baseline, btn);
      if (act === 'reset') resetPage(btn);
      if (act === 'logout') { clearSession(); location.href = 'index.html'; }
    });

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveEdits(els, baseline, bar.querySelector('[data-act="save"]'));
      }
    });
  }

  function saveEdits(els, baseline, btn) {
    var rows = [];
    els.forEach(function (el, i) {
      if (el.innerHTML !== baseline[i]) {
        rows.push({
          page: pageName(),
          key: keyOf(el, i),
          html: el.innerHTML,
          updated_at: new Date().toISOString()
        });
      }
    });

    if (!rows.length) { toast('Изменений нет'); return; }

    btn.disabled = true;
    ensureToken().then(function (token) {
      if (!token) {
        toast('Сессия истекла — войдите заново', true);
        setTimeout(function () { location.href = 'admin.html'; }, 1200);
        return null;
      }
      return api(TABLE + '?on_conflict=page,key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(rows)
      }).then(function () {
        rows.forEach(function (row) {
          var idx = parseInt(row.key.split('#').pop(), 10);
          if (!isNaN(idx) && els[idx]) baseline[idx] = els[idx].innerHTML;
        });
        toast('Сохранено правок: ' + rows.length);
      });
    }).catch(function (err) {
      toast('Ошибка сохранения: ' + err.message, true);
    }).then(function () {
      btn.disabled = false;
    });
  }

  function resetPage(btn) {
    if (!confirm('Удалить все сохранённые правки этой страницы? Вернётся исходный текст.')) return;
    btn.disabled = true;
    ensureToken().then(function (token) {
      if (!token) { toast('Сессия истекла — войдите заново', true); return null; }
      return api(TABLE + '?page=eq.' + encodeURIComponent(pageName()), {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      }).then(function () {
        toast('Правки страницы сброшены');
        setTimeout(function () { location.href = pageName(); }, 900);
      });
    }).catch(function (err) {
      toast('Ошибка сброса: ' + err.message, true);
    }).then(function () {
      btn.disabled = false;
    });
  }

  function bootEdit() {
    if (!CONFIGURED) {
      location.replace('admin.html');
      return;
    }
    ensureToken().then(function (token) {
      if (!token) {
        location.replace('admin.html');
        return;
      }
      document.body.classList.add('cms-edit-on');
      var els = collect();
      var baseline = els.map(function (el) { return el.innerHTML; });
      els.forEach(function (el) {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'false');
      });
      buildBar(els, baseline);
      toast('Кликните по тексту, чтобы изменить его. Ctrl+S — сохранить.');
    });
  }

  /* ---------- публичный API для admin.html ---------- */
  window.GMCMS = {
    configured: CONFIGURED,
    signIn: signIn,
    getSession: getSession,
    clearSession: clearSession,
    pageName: pageName
  };

  /* ---------- запуск ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    if (document.body && document.body.hasAttribute('data-cms-admin')) return;
    loadAndApply().then(function () {
      var params = new URLSearchParams(location.search);
      if (params.get('edit') === '1') bootEdit();
    });
  });
})();
