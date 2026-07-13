/* =====================================================================
   Intro to Web & Cloud — exam.js · full-exam simulator
   Pages with <div class="exam" data-exam> get exam behavior:
   pick an answer per question (no instant feedback), submit at the end,
   get score + per-question explanations + retake. Vanilla JS, RTL text.
   Markup per question (mirrors quiz visuals):
     <li class="exam-q" id="qN">
       <h3 class="exam-q-title">N. כותרת</h3>
       <div class="exam-q-body">…</div>
       <ul class="quiz-opts exam-opts">4× <li><button data-feedback="…"
           [data-correct="true"]>…</button></li></ul>
       <p class="exam-q-feedback" hidden></p>
     </li>
   ===================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('.exam[data-exam]');
  if (!root) return;

  var questions = [].slice.call(root.querySelectorAll('.exam-q'));
  // there are two toolbars (top + bottom) — wire ALL of them
  var countEls = [].slice.call(root.querySelectorAll('.exam-count'));
  var submitBtns = [].slice.call(root.querySelectorAll('.exam-submit'));
  var resultEl = root.querySelector('.exam-result');
  var moduleId = document.body.getAttribute('data-module') || 'exam';
  var BEST_KEY = 'db-exam-best:' + moduleId;
  var submitted = false;

  function answeredCount() {
    var n = 0;
    for (var i = 0; i < questions.length; i++) {
      if (questions[i].querySelector('.exam-opts button.selected')) n++;
    }
    return n;
  }

  function updateCount() {
    var txt = 'ענית על ' + answeredCount() + '/' + questions.length;
    for (var i = 0; i < countEls.length; i++) countEls[i].textContent = txt;
  }

  /* --- selection phase --- */
  questions.forEach(function (q) {
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

  /* --- grading --- */
  function grade() {
    if (submitted) return;
    var unanswered = questions.length - answeredCount();
    if (unanswered > 0 &&
        !window.confirm('נותרו ' + unanswered + ' שאלות ללא מענה. להגיש בכל זאת?')) {
      return;
    }
    submitted = true;
    var score = 0;
    var wrong = [];

    questions.forEach(function (q, idx) {
      var opts = [].slice.call(q.querySelectorAll('.exam-opts button'));
      var chosen = q.querySelector('.exam-opts button.selected');
      var feedback = q.querySelector('.exam-q-feedback');
      var correctBtn = null;
      opts.forEach(function (b) {
        b.disabled = true;
        if (b.getAttribute('data-correct') === 'true') correctBtn = b;
      });
      var isRight = chosen && chosen === correctBtn;
      if (isRight) {
        chosen.classList.add('correct');
        score++;
      } else {
        if (chosen) chosen.classList.add('incorrect');
        if (correctBtn) correctBtn.classList.add('reveal-correct');
        wrong.push(idx + 1);
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

    var pct = Math.round((score / questions.length) * 100);
    var best = 0;
    try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) {}
    if (pct > best) {
      best = pct;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }

    if (resultEl) {
      var headline = pct >= 90 ? 'מצוין! 🎉' : pct >= 75 ? 'יפה מאוד 💪' : pct >= 60 ? 'עבר — יש על מה לעבוד' : 'עוד לא שם — עברו על ההסברים ונסו שוב';
      var html =
        '<div class="exam-score"><span class="exam-score-num">' + score + '/' + questions.length + '</span>' +
        '<span class="exam-score-pct">' + pct + '</span></div>' +
        '<p class="exam-headline">' + headline + '</p>' +
        '<p class="exam-best">השיא שלך במבחן הזה: ' + best + '</p>';
      if (wrong.length) {
        html += '<p class="exam-wrong-list">שאלות לחזרה: ' +
          wrong.map(function (n) { return '<a href="#q' + n + '">' + n + '</a>'; }).join(' · ') + '</p>';
      }
      html += '<button type="button" class="exam-retake">🔁 מבחן מחדש</button>';
      resultEl.innerHTML = html;
      resultEl.removeAttribute('hidden');
      var retake = resultEl.querySelector('.exam-retake');
      if (retake) retake.addEventListener('click', reset);
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    for (var s = 0; s < submitBtns.length; s++) submitBtns[s].disabled = true;
  }

  function reset() {
    submitted = false;
    questions.forEach(function (q) {
      q.classList.remove('answered', 'q-right', 'q-wrong');
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
    if (resultEl) resultEl.setAttribute('hidden', '');
    for (var s = 0; s < submitBtns.length; s++) submitBtns[s].disabled = false;
    updateCount();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  for (var s = 0; s < submitBtns.length; s++) submitBtns[s].addEventListener('click', grade);
  updateCount();
})();
