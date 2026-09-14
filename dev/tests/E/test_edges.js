// Agent E — 🧹 Triage edges: the 42-day window boundary, frontmatter-dated notes,
// code fences, creating a missing ## Sub-tasks section, → Inbox when the source IS
// today's note, and the empty state.
const { withPage, extractBlocks, readFile, assert } = require("../lib.js");

const B = require("../build.js");
const blocks = extractBlocks(readFile(B.COMMON + "/🧹 Triage.md"));

const daily = (iso, body) => "---\ndate: " + iso + "\ntags:\n  - daily\n---\n\n## 📅 Today's Tasks\n" + body + "\n";

const files = {
  "🧹 Triage.md": "---\ncssclasses:\n  - dashboard\n---\n",
  // window boundary: 42 days old is in, 43 days old is out
  "Daily/2026-08-01 Saturday.md": daily("2026-08-01", "- [ ] Exactly forty-two days old"),
  "Daily/2026-07-31 Friday.md": daily("2026-07-31", "- [ ] Forty-three days old"),
  // dated by frontmatter only (filename carries no date prefix)
  "Daily/Scratch page.md": daily("2026-09-05", "- [ ] Dated by frontmatter only"),
  // checkbox-looking lines inside a code fence must be ignored
  "Note Bank/Snippets.md": "---\ntype: note\n---\n\n# Snippets\n\n```tasks\nnot done\n- [ ] fenced example line\n```\n\n- [ ] Real note-bank item\n",
  // today's note exists: one item already in the inbox, one under Notes
  "Daily/2026-09-12 Saturday.md": "---\ndate: 2026-09-12\ntags:\n  - daily\n---\n\n## ⚡ Tasks\n- [ ] Already an inbox item\n\n## 📝 Notes\n- [ ] Jot from the notes section\n",
  // a task note with no ## Sub-tasks section at all
  "Tasks/No section.md": "---\ntype: task\ngoal: \"[[Some goal]]\"\nstatus: active\ntags:\n  - task\n---\n\n# No section\n\nJust prose, no sub-task heading yet.\n"
};

withPage(async (page) => {
  const res = await page.evaluate(async ({ src, files }) => {
    const H = window.StormHarness;
    const out = {};
    const app = H.mkVault(files, {});
    const dv = H.mkDv(app, "🧹 Triage.md");
    const c = await H.runBlock(src, dv, app);
    const wait = async (fn, tries = 240) => { for (let i = 0; i < tries; i++) { if (fn()) return true; await new Promise(r => setTimeout(r, 25)); } return !!fn(); };
    const rows = () => Array.from(c.querySelectorAll(".tr-row"));
    const textOf = r => r.querySelector(".tr-text").textContent;
    const rowFor = t => rows().find(r => textOf(r) === t);
    const last = () => window.__notices[window.__notices.length - 1] || "";

    out.err = (c.querySelector(".triage-error") || {}).textContent || "";
    out.texts = rows().map(textOf);
    out.count = c.querySelector(".tr-count").textContent.trim();

    // → Sub-task into a task note that has no ## Sub-tasks section
    const r1 = rowFor("Exactly forty-two days old");
    r1.querySelector('button[data-act="sub"]').click();
    await wait(() => !r1.isConnected);
    out.taskNote = app.__store.get("Tasks/No section.md");
    out.notice1 = last();

    // → Inbox for a line that already lives under ## ⚡ of today's note: no-op
    const r2 = rowFor("Already an inbox item");
    const before = app.__store.get("Daily/2026-09-12 Saturday.md");
    r2.querySelector('button[data-act="inbox"]').click();
    await wait(() => /Already in today/.test(last()));
    out.sameKept = r2.isConnected;
    out.sameNotice = last();
    out.sameUnchanged = app.__store.get("Daily/2026-09-12 Saturday.md") === before;

    // → Inbox for a line elsewhere in today's note: appended under ⚡, original left in place
    const r3 = rowFor("Jot from the notes section");
    r3.querySelector('button[data-act="inbox"]').click();
    await wait(() => !r3.isConnected);
    out.todayNote = app.__store.get("Daily/2026-09-12 Saturday.md");

    // --- second mini-vault: nothing to triage at all ---
    const appB = H.mkVault({ "🧹 Triage.md": "---\ncssclasses:\n  - dashboard\n---\n" }, {});
    const cB = await H.runBlock(src, H.mkDv(appB, "🧹 Triage.md"), appB);
    out.emptyCount = cB.querySelector(".tr-count").textContent.trim();
    out.emptyShown = cB.querySelector(".tr-empty").style.display;
    out.emptyRows = cB.querySelectorAll(".tr-row").length;

    // --- third mini-vault: candidates but no task notes yet ---
    const appC = H.mkVault({
      "🧹 Triage.md": "---\ncssclasses:\n  - dashboard\n---\n",
      "Note Bank/Loose.md": "---\ntype: note\n---\n\n- [ ] Nowhere to file this yet\n"
    }, {});
    const cC = await H.runBlock(src, H.mkDv(appC, "🧹 Triage.md"), appC);
    const rowC = cC.querySelector(".tr-row");
    out.noTaskSelDisabled = cC.querySelector(".tr-sel").disabled;
    rowC.querySelector('button[data-act="sub"]').click();
    await wait(() => /Create a task note first/.test(last()));
    out.noTaskNotice = last();
    out.noTaskRowKept = rowC.isConnected;
    out.noTaskWrites = appC.__log.filter(x => x.op === "modify" || x.op === "create").length;

    out.notices = window.__notices.slice();
    return out;
  }, { src: blocks[0], files });

  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  assert(!res.err, "no triage error div" + (res.err ? " — " + res.err : ""));

  assert(res.texts.indexOf("Exactly forty-two days old") >= 0, "a daily note exactly 42 days old is in the window");
  assert(res.texts.indexOf("Forty-three days old") < 0, "a daily note 43 days old is outside the window");
  assert(res.texts.indexOf("Dated by frontmatter only") >= 0, "daily note dated by frontmatter (no date in the filename) is scanned");
  assert(res.texts.indexOf("fenced example line") < 0, "checkbox lines inside a code fence are ignored");
  assert(res.texts.indexOf("Real note-bank item") >= 0, "a real Note Bank checkbox after the fence is still found");
  assert(res.count === "5 items from 4 notes", "counts across the edge vault — got " + res.count);

  const t = res.taskNote;
  assert(/\n## Sub-tasks\n- \[ \] Exactly forty-two days old\n?$/.test(t.replace(/\s+$/, "\n")),
    "missing ## Sub-tasks section is created at EOF with the new line — got " + JSON.stringify(t.slice(-90)));
  assert(res.notice1 === "Moved to No section", "notice names the destination task");

  assert(res.sameKept, "→ Inbox on a line already under ⚡ of today's note keeps the row");
  assert(/Already in today/.test(res.sameNotice), "…and says so — got " + JSON.stringify(res.sameNotice));
  assert(res.sameUnchanged, "…and writes nothing");

  const iZap = res.todayNote.indexOf("## ⚡ Tasks");
  const iNew = res.todayNote.indexOf("- [ ] Jot from the notes section", iZap);
  const iNotes = res.todayNote.indexOf("## 📝 Notes");
  assert(iNew > iZap && iNew < iNotes, "a line from elsewhere in today's note is appended under ⚡");
  assert(res.todayNote.indexOf("- [ ] Jot from the notes section", iNotes) >= 0, "…and the original is left in place (source IS today's note)");

  assert(res.emptyRows === 0 && res.emptyCount === "0 items from 0 notes", "empty vault renders the zero header");
  assert(res.emptyShown === "", "…and shows the 'nothing left to triage' empty state");
  assert(res.noTaskSelDisabled === true, "select is disabled when no active/backlog task notes exist");
  assert(/Create a task note first/.test(res.noTaskNotice), "→ Sub-task without a destination explains itself");
  assert(res.noTaskRowKept && res.noTaskWrites === 0, "…keeps the row and writes nothing");
});
