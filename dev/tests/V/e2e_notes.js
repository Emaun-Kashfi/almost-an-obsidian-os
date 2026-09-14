/* Agent V — the four standalone note blocks against the REAL built vault.
   2c goal panels · 2d daily tables (after the 2b interactions) · 2e index/board/triage.
   today = 2026-09-12 */
const { withPage, readFile, assert } = require("../lib.js");
const V = require("./vault.js");
const B = require("../build.js");

const DASH = B.VAULT() + "/Dashboard.md";
const blocks = md => { const o = []; const re = /```dataviewjs\n([\s\S]*?)\n```/g; let m; while ((m = re.exec(md))) o.push(m[1]); return o; };
const dashSrc = blocks(readFile(DASH))[0];
const files = V.build();

withPage(async (page, errors) => {
  const r = await page.evaluate(async ({ dashSrc, files, TODAY_PATH }) => {
    const H = window.StormHarness;
    const B2 = md => { const o = []; const re = /```dataviewjs\n([\s\S]*?)\n```/g; let m; while ((m = re.exec(md))) o.push(m[1]); return o; };
    const mk = () => H.mkVault(JSON.parse(JSON.stringify(files)), { createDaily: () => {} });
    const run = async (app, notePath, src) => {
      const dv = H.mkDv(app, notePath);
      return await H.runBlock(src, dv, app);
    };
    const out = {};

    /* ============ 2c — goal panels on the untouched seed ============ */
    {
      const app = mk();
      const site = "Goals/💻 Ship the portfolio site.md", ts = "Goals/🧠 Learn TypeScript.md";
      const c1 = await run(app, site, B2(app.__store.get(site))[0]);
      const c2 = await run(app, ts, B2(app.__store.get(ts))[0]);
      const panel = c => ({
        err: (c.querySelector(".goal-err") || {}).textContent || "",
        head: (c.querySelector(".goalhead") || {}).textContent.replace(/\s+/g, " ").trim(),
        hb: (c.querySelector(".goal-hb") || {}).className,
        prog: (c.querySelector(".goal-prog") || {}).textContent,
        rows: [...c.querySelectorAll("g.g-row")].map(g => ({
          link: g.getAttribute("data-link"),
          status: g.getAttribute("data-status"),
          health: g.getAttribute("data-health"),
          label: (g.querySelector(".g-label") || {}).textContent,
          barCls: (g.querySelector(".g-bar") || {}).getAttribute("class"),
          barX: +(g.querySelector(".g-bar") || {}).getAttribute("x"),
          barW: +(g.querySelector(".g-bar") || {}).getAttribute("width"),
          fillW: +(g.querySelector(".g-fill") || {}).getAttribute("width"),
        })),
        today: c.querySelectorAll("line.g-today").length,
        tasks: [...c.querySelectorAll(".g-task")].map(t => ({
          name: (t.querySelector(".g-tname") || {}).textContent,
          next: (t.querySelector(".g-tnext") || {}).textContent,
          date: (t.querySelector(".g-tdate") || {}).textContent,
          prog: (t.querySelector(".g-tprog") || {}).textContent,
        })),
        backlog: [...c.querySelectorAll(".g-chip")].map(x => x.textContent),
        clickable: c.querySelectorAll("[data-link]").length,
      });
      out.site = panel(c1); out.ts = panel(c2);
      // a click on a bar must open the task note
      const g0 = c1.querySelector("g.g-row"); if (g0) g0.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      out.siteOpened = app.__log.filter(x => x.op === "open").map(x => x.link);
    }

    /* ============ replay the 2b interactions, then 2d + 2e ============ */
    {
      const app = mk();
      const c = await run(app, "Dashboard.md", dashSrc);
      const sleep = ms => new Promise(res => setTimeout(res, ms));
      const book = [...c.querySelectorAll(".nm-row")].find(x => (x.querySelector(".nm-text") || {}).textContent === "Book 10");
      book.querySelector(".nm-box").click(); await sleep(60);
      const gallery = [...c.querySelectorAll('.nm-row[data-kind="next"]')].find(x => (x.getAttribute("data-path") || "").indexOf("Build the project gallery") >= 0);
      gallery.querySelector('[data-resched="tomorrow"]').click(); await sleep(80);
      const inp = c.querySelector("input[data-uadd]");
      const enter = async v => { inp.value = v; inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await sleep(120); };
      await enter("sub: Confirm the hosting plan 9/20 -> Launch on a custom");
      await enter("Buy batteries tomorrow #home");
      await enter("goal: Test goal @Area 2026-12-01");
      // the panel embedded in a goal note created FROM THE DASHBOARD must really run
      const tgSrc = B2(app.__store.get("Goals/Test goal.md"))[0] || "";
      const tg = await run(app, "Goals/Test goal.md", tgSrc);
      out.newGoalPanel = {
        blocks: B2(app.__store.get("Goals/Test goal.md")).length,
        err: (tg.querySelector(".goal-err") || {}).textContent || "",
        head: ((tg.querySelector(".goalhead") || {}).textContent || "").replace(/\s+/g, " ").trim(),
        all: (tg.textContent || "").replace(/\s+/g, " ").slice(0, 200),
        empty: (tg.querySelector(".g-empty") || {}).textContent || "",
      };

      // --- 2d: the daily tables of TODAY's note, straight out of the generated note
      const todayBlocks = B2(app.__store.get(TODAY_PATH));
      const tableOf = el => {
        const t = el.querySelector("table");
        return {
          para: [...el.querySelectorAll("p")].map(p => p.textContent.trim()),
          sum: (el.querySelector(".dt-sum") || {}).textContent || "",
          wrap: el.classList.contains("dt-wrap"),
          headers: t ? [...t.querySelectorAll("th")].map(x => x.textContent) : [],
          rows: t ? [...t.querySelectorAll("tbody tr")].map(tr => ({
            cls: tr.className,
            cells: [...tr.querySelectorAll("td")].map(td => td.textContent.trim()),
            links: [...tr.querySelectorAll("a")].map(a => a.getAttribute("data-href")),
          })) : [],
        };
      };
      out.plannedToday = tableOf(await run(app, TODAY_PATH, todayBlocks[0]));
      out.doneToday = tableOf(await run(app, TODAY_PATH, todayBlocks[1]));

      // the same Planned block, but for 2026-09-20 (a Sunday)
      const D20 = "Daily/2026-09-20 Sunday.md";
      app.__store.set(D20, "---\ndate: 2026-09-20\ntags:\n  - daily\n---\n\n# Sunday, September 20\n");
      out.planned20 = tableOf(await run(app, D20, todayBlocks[0]));

      // --- 2e: goals index / tasks board / triage
      const gi = await run(app, "Goals/🎯 Goals.md", B2(app.__store.get("Goals/🎯 Goals.md"))[0]);
      out.index = {
        err: (gi.querySelector(".goal-err") || {}).textContent || "",
        cards: [...gi.querySelectorAll(".gi-card")].map(x => ({
          name: (x.querySelector(".gi-name") || {}).textContent,
          health: x.getAttribute("data-health"),
          pct: (x.querySelector(".gi-pct") || {}).textContent,
          foot: (x.querySelector(".gi-foot") || {}).textContent,
        })),
      };
      const tb = await run(app, "Tasks/📋 Tasks.md", B2(app.__store.get("Tasks/📋 Tasks.md"))[0]);
      out.board = {
        err: (tb.querySelector(".goal-err") || {}).textContent || "",
        cols: [...tb.querySelectorAll(".tb-col")].map(col => ({
          key: col.getAttribute("data-col"),
          n: (col.querySelector(".tb-n") || {}).textContent,
          cards: [...col.querySelectorAll(".tb-card")].map(x => (x.querySelector(".tb-name") || {}).textContent),
        })),
      };
      const tr = await run(app, "🧹 Triage.md", B2(app.__store.get("🧹 Triage.md"))[0]);
      out.triage = {
        err: (tr.querySelector(".triage-error") || {}).textContent || "",
        count: (tr.querySelector(".tr-count") || {}).textContent || "",
        rows: [...tr.querySelectorAll(".tr-row")].map(x => ({
          text: (x.querySelector(".tr-text") || {}).textContent,
          src: (x.querySelector(".tr-src a") || {}).textContent,
        })),
        opts: [...tr.querySelectorAll(".tr-sel option")].map(o => o.textContent),
      };
    }
    return out;
  }, { dashSrc, files, TODAY_PATH: V.TODAY_PATH });

  if (process.env.DUMP) { console.log(JSON.stringify(r, null, 1)); return; }

  /* ---------- 2c ---------- */
  console.log("── 2c: goal panels ──");
  assert(!r.site.err, "portfolio panel renders without an error div" + (r.site.err ? " (" + r.site.err + ")" : ""));
  assert(r.site.rows.length === 2, "portfolio panel draws 2 bars (both its tasks are dated), got " + r.site.rows.length);
  assert(JSON.stringify(r.site.rows.map(x => x.label)) === JSON.stringify(
    ["Build the project gallery", "Launch on a custom domain"]),
    "…sorted by start — " + r.site.rows.map(x => x.label).join(" · "));
  /* HEALTH contract — the gallery task has exactly ONE overdue sub-task
     (📅 2026-09-10) on 2026-09-12, and one overdue is "at risk", not "behind". */
  assert(r.site.rows[0].health === "risk" && /st-active/.test(r.site.rows[0].barCls),
    "the active task with one overdue sub-task is st-active and reads risk — " + r.site.rows[0].barCls + " / " + r.site.rows[0].health);
  assert(r.site.rows[1].fillW === 0, "the untouched backlog task's bar has a zero-width fill");
  assert(r.site.today === 1, "the today marker line is drawn");
  assert(r.site.backlog.length === 0, "no backlog chips (every portfolio task is dated)");
  assert(/At risk/.test(r.site.head) && /22%/.test(r.site.prog), "goal head reads At risk · 22% (2 of 9 sub-tasks) — " + r.site.head);
  assert(r.site.tasks.length === 2 && r.site.tasks[0].next === "Build the project gallery",
    "the task list repeats the chart order and shows each next move — " + JSON.stringify(r.site.tasks[0]));
  assert(r.site.tasks[0].prog === "2/5" && r.site.tasks[1].prog === "0/4", "task list shows done/total per task");
  assert(r.siteOpened.length === 1 && /Build the project gallery/.test(r.siteOpened[0]), "clicking a bar opens that task note — " + r.siteOpened.join());

  assert(!r.ts.err, "TypeScript panel renders without an error div");
  assert(r.ts.rows.length === 2, "TypeScript panel draws 2 bars, got " + r.ts.rows.length);
  assert(/0%/.test(r.ts.prog) && /At risk/.test(r.ts.head), "TypeScript goal head reads At risk · 0% (its one dated sub-task is overdue) — " + r.ts.head);

  console.log("── 2c: the panel inside a goal note created from the add box ──");
  assert(r.newGoalPanel.blocks === 1, "the generated goal note carries exactly one dataviewjs block, got " + r.newGoalPanel.blocks);
  assert(!r.newGoalPanel.err, "…and it runs without an error div" + (r.newGoalPanel.err ? " (" + r.newGoalPanel.err + ")" : ""));
  assert(/Unscheduled/.test(r.newGoalPanel.head) && /0 tasks/.test(r.newGoalPanel.head),
    "…showing an empty, unscheduled goal — " + r.newGoalPanel.head);
  assert(/No tasks point at this goal yet/.test(r.newGoalPanel.empty), "…with the 'add a task' empty state");

  /* ---------- 2d ---------- */
  console.log("── 2d: daily tables of the generated note, after the interactions ──");
  assert(r.doneToday.wrap, "Done today adds .dt-wrap to its container");
  assert(r.doneToday.rows.length === 1 && r.doneToday.rows[0].cells[0] === "☑ Book 10",
    "Done today lists the sub-task checked off from the Dashboard — " + JSON.stringify(r.doneToday.rows.map(x => x.cells[0])));
  assert(r.doneToday.rows[0].links.length === 2 &&
    /Books 10/.test(r.doneToday.rows[0].links[0]) && /Read 24 books/.test(r.doneToday.rows[0].links[1]),
    "…with links to its Task and its Goal — " + JSON.stringify(r.doneToday.rows[0].links));
  assert(/1 sub-task across 1 task/.test(r.doneToday.sum), "…and the summary line — " + r.doneToday.sum);
  assert(!r.doneToday.rows.some(x => x.cls === "flag"), "no 🏁 row (no task note completed today)");

  assert(r.plannedToday.rows.length === 1 && r.plannedToday.rows[0].cells[0] === "☐ Add a contact form",
    "Planned today for 09-12 holds only the contact-form sub-task — the gallery one moved to 09-13 — " +
    JSON.stringify(r.plannedToday.rows.map(x => x.cells[0])));
  assert(!JSON.stringify(r.plannedToday).includes("☐ Build the project gallery"),
    "…the rescheduled sub-task does NOT appear on the 12th");
  assert(r.planned20.rows.length === 1 && r.planned20.rows[0].cells[0] === "☐ Confirm the hosting plan",
    "Planned for 2026-09-20 lists the hosting item added through the add box — " + JSON.stringify(r.planned20.rows.map(x => x.cells)));
  assert(r.planned20.rows[0].cells[1] === "Launch on a custom domain" && r.planned20.rows[0].cells[3] === "backlog",
    "…with its task and status columns — " + JSON.stringify(r.planned20.rows[0].cells));
  assert(JSON.stringify(r.planned20.headers) === JSON.stringify(["Sub-task", "Task", "Goal", "Status"]),
    "Planned headers are Sub-task/Task/Goal/Status");

  /* ---------- 2e ---------- */
  console.log("── 2e: 🎯 Goals index · 📋 Tasks board · 🧹 Triage ──");
  assert(!r.index.err, "goals index renders without an error div" + (r.index.err ? " (" + r.index.err + ")" : ""));
  assert(r.index.cards.length === 5, "index shows 5 goal cards (the 4 seeded + Test goal), got " + r.index.cards.length);
  assert(r.index.cards.some(c => c.name === "🏠 Home organization" && c.health === "paused"),
    "…the paused goal is listed as paused — " + JSON.stringify(r.index.cards.map(c => c.name + "=" + c.health)));
  assert(r.index.cards.some(c => c.name === "Test goal" && c.health === "unscheduled"),
    "…and the goal created from the add box is listed (Unscheduled, no tasks yet)");
  const ORD = { behind: 0, risk: 1, ok: 2, unscheduled: 3, done: 4, paused: 5 };
  const hh = r.index.cards.map(c => ORD[c.health]);
  assert(hh.every((v, i) => i === 0 || hh[i - 1] <= v), "…sorted worst-health first, paused last — " +
    r.index.cards.map(c => c.health).join(" → "));

  assert(!r.board.err, "task board renders without an error div");
  /* PAUSE §3 — the board gained a Paused column between Waiting and Done. */
  assert(JSON.stringify(r.board.cols.map(c => c.key + ":" + c.n)) === JSON.stringify(["backlog:2", "active:3", "waiting:1", "paused:0", "done:0"]),
    "board columns read Backlog 2 / Active 3 / Waiting 1 / Paused 0 / Done 0 — " + r.board.cols.map(c => c.key + " " + c.n).join(" | "));
  assert(!r.board.cols.some(c => c.cards.some(n => /📋 Tasks/.test(n))), "the board note itself never appears as a card");

  assert(!r.triage.err, "triage renders without an error div" + (r.triage.err ? " (" + r.triage.err + ")" : ""));
  const tt = r.triage.rows.map(x => x.text);
  assert(tt.includes("Chase the missing invoice"), "triage lists the ⚡ item from the 09-06 note — " + JSON.stringify(tt));
  assert(tt.includes("Ancient forgotten errand"), "triage lists the ⚡ item from the 09-03 note (42-day window)");
  assert(!tt.some(t => /Move \/ exercise|💧 Water|#habit/.test(t)), "triage never lists a habit line — " + JSON.stringify(tt));
  assert(!tt.some(t => t === ""), "triage never lists a blank checkbox");
  assert(tt.includes("Buy batteries"), "triage sees the inbox item the add box wrote into today's note");
  assert(!r.triage.opts.some(o => /📋 Tasks/.test(o)), "the triage destination picker offers only real task notes — " + JSON.stringify(r.triage.opts));
  const uopts = [...new Set(r.triage.opts)];
  assert(uopts.length === 5, "…all 5 active/backlog task notes, got " + uopts.length + " — " + JSON.stringify(uopts));

  if (errors.length) assert(false, "page errors: " + errors.join(" | "));
  else assert(true, "no uncaught page errors");
}).catch(e => { console.log("FAIL: " + e.stack); process.exitCode = 1; });
