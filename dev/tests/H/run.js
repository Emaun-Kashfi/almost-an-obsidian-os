/* HEALTH contract — health by deadlines, not by elapsed calendar time.

   Every assertion reads the BADGE TEXT the harness renders, never healthOf() directly:
     · the task note's 📆 Timeline header  (_scripts/task-gantt.js → .tg-hb)
     · the goal note's panel header        (_scripts/goal-panel.js → .goal-hb)
     · the 🎯 Goals index card             (Goals/🎯 Goals.md → .gi-card .hb)
     · the 📋 Tasks board card             (Tasks/📋 Tasks.md → .tb-card .hb)
     · the Dashboard's Goals card          (Dashboard.md → .gc-row .hb)

   Parts:
     1  the four worked cases on the contract's own "Lecture Pipeline" fixture
     2  the remaining worked cases (last day, finished, the `dated` fork)
     3  the undated fallback is the OLD rule, unchanged, swept across 40 dates
     4  the badge and the Timeline header's "N overdue" never disagree — on every
        fixture in this suite AND every task note in the other suites' vaults      */
const { withPage, extractBlocks, readFile, assert } = require("../lib.js");
const F = require("./fixtures.js");

const B = require("../build.js");
const FIN = B.VAULT();
const SRC = {
  dash:  extractBlocks(readFile(FIN + "/Dashboard.md"))[0],
  index: extractBlocks(readFile(FIN + "/Goals/🎯 Goals.md"))[0],
  board: extractBlocks(readFile(FIN + "/Tasks/📋 Tasks.md"))[0],
  panel: F.PANEL,
  gantt: F.GANTT,
};

/* ── date maths + the OLD rule, reimplemented here, independent of the code ── */
const D = iso => { const [y, m, d] = String(iso).split("-").map(Number); return Date.UTC(y, m - 1, d); };
const two = n => String(n).padStart(2, "0");
const dayDiff = (a, b) => Math.round((D(b) - D(a)) / 86400000);
const addDays = (iso, n) => { const d = new Date(D(iso) + n * 86400000);
  return d.getUTCFullYear() + "-" + two(d.getUTCMonth() + 1) + "-" + two(d.getUTCDate()); };
/* the shipped rule as it stood BEFORE the HEALTH contract — used only to prove the
   undated fallback did not move */
function oldHealth(status, progress, sIso, eIso, todayIso) {
  if (String(status || "").toLowerCase() === "done") return "done";
  if (String(status || "").toLowerCase() === "paused") return "paused";
  if (!sIso || !eIso) return "unscheduled";
  const span = dayDiff(sIso, eIso);
  let elapsed = span > 0 ? dayDiff(sIso, todayIso) / span : (todayIso >= sIso ? 1 : 0);
  elapsed = Math.max(0, Math.min(1, elapsed));
  const gap = progress - elapsed;
  if (gap >= -0.10) return "ok";
  if (gap >= -0.30) return "risk";
  return "behind";
}
const HL = { ok: "On track", risk: "At risk", behind: "Behind", done: "Done",
             unscheduled: "Unscheduled", paused: "Paused" };
const fmOf = (text, key) => {
  const m = new RegExp("^" + key + ":[ \\t]*(.*)$", "m").exec(String(text).split("\n---")[0]);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
};

/* every task-bearing vault the other suites use — plus the two REAL shipped seeds —
   so part 4 sweeps every fixture the suites carry, not just the synthetic ones */
const fs = require("fs"), path = require("path");
const shipped = variant => {
  const root = B.VAULT(variant);
  const out = {
    "_scripts/goal-panel.js": readFile(root + "/_scripts/goal-panel.js"),
    "_scripts/task-gantt.js": readFile(root + "/_scripts/task-gantt.js"),
  };
  for (const dir of ["Tasks", "Goals"]) {
    for (const f of fs.readdirSync(path.join(root, dir))) {
      if (f.endsWith(".md")) out[dir + "/" + f] = readFile(path.join(root, dir, f));
    }
  }
  return out;
};
const VAULTS = {
  "tests/H":  F.files(),
  "tests/B1": require("../B1/fixtures.js").files,
  "tests/V":  require("../V/fixtures.js").files,
  "tests/A":  require("../A/mock.js").files(),
  ...Object.fromEntries(B.P.variants().map(v => ["seed/" + v, shipped(v)])),
};

/* the scrapers that run inside the page */
const READ = `({
  gantt: c => ({ err: !!c.querySelector(".tg-err"),
                 hb: ((c.querySelector(".tg-hb") || {}).textContent || "").trim(),
                 meta: (c.querySelector(".tg-meta") || {}).textContent || "",
                 /* kind="bar" without data-projected is exactly "this sub-task has a 📅" */
                 dated: !!c.querySelector('.tg-row[data-kind="bar"]:not([data-projected])') }),
  panel: c => ({ err: !!c.querySelector(".goal-err"),
                 hb: ((c.querySelector(".goal-hb") || {}).textContent || "").trim() }),
  index: c => [...c.querySelectorAll(".gi-card")].map(e => ({
                 name: (e.querySelector(".gi-name") || {}).textContent,
                 hb: (e.querySelector(".hb") || {}).textContent })),
  board: c => [...c.querySelectorAll(".tb-card")].map(e => ({
                 name: (e.querySelector(".tb-name") || {}).textContent,
                 hb: (e.querySelector(".hb") || {}).textContent })),
  dash:  c => [...c.querySelectorAll(".gc-row")].map(e => ({
                 name: (e.querySelector(".gc-name") || {}).textContent,
                 hb: (e.querySelector(".hb") || {}).textContent }))
})`;

withPage(async (page, errors) => {

  /* one page-side driver: set the clock, run one block per surface, scrape */
  const drive = (files, now, jobs, share) => page.evaluate(async ({ files, now, jobs, SRC, READ, share }) => {
    const H = window.StormHarness;
    H.setNow(now + "T10:00:00");
    const read = eval("(" + READ + ")");
    const out = {};
    let app = null;
    for (const j of jobs) {
      if (!share || !app) app = H.mkVault(JSON.parse(JSON.stringify(files)), { createDaily: () => {} });
      const c = await H.runBlock(SRC[j.src], H.mkDv(app, j.note), app);
      out[j.key] = read[j.src](c);
    }
    return out;
  }, { files, now, jobs, SRC, READ, share: !!share });

  /* ═══ 1. the contract's worked cases, on its own fixture ═══════════════════ */
  console.log("── 1. Lecture Pipeline: Sep 9 → Sep 20, sub-tasks due Sep 15 / 17 / 20, none done ──");
  const CASES = [
    { now: "2026-09-14", hb: "On track", over: 0, why: "nothing is due yet — the old rule read Behind on 5/11 days elapsed vs 0 % done" },
    { now: "2026-09-16", hb: "At risk",  over: 1, why: "Sep 15 is overdue" },
    { now: "2026-09-18", hb: "Behind",   over: 2, why: "Sep 15 and Sep 17 are overdue" },
    { now: "2026-09-21", hb: "Behind",   over: 3, why: "the end date Sep 20 has passed and work remains" },
  ];
  const files = F.files();
  for (const c of CASES) {
    const r = await drive(files, c.now, [
      { key: "gantt", src: "gantt", note: F.LECTURE },
      { key: "panel", src: "panel", note: F.LECTURE_GOAL },
      { key: "index", src: "index", note: "Goals/🎯 Goals.md" },
      { key: "board", src: "board", note: "Tasks/📋 Tasks.md" },
      { key: "dash",  src: "dash",  note: "Dashboard.md" },
    ]);
    const tag = "on " + c.now;
    assert(!r.gantt.err, "Timeline renders without .tg-err " + tag);
    assert(r.gantt.hb === c.hb, `📆 Timeline badge ${tag} = ${c.hb} — ${c.why} (got "${r.gantt.hb}")`);
    const overTxt = c.over ? " · " + c.over + " overdue" : "";
    assert(r.gantt.meta.indexOf("0/3 done" + overTxt + " · window") === 0,
      `…and the header next to it says "0/3 done${overTxt}" ${tag} (got "${r.gantt.meta.split(" · next")[0]}")`);
    const bc = r.board.find(x => x.name === "Lecture Pipeline");
    assert(bc && bc.hb === c.hb, `📋 Tasks board card ${tag} = ${c.hb} (got "${bc && bc.hb}")`);
    /* the goal holds only this task, so it must roll up to the same badge */
    assert(r.panel.hb === c.hb, `🎯 goal panel ${tag} = ${c.hb} (got "${r.panel.hb}")`);
    const ic = r.index.find(x => x.name === "Lecture series");
    assert(ic && ic.hb === c.hb, `🎯 Goals index card ${tag} = ${c.hb} (got "${ic && ic.hb}")`);
    const dc = r.dash.find(x => x.name === "Lecture series");
    assert(dc && dc.hb === c.hb, `Dashboard Goals card ${tag} = ${c.hb} (got "${dc && dc.hb}")`);
  }

  /* ═══ 2. the remaining worked cases ═══════════════════════════════════════ */
  console.log("\n── 2. the remaining worked cases ──");
  {
    const r = await drive(files, "2026-09-19", [
      { key: "last", src: "gantt", note: F.LASTDAY },
      { key: "board", src: "board", note: "Tasks/📋 Tasks.md" },
    ]);
    assert(r.last.hb === "On track",
      'a task whose sub-tasks are all due on its last day, checked the day before → On track (got "' + r.last.hb + '")');
    const bc = r.board.find(x => x.name === "All due on the last day");
    assert(bc && bc.hb === "On track", "…and the 📋 board card agrees (got " + (bc && bc.hb) + ")");
  }
  {
    /* every date on this note is months in the past and one sub-task is unchecked:
       the `done` short-circuit must win before any deadline is read */
    const r = await drive(files, "2026-09-14", [
      { key: "fin", src: "gantt", note: F.FINISHED },
      { key: "board", src: "board", note: "Tasks/📋 Tasks.md" },
    ]);
    assert(r.fin.hb === "Done",
      'a finished task whose dates have all passed → Done, never Behind (got "' + r.fin.hb + '")');
    const bc = r.board.find(x => x.name === "Finished long ago");
    assert(bc && bc.hb === "Done", "…and the 📋 board card agrees (got " + (bc && bc.hb) + ")");
  }

  /* ═══ 3. the undated fallback is the OLD rule, unchanged ══════════════════ */
  console.log("\n── 3. no sub-task carries a 📅 → the old elapsed-vs-progress rule, unchanged ──");
  {
    /* the contract's "30 sub-task goal with every sub-task undated": 6/30 done,
       window 2026-01-01 → 2026-12-31, goal target 2026-12-31 */
    const SWEEP = [];
    for (let i = 0; i < 40; i++) SWEEP.push(addDays("2026-01-05", i * 9));
    const want = now => HL[oldHealth("active", 6 / 30, "2026-01-01", "2026-12-31", now)];
    let bad = 0;
    for (const now of SWEEP) {
      const r = await drive(files, now, [
        { key: "g", src: "gantt", note: F.UNDATED },
        { key: "p", src: "panel", note: F.UNDATED_GOAL },
      ], true);
      if (r.g.dated) { bad++; console.log("FAIL: " + now + ": the 30-step task is not supposed to be dated"); }
      if (r.g.hb !== want(now) || r.p.hb !== want(now)) {
        bad++;
        console.log(`FAIL: ${now}: undated task/goal read ${r.g.hb}/${r.p.hb}, the old rule says ${want(now)}`);
      }
    }
    assert(bad === 0, `the all-undated 30-step task AND its goal match the old rule on all ${SWEEP.length} sampled dates`);
    const labels = new Set(SWEEP.map(want));
    assert(labels.has("On track") && labels.has("At risk") && labels.has("Behind"),
      "…and the sweep crosses both thresholds, so the fallback is genuinely under test — " + [...labels].join(" → "));

    /* the fork is decided on "is anything dated", not on "is anything overdue": one
       future 📅 on one of the 30 steps switches the whole task to the deadline rule */
    const dated = JSON.parse(JSON.stringify(files));
    dated[F.UNDATED] = dated[F.UNDATED].replace("- [ ] Step 7\n", "- [ ] Step 7 📅 2026-12-30\n");
    const r = await drive(dated, "2026-11-01", [{ key: "g", src: "gantt", note: F.UNDATED }]);
    assert(r.g.dated, "…the edited fixture really does carry a dated sub-task now");
    assert(want("2026-11-01") === "Behind" && r.g.hb === "On track",
      "one future 📅 among the 30 steps moves it off the fallback: old rule " + want("2026-11-01") +
      " → deadline rule On track (0 overdue, end 2026-12-31) — got " + r.g.hb);
  }

  /* ═══ 4. the badge and the header's "N overdue" never disagree ════════════ */
  console.log("\n── 4. badge ↔ header agreement across every fixture vault in the suites ──");
  {
    const NOWS = ["2026-09-12", "2026-09-13", "2026-09-14", "2026-09-18", "2026-11-01"];
    let rows = 0; const bad = [];
    for (const [vault, vfiles] of Object.entries(VAULTS)) {
      const notes = Object.keys(vfiles).filter(p => /^Tasks\//.test(p) && !/📋 Tasks\.md$/.test(p));
      const ends = {}; notes.forEach(n => { ends[n] = fmOf(vfiles[n], "end"); });
      for (const now of NOWS) {
        const jobs = notes.map((n, i) => ({ key: "t" + i, src: "gantt", note: n }));
        const out = await drive(vfiles, now, jobs, true);
        notes.forEach((n, i) => {
          const g = out["t" + i];
          const where = `${vault} ${n} @${now}`;
          if (g.err) { bad.push(where + ": .tg-err"); return; }
          rows++;
          if (["Done", "Paused", "Unscheduled"].includes(g.hb)) return;   // short-circuits
          if (!g.dated) return;                       // on the pacing fallback: no number is printed
          const m = /· (\d+) overdue/.exec(g.meta);
          const over = m ? +m[1] : 0;
          const endPassed = !!ends[n] && ends[n] < now;
          /* the contract's invariant, read off the two things sitting side by side */
          if (over === 0 && g.hb === "Behind" && !endPassed) bad.push(where + ": 0 overdue and the end date has NOT passed, but Behind — " + g.meta);
          if (over === 0 && g.hb === "At risk") bad.push(where + ": 0 overdue but At risk — " + g.meta);
          if (over === 1 && g.hb === "On track") bad.push(where + ": 1 overdue but On track — " + g.meta);
          if (over === 1 && g.hb === "Behind" && !endPassed) bad.push(where + ": 1 overdue and the end date has NOT passed, but Behind — " + g.meta);
          if (over >= 2 && g.hb !== "Behind") bad.push(where + ": " + over + " overdue but " + g.hb + " — " + g.meta);
        });
      }
    }
    assert(rows > 100, "swept " + rows + " rendered Timelines across " + Object.keys(VAULTS).length + " fixture vaults");
    assert(bad.length === 0, "badge and header agree on every one of them" +
      (bad.length ? " — " + bad.slice(0, 8).join(" | ") : ""));
  }

  if (errors.length) assert(false, "page errors: " + errors.join(" | "));
  else assert(true, "no uncaught page errors");
}, { now: "2026-09-14T10:00:00" });
