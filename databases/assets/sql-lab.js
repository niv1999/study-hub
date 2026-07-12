/* SQL Lab — in-browser SQL sandbox for the databases course.
   Engine: sql.js (SQLite compiled to WebAssembly), vendored in assets/vendor/.
   Each .sql-lab element carries its own setup / solution / probe scripts and
   is graded by comparing result sets, so no server is needed. */
(function () {
  'use strict';

  var SQL = null;
  var loadPromise = null;

  function vendorBase() {
    var me = document.querySelector('script[src*="sql-lab.js"]');
    return me.src.replace(/sql-lab\.js.*$/, 'vendor/');
  }

  function loadEngine() {
    if (SQL) return Promise.resolve(SQL);
    if (loadPromise) return loadPromise;
    var base = vendorBase();
    loadPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = base + 'sql-wasm.js';
      s.onload = function () {
        window.initSqlJs({ locateFile: function (f) { return base + f; } })
          .then(function (sql) { SQL = sql; resolve(sql); }, reject);
      };
      s.onerror = function () { reject(new Error('sql-wasm.js load failed')); };
      document.head.appendChild(s);
    });
    return loadPromise;
  }

  /* MySQL flavour → SQLite: enough for everything the course teaches. */
  function shim(sql) {
    return sql
      .replace(/\bAUTO_INCREMENT\b/gi, '')
      .replace(/\bTRUNCATE\s+TABLE\s+(\w+)\s*;/gi, 'DELETE FROM $1;')
      .replace(/\bDESCRIBE\s+(\w+)\s*;/gi,
        'SELECT name AS Field, type AS Type, ' +
        "CASE WHEN \"notnull\"=0 THEN 'YES' ELSE 'NO' END AS \"Null\", " +
        "CASE WHEN pk>0 THEN 'PRI' ELSE '' END AS \"Key\" " +
        "FROM pragma_table_info('$1');");
  }

  function freshDb(setup) {
    var db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON;');
    if (setup) db.run(shim(setup));
    return db;
  }

  function getScript(lab, type) {
    var el = lab.querySelector('script[type="text/x-sql-' + type + '"]');
    return el ? el.textContent.trim() : '';
  }

  function normVal(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && !Number.isInteger(v)) return Math.round(v * 10000) / 10000;
    return v;
  }

  function lastResult(db, sql) {
    var res = db.exec(shim(sql));
    return res.length ? res[res.length - 1] : null;
  }

  function rowsKey(result, ordered) {
    if (!result) return null;
    var rows = result.values.map(function (r) { return JSON.stringify(r.map(normVal)); });
    if (!ordered) rows = rows.slice().sort();
    return rows.join('\n');
  }

  function renderTable(result, cap) {
    cap = cap || 30;
    var t = document.createElement('table');
    var tr = document.createElement('tr');
    result.columns.forEach(function (c) {
      var th = document.createElement('th'); th.textContent = c; tr.appendChild(th);
    });
    t.appendChild(tr);
    result.values.slice(0, cap).forEach(function (row) {
      var r = document.createElement('tr');
      row.forEach(function (v) {
        var td = document.createElement('td');
        if (v === null) { td.textContent = 'NULL'; td.className = 'null'; }
        else td.textContent = String(normVal(v));
        r.appendChild(td);
      });
      t.appendChild(r);
    });
    if (result.values.length > cap) {
      var more = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = result.columns.length;
      td.textContent = '… +' + (result.values.length - cap) + ' rows';
      more.appendChild(td); t.appendChild(more);
    }
    return t;
  }

  function msg(text, cls, rtl) {
    var d = document.createElement('div');
    d.className = cls;
    if (rtl) d.dir = 'rtl';
    d.textContent = text;
    return d;
  }

  function showOutput(lab) {
    var out = lab.querySelector('.lab-output');
    out.hidden = false;
    out.textContent = '';
    return out;
  }

  function runUserSql(lab, out) {
    var setup = getScript(lab, 'setup');
    var userSql = lab.querySelector('.lab-input').value.trim();
    if (!userSql) { out.appendChild(msg('כתבו שאילתה קודם 🙂', 'lab-msg-err', true)); return; }
    var db = freshDb(setup);
    try {
      var results = db.exec(shim(userSql));
      if (results.length) {
        results.forEach(function (res) {
          out.appendChild(msg(res.values.length + ' rows', 'lab-rowcount'));
          out.appendChild(renderTable(res));
        });
      } else {
        out.appendChild(msg('✓ בוצע בהצלחה (אין שורות להצגה)', 'lab-msg-ok', true));
      }
    } catch (e) {
      out.appendChild(msg('✗ ' + e.message, 'lab-msg-err'));
    } finally { db.close(); }
  }

  function checkUserSql(lab, out) {
    var setup = getScript(lab, 'setup');
    var solution = getScript(lab, 'solution');
    var probe = getScript(lab, 'probe');
    var mode = lab.getAttribute('data-mode') || 'query';
    var userSql = lab.querySelector('.lab-input').value.trim();
    if (!userSql) { out.appendChild(msg('כתבו שאילתה קודם 🙂', 'lab-msg-err', true)); return; }

    var dbU = freshDb(setup), dbS = freshDb(setup);
    try {
      var userRes, solRes, ordered;
      if (mode === 'state') {
        dbU.run(shim(userSql));
        dbS.run(shim(solution));
        userRes = lastResult(dbU, probe);
        solRes = lastResult(dbS, probe);
        ordered = true;
      } else {
        userRes = lastResult(dbU, userSql);
        solRes = lastResult(dbS, solution);
        ordered = /\bORDER\s+BY\b/i.test(solution);
        if (!userRes) {
          out.appendChild(msg('השאילתה לא החזירה תוצאה — ודאו שיש SELECT', 'lab-msg-err', true));
          return;
        }
      }
      if (userRes && solRes && userRes.columns.length !== solRes.columns.length) {
        out.appendChild(msg('✗ מספר העמודות שונה מהצפוי (' + userRes.columns.length + ' במקום ' + solRes.columns.length + ')', 'lab-msg-err', true));
        out.appendChild(msg('התוצאה הצפויה:', 'lab-expected', true));
        out.appendChild(renderTable(solRes));
        return;
      }
      if (rowsKey(userRes, ordered) === rowsKey(solRes, ordered)) {
        out.appendChild(msg('✓ נכון! התוצאה תואמת את הפתרון', 'lab-msg-ok', true));
        if (userRes) out.appendChild(renderTable(userRes));
      } else {
        out.appendChild(msg('✗ עדיין לא — התוצאה שונה מהצפוי', 'lab-msg-err', true));
        if (userRes) {
          out.appendChild(msg('התוצאה שלכם:', 'lab-expected', true));
          out.appendChild(renderTable(userRes));
        }
        if (solRes) {
          out.appendChild(msg('התוצאה הצפויה:', 'lab-expected', true));
          out.appendChild(renderTable(solRes));
        }
      }
    } catch (e) {
      out.appendChild(msg('✗ ' + e.message, 'lab-msg-err'));
    } finally { dbU.close(); dbS.close(); }
  }

  function wire(lab) {
    var runBtn = lab.querySelector('.lab-run');
    var checkBtn = lab.querySelector('.lab-check');
    var revealBtn = lab.querySelector('.lab-reveal');
    var resetBtn = lab.querySelector('.lab-reset');
    var input = lab.querySelector('.lab-input');

    function withEngine(fn) {
      var out = showOutput(lab);
      out.appendChild(msg('טוען מנוע SQL…', 'lab-loading', true));
      loadEngine().then(function () {
        out.textContent = '';
        fn(lab, out);
      }, function () {
        out.textContent = '';
        out.appendChild(msg('טעינת מנוע ה-SQL נכשלה — בדקו חיבור לרשת ורעננו', 'lab-msg-err', true));
      });
    }

    if (runBtn) runBtn.addEventListener('click', function () { withEngine(runUserSql); });
    if (checkBtn) checkBtn.addEventListener('click', function () { withEngine(checkUserSql); });
    if (revealBtn) revealBtn.addEventListener('click', function () {
      var sol = lab.querySelector('.lab-solution');
      sol.hidden = !sol.hidden;
      revealBtn.textContent = sol.hidden ? 'הצג פתרון' : 'הסתר פתרון';
    });
    if (resetBtn) resetBtn.addEventListener('click', function () {
      input.value = '';
      var out = lab.querySelector('.lab-output');
      out.hidden = true; out.textContent = '';
      var sol = lab.querySelector('.lab-solution');
      if (sol) { sol.hidden = true; }
      if (revealBtn) revealBtn.textContent = 'הצג פתרון';
    });
    /* Ctrl+Enter runs */
    input.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); withEngine(runUserSql); }
    });
  }

  function init() {
    document.querySelectorAll('.sql-lab').forEach(wire);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
