/* =====================================================================
   תכנות מערכות — exam.js · two-part exam simulator
   Mirrors the lecturer's format (example-ans.pdf):
     חלק א׳ — open questions (self-graded against a model answer, 10 pts each)
     חלק ב׳ — closed/American questions (auto-graded, 6 pts each)
   Pages with <div class="exam" data-exam> get exam behavior. Vanilla JS, RTL.

   Markup — open question (Part A):
     <div class="open-q" id="oq1" data-points="10">
       <h3 class="open-q-title">שאלה 1 <span class="exam-points">10 נק׳</span></h3>
       <div class="open-q-body">…</div>
       <textarea class="open-answer" dir="rtl" placeholder="…"></textarea>
       <div class="reveal"><button class="reveal-btn" type="button" aria-expanded="false"
            data-hide="הסתר תשובת מודל">הצג תשובת מודל</button>
         <div class="reveal-body" hidden>… <p class="grading-hint">…</p></div></div>
       <div class="self-grade"><span>דרגו את עצמכם:</span>
         <button type="button" data-score="0">0</button> … <button type="button" data-score="10">10</button>
       </div>
     </div>
   Markup — closed question (Part B):
     <li class="exam-q" id="q5" data-points="6">
       <h3 class="exam-q-title">שאלה 5 <span class="exam-points">6 נק׳</span></h3>
       <div class="exam-q-body">…</div>
       <ul class="quiz-opts exam-opts">4× <li><button type="button" data-feedback="…"
           [data-correct="true"]>…</button></li></ul>
       <p class="exam-q-feedback" hidden></p>
     </li>
   Toolbars: .exam-bar (top + bottom) with .exam-count + .exam-submit; result: .exam-result.
   ===================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('.exam[data-exam]');
  if (!root) return;

  var moduleId = document.body.getAttribute('data-module') || 'exam';
  var BEST_KEY = 'sysprog-exam-best:' + moduleId;
  var DRAFT_KEY = 'sysprog-exam-draft:' + moduleId + ':';

  var openQs = [].slice.call(root.querySelectorAll('.open-q'));
  var mcqs = [].slice.call(root.querySelectorAll('.exam-q'));
  var countEls = [].slice.call(root.querySelectorAll('.exam-count'));
  var submitBtns = [].slice.call(root.querySelectorAll('.exam-submit'));
  var resultEl = root.querySelector('.exam-result');
  var submitted = false;

  function pts(el, dflt) {
    var v = parseInt(el.getAttribute('data-points') || '', 10);
    return isNaN(v) ? dflt : v;
  }
  function qNum(el, sel, idx) {
    var t = el.querySelector(sel);
    var m = t ? (t.textContent || '').match(/\d+/) : null;
    return m ? m[0] : String(idx + 1);
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---------- Part A: drafts + self-grade ---------- */
  openQs.forEach(function (q, i) {
    var ta = q.querySelector('.open-answer');
    if (ta) {
      var saved = lsGet(DRAFT_KEY + (q.id || ('oq' + i)));
      if (saved && !ta.value) ta.value = saved;
      ta.addEventListener('input', function () {
        lsSet(DRAFT_KEY + (q.id || ('oq' + i)), ta.value);
      });
    }
    var btns = [].slice.call(q.querySelectorAll('.self-grade button'));
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.classList.remove('selected'); });
        b.classList.add('selected');
        q.classList.add('q-graded');
        updateCount();
        if (submitted) renderResult();
      });
    });
  });

  function selfScore(q) {
    var b = q.querySelector('.self-grade button.selected');
    return b ? (parseInt(b.getAttribute('data-score') || '0', 10) || 0) : null;
  }

  /* ---------- Part B: selection ---------- */
  mcqs.forEach(function (q) {
    var opts = [].slice.call(q.querySelectorAll('.exam-opts button'));
    opts.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (submitted) return;
        opts.forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        q.classList.add('answered');
        updateCount();
      });
    });
  });

  function mcqAnswered() {
    var n = 0;
    mcqs.forEach(function (q) { if (q.querySelector('.exam-opts button.selected')) n++; });
    return n;
  }
  function openGraded() {
    var n = 0;
    openQs.forEach(function (q) { if (selfScore(q) !== null) n++; });
    return n;
  }
  function updateCount() {
    var parts = [];
    if (mcqs.length) parts.push('סגורות: ' + mcqAnswered() + '/' + mcqs.length);
    if (openQs.length) parts.push('פתוחות שדורגו: ' + openGraded() + '/' + openQs.length);
    var txt = parts.join(' · ');
    countEls.forEach(function (el) { el.textContent = txt; });
  }

  /* ---------- reveal helpers (app.js owns the toggle; we just click) ---------- */
  function setReveal(q, open) {
    var btn = q.querySelector('.reveal-btn');
    var body = q.querySelector('.reveal-body');
    if (!btn || !body) return;
    var isHidden = body.hasAttribute('hidden');
    if (open && isHidden) btn.click();
    if (!open && !isHidden) btn.click();
  }

  /* ---------- grading ---------- */
  var lastGrade = null;

  function grade() {
    if (submitted) return;
    var missingMcq = mcqs.length - mcqAnswered();
    var missingOpen = openQs.length - openGraded();
    var warn = [];
    if (missingMcq > 0) warn.push(missingMcq + ' שאלות סגורות ללא מענה');
    if (missingOpen > 0) warn.push(missingOpen + ' שאלות פתוחות שטרם דירגתם (ייחשבו 0 — אפשר לדרג גם אחרי ההגשה)');
    if (warn.length && !window.confirm('שימו לב: ' + warn.join(', ') + '. להגיש בכל זאת?')) return;

    submitted = true;
    var wrong = [];

    mcqs.forEach(function (q, idx) {
      var opts = [].slice.call(q.querySelectorAll('.exam-opts button'));
      var chosen = q.querySelector('.exam-opts button.selected');
      var feedback = q.querySelector('.exam-q-feedback');
      var correctBtn = null;
      opts.forEach(function (b) {
        b.disabled = true;
        if (b.getAttribute('data-correct') === 'true') correctBtn = b;
      });
      var isRight = !!(chosen && chosen === correctBtn);
      q.setAttribute('data-right', isRight ? '1' : '0');
      if (isRight) {
        chosen.classList.add('correct');
      } else {
        if (chosen) chosen.classList.add('incorrect');
        if (correctBtn) correctBtn.classList.add('reveal-correct');
        wrong.push({ id: q.id, num: qNum(q, '.exam-q-title', idx) });
      }
      if (feedback) {
        var src = chosen || correctBtn;
        var txt = src ? (src.getAttribute('data-feedback') || '') : '';
        feedback.innerHTML = (isRight ? '✔ נכון. ' : (chosen ? '✘ לא נכון. ' : '— לא נענתה. ')) + txt;
        feedback.classList.add(isRight ? 'ok' : 'bad');
        feedback.removeAttribute('hidden');
      }
      q.classList.add(isRight ? 'q-right' : 'q-wrong');
    });

    // open all model answers so the student can grade what is still ungraded
    openQs.forEach(function (q) { setReveal(q, true); });

    lastGrade = { wrong: wrong };
    renderResult();
    submitBtns.forEach(function (b) { b.disabled = true; });
    if (resultEl) resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderResult() {
    if (!resultEl || !lastGrade) return;
    var mcqPts = 0, mcqMax = 0, openPts = 0, openMax = 0, ungraded = [];
    mcqs.forEach(function (q) {
      var p = pts(q, 6);
      mcqMax += p;
      if (q.getAttribute('data-right') === '1') mcqPts += p;
    });
    openQs.forEach(function (q, i) {
      var p = pts(q, 10);
      openMax += p;
      var s = selfScore(q);
      if (s === null) ungraded.push({ id: q.id, num: qNum(q, '.open-q-title', i) });
      else openPts += Math.min(s, p);
    });
    var total = mcqPts + openPts, max = mcqMax + openMax;
    var pct = max ? Math.round((total / max) * 100) : 0;
    var best = parseInt(lsGet(BEST_KEY) || '0', 10) || 0;
    if (pct > best) { best = pct; lsSet(BEST_KEY, String(best)); }

    var headline = pct >= 90 ? 'מצוין! 🎉' : pct >= 75 ? 'יפה מאוד 💪' : pct >= 60 ? 'עובר — יש על מה לעבוד' : 'עוד לא שם — עברו על ההסברים ונסו שוב';
    var html =
      '<div class="exam-score"><span class="exam-score-num">' + total + '/' + max + '</span>' +
      '<span class="exam-score-pct">' + pct + '</span></div>' +
      '<p class="exam-headline">' + headline + '</p>';
    var bd = [];
    if (openQs.length) bd.push('חלק א׳ (פתוחות, דירוג עצמי): ' + openPts + '/' + openMax);
    if (mcqs.length) bd.push('חלק ב׳ (סגורות): ' + mcqPts + '/' + mcqMax);
    html += '<p class="exam-breakdown">' + bd.join(' · ') + '</p>';
    html += '<p class="exam-best">השיא שלך במבחן הזה: ' + best + '%</p>';
    if (lastGrade.wrong.length) {
      html += '<p class="exam-wrong-list">שאלות סגורות לחזרה: ' +
        lastGrade.wrong.map(function (w) { return '<a href="#' + w.id + '">' + w.num + '</a>'; }).join(' · ') + '</p>';
    }
    if (ungraded.length) {
      html += '<p class="exam-wrong-list">שאלות פתוחות שטרם דורגו (נספרות 0): ' +
        ungraded.map(function (w) { return '<a href="#' + w.id + '">' + w.num + '</a>'; }).join(' · ') + '</p>';
    }
    html += '<button type="button" class="exam-retake">🔁 מבחן מחדש</button>';
    resultEl.innerHTML = html;
    resultEl.removeAttribute('hidden');
    var retake = resultEl.querySelector('.exam-retake');
    if (retake) retake.addEventListener('click', reset);
  }

  function reset() {
    submitted = false;
    lastGrade = null;
    mcqs.forEach(function (q) {
      q.classList.remove('answered', 'q-right', 'q-wrong');
      q.removeAttribute('data-right');
      [].slice.call(q.querySelectorAll('.exam-opts button')).forEach(function (b) {
        b.disabled = false;
        b.classList.remove('selected', 'correct', 'incorrect', 'reveal-correct');
      });
      var feedback = q.querySelector('.exam-q-feedback');
      if (feedback) {
        feedback.setAttribute('hidden', '');
        feedback.classList.remove('ok', 'bad');
        feedback.textContent = '';
      }
    });
    openQs.forEach(function (q) {
      q.classList.remove('q-graded');
      [].slice.call(q.querySelectorAll('.self-grade button')).forEach(function (b) { b.classList.remove('selected'); });
      setReveal(q, false);
    });
    if (resultEl) resultEl.setAttribute('hidden', '');
    submitBtns.forEach(function (b) { b.disabled = false; });
    updateCount();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  submitBtns.forEach(function (b) { b.addEventListener('click', grade); });
  updateCount();
})();
