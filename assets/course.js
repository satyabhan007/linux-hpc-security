/* linux-hpc-security Learn — shared course renderer for Parts 2-5.
 *
 * Data model (loaded before this file):
 *   assets/manifest.js  -> window.PART = { num, kicker, heroTitle, heroSub,
 *                                          standardNote, prev?, next?,
 *                                          chapters:[{num,emoji,title,layer,tagline,apps:[]}] }
 *   assets/ch/NN.js      -> window.CH[N] = { levels:[5x {html, try:[[label,url,'o']]}],
 *                                            quiz:[3x {q,opts,ok,why}] }   (lazy-loaded on demand)
 *
 * Part 1 (learn/) keeps its own monolithic assets/course.js + course-data.js
 * (21 chapters x 6 levels) and is untouched — this file only powers learn2..learn5.
 */
(function () {
  'use strict';

  var PART = window.PART;
  if (!PART) { return; }
  var META = PART.chapters;
  var N = META.length;
  var CH = window.CH = window.CH || {};                 /* chapter bodies, filled by assets/ch/NN.js */
  var KEY = 'lhs-learn-progress-' + PART.num;            /* namespaced so P2..P5 don't collide with P1 */
  var app = document.getElementById('view');

  /* every part, for the cross-part nav row (the current one is rendered inert) */
  var PARTS = [
    { n: 1, ic: '🐧', href: '../learn/' },
    { n: 2, ic: '🧠', href: '../learn2/' },
    { n: 3, ic: '🖥️', href: '../learn3/' },
    { n: 4, ic: '🛡️', href: '../learn4/' },
    { n: 5, ic: '📡', href: '../learn5/' }
  ];

  /* ---------- progress ---------- */
  function loadP() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function saveP(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  var PROG = loadP();
  function chProg(n) { if (!PROG['ch' + n]) PROG['ch' + n] = { lv: 0, quiz: false }; return PROG['ch' + n]; }
  function chPct(n) { var p = chProg(n); return p.quiz ? 100 : Math.round(p.lv / 5 * 80); }
  function totalPct() { var s = 0; for (var i = 0; i < N; i++) s += chPct(META[i].num); return Math.round(s / N); }
  function resumeChapter() {
    /* first chapter that is started-but-not-finished, else first unfinished, else 1 */
    for (var i = 0; i < N; i++) { var p = chProg(META[i].num); if (p.lv > 0 && !p.quiz) return META[i].num; }
    for (var j = 0; j < N; j++) { if (!chProg(META[j].num).quiz) return META[j].num; }
    return 1;
  }

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function partNavLinks(sep) {
    return PARTS.map(function (p) {
      if (p.n === PART.num) return '<span style="opacity:.45">' + p.ic + ' P' + p.n + '</span>';
      return '<a href="' + p.href + '">' + p.ic + ' P' + p.n + '</a>';
    }).join(sep || '');
  }
  function footer(extraFirst) {
    return '<footer class="c-foot"><div class="links">' +
      (extraFirst || '<a href="../">← Main site</a>') +
      partNavLinks('') +
      '<a href="https://github.com/satyabhan007/linux-hpc-security" target="_blank" rel="noopener">💻 GitHub</a>' +
      '<a href="https://satyabhan007.github.io/" target="_blank" rel="noopener">🌐 Portfolio</a>' +
      '<a href="https://www.linkedin.com/in/satyabhan-bhadoriya-777b28239/" target="_blank" rel="noopener">💼 LinkedIn</a></div>' +
      '<div>Standard tools, operated at production depth · © ' + new Date().getFullYear() + ' · linux-hpc-security by Satyabhan</div></footer>';
  }
  function pathStrip() {
    return '<div class="pathstrip">' + PARTS.map(function (p) {
      if (p.n === PART.num) return '<span class="cur">P' + p.n + '</span>';
      return '<a href="' + p.href + '">P' + p.n + '</a>';
    }).join('<span>→</span>') + '</div>';
  }

  /* ---------- lazy chapter loader ---------- */
  var pending = {};
  function loadChapter(n, cb) {
    if (CH[n]) { cb(CH[n]); return; }
    if (pending[n]) { pending[n].push(cb); return; }
    pending[n] = [cb];
    var s = document.createElement('script');
    s.src = 'assets/ch/' + pad(n) + '.js';
    s.onload = function () { var q = pending[n]; pending[n] = null; q.forEach(function (f) { f(CH[n] || null); }); };
    s.onerror = function () { var q = pending[n]; pending[n] = null; q.forEach(function (f) { f(null); }); };
    document.head.appendChild(s);
  }
  function prefetch(n) {
    if (n < 1 || n > N || CH[n] || pending[n]) return;
    var go = function () { loadChapter(n, function () {}); };
    if (window.requestIdleCallback) requestIdleCallback(go); else setTimeout(go, 400);
  }

  /* ---------- HUB ---------- */
  function renderHub() {
    var doneAll = 0, cards = '';
    META.forEach(function (c) {
      var p = chProg(c.num);
      if (p.quiz) doneAll++;
      var chips = '';
      for (var i = 1; i <= 5; i++) chips += '<span class="chip' + (p.lv >= i ? ' done' : '') + '">L' + i + '</span>';
      var apps = (c.apps || []).map(function (a) { return '<span class="app-chip">' + esc(a) + '</span>'; }).join('');
      cards +=
        '<a class="chcard" href="#ch' + c.num + '">' +
        (p.quiz ? '<span class="done-badge">🏅</span>' : '') +
        '<span class="emoji">' + c.emoji + '</span>' +
        '<span class="tag">' + esc(c.layer) + '</span>' +
        '<h3>' + c.num + '. ' + esc(c.title) + '</h3>' +
        '<p class="t">' + esc(c.tagline) + '</p>' +
        '<div class="apps">' + apps + '</div>' +
        '<div class="lvlchips">' + chips + '</div>' +
        '<span class="open">Start exploring →</span></a>';
    });
    var tot = totalPct();
    var rc = resumeChapter();
    var startedAny = false;
    for (var k = 0; k < N; k++) { if (chProg(META[k].num).lv > 0) { startedAny = true; break; } }

    app.innerHTML =
      '<section class="c-hero"><h1>' + esc(PART.kicker) + ' — <span>' + PART.heroTitle + '</span></h1>' +
      '<p class="sub">' + PART.heroSub + '</p>' +
      (PART.prev ? '<p class="sub"><a href="' + PART.prev.href + '" style="color:var(--cyan)">← ' + esc(PART.prev.label) + '</a></p>' : '') +
      '<div class="c-meta"><span><b>' + N + '</b> chapters</span><span><b>5</b> levels each</span>' +
      '<span><b>' + (N * 5) + '</b> lessons</span><span><b>' + (N * 3) + '</b> checkpoint questions</span>' +
      '<span><b>0</b> prerequisites</span></div>' +
      (PART.standardNote ? '<p class="foot-note">🔧 <b>Standard tools, at production depth.</b> ' + PART.standardNote + '</p>' : '') +
      (startedAny ? '<div><button class="hub-resume" id="resumeBtn">▶ Continue — Chapter ' + rc + '. ' + esc(META[rc - 1].title) + '</button></div>' : '') +
      pathStrip() +
      '</section>' +
      '<div class="prog-wrap"><div class="prog-track"><div class="prog-fill" style="width:' + tot + '%"></div></div>' +
      '<p class="prog-txt">Overall progress: ' + tot + '% · ' + doneAll + '/' + N + ' chapters completed' +
      (doneAll === N ? ' — 🎉 Part complete!' + (PART.next ? ' Next up: <a href="' + PART.next.href + '" style="color:var(--cyan)">' + esc(PART.next.label) + ' →</a>' : '') : ' — pick any chapter below') + '</p></div>' +
      '<div class="chgrid">' + cards + '</div>' +
      (PART.next ? '<a class="nextcard" href="' + PART.next.href + '"><span class="kick">When you finish this part</span>' +
        '<span class="nt">' + esc(PART.next.label) + ' →</span>' +
        '<span class="nd">The curriculum continues — keep the momentum.</span></a>' : '') +
      footer();

    var rb = document.getElementById('resumeBtn');
    if (rb) rb.onclick = function () { location.hash = '#ch' + rc; };
    window.scrollTo(0, 0);
  }

  /* ---------- CHAPTER VIEW ---------- */
  var LEVEL_NAMES = ['🐣 Amateur', '🌱 Beginner', '⚙️ Builder', '🎯 Advanced', '🚀 Expert'];
  var curLv = 1;

  function renderChapter(n) {
    var meta = META[n - 1];
    if (!meta) { location.hash = ''; return; }
    app.innerHTML = '<nav class="crumb"><a href="#/">← All chapters</a><span class="sep">/</span><span>' +
      meta.emoji + ' ' + esc(meta.title) + '</span></nav><div class="ch-loading">Loading Chapter ' + n + '…</div>';
    loadChapter(n, function (body) {
      if (!body || !body.levels) {
        app.innerHTML = '<nav class="crumb"><a href="#/">← All chapters</a></nav>' +
          '<div class="ch-error">Chapter ' + n + ' isn\'t published yet — it lands in a later phase.<br>' +
          '<a href="#/" style="color:var(--cyan)">← Back to all chapters</a></div>' + footer();
        return;
      }
      paintChapter(n, meta, body);
      prefetch(n + 1);
    });
  }

  function paintChapter(n, meta, body) {
    var c = {
      num: meta.num, emoji: meta.emoji, title: meta.title, layer: meta.layer,
      tagline: meta.tagline, apps: meta.apps || [], levels: body.levels, quiz: body.quiz || []
    };
    var p = chProg(n);
    var maxLv = Math.max(p.lv, 1);
    if (curLv > 5) curLv = 5; if (curLv < 1) curLv = 1;

    var tabs = '';
    for (var i = 1; i <= 5; i++) {
      var locked = i > maxLv && i > 1;
      tabs += '<button data-lv="' + i + '" class="' + (i === curLv ? 'active' : '') + '"' +
        (locked ? ' title="Finish the previous level to unlock"' : '') + '>' +
        LEVEL_NAMES[i - 1] + (p.lv >= i ? ' ✓' : '') + (locked ? ' 🔒' : '') + '</button>';
    }

    var lv = c.levels[curLv - 1] || { html: '<p>Coming soon.</p>' };
    var apps = c.apps.map(function (a) { return '<span class="app-chip">' + esc(a) + '</span>'; }).join('');
    var tryLinks = (lv.try || []).map(function (t) {
      return '<a class="' + (t[2] === 'p' ? 'p' : 'o') + '" href="' + t[1] + '"' +
        (/^https?:/.test(t[1]) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(t[0]) + '</a>';
    }).join('');

    var quizHtml = '';
    if (curLv === 5 && c.quiz.length) {
      quizHtml = '<section class="quiz" id="quiz"><h2>🎖️ Checkpoint — ' + esc(c.title) + '</h2>' +
        '<p class="sub">Answer all ' + c.quiz.length + ' correctly to complete this chapter.</p>' +
        c.quiz.map(function (q, qi) {
          return '<div class="qq" data-qi="' + qi + '"><p class="q">' + (qi + 1) + '. ' + esc(q.q) + '</p>' +
            q.opts.map(function (o, oi) {
              return '<label><input type="radio" name="q' + qi + '" value="' + oi + '"> ' + esc(o) + '</label>';
            }).join('') + '<p class="why"></p></div>';
        }).join('') +
        '<div class="actions"><button id="checkQuiz">Check my answers</button><span class="score"></span></div></section>';
    }

    /* recommended-next block */
    var nextBlock;
    if (n < N) {
      var nm = META[n];
      nextBlock = '<a class="nextcard" href="#ch' + nm.num + '"><span class="kick">Recommended next</span>' +
        '<span class="nt">' + nm.emoji + ' Chapter ' + nm.num + '. ' + esc(nm.title) + '</span>' +
        '<span class="nd">' + esc(nm.tagline) + '</span></a>';
    } else if (PART.next) {
      nextBlock = '<a class="nextcard" href="' + PART.next.href + '"><span class="kick">You finished ' + esc(PART.kicker) + ' 🎉</span>' +
        '<span class="nt">Start ' + esc(PART.next.label) + ' →</span>' +
        '<span class="nd">Keep going — the next part builds on this one.</span></a>';
    } else {
      nextBlock = '<a class="nextcard" href="#/"><span class="kick">Last chapter</span>' +
        '<span class="nt">Back to all chapters →</span><span class="nd">Revisit anything, or take the checkpoints.</span></a>';
    }

    var prevCh = n > 1
      ? '<a href="#ch' + (n - 1) + '">← Ch ' + (n - 1) + '. ' + esc(META[n - 2].title) + '</a>'
      : '<span class="disabled">← Start of part</span>';
    var nextCh = n < N
      ? '<a class="nx" href="#ch' + (n + 1) + '">Ch ' + (n + 1) + '. ' + esc(META[n].title) + ' →</a>'
      : '<span class="disabled nx">End of part →</span>';

    app.innerHTML =
      '<nav class="crumb"><a href="#/">← All chapters</a><span class="sep">/</span><span>' + c.emoji + ' ' + esc(c.title) + '</span>' +
      '<span class="sep">·</span><span>' + esc(PART.kicker) + '</span></nav>' +
      '<header class="ch-head"><span class="emoji">' + c.emoji + '</span><div>' +
      '<span class="tag" style="color:var(--cyan);font-size:.72rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase">' + esc(c.layer) + '</span>' +
      '<h1>' + c.num + '. ' + esc(c.title) + '</h1><p class="t">' + esc(c.tagline) + '</p>' +
      '<div class="app-row">' + apps + '</div></div></header>' +
      '<div class="lvltabs">' + tabs + '</div>' +
      '<section class="panel active"><h2>' + LEVEL_NAMES[curLv - 1] + '</h2>' + lv.html +
      (tryLinks ? '<div class="try">' + tryLinks + '</div>' : '') +
      '<div class="lvlnav"><button id="prevLv"' + (curLv === 1 ? ' disabled' : '') + '>← Previous</button>' +
      '<button id="nextLv"' + (curLv === 5 ? ' disabled' : '') + '>' + (curLv === 4 ? 'Final level →' : 'Next level →') + '</button></div></section>' +
      quizHtml +
      nextBlock +
      '<div class="chapnav">' + prevCh + nextCh + '</div>' +
      footer('<a href="#/">← All chapters</a>');

    document.getElementById('prevLv').onclick = function () { if (curLv > 1) { curLv--; paintChapter(n, meta, body); } };
    document.getElementById('nextLv').onclick = function () {
      if (curLv < 5) {
        if (curLv >= maxLv && curLv + 1 > p.lv) { p.lv = curLv + 1; saveP(PROG); }
        curLv++; paintChapter(n, meta, body);
      }
    };
    Array.prototype.forEach.call(document.querySelectorAll('.lvltabs button'), function (b) {
      b.onclick = function () { curLv = +b.getAttribute('data-lv'); paintChapter(n, meta, body); };
    });
    if (curLv === 5 && c.quiz.length) wireQuiz(c, p);
    window.scrollTo(0, 0);
  }

  function wireQuiz(c, p) {
    var btn = document.getElementById('checkQuiz');
    if (!btn) return;
    btn.onclick = function () {
      var allOk = true, shownAny = false;
      c.quiz.forEach(function (q, qi) {
        var box = document.querySelector('.qq[data-qi="' + qi + '"]');
        var sel = box.querySelector('input:checked');
        var why = box.querySelector('.why');
        if (!sel) { allOk = false; return; }
        shownAny = true;
        if (+sel.value === q.ok) { why.className = 'why ok'; why.textContent = '✅ Correct — ' + q.why; }
        else { allOk = false; why.className = 'why bad'; why.textContent = '❌ Not quite. ' + q.why; }
      });
      var sc = document.querySelector('.quiz .score');
      if (!shownAny) { sc.textContent = 'Pick an answer for each question first.'; sc.className = 'score'; return; }
      if (allOk) {
        p.quiz = true; p.lv = 5; saveP(PROG);
        sc.textContent = '🏅 Perfect! Chapter complete — progress saved.';
        sc.className = 'score all';
      } else {
        sc.textContent = 'Review the explanations above and try again.';
        sc.className = 'score';
      }
    };
  }

  /* ---------- keyboard nav (chapter view only) ---------- */
  document.addEventListener('keydown', function (e) {
    if (!/^#ch\d+$/.test(location.hash)) return;
    var t = (e.target && e.target.tagName) || '';
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    var n = +location.hash.match(/^#ch(\d+)$/)[1];
    if (e.key === 'ArrowRight') {
      var nx = document.getElementById('nextLv');
      if (nx && !nx.disabled) nx.click();
      else if (n < N) location.hash = '#ch' + (n + 1);
    } else if (e.key === 'ArrowLeft') {
      var pv = document.getElementById('prevLv');
      if (pv && !pv.disabled) pv.click();
      else if (n > 1) location.hash = '#ch' + (n - 1);
    }
  });

  /* ---------- router ---------- */
  function route() {
    var m = location.hash.match(/^#ch(\d+)$/);
    if (m) { var n = +m[1]; if (META[n - 1]) { curLv = Math.max(chProg(n).lv, 1); renderChapter(n); return; } }
    renderHub();
  }
  window.addEventListener('hashchange', route);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', route);
  else route();
})();
