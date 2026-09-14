/* Agent Q — G2: the task-level sub-task Gantt (GANTT.md §1) inside the Storm build.
   Today = 2026-09-13.

   i   both final trees ship _scripts/task-gantt.js byte-identical to the one source,
       and it is a dv.view file: bare JS, rendering into dv.container
   ii  both final _templates/Task.md hold exactly one dataviewjs block — the ONE-LINE
       `await dv.view("_scripts/task-gantt")` call — in a `## 📆 Timeline` section
       that precedes `## Sub-tasks`
   iii the six final template sample tasks each hold the section once, one-liner verbatim
   iv  both final storm.css carry `.tgantt` and the integration banner exactly once
   v   the dashboard `task:` route always writes the section (the one-liner is a constant
       now — it reads nothing from the vault), and a vault WITHOUT the view file degrades
       to Dataview's visible "custom view not found" notice, never a silent blank
   vi  the one-liner shipped in a real sample task renders THE SAME DOM the pasted block
       used to: no `.tg-err`, and — because the note has a start→end window — one
       `.tg-row` per sub-task, the undated ones as PROJECTED bars, so zero `.tg-chip`
*/
const fs = require("fs");
const path = require("path");
const { withPage, extractBlocks, readFile, assert } = require("../lib.js");
const V = require("../V/vault.js");

const B = require("../build.js");
const VAULT = B.VAULT;
/* common/_scripts/task-gantt.js is the canonical copy: PAUSE §4 added the
   ⏸ Pause / ▶ Resume controls to the Timeline header, which the original
   reference does not carry. Every shipped copy must still be that one file byte
   for byte, and the line-surgery core must still match the pinned reference
   beside this file verbatim — both are asserted below. */
const SRC_JS = B.COMMON + "/_scripts/task-gantt.js";
const REFERENCE = require("path").join(__dirname, "reference-line-surgery.txt");
const NOW = "2026-09-13T10:00:00";

const VIEW_RAW = fs.readFileSync(SRC_JS);                          // bytes, for (i)
const VIEW_SRC = VIEW_RAW.toString("utf8");                        // the whole file IS the source
/* CONTRACT A — what a note carries instead of the panel. */
const SHARED = '```dataviewjs\nconst p = "_scripts/' + 'task-gantt' + '", f = x => app.metadataCache.getFirstLinkpathDest(x, "");\nif (f(p + ".js") || f(p + "/view.js")) await dv.view(p);\nelse dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.", { cls: "panel-err storm-missing-view" });\n```';
const HEAD = "## 📆 Timeline";
const BANNER = "/* ── task Gantt (sub-task timeline) ── */";
const VARIANTS = B.P.variants();
const SAMPLES = [
  "Books 10–24.md", "Build a small typed app.md", "Build the project gallery.md",
  "Convert one JS project to TS.md", "Declutter the office.md", "Launch on a custom domain.md",
];
const GALLERY = "Tasks/Build the project gallery.md";

const blocksOf = md => { const o = []; const re = /```dataviewjs\n([\s\S]*?)\n```/g; let m; while ((m = re.exec(md))) o.push(m[0]); return o; };
const count = (s, needle) => s.split(needle).length - 1;

/* ── i. the shared script ships identically in both trees ─────────────────── */
console.log("── i: _scripts/task-gantt.js is the ONE file, byte for byte ──");
for (const v of VARIANTS) {
  const p = `${VAULT(v)}/_scripts/task-gantt.js`;
  const ok = fs.existsSync(p) && Buffer.compare(fs.readFileSync(p), VIEW_RAW) === 0;
  assert(ok, `final/${v}/_scripts/task-gantt.js is byte-identical to out/common/_scripts/task-gantt.js` +
    (fs.existsSync(p) ? "" : " (missing)"));
  assert(!fs.existsSync(`${VAULT(v)}/_scripts/task-gantt.txt`),
    `final/${v}/_scripts/task-gantt.txt is gone — the .js view replaced it`);
}
/* a dv.view file is evaluated as bare JS with `this` bound to the global object */
assert(!/```/.test(VIEW_SRC), "task-gantt.js carries no code fence — a view file is bare JavaScript");
assert(/^const root = dv\.container;$/m.test(VIEW_SRC), "task-gantt.js renders into dv.container");
assert(!/(?<![.\w$])this\s*[.\[]/.test(VIEW_SRC), "task-gantt.js never reads `this` — in a view it is the global object");
/* the exact-match line resolution is the original, verbatim — a fork here is a real bug */
{
  const cut = s => { const i = s.indexOf("/* ── 13."), j = s.indexOf("/* ── 15."); return (i >= 0 && j > i) ? s.slice(i, j) : ""; };
  const ref = fs.readFileSync(REFERENCE, "utf8");
  const mine = cut(VIEW_SRC), theirs = ref.slice(ref.indexOf("/* ── 13."));
  assert(!!mine && mine === theirs, "line surgery + findLine/boxText still match tests/G2/reference-line-surgery.txt, character for character");
}

/* ── ii. the shared Task template ─────────────────────────────────────────── */
console.log("── ii: _templates/Task.md carries the block once, above ## Sub-tasks ──");
for (const v of VARIANTS) {
  const t = readFile(`${VAULT(v)}/_templates/Task.md`);
  const bs = blocksOf(t);
  assert(bs.length === 1, `final/${v}/_templates/Task.md holds exactly one dataviewjs block (got ${bs.length})`);
  assert(bs[0] === SHARED, `final/${v}/_templates/Task.md: the block is the one-line dv.view call`);
  const iT = t.indexOf(HEAD), iS = t.indexOf("## Sub-tasks");
  assert(iT >= 0 && iS >= 0 && iT < iS, `final/${v}/_templates/Task.md: ${HEAD} precedes ## Sub-tasks (${iT} < ${iS})`);
  assert(count(t, HEAD) === 1, `final/${v}/_templates/Task.md: exactly one ${HEAD} heading`);
  assert(!t.includes("<!-- TASK_GANTT -->"), `final/${v}/_templates/Task.md: no <!-- TASK_GANTT --> marker left`);
  assert(t.includes(`\n${HEAD}\n\n${SHARED}\n\n## Sub-tasks\n`),
    `final/${v}/_templates/Task.md: heading + blank + block + blank, directly above ## Sub-tasks`);
}

/* ── iii. the six template sample tasks ───────────────────────────────────── */
console.log("── iii: the six template sample tasks ──");
const shipped = fs.readdirSync(`${VAULT("template")}/Tasks`).filter(f => f.endsWith(".md")).sort();
assert(JSON.stringify(shipped) === JSON.stringify(SAMPLES.concat(["📋 Tasks.md"]).sort()),
  "final/template/Tasks holds the six sample tasks + the 📋 Tasks rollup — " + shipped.join(", "));
for (const f of SAMPLES) {
  const t = readFile(`${VAULT("template")}/Tasks/${f}`);
  const bs = blocksOf(t);
  assert(count(t, HEAD) === 1 && bs.length === 1 && bs[0] === SHARED,
    `Tasks/${f}: one ${HEAD} section holding the shared block verbatim (headings=${count(t, HEAD)}, blocks=${bs.length})`);
  assert(t.indexOf(HEAD) < t.indexOf("## Sub-tasks"), `Tasks/${f}: the Timeline section precedes ## Sub-tasks`);
}
const rollup = readFile(`${VAULT("template")}/Tasks/📋 Tasks.md`);
assert(!rollup.includes(HEAD) && !rollup.includes("tgantt"),
  "Tasks/📋 Tasks.md is a rollup, not a task note — it gets no Timeline section");

/* ── iv. the stylesheet ───────────────────────────────────────────────────── */
console.log("── iv: storm.css ──");
for (const v of VARIANTS) {
  const css = readFile(`${VAULT(v)}/.obsidian/snippets/storm.css`);
  assert(css.includes(".tgantt"), `final/${v}/storm.css styles .tgantt`);
  assert(count(css, BANNER) === 1, `final/${v}/storm.css carries the task-Gantt banner exactly once (got ${count(css, BANNER)})`);
  assert(css.includes(".tg-err"), `final/${v}/storm.css styles the .tg-err fallback`);
}

/* ── v + vi. in the browser ───────────────────────────────────────────────── */
const dashSrc = extractBlocks(readFile(`${VAULT("template")}/Dashboard.md`))[0];
const withGantt = V.build("template");
assert(typeof withGantt["_scripts/task-gantt.js"] === "string",
  "the harness vault built from the final template tree serves _scripts/task-gantt.js");
const without = Object.assign({}, withGantt);
delete without["_scripts/task-gantt.js"];

// sub-task census of the sample note, read from the note itself.
// Since the PROJECTED-bar rule landed, a note that carries a real start→end window
// charts EVERY sub-task: the undated ones become projected bars, so there are no
// backlog chips at all. Chips only survive on notes without such a window.
const gallery = readFile(`${VAULT("template")}/${GALLERY}`);
const subLines = gallery.split("\n## Sub-tasks\n")[1].split(/\n#{1,6} /)[0]
  .split("\n").filter(l => /^\s*[-*]\s*\[.\]\s*\S/.test(l) && !/#habit/.test(l));
const nDated = subLines.filter(l => /📅\s*\d{4}-\d{2}-\d{2}/.test(l)).length;
const nMilestone = subLines.filter(l => !/📅\s*\d{4}-\d{2}-\d{2}/.test(l) && /🛫\s*\d{4}-\d{2}-\d{2}/.test(l)).length;
const fmBlock = (gallery.match(/^---\n([\s\S]*?)\n---/) || ["", ""])[1];
const fmDate = k => (new RegExp("^" + k + ":\\s*(\\d{4}-\\d{2}-\\d{2})\\s*$", "m").exec(fmBlock) || [])[1] || "";
const gStart = fmDate("start"), gEnd = fmDate("end");
const hasWindow = !!(gStart && gEnd && gEnd > gStart);
const nUndated = subLines.length - nDated - nMilestone;
const nProjected = hasWindow ? nUndated : 0;
const nChips = hasWindow ? 0 : nUndated;
const nRows = nDated + nMilestone + nProjected;
const galleryBlock = extractBlocks(gallery)[0];

withPage(async (page, errors) => {
  const r = await page.evaluate(async ({ dashSrc, withGantt, without, galleryBlock, viewSrc, GALLERY }) => {
    const H = window.StormHarness;
    const wait = ms => new Promise(res => setTimeout(res, ms));
    const enter = el => el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    const out = {};

    async function addTask(files, name) {
      const app = H.mkVault(JSON.parse(JSON.stringify(files)), { createDaily: () => {} });
      const dv = H.mkDv(app, "Dashboard.md");
      const c = await H.runBlock(dashSrc, dv, app);
      window.__notices.length = 0;
      const inp = c.querySelector("input[data-uadd]");
      if (!inp) return { err: "no add box" };
      inp.value = "task: " + name;
      enter(inp);
      await wait(250);
      return {
        note: app.__store.get("Tasks/" + name + ".md") || "",
        created: app.__log.some(x => x.op === "create" && x.path === "Tasks/" + name + ".md"),
        hubErr: (c.textContent.match(/Storm hub error[^\n]*/) || [null])[0],
        notices: window.__notices.slice(),
      };
    }

    out.on = await addTask(withGantt, "Ship the newsletter");
    out.off = await addTask(without, "Ship the newsletter");

    /* vi — render the ONE-LINE block shipped inside the sample task note. It goes
       through the harness's real dv.view, which resolves _scripts/task-gantt.js out
       of the same vault and evaluates it with `this` NOT bound to the container. */
    const app2 = H.mkVault(JSON.parse(JSON.stringify(withGantt)), {});
    const dv2 = H.mkDv(app2, GALLERY);
    const c2 = await H.runBlock(galleryBlock, dv2, app2);
    /* …and the control: the same source run directly, the way the pasted block used
       to be. The two DOMs must be identical — that is the whole point of CONTRACT A. */
    const app3 = H.mkVault(JSON.parse(JSON.stringify(withGantt)), {});
    const dv3 = H.mkDv(app3, GALLERY);
    const c3 = await H.runBlock(viewSrc, dv3, app3);
    out.sameDom = c2.innerHTML === c3.innerHTML;
    out.domLens = [c2.innerHTML.length, c3.innerHTML.length];
    out.domDiffAt = (() => { const a = c2.innerHTML, b = c3.innerHTML; let i = 0; while (i < a.length && a[i] === b[i]) i++; return a === b ? -1 : i; })();

    /* …and a vault that ships NO view file must show Dataview's own notice, not a blank */
    const app4 = H.mkVault(JSON.parse(JSON.stringify(without)), {});
    const dv4 = H.mkDv(app4, GALLERY);
    const c4 = await H.runBlock(galleryBlock, dv4, app4);
    out.missing = { text: (c4.textContent || "").trim(), nodes: c4.children.length, tg: c4.querySelectorAll(".tgantt").length };

    out.chart = {
      err: c2.querySelectorAll(".tg-err").length,
      errText: (c2.querySelector(".tg-err") || {}).textContent || "",
      roots: c2.querySelectorAll(".tgantt").length,
      rows: c2.querySelectorAll(".tg-row").length,
      chips: c2.querySelectorAll(".tg-chip").length,
      projected: c2.querySelectorAll("rect.tg-bar[data-projected]").length,
      bars: c2.querySelectorAll(".tg-bar").length,
      milestones: c2.querySelectorAll(".tg-milestone").length,
      today: c2.querySelectorAll("line.tg-today").length,
      addRow: c2.querySelectorAll(".tg-add .tg-addbtn").length,
      labels: [...c2.querySelectorAll(".tg-label")].map(e => e.textContent),
      viewBox: (c2.querySelector("svg.tg-svg") || { getAttribute: () => "" }).getAttribute("viewBox"),
    };
    return out;
  }, { dashSrc, withGantt, without, galleryBlock, viewSrc: VIEW_SRC, GALLERY });

  console.log("── v: the dashboard `task:` route ──");
  const on = r.on, off = r.off;
  assert(!on.err && on.created, "task: created Tasks/Ship the newsletter.md (vault WITH _scripts/task-gantt.txt)");
  assert(!on.hubErr, "the hub renders without an error div" + (on.hubErr ? " — " + on.hubErr : ""));
  const iT = on.note.indexOf(HEAD), iS = on.note.indexOf("## Sub-tasks");
  assert(iT >= 0, "the created note carries a " + HEAD + " section");
  assert(iT >= 0 && iS >= 0 && iT < iS, `${HEAD} precedes ## Sub-tasks in the created note (${iT} < ${iS})`);
  assert(count(on.note, HEAD) === 1, "exactly one " + HEAD + " heading in the created note");
  assert(on.note.includes(SHARED), "the created note carries the one-line dv.view call");
  /* THEME2 §C added the three-line guard, so a note is ~330 bytes bigger than the
   bare one-liner and still two orders of magnitude off the pasted panel. */
  assert(on.note.length < 1000, "…and is a SMALL note (" + on.note.length + " chars — the pasted block was 34 KB)");
  assert(!/📆 TASK GANTT/.test(on.note), "…with no pasted panel code in it");
  assert(on.note.includes(`\n${HEAD}\n\n${SHARED}\n\n## Sub-tasks\n- [ ] \n\n## 🗒️ Notes\n`),
    "created-note tail is: Timeline heading + blank + one-liner + blank + ## Sub-tasks + the empty box + ## 🗒️ Notes");
  assert(/^---\ntype: task\n/.test(on.note) && /\nstart: 2026-09-13\n/.test(on.note),
    "the created note keeps its frontmatter (type: task, start: today)");

  /* DELIBERATE CHANGE (CONTRACT A): the one-liner is a constant, so the `task:` route no
     longer reads _scripts/ at creation time and the Timeline section is ALWAYS written.
     A vault missing the view file degrades to the guarded block's own message
     (asserted in vi) instead of the section silently disappearing. */
  assert(!off.err && off.created, "task: still creates the note when the vault has NO _scripts/task-gantt.js");
  assert(!off.hubErr, "…and the hub shows no error div" + (off.hubErr ? " — " + off.hubErr : ""));
  assert(off.note === on.note,
    "…and writes exactly the same note: the one-liner does not depend on the vault");
  assert(!off.notices.some(n => /task-gantt|ENOENT|Couldn't create/i.test(n)),
    "…and the missing file is silent at creation time — no Notice — got " + JSON.stringify(off.notices));

  console.log("── vi: the block renders inside " + GALLERY + " ──");
  const ch = r.chart;
  assert(ch.err === 0, "no .tg-err" + (ch.err ? " — " + ch.errText.slice(0, 200) : ""));
  assert(ch.roots === 1, "one .tgantt root rendered, got " + ch.roots);
  assert(hasWindow && gStart === "2026-09-01" && gEnd === "2026-10-05",
    `${GALLERY} carries a real start→end window (${gStart} → ${gEnd}) — so every sub-task is charted`);
  assert(ch.rows === nRows && nRows === 5,
    `one .tg-row per sub-task: ${nDated} dated + ${nMilestone} milestone + ${nProjected} projected = ${nRows}, got ${ch.rows}`);
  assert(ch.bars === nDated + nProjected, `${nDated + nProjected} bars (${nDated} dated + ${nProjected} projected), got ${ch.bars}`);
  assert(ch.milestones === nMilestone, `${nMilestone} milestone marker(s) (🛫 but no 📅), got ${ch.milestones}`);
  assert(ch.chips === nChips && nChips === 0,
    `${nChips} backlog chip(s) — the undated sub-task is projected, not shelved, got ${ch.chips}`);
  assert(ch.projected === nProjected && nProjected === 1,
    `${nProjected} projected bar carrying data-projected, got ${ch.projected}`);
  assert(ch.rows + ch.chips === subLines.length,
    `every sub-task of the note is represented once: ${ch.rows} rows + ${ch.chips} chips = ${subLines.length}`);
  assert(ch.today === 1, "the today line is drawn once, got " + ch.today);
  assert(ch.addRow === 1, "the ＋ add row is present, got " + ch.addRow);
  assert(/^0 0 1000 \d+$/.test(ch.viewBox || ""), "svg.tg-svg keeps the 1000-unit viewBox — " + ch.viewBox);

  console.log("── vi: the one-liner renders the SAME DOM the pasted block did ──");
  assert(r.sameDom, "dv.view(\"_scripts/task-gantt\") produces byte-identical DOM to running the source inline" +
    (r.sameDom ? "" : ` — lengths ${r.domLens.join(" vs ")}, first difference at ${r.domDiffAt}`));

  console.log("── vi: a missing view file EXPLAINS ITSELF, never a silent blank ──");
  /* DELIBERATE CHANGE (THEME2 §C): the note's block now resolves the view before it
     calls it, so what a vault without _scripts/task-gantt.js shows is no longer
     Dataview's "custom view not found for '…'" — which named the file and stopped —
     but the panel's own error element, saying the file has not reached this device
     and why that usually is on a phone. tests/V/dv_view.js still pins Dataview's
     own behaviour for a bare call. */
  assert(/is missing from this device/.test(r.missing.text) && !/custom view not found/.test(r.missing.text),
    "a vault with no _scripts/task-gantt.js explains itself — got " + JSON.stringify(r.missing.text.slice(0, 200)));
  assert(/_scripts\/task-gantt\.js/.test(r.missing.text), "…naming the file it wants");
  assert(/iPhone or iPad/.test(r.missing.text) && /syncing/.test(r.missing.text),
    "…and pointing at sync on mobile as the likely cause");
  assert(r.missing.nodes >= 1 && r.missing.tg === 0, "…and nothing of the panel rendered (" + r.missing.nodes + " node(s))");

  if (errors.length) assert(false, "page errors: " + errors.join(" | "));
  else assert(true, "no uncaught page errors");
}, { now: NOW }).catch(e => { console.log("FAIL: " + e.stack); process.exitCode = 1; });
