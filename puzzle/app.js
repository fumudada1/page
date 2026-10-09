(function () {
  'use strict';

  var IMAGES = window.PUZZLE_IMAGES;
  var $ = function (id) { return document.getElementById(id); };
  var menu = $('menu'), game = $('game'), stage = $('stage'), board = $('board'), win = $('win');

  // 片數 → [直向或橫向] 的格子配置
  var SIZES = [9, 12, 16];
  var state = { count: 9, imgIndex: 0, cols: 3, rows: 3, pieces: [], c: 0, bx: 0, by: 0,
                tray: null, t: 1, soundOn: true, solved: 0 };

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
  function buildMenu() {
    var sizes = $('sizes'); sizes.innerHTML = '';
    SIZES.forEach(function (n) {
      var b = document.createElement('button');
      b.className = 'size-btn' + (n === state.count ? ' on' : '');
      b.innerHTML = n + '<small>片</small>';
      b.onclick = function () {
        state.count = n;
        try { localStorage.setItem('puzzleCount', n); } catch (e) {}
        buildMenu();
      };
      sizes.appendChild(b);
    });
    var gal = $('gallery'); gal.innerHTML = '';
    IMAGES.forEach(function (im, i) {
      var b = document.createElement('button');
      b.className = 'thumb';
      b.innerHTML = '<img src="' + im.src + '" alt="' + im.name + '"><span>' + im.name + '</span>';
      b.onclick = function () { start(i); };
      gal.appendChild(b);
    });
  }

  /* ---------- 遊戲 ---------- */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }

  function start(imgIndex) {
    state.imgIndex = imgIndex;
    menu.classList.add('hidden'); game.classList.remove('hidden'); win.classList.add('hidden');
    // 直式螢幕 12 片用 3 欄×4 列，橫式用 4 欄×3 列
    var portrait = stage.clientWidth < stage.clientHeight * 1.1;
    var n = state.count;
    state.cols = n === 9 ? 3 : n === 16 ? 4 : (portrait ? 3 : 4);
    state.rows = n / state.cols;
    buildPieces();
    layout(true);
  }

  function buildPieces() {
    stage.querySelectorAll('.piece').forEach(function (e) { e.remove(); });
    state.pieces = []; state.solved = 0;
    var src = IMAGES[state.imgIndex].src;
    board.innerHTML = '<div class="ghost"></div>';
    board.querySelector('.ghost').style.backgroundImage = 'url(' + src + ')';
    var order = shuffle(Array.apply(null, { length: state.count }).map(function (_, i) { return i; }));
    for (var r = 0; r < state.rows; r++) for (var c = 0; c < state.cols; c++) {
      var cell = document.createElement('div'); cell.className = 'cell'; cell.dataset.c = c; cell.dataset.r = r;
      board.appendChild(cell);
      var el = document.createElement('div');
      el.className = 'piece';
      el.style.backgroundImage = 'url(' + src + ')';
      stage.appendChild(el);
      var p = { el: el, col: c, row: r, done: false, slot: order[state.pieces.length] };
      state.pieces.push(p);
      bindDrag(p);
    }
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
    Object.assign(state, { c: c, bx: bx, by: by, tray: tray });

    // 找出放得下的縮放比例，讓待放區的拼塊能全部排進去
    var n = state.count, t = 1, perRow = 1;
    for (t = 1; t > 0.3; t -= 0.02) {
      perRow = Math.max(1, Math.floor(tray.w / (c * t)));
      if (Math.ceil(n / perRow) * c * t <= tray.h) break;
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

    var rowsUsed = Math.ceil(n / perRow), slotW = c * t;
    var gridW = Math.min(perRow, n) * slotW, gridH = rowsUsed * slotW;
    var sx = tray.x + (tray.w - gridW) / 2, sy = tray.y + (tray.h - gridH) / 2;
    state.slotAt = function (i) { return { x: sx + (i % perRow + 0.5) * slotW, y: sy + (Math.floor(i / perRow) + 0.5) * slotW }; };

    state.pieces.forEach(function (p) {
      var el = p.el;
      el.style.width = el.style.height = c + 'px';
      el.style.backgroundSize = D + 'px ' + D + 'px';
      el.style.backgroundPosition = (ox - p.col * c) + 'px ' + (oy - p.row * c) + 'px';
      if (first) el.style.transition = 'none';
      if (p.done) place(p, targetOf(p), 1); else place(p, state.slotAt(p.slot), t);
      if (first) { void el.offsetWidth; el.style.transition = ''; }
    });
  }

  function targetOf(p) { return { x: state.bx + (p.col + 0.5) * state.c, y: state.by + (p.row + 0.5) * state.c }; }
  function place(p, pt, scale) {
    p.el.style.left = (pt.x - state.c / 2) + 'px';
    p.el.style.top = (pt.y - state.c / 2) + 'px';
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
  $('btnBack').onclick = function () { game.classList.add('hidden'); menu.classList.remove('hidden'); };
  $('btnShuffle').onclick = function () { start(state.imgIndex); };
  $('btnHint').onclick = function () { board.classList.add('peek'); setTimeout(function () { board.classList.remove('peek'); }, 2000); };
  $('btnSound').onclick = function () { state.soundOn = !state.soundOn; this.textContent = state.soundOn ? '🔊' : '🔇'; };
  $('btnAgain').onclick = function () { start(state.imgIndex); };
  $('btnNext').onclick = function () { start((state.imgIndex + 1) % IMAGES.length); };

  var rt; window.addEventListener('resize', function () {
    clearTimeout(rt); rt = setTimeout(function () { if (!game.classList.contains('hidden')) layout(false); }, 100);
  });

  buildMenu();
})();
