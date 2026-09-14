// Agent A — behaviour: toggles, reschedule, mark-done, the universal add box,
// hero One Thing, shutdown fields, action-strip filters, reference collapse.
const { withPage, extractBlocks, readFile, assert } = require("../lib.js");

/* CONTRACT A — the one-line block a note carries instead of a pasted panel. */
const VIEW = name => '```dataviewjs\nconst p = "_scripts/' + name + '", f = x => app.metadataCache.getFirstLinkpathDest(x, "");\nif (f(p + ".js") || f(p + "/view.js")) await dv.view(p);\nelse dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.", { cls: "panel-err storm-missing-view" });\n```';
const VIEW_PANEL = VIEW("goal-panel"), VIEW_GANTT = VIEW("task-gantt");
const M = require("./mock.js");

const B = require("../build.js");
const src = extractBlocks(readFile(B.DASH()))[0];

withPage(async (page, errors) => {
  const r = await page.evaluate(async ({ src, files, links, paths }) => {
    const H = window.StormHarness;
    // about:blank has an opaque origin in some builds — make sure localStorage exists and is inspectable
    let lsOk = true;
    try { window.localStorage.setItem("__probe", "1"); window.localStorage.removeItem("__probe"); } catch (e) { lsOk = false; }
    if (!lsOk) {
      const d = {};
      Object.defineProperty(window, "localStorage", { configurable: true, value: {
        getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: k => { delete d[k]; } } });
    }
    const app = H.mkVault(files, { resolvedLinks: links });
    const dv = H.mkDv(app, "Dashboard.md");
    const c = await H.runBlock(src, dv, app);
    const out = { lsStubbed: !lsOk, notices: [] };
    const wait = ms => new Promise(r2 => setTimeout(r2, ms));
    const rows = () => [...c.querySelectorAll(".nm-row")];
    const rowByText = t => rows().find(x => ((x.querySelector(".nm-text") || {}).textContent || "") === t);
    const click = el => el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    const enter = el => el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    const store = p => app.__store.get(p) || "";
    const lineOf = (p, re) => (store(p).split("\n").find(l => re.test(l)) || "");
    const section = (p, head) => { const L = store(p).split("\n"); const h = L.findIndex(l => head.test(l)); if (h < 0) return []; let e = h + 1; while (e < L.length && !/^#{1,6}\s/.test(L[e])) e++; return L.slice(h, e); };

    // 1 — toggling a next move writes [x] + ✅ today
    click(rowByText("Send the brief").querySelector(".nm-box"));
    await wait(60);
    out.toggled = lineOf(paths.story, /Send the brief/);
    out.toggledRowCls = rowByText("Send the brief").className;
    out.modifyOps = app.__log.filter(x => x.op === "modify").length;
    out.refreshed = app.__log.some(x => x.op === "trigger" && /dataview:refresh-views/.test(String(x.args)));

    // 2 — checking the LAST open sub-task of a task raises the "mark complete?" Notice
    window.__notices.length = 0;
    click(rowByText("Pick a framework").querySelector(".nm-box"));
    await wait(60);
    out.lastSubLine = lineOf(paths.typed, /Pick a framework/);
    out.lastSubNotice = window.__notices.slice();

    // 3 — data-resched="tomorrow" rewrites an existing 📅
    const conf = rowByText("Confirm guest");
    click([...conf.querySelectorAll("[data-resched]")].find(b => b.getAttribute("data-resched") === "tomorrow"));
    await wait(60);
    out.reschedRewrite = lineOf(paths.story, /Confirm guest/);

    // 4 — ... and appends one when the line has no date (sub row inside .nm-subs)
    const rec = rowByText("Record intro");
    click([...rec.querySelectorAll("[data-resched]")].find(b => b.getAttribute("data-resched") === "tomorrow"));
    await wait(60);
    out.reschedAppend = lineOf(paths.story, /Record intro/);

    // 4b — "→ today" on the due-today row keeps it on today
    const draft = rowByText("Draft questions");
    click([...draft.querySelectorAll("[data-resched]")].find(b => b.getAttribute("data-resched") === "today"));
    await wait(60);
    out.reschedToday = lineOf(paths.story, /Draft questions/);

    // 4c — a second reschedule still finds the line even though the row's text predates the rewrite
    click([...conf.querySelectorAll("[data-resched]")].find(b => b.getAttribute("data-resched") === "today"));
    await wait(60);
    out.reschedTwice = lineOf(paths.story, /Confirm guest/);
    click(conf.querySelector(".nm-box"));
    await wait(60);
    out.toggleAfterResched = lineOf(paths.story, /Confirm guest/);

    // 5 — expand toggles the sub rows
    const nextRow = rowByText("Send the brief");
    const subs = nextRow.nextElementSibling;
    out.subsBefore = subs.style.display;
    click(nextRow.querySelector("[data-expand]"));
    out.subsAfter = subs.style.display;
    click(nextRow.querySelector("[data-expand]"));
    out.subsAgain = subs.style.display;

    // 6 — ✓ Mark task complete → processFrontMatter
    window.__notices.length = 0;
    click(c.querySelector(".nm-markdone"));
    await wait(60);
    out.markdone = store(paths.convert).split("\n").slice(0, 12).join("\n");
    out.markdoneOp = app.__log.some(x => x.op === "processFrontMatter" && x.path === paths.convert);
    out.markdoneNotice = window.__notices.slice();

    // 7 — universal add box
    const uadd = c.querySelector("input[data-uadd]");
    const add = async v => { uadd.value = v; enter(uadd); await wait(150); };

    await add("task: New pilot episode @Launch 9/15-10/10");
    out.newTask = store("Tasks/New pilot episode.md");
    out.newTaskOpened = app.__log.some(x => x.op === "open" && x.link === "Tasks/New pilot episode.md");

    await add("sub: Book the studio 9/18 -> Design pass");
    out.subSection = section(paths.story, /^##\s*Sub-tasks/);

    await add("goal: Run a half marathon @Health 2026-11-30");
    out.newGoal = store("Goals/Run a half marathon.md");

    await add("Buy cables tomorrow");
    out.inboxSection = section(paths.today, /^##\s*⚡/);

    await add("sub: Something -> Nope not a task");
    out.subMissNotice = window.__notices[window.__notices.length - 1];

    // 8 — hero One Thing
    click(c.querySelector(".hero-one"));
    const oneInp = c.querySelector(".one-inp");
    out.oneInpValue = oneInp ? oneInp.value : null;
    oneInp.value = "Record the cold open";
    enter(oneInp);
    await wait(80);
    out.oneSection = section(paths.today, /^##\s*🎯/);
    out.oneRestored = (c.querySelector(".hero-one .v") || {}).textContent;

    // 9 — shutdown fields
    const win = c.querySelector('.sd-inp[data-sd="win"]');
    win.value = "Recorded the intro"; enter(win); await wait(80);
    const nxt = c.querySelector('.sd-inp[data-sd="next"]');
    nxt.value = "Email the guest"; enter(nxt); await wait(80);
    out.shutdownSection = section(paths.today, /^##\s*🌙/);

    // 10 — inbox delete (✕)
    const dent = rowByText("Call the dentist");
    click(dent.querySelector(".del"));
    await wait(80);
    out.afterDelete = section(paths.today, /^##\s*⚡/);

    // 11 — action-strip filters
    const tile = f => c.querySelector('.act[data-filter="' + f + '"]');
    const card = c.querySelector(".nowcard");
    click(tile("over"));
    out.filter1 = { attr: card.getAttribute("data-filter"), active: tile("over").classList.contains("active") };
    click(tile("today"));
    out.filter2 = { attr: card.getAttribute("data-filter"), overActive: tile("over").classList.contains("active"), todayActive: tile("today").classList.contains("active") };
    click(tile("today"));
    out.filter3 = { attr: card.getAttribute("data-filter"), anyActive: !!c.querySelector(".act.active") };
    click(tile("focus"));
    out.filterFocus = card.getAttribute("data-filter");

    // 12 — reference collapse + persistence
    const ref = c.querySelector(".refsec"), toggle = c.querySelector('[data-action="toggle-ref"]');
    click(toggle);
    out.refCollapsed = ref.classList.contains("collapsed");
    out.refStored = window.localStorage.getItem("storm.refCollapsed");
    out.refLabel = toggle.textContent.trim().slice(0, 1);
    click(toggle);
    out.refExpanded = !ref.classList.contains("collapsed");
    out.refStored2 = window.localStorage.getItem("storm.refCollapsed");

    out.notices = window.__notices.slice();
    out.err = (c.textContent.match(/Storm hub error[^<]*/) || [null])[0];
    return out;
  }, { src, files: M.files(), links: M.RESOLVED_LINKS,
       paths: { story: M.T_STORY, convert: M.T_CONVERT, typed: M.T_TYPED, today: M.TODAY_NOTE } });

  assert(!r.err, "no hub error (" + (r.err || "clean") + ")");

  // --- toggles ---
  assert(r.toggled === "- [x] Send the brief 📅 2026-09-08 ✅ 2026-09-12",
    "toggling .nm-box writes [x] + ✅ 2026-09-12 into the task note → " + JSON.stringify(r.toggled));
  assert(/\bdone\b/.test(r.toggledRowCls), "the row gets the done class");
  assert(r.refreshed, "a write triggers dataview:refresh-views");
  assert(r.lastSubLine === "- [x] Pick a framework ✅ 2026-09-12", "undated sub-task toggles too → " + JSON.stringify(r.lastSubLine));
  assert(r.lastSubNotice.some(n => /All sub-tasks done — mark Build a small typed app complete\?/.test(n)),
    "Notice when the last sub-task of a task is checked → " + JSON.stringify(r.lastSubNotice));

  // --- reschedule ---
  assert(r.reschedRewrite === "- [ ] Confirm guest 📅 2026-09-13", "data-resched=tomorrow rewrites 📅 → " + JSON.stringify(r.reschedRewrite));
  assert(r.reschedAppend === "- [ ] Record intro 📅 2026-09-13", "data-resched=tomorrow appends 📅 when undated → " + JSON.stringify(r.reschedAppend));
  assert(r.reschedToday === "- [ ] Draft questions 📅 2026-09-12", "data-resched=today writes today's date → " + JSON.stringify(r.reschedToday));
  assert(r.reschedTwice === "- [ ] Confirm guest 📅 2026-09-12", "rescheduling the same row twice still finds the line → " + JSON.stringify(r.reschedTwice));
  assert(r.toggleAfterResched === "- [x] Confirm guest 📅 2026-09-12 ✅ 2026-09-12", "toggling after a reschedule still finds the line → " + JSON.stringify(r.toggleAfterResched));

  // --- expand ---
  assert(r.subsBefore === "none" && r.subsAfter === "" && r.subsAgain === "none", "▾ expands and collapses the sub rows");

  // --- mark complete ---
  assert(/status: done/.test(r.markdone) && /completed: 2026-09-12/.test(r.markdone),
    ".nm-markdone sets status: done + completed via processFrontMatter\n" + r.markdone);
  assert(r.markdoneOp, "the completion went through fileManager.processFrontMatter");

  // --- universal add: task ---
  const t = r.newTask;
  assert(/^---\ntype: task\n/.test(t), "task: creates Tasks/<name>.md with type: task");
  assert(/goal: "\[\[🚀 Launch the app\]\]"/.test(t), "task: resolves @Launch to the goal wikilink");
  assert(/status: active/.test(t) && /start: 2026-09-15/.test(t) && /end: 2026-10-10/.test(t), "task: writes status + the parsed date range");
  assert(/## Sub-tasks\n- \[ \] /.test(t), "task: note has an empty ## Sub-tasks box");
  assert(!/🎯 GOAL PANEL/.test(t), "task notes do NOT carry the goal panel");
  /* CONTRACT A: the `## 📆 Timeline` section is a constant one-line dv.view call now.
     It no longer depends on reading `_scripts/task-gantt.txt` at creation time, so it is
     ALWAYS written (deliberate change: a vault missing the view file shows Dataview's own
     "custom view not found" notice in the note, which is visible, instead of the section
     silently disappearing). */
  assert(t.includes("\n## 📆 Timeline\n\n" + VIEW_GANTT + "\n\n## Sub-tasks\n"),
    "task: the Timeline section holds the one-line view block, directly above ## Sub-tasks");
  assert((t.match(/```dataviewjs/g) || []).length === 1,
    "task: exactly one dataviewjs block in the created note");
  assert(r.newTaskOpened, "task: opens the new note");

  // --- universal add: sub ---
  assert(r.subSection.filter(l => l.trim()).pop() === "- [ ] Book the studio 📅 2026-09-18",
    "sub: appends to the END of ## Sub-tasks with 📅 → " + JSON.stringify(r.subSection.slice(-2)));
  assert(/No task in Tasks\/ matches/.test(r.subMissNotice || ""), "sub: with an unknown task shows a Notice instead of writing");

  // --- universal add: goal ---
  const gnote = r.newGoal;
  assert(/^---\ntype: goal\nstatus: active\narea: Health\ntarget: 2026-11-30/.test(gnote), "goal: creates Goals/<name>.md with area + target");
  /* CONTRACT A: the note carries the one-line call, not a 22 KB pasted panel. */
  assert(gnote.includes("\n" + VIEW_PANEL + "\n\n## 🗒️ Notes\n"),
    "goal: note carries the one-line goal-panel view block above ## 🗒️ Notes");
  /* THEME2 §C: the guard is three lines, so ~330 bytes more than the bare call. */
  assert(gnote.length < 900, "goal: …and the note stays small (" + gnote.length + " chars, was 22 KB)");
  assert(!/🎯 GOAL PANEL/.test(gnote), "goal: no pasted panel code anywhere in the note");

  // --- universal add: bare text ---
  assert(r.inboxSection.some(l => l === "- [ ] Buy cables 📅 2026-09-13"), "bare text lands under ## ⚡ in today's note with its parsed date");

  // --- one thing / shutdown / delete ---
  assert(r.oneInpValue === "Ship episode one", "clicking the hero opens an .one-inp prefilled from the note");
  assert(r.oneSection.some(l => l === "→ Record the cold open"), "One Thing writes `→ text` under ## 🎯 One thing → " + JSON.stringify(r.oneSection));
  assert(r.oneRestored === "Record the cold open", "the hero shows the saved text again");
  assert(r.shutdownSection.some(l => l === "**Win of the day:** Recorded the intro"), "🏆 Win writes into the 🌙 section");
  assert(r.shutdownSection.some(l => l === "**One next step on anything I touched:** Email the guest"), "⏭ Next step writes into the 🌙 section");
  assert(!r.afterDelete.some(l => /Call the dentist/.test(l)), "✕ removes the inbox line from the daily note");
  assert(r.afterDelete.some(l => /Pay the invoice/.test(l)), "...and leaves the other inbox lines alone");

  // --- filters ---
  assert(r.filter1.attr === "over" && r.filter1.active, "clicking Overdue sets data-filter + .active");
  assert(r.filter2.attr === "today" && r.filter2.todayActive && !r.filter2.overActive, "clicking another tile moves the filter");
  assert(r.filter3.attr === "" && !r.filter3.anyActive, "clicking the active tile clears the filter");
  assert(r.filterFocus === "", "the Focus tile is not a filter");

  // --- reference collapse ---
  assert(r.refCollapsed && r.refStored === "1", "reference toggle collapses + persists to localStorage" + (r.lsStubbed ? " (stubbed origin)" : ""));
  assert(r.refLabel === "▸", "collapsed toggle flips its caret");
  assert(r.refExpanded && r.refStored2 === "0", "toggling again expands + persists");

  assert(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join("; ") : ""));
});
