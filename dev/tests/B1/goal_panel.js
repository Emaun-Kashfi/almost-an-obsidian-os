/* B1 — goal panel (custom SVG Gantt + health) — SPEC §2 / §5 / §9 / §10.
   Today is fixed at 2026-09-12 (Saturday). */
const { withPage, readFile, assert } = require("../lib.js");
const { files } = require("./fixtures.js");

const B = require("../build.js");
const SRC = readFile(B.COMMON + "/_scripts/goal-panel.js");

/* ── 0. shape + syntax ───────────────────────────────────────────────────── */
/* CONTRACT A — the panel is a dv.view file: bare JS, rendering into dv.container.
   A fence here would be evaluated as code; `this` in a view is NOT the component. */
assert(!/```/.test(SRC), "goal-panel.js is bare JavaScript — a dv.view file carries no fence");
assert(/^const root = dv\.container;$/m.test(SRC), "goal-panel.js renders into dv.container");
assert(!/(?<![.\w$])this\s*[.\[]/.test(SRC), "goal-panel.js never touches `this` — it is the global object inside a view");
assert(SRC.length > 500, "the view source is the whole file (" + SRC.length + " chars)");
try { new Function("dv", "app", "return (async()=>{" + SRC + "\n})()"); assert(true, "extracted JS parses (node --check equivalent)"); }
catch (e) { assert(false, "extracted JS parses: " + e.message); }

/* ── expected geometry, computed independently of the block ──────────────── */
const D = iso => { const [y, m, d] = String(iso).split("-").map(Number); return Date.UTC(y, m - 1, d); };
const dd = (a, b) => Math.round((D(b) - D(a)) / 86400000);
const r2 = n => Math.round(n * 100) / 100;
const WS = "2025-06-01", WE = "2026-12-31";          // min(task.start) → goal.target
const SPAN = dd(WS, WE);                              // 578 days ≥ 8 weeks → no extension
const X0 = 220, CW = 1000 - 12 - 220;                 // label column 220, right pad 12
const xOf = iso => r2(X0 + CW * dd(WS, iso) / SPAN);
const bar = (s, e, prog) => { const x = xOf(s); const w = Math.max(4, r2(xOf(e) - x)); return { x, w, fill: r2(w * prog) }; };

assert(SPAN === 578, "window span is 578 days (2025-06-01 → 2026-12-31)");
assert(dd(WS, "2026-09-12") === 468, "today is day 468 of the window");

const EXP_ROWS = [
  { name: "App foundations",                 status: "done",    health: "done", s: "2025-06-01", e: "2026-08-31", prog: 3 / 3 },
  { name: "Cross-browser and mobile QA pass",   status: "active",  health: "risk", s: "2026-08-15", e: "2026-09-30", prog: 2 / 5 },
  { name: "Design pass",                   status: "active",  health: "ok",   s: "2026-09-01", e: "2026-10-15", prog: 3 / 8 },
  { name: "Store listing",                  status: "backlog", health: "ok",   s: "2026-11-01", e: "2026-12-15", prog: 0 / 4 }
];

/* hand-written expectations from the HEALTH contract (today 2026-09-12). Overdue =
   unchecked sub-tasks with 📅 strictly before today; due today is NOT overdue.
   foundations  status done                                                      → done
   recording    dated; open 📅 09-10 (over), 09-25, undated → 1 overdue           → risk
   story        dated; open 📅 09-16, 09-18, 10-01 → 0 overdue, end 10-15 ahead   → ok
   distribution dated; open 📅 11-05 → 0 overdue, end 12-15 ahead                 → ok
   cover art    start/end missing                                                → unscheduled
   GOAL         non-paused tasks total 0+1+0+0+0 = 1 overdue, target 2026-12-31   → risk  (39%)
   The four task rows are unchanged from the old elapsed rule; only the GOAL moves
   (it used to read Behind on a -.4184 pace gap while nothing but one 09-10 item was
   actually late, and its target is still three and a half months away). */

withPage(async (page) => {
  /* ── 1. the goal panel on "Launch the app" ─────────────────────────── */
  const res = await page.evaluate(async ({ src, files }) => {
    const H = window.StormHarness;
    const app = H.mkVault(files, {});
    const dv = H.mkDv(app, "Goals/Launch the app.md");
    const c = await H.runBlock(src, dv, app);
    const txt = s => { const e = c.querySelector(s); return e ? e.textContent.trim() : null; };
    const rows = [...c.querySelectorAll("svg.gantt g.g-row")].map(g => {
      const lbl = g.querySelector("text.g-label");
      const b = g.querySelector("rect.g-bar");
      const f = g.querySelector("rect.g-fill");
      return {
        link: g.getAttribute("data-link"), status: g.getAttribute("data-status"), health: g.getAttribute("data-health"),
        label: lbl.textContent, title: lbl.getAttribute("title"), labelFont: lbl.getAttribute("font-size"),
        barCls: b.getAttribute("class"), x: +b.getAttribute("x"), w: +b.getAttribute("width"),
        y: +b.getAttribute("y"), h: +b.getAttribute("height"),
        fillX: +f.getAttribute("x"), fillW: +f.getAttribute("width"),
        tip: (g.querySelector("title") || {}).textContent
      };
    });
    const svg = c.querySelector("svg.gantt");
    const today = c.querySelector("line.g-today");
    const out = {
      err: !!c.querySelector(".goal-err"), errText: txt(".goal-err"),
      hbText: txt(".goal-hb"), hbCls: (c.querySelector(".goal-hb") || {}).className,
      prog: txt(".goal-prog"), meta: txt(".goal-meta"),
      viewBox: svg.getAttribute("viewBox"), par: svg.getAttribute("preserveAspectRatio"),
      minFont: Math.min(...[...c.querySelectorAll("svg.gantt text")].map(t => +t.getAttribute("font-size"))),
      rows,
      ticks: c.querySelectorAll(".g-axis line.g-tick").length,
      tickXs: [...c.querySelectorAll(".g-axis line.g-tick")].map(l => +l.getAttribute("x1")),
      monLabels: [...c.querySelectorAll(".g-axis text.g-mon")].map(t => t.textContent),
      todayX: today ? +today.getAttribute("x1") : null,
      chips: [...c.querySelectorAll(".g-backlog .g-chip")].map(e => ({ t: e.textContent, link: e.getAttribute("data-link") })),
      tasks: [...c.querySelectorAll(".g-tasklist .g-task")].map(e => ({
        chip: e.querySelector(".tchip").textContent, chipCls: e.querySelector(".tchip").className,
        name: e.querySelector(".g-tname").textContent, link: e.querySelector(".g-tname").getAttribute("data-link"),
        next: e.querySelector(".g-tnext").textContent, date: e.querySelector(".g-tdate").textContent,
        prog: e.querySelector(".g-tprog").textContent, health: e.getAttribute("data-health")
      })),
      all: c.textContent
    };
    /* click the 3rd Gantt row (Design pass) */
    c.querySelectorAll("svg.gantt g.g-row")[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    /* and a backlog chip */
    c.querySelector(".g-backlog .g-chip").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    out.log = app.__log.filter(o => o.op === "open");
    return out;
  }, { src: SRC, files });

  assert(!res.err, "panel rendered without the error div" + (res.err ? " — " + res.errText : ""));

  /* ── task collection / exclusion ── */
  assert(res.tasks.length === 5, "5 tasks point at the goal (got " + res.tasks.length + ")");
  assert(!/Other goal task/.test(res.all), "a task pointing at a different goal is excluded");
  assert(!/Old app task|Ancient leftover/.test(res.all), "Tasks/_archive/ is excluded");
  assert(!/Leg day|Squats|Lunges/.test(res.all), "Fitness/ checkboxes are never tasks");

  /* ── goal head (health per §2, hand-computed) ── */
  assert(res.hbText === "At risk", 'goal badge label is "At risk" (exactly 1 overdue sub-task)');
  assert(/\bhb\b/.test(res.hbCls) && /\brisk\b/.test(res.hbCls) && /goal-hb/.test(res.hbCls), "goal badge classes = goal-hb hb risk");
  assert(res.prog === "39%", "goal progress = 9/23 = 39% (got " + res.prog + ")");
  assert(res.meta === "5 tasks · window Jun 1 2025 – Dec 31 2026", "goal meta shows the window: " + res.meta);

  /* ── svg frame ── */
  const H = 40 + EXP_ROWS.length * 26 + 16;
  assert(res.viewBox === "0 0 1000 " + H, "viewBox = 0 0 1000 " + H + " (40 axis + 4*26 rows + 16)");
  assert(res.par === "xMinYMin meet", "preserveAspectRatio = xMinYMin meet");
  assert(res.minFont >= 11, "every SVG text is ≥ 11 viewBox units (min " + res.minFont + ")");

  /* ── rows: dated tasks only, sorted by start ── */
  assert(res.rows.length === 4, "4 Gantt rows = dated tasks only (got " + res.rows.length + ")");
  assert(res.rows.map(r => r.title).join(" | ") === EXP_ROWS.map(r => r.name).join(" | "), "rows sorted by start: " + res.rows.map(r => r.title).join(", "));

  EXP_ROWS.forEach((exp, i) => {
    const got = res.rows[i], b = bar(exp.s, exp.e, exp.prog);
    assert(got.x === b.x && got.w === b.w, `row ${i} "${exp.name}" bar x/width = ${b.x}/${b.w} (got ${got.x}/${got.w})`);
    assert(got.fillW === b.fill && got.fillX === b.x, `row ${i} fill width = ${b.fill} (progress ${Math.round(exp.prog * 100)}%)`);
    assert(got.barCls === "g-bar st-" + exp.status, `row ${i} bar class = g-bar st-${exp.status}`);
    assert(got.health === exp.health, `row ${i} health = ${exp.health}`);
    assert(got.y === 40 + i * 26 + 5 && got.h === 16, `row ${i} y/height = ${40 + i * 26 + 5}/16`);
    assert(got.link === "Tasks/" + exp.name + ".md", `row ${i} data-link = the task path`);
  });

  /* label truncation (~28 chars) with the full name on the title attribute */
  const longRow = res.rows[1];
  assert(longRow.label === "Cross-browser and mobile QA…" && longRow.label.length === 28, "long label truncated to 28 chars: " + longRow.label);
  assert(longRow.title === "Cross-browser and mobile QA pass", "full name kept on the title attribute");

  /* ── month axis ── */
  assert(res.ticks === 19, "19 month ticks (Jun 2025 … Dec 2026), got " + res.ticks);
  assert(res.tickXs[0] === xOf("2025-06-01") && res.tickXs[0] === 220, "first tick sits at the window start (x=220)");
  assert(res.tickXs[18] === xOf("2026-12-01"), "last tick at Dec 1 2026 → x=" + xOf("2026-12-01"));
  assert(res.monLabels.length === 19 && res.monLabels[0] === "Jun" && res.monLabels[7] === "Jan 2026", "month labels, year shown on January: " + res.monLabels.slice(0, 9).join(","));

  /* ── today marker ── */
  assert(res.todayX === xOf("2026-09-12"), "today line at x=" + xOf("2026-09-12") + " (2026-09-12), got " + res.todayX);

  /* ── backlog lane ── */
  assert(res.chips.length === 1 && res.chips[0].t === "Cover art and branding", "the undated task is a backlog chip");
  assert(res.chips[0].link === "Tasks/Cover art and branding.md", "backlog chip links to the task note");
  assert(!res.rows.some(r => /Cover art/.test(r.title)), "the undated task has no Gantt row");

  /* ── task list ── */
  const EXP_LIST = [
    { name: "App foundations", chip: "done", next: "—", date: "—", prog: "3/3", health: "done" },
    { name: "Cross-browser and mobile QA pass", chip: "active", next: "Record episode 1", date: "📅 Sep 10", prog: "2/5", health: "risk" },
    { name: "Design pass", chip: "active", next: "Write the questions", date: "📅 Sep 16", prog: "3/8", health: "ok" },
    { name: "Store listing", chip: "backlog", next: "Pick a host", date: "📅 Nov 5", prog: "0/4", health: "ok" },
    { name: "Cover art and branding", chip: "waiting", next: "Brief the designer", date: "—", prog: "1/3", health: "unscheduled" }
  ];
  EXP_LIST.forEach((exp, i) => {
    const got = res.tasks[i] || {};
    assert(got.name === exp.name, `tasklist row ${i} = ${exp.name}`);
    assert(got.chip === exp.chip && got.chipCls === "tchip st-" + exp.chip, `tasklist row ${i} chip = tchip st-${exp.chip}`);
    assert(got.next === exp.next, `tasklist row ${i} next move = "${exp.next}" (got "${got.next}")`);
    assert(got.date === exp.date, `tasklist row ${i} next-move date = "${exp.date}" (got "${got.date}")`);
    assert(got.prog === exp.prog, `tasklist row ${i} progress = ${exp.prog}`);
    assert(got.health === exp.health, `tasklist row ${i} health = ${exp.health}`);
  });

  /* ── clicks ── */
  assert(res.log.length === 2, "two open ops logged (got " + res.log.length + ")");
  assert(res.log[0] && res.log[0].link === "Tasks/Design pass.md", "clicking a .g-row opens that task: " + (res.log[0] || {}).link);
  assert(res.log[1] && res.log[1].link === "Tasks/Cover art and branding.md", "clicking a backlog chip opens that task");

  /* ── 2. empty state + short-window rule ────────────────────────────────── */
  const empty = await page.evaluate(async ({ src }) => {
    const H = window.StormHarness;
    const app = H.mkVault({
      "Goals/Fresh goal.md": "---\ntype: goal\nstatus: active\narea: New\ntarget:\ntags:\n  - goal\n---\n\n# Fresh goal\n",
      "Tasks/Unrelated.md": '---\ntype: task\ngoal: "[[Other]]"\nstatus: active\n---\n\n## Sub-tasks\n- [ ] nope\n'
    }, {});
    const dv = H.mkDv(app, "Goals/Fresh goal.md");
    const c = await H.runBlock(src, dv, app);
    return { text: c.textContent.trim(), svg: c.querySelectorAll("svg.gantt").length, meta: (c.querySelector(".goal-meta") || {}).textContent, err: !!c.querySelector(".goal-err") };
  }, { src: SRC });
  assert(!empty.err, "empty goal renders without error");
  /* ADDTASK — the empty state used to send you to the Dashboard to do a thing you
   can now do two lines above it; it points at the ＋ Task button instead. */
  assert(/No tasks point at this goal yet — press ＋ Task above to add the first one\./.test(empty.text), "empty state copy is exact: " + empty.text.slice(-90));
  assert(empty.svg === 0, "no Gantt SVG when there are no tasks");
  assert(empty.meta === "0 tasks · window Sep 12 – Nov 7", "empty window falls back to today + 8 weeks: " + empty.meta);

  /* ── 3. linksTo tolerates Link objects, bare strings and arrays ─────────── */
  const forms = await page.evaluate(async ({ src }) => {
    const H = window.StormHarness;
    const sub = "\n\n## Sub-tasks\n- [ ] step 📅 2026-09-20\n";
    const app = H.mkVault({
      "Goals/Ship it.md": "---\ntype: goal\nstatus: active\narea: Work\ntarget: 2026-11-01\ntags:\n  - goal\n---\n",
      // Dataview Link object (resolved wikilink)
      "Tasks/A link.md": '---\ntype: task\ngoal: "[[Ship it]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-10-01\n---' + sub,
      // aliased wikilink
      "Tasks/B alias.md": '---\ntype: task\ngoal: "[[Ship it|the launch]]"\nstatus: active\nstart: 2026-09-02\nend: 2026-10-02\n---' + sub,
      // plain string, no brackets
      "Tasks/C plain.md": '---\ntype: task\ngoal: Ship it\nstatus: active\nstart: 2026-09-03\nend: 2026-10-03\n---' + sub,
      // array of wikilink strings
      "Tasks/D array.md": '---\ntype: task\ngoal:\n  - "[[Nope]]"\n  - "[[Ship it]]"\nstatus: active\nstart: 2026-09-04\nend: 2026-10-04\n---' + sub,
      // full path string
      "Tasks/E path.md": '---\ntype: task\ngoal: Goals/Ship it.md\nstatus: active\nstart: 2026-09-05\nend: 2026-10-05\n---' + sub,
      // must NOT match
      "Tasks/F other.md": '---\ntype: task\ngoal: "[[Ship its sibling]]"\nstatus: active\nstart: 2026-09-06\nend: 2026-10-06\n---' + sub
    }, {});
    const dv = H.mkDv(app, "Goals/Ship it.md");
    const c = await H.runBlock(src, dv, app);
    return { names: [...c.querySelectorAll(".g-tname")].map(e => e.textContent), err: !!c.querySelector(".goal-err") };
  }, { src: SRC });
  assert(!forms.err, "link-form vault renders without error");
  assert(forms.names.join(",") === "A link,B alias,C plain,D array,E path",
    "linksTo() matches Link / alias / bare string / array / path and rejects a near-miss: " + forms.names.join(","));
});
