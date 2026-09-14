// Agent E — 🧹 Triage: two-click bulk drop of everything older than 21 days,
// plus exact-line verification when the source note has changed underneath us.
const { withPage, extractBlocks, readFile, assert } = require("../lib.js");
const F = require("./fixtures.js");

const B = require("../build.js");
const blocks = extractBlocks(readFile(B.COMMON + "/🧹 Triage.md"));
const files = Object.assign({}, F.files);
files[F.MID_PATH] = F.MID_DAILY;   // a daily note 30 days old → the only bulk-drop targets

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
    const bulk = c.querySelector(".tr-bulk");
    const writes = () => app.__log.filter(x => x.op === "modify" || x.op === "create").length;

    out.err = (c.querySelector(".triage-error") || {}).textContent || "";
    out.count0 = count();
    out.texts0 = rows().map(textOf);

    // ---- click 1: arms, writes nothing ----
    bulk.click();
    out.label1 = bulk.textContent;
    out.armed1 = bulk.classList.contains("armed");
    out.writes1 = writes();
    out.rows1 = rows().length;

    // ---- click 2: drops exactly the rows older than 21 days ----
    bulk.click();
    await wait(() => rows().length < out.rows1 && !bulk.disabled);
    out.label2 = bulk.textContent;
    out.armed2 = bulk.classList.contains("armed");
    out.count2 = count();
    out.texts2 = rows().map(textOf);
    out.midNote = app.__store.get("Daily/2026-08-13 Thursday.md");
    out.oldNote = app.__store.get("Daily/2026-08-23 Sunday.md");
    out.log = app.__store.get("_archive/Triage log.md") || "";
    out.notice2 = window.__notices[window.__notices.length - 1] || "";

    // ---- exact-line verification: the line moved (index drift) → still found by text ----
    const drift = rowFor("Draft the newsletter");
    app.__store.set("Daily/2026-08-23 Sunday.md", "<!-- edited elsewhere -->\n\n" + app.__store.get("Daily/2026-08-23 Sunday.md"));
    drift.querySelector('button[data-act="drop"]').click();
    await wait(() => !drift.isConnected);
    out.driftNote = app.__store.get("Daily/2026-08-23 Sunday.md");
    out.driftGone = !drift.isConnected;

    // ---- exact-line verification: the line is really gone → refuse, keep the row, write nothing ----
    const stale = rowFor("Book the dentist");
    const edited = app.__store.get("Daily/2026-09-09 Wednesday.md").replace("- [ ] Book the dentist", "- [ ] Book the dentist for a cleaning instead");
    app.__store.set("Daily/2026-09-09 Wednesday.md", edited);
    const wBefore = writes();
    stale.querySelector('button[data-act="drop"]').click();
    await wait(() => window.__notices.length && /any more/.test(window.__notices[window.__notices.length - 1]));
    out.staleKept = stale.isConnected;
    out.staleNotice = window.__notices[window.__notices.length - 1] || "";
    out.staleWrites = writes() - wBefore;
    out.staleNote = app.__store.get("Daily/2026-09-09 Wednesday.md");
    out.countEnd = count();
    return out;
  }, { src: blocks[0], files, tpl: F.TODAY_TEMPLATE, todayPath: F.TODAY_PATH });

  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  assert(!res.err, "no triage error div" + (res.err ? " — " + res.err : ""));
  assert(res.count0 === "8 items from 4 notes", "8 candidates from 4 notes with the 30-day-old note added — got " + res.count0);
  assert(eq(res.texts0.slice(0, 2), ["Chase the insurance refund", "Replace the kitchen bulb"]), "30-day-old rows sort first");

  // two clicks
  assert(res.label1 === "Click again to drop 2 items", 'first click arms the button — got "' + res.label1 + '"');
  assert(res.armed1 === true, "armed class set on the first click");
  assert(res.writes1 === 0, "first click writes nothing (" + res.writes1 + " writes)");
  assert(res.rows1 === 8, "first click removes no rows");
  assert(res.armed2 === false && res.label2 === "Drop everything older than 21 days", "button disarms after the run");

  // the right rows, and only those
  assert(res.count2 === "6 items from 3 notes", "counts updated after the bulk drop — got " + res.count2);
  assert(eq(res.texts2, [
    "Call the bank about the transfer", "Draft the newsletter", "Sort out the storage unit",
    "Email the studio about rates", "Book the dentist", "Compare the SM7B and the MV7"
  ]), "only the >21d rows were dropped — got " + JSON.stringify(res.texts2));
  assert(res.midNote.indexOf("Chase the insurance refund") < 0 && res.midNote.indexOf("Replace the kitchen bulb") < 0,
    "both lines spliced out of the 30-day-old note");
  assert(res.midNote.indexOf("## 📅 Today's Tasks") >= 0 && res.midNote.indexOf("## 🛫 Task Backlog") >= 0 && res.midNote.indexOf("- [ ] \n") >= 0,
    "the 30-day-old note keeps its headings and blank box");
  assert(res.oldNote.indexOf("Call the bank about the transfer") >= 0, "the 20-day-old note is NOT touched by the 21-day bulk drop");

  const entries = res.log.split("\n").filter(l => /^- \d{4}-\d{2}-\d{2} · /.test(l));
  assert(entries.length === 2, "exactly two log entries written — got " + entries.length);
  assert(entries[0] === "- 2026-09-12 · Chase the insurance refund · (from [[2026-08-13 Thursday]])" &&
         entries[1] === "- 2026-09-12 · Replace the kitchen bulb · (from [[2026-08-13 Thursday]])",
    "log entries carry date · text · source — got " + JSON.stringify(entries));
  assert(/Dropped 2 items older than 21 days/.test(res.notice2), "summary notice after the bulk drop");

  // exact-line verification
  assert(res.driftGone && res.driftNote.indexOf("Draft the newsletter") < 0 && res.driftNote.indexOf("<!-- edited elsewhere -->") >= 0,
    "line found by exact text after its index drifted, and only that line removed");
  assert(res.staleKept, "row stays when the source line no longer matches");
  assert(res.staleWrites === 0, "nothing is written when the source line no longer matches (" + res.staleWrites + " writes)");
  assert(/any more/.test(res.staleNotice), "notice explains the line moved — got " + JSON.stringify(res.staleNotice));
  assert(res.staleNote.indexOf("- [ ] Book the dentist for a cleaning instead") >= 0, "the edited line is left alone");
  assert(res.countEnd === "5 items from 3 notes", "counts reflect the drift drop — got " + res.countEnd);
});
