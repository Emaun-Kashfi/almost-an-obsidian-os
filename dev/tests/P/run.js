/* Agent P — the paused goal/task state (PAUSE contract §6, items 1–10).
   Today is fixed at 2026-09-13 by the harness.

   The vault below is deliberately loud: goal 🚀 Launch the app is Behind/At-risk and its
   two tasks carry overdue, due-today and future sub-tasks. Pausing the goal must
   silence every one of those numbers without touching a single task note; flipping
   the same fixture back to `active` must make all of them fire again (item 2).      */
const { withPage, extractBlocks, readFile, assert } = require("../lib.js");

const B = require("../build.js");
const VAULT = B.VAULT(), COMMON = B.COMMON;
const NOW = "2026-09-13T10:00:00";
const TODAY = "2026-09-13";

const DASH = extractBlocks(readFile(`${VAULT}/Dashboard.md`))[0];
const GOALS_SRC = extractBlocks(readFile(`${COMMON}/Goals/🎯 Goals.md`))[0];
const BOARD_SRC = extractBlocks(readFile(`${COMMON}/Tasks/📋 Tasks.md`))[0];
/* the panels are dv.view files now — bare JS, no fence to extract (CONTRACT A) */
const PANEL_SRC = readFile(`${COMMON}/_scripts/goal-panel.js`);
const GANTT_SRC = readFile(`${COMMON}/_scripts/task-gantt.js`);
const TRIAGE_SRC = extractBlocks(readFile(`${COMMON}/🧹 Triage.md`))[0];
const DT = readFile(`${COMMON}/_scripts/daily-tables.txt`).split(/^<!-- SPLIT -->$/m)
  .map(s => (s.trim().match(/^```dataviewjs\n([\s\S]*)\n```$/) || [])[1]);
const PLANNED_SRC = DT[0], DONE_SRC = DT[1];

/* date maths, independent of the code under test */
const D = iso => { const [y, m, d] = String(iso).split("-").map(Number); return Date.UTC(y, m - 1, d); };
const two = n => String(n).padStart(2, "0");
const addDays = (iso, n) => { const d = new Date(D(iso) + n * 86400000);
  return d.getUTCFullYear() + "-" + two(d.getUTCMonth() + 1) + "-" + two(d.getUTCDate()); };
const dayDiff = (a, b) => Math.round((D(b) - D(a)) / 86400000);
assert(dayDiff("2026-06-15", TODAY) === 90, "the §6.9 fixture really is 90 days old (2026-06-15 → " + TODAY + ")");

/* ── the shared vault ─────────────────────────────────────────────────────── */
const T = (fm, subs) => `---\n${fm}\n---\n\n# Task\n\n## Sub-tasks\n${subs}\n\n## 🗒️ Notes\n- \n`;
const GOAL_LAUNCH = "Goals/🚀 Launch the app.md";
const TS = "Goals/🧠 TypeScript.md";

function baseVault(goalStatus) {
  return {
    "Dashboard.md": "---\ncssclasses:\n  - storm-home\ntags:\n  - dashboard\n---\n\n```dataviewjs\n```\n",
    "Goals/🎯 Goals.md": "---\ncssclasses:\n  - dashboard\ntags:\n  - dashboard\n---\n\n# 🎯 Goals\n",
    "Tasks/📋 Tasks.md": "---\ncssclasses:\n  - dashboard\ntags:\n  - dashboard\n---\n\n# 📋 Tasks\n",

    [GOAL_LAUNCH]: `---\ntype: goal\nstatus: ${goalStatus}\narea: Product\ntarget: 2026-12-31\n` +
      (goalStatus === "paused" ? "paused: 2026-06-15\n" : "") + "tags:\n  - goal\n---\n\n# 🚀 Launch the app\n",
    [TS]: "---\ntype: goal\nstatus: active\narea: Learning\ntarget: 2026-12-31\ntags:\n  - goal\n---\n\n# 🧠 TypeScript\n",

    /* two tasks under the launch goal — both stay `status: active` no matter what
       the goal says, which is the whole point of a COMPUTED cascade */
    "Tasks/Story arc.md": T(
      'type: task\ngoal: "[[🚀 Launch the app]]"\nstatus: active\nstart: 2026-08-01\nend: 2026-10-15\ncompleted:\ntags:\n  - task',
      ["- [x] Outline the arc 📅 2026-09-02 ✅ 2026-09-13",
       "- [ ] Confirm the guest 📅 2026-09-05",
       "- [ ] Write the questions 📅 2026-09-13",
       "- [ ] Book the studio 📅 2026-10-01"].join("\n")),
    "Tasks/Edit pass.md": T(
      'type: task\ngoal: "[[🚀 Launch the app]]"\nstatus: active\nstart: 2026-08-10\nend: 2026-10-20\ncompleted:\ntags:\n  - task',
      ["- [ ] Rough cut 📅 2026-09-08",
       "- [ ] Mix the episode 📅 2026-09-13",
       "- [ ] Master it 📅 2026-10-05"].join("\n")),

    /* an ACTIVE goal with two tasks — one of them paused on its own (§6.3 / §6.6) */
    "Tasks/Convert a project.md": T(
      'type: task\ngoal: "[[🧠 TypeScript]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-10-10\ncompleted:\ntags:\n  - task',
      ["- [x] Rename to .ts ✅ 2026-09-09",
       "- [ ] Fix the type errors 📅 2026-09-11",
       "- [ ] Enable strict mode 📅 2026-09-13",
       "- [ ] Delete the shims 📅 2026-10-02"].join("\n")),
    "Tasks/Type the API.md": T(
      'type: task\ngoal: "[[🧠 TypeScript]]"\nstatus: paused\npaused: 2026-08-01\nstart: 2026-09-02\nend: 2026-10-12\ncompleted:\ntags:\n  - task',
      ["- [ ] Write the request types 📅 2026-09-04",
       "- [ ] Write the response types 📅 2026-09-13",
       "- [ ] Publish the d.ts 📅 2026-10-03"].join("\n")),

    "Daily/2026-09-13 Sunday.md":
      "---\ndate: 2026-09-13\ntags:\n  - daily\n---\n\n# Sunday, September 13\n\n## 🎯 One thing\n\n→ \n\n" +
      "## ⚡ Tasks\n\n- [ ] Chase the studio invoice\n\n## 🌙 Shutdown\n**Win of the day:** \n",
  };
}

const PAUSED_TASKS = ["Story arc", "Edit pass"];

/* what each harness page reports back about the Dashboard */
const READ_DASH = `(c) => {
  const txt = s => (c.querySelector(s) || {}).textContent;
  const tile = f => { const t = c.querySelector('.act[data-filter="' + f + '"] .n'); return t ? t.textContent.trim() : null; };
  return {
    err: (c.textContent.match(/Storm hub error[^\\n]*/) || [null])[0],
    strip: { nm: tile("nm"), today: tile("today"), over: tile("over"), risk: tile("risk") },
    pulse: [...c.querySelectorAll(".pulse .pstat .pn")].map(e => e.textContent.trim()),
    groups: [...c.querySelectorAll(".nm-group .nm-ghead")].map(e => e.textContent.trim()),
    rows: [...c.querySelectorAll(".nowcard .nm-row")].map(e => ({
      text: (e.querySelector(".nm-text") || {}).textContent,
      task: (e.querySelector(".nm-task") || {}).textContent,
      kind: e.getAttribute("data-kind"),
    })),
    gc: [...c.querySelectorAll(".gc-row .gc-name")].map(e => e.textContent),
    gcHb: [...c.querySelectorAll(".gc-row")].map(e => (e.querySelector(".gc-name") || {}).textContent + "=" + (e.querySelector(".hb") || {}).textContent),
    all: c.textContent,
  };
}`;

withPage(async (page, errors) => {

  /* ═══ 1 + 2. the same vault, paused and active ══════════════════════════ */
  const shot = await page.evaluate(async ({ DASH, PLANNED_SRC, DONE_SRC, TRIAGE_SRC, vaults, readDash }) => {
    const H = window.StormHarness;
    const read = eval("(" + readDash + ")");
    const out = {};
    for (const [key, files] of Object.entries(vaults)) {
      const app = H.mkVault(files, {});
      const c = await H.runBlock(DASH, H.mkDv(app, "Dashboard.md"), app);
      const dash = read(c);

      const day = "Daily/2026-09-13 Sunday.md";
      const appP = H.mkVault(files, {}); const dvP = H.mkDv(appP, day);
      const planned = await H.runBlock(PLANNED_SRC, dvP, appP);
      const appD = H.mkVault(files, {}); const dvD = H.mkDv(appD, day);
      const doneT = await H.runBlock(DONE_SRC, dvD, appD);
      const appT = H.mkVault(files, {}); const dvT = H.mkDv(appT, "🧹 Triage.md");
      const triage = await H.runBlock(TRIAGE_SRC, dvT, appT);

      out[key] = {
        dash,
        plannedRows: [...planned.querySelectorAll("table.dt tbody tr")].map(tr => tr.textContent),
        plannedEmpty: /Nothing planned/.test(planned.textContent),
        doneRows: [...doneT.querySelectorAll("table.dt tbody tr")].map(tr => tr.textContent),
        triageOpts: [...triage.querySelectorAll(".tr-sel option")].map(o => o.textContent),
        triageErr: !!triage.querySelector(".goal-err, .triage-error"),
      };
    }
    return out;
  }, { DASH, PLANNED_SRC, DONE_SRC, TRIAGE_SRC, readDash: READ_DASH,
       vaults: { paused: baseVault("paused"), active: baseVault("active") } });

  const P = shot.paused, A = shot.active;

  console.log("── §6.1 a paused goal goes quiet everywhere ──");
  assert(!P.dash.err, "dashboard renders without an error div" + (P.dash.err ? " — " + P.dash.err : ""));
  assert(!P.dash.groups.some(g => /Launch the app/.test(g)), "⚡ Now card has no 🚀 Launch the app group — " + JSON.stringify(P.dash.groups));
  assert(!P.dash.rows.some(r => PAUSED_TASKS.includes(r.task)), "no ⚡ Now row belongs to a paused task — " +
    JSON.stringify(P.dash.rows.filter(r => PAUSED_TASKS.includes(r.task)).map(r => r.text)));
  assert(P.dash.strip.nm === "1", "strip · Next moves counts only the live task, got " + P.dash.strip.nm);
  assert(P.dash.strip.today === "1", "strip · Due today drops both paused due-today sub-tasks, got " + P.dash.strip.today);
  assert(P.dash.strip.over === "1", "strip · Overdue drops both paused overdue sub-tasks, got " + P.dash.strip.over);
  /* HEALTH contract — 🚀 Launch the app is paused, so it is still not counted here. The one
     that IS counted is 🧠 TypeScript: its live task "Convert a project" carries
     "Fix the type errors 📅 2026-09-11", two days overdue on 2026-09-13 → At risk.
     (Under the old pacing rule it read On track — 1/7 done against 12/121 days.) */
  assert(P.dash.strip.risk === "1", "strip · Goals at risk ignores the paused goal and counts only 🧠 TypeScript, got " + P.dash.strip.risk);
  assert(P.dash.pulse[1] === "1", "pulse · active tasks excludes the paused ones, got " + P.dash.pulse[1]);
  assert(!P.dash.gc.some(n => /Launch the app/.test(n)), "🎯 Goals card omits the paused goal — " + JSON.stringify(P.dash.gc));
  assert(!P.plannedRows.some(t => /Write the questions|Mix the episode/.test(t)),
    "daily · Planned today omits paused work — " + JSON.stringify(P.plannedRows));
  assert(P.doneRows.some(t => /Outline the arc/.test(t)),
    "daily · Done today still lists the sub-task completed today — " + JSON.stringify(P.doneRows));
  assert(!P.triageErr && !P.triageOpts.some(o => PAUSED_TASKS.some(n => o.startsWith(n))),
    "🧹 Triage offers no paused task as a destination — " + JSON.stringify(P.triageOpts));

  console.log("── §6.2 the same vault with the goal active — every number fires ──");
  assert(!A.dash.err, "dashboard renders without an error div (active variant)");
  assert(A.dash.groups.some(g => /Launch the app/.test(g)), "⚡ Now card shows the 🚀 Launch the app group again");
  assert(A.dash.strip.nm === "3", "strip · Next moves = 3, got " + A.dash.strip.nm);
  assert(A.dash.strip.today === "3", "strip · Due today = 3, got " + A.dash.strip.today);
  assert(A.dash.strip.over === "3", "strip · Overdue = 3, got " + A.dash.strip.over);
  assert(Number(A.dash.strip.risk) > 0, "strip · Goals at risk is non-zero, got " + A.dash.strip.risk);
  assert(A.dash.pulse[1] === "3", "pulse · active tasks = 3, got " + A.dash.pulse[1]);
  assert(A.dash.gc.some(n => /Launch the app/.test(n)), "🎯 Goals card lists the goal again");
  assert(A.plannedRows.some(t => /Write the questions/.test(t)) && A.plannedRows.some(t => /Mix the episode/.test(t)),
    "daily · Planned today lists the paused-fixture work when the goal is active — " + JSON.stringify(A.plannedRows));
  assert(A.triageOpts.some(o => o.startsWith("Story arc")) && A.triageOpts.some(o => o.startsWith("Edit pass")),
    "🧹 Triage offers both tasks again — " + JSON.stringify(A.triageOpts));

  console.log("── §6.3 one task paused under an ACTIVE goal ──");
  /* Type the API is `status: paused` under the active 🧠 TypeScript goal. */
  assert(!A.dash.rows.some(r => r.task === "Type the API"), "the own-paused task shows no ⚡ Now row");
  assert(!A.dash.rows.some(r => /Write the response types/.test(r.text || "")), "…and none of its sub-tasks leak in as overdue/today");
  assert(A.dash.rows.some(r => r.task === "Convert a project"), "its sibling task still shows its next move");
  /* HEALTH contract — the own-paused "Type the API" is excluded from the goal's overdue
     total (PAUSE §3: paused work is never late), so the goal reports the health of the
     work that is still running: "Fix the type errors 📅 2026-09-11" is the only overdue
     item left → exactly 1 → At risk. The paused task's own two overdue sub-tasks
     ("Write the request types" 📅 09-04 and the response types 📅 09-13) are ignored;
     were they counted the goal would read Behind, which is what pausing must prevent. */
  assert(A.dash.gcHb.some(s => s === "🧠 TypeScript=At risk"),
    "the goal itself still reports its own health from the remaining work — " + JSON.stringify(A.dash.gcHb));
  assert(!A.plannedRows.some(t => /response types/.test(t)), "daily · Planned today omits the own-paused task");
  assert(!A.triageOpts.some(o => o.startsWith("Type the API")), "🧹 Triage does not offer the own-paused task");

  /* ═══ 4. badges on the notes themselves ═════════════════════════════════ */
  const badges = await page.evaluate(async ({ PANEL_SRC, GANTT_SRC, files }) => {
    const H = window.StormHarness;
    const run = async (src, path) => {
      const app = H.mkVault(files, {});
      const c = await H.runBlock(src, H.mkDv(app, path), app);
      return {
        hb: (c.querySelector(".hb") || {}).textContent,
        hbCls: (c.querySelector(".hb") || {}).className,
        err: !!c.querySelector(".goal-err, .tg-err"),
        pause: c.querySelectorAll(".pausebtn").length,
        resume: c.querySelectorAll(".resumebtn").length,
      };
    };
    return {
      goal: await run(PANEL_SRC, "Goals/🚀 Launch the app.md"),
      cascade: await run(GANTT_SRC, "Tasks/Story arc.md"),
      own: await run(GANTT_SRC, "Tasks/Type the API.md"),
      live: await run(GANTT_SRC, "Tasks/Convert a project.md"),
      liveGoal: await run(PANEL_SRC, "Goals/🧠 TypeScript.md"),
    };
  }, { PANEL_SRC, GANTT_SRC, files: baseVault("paused") });

  console.log("── §6.4 the Paused badge on the notes ──");
  assert(!badges.goal.err && badges.goal.hb === "Paused" && /\bpaused\b/.test(badges.goal.hbCls),
    "paused goal note → Paused badge (got " + badges.goal.hb + " / " + badges.goal.hbCls + ")");
  assert(!badges.cascade.err && badges.cascade.hb === "Paused",
    "its task's Timeline header → Paused although the task's own frontmatter says active (got " + badges.cascade.hb + ")");
  assert(badges.own.hb === "Paused", "an own-paused task's Timeline header → Paused");
  assert(badges.live.hb !== "Paused" && badges.liveGoal.hb !== "Paused", "unpaused notes keep their real health");
  assert(badges.goal.resume === 1 && badges.goal.pause === 0, "the paused goal panel offers ▶ Resume, not ⏸ Pause");
  assert(badges.live.pause === 1 && badges.live.resume === 0, "a live task's Timeline offers ⏸ Pause");
  assert(badges.own.resume === 1 && badges.own.pause === 0, "an own-paused task's Timeline offers ▶ Resume");
  assert(badges.cascade.pause === 1 && badges.cascade.resume === 0,
    "a cascade-paused task offers ⏸ Pause — resuming it alone would not un-pause its goal");

  /* ═══ 5. 🎯 Goals index ═════════════════════════════════════════════════ */
  const gi = await page.evaluate(async ({ GOALS_SRC, files }) => {
    const H = window.StormHarness;
    const app = H.mkVault(files, {});
    const c = await H.runBlock(GOALS_SRC, H.mkDv(app, "Goals/🎯 Goals.md"), app);
    const det = c.querySelector("details.goal-paused");
    const nameOf = e => e.querySelector(".gi-name").textContent;
    return {
      err: !!c.querySelector(".goal-err"),
      live: [...c.querySelectorAll(".goalsidx")[0].querySelectorAll(".gi-card")].map(e => ({
        name: nameOf(e), hb: e.querySelector(".hb").textContent, paused: e.getAttribute("data-paused") })),
      hasDetails: !!det,
      open: det ? det.hasAttribute("open") : null,
      summary: det ? det.querySelector("summary").textContent.trim() : "",
      inside: det ? [...det.querySelectorAll(".gi-card")].map(nameOf) : [],
      insideResume: det ? det.querySelectorAll(".resumebtn").length : 0,
      outside: [...c.querySelectorAll(".gi-card")].filter(e => !det || !det.contains(e)).map(nameOf),
      isLast: det ? c.lastElementChild === det : false,
    };
  }, { GOALS_SRC, files: baseVault("paused") });

  console.log("── §6.5 🎯 Goals index ──");
  assert(!gi.err && gi.hasDetails, "the index renders a details.goal-paused group");
  assert(gi.summary === "Paused (1)", 'summary reads "Paused (1)", got "' + gi.summary + '"');
  assert(gi.open === false, "the paused group is collapsed by default");
  assert(gi.isLast, "the paused group is the last thing on the page");
  assert(gi.inside.join(",") === "🚀 Launch the app", "the paused goal is inside it — " + JSON.stringify(gi.inside));
  assert(gi.insideResume === 1, "each paused row carries a ▶ Resume control");
  assert(!gi.outside.some(n => /Launch the app/.test(n)), "the paused goal appears nowhere else — " + JSON.stringify(gi.outside));
  assert(gi.live.length === 1 && gi.live[0].name === "🧠 TypeScript" && !gi.live[0].paused,
    "active goals are unaffected — " + JSON.stringify(gi.live));
  const LBL = { Behind: 0, "At risk": 1, "On track": 2, Unscheduled: 3, Done: 4, Paused: 5 };
  const order = gi.live.map(g => LBL[g.hb]);
  assert(order.every((v, i) => i === 0 || order[i - 1] <= v), "…and still sorted worst-health first");

  /* ═══ 6. 📋 Tasks board ═════════════════════════════════════════════════ */
  const tb = await page.evaluate(async ({ BOARD_SRC, files }) => {
    const H = window.StormHarness;
    const app = H.mkVault(files, {});
    const c = await H.runBlock(BOARD_SRC, H.mkDv(app, "Tasks/📋 Tasks.md"), app);
    return {
      err: !!c.querySelector(".goal-err"),
      cols: [...c.querySelectorAll(".tb-col")].map(col => ({
        key: col.getAttribute("data-col"),
        label: col.querySelector(".tb-head").textContent.trim().replace(/\s+/g, " "),
        cards: [...col.querySelectorAll(".tb-card")].map(e => ({
          name: e.querySelector(".tb-name").textContent,
          paused: e.getAttribute("data-paused"),
          hb: e.querySelector(".hb").textContent })),
      })),
    };
  }, { BOARD_SRC, files: baseVault("paused") });

  console.log("── §6.6 📋 Tasks board ──");
  assert(!tb.err, "the board renders without an error div");
  assert(tb.cols.map(c => c.key).join(",") === "backlog,active,waiting,paused,done",
    "Paused sits between Waiting and Done — " + tb.cols.map(c => c.key).join(","));
  const pausedCol = tb.cols.find(c => c.key === "paused");
  assert(/^Paused\b/.test(pausedCol.label), 'the column is labelled "Paused" — ' + pausedCol.label);
  assert(pausedCol.cards.map(c => c.name).join(",") === "Type the API",
    "only the OWN-paused task lands there — " + JSON.stringify(pausedCol.cards.map(c => c.name)));
  const activeCol = tb.cols.find(c => c.key === "active");
  const cascade = activeCol.cards.filter(c => ["Story arc", "Edit pass"].includes(c.name));
  assert(cascade.length === 2 && cascade.every(c => c.paused === "1" && c.hb === "Paused"),
    "cascade-paused tasks stay in their own column, muted with data-paused — " + JSON.stringify(cascade));
  assert(activeCol.cards.some(c => c.name === "Convert a project" && !c.paused), "live work carries no data-paused");

  /* ═══ 7. the Pause button ═══════════════════════════════════════════════ */
  const CRLF_GOAL = "Goals/CRLF goal.md";
  const crlfFiles = {
    "Goals/🎯 Goals.md": "---\ntags:\n  - dashboard\n---\n\n# 🎯 Goals\n",
    [CRLF_GOAL]: ["---", "type: goal", "status: active", 'area: "Home: inside"', "target: 2026-12-31",
      "cover: Images/x.png", "tags:", "  - goal", "---", "", "# CRLF goal", "",
      "Body text that must not move.", "", "## 🗒️ Notes", "- keep me", ""].join("\r\n"),
    "Tasks/Under crlf.md": T('type: task\ngoal: "[[CRLF goal]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-10-01\ncompleted:\ntags:\n  - task',
      "- [ ] Something 📅 2026-09-20"),
  };
  const pauseRes = await page.evaluate(async ({ PANEL_SRC, files, path }) => {
    const H = window.StormHarness;
    const app = H.mkVault(files, {});
    const before = app.__store.get(path);
    const c = await H.runBlock(PANEL_SRC, H.mkDv(app, path), app);
    c.querySelector(".pausebtn").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const after = app.__store.get(path);
    // pausing twice must be a no-op
    const c2 = await H.runBlock(PANEL_SRC, H.mkDv(app, path), app);
    const again = c2.querySelector(".pausebtn");
    if (again) again.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    return { before, after, after2: app.__store.get(path),
             writes: app.__log.filter(o => o.op === "modify" && o.path === path).length,
             pfm: app.__log.filter(o => o.op === "processFrontMatter").length,
             secondHasPause: !!again,
             notices: window.__notices.slice() };
  }, { PANEL_SRC, files: crlfFiles, path: CRLF_GOAL });

  console.log("── §6.7 ⏸ Pause writes exactly two keys, in one modify ──");
  assert(pauseRes.writes === 1, "exactly one vault.modify for the goal note, got " + pauseRes.writes);
  assert(pauseRes.pfm === 0, "processFrontMatter is never used (it reorders and reformats keys)");
  const bLines = pauseRes.before.split("\r\n"), aLines = pauseRes.after.split("\r\n");
  assert(!/\n/.test(pauseRes.after.replace(/\r\n/g, "")), "CRLF preserved — no bare LF anywhere in the result");
  assert(aLines.length === bLines.length + 1, "exactly one line added, got " + (aLines.length - bLines.length));
  assert(aLines[2] === "status: paused", "`status: active` became `status: paused` in place — " + aLines[2]);
  assert(aLines[8] === "paused: 2026-09-13", "`paused: 2026-09-13` is appended as the last frontmatter key — " + aLines[8]);
  assert(aLines[9] === "---", "the frontmatter fence is still intact");
  assert(JSON.stringify(aLines.filter((_, k) => k !== 2 && k !== 8)) === JSON.stringify(bLines.filter((_, k) => k !== 2)),
    "every other frontmatter key and the whole body are byte-identical");
  assert(pauseRes.after2 === pauseRes.after, "pausing an already-paused goal writes nothing");

  /* ═══ 8 + 9 + 10. Resume ════════════════════════════════════════════════ */
  const SG = "Goals/Shift goal.md";
  const shiftFiles = {
    "Goals/🎯 Goals.md": "---\ntags:\n  - dashboard\n---\n\n# 🎯 Goals\n",
    [SG]: "---\ntype: goal\nstatus: paused\npaused: 2026-06-15\narea: Studio\ntarget: 2026-10-01\ntags:\n  - goal\n---\n\n# Shift goal\n",
    "Tasks/Shift A.md": T('type: task\ngoal: "[[Shift goal]]"\nstatus: active\nstart: 2026-06-01\nend: 2026-07-30\ncompleted:\ntags:\n  - task',
      ["- [x] Done step 📅 2026-06-20 ✅ 2026-06-21",
       "- [ ] Step one 📅 2026-06-25 🛫 2026-06-20",
       "- [ ] Step two ⏳ 2026-07-01",
       "- [ ] Step three"].join("\n")),
    "Tasks/Shift B.md": T('type: task\ngoal: "[[Shift goal]]"\nstatus: paused\npaused: 2026-07-01\nstart: 2026-06-05\nend: 2026-08-05\ncompleted:\ntags:\n  - task',
      "- [ ] Never moves 📅 2026-06-30"),
    "Goals/Hand paused.md": "---\ntype: goal\nstatus: paused\narea: Home\ntarget: 2026-11-01\ntags:\n  - goal\n---\n\n# Hand paused\n",
  };

  const resume = await page.evaluate(async ({ PANEL_SRC, files, SG }) => {
    const H = window.StormHarness;
    const snap = app => Object.fromEntries([...app.__store.entries()]);
    const out = {};

    const openBar = async (app, path) => {
      const c = await H.runBlock(PANEL_SRC, H.mkDv(app, path), app);
      c.querySelector(".resumebtn").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise(r => setTimeout(r, 20));
      return c;
    };
    const click = async (c, sel) => {
      c.querySelector(sel).dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise(r => setTimeout(r, 120));
    };

    /* 8 — resume as-is */
    {
      const app = H.mkVault(files, {});
      const before = snap(app);
      const c = await openBar(app, SG);
      out.asIs = { bar: c.querySelector(".resumebar").textContent,
                   buttons: [...c.querySelectorAll(".resumebar button")].map(b => b.textContent) };
      await click(c, '.resumebar button[data-resume-do="0"]');
      out.asIs.before = before; out.asIs.after = snap(app);
      out.asIs.writes = app.__log.filter(o => o.op === "modify").map(o => o.path);
      out.asIs.barAfter = c.querySelector(".resumebar").textContent;
    }
    /* 9 — resume + shift, twice (the second click must not shift again) */
    {
      window.__notices.length = 0;
      const app = H.mkVault(files, {});
      const before = snap(app);
      const c = await openBar(app, SG);
      out.shift = { buttons: [...c.querySelectorAll(".resumebar button")].map(b => b.textContent),
                    q: (c.querySelector(".resumebar .rb-q") || {}).textContent };
      await click(c, '.resumebar button[data-resume-do="90"]');
      const once = snap(app);
      const c2 = await H.runBlock(PANEL_SRC, H.mkDv(app, SG), app);
      const again = c2.querySelector(".resumebtn");
      if (again) { again.dispatchEvent(new MouseEvent("click", { bubbles: true })); await new Promise(r => setTimeout(r, 20));
        const b = c2.querySelector('.resumebar button[data-resume-do]');
        if (b) await click(c2, '.resumebar button[data-resume-do]'); }
      out.shift.before = before; out.shift.after = once; out.shift.twice = snap(app);
      out.shift.writes = app.__log.filter(o => o.op === "modify").map(o => o.path);
      out.shift.notices = window.__notices.slice();
      out.shift.stillResumeBtn = !!again;
    }
    /* 10 — a goal paused by hand: no `paused:` key */
    {
      const app = H.mkVault(files, {});
      const path = "Goals/Hand paused.md";
      const before = snap(app);
      const c = await openBar(app, path);
      out.hand = { q: (c.querySelector(".resumebar .rb-q") || {}).textContent,
                   doButtons: [...c.querySelectorAll(".resumebar button[data-resume-do]")].map(b => b.textContent),
                   cancel: c.querySelectorAll(".resumebar button[data-resume-cancel]").length };
      await click(c, '.resumebar button[data-resume-do]');
      out.hand.before = before[path]; out.hand.after = app.__store.get(path);
      out.hand.writes = app.__log.filter(o => o.op === "modify").map(o => o.path);
    }
    return out;
  }, { PANEL_SRC, files: shiftFiles, SG });

  console.log("── §6.8 ▶ Resume as-is ──");
  assert(/paused 90 days/.test(resume.asIs.bar), "the inline bar says how long it was paused — " + resume.asIs.bar);
  assert(resume.asIs.buttons.join(" | ") === "Shift remaining dates +90d | Resume as-is | Cancel",
    "three inline buttons, no dialog — " + resume.asIs.buttons.join(" | "));
  assert(JSON.stringify(resume.asIs.writes) === JSON.stringify([SG]), "only the goal note is written — " + resume.asIs.writes.join(", "));
  {
    const a = resume.asIs.after[SG], b = resume.asIs.before[SG];
    assert(/^status: active$/m.test(a), "status: active");
    assert(!/^paused:/m.test(a), "the `paused:` key is gone");
    /* the goal note differs by exactly two lines: the status value, and the dropped `paused:` */
    assert(a === b.replace("status: paused\n", "status: active\n").replace("paused: 2026-06-15\n", ""),
      "…and nothing else in the goal note moved");
    const others = Object.keys(resume.asIs.before).filter(k => k !== SG);
    const drift = others.filter(k => resume.asIs.after[k] !== resume.asIs.before[k]);
    assert(drift.length === 0, "no other note is touched, so no date anywhere changed — drifted: " + JSON.stringify(drift));
  }

  console.log("── §6.9 ▶ Resume with a +90d shift ──");
  const S = resume.shift;
  assert(/Resume “Shift goal”\? paused 90 days\./.test(S.q || ""), "the prompt names the goal and the gap — " + S.q);
  assert(JSON.stringify(S.writes.slice(0, 2)) === JSON.stringify([SG, "Tasks/Shift A.md"]),
    "one modify per file, and Shift B (paused on its own) is never written — " + S.writes.join(", "));
  assert(S.writes.length === 2, "exactly two files written, got " + S.writes.length + " — " + S.writes.join(", "));
  {
    const g = S.after[SG], a = S.after["Tasks/Shift A.md"], b = S.after["Tasks/Shift B.md"];
    assert(new RegExp("^target: " + addDays("2026-10-01", 90) + "$", "m").test(g), "goal target +90 → " + addDays("2026-10-01", 90));
    assert(!/^paused:/m.test(g) && /^status: active$/m.test(g), "goal is active again with no `paused:` key");
    assert(new RegExp("^start: " + addDays("2026-06-01", 90) + "$", "m").test(a) &&
           new RegExp("^end: " + addDays("2026-07-30", 90) + "$", "m").test(a), "task start/end +90");
    assert(a.includes("- [ ] Step one 📅 " + addDays("2026-06-25", 90) + " 🛫 " + addDays("2026-06-20", 90)),
      "an unchecked sub-task's 📅 and 🛫 both move +90");
    assert(a.includes("- [ ] Step two ⏳ " + addDays("2026-07-01", 90)), "an unchecked ⏳ moves +90");
    assert(a.includes("- [x] Done step 📅 2026-06-20 ✅ 2026-06-21"), "a checked sub-task's 📅 and ✅ are untouched");
    assert(a.includes("- [ ] Step three\n"), "a dateless sub-task is untouched");
    assert(b === S.before["Tasks/Shift B.md"], "the individually-paused task is byte-identical and still paused");
    assert(/^status: paused$/m.test(b), "…and still reads status: paused");
  }
  assert(S.notices.some(n => n === "Resumed “Shift goal” — shifted 6 dates across 2 notes by 90 days."),
    "the notice reads exactly as the contract specifies — " + JSON.stringify(S.notices));
  assert(JSON.stringify(S.twice) === JSON.stringify(S.after), "resuming twice does not shift twice");

  console.log("── §6.10 a goal paused by hand (no `paused:` key) ──");
  assert(/^Resume “Hand paused”\?$/.test((resume.hand.q || "").trim()), "the prompt offers no day count — " + resume.hand.q);
  assert(resume.hand.doButtons.length === 1 && resume.hand.doButtons[0] === "Resume",
    "a single Resume button, no shift offer — " + JSON.stringify(resume.hand.doButtons));
  assert(resume.hand.cancel === 1, "…next to Cancel");
  assert(JSON.stringify(resume.hand.writes) === JSON.stringify(["Goals/Hand paused.md"]), "one modify");
  assert(/^status: active$/m.test(resume.hand.after) && !/^paused:/m.test(resume.hand.after) &&
         /^target: 2026-11-01$/m.test(resume.hand.after), "it resumes to active with the target untouched");

  if (errors.length) assert(false, "page errors: " + errors.join(" | "));
  else assert(true, "no uncaught page errors");
}, { now: NOW }).catch(e => { console.log("FAIL: " + e.stack); process.exitCode = 1; });
