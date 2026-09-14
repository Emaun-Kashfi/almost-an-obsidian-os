/* Agent V — Tasks-plugin line surgery on lines that end with a BLOCK ID (`^abc-1`).
   Obsidian only resolves a block reference when the id is the LAST thing on the line, so
   `✅ <date>` (and `📅 <date>`) must be inserted before it — and un-checking must strip the
   ✅ wherever it sits. Drives the real Dashboard block end-to-end. */
const { withPage, extractBlocks, readFile, assert } = require("../lib.js");

const B = require("../build.js");
const src = extractBlocks(readFile(B.VAULT() + "/Dashboard.md"))[0];

const TASK = "Tasks/Block ids.md";
const files = {
  "Dashboard.md": "---\ncssclasses:\n  - storm-home\ntags:\n  - dashboard\n---\n\n```dataviewjs\n```\n",
  "Goals/Anchor.md": "---\ntype: goal\nstatus: active\narea: Test\ntarget: 2026-12-31\ntags:\n  - goal\n---\n\n# Anchor\n",
  [TASK]:
`---
type: task
goal: "[[Anchor]]"
status: active
start: 2026-09-01
end: 2026-10-15
completed:
tags:
  - task
---

# Block ids

## Sub-tasks
- [ ] Draft the outline ^outline-1
- [ ] Book the room 📅 2026-09-20 ^room-2
- [x] Buy the mic ✅ 2026-09-08 ^mic-3
- [ ] No id here
`,
  "Daily/2026-09-12 Saturday.md":
    "---\ndate: 2026-09-12\ntags:\n  - daily\n---\n\n# Saturday\n\n## ⚡ Tasks\n\n- [ ] Nothing\n",
};

withPage(async (page, errors) => {
  const r = await page.evaluate(async ({ src, files, TASK }) => {
    const H = window.StormHarness;
    const app = H.mkVault(files, {});
    const dv = H.mkDv(app, "Dashboard.md");
    const c = await H.runBlock(src, dv, app);
    const sleep = ms => new Promise(res => setTimeout(res, ms));
    const lineOf = (txt, needle) => (txt.split("\n").find(l => l.indexOf(needle) >= 0) || "");
    const rowFor = t => [...c.querySelectorAll(".nm-row")].find(x => (x.querySelector(".nm-text") || {}).textContent === t);
    const out = {};

    // the next move is the dated one (📅 2026-09-20); expand to reach the rest
    const head = c.querySelector('.nm-row[data-kind="next"]');
    head.querySelector("[data-expand]").click();
    await sleep(20);

    // 1. check off a line whose id is terminal and which has no other emoji
    rowFor("Draft the outline").querySelector(".nm-box").click();
    await sleep(60);
    out.outline = lineOf(app.__store.get(TASK), "Draft the outline");

    // 2. check off a line that already carries 📅 + an id
    rowFor("Book the room").querySelector(".nm-box").click();
    await sleep(60);
    out.room = lineOf(app.__store.get(TASK), "Book the room");

    // 3. un-check a line whose ✅ sits in the middle (before the id)
    const micRow = [...c.querySelectorAll(".nm-row")].find(x => (x.querySelector(".nm-text") || {}).textContent === "Buy the mic");
    out.micRowFound = !!micRow;
    if (!micRow) {
      // done sub-tasks are not rendered; un-check through the same code path by re-checking
      // the line we just completed instead
      rowFor("Draft the outline").querySelector(".nm-box").click();
      await sleep(60);
      out.outlineUndone = lineOf(app.__store.get(TASK), "Draft the outline");
    }

    // 4. reschedule an undated line that ends with an id
    const noId = rowFor("No id here");
    out.noIdFound = !!noId;

    // 5. reschedule the (now checked) room line back to tomorrow — 📅 must stay before the id
    const rows = [...c.querySelectorAll(".nm-row")];
    const target = rows.find(x => (x.querySelector(".nm-text") || {}).textContent === "Draft the outline");
    target.querySelector('[data-resched="tomorrow"]').click();
    await sleep(80);
    out.outlineResched = lineOf(app.__store.get(TASK), "Draft the outline");

    out.all = app.__store.get(TASK).split("\n").filter(l => /^- \[/.test(l));
    return out;
  }, { src, files, TASK });

  console.log("── block-id-safe line surgery ──");
  assert(r.outline.indexOf("✅") >= 0, "checking a line with a block id stamps a ✅ date — " + r.outline);
  assert(/\^outline-1$/.test(r.outline.trim()),
    "…and the block id is still the LAST thing on the line — " + JSON.stringify(r.outline));
  assert(r.outline === "- [x] Draft the outline ✅ 2026-09-12 ^outline-1",
    "…in the exact expected shape — " + JSON.stringify(r.outline));
  assert(r.micRowFound === false, "a finished sub-task is not rendered as a row (so the un-check path is exercised on the line just completed)");

  assert(/^- \[x\] Book the room 📅 2026-09-20 ✅ 2026-09-12 \^room-2$/.test(r.room),
    "a line that already had 📅 keeps emoji order and the id stays terminal — " + JSON.stringify(r.room));

  assert(r.outlineUndone === undefined || /^- \[ \] Draft the outline \^outline-1$/.test(r.outlineUndone),
    "un-checking strips the ✅ from the middle of the line and leaves the id terminal — " + JSON.stringify(r.outlineUndone));
  assert(r.noIdFound === true, "the id-less sub-task still renders normally (no regression for ordinary lines)");

  assert(/\^outline-1$/.test(r.outlineResched.trim()) && /📅 2026-09-13/.test(r.outlineResched),
    "→ tmrw inserts 📅 before the block id — " + JSON.stringify(r.outlineResched));

  assert(!r.all.some(l => /\^[A-Za-z0-9-]+\s+\S/.test(l)),
    "no shipped line ends up with content after its block id — " + JSON.stringify(r.all));

  if (errors.length) assert(false, "page errors: " + errors.join(" | "));
  else assert(true, "no uncaught page errors");
}).catch(e => { console.log("FAIL: " + e.stack); process.exitCode = 1; });
