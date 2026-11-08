/* ============ GM Service — общий скрипт ============ */
document.addEventListener('DOMContentLoaded', () => {

  /* --- Экран выбора устройства (плавная анимация при входе) --- */
  const gate = document.getElementById('deviceGate');
  if (gate) {
    const tiles = gate.querySelectorAll('.gate-tile');

    // каскадная задержка появления плиток
    tiles.forEach((tile, i) => {
      tile.style.animationDelay = (0.15 + i * 0.07).toFixed(2) + 's';
      tile.addEventListener('click', () => {
        tile.style.transform = 'scale(.92)';
        setTimeout(() => closeGate(tile.dataset.href), 160);
      });
    });

    function closeGate(href) {
      gate.classList.add('hidden');
      document.body.style.overflow = '';
      try { sessionStorage.setItem('gateSeen', '1'); } catch (e) {}
      if (href) window.location.href = href;
    }

    gate.querySelectorAll('[data-skip]').forEach(btn =>
      btn.addEventListener('click', () => closeGate(null))
    );

    // если пользователь уже проходил выбор в этой сессии — показать короче
    let seen = false;
    try { seen = sessionStorage.getItem('gateSeen') === '1'; } catch (e) {}
    document.body.style.overflow = 'hidden';
    if (seen) {
      tiles.forEach((t, i) => { t.style.animationDelay = (0.05 + i * 0.04) + 's'; });
    }
  }

  /* --- Попап выбора модели при клике на бренд --- */
  const BRAND_MODELS = {
    'remont-apple.html': { name: 'Apple', rows: [
      ['iPhone 16 Pro Max', 'от 6 500 ₽'], ['iPhone 15 Pro / 15', 'от 4 900 ₽'],
      ['iPhone 14', 'от 4 200 ₽'], ['iPhone 13', 'от 3 800 ₽'],
      ['iPhone 12 / 11', 'от 3 200 ₽'], ['iPhone SE / XR / XS', 'от 2 800 ₽'],
    ]},
    'remont-samsung.html': { name: 'Samsung', rows: [
      ['Galaxy S24 Ultra', 'от 5 900 ₽'], ['Galaxy S23 / S22', 'от 4 500 ₽'],
      ['Galaxy A54 / A55', 'от 3 200 ₽'], ['Galaxy A14 / A25', 'от 2 900 ₽'],
      ['Galaxy Note 20', 'от 4 000 ₽'],
    ]},
    'remont-xiaomi.html': { name: 'Xiaomi', rows: [
      ['Xiaomi 14 / 13', 'от 4 800 ₽'], ['Redmi Note 13', 'от 3 400 ₽'],
      ['POCO X6 / F5', 'от 3 200 ₽'], ['Redmi 12 / 13', 'от 2 900 ₽'],
    ]},
    'remont-huawei.html': { name: 'Huawei', rows: [
      ['Mate 50 / 60', 'от 4 800 ₽'], ['P60 / P50', 'от 4 300 ₽'],
      ['Nova 12 / 11', 'от 3 600 ₽'], ['P40', 'от 3 400 ₽'],
    ]},
    'remont-honor.html': { name: 'Honor', rows: [
      ['Magic 6 / Magic 5', 'от 4 800 ₽'], ['Honor 90 / 200', 'от 3 600 ₽'],
      ['Honor X9b / X8', 'от 3 200 ₽'], ['Honor Play', 'от 2 800 ₽'],
    ]},
    'remont-oppo.html': { name: 'OPPO', rows: [
      ['Reno 11 / 12', 'от 4 200 ₽'], ['Find X6 / X5', 'от 5 000 ₽'],
      ['A98 / A78', 'от 3 200 ₽'],
    ]},
    'remont-sony-lg.html': { name: 'Sony · LG', rows: [
      ['Xperia 5 / 10', 'от 4 300 ₽'], ['Xperia XZ', 'от 3 600 ₽'],
      ['LG K62 / K52', 'от 3 200 ₽'],
    ]},
    'remont-drugih-brendov.html': { name: 'Другие бренды', rows: [
      ['ASUS Zenfone / ROG', 'от 4 500 ₽'], ['Lenovo Legion', 'от 4 800 ₽'],
      ['Nokia G-серия', 'от 3 200 ₽'], ['HTC U / Meizu 20', 'от 3 400 ₽'],
      ['ZTE / Fly / Digma', 'от 2 800 ₽'],
    ]},
  };

  function buildModelModal(brandTile) {
    const href = brandTile.getAttribute('href');
    const data = BRAND_MODELS[href];
    if (!data) return; // нет данных — обычный переход по ссылке

    const overlay = document.createElement('div');
    overlay.className = 'model-modal';
    overlay.innerHTML = `
      <div class="mm-card" role="dialog" aria-modal="true">
        <button class="mm-close" aria-label="Закрыть">✕</button>
        <span class="mm-kicker">${data.name}</span>
        <div class="mm-title">Выберите модель</div>
        <div class="mm-sub">Ориентировочно: замена дисплея под вашу модель</div>
        <div class="mm-rows">
          ${data.rows.map(([model, price], i) => `
            <button class="mm-row" data-href="${href}" style="animation-delay:${(0.05 + i * 0.05).toFixed(2)}s">
              <span><b>${model}</b><small>в наличии комплектующие</small></span>
              <span class="mm-price">от ${price.replace('от ', '')}<span>дисплей</span></span>
            </button>`).join('')}
        </div>
        <div class="mm-footer">
          <a class="mm-all" href="${href}">Все работы по бренду →</a>
          <span class="mm-note">Точную цену назовёт мастер после бесплатной диагностики</span>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const close = () => { overlay.classList.remove('open'); document.body.style.overflow = ''; setTimeout(() => overlay.remove(), 320); };
    overlay.querySelector('.mm-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
    overlay.querySelectorAll('.mm-row').forEach(row =>
      row.addEventListener('click', () => { window.location.href = row.dataset.href; })
    );

    requestAnimationFrame(() => overlay.classList.add('open'));
  }

  document.querySelectorAll('.brand-tile.brand-model').forEach(tile => {
    tile.addEventListener('click', e => {
      e.preventDefault();
      buildModelModal(tile);
    });
  });

  /* --- Плавное появление блоков при прокрутке --- */
  const observer = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('visible'); observer.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  /* --- Мобильное меню --- */
  const burger = document.querySelector('.burger');
  const mobileNav = document.querySelector('.mobile-nav');
  if (burger && mobileNav) {
    burger.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
      burger.classList.toggle('active');
    });
  }

  /* --- Баннер об использовании cookie (152-ФЗ) --- */
  if (!document.querySelector('.cookie-banner')) {
    let cookieOk = false;
    try { cookieOk = localStorage.getItem('cookieOk') === '1'; } catch (e) {}
    if (!cookieOk) {
      const cb = document.createElement('div');
      cb.className = 'cookie-banner';
      cb.innerHTML = `
        <p>Мы используем cookie и localStorage для корректной работы сайта и обезличенной статистики. Продолжая пользоваться сайтом или нажав «Хорошо», вы соглашаетесь с <a href="politika-konfidencialnosti.html">политикой обработки персональных данных</a>.</p>
        <button class="cookie-ok" type="button">Хорошо</button>`;
      document.body.appendChild(cb);
      requestAnimationFrame(() => cb.classList.add('show'));
      cb.querySelector('.cookie-ok').addEventListener('click', () => {
        try { localStorage.setItem('cookieOk', '1'); } catch (e) {}
        cb.classList.remove('show');
        setTimeout(() => cb.remove(), 400);
      });
      setTimeout(() => { if (document.body.contains(cb)) cb.classList.add('show'); }, 1600);
    }
  }

  /* --- Подсветка активного пункта меню --- */
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a, .mobile-nav a').forEach(a => {
    if (a.getAttribute('href') === here) a.classList.add('active');
  });

  /* --- Живая плашка «Работаем сейчас» --- */
  const openBadge = document.querySelector('.js-open-now');
  if (openBadge) {
    const h = new Date().getHours();
    const open = h >= 10 && h < 21;
    openBadge.textContent = open ? 'Открыто сейчас · до 21:00' : 'Закрыто · на связи с 10:00';
  }

  /* --- Плавный уход карточек цен при наведении (лёгкий параллакс) --- */
  document.querySelectorAll('.price-table tr').forEach(row => {
    row.addEventListener('mouseenter', () => { row.style.background = 'var(--accent-soft)'; });
    row.addEventListener('mouseleave', () => { row.style.background = ''; });
  });
});
