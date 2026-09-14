// Agent E — 🧹 Triage: candidate collection + the three actions + counts/filter.
const { withPage, extractBlocks, readFile, assert } = require("../lib.js");
const F = require("./fixtures.js");

const B = require("../build.js");
const NOTE = B.COMMON + "/🧹 Triage.md";
const md = readFile(NOTE);
const blocks = extractBlocks(md);

// --- static checks on the note itself ---
assert(blocks.length === 1, "note holds exactly one dataviewjs block");
try { new Function("dv", "app", "return (async()=>{" + blocks[0] + "\n})()"); assert(true, "block parses as JS"); }
catch (e) { assert(false, "block parses as JS — " + e.message); }
assert(/^---\ncssclasses:\n  - dashboard\ntags:\n  - dashboard\n---/.test(md), "frontmatter: cssclasses+tags dashboard");
assert(/^# 🧹 Triage$/m.test(md), "H1 present");
assert(/\[\[Dashboard\|← Dashboard\]\]/.test(md), "nav link back to the Dashboard");

withPage(async (page) => {
  const res = await page.evaluate(async ({ src, files, tpl, todayPath }) => {
    const H = window.StormHarness;
    const out = {};
    const app = H.mkVault(files, { createDaily: (store, rescan) => { store.set(todayPath, tpl); rescan(); } });
    const dv = H.mkDv(app, "🧹 Triage.md");
    const c = await H.runBlock(src, dv, app);

    const wait = async (fn, tries = 240) => { for (let i = 0; i < tries; i++) { if (fn()) return true; await new Promise(r => setTimeout(r, 25)); } return !!fn(); };
    const rows = () => Array.from(c.querySelectorAll(".tr-row"));
    const textOf = r => r.querySelector(".tr-text").textContent;
    const rowFor = t => rows().find(r => textOf(r) === t);
    const count = () => c.querySelector(".tr-count").textContent.trim();
    const lastNotice = () => window.__notices[window.__notices.length - 1] || "";

    out.err = (c.querySelector(".triage-error") || {}).textContent || "";
    out.hasTriage = !!c.querySelector(".triage");
    out.classes = ["triage", "tr-row", "tr-src", "tr-acts", "tr-sel"].map(k => c.querySelectorAll("." + k).length);
    out.count0 = count();
    out.texts = rows().map(textOf);
    out.srcs = rows().map(r => r.querySelector(".tr-src a").textContent);
    out.ages = rows().map(r => r.getAttribute("data-age"));
    out.badges = rows().map(r => { const b = r.querySelector(".tr-due"); return b ? b.textContent.trim() : ""; });
    out.whens = rows().map(r => r.querySelector(".tr-when").textContent);
    out.selOpts = Array.from(rows()[0].querySelectorAll(".tr-sel option")).map(o => o.textContent);
    out.selVals = Array.from(rows()[0].querySelectorAll(".tr-sel option")).map(o => o.value);
    out.emptyHidden = c.querySelector(".tr-empty").style.display;

    // bulk button with nothing older than 21 days → refuses, stays disarmed
    c.querySelector(".tr-bulk").click();
    out.bulkNoopLabel = c.querySelector(".tr-bulk").textContent;
    out.bulkNoopNotice = lastNotice();

    // ---- → Sub-task ----
    const r1 = rowFor("Email the studio about rates");
    r1.querySelector(".tr-sel").value = "Tasks/Store listing.md";
    out.beforeSrc = app.__store.get("Daily/2026-09-09 Wednesday.md");
    r1.querySelector('button[data-act="sub"]').click();
    await wait(() => !r1.isConnected);
    out.taskNote = app.__store.get("Tasks/Store listing.md");
    out.otherTask = app.__store.get("Tasks/Design pass.md");
    out.afterSrc = app.__store.get("Daily/2026-09-09 Wednesday.md");
    out.count1 = count();
    out.notice1 = lastNotice();

    // ---- → Inbox (today's note does not exist yet) ----
    const r2 = rowFor("Book the dentist");
    r2.querySelector('button[data-act="inbox"]').click();
    await wait(() => !r2.isConnected);
    out.todayNote = app.__store.get(todayPath) || "";
    out.commands = app.__log.filter(x => x.op === "command").map(x => x.id);
    out.afterSrc2 = app.__store.get("Daily/2026-09-09 Wednesday.md");
    out.count2 = count();

    // ---- Drop ----
    const r3 = rowFor("Sort out the storage unit");
    r3.querySelector('button[data-act="drop"]').click();
    await wait(() => !r3.isConnected);
    out.log = app.__store.get("_archive/Triage log.md") || "";
    out.afterOld = app.__store.get("Daily/2026-08-23 Sunday.md");
    out.count3 = count();
    out.texts3 = rows().map(textOf);
    out.mkdirs = app.__log.filter(x => x.op === "mkdir").map(x => x.path);

    // ---- filter ----
    const f = c.querySelector(".tr-filter");
    f.value = "bank"; f.dispatchEvent(new Event("input"));
    out.visible = rows().filter(r => r.style.display !== "none").map(textOf);
    f.value = ""; f.dispatchEvent(new Event("input"));
    out.visibleAfter = rows().filter(r => r.style.display !== "none").length;

    // ---- source link opens the note ----
    rows()[0].querySelector(".tr-src a").click();
    out.opened = app.__log.filter(x => x.op === "open").map(x => x.link);

    out.triggers = app.__log.filter(x => x.op === "trigger").length;
    out.notices = window.__notices.slice();
    return out;
  }, { src: blocks[0], files: F.files, tpl: F.TODAY_TEMPLATE, todayPath: F.TODAY_PATH });

  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  assert(!res.err, "no triage error div" + (res.err ? " — " + res.err : ""));
  assert(res.hasTriage, ".triage rendered");
  assert(res.classes.every(n => n > 0), "SPEC §9 class names all present: .triage .tr-row .tr-src .tr-acts .tr-sel — " + JSON.stringify(res.classes));

  // ---- candidates ----
  assert(eq(res.texts, [
    "Call the bank about the transfer",
    "Draft the newsletter",
    "Sort out the storage unit",
    "Email the studio about rates",
    "Book the dentist",
    "Compare the SM7B and the MV7"
  ]), "exactly the 6 expected candidates, oldest note first — got " + JSON.stringify(res.texts));
  assert(res.count0 === "6 items from 3 notes", 'header counts "6 items from 3 notes" — got "' + res.count0 + '"');
  const all = res.texts.join(" | ");
  [
    ["Drink enough water", "untagged habit line under 📊 Habit Tracker"],
    ["Read 10 pages", "second untagged habit line"],
    ["💧 Drink water", "#habit-tagged line under 🔥 Habits"],
    ["Push day at the gym", "line under 🏋️ Workout"],
    ["Old thing that was already handled", "line under ✅ Completed"],
    ["Reflect on how the week went", "line under 💭 Daily Reflection"],
    ["Look up that studio mic", "line already carrying ✅"],
    ["Renew the parking permit", "already-checked box"],
    ["Ancient loose end", "daily note 50 days old"],
    ["Bench press", "Fitness/ note"]
  ].forEach(([t, why]) => assert(all.indexOf(t) < 0, "excluded: " + why));
  assert(res.texts.filter(t => t === "").length === 0, "no blank-box rows");
  assert(eq(res.srcs, ["2026-08-23 Sunday", "2026-08-23 Sunday", "2026-08-23 Sunday",
    "2026-09-09 Wednesday", "2026-09-09 Wednesday", "Mic research"]), ".tr-src names each source note");
  assert(eq(res.ages, ["20", "20", "20", "3", "3", ""]), "row ages recorded (Note Bank row undated)");
  assert(res.badges[1] === "📅 Aug 30" && res.badges[3] === "📅 Sep 15" && res.badges[0] === "",
    "📅 badge only on rows that carry a date — " + JSON.stringify(res.badges));
  assert(res.whens[0] === "Aug 23 · 20 days ago" && res.whens[5] === "no date", "source date + age shown");
  assert(res.emptyHidden === "none", "empty state hidden while rows exist");

  // ---- select ----
  assert(eq(res.selOpts, ["Design pass — 🚀 Launch the app", "Store listing — 🚀 Launch the app"]),
    'select lists active+backlog tasks as "Task — Goal" (done task excluded) — ' + JSON.stringify(res.selOpts));
  assert(eq(res.selVals, ["Tasks/Design pass.md", "Tasks/Store listing.md"]), "option values are task paths");

  // ---- bulk no-op ----
  assert(/^Drop everything older than 21 days$/.test(res.bulkNoopLabel), "bulk button stays disarmed when nothing qualifies");
  assert(/Nothing older than 21 days/.test(res.bulkNoopNotice), "bulk no-op notice");

  // ---- → Sub-task ----
  const NEWSUB = "- [ ] Email the studio about rates 📅 2026-09-15";
  const iSub = res.taskNote.indexOf("## Sub-tasks"), iNew = res.taskNote.indexOf(NEWSUB), iNotes = res.taskNote.indexOf("## 🗒️ Notes");
  assert(iNew > iSub && iNew < iNotes, "sub-task appended at the END of ## Sub-tasks, before the next heading");
  assert(res.taskNote.indexOf("- [ ] Pick a host\n" + NEWSUB) >= 0, "appended after the last existing sub-task");
  assert(res.otherTask.indexOf("Email the studio") < 0, "the OTHER task note is untouched");
  assert(res.afterSrc.indexOf("Email the studio") < 0, "line removed from the source daily note");
  assert(res.beforeSrc.split("\n").length - res.afterSrc.split("\n").length === 1, "exactly one line spliced out of the source");
  assert(res.afterSrc.indexOf("- [ ] Book the dentist") >= 0 && res.afterSrc.indexOf("💧 Drink water #habit/water") >= 0,
    "the rest of the source note is intact");
  assert(res.notice1 === "Moved to Store listing", 'notice "Moved to <task>" — got "' + res.notice1 + '"');
  assert(res.count1 === "5 items from 3 notes", "counts updated after → Sub-task — got " + res.count1);

  // ---- → Inbox ----
  assert(res.commands.indexOf("daily-notes") >= 0, "missing daily note → daily-notes command fired");
  assert(res.todayNote.length > 0, "today's note now exists");
  const iZap = res.todayNote.indexOf("## ⚡ Tasks"), iItem = res.todayNote.indexOf("- [ ] Book the dentist"), iHab = res.todayNote.indexOf("## 🔥 Habits");
  assert(iZap >= 0 && iItem > iZap && iItem < iHab, "raw line appended under ## ⚡ of today's note");
  assert(res.afterSrc2.indexOf("Book the dentist") < 0, "line removed from the source note after → Inbox");
  assert(res.count2 === "4 items from 2 notes", "counts updated after → Inbox — got " + res.count2);

  // ---- Drop ----
  assert(res.log.split("\n")[0] === "# Triage log", "_archive/Triage log.md created with its heading");
  assert(res.log.indexOf("- 2026-09-12 · Sort out the storage unit · (from [[2026-08-23 Sunday]])") >= 0,
    "drop logged as `- <date> · <text> · (from [[note]])`");
  assert(res.mkdirs.indexOf("_archive") >= 0, "_archive folder created");
  assert(res.afterOld.indexOf("Sort out the storage unit") < 0, "dropped line removed from the source note");
  assert(res.afterOld.indexOf("- [ ] Call the bank about the transfer") >= 0 && res.afterOld.indexOf("Drink enough water") >= 0,
    "the rest of the old daily note is intact");
  assert(res.count3 === "3 items from 2 notes", "counts updated after Drop — got " + res.count3);
  assert(eq(res.texts3, ["Call the bank about the transfer", "Draft the newsletter", "Compare the SM7B and the MV7"]),
    "remaining rows are the three untouched ones");

  // ---- filter / links / refresh ----
  assert(eq(res.visible, ["Call the bank about the transfer"]), "filter narrows the list to matching rows");
  assert(res.visibleAfter === 3, "clearing the filter restores every row");
  assert(res.opened[0] === "Daily/2026-08-23 Sunday.md", ".tr-src link opens the source note");
  assert(res.triggers >= 3, "dataview:refresh-views triggered after each action (" + res.triggers + ")");
});
