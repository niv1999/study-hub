/* =====================================================================
   karger-contraction.js  —  Module 13 "אלגוריתמים אקראיים"
   Viz id: karger-contraction  (heroViz spec, brief 13-randomized.json)

   Karger's randomized Min-Cut contraction algorithm, step by step:
   repeatedly pick a UNIFORMLY RANDOM edge and CONTRACT it (merge its two
   endpoints into one super-node, deleting the self-loops that form), until
   only 2 super-nodes remain. The edges surviving between those two
   super-nodes ARE a cut; its size is the number of surviving (parallel)
   edges. Sometimes the run finds a minimum cut, sometimes not — that
   randomness is the whole point ("הרץ שוב").

   ── GROUNDING NOTE ────────────────────────────────────────────────────
   The lecture file (_notes/12-randomized.md) does NOT contain Karger at
   all (see its "פערים" section — Karger & skip-lists are absent from the
   slides). CONTRACT §5: "If the notes lack a concrete example, use the
   smallest clear example and label it 'דוגמה שלנו'." So this uses a
   canonical, minimal teaching graph, labelled 'דוגמה שלנו' in the UI:

     Vertices: A B C  |  D E F   (two triangles)
     Edges (8):
        A-B, A-C, B-C          (left triangle {A,B,C})
        D-E, D-F, E-F          (right triangle {D,E,F})
        C-D                    (bridge)     ┐ these two bridges are
        A-E                    (bridge)     ┘ THE minimum cut, size = 2
     Global minimum-cut value = 2.

   The FIRST run is a scripted "guided" run that avoids the bridges and
   succeeds (cut = 2); every "הרץ שוב" performs a genuinely random Karger
   run (Math.random over the live-edge multiset) that may or may not hit 2.

   Live bookkeeping shown (the pedagogy, per CONTRACT §5):
     • the partition into super-nodes (union-find leaders)
     • the leader[] array (each original vertex → its super-node)
     • the live-edge multiset with parallel multiplicities
     • self-loops removed at each contraction, super-nodes remaining
     • the resulting cut and whether it is minimal.

   Self-contained IIFE. Hand-authored SVG/DOM. No external deps.
   Cream design tokens hardcoded (CONTRACT §2). RTL Hebrew captions;
   algorithm identifiers stay English/LTR. Works over http(s):// and file://.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "karger-contraction";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    rose: "#B76E79",   /* unit-7 accent */
    clay: "#BE7C5E",   /* warnings / non-minimal */
    sage: "#7C9885"    /* success */
  };

  /* per-super-node colours (assigned by the group's minimal member index,
     so labels/colours stay stable as groups merge). dusty-blue, sage, clay,
     mustard, plum, teal — all from the site's warm token family. */
  var GROUP_COLORS = ["#6E8CA0", "#7C9885", "#BE7C5E", "#C9A24B", "#8C6E9E", "#5E8C88"];
  function darken(hex) {
    /* rough darker stroke for a fill colour */
    var m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return C.ink;
    var r = Math.max(0, parseInt(m[1], 16) - 46);
    var g = Math.max(0, parseInt(m[2], 16) - 46);
    var b = Math.max(0, parseInt(m[3], 16) - 46);
    function h(n) { var s = n.toString(16); return s.length < 2 ? "0" + s : s; }
    return "#" + h(r) + h(g) + h(b);
  }

  /* --- the graph (דוגמה שלנו) --- */
  var V = ["A", "B", "C", "D", "E", "F"];
  var POS = [
    { x: 118, y: 78 },   /* A */
    { x: 78, y: 214 },   /* B */
    { x: 196, y: 150 },  /* C */
    { x: 330, y: 150 },  /* D */
    { x: 448, y: 78 },   /* E */
    { x: 408, y: 214 }   /* F */
  ];
  /* edges as [u,v] original-vertex indices; index in array = edge id */
  var E = [
    [0, 1], /* 0 A-B */
    [0, 2], /* 1 A-C */
    [1, 2], /* 2 B-C */
    [3, 4], /* 3 D-E */
    [3, 5], /* 4 D-F */
    [4, 5], /* 5 E-F */
    [2, 3], /* 6 C-D  (bridge) */
    [0, 4]  /* 7 A-E  (bridge) */
  ];
  var BRIDGES = { 6: true, 7: true };
  var KNOWN_MIN = 2;

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function el(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function txt(x, y, s, attrs) {
    var t = el("text", attrs || {});
    t.setAttribute("x", x); t.setAttribute("y", y);
    t.textContent = s;
    return t;
  }
  function pairLTR(a, b) {
    return '<span dir="ltr">' + a + "–" + b + "</span>";
  }
  function setLTR(letters) {
    return '<span dir="ltr">{' + letters.join(", ") + "}</span>";
  }

  /* =====================================================================
     STEP ENGINE — build the full sequence of frames for one Karger run.
     `pickId(live, framesLen)` chooses which live edge id to contract.
     A frame is a full immutable snapshot the scene can render statically.
     ===================================================================== */
  function buildFrames(pickId) {
    var parent = V.map(function (_, i) { return i; });
    var rank = V.map(function () { return 0; });
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }

    function groupsNow() {
      var map = {};
      for (var i = 0; i < V.length; i++) {
        var r = find(i);
        (map[r] = map[r] || []).push(i);
      }
      return Object.keys(map).map(function (r) {
        var members = map[r].map(Number).sort(function (a, b) { return a - b; });
        var minIdx = members[0];
        var cx = 0, cy = 0;
        members.forEach(function (m) { cx += POS[m].x; cy += POS[m].y; });
        return {
          root: +r, members: members, minIdx: minIdx,
          color: GROUP_COLORS[minIdx % GROUP_COLORS.length],
          letters: members.map(function (m) { return V[m]; }),
          cx: cx / members.length, cy: cy / members.length
        };
      }).sort(function (a, b) { return a.minIdx - b.minIdx; });
    }
    function liveEdgesNow() {
      var res = [];
      E.forEach(function (e, id) {
        var ru = find(e[0]), rv = find(e[1]);
        if (ru !== rv) res.push({ id: id, u: e[0], v: e[1], ru: ru, rv: rv });
      });
      return res;
    }
    function edgeClassNow() {
      return E.map(function (e) { return find(e[0]) === find(e[1]) ? "internal" : "active"; });
    }
    function repNow() {
      /* leader[] as the min-letter of each vertex's group (union-find leader) */
      var rep = [];
      for (var i = 0; i < V.length; i++) {
        var r = find(i), members = [];
        for (var k = 0; k < V.length; k++) if (find(k) === r) members.push(k);
        rep.push(V[Math.min.apply(null, members)]);
      }
      return rep;
    }
    function multiset(live) {
      var m = {};
      live.forEach(function (le) {
        var key = Math.min(le.ru, le.rv) + "-" + Math.max(le.ru, le.rv);
        m[key] = (m[key] || 0) + 1;
      });
      return m;
    }

    var frames = [];
    frames.push({
      kind: "init",
      groups: groupsNow(), edgeClass: edgeClassNow(), live: liveEdgesNow(),
      rep: repNow(), multiset: multiset(liveEdgesNow()),
      chosen: null, mergedLetters: null, selfLoops: 0,
      count: V.length, cutSize: null, bridge: false
    });

    var count = V.length, guard = 0;
    while (count > 2 && guard++ < 40) {
      var live = liveEdgesNow();
      var id = pickId(live, frames.length);
      var chosen = null;
      for (var i = 0; i < live.length; i++) { if (live[i].id === id) { chosen = live[i]; break; } }
      if (!chosen) chosen = live[0];

      var ru = find(chosen.u), rv = find(chosen.v);
      /* self-loops removed = all live edges between these two groups */
      var removed = live.filter(function (le) {
        return (le.ru === ru && le.rv === rv) || (le.ru === rv && le.rv === ru);
      }).length;

      /* union by rank */
      if (rank[ru] < rank[rv]) { var t = ru; ru = rv; rv = t; }
      parent[rv] = ru;
      if (rank[ru] === rank[rv]) rank[ru]++;
      count--;

      var mroot = find(chosen.u), mergedMembers = [];
      for (var k = 0; k < V.length; k++) if (find(k) === mroot) mergedMembers.push(k);
      mergedMembers.sort(function (a, b) { return a - b; });

      var newLive = liveEdgesNow();
      frames.push({
        kind: count === 2 ? "final" : "contract",
        groups: groupsNow(), edgeClass: edgeClassNow(), live: newLive,
        rep: repNow(), multiset: multiset(newLive),
        chosen: { id: chosen.id, u: chosen.u, v: chosen.v },
        mergedLetters: mergedMembers.map(function (m) { return V[m]; }),
        selfLoops: removed,
        count: count,
        cutSize: count === 2 ? newLive.length : null,
        bridge: !!BRIDGES[chosen.id]
      });
    }
    return frames;
  }

  /* scripted first run — contract only intra-cluster edges → succeeds (cut=2) */
  var SCRIPT = [0, 2, 3, 5]; /* A-B, B-C, D-E, E-F */
  function scriptedPick(live, flen) {
    var want = SCRIPT[flen - 1];
    for (var i = 0; i < live.length; i++) if (live[i].id === want) return live[i].id;
    return live[0].id;
  }
  function randomPick(live) {
    return live[Math.floor(Math.random() * live.length)].id;
  }

  /* =====================================================================
     convex hull (Andrew's monotone chain) — for the super-node "blob"
     ===================================================================== */
  function cross(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
  function hull(points) {
    if (points.length <= 2) return points.slice();
    var pts = points.slice().sort(function (a, b) { return a.x - b.x || a.y - b.y; });
    var lower = [], upper = [], i;
    for (i = 0; i < pts.length; i++) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <= 0) lower.pop();
      lower.push(pts[i]);
    }
    for (i = pts.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0) upper.pop();
      upper.push(pts[i]);
    }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }

  /* =====================================================================
     Scene: fixed vertices + edges; per frame we restyle edges/nodes and
     rebuild the translucent super-node blobs.
     ===================================================================== */
  var W = 526, H = 292;

  function buildScene() {
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "גרף הדוגמה לאלגוריתם Karger: שני משולשים {A,B,C} ו-{D,E,F} מחוברים בשתי קשתות גשר"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";

    var g = {};
    g.hulls = el("g", {});                 /* blobs behind everything */
    g.edges = el("g", {});
    g.nodes = el("g", {});
    svg.appendChild(g.hulls);
    svg.appendChild(g.edges);
    svg.appendChild(g.nodes);

    /* edges (create once, keep refs by id) */
    g.edgeEls = E.map(function (e, id) {
      var a = POS[e[0]], b = POS[e[1]];
      var ln = el("line", {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        stroke: C.line, "stroke-width": 2, "stroke-linecap": "round"
      });
      g.edges.appendChild(ln);
      return ln;
    });

    /* nodes (circle + letter) */
    g.nodeEls = V.map(function (name, i) {
      var grp = el("g", {});
      var circ = el("circle", { cx: POS[i].x, cy: POS[i].y, r: 19, fill: GROUP_COLORS[i], stroke: "#fff", "stroke-width": 2 });
      var lb = txt(POS[i].x, POS[i].y + 5, name, {
        "text-anchor": "middle", "font-size": 15, "font-weight": 800, fill: "#fff"
      });
      grp.appendChild(circ); grp.appendChild(lb);
      g.nodes.appendChild(grp);
      return { grp: grp, circ: circ, lb: lb };
    });

    return { svg: svg, g: g };
  }

  /* draw a super-node blob for a group (list of member indices) */
  function blobPath(members) {
    var pts = members.map(function (m) { return { x: POS[m].x, y: POS[m].y }; });
    if (pts.length === 1) {
      return { type: "circle", cx: pts[0].x, cy: pts[0].y, r: 30 };
    }
    var h = hull(pts);
    var d = "M" + h[0].x + " " + h[0].y;
    for (var i = 1; i < h.length; i++) d += " L" + h[i].x + " " + h[i].y;
    d += " Z";
    return { type: "path", d: d };
  }

  function renderScene(scene, frame) {
    var g = scene.g;

    /* --- blobs --- */
    while (g.hulls.firstChild) g.hulls.removeChild(g.hulls.firstChild);
    frame.groups.forEach(function (grp) {
      if (grp.members.length < 2 && frame.kind === "init") return; /* no blob at the very start */
      var wrap = el("g", { opacity: 0.17 });
      var spec = blobPath(grp.members);
      if (spec.type === "circle") {
        wrap.appendChild(el("circle", { cx: spec.cx, cy: spec.cy, r: spec.r, fill: grp.color }));
      } else {
        wrap.appendChild(el("path", {
          d: spec.d, fill: grp.color, stroke: grp.color,
          "stroke-width": 52, "stroke-linejoin": "round", "stroke-linecap": "round"
        }));
      }
      g.hulls.appendChild(wrap);
    });

    /* --- edges --- */
    var isFinal = frame.kind === "final";
    g.edgeEls.forEach(function (ln, id) {
      var cls = frame.edgeClass[id];
      var justContracted = frame.chosen && frame.chosen.id === id;
      if (justContracted) {
        /* the edge we just contracted → dashed accent (a self-loop now) */
        ln.setAttribute("stroke", C.rose);
        ln.setAttribute("stroke-width", 3.4);
        ln.setAttribute("stroke-dasharray", "6 5");
        ln.setAttribute("opacity", 0.9);
      } else if (cls === "internal") {
        ln.setAttribute("stroke", C.inkSoft);
        ln.setAttribute("stroke-width", 1.4);
        ln.setAttribute("stroke-dasharray", "3 5");
        ln.setAttribute("opacity", 0.32);
      } else if (isFinal) {
        /* surviving edge between the last 2 super-nodes = the cut */
        ln.setAttribute("stroke", C.rose);
        ln.setAttribute("stroke-width", 5);
        ln.setAttribute("stroke-dasharray", "");
        ln.setAttribute("opacity", 1);
      } else {
        ln.setAttribute("stroke", darken(C.inkSoft));
        ln.setAttribute("stroke-width", 2.4);
        ln.setAttribute("stroke-dasharray", "");
        ln.setAttribute("opacity", 0.85);
      }
    });

    /* --- nodes (colour by their group) --- */
    var colorOf = [];
    frame.groups.forEach(function (grp) {
      grp.members.forEach(function (m) { colorOf[m] = grp.color; });
    });
    g.nodeEls.forEach(function (nd, i) {
      nd.circ.setAttribute("fill", colorOf[i]);
      nd.circ.setAttribute("stroke", isFinal ? darken(colorOf[i]) : "#fff");
      nd.circ.setAttribute("stroke-width", isFinal ? 2.5 : 2);
    });
  }

  /* =====================================================================
     Render one mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-kg-ready") === "1") return;
    mount.setAttribute("data-kg-ready", "1");
    mount.innerHTML = "";

    var frames = buildFrames(scriptedPick);
    var idx = 0;
    var runNo = 0;                 /* 0 = guided run; ≥1 = random runs */
    var autoTimer = null;

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");

    /* run label + "our example" tag */
    var head = document.createElement("div");
    head.style.cssText = "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;margin-bottom:.6rem";
    var runTag = document.createElement("span");
    runTag.style.cssText = "font-weight:700;font-size:.92rem;color:" + C.ink;
    var exTag = document.createElement("span");
    exTag.textContent = "דוגמה שלנו";
    exTag.title = "אלגוריתם Karger אינו מופיע בשקפי ההרצאה; זוהי דוגמת הוראה קנונית מינימלית.";
    exTag.style.cssText = "font-size:.72rem;font-weight:700;color:" + C.rose +
      ";border:1px solid " + C.rose + ";border-radius:99px;padding:2px 10px";
    head.appendChild(runTag);
    head.appendChild(exTag);
    wrap.appendChild(head);

    /* scene */
    var scene = buildScene();
    var sceneBox = document.createElement("div");
    sceneBox.style.cssText = "background:" + C.surface + ";border-radius:12px;padding:8px 4px";
    sceneBox.appendChild(scene.svg);
    wrap.appendChild(sceneBox);

    /* bookkeeping panel */
    var book = document.createElement("div");
    book.style.cssText = "background:" + C.surface2 + ";border:1px solid " + C.line +
      ";border-radius:12px;padding:11px 13px;margin-top:12px;color:" + C.ink + ";line-height:1.6";
    wrap.appendChild(book);

    /* explanation panel */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.cssText = "background:" + C.surface2 + ";border:1px solid " + C.line +
      ";border-radius:12px;padding:12px 14px;margin-top:10px;min-height:86px;color:" + C.ink +
      ";line-height:1.65;font-size:.9rem";
    wrap.appendChild(panel);

    /* controls */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    controls.style.marginTop = "12px";
    function mkBtn(label, fn, primary) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn" + (primary ? " primary" : "");
      b.innerHTML = label;
      b.addEventListener("click", fn);
      return b;
    }
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); go(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); go(idx + 1); }, true);
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); go(0); });
    var btnAgain = mkBtn("🎲 הרץ שוב", function () { newRun(); });
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    controls.appendChild(btnAgain);
    wrap.appendChild(controls);

    /* screen-reader live status (visually hidden, no layout impact) */
    var status = document.createElement("p");
    status.setAttribute("aria-live", "polite");
    status.style.cssText = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;" +
      "overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;";
    wrap.appendChild(status);

    mount.appendChild(wrap);

    /* ---- helpers to render the two text panels ---- */
    function chips(frame) {
      /* super-node chips */
      return frame.groups.map(function (grp) {
        return '<span style="display:inline-block;background:' + grp.color +
          ';color:#fff;font-weight:700;border-radius:8px;padding:2px 9px;margin:2px;font-size:.82rem" dir="ltr">{' +
          grp.letters.join(",") + "}</span>";
      }).join("");
    }
    function multisetHtml(frame) {
      /* group-pair multiplicities among live edges */
      var byRoot = {};
      frame.groups.forEach(function (grp) { byRoot[grp.root] = grp.letters; });
      var parts = [];
      Object.keys(frame.multiset).forEach(function (key) {
        var rs = key.split("-").map(Number);
        var la = byRoot[rs[0]], lb = byRoot[rs[1]];
        if (!la || !lb) return;
        var mult = frame.multiset[key];
        parts.push('{' + la.join(",") + "}–{" + lb.join(",") + "}" +
          (mult > 1 ? " ×" + mult : ""));
      });
      return parts.length ? parts.join(" · ") : "—";
    }
    function renderBook(frame) {
      var repRow = V.map(function (name, i) {
        return name + "→" + frame.rep[i];
      }).join("  ");
      var liveCount = frame.live.length;
      book.innerHTML =
        '<div style="display:flex;flex-wrap:wrap;gap:14px;font-size:.82rem;font-weight:700;margin-bottom:7px">' +
          '<span>קודקודי-על: <b style="color:' + C.rose + '">' + frame.count + '</b></span>' +
          '<span>קשתות חיות (בין קבוצות): <b>' + liveCount + '</b></span>' +
          '<span>מינימום ידוע: <b style="color:' + C.sage + '">' + KNOWN_MIN + '</b></span>' +
        '</div>' +
        '<div style="margin-bottom:6px">' +
          '<span style="font-size:.78rem;color:' + C.inkSoft + '">המחיצה לקודקודי-על (super-nodes):</span><br>' +
          chips(frame) +
        '</div>' +
        '<div style="font-family:monospace;font-size:.78rem;color:' + C.inkSoft + ';direction:ltr;margin-bottom:4px">' +
          'leader[] : ' + repRow +
        '</div>' +
        '<div style="font-size:.78rem;color:' + C.inkSoft + ';direction:ltr">' +
          'live multiset : ' + multisetHtml(frame) +
        '</div>';
    }

    function renderPanel(frame, i) {
      var badge, color, title, body;
      if (frame.kind === "init") {
        badge = "start"; color = C.inkSoft;
        title = "מצב התחלתי — " + V.length + " קודקודים, " + E.length + " קשתות";
        body = "הגרף: שני משולשים " + setLTR(["A", "B", "C"]) + " ו-" + setLTR(["D", "E", "F"]) +
          ", המחוברים בשתי קשתות גשר " + pairLTR("C", "D") + " ו-" + pairLTR("A", "E") +
          '. גודל החתך המינימלי הידוע = <b style="color:' + C.sage + '">' + KNOWN_MIN + '</b> (שתי קשתות הגשר). ' +
          "בכל צעד נבחר קשת אקראית ונכווץ אותה, עד שיישארו 2 קודקודי-על.";
      } else if (frame.kind === "contract") {
        var stepN = i;
        color = frame.bridge ? C.clay : C.rose;
        badge = "contract " + stepN;
        title = "צעד " + stepN + " · כיווץ הקשת " + pairLTR(V[frame.chosen.u], V[frame.chosen.v]);
        body = "נבחרה אקראית הקשת " + pairLTR(V[frame.chosen.u], V[frame.chosen.v]) +
          " — שני קצותיה מתמזגים לקודקוד-על אחד " + setLTR(frame.mergedLetters) + ". " +
          "קשתות שהפכו ללולאות עצמיות (self-loops) נמחקות: <b>" + frame.selfLoops + "</b>. " +
          "נותרו <b>" + frame.count + "</b> קודקודי-על." +
          (frame.bridge ? ' <b style="color:' + C.clay + '">⚠ כיווצנו קשת גשר! כעת ייתכן שנפספס את החתך המינימלי.</b>' : "");
      } else { /* final */
        var ok = frame.cutSize === KNOWN_MIN;
        color = ok ? C.sage : C.clay;
        badge = ok ? "min-cut ✓" : "cut > min";
        var gA = frame.groups[0], gB = frame.groups[1];
        title = "סיום — נותרו 2 קודקודי-על";
        var cutEdges = frame.live.map(function (le) { return pairLTR(V[le.u], V[le.v]); }).join(", ");
        body = "החלוקה הסופית: " + setLTR(gA.letters) + " מול " + setLTR(gB.letters) + ". " +
          "הקשתות שנותרו ביניהן = <b>החתך</b>: " + cutEdges +
          ' — גודל <b style="color:' + color + '">' + frame.cutSize + "</b>. " +
          (ok
            ? '<b style="color:' + C.sage + '">זהו חתך מינימלי! הריצה הצליחה.</b>'
            : '<b style="color:' + C.clay + '">גדול מהמינימום (' + KNOWN_MIN + ') — הריצה נכשלה. לחצו "🎲 הרץ שוב".</b> בדיוק לכן מריצים את Karger פעמים רבות ושומרים את החתך הקטן ביותר.');
      }
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">' +
          '<span style="background:' + color + ';color:#fff;font-weight:700;font-size:.72rem;padding:2px 10px;border-radius:99px" dir="ltr">' + badge + '</span>' +
          '<b style="font-size:1rem;color:' + C.ink + '">' + title + '</b>' +
        '</div><div>' + body + '</div>';
      status.textContent = title;
    }

    /* ---- navigation ---- */
    function go(n) {
      idx = Math.max(0, Math.min(frames.length - 1, n));
      var frame = frames[idx];
      renderScene(scene, frame);
      renderBook(frame);
      renderPanel(frame, idx);
      pulseMerge(frame);
      btnPrev.disabled = (idx === 0);
      btnNext.disabled = (idx === frames.length - 1);
      runTag.textContent = (runNo === 0 ? "ריצה מודרכת (מוצלחת)" : "ריצה אקראית #" + runNo) +
        " · צעד " + idx + "/" + (frames.length - 1);
    }

    function pulseMerge(frame) {
      if (reducedMotion() || !frame.chosen) return;
      /* soft pulse on the two just-merged vertices */
      [frame.chosen.u, frame.chosen.v].forEach(function (vi) {
        var c = scene.g.nodeEls[vi].circ;
        if (c.animate) c.animate([{ r: 19 }, { r: 24 }, { r: 19 }], { duration: 340 });
      });
    }

    /* ---- new random run ---- */
    function newRun() {
      stopAuto();
      runNo++;
      frames = buildFrames(function (live) { return randomPick(live); });
      go(0);
    }

    /* ---- autoplay ---- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (idx >= frames.length - 1) go(0);
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 1500 : 1900;
      autoTimer = setInterval(function () {
        if (idx >= frames.length - 1) { stopAuto(); return; }
        go(idx + 1);
      }, delay);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.innerHTML = "▶ הפעל";
      btnPlay.classList.remove("primary");
    }

    /* keyboard: RTL-aware (Right = prev, Left = next) */
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { stopAuto(); go(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); go(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); go(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); go(frames.length - 1); e.preventDefault(); }
    });

    /* initial paint */
    go(0);
  }

  /* =====================================================================
     boot: mount all instances (guard for already-ready). Never throw.
     ===================================================================== */
  function boot() {
    try {
      var mounts = document.querySelectorAll('[data-viz="' + VIZ_ID + '"]');
      if (!mounts || !mounts.length) return;
      Array.prototype.forEach.call(mounts, function (m) { render(m); });
    } catch (err) {
      if (window.console && console.warn) console.warn("[" + VIZ_ID + "] " + err.message);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
