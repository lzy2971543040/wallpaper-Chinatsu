(() => {
  'use strict';

  const DATA = window.GALLERY || { items: [], hero: '' };
  const items = DATA.items;

  const $ = (s) => document.querySelector(s);
  const waterfall = $('#waterfall');
  const filtersEl = $('#filters');
  const searchEl = $('#search');
  const resultText = $('#resultText');
  const emptyEl = $('#empty');
  const lightbox = $('#lightbox');
  const lbImg = $('#lbImg');
  const lbTitle = $('#lbTitle');
  const lbMeta = $('#lbMeta');
  const lbTags = $('#lbTags');
  const lbDownload = $('#lbDownload');

  const FILTERS = [
    { key: 'all', label: '全部' },
    { key: 'official', label: '官方美术' },
    { key: 'landscape', label: '横屏壁纸' },
    { key: 'portrait', label: '手机竖屏' },
    { key: 'square', label: '方形构图' },
    { key: 'ultra', label: '4K 超清' },
  ];

  let activeFilters = new Set();
  let query = '';
  let view = [];           // 当前筛选结果
  let rendered = 0;        // 已渲染数量
  let cols = 0;
  let colHeights = [];
  let cardH = new Map();
  let order = null;        // 打乱后的顺序
  let currentIndex = -1;

  /* ---------------- 初始化 ---------------- */
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg && DATA.hero) heroBg.style.backgroundImage = `url("${DATA.hero}")`;

  const total = items.length;
  $('#statCount').textContent = total;
  $('#stat4k').textContent = items.filter((i) => i.tags.includes('ultra')).length;
  $('#statOff').textContent = items.filter((i) => i.tags.includes('official')).length;
  $('#footCount').textContent = total;
  $('#countTop').textContent = `${total} 张`;

  // 筛选按钮
  for (const f of FILTERS) {
    const b = document.createElement('button');
    b.className = 'chip' + (f.key === 'all' ? ' active' : '');
    b.textContent = f.label;
    b.dataset.key = f.key;
    b.addEventListener('click', () => {
      if (f.key === 'all') {
        activeFilters.clear();
      } else {
        activeFilters.has(f.key) ? activeFilters.delete(f.key) : activeFilters.add(f.key);
      }
      document.querySelectorAll('.chip').forEach((c) => {
        const k = c.dataset.key;
        c.classList.toggle('active', k === 'all' ? activeFilters.size === 0 : activeFilters.has(k));
      });
      applyFilter();
    });
    filtersEl.appendChild(b);
  }

  searchEl.addEventListener('input', () => {
    query = searchEl.value.trim().toLowerCase();
    applyFilter();
  });

  $('#randomBtn').addEventListener('click', () => {
    if (!view.length) return;
    const pick = view[Math.floor(Math.random() * view.length)];
    openLightbox(view.indexOf(pick));
  });

  $('#shuffleBtn').addEventListener('click', () => {
    const arr = view.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    view = arr;
    render(true);
  });

  /* ---------------- 筛选 ---------------- */
  function matches(it) {
    for (const f of activeFilters) if (!it.tags.includes(f)) return false;
    if (!query) return true;
    const hay = `${it.id} ${it.w}x${it.h} ${it.tags.join(' ')} ${it.title || ''}`.toLowerCase();
    return hay.includes(query);
  }

  function applyFilter(scroll = true) {
    view = items.filter(matches);
    if (order) view.sort((a, b) => order.get(a.id) - order.get(b.id));
    render(true, scroll);
  }

  /* ---------------- 布局 ---------------- */
  function computeCols() {
    const w = waterfall.clientWidth || window.innerWidth;
    if (w < 560) return 2;
    if (w < 900) return 3;
    if (w < 1300) return 4;
    if (w < 1700) return 5;
    return 6;
  }

  function gap() {
    return cols <= 3 ? 10 : 16;
  }

  function layoutAll() {
    cols = computeCols();
    colHeights = new Array(cols).fill(0);
    const g = gap();
    const cardW = (waterfall.clientWidth - g * (cols - 1)) / cols;
    const prev = new Map();
    waterfall.querySelectorAll('.card').forEach((c) => prev.set(c.dataset.id, c));
    cardH.clear();

    // 重新摆放已有卡片
    for (const card of prev.values()) {
      const it = items.find((i) => i.id === card.dataset.id);
      if (!it) continue;
      let ratio = it.h / it.w;
      if (ratio > 2.6) ratio = 2.6;
      const h = Math.round(cardW * ratio);
      const col = colHeights.indexOf(Math.min(...colHeights));
      const x = col * (cardW + g);
      const y = colHeights[col];
      card.style.width = `${cardW}px`;
      card.style.height = `${h}px`;
      card.style.transform = `translate(${x}px, ${y}px)`;
      cardH.set(it.id, h);
      colHeights[col] = y + h + g;
    }
    waterfall.style.height = `${Math.max(0, ...colHeights) - g}px`;
  }

  function placeCard(card, it) {
    const g = gap();
    const cardW = (waterfall.clientWidth - g * (cols - 1)) / cols;
    let ratio = it.h / it.w;
    if (ratio > 2.6) ratio = 2.6;
    const h = Math.round(cardW * ratio);
    const col = colHeights.indexOf(Math.min(...colHeights));
    const x = col * (cardW + g);
    const y = colHeights[col];
    card.style.width = `${cardW}px`;
    card.style.height = `${h}px`;
    card.style.transform = `translate(${x}px, ${y}px)`;
    colHeights[col] = y + h + g;
    waterfall.style.height = `${Math.max(...colHeights) - g}px`;
  }

  /* ---------------- 渲染 ---------------- */
  const BATCH = 42;

  function makeCard(it) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = it.id;
    if (it.color) card.style.background = it.color;
    const img = document.createElement('img');
    img.src = it.thumb;
    img.alt = it.title || `千夏壁纸 ${it.id}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.style.opacity = '0';
    img.style.transition = 'opacity .45s ease';
    img.addEventListener('load', () => { img.style.opacity = '1'; card.classList.add('show'); }, { once: true });
    img.addEventListener('error', () => { img.style.opacity = '0.15'; card.classList.add('show'); }, { once: true });

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `<span>${it.id}</span><span>${it.w} × ${it.h}</span>`;
    card.appendChild(img);
    card.appendChild(overlay);

    if (it.tags.includes('official')) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = '官方';
      card.appendChild(badge);
    }
    card.addEventListener('click', () => openLightbox(view.indexOf(it)));
    return card;
  }

  function render(reset, scroll = true) {
    if (reset) {
      waterfall.innerHTML = '';
      rendered = 0;
      cols = computeCols();
      colHeights = new Array(cols).fill(0);
      waterfall.style.height = '0px';
      emptyEl.hidden = view.length > 0;
      if (scroll) window.scrollTo({ top: $('#gallery').offsetTop - 70, behavior: 'smooth' });
    }
    const frag = document.createDocumentFragment();
    const next = view.slice(rendered, rendered + BATCH);
    for (const it of next) frag.appendChild(makeCard(it));
    waterfall.appendChild(frag);
    // 布局新加入的卡片
    const cards = waterfall.querySelectorAll('.card');
    for (let i = rendered; i < cards.length; i++) {
      const card = cards[i];
      const it = items.find((x) => x.id === card.dataset.id);
      if (it) placeCard(card, it);
    }
    rendered = cards.length;
    resultText.textContent = `共 ${view.length} 张 · 已展示 ${rendered} 张`;
  }

  const sentinel = $('#sentinel');
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && rendered < view.length) render(false);
  }, { rootMargin: '900px' });
  io.observe(sentinel);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layoutAll, 180);
  });

  window.addEventListener('scroll', () => {
    $('#topbar').classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  /* ---------------- 灯箱 ---------------- */
  function openLightbox(idx) {
    if (idx < 0 || idx >= view.length) return;
    currentIndex = idx;
    const it = view[idx];
    lbImg.src = it.src;
    lbImg.alt = it.title || `千夏壁纸 ${it.id}`;
    lbTitle.textContent = it.title || `千夏 · ${it.id}`;
    lbMeta.textContent = `${it.w} × ${it.h} · ${(it.bytes / 1024 / 1024).toFixed(2)} MB · ${it.id}`;
    lbTags.innerHTML = it.tags.map((t) => {
      const map = { official: '官方美术', landscape: '横屏', portrait: '竖屏', square: '方形', ultra: '4K' };
      return `<span>${map[t] || t}</span>`;
    }).join('');
    lbDownload.href = it.src;
    lbDownload.download = it.src.split('/').pop();
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lbImg.src = '';
    document.body.style.overflow = '';
    currentIndex = -1;
  }

  function step(d) {
    if (!view.length) return;
    openLightbox((currentIndex + d + view.length) % view.length);
  }

  $('#lbClose').addEventListener('click', closeLightbox);
  $('#lbPrev').addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
  $('#lbNext').addEventListener('click', (e) => { e.stopPropagation(); step(1); });
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

  window.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });

  /* ---------------- 启动 ---------------- */
  applyFilter(false);
})();
