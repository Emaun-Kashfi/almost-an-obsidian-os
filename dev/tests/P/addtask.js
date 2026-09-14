/* Agent P — the "＋ Task" control on goals (ADDTASK contract, items 1–10).
   Today is fixed at 2026-09-14 by the harness.

   The one assertion that matters most is item 3: a task created from a goal must be
   byte-identical to one the Dashboard's `task:` quick-add writes for the same name,
   goal and dates. It is asserted directly — both paths run in the same page, against
   the same vault, and their two notes are compared character for character — so the
   three ways of making a task note (Templater template, Dashboard route, this button)
   cannot drift apart without this suite going red.                                   */
const { withPage, extractBlocks, readFile, assert } = require("../lib.js");

const B = require("../build.js");
const VAULT = B.VAULT(), COMMON = B.COMMON;
const NOW = "2026-09-14T10:00:00";
const TODAY = "2026-09-14";

const DASH = extractBlocks(readFile(`${VAULT}/Dashboard.md`))[0];
const PANEL_SRC = readFile(`${COMMON}/_scripts/goal-panel.js`);
const GOALS_SRC = extractBlocks(readFile(`${COMMON}/Goals/🎯 Goals.md`))[0];
const GANTT_SRC = readFile(`${COMMON}/_scripts/task-gantt.js`);
/* THEME2 §C — the block a note now carries under `## 📆 Timeline`. */
const TIMELINE = '```dataviewjs\nconst p = "_scripts/task-gantt", f = x => app.metadataCache.getFirstLinkpathDest(x, "");\nif (f(p + ".js") || f(p + "/view.js")) await dv.view(p);\nelse dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.", { cls: "panel-err storm-missing-view" });\n```';

/* ── the two copies of the note writer must stay one thing ─────────────────── */
const sliceAdd = s => {
  const a = s.indexOf("const NOUN =");
  const b = s.indexOf("\n}", s.indexOf("function taskNoteText("));
  return a < 0 || b < 0 ? null : s.slice(a, b + 2);
};
const addPanel = sliceAdd(PANEL_SRC), addIndex = sliceAdd(GOALS_SRC);
assert(addPanel && addIndex, "both goal surfaces carry the ADDTASK note writer");
assert(addPanel === addIndex,
  "the note writer is byte-identical in _scripts/goal-panel.js and 🎯 Goals.md");

/* ── the shared vault ──────────────────────────────────────────────────────── */
const GOAL = "Goals/🚀 Launch the app.md";          /* active,  target 2026-10-31 */
const OPEN = "Goals/🧠 Learn TypeScript.md";            /* active,  no target          */
const HELD = "Goals/📖 Read 24 books.md";               /* paused,  target 2026-12-31  */

function baseVault() {
  return {
    "Dashboard.md": "---\ncssclasses:\n  - storm-home\ntags:\n  - dashboard\n---\n\n```dataviewjs\n```\n",
    "Goals/🎯 Goals.md": "---\ncssclasses:\n  - dashboard\ntags:\n  - dashboard\n---\n\n# 🎯 Goals\n",
    "Tasks/📋 Tasks.md": "---\ncssclasses:\n  - dashboard\ntags:\n  - dashboard\n---\n\n# 📋 Tasks\n",
    [GOAL]: "---\ntype: goal\nstatus: active\narea: Product\ntarget: 2026-10-31\ntags:\n  - goal\n---\n\n# 🚀 Launch the app\n",
    [OPEN]: "---\ntype: goal\nstatus: active\narea: Learning\ntarget:\ntags:\n  - goal\n---\n\n# 🧠 Learn TypeScript\n",
    [HELD]: "---\ntype: goal\nstatus: paused\npaused: 2026-08-15\narea: Reading\ntarget: 2026-12-31\ntags:\n  - goal\n---\n\n# 📖 Read 24 books\n",
    "_scripts/goal-panel.js": PANEL_SRC,
    "_scripts/task-gantt.js": GANTT_SRC,
  };
}

withPage(async (page, errors) => {
  const r = await page.evaluate(async ({ DASH, PANEL_SRC, GOALS_SRC, files, GOAL, OPEN, HELD }) => {
    const H = window.StormHarness;
    const out = {};
    const wait = ms => new Promise(res => setTimeout(res, ms));
    const fresh = () => H.mkVault(JSON.parse(JSON.stringify(files)), {});
    const click = el => el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    const key = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
    const panel = (app, path) => H.runBlock(PANEL_SRC, H.mkDv(app, path), app);
    const index = app => H.runBlock(GOALS_SRC, H.mkDv(app, "Goals/🎯 Goals.md"), app);
    const cardOf = (c, name) => [...c.querySelectorAll(".gi-card")]
      .find(x => (x.querySelector(".gi-name") || {}).textContent === name);
    /* open the row on whatever surface, hand back its fields */
    async function openRow(scope) {
      click(scope.querySelector(".addtaskbtn"));
      await wait(20);
      const bar = scope.querySelector(".addtaskbar");
      return { bar, name: bar.querySelector('[data-at="name"]'),
               start: bar.querySelector('[data-at="start"]'), end: bar.querySelector('[data-at="end"]') };
    }
    async function addVia(row, what, value) {
      row.name.value = value;
      click(row.bar.querySelector(`[data-at="${what}"]`));
      await wait(150);
    }

    /* ── 1. the control renders, paused or not, on both surfaces ───────────── */
    {
      const app = fresh();
      const live = await panel(app, GOAL), held = await panel(app, HELD);
      const idx = await index(app);
      out.render = {
        liveBtn: (live.querySelector(".addtaskbtn") || {}).textContent || "",
        heldBtn: (held.querySelector(".addtaskbtn") || {}).textContent || "",
        liveClosed: (live.querySelector(".addtaskbar") || {}).innerHTML,
        heldKeepsPause: !!held.querySelector(".resumebtn"),
        cards: [...idx.querySelectorAll(".gi-card")].length,
        cardBtns: [...idx.querySelectorAll(".gi-card .addtaskbtn")].length,
        cardBtnText: [...new Set([...idx.querySelectorAll(".gi-card .addtaskbtn")].map(b => b.textContent))],
        heldCardBtn: !!cardOf(idx, "📖 Read 24 books").querySelector(".addtaskbtn"),
      };
    }

    /* ── 2. the row's defaults: start = today, end = the goal's target ──────── */
    {
      const app = fresh();
      const withT = await openRow(await panel(app, GOAL));
      const noT = await openRow(await panel(app, OPEN));
      const idx = await index(app);
      const card = await openRow(cardOf(idx, "🚀 Launch the app"));
      out.defaults = {
        start: withT.start.value, end: withT.end.value,
        startType: withT.start.type, endType: withT.end.type,
        noTargetEnd: noT.end.value, cardEnd: card.end.value,
        focused: document.activeElement === card.name,
        order: [...card.bar.children].map(el => el.getAttribute("data-at")),
        labels: [...card.bar.querySelectorAll("button")].map(b => b.textContent),
      };
    }

    /* ── 3. Add writes exactly what the Dashboard's `task:` route writes ────── */
    {
      const NAME = "Record episode two", P = "Tasks/" + NAME + ".md";
      const a = fresh();
      const c = await H.runBlock(DASH, H.mkDv(a, "Dashboard.md"), a);
      const inp = c.querySelector("input[data-uadd]");
      inp.value = "task: " + NAME + " @Launch the app 2026-09-14-2026-10-31";
      key(inp, "Enter"); await wait(250);
      out.dashNote = a.__store.get(P) || null;

      const b = fresh();
      const row = await openRow(await panel(b, GOAL));
      await addVia(row, "add", NAME);
      out.panelNote = b.__store.get(P) || null;
      out.panelStaysOpen = !!row.bar.firstChild;
      out.panelNameCleared = row.name.value === "";
      out.panelRefocused = document.activeElement === row.name;
      out.panelDidNotOpen = b.__log.filter(x => x.op === "open").length === 0;
      out.panelNotices = window.__notices.slice();
      out.panelCreates = b.__log.filter(x => x.op === "create").length;

      const d = fresh();
      const idx = await index(d);
      const crow = await openRow(cardOf(idx, "🚀 Launch the app"));
      await addVia(crow, "add", NAME);
      out.cardNote = d.__store.get(P) || null;

      /* Add & open creates it and hands the note over */
      const e = fresh();
      const orow = await openRow(await panel(e, GOAL));
      await addVia(orow, "open", NAME);
      out.openNote = e.__store.get(P) || null;
      out.openOpened = e.__log.filter(x => x.op === "open").map(x => x.link);
      out.openClosedRow = !orow.bar.firstChild;
    }

    /* ── 5. a colliding name never overwrites ───────────────────────────────── */
    {
      const app = fresh();
      const P = "Tasks/Record episode two.md";
      app.__store.set(P, "---\ntype: task\n---\n\n# MINE — do not touch\n");
      const row = await openRow(await panel(app, GOAL));
      await addVia(row, "add", "Record episode two");
      out.collide = { kept: app.__store.get(P),
                      made: app.__store.get("Tasks/Record episode two 2.md") || null,
                      notes: [...app.__store.keys()].filter(k => /^Tasks\/Record/.test(k)).sort() };
    }

    /* ── 6. a name full of illegal characters ───────────────────────────────── */
    {
      const app = fresh();
      const row = await openRow(await panel(app, GOAL));
      await addVia(row, "add", "Q3: relaunch / EU #push");
      out.safe = { paths: [...app.__store.keys()].filter(k => /^Tasks\//.test(k) && !/📋/.test(k)) };
      out.safe.text = app.__store.get(out.safe.paths[0]) || "";
      out.safe.heading = (out.safe.text.match(/^# (.*)$/m) || [])[1];
    }

    /* ── 7. empty name → no write · two fast clicks → one note ──────────────── */
    {
      const app = fresh();
      const row = await openRow(await panel(app, GOAL));
      row.name.value = "   ";
      click(row.bar.querySelector('[data-at="add"]')); await wait(120);
      click(row.bar.querySelector('[data-at="open"]')); await wait(120);
      key(row.name, "Enter"); await wait(120);
      out.emptyCreates = app.__log.filter(x => x.op === "create").length;

      const b = fresh();
      const row2 = await openRow(await panel(b, GOAL));
      row2.name.value = "Double click";
      const btn = row2.bar.querySelector('[data-at="add"]');
      click(btn); click(btn);                     /* same tick, before any await */
      await wait(250);
      out.doubleCreates = b.__log.filter(x => x.op === "create").length;
      out.doublePaths = [...b.__store.keys()].filter(k => /Double click/.test(k));
    }

    /* ── 8/9. the goal's own panel picks the new task up on re-render ───────── */
    {
      const live = fresh();
      const row = await openRow(await panel(live, GOAL));
      await addVia(row, "add", "Record episode two");
      const again = await panel(live, GOAL);
      out.reRender = {
        rows: [...again.querySelectorAll("g.g-row")].map(g => g.getAttribute("data-link")),
        list: [...again.querySelectorAll(".g-task .g-tname")].map(x => x.textContent),
        head: (again.querySelector(".goal-meta") || {}).textContent,
      };

      const held = fresh();
      const hrow = await openRow(await panel(held, HELD));
      await addVia(hrow, "add", "Finish book seven");
      const hagain = await panel(held, HELD);
      const g = [...hagain.querySelectorAll("g.g-row")].find(x => /Finish book seven/.test(x.getAttribute("data-link")));
      const li = [...hagain.querySelectorAll(".g-task")].find(x => (x.querySelector(".g-tname") || {}).textContent === "Finish book seven");
      out.paused = {
        fm: (held.__store.get("Tasks/Finish book seven.md") || "").split("\n---")[0],
        rowPaused: g ? g.getAttribute("data-paused") : null,
        rowHealth: g ? g.getAttribute("data-health") : null,
        listPaused: li ? li.getAttribute("data-paused") : null,
        chip: li ? (li.querySelector(".tchip") || {}).textContent : null,
      };
    }

    /* ── 10. Escape closes the row · Enter in the name field adds ───────────── */
    {
      const app = fresh();
      const row = await openRow(await panel(app, GOAL));
      key(row.start, "Escape"); await wait(20);
      out.escClosed = !row.bar.firstChild;

      const row2 = await openRow(app.__esc || (await panel(app, GOAL)));
      row2.name.value = "Typed and entered";
      key(row2.name, "Enter"); await wait(200);
      out.enterNote = app.__store.get("Tasks/Typed and entered.md") || null;
      out.enterStaysOpen = !!row2.bar.firstChild;
    }
    return out;
  }, { DASH, PANEL_SRC, GOALS_SRC, files: baseVault(), GOAL, OPEN, HELD });

  /* ── 1 ── */
  assert(r.render.liveBtn === "＋ Task", "the goal panel header carries a ＋ Task button — " + JSON.stringify(r.render.liveBtn));
  assert(r.render.heldBtn === "＋ Task", "a PAUSED goal keeps the ＋ Task button");
  assert(r.render.heldKeepsPause, "…alongside its ▶ Resume control");
  assert(r.render.liveClosed === "", "the row starts closed (an empty .addtaskbar takes no space)");
  assert(r.render.cards === 3 && r.render.cardBtns === 3, "every 🎯 Goals card carries one — " + r.render.cardBtns + "/" + r.render.cards);
  assert(JSON.stringify(r.render.cardBtnText) === JSON.stringify(["＋ Task"]), "…all reading ＋ Task");
  assert(r.render.heldCardBtn, "…including the paused goal's card");

  /* ── 2 ── */
  assert(r.defaults.startType === "date" && r.defaults.endType === "date", "start and end are <input type=date>");
  assert(r.defaults.start === TODAY, "start defaults to today — " + r.defaults.start);
  assert(r.defaults.end === "2026-10-31", "end defaults to the goal's target — " + r.defaults.end);
  assert(r.defaults.noTargetEnd === "", "a goal with no target leaves end blank");
  assert(r.defaults.cardEnd === "2026-10-31", "the 🎯 Goals card defaults the same way");
  assert(r.defaults.focused, "the name field takes focus when the row opens");
  assert(JSON.stringify(r.defaults.order) === JSON.stringify(["name", "start", "end", "add", "open", "cancel"]),
    "row order is name · start · end · Add · Add & open · Cancel — " + JSON.stringify(r.defaults.order));
  assert(JSON.stringify(r.defaults.labels) === JSON.stringify(["Add", "Add & open", "Cancel"]),
    "…with those labels — " + JSON.stringify(r.defaults.labels));

  /* ── 3 — the one that stops the three creation paths drifting ── */
  assert(r.dashNote, "the Dashboard's task: route wrote Tasks/Record episode two.md");
  assert(r.panelNote, "＋ Task on the goal panel wrote the same path");
  assert(r.panelNote === r.dashNote,
    "the goal panel's note is BYTE-IDENTICAL to the Dashboard's (" + (r.dashNote || "").length + " bytes)");
  assert(r.cardNote === r.dashNote, "the 🎯 Goals card's note is BYTE-IDENTICAL to the Dashboard's");
  assert(r.openNote === r.dashNote, "Add & open writes the same bytes as Add");
  assert(/^---\ntype: task\ngoal: "\[\[🚀 Launch the app\]\]"\nstatus: active\nstart: 2026-09-14\nend: 2026-10-31\ncompleted: \ntags:\n  - task\n---\n/.test(r.dashNote || ""),
    "…frontmatter is type/goal/status/start/end/completed/tags, in that order");
  assert((r.dashNote || "").endsWith("## 📆 Timeline\n\n" + TIMELINE +
                                     "\n\n## Sub-tasks\n- [ ] \n\n## 🗒️ Notes\n"),
    "…body ends Timeline (the guarded dv.view block) · Sub-tasks with one empty box · Notes");
  assert(r.panelCreates === 1, "exactly one vault.create per task");
  assert(r.panelStaysOpen && r.panelNameCleared && r.panelRefocused,
    "Add leaves the row open, clears the name and re-focuses it — ready for the next task");
  assert(r.panelDidNotOpen, "…and does NOT navigate away from the goal");
  assert(r.panelNotices.length === 1 && /Record episode two/.test(r.panelNotices[0]),
    "…and fires one Notice — " + JSON.stringify(r.panelNotices));
  assert(JSON.stringify(r.openOpened) === JSON.stringify(["Tasks/Record episode two.md"]),
    "Add & open opens the new note — " + JSON.stringify(r.openOpened));
  assert(r.openClosedRow, "…and closes the row behind it");

  /* ── 5 ── */
  assert(/MINE — do not touch/.test(r.collide.kept), "a colliding name never overwrites the existing note");
  assert(r.collide.made && /Record episode two/.test(r.collide.made),
    "…it falls back to “<name> 2.md”, exactly as freePath() in initHub.js does");
  assert(r.collide.notes.length === 2, "…leaving two notes, not one — " + JSON.stringify(r.collide.notes));

  /* ── 6 ── */
  assert(JSON.stringify(r.safe.paths) === JSON.stringify(["Tasks/Q3 relaunch  EU push.md"]),
    "“Q3: relaunch / EU #push” lands at a safe path — " + JSON.stringify(r.safe.paths));
  /* NOTE — the contract asks for the punctuation to survive into the `#` heading.
     It cannot: createTaskNote() in dashboard/initHub.js writes `# <safe name>`, and
     item 3 (byte-identical to that route) outranks it. Asserted as it really is. */
  assert(r.safe.heading === "Q3 relaunch  EU push",
    "…and the `# ` heading matches the Dashboard route's, character for character — " + JSON.stringify(r.safe.heading));

  /* ── 7 ── */
  assert(r.emptyCreates === 0, "a whitespace-only name writes nothing, by button or by Enter");
  assert(r.doubleCreates === 1 && r.doublePaths.length === 1,
    "two clicks in the same tick write ONE note — " + r.doubleCreates + " create(s), " + JSON.stringify(r.doublePaths));

  /* ── 8 ── */
  assert(r.reRender.rows.indexOf("Tasks/Record episode two.md") >= 0,
    "the new task is a bar in the goal's chart on the next render — " + JSON.stringify(r.reRender.rows));
  assert(r.reRender.list.indexOf("Record episode two") >= 0,
    "…and a row in the goal's task list — " + JSON.stringify(r.reRender.list));
  assert(/1 task/.test(r.reRender.head || ""), "…and the header counts it — " + r.reRender.head);

  /* ── 9 ── */
  assert(/status: active/.test(r.paused.fm) && !/paused/.test(r.paused.fm),
    "a task added to a PAUSED goal is written `status: active`, with no paused key of its own");
  assert(r.paused.rowPaused === "1" && r.paused.rowHealth === "paused",
    "…yet its bar reads paused, through the existing cascade — " + r.paused.rowHealth);
  assert(r.paused.listPaused === "1" && r.paused.chip === "active",
    "…and so does its list row, while the chip still shows its own status — " + r.paused.chip);

  /* ── 10 ── */
  assert(r.escClosed, "Escape closes the row (from the date field too)");
  assert(r.enterNote, "Enter in the name field adds — Tasks/Typed and entered.md");
  assert(r.enterStaysOpen, "…and behaves as Add: the row stays open");
}, { now: NOW });
