/* Agent V — cross-agent consistency (checks 1a / 1b / 1c).
   The SAME synthetic task set is fed to all four implementations of the SPEC §1/§2
   rules and every answer must match — and match the spec's own arithmetic. */
const { withPage, readFile, assert } = require("../lib.js");
const F = require("./fixtures.js");

const B = require("../build.js");
const FIN = B.VAULT();
const blocks = md => { const o = []; const re = /```dataviewjs\n([\s\S]*?)\n```/g; let m; while ((m = re.exec(md))) o.push(m[1]); return o; };
const dashSrc = blocks(readFile(FIN + "/Dashboard.md"))[0];
const idxSrc = blocks(readFile(FIN + "/Goals/🎯 Goals.md"))[0];
const boardSrc = blocks(readFile(FIN + "/Tasks/📋 Tasks.md"))[0];
const panelSrc = F.PANEL;   // a dv.view file: the whole file is the source (CONTRACT A)
const dailySrc = blocks(readFile(FIN + "/_scripts/daily-tables.txt"));

/* ---- the link-resolution helpers, lifted out of each implementation ---- */
const slice = (src, from, to, who, at) => {
  const a = src.indexOf(from, at || 0), b = src.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error("could not lift the link helpers out of " + who);
  return src.slice(a, b);
};
// the live-data section is where the dashboard's own copies of the shared rules live.
const LIVE = dashSrc.indexOf("/* ===================== live data ===================== */");
const LINKCODE = {
  dashboard: slice(dashSrc, "const baseOf = s =>", "// SPEC §2 — health is shared", "Dashboard.md", LIVE),
  panel: slice(panelSrc, "const baseOf = s =>", "/* ── SPEC §2 health ── */", "goal-panel.js"),
  index: slice(idxSrc, "const baseOf = s =>", "const HL = {", "🎯 Goals.md"),
  board: slice(boardSrc, "const baseOf = s =>", "const HL = {", "📋 Tasks.md"),
};

withPage(async (page, errors) => {
  const r = await page.evaluate(async ({ dashSrc, idxSrc, boardSrc, panelSrc, dailySrc, files, LINKCODE }) => {
    const H = window.StormHarness;
    const out = { link: {}, views: {} };

    /* ============ 1c — `goal:` link resolution, identical everywhere ============ */
    const CASES = [
      ["Link object",       { path: "Goals/Delta.md", display: "Delta", toString() { return "[[Delta]]"; } }],
      ["[[Name]]",          "[[Delta]]"],
      ["[[Name|alias]]",    "[[Delta|the delta goal]]"],
      ["![[Name]] embed",   "![[Delta]]"],
      ["[[Name#Heading]]",  "[[Delta#Outcome]]"],
      ["bare name",         "Delta"],
      ["full path",         "Goals/Delta.md"],
      ["array of links",    ["[[Nowhere]]", "[[Delta]]"]],
      ["array, no match",   ["[[Nowhere]]", "[[Elsewhere]]"]],
      ["different case",    "[[delta]]"],
      ["Link, wrong goal",  { path: "Goals/Alpha.md", display: "Alpha" }],
      ["empty string",      ""],
      ["null",              null],
      ["undefined",         undefined],
    ];
    const TARGET = { file: { path: "Goals/Delta.md", name: "Delta" } };
    for (const who of Object.keys(LINKCODE)) {
      const code = LINKCODE[who] + (who === "dashboard"
        ? "; return (v) => linkKeys(v).some(k => k === 'delta' || k === 'goals/delta.md');"
        : who === "board"
          ? "; return (v) => linkNames(v).some(r => String(r).toLowerCase() === 'goals/delta.md' || baseOf(String(r)).toLowerCase() === 'delta');"
          : "; return (v) => linksTo(v, " + JSON.stringify(TARGET) + ");");
      const f = new Function(code)();
      out.link[who] = CASES.map(([, v]) => !!f(v));
    }
    out.linkNames = CASES.map(([n]) => n);

    /* ============ 1a + 1b — the same vault through all four renderers ============ */
    const app = H.mkVault(files, {});
    const run = async (notePath, src) => {
      const dv = H.mkDv(app, notePath);
      return await H.runBlock(src, dv, app);
    };
    const norm = s => String(s == null ? "" : s).trim().replace(/^—$/, "");

    // --- dashboard
    const c = await run("Dashboard.md", dashSrc);
    out.views.dashboard = {
      err: (c.textContent.match(/Storm hub error[^\n]*/) || [null])[0],
      goals: [...c.querySelectorAll(".gc-row")].map(g => ({
        name: norm((g.querySelector(".gc-name") || {}).textContent),
        health: norm((g.querySelector(".hb") || {}).textContent),
        pct: (((g.querySelector(".gc-meta") || {}).textContent || "").match(/(\d+)%/) || [])[1],
        meta: norm((g.querySelector(".gc-meta") || {}).textContent),
      })),
      next: [...c.querySelectorAll('.nm-row[data-kind="next"]')].map(x => ({
        task: norm((x.querySelector(".nm-task") || {}).textContent),
        text: norm((x.querySelector(".nm-text") || {}).textContent),
        due: x.getAttribute("data-due") || "",
      })),
      groups: [...c.querySelectorAll(".nm-group .nm-ghead")].map(x => norm(x.textContent)),
    };

    // --- goal panels
    out.views.panel = {};
    for (const g of ["Alpha", "Beta", "Gamma", "Delta"]) {
      const el = await run("Goals/" + g + ".md", panelSrc);
      out.views.panel[g] = {
        err: (el.querySelector(".goal-err") || {}).textContent || "",
        health: norm((el.querySelector(".goal-hb") || {}).textContent),
        pct: norm((el.querySelector(".goal-prog") || {}).textContent).replace("%", ""),
        meta: norm((el.querySelector(".goal-meta") || {}).textContent),
        tasks: [...el.querySelectorAll(".g-task")].map(t => ({
          name: norm((t.querySelector(".g-tname") || {}).textContent),
          health: t.getAttribute("data-health"),
          prog: norm((t.querySelector(".g-tprog") || {}).textContent),
          next: norm((t.querySelector(".g-tnext") || {}).textContent),
          date: norm((t.querySelector(".g-tdate") || {}).textContent),
        })),
      };
    }

    // --- goals index
    const gi = await run("Goals/🎯 Goals.md", idxSrc);
    out.views.index = [...gi.querySelectorAll(".gi-card")].map(x => ({
      name: norm((x.querySelector(".gi-name") || {}).textContent),
      health: x.getAttribute("data-health"),
      pct: norm((x.querySelector(".gi-pct") || {}).textContent).replace("%", ""),
      foot: norm((x.querySelector(".gi-foot") || {}).textContent),
    }));

    // --- tasks board
    const tb = await run("Tasks/📋 Tasks.md", boardSrc);
    out.views.board = [...tb.querySelectorAll(".tb-card")].map(x => ({
      name: norm((x.querySelector(".tb-name") || {}).textContent),
      health: norm((x.querySelector(".hb") || {}).textContent),
      prog: norm((x.querySelector(".tb-prog") || {}).textContent),
      next: norm((x.querySelector(".tb-next") || {}).textContent).replace(/\s*📅.*$/, ""),
      goal: norm((x.querySelector(".tb-goal") || {}).textContent).replace(/^🎯\s*/, ""),
    }));

    // --- daily tables: a dated checkbox under `### Phase 1` (inside Sub-tasks) counts,
    //     the one under `## 🗒️ Notes` does not
    app.__store.set("Daily/2026-09-16 Wednesday.md", "---\ndate: 2026-09-16\ntags:\n  - daily\n---\n\n# Wednesday\n");
    const p16 = await run("Daily/2026-09-16 Wednesday.md", dailySrc[0]);
    out.views.planned16 = [...p16.querySelectorAll("tbody tr")].map(tr => [...tr.querySelectorAll("td")].map(td => td.textContent.trim()));

    // --- daily tables: Planned for 2026-09-14 must hold exactly the A1 sub-task
    app.__store.set("Daily/2026-09-14 Monday.md", "---\ndate: 2026-09-14\ntags:\n  - daily\n---\n\n# Monday\n");
    const pl = await run("Daily/2026-09-14 Monday.md", dailySrc[0]);
    out.views.planned14 = [...pl.querySelectorAll("tbody tr")].map(tr => [...tr.querySelectorAll("td")].map(td => td.textContent.trim()));
    // …and nothing from a #habit line or a non-sub-task section ever shows up
    app.__store.set("Daily/2026-09-05 Saturday.md", "---\ndate: 2026-09-05\ntags:\n  - daily\n---\n\n# Saturday\n");
    const dn = await run("Daily/2026-09-05 Saturday.md", dailySrc[1]);
    out.views.done05 = [...dn.querySelectorAll("tbody tr")].map(tr => [...tr.querySelectorAll("td")].map(td => td.textContent.trim()));
    return out;
  }, { dashSrc, idxSrc, boardSrc, panelSrc, dailySrc, files: F.files, LINKCODE });

  /* ---------- 1c ---------- */
  console.log("── 1c: `goal:` link resolution is identical in all four implementations ──");
  const impls = ["dashboard", "panel", "index", "board"];
  const want = [true, true, true, true, true, true, true, true, false, true, false, false, false, false];
  r.linkNames.forEach((nm, i) => {
    const got = impls.map(k => r.link[k][i]);
    const same = got.every(v => v === got[0]);
    assert(same, "link form “" + nm + "” resolves the same everywhere — " + impls.map((k, j) => k + ":" + got[j]).join(" "));
    if (same) assert(got[0] === want[i], "…and the answer is " + want[i] + " for “" + nm + "”");
  });

  /* ---------- 1a + 1b ---------- */
  console.log("── 1a/1b: sub-task selection, progress + health agree across views ──");
  const D = r.views.dashboard, P = r.views.panel, I = r.views.index, B = r.views.board;
  assert(!D.err, "dashboard block ran clean on the synthetic vault" + (D.err ? " (" + D.err + ")" : ""));
  Object.keys(P).forEach(g => assert(!P[g].err, "goal panel for " + g + " ran clean" + (P[g].err ? " (" + P[g].err + ")" : "")));

  const HBL = { ok: "On track", risk: "At risk", behind: "Behind", done: "Done", unscheduled: "Unscheduled" };
  const byName = (arr) => Object.fromEntries(arr.map(x => [x.name, x]));
  const dG = byName(D.goals), iG = byName(I), bT = byName(B);

  for (const [g, e] of Object.entries(F.EXPECT.goals)) {
    const pct = String(Math.round(e.done / e.total * 100));
    assert(dG[g] && dG[g].pct === pct && P[g].pct === pct && iG[g].pct === pct,
      g + ": progress = " + e.done + "/" + e.total + " = " + pct + "% in dashboard/panel/index — " +
      [dG[g] && dG[g].pct, P[g].pct, iG[g].pct].join("/"));
    assert(String(pct) === String(e.pct), g + ": …which is what SPEC §2 arithmetic gives (" + e.pct + "%)");
    const lbl = HBL[e.health];
    assert(dG[g].health === lbl && P[g].health === lbl && HBL[iG[g].health] === lbl,
      g + ": health = " + lbl + " in dashboard/panel/index — " + [dG[g].health, P[g].health, iG[g].health].join("/"));
    assert(new RegExp("^" + e.nTasks + " tasks").test(P[g].meta) && new RegExp("^" + e.nTasks + " tasks").test(iG[g].foot),
      g + ": " + e.nTasks + " tasks in panel + index — " + P[g].meta + " | " + iG[g].foot);
  }

  const panelTasks = {};
  Object.values(P).forEach(p => p.tasks.forEach(t => panelTasks[t.name] = t));
  for (const [t, e] of Object.entries(F.EXPECT.tasks)) {
    const pt = panelTasks[t], bt = bT[t];
    assert(pt && bt, t + ": present in both the goal panel and the task board");
    if (!pt || !bt) continue;
    const prog = e.done + "/" + e.total;
    assert(pt.prog === prog && bt.prog === prog,
      t + ": sub-tasks " + prog + " in panel + board — " + pt.prog + " / " + bt.prog);
    assert(pt.health === e.health && bt.health === HBL[e.health],
      t + ": health " + e.health + " in panel + board — " + pt.health + " / " + bt.health);
    assert(pt.next === e.next && bt.next === e.next,
      t + ": next move " + JSON.stringify(e.next) + " in panel + board — " + JSON.stringify([pt.next, bt.next]));
  }
  // and the dashboard's own next-move rows agree for every ACTIVE task
  const dNext = Object.fromEntries(D.next.map(x => [x.task, x]));
  for (const [t, e] of Object.entries(F.EXPECT.tasks)) {
    if (t === "G1 done" || t === "G3 empty") { assert(!dNext[t], t + ": contributes no next move to the dashboard"); continue; }
    assert(dNext[t] && dNext[t].text === e.next,
      t + ": the dashboard shows the same next move — " + JSON.stringify(dNext[t] && dNext[t].text));
    assert(dNext[t] && (dNext[t].due || "") === e.nextDue, t + ": …with the same 📅 date (" + JSON.stringify(e.nextDue) + ")");
  }
  assert(D.groups.length === 4, "every goal with an active next move gets a group, got " + D.groups.length);

  console.log("── 1a: the daily tables use the same sub-task set ──");
  assert(r.views.planned14.length === 1 && r.views.planned14[0][0] === "☐ Earlier dated",
    "Planned 2026-09-14 = exactly the one dated sub-task — " + JSON.stringify(r.views.planned14));
  assert(r.views.planned14[0][1] === "A1 plain" && r.views.planned14[0][3] === "active",
    "…attributed to its task and status — " + JSON.stringify(r.views.planned14[0]));
  assert(r.views.done05.length === 1 && r.views.done05[0][0] === "☑ Did one",
    "Done 2026-09-05 = exactly the one ✅ sub-task; the ✅ box under `## 🗒️ Notes` is not one — " + JSON.stringify(r.views.done05));
  assert(r.views.planned16.length === 1 && r.views.planned16[0][0] === "☐ Phase one step",
    "Planned 2026-09-16 = the box under `## Sub-tasks` › `### Phase 1` only, not the dated one under `## 🗒️ Notes` — " +
    JSON.stringify(r.views.planned16));

  console.log("── 1a: heading ANCESTRY (finding 16) ──");
  const pt2 = {}; Object.values(r.views.panel).forEach(p => p.tasks.forEach(t => pt2[t.name] = t));
  const bt2 = Object.fromEntries(r.views.board.map(x => [x.name, x]));
  assert(pt2["B5 nested phases"].prog === "1/3" && bt2["B5 nested phases"].prog === "1/3",
    "`## Sub-tasks` › `### Phase 1` / `### Phase 2` items are counted (1/3), and the boxes under the later `## 🗒️ Notes` are not");
  assert(pt2["B6 nested subtasks heading"].prog === "1/2" && bt2["B6 nested subtasks heading"].prog === "1/2",
    "`## Plan` › `### Sub-tasks` is recognised, and neither `## Plan` nor `## Wrap up` boxes leak in (1/2)");
  assert(pt2["A2 no heading"].prog === "1/3", "a note with no Sub-tasks heading anywhere still counts every checkbox (1/3)");
  assert(pt2["B4 spaced heading with notes"].prog === "0/1", "the `# Title` H1 above everything does not break the stack (0/1)");

  if (errors.length) assert(false, "page errors: " + errors.join(" | "));
  else assert(true, "no uncaught page errors");
}).catch(e => { console.log("FAIL: " + e.stack); process.exitCode = 1; });
