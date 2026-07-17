/* =====================================================================
   Intro to Web & Cloud — Study Site · app.js
   Implements CONTRACT.md §7 (no dependencies, vanilla JS).
   Runs on every page. Degrades gracefully if a feature's markup absent.
   ===================================================================== */
(function () {
  'use strict';

  var PROGRESS_KEY = 'web-progress';
  var TOTAL_MODULES = 18; // per MODULE_MAP (12 topic pages + gotchas + 5 exam pages)

  /* ---------- progress store ---------- */
  function readProgress() {
    try {
      var raw = localStorage.getItem(PROGRESS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }
  function writeProgress(arr) {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(arr));
    } catch (e) { /* storage disabled — silently ignore */ }
  }
  function isDone(id) { return readProgress().indexOf(id) !== -1; }
  function setDone(id, done) {
    var arr = readProgress();
    var i = arr.indexOf(id);
    if (done && i === -1) arr.push(id);
    else if (!done && i !== -1) arr.splice(i, 1);
    writeProgress(arr);
    return arr;
  }

  /* current page's module id — from an element that declares it */
  function currentModuleId() {
    var b = document.body;
    if (b && b.getAttribute('data-module')) return b.getAttribute('data-module');
    var mh = document.querySelector('.module-header[data-module]');
    if (mh) return mh.getAttribute('data-module');
    var md = document.querySelector('[data-current-module]');
    if (md) return md.getAttribute('data-current-module');
    return null;
  }

  /* =====================================================================
     §7.1  Sidebar — mark .active (current) + .done (from storage)
     ===================================================================== */
  function refreshSidebar() {
    var done = readProgress();
    var current = currentModuleId();
    var links = document.querySelectorAll('.nav-link[data-module]');
    for (var i = 0; i < links.length; i++) {
      var m = links[i].getAttribute('data-module');
      if (done.indexOf(m) !== -1) links[i].classList.add('done');
      else links[i].classList.remove('done');
      if (current && m === current) links[i].classList.add('active');
    }
    updateSidebarBar(done.length);
  }

  function updateSidebarBar(count) {
    var pct = Math.round((count / TOTAL_MODULES) * 100);
    var fill = document.querySelector('.sidebar-progress .fill');
    if (fill) fill.style.width = pct + '%';
    var num = document.querySelector('.sidebar-progress .lbl [data-prog-count]');
    if (num) num.textContent = count + '/' + TOTAL_MODULES;
  }

  /* =====================================================================
     §7.2  "סמן כהושלם" toggle in module header/footer
     ===================================================================== */
  // hoisted so the cross-tab 'storage' handler can repaint without re-binding
  function repaintMarkDone() {
    var id = currentModuleId();
    var buttons = document.querySelectorAll('.mark-done');
    var done = id ? isDone(id) : false;
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      btn.classList.toggle('is-done', done);
      btn.setAttribute('aria-pressed', done ? 'true' : 'false');
      var lbl = btn.querySelector('.lbl');
      var text = done ? 'הושלם ✓' : 'סמן כהושלם';
      if (lbl) lbl.textContent = text;
      else if (!btn.querySelector('.ico')) btn.textContent = text;
    }
  }

  function initMarkDone() {
    var id = currentModuleId();
    var buttons = document.querySelectorAll('.mark-done');
    if (!buttons.length) return;

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () {
        if (!id) return;
        setDone(id, !isDone(id));
        repaintMarkDone();
        refreshSidebar();
        updateIndexProgress(); // no-op off the hub
      });
    }
    repaintMarkDone();
  }

  /* =====================================================================
     §7.3a  reveal toggles
     ===================================================================== */
  function initReveals() {
    var btns = document.querySelectorAll('.reveal-btn');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        var body = btn.parentNode.querySelector('.reveal-body');
        if (!body) return;
        var expanded = !body.hasAttribute('hidden');
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        var openText = btn.getAttribute('data-hide') || 'הסתר פתרון';
        var shutText = btn.textContent.trim() || 'הצג פתרון';
        btn.addEventListener('click', function () {
          var isHidden = body.hasAttribute('hidden');
          if (isHidden) {
            body.removeAttribute('hidden');
            btn.setAttribute('aria-expanded', 'true');
            btn.textContent = openText;
          } else {
            body.setAttribute('hidden', '');
            btn.setAttribute('aria-expanded', 'false');
            btn.textContent = shutText;
          }
        });
      })(btns[i]);
    }
  }

  /* =====================================================================
     §7.3b  quiz logic + Hebrew feedback (lock after answer)
     ===================================================================== */
  var FEEDBACK_OK = 'נכון! ';
  var FEEDBACK_BAD = 'לא מדויק. ';

  function initQuizzes() {
    var quizzes = document.querySelectorAll('.quiz[data-quiz]');
    for (var q = 0; q < quizzes.length; q++) {
      (function (quiz) {
        var opts = quiz.querySelectorAll('.quiz-opts button');
        var feedback = quiz.querySelector('.quiz-feedback');
        var answered = false;

        function onPick(btn) {
          if (answered) return;
          answered = true;
          var correct = btn.getAttribute('data-correct') === 'true';

          // lock all, reveal the correct one
          for (var i = 0; i < opts.length; i++) {
            opts[i].disabled = true;
            if (opts[i].getAttribute('data-correct') === 'true') {
              opts[i].classList.add('reveal-correct');
            }
          }
          btn.classList.remove('reveal-correct');
          btn.classList.add(correct ? 'correct' : 'incorrect');

          if (feedback) {
            var custom = btn.getAttribute('data-feedback');
            var base = correct ? FEEDBACK_OK : FEEDBACK_BAD;
            feedback.innerHTML = custom ? (base + custom) : base
              + (correct ? 'כל הכבוד.' : 'התשובה הנכונה מסומנת בירוק.');
            feedback.classList.remove('ok', 'bad');
            feedback.classList.add(correct ? 'ok' : 'bad');
            feedback.removeAttribute('hidden');
          }
        }

        for (var i = 0; i < opts.length; i++) {
          (function (btn) {
            btn.addEventListener('click', function () { onPick(btn); });
          })(opts[i]);
        }
      })(quizzes[q]);
    }
  }

  /* =====================================================================
     §7.3c  nav-toggle (mobile sidebar)
     ===================================================================== */
  function initNavToggle() {
    var toggle = document.querySelector('.nav-toggle');
    if (!toggle) return;

    // ensure a backdrop exists
    var backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    function open() {
      document.body.classList.add('nav-open');
      toggle.setAttribute('aria-expanded', 'true');
    }
    function close() {
      document.body.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', function () {
      if (document.body.classList.contains('nav-open')) close();
      else open();
    });
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    // close after navigating from a sidebar link (mobile)
    var links = document.querySelectorAll('.sidebar a[href]');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function () {
        if (window.matchMedia('(max-width: 860px)').matches) close();
      });
    }
  }

  /* =====================================================================
     §7.4  glossary tooltip binder
     fetch glossary-terms.json — path must work from root AND topics/
     ===================================================================== */
  var glossaryCache = null;

  // topic pages live under /topics/ → need ../ ; root pages (index/glossary) use ./
  // Compute the right path upfront so we never fire a 404 probe (which logs a console error).
  function glossaryDataUrl() {
    var inTopics = location.pathname.indexOf('/topics/') !== -1;
    return (inTopics ? '../' : './') + 'assets/data/glossary-terms.json';
  }

  function loadGlossary() {
    if (glossaryCache) return Promise.resolve(glossaryCache);
    return fetch(glossaryDataUrl())
      .then(function (r) { if (!r.ok) throw new Error('not ok'); return r.json(); })
      .then(function (data) { glossaryCache = Array.isArray(data) ? data : []; return glossaryCache; })
      .catch(function () { return []; }); // file:// or missing → tooltips degrade silently
  }

  // resolve the glossary.html href correctly from root or topics/
  function glossaryHref() {
    // prefer an existing sidebar link so it always matches the page's own paths
    var link = document.querySelector('a[href$="glossary.html"]');
    if (link) return link.getAttribute('href');
    // fallback: infer from location (topic pages live under /topics/)
    return location.pathname.indexOf('/topics/') !== -1 ? '../glossary.html' : 'glossary.html';
  }

  function initTermTooltips() {
    var terms = document.querySelectorAll('.term[data-term]');
    if (!terms.length) return;

    loadGlossary().then(function (list) {
      if (!list.length) return;
      var bySlug = {};
      for (var i = 0; i < list.length; i++) {
        var ge = list[i];
        if (!ge) continue;
        if (ge.slug != null) bySlug[String(ge.slug).toLowerCase()] = ge;         // primary key = slug (matches data-term)
        var tk = ge.term != null ? String(ge.term).toLowerCase() : null;         // fallback key = term text
        if (tk && bySlug[tk] == null) bySlug[tk] = ge;
      }
      var gHref = glossaryHref();

      // single reusable tip element
      var tip = document.createElement('div');
      tip.className = 'term-tip';
      tip.setAttribute('role', 'tooltip');
      document.body.appendChild(tip);
      var hideTimer = null;
      var activeEl = null;

      function fill(entry) {
        var link = gHref + '#' + encodeURIComponent(String(entry.slug || entry.term).toLowerCase());
        var cat = entry.category ? '<span class="tip-cat">' + esc(entry.category) + '</span>' : '';
        tip.innerHTML =
          '<span class="tip-term">' + esc(entry.term) + '</span>' +
          cat +
          '<div class="tip-def">' + esc(entry.he || '') + '</div>' +
          '<a href="' + esc(link) + '">מילון ↗</a>';
      }

      function positionTip(el) {
        var r = el.getBoundingClientRect();
        tip.style.left = '-9999px';
        tip.classList.add('show');
        var tw = tip.offsetWidth, th = tip.offsetHeight;
        var top = window.scrollY + r.top - th - 8;
        if (top < window.scrollY + 4) top = window.scrollY + r.bottom + 8; // flip below
        var centre = window.scrollX + r.left + r.width / 2 - tw / 2;
        var minL = window.scrollX + 8;
        var maxL = window.scrollX + document.documentElement.clientWidth - tw - 8;
        if (centre < minL) centre = minL;
        if (centre > maxL) centre = maxL;
        tip.style.top = top + 'px';
        tip.style.left = centre + 'px';
      }

      function show(el, entry) {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        activeEl = el;
        fill(entry);
        positionTip(el);
      }
      function hide() {
        activeEl = null;
        tip.classList.remove('show');
      }
      function scheduleHide() {
        hideTimer = setTimeout(hide, 120);
      }

      tip.addEventListener('mouseenter', function () {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      });
      tip.addEventListener('mouseleave', scheduleHide);
      window.addEventListener('scroll', function () { if (activeEl) hide(); }, { passive: true });

      for (var i = 0; i < terms.length; i++) {
        (function (el) {
          var slug = (el.getAttribute('data-term') || el.textContent || '').toLowerCase();
          var entry = bySlug[slug];
          if (!entry) return; // no glossary match → plain text (still styled)
          if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
          el.setAttribute('aria-label', entry.term + ' — ' + (entry.he || ''));
          el.addEventListener('mouseenter', function () { show(el, entry); });
          el.addEventListener('mouseleave', scheduleHide);
          el.addEventListener('focus', function () { show(el, entry); });
          el.addEventListener('blur', hide);
        })(terms[i]);
      }
    });
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* =====================================================================
     §7.5  index.html progress ring + bar (reads same storage)
     ===================================================================== */
  function updateIndexProgress() {
    var count = readProgress().length;
    var pct = Math.round((count / TOTAL_MODULES) * 100);

    // ring
    var ring = document.querySelector('.progress-ring .ring-fg');
    if (ring) {
      var r = parseFloat(ring.getAttribute('r')) || 34;
      var circ = 2 * Math.PI * r;
      ring.style.strokeDasharray = circ.toFixed(1);
      ring.style.strokeDashoffset = (circ * (1 - count / TOTAL_MODULES)).toFixed(1);
    }
    var ringNum = document.querySelector('.progress-ring .ring-num');
    if (ringNum) ringNum.textContent = count + '/' + TOTAL_MODULES;

    // bar
    var fill = document.querySelector('.hub-progress .prog-meta .fill');
    if (fill) fill.style.width = pct + '%';
    var countEl = document.querySelector('.hub-progress [data-prog-count]');
    if (countEl) countEl.textContent = count + '/' + TOTAL_MODULES;

    // roadmap module cards done state
    var cards = document.querySelectorAll('.module-card[data-module]');
    var done = readProgress();
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.toggle('done', done.indexOf(cards[i].getAttribute('data-module')) !== -1);
    }
  }

  /* =====================================================================
     GLOSSARY PAGE — search + category filter (progressive; degrades if absent)
     ===================================================================== */
  function initGlossaryPage() {
    var list = document.querySelector('.glossary-list');
    var search = document.querySelector('.glossary-search');
    if (!list) return; // not the glossary page

    var cards = list.querySelectorAll('.term-card');
    var chips = document.querySelectorAll('.filter-chip');
    var countEl = document.querySelector('.glossary-count [data-count]');
    var emptyEl = document.querySelector('.glossary-empty');
    var activeCat = 'all';

    function apply() {
      var qRaw = (search && search.value || '').trim().toLowerCase();
      var shown = 0;
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var cat = (card.getAttribute('data-category') || '').toLowerCase();
        var hay = (card.textContent || '').toLowerCase();
        var okCat = activeCat === 'all' || cat === activeCat.toLowerCase();
        var okText = !qRaw || hay.indexOf(qRaw) !== -1;
        var vis = okCat && okText;
        card.style.display = vis ? '' : 'none';
        if (vis) shown++;
      }
      if (countEl) countEl.textContent = shown;
      if (emptyEl) emptyEl.style.display = shown ? 'none' : '';
    }

    if (search) search.addEventListener('input', apply);
    for (var i = 0; i < chips.length; i++) {
      (function (chip) {
        chip.addEventListener('click', function () {
          for (var j = 0; j < chips.length; j++) chips[j].classList.remove('active');
          chip.classList.add('active');
          activeCat = chip.getAttribute('data-cat') || 'all';
          apply();
        });
      })(chips[i]);
    }
    apply();
  }

  /* =====================================================================
     VIDEO FACADES — fix YouTube embeds (esp. when opened from disk via file://)
     Show a poster + play button; defer the iframe until the user clicks.
     On http the iframe plays inline; on file:// (double-clicked) it opens
     YouTube in a new tab (embeds error out with no http origin).
     ===================================================================== */
  function injectCSS(id, css) {
    if (document.getElementById(id)) return;
    var s = document.createElement('style');
    s.id = id; s.textContent = css; document.head.appendChild(s);
  }

  function initVideoFacades() {
    var wraps = document.querySelectorAll('.video-embed');
    if (!wraps.length) return;
    injectCSS('cn-video-facade-css',
      '.video-frame{position:relative}' +
      '.video-facade{position:absolute;inset:0;width:100%;height:100%;border:0;padding:0;cursor:pointer;' +
        'background-size:cover;background-position:center;border-radius:inherit;display:flex;align-items:center;justify-content:center}' +
      '.video-facade::before{content:"";position:absolute;inset:0;background:rgba(30,26,22,.28);border-radius:inherit}' +
      '.video-play{position:relative;width:68px;height:48px;border-radius:14px;background:#cc2b28;' +
        'display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.35);transition:transform .15s}' +
      '.video-facade:hover .video-play{transform:scale(1.08)}' +
      '.video-play::after{content:"";border-style:solid;border-width:11px 0 11px 18px;' +
        'border-color:transparent transparent transparent #fff;margin-inline-start:4px}' +
      '.video-ext{display:inline-block;margin-top:.5rem;font-size:.9rem;color:var(--ink-soft,#6B655C);' +
        'text-decoration:none;border-bottom:1px dashed currentColor}' +
      '.video-ext:hover{color:var(--clay,#BE7C5E)}');
    var isFile = location.protocol === 'file:';
    for (var i = 0; i < wraps.length; i++) {
      (function (wrap) {
        var iframe = wrap.querySelector('iframe');
        if (!iframe) return;
        var src = iframe.getAttribute('src') || '';
        var m = src.match(/embed\/([A-Za-z0-9_-]{6,})/);
        if (!m) return;
        var id = m[1];
        var box = iframe.parentNode; // .video-frame
        iframe.removeAttribute('src');    // defer load until click
        iframe.style.display = 'none';
        var facade = document.createElement('button');
        facade.type = 'button';
        facade.className = 'video-facade';
        facade.setAttribute('aria-label', 'נגן את הסרטון');
        facade.style.backgroundImage = "url('https://i.ytimg.com/vi/" + id + "/hqdefault.jpg')";
        facade.innerHTML = '<span class="video-play" aria-hidden="true"></span>';
        box.appendChild(facade);
        var ext = document.createElement('a');
        ext.className = 'video-ext';
        ext.href = 'https://www.youtube.com/watch?v=' + id;
        ext.target = '_blank'; ext.rel = 'noopener';
        ext.textContent = 'פתח ב-YouTube ↗';
        wrap.appendChild(ext);
        facade.addEventListener('click', function () {
          if (isFile) { window.open('https://www.youtube.com/watch?v=' + id, '_blank', 'noopener'); return; }
          iframe.setAttribute('src', 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0');
          iframe.style.display = '';
          if (facade.parentNode) facade.parentNode.removeChild(facade);
        });
      })(wraps[i]);
    }
  }

  /* =====================================================================
     BOOT
     ===================================================================== */
  /* =====================================================================
     SECTION TRACKER (scrollspy) — left-side in-page TOC for topic pages.
     Lists the module's <h2> sections and highlights the current one on scroll.
     Only built on topic pages; only shown on wide screens (see style.css).
     ===================================================================== */
  function initSectionTracker() {
    var mod = document.body.getAttribute('data-module') || '';
    if (!/^\d{2}-/.test(mod)) return;                // topic pages only (01-.. .. 12-..)
    var main = document.querySelector('main.content');
    if (!main) return;
    var heads = main.querySelectorAll('h2');
    if (heads.length < 3) return;                    // not worth it on short pages
    var headings = [];
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      if (!h.id) h.id = 'sec-' + (i + 1);
      h.style.scrollMarginTop = '1rem';
      headings.push(h);
    }
    var nav = document.createElement('nav');
    nav.className = 'section-tracker';
    nav.setAttribute('aria-label', 'ניווט בתוך הפרק');
    var title = document.createElement('div');
    title.className = 'st-title';
    title.textContent = 'בפרק זה';
    nav.appendChild(title);
    var ul = document.createElement('ul');
    for (var j = 0; j < headings.length; j++) {
      (function (hd) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + hd.id;
        a.textContent = (hd.textContent || '').trim();
        a.setAttribute('data-target', hd.id);
        a.addEventListener('click', function (e) {
          e.preventDefault();
          hd.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (history.replaceState) history.replaceState(null, '', '#' + hd.id);
        });
        li.appendChild(a);
        ul.appendChild(li);
      })(headings[j]);
    }
    nav.appendChild(ul);
    document.body.appendChild(nav);
    document.body.classList.add('has-tracker');
    var links = nav.querySelectorAll('a');
    function setActive(id) {
      for (var i = 0; i < links.length; i++) {
        links[i].classList.toggle('active', links[i].getAttribute('data-target') === id);
      }
    }
    function onScroll() {
      var cur = headings[0].id;
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top <= 140) cur = headings[i].id;
        else break;
      }
      setActive(cur);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
  }

  var booted = false;
  function init() {
    if (booted) return;   // guard against a duplicate DOMContentLoaded / double include
    booted = true;
    refreshSidebar();
    initMarkDone();
    initReveals();
    initQuizzes();
    initNavToggle();
    initTermTooltips();
    updateIndexProgress();
    initGlossaryPage();
    initVideoFacades();
    initSectionTracker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // reflect progress changes made in other tabs (repaint only — do NOT re-bind)
  window.addEventListener('storage', function (e) {
    if (e.key === PROGRESS_KEY) {
      refreshSidebar();
      updateIndexProgress();
      repaintMarkDone();
    }
  });
})();

/* ---------- floating Study Hub home button (injected on every page) ---------- */
(function () {
  try {
    var inTopics = location.pathname.indexOf("/topics/") !== -1;
    var a = document.createElement("a");
    a.className = "hub-home";
    a.href = (inTopics ? "../../" : "../") + "index.html";
    a.title = "חזרה ל-Study Hub";
    a.setAttribute("aria-label", "חזרה ל-Study Hub");
    a.textContent = "🏠";
    (document.body || document.documentElement).appendChild(a);
  } catch (e) {}
})();

/* ---- theme toggle: light-ish dark mode, persists via localStorage('hub-theme') ---- */
(function () {
  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
  var btn = document.createElement('button');
  btn.className = 'theme-toggle';
  btn.type = 'button';
  function paint() {
    btn.textContent = isDark() ? '\u2600\uFE0F' : '\uD83C\uDF19';
    var label = isDark() ? '\u05de\u05e2\u05d1\u05e8 \u05dc\u05de\u05e6\u05d1 \u05d1\u05d4\u05d9\u05e8' : '\u05de\u05e2\u05d1\u05e8 \u05dc\u05de\u05e6\u05d1 \u05db\u05d4\u05d4';
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }
  btn.addEventListener('click', function () {
    if (isDark()) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', 'dark');
    try { localStorage.setItem('hub-theme', isDark() ? 'dark' : 'light'); } catch (e) {}
    paint();
  });
  paint();
  document.body.appendChild(btn);
})();
