(function () {
  'use strict';

  var IMAGES = window.PUZZLE_IMAGES, CATS = window.PUZZLE_CATEGORIES;
  var $ = function (id) { return document.getElementById(id); };
  var menu = $('menu'), game = $('game'), stage = $('stage'), board = $('board'), win = $('win');

  // 片數 → [直向或橫向] 的格子配置
  var SIZES = [9, 12, 16];
  var state = { count: 9, imgIndex: 0, cols: 3, rows: 3, pieces: [], c: 0, bx: 0, by: 0,
                tray: null, t: 1, soundOn: true, solved: 0, cat: 'new', menuScroll: 0, jigsaw: true, showBase: true, pad: 0, B: 0 };

  try { state.showBase = localStorage.getItem('puzzleBase') !== 'off'; } catch (e) {}
  try { state.jigsaw = localStorage.getItem('puzzleShape') !== 'square'; } catch (e) {}
  try { var saved = parseInt(localStorage.getItem('puzzleCount'), 10); if (SIZES.indexOf(saved) >= 0) state.count = saved; } catch (e) {}

  /* ---------- 音效 (Web Audio) ---------- */
  var actx = null;
  function tone(freq, start, dur, type) {
    if (!state.soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + start;
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) {}
  }
  function sndSnap() { tone(660, 0, 0.15); tone(880, 0.09, 0.2); }
  function sndBack() { tone(300, 0, 0.18, 'triangle'); }
  function sndWin() { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(f, i * 0.14, 0.3); }); }

  /* ---------- 選單 ---------- */
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // 一排切換按鈕：opts = [[值, 圖示, 文字], ...]
  function toggleRow(el, opts, current, onPick) {
    el.innerHTML = '';
    opts.forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'size-btn' + (o[0] === current ? ' on' : '');
      b.innerHTML = o[1] + '<small>' + o[2] + '</small>';
      b.onclick = function () { onPick(o[0]); };
      el.appendChild(b);
    });
  }

  function buildSettings() {
    toggleRow($('shapes'), [[true, '🧩', '拼圖形'], [false, '⬜', '方塊']], state.jigsaw, function (v) {
      state.jigsaw = v; save('puzzleShape', v ? 'jigsaw' : 'square'); buildSettings();
    });
    toggleRow($('bases'), [[true, '🖼️', '有底圖'], [false, '⬛', '無底圖']], state.showBase, function (v) {
      state.showBase = v; save('puzzleBase', v ? 'on' : 'off'); buildSettings();
    });
  }

  // 首頁：每個類別一張大卡片（固定圖示，不放縮圖）；最新圖片放最上面、佔滿一整排
  function buildHome() {
    var box = $('cats'); box.innerHTML = '';
    CATS.forEach(function (c) {
      var n = indexesInCat(c.id).length, b = document.createElement('button');
      b.className = 'cat-card' + (c.id === 'new' ? ' new' : '');
      b.innerHTML = '<span class="ico">' + c.icon + '</span><span class="txt"><span class="nm">' + c.name +
                    '</span><span class="ct">' + n + ' 張</span></span>';
      b.onclick = function () { openCat(c.id); };
      box.appendChild(b);
    });
  }

  // 目前分類（或指定分類）裡的圖片，回傳在 IMAGES 裡的索引。'new' = 最新加入的 N 張，新的在前
  function indexesInCat(cat) {
    cat = cat || state.cat;
    var out = [];
    IMAGES.forEach(function (im, i) { if (cat === 'new' || im.cat === cat) out.push(i); });
    if (cat === 'new') {
      out.sort(function (a, b) { return IMAGES[b].seq - IMAGES[a].seq; });
      out = out.slice(0, window.PUZZLE_NEW_COUNT || 16);
    }
    return out;
  }

  // 類別頁：該類別的圖片，點圖片直接進拼圖
  function openCat(id) {
    state.cat = id;
    var c = CATS.filter(function (x) { return x.id === id; })[0];
    $('catTitle').textContent = c.icon + ' ' + c.name;
    var gal = $('gallery'); gal.innerHTML = '';
    indexesInCat().forEach(function (i) {
      var im = IMAGES[i], b = document.createElement('button');
      b.className = 'thumb';
      b.innerHTML = '<img src="' + im.src + '" alt="' + im.name + '插圖" width="200" height="200" loading="lazy" decoding="async"><span>' + im.name + '</span>';
      b.setAttribute('aria-label', '玩「' + im.name + '」拼圖');
      b.onclick = function () { state.menuScroll = menu.scrollTop; start(i); };
      gal.appendChild(b);
    });
    $('homeView').classList.add('hidden'); $('catView').classList.remove('hidden');
    menu.scrollTop = 0;
    if (window.PuzzleAds) PuzzleAds.show('category');
  }
  function showHome() {
    $('catView').classList.add('hidden'); $('homeView').classList.remove('hidden');
    menu.scrollTop = 0;
    if (window.PuzzleAds) PuzzleAds.show('home');
  }
  $('btnCatBack').onclick = showHome;

  $('btnSettings').onclick = function () { buildSettings(); refreshPwaRows(); $('settings').classList.remove('hidden'); };
  $('btnSettingsClose').onclick = function () { $('settings').classList.add('hidden'); };
  $('settings').addEventListener('click', function (e) { if (e.target === this) this.classList.add('hidden'); });   // 點空白處關閉

  /* ---------- 遊戲 ---------- */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }

  function buildGameSizes() {
    var box = $('gameSizes'); box.innerHTML = '';
    SIZES.forEach(function (n) {
      var b = document.createElement('button');
      b.className = 'gs' + (n === state.count ? ' on' : '');
      b.textContent = n + '片';
      b.onclick = function () {
        if (n === state.count) return;
        state.count = n; save('puzzleCount', n); start(state.imgIndex);
      };
      box.appendChild(b);
    });
  }

  function start(imgIndex) {
    state.imgIndex = imgIndex;
    buildGameSizes();
    menu.classList.add('hidden'); game.classList.remove('hidden'); win.classList.add('hidden');
    // 直式螢幕 12 片用 3 欄×4 列，橫式用 4 欄×3 列
    var portrait = stage.clientWidth < stage.clientHeight * 1.1;
    var n = state.count;
    state.cols = n === 9 ? 3 : n === 16 ? 4 : (portrait ? 3 : 4);
    state.rows = n / state.cols;
    buildPieces();
    layout(true);
  }

  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function rnd() { return Math.random() < 0.5 ? 1 : -1; }

  function buildPieces() {
    stage.querySelectorAll('.piece').forEach(function (e) { e.remove(); });
    state.pieces = []; state.solved = 0;
    var cols = state.cols, rows = state.rows, src = IMAGES[state.imgIndex].src;
    board.innerHTML = '<div class="ghost"></div>';
    board.querySelector('.ghost').style.backgroundImage = 'url(' + src + ')';
    board.classList.toggle('jig', state.jigsaw);
    board.classList.toggle('nobase', !state.showBase);
    var slots = svgEl('svg', { 'class': 'slots' });
    board.appendChild(slots);

    // 相鄰兩塊共用的邊：+1 = 左(上)邊那塊長出凸塊，-1 = 凹槽
    var tabH = [], tabV = [];
    for (var r = 0; r < rows; r++) { tabH[r] = []; tabV[r] = []; for (var c = 0; c < cols; c++) { tabH[r][c] = rnd(); tabV[r][c] = rnd(); } }

    var order = shuffle(Array.apply(null, { length: state.count }).map(function (_, i) { return i; }));
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      var cell = document.createElement('div'); cell.className = 'cell'; cell.dataset.c = c; cell.dataset.r = r;
      board.appendChild(cell);

      var j = state.jigsaw, id = 'cp' + state.pieces.length;
      var svg = svgEl('svg', { 'class': 'piece' });
      var clip = svgEl('clipPath', { id: id }), cpath = svgEl('path', {});
      clip.appendChild(cpath);
      var img = svgEl('image', { href: src, preserveAspectRatio: 'none', 'clip-path': 'url(#' + id + ')' });
      var line = svgEl('path', { 'class': 'edge', fill: 'transparent' });
      svg.appendChild(clip); svg.appendChild(img); svg.appendChild(line);
      stage.appendChild(svg);

      var slot = svgEl('path', {});
      if (state.jigsaw) slots.appendChild(slot);
      var p = { slotPath: slot, el: svg, img: img, cpath: cpath, line: line, col: c, row: r, done: false,
        slot: order[state.pieces.length],
        s: { // 上、右、下、左 四條邊（0 = 外框平邊）
          t: j && r > 0 ? -tabV[r - 1][c] : 0,
          r: j && c < cols - 1 ? tabH[r][c] : 0,
          b: j && r < rows - 1 ? tabV[r][c] : 0,
          l: j && c > 0 ? -tabH[r][c - 1] : 0 } };
      state.pieces.push(p);
      bindDrag(p);
    }
  }

  // 一條邊：從 A 走到 B，sgn 決定凸(+1)、凹(-1)、平(0)
  function edgePath(A, B, sgn, c) {
    var dx = (B[0] - A[0]) / c, dy = (B[1] - A[1]) / c, nx = dy, ny = -dx;
    function P(u, h) { return (A[0] + dx * u * c + nx * h * sgn * c).toFixed(2) + ' ' + (A[1] + dy * u * c + ny * h * sgn * c).toFixed(2); }
    if (!sgn) return 'L' + P(1, 0);
    return 'L' + P(0.40, 0) +
      'C' + P(0.44, 0) + ',' + P(0.44, 0.05) + ',' + P(0.42, 0.08) +
      'C' + P(0.34, 0.12) + ',' + P(0.36, 0.28) + ',' + P(0.50, 0.28) +
      'C' + P(0.64, 0.28) + ',' + P(0.66, 0.12) + ',' + P(0.58, 0.08) +
      'C' + P(0.56, 0.05) + ',' + P(0.56, 0) + ',' + P(0.60, 0) +
      'L' + P(1, 0);
  }
  function piecePath(p, pad, c) {
    var TL = [pad, pad], TR = [pad + c, pad], BR = [pad + c, pad + c], BL = [pad, pad + c];
    return 'M' + TL[0] + ' ' + TL[1] + edgePath(TL, TR, p.s.t, c) + edgePath(TR, BR, p.s.r, c) +
      edgePath(BR, BL, p.s.b, c) + edgePath(BL, TL, p.s.l, c) + 'Z';
  }

  function layout(first) {
    var W = stage.clientWidth, H = stage.clientHeight, cols = state.cols, rows = state.rows, m = 10;
    var portrait = W < H * 1.1, c, bx, by, tray;
    if (portrait) {
      c = Math.min((W - 2 * m) / cols, H * 0.5 / rows);
      c = Math.min(c, 160);
      bx = (W - c * cols) / 2; by = m;
      tray = { x: m, y: by + c * rows + 16, w: W - 2 * m, h: H - (by + c * rows + 16) - m };
    } else {
      c = Math.min(W * 0.52 / cols, (H - 2 * m) / rows, 160);
      bx = m + 4; by = (H - c * rows) / 2;
      tray = { x: bx + c * cols + 20, y: m, w: W - (bx + c * cols + 20) - m, h: H - 2 * m };
    }
    var pad = state.jigsaw ? c * 0.3 : 0, B = c + 2 * pad;
    Object.assign(state, { c: c, bx: bx, by: by, tray: tray, pad: pad, B: B });
    var gap = state.jigsaw ? 1.3 : 1;   // 凸塊會突出去，待放區間距要留大一點

    // 找出放得下的縮放比例，讓待放區的拼塊能全部排進去
    var n = state.count, t = 1, perRow = 1;
    for (t = 1; t > 0.3; t -= 0.02) {
      perRow = Math.max(1, Math.floor(tray.w / (c * t * gap)));
      if (Math.ceil(n / perRow) * c * t * gap <= tray.h) break;
    }
    state.t = t; state.perRow = perRow;

    var bw = c * cols, bh = c * rows, D = Math.max(bw, bh), ox = (bw - D) / 2, oy = (bh - D) / 2;
    board.style.cssText = 'left:' + bx + 'px;top:' + by + 'px;width:' + bw + 'px;height:' + bh + 'px';
    var g = board.querySelector('.ghost');
    g.style.backgroundSize = D + 'px ' + D + 'px';
    g.style.backgroundPosition = ox + 'px ' + oy + 'px';
    board.querySelectorAll('.cell').forEach(function (e) {
      e.style.cssText = 'left:' + e.dataset.c * c + 'px;top:' + e.dataset.r * c + 'px;width:' + c + 'px;height:' + c + 'px';
    });

    var rowsUsed = Math.ceil(n / perRow), slotW = c * t * gap;
    var gridW = Math.min(perRow, n) * slotW, gridH = rowsUsed * slotW;
    var sx = tray.x + (tray.w - gridW) / 2, sy = tray.y + (tray.h - gridH) / 2;
    state.slotAt = function (i) { return { x: sx + (i % perRow + 0.5) * slotW, y: sy + (Math.floor(i / perRow) + 0.5) * slotW }; };

    state.pieces.forEach(function (p) {
      var el = p.el, d = piecePath(p, pad, c);
      el.setAttribute('width', B); el.setAttribute('height', B);
      el.style.width = el.style.height = B + 'px';
      p.cpath.setAttribute('d', d); p.line.setAttribute('d', d);
      p.slotPath.setAttribute('d', piecePath(p, 0, c));
      p.slotPath.setAttribute('transform', 'translate(' + p.col * c + ' ' + p.row * c + ')');
      p.img.setAttribute('x', pad + ox - p.col * c); p.img.setAttribute('y', pad + oy - p.row * c);
      p.img.setAttribute('width', D); p.img.setAttribute('height', D);
      if (first) el.style.transition = 'none';
      if (p.done) place(p, targetOf(p), 1); else place(p, state.slotAt(p.slot), t);
      if (first) { el.getBoundingClientRect(); el.style.transition = ''; }
    });
  }

  function targetOf(p) { return { x: state.bx + (p.col + 0.5) * state.c, y: state.by + (p.row + 0.5) * state.c }; }
  function place(p, pt, scale) {
    p.el.style.left = (pt.x - state.B / 2) + 'px';
    p.el.style.top = (pt.y - state.B / 2) + 'px';
    p.el.style.transform = 'scale(' + scale + ')';
  }

  function bindDrag(p) {
    var el = p.el;
    el.addEventListener('pointerdown', function (e) {
      if (p.done) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('drag');
      p.pid = e.pointerId;
      move(e); 
      if (actx && actx.state === 'suspended') actx.resume();
    });
    el.addEventListener('pointermove', function (e) { if (p.pid === e.pointerId) move(e); });
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    function move(e) {
      var r = stage.getBoundingClientRect();
      place(p, { x: e.clientX - r.left, y: e.clientY - r.top }, 1.05);
    }
    function end(e) {
      if (p.pid !== e.pointerId) return;
      p.pid = null; el.classList.remove('drag');
      var r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, tg = targetOf(p);
      // 吸附範圍寬鬆：落在目標格半個半徑內即可
      if (Math.hypot(x - tg.x, y - tg.y) < state.c * 0.6) {
        p.done = true; el.classList.add('done', 'pop'); place(p, tg, 1);
        state.solved++; sndSnap();
        if (state.solved === state.count) setTimeout(finish, 500);
      } else {
        place(p, state.slotAt(p.slot), state.t); sndBack();
      }
    }
  }

  function finish() {
    sndWin();
    $('winPic').style.backgroundImage = 'url(' + IMAGES[state.imgIndex].src + ')';
    win.classList.remove('hidden');
    var emojis = ['🎉', '⭐', '🎈', '✨', '🌟', '🎊'];
    for (var i = 0; i < 30; i++) {
      var s = document.createElement('span'); s.className = 'confetti'; s.textContent = emojis[i % emojis.length];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.animationDuration = 2 + Math.random() * 2 + 's';
      s.style.animationDelay = Math.random() * 0.8 + 's';
      document.body.appendChild(s);
      setTimeout(function (el) { el.remove(); }.bind(null, s), 5000);
    }
  }

  /* ---------- 按鈕 ---------- */
  $('btnBack').onclick = function () { game.classList.add('hidden'); menu.classList.remove('hidden'); menu.scrollTop = state.menuScroll; };
  $('btnShuffle').onclick = function () { start(state.imgIndex); };
  $('btnHint').onclick = function () { board.classList.add('peek'); setTimeout(function () { board.classList.remove('peek'); }, 2000); };
  $('btnSound').onclick = function () { state.soundOn = !state.soundOn; this.textContent = state.soundOn ? '🔊' : '🔇'; };
  $('btnAgain').onclick = function () { start(state.imgIndex); };
  $('btnNext').onclick = function () {
    var list = indexesInCat(), at = list.indexOf(state.imgIndex);
    start(list.length ? list[(at + 1) % list.length] : (state.imgIndex + 1) % IMAGES.length);
  };

  var rt; window.addEventListener('resize', function () {
    clearTimeout(rt); rt = setTimeout(function () { if (!game.classList.contains('hidden')) layout(false); }, 100);
  });

  buildHome();
  if (window.PuzzleAds) PuzzleAds.show('home');

  /* ---------- PWA：註冊、安裝到主畫面、離線下載 ---------- */
  var deferredPrompt = null;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var swOk = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol);
  if (swOk) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; refreshPwaRows(); });
  window.addEventListener('appinstalled', function () { deferredPrompt = null; refreshPwaRows(); });

  function refreshPwaRows() {
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var showInstall = !!deferredPrompt && !standalone, showTip = ios && !standalone, showOffline = swOk;
    $('btnInstall').classList.toggle('hidden', !showInstall);
    $('installTip').classList.toggle('hidden', !showTip);
    $('btnOffline').classList.toggle('hidden', !showOffline);
    $('offlineStatus').classList.toggle('hidden', !showOffline);
    $('pwaRows').classList.toggle('hidden', !(showInstall || showTip || showOffline));
    var done = false; try { done = localStorage.getItem('puzzleOffline') === '1'; } catch (e) {}
    if (showOffline && !$('btnOffline').disabled) $('offlineStatus').textContent = done ? '✅ 圖片已下載，沒有網路也能玩（有新增圖片時可再按一次）' : '看過的圖片會自動存起來；想完全離線玩，可一次下載全部 ' + IMAGES.length + ' 張。';
  }
  $('btnInstall').onclick = function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () { deferredPrompt = null; refreshPwaRows(); });
  };
  $('btnOffline').onclick = function () {
    var btn = this, st = $('offlineStatus');
    btn.disabled = true; st.textContent = '準備下載…';
    navigator.serviceWorker.ready.then(function (reg) {
      var ch = new MessageChannel();
      ch.port1.onmessage = function (ev) {
        var d = ev.data;
        if (!d.finished) { st.textContent = '下載中… ' + d.done + ' / ' + d.total; return; }
        btn.disabled = false;
        if (d.failed) { st.textContent = '完成了，但有 ' + d.failed + ' 張沒下載成功，請確認網路後再按一次。'; return; }
        save('puzzleOffline', '1'); refreshPwaRows();
      };
      reg.active.postMessage({ type: 'cache-images', urls: IMAGES.map(function (im) { return new URL(im.src, location.href).href; }) }, [ch.port2]);
    }).catch(function () { btn.disabled = false; st.textContent = '目前無法下載，請稍後再試。'; });
  };

  // 網址直達：?cat=類別代號 開啟該類別；?img=圖片代號 直接開始拼（給搜尋結果與主題頁的連結使用）
  (function () {
    var q = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (p) {
      var kv = p.split('=');
      if (kv[0]) q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    if (q.img) {
      for (var i = 0; i < IMAGES.length; i++) {
        if (IMAGES[i].id === q.img) { openCat(IMAGES[i].cat); start(i); return; }
      }
    }
    if (q.cat && CATS.some(function (c) { return c.id === q.cat; })) openCat(q.cat);
  })();
})();
