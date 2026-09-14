// Agent B2 — the two daily dynamic tables (_scripts/daily-tables.txt), SPEC §6.
// Runs both blocks against a mock vault for 2026-09-12, 2026-09-11 and an empty day.
const { withPage, readFile, assert } = require("../lib.js");

const B = require("../build.js");
const TXT = readFile(B.COMMON + "/_scripts/daily-tables.txt");
const parts = TXT.split(/^<!-- SPLIT -->$/m);
assert(parts.length === 2, "daily-tables.txt has exactly one <!-- SPLIT --> separator");
const fence = s => {
  const m = s.trim().match(/^```dataviewjs\n([\s\S]*)\n```$/);
  if (!m) { console.log("FAIL: block is not a single ```dataviewjs fence"); process.exitCode = 1; return ""; }
  return m[1];
};
const PLANNED = fence(parts[0]);
const DONE = fence(parts[1]);
assert(!!PLANNED && !!DONE, "both blocks extracted as dataviewjs fences");

// The shipped daily templates also carry the vault's existing Workout block (3rd fence).
// It is not ours to change, but it ships inside our deliverable — smoke it.
const tplFences = md => { const out = []; const re = /```dataviewjs\n([\s\S]*?)\n```/g; let m; while ((m = re.exec(md))) out.push(m[1]); return out; };
const WORKOUT = tplFences(readFile(B.P.variant().seeds + "/_templates/Daily Note Template.md"))[2];
assert(!!WORKOUT && /🏋️ Workouts/.test(WORKOUT), "workout block is the 3rd dataviewjs fence in the daily template");

// SPEC §10: syntax-validate the extracted JS the same way the harness will run it.
for (const [name, src] of [["Planned", PLANNED], ["Done", DONE]]) {
  let ok = true;
  try { new Function("dv", "app", "return (async()=>{" + src + "\n})()"); } catch (e) { ok = false; console.log("  " + e.message); }
  assert(ok, name + " block parses as an async dataviewjs body");
}

// ---------------------------------------------------------------- mock vault
const GOAL = "Goals/\u{1F680} Launch the app.md";
const files = {
  "Dashboard.md": "---\ntags:\n  - dashboard\n---\n",
  [GOAL]: "---\ntype: goal\nstatus: active\narea: Product\ntarget: 2026-12-31\ntags:\n  - goal\n---\n\n# Launch the app\n",

  "Tasks/Screen design pass.md":
    "---\ntype: task\ngoal: \"[[\u{1F680} Launch the app]]\"\nstatus: active\nstart: 2026-09-01\nend: 2026-10-15\ncompleted: \ntags:\n  - task\n---\n\n# Screen design pass\n\n## Sub-tasks\n" +
    "- [ ] Draft the arc \u{1F4C5} 2026-09-12\n" +
    "- [x] Write the pitch \u{1F4C5} 2026-09-11 ✅ 2026-09-11\n" +
    "- [x] Outline beats \u{1F4C5} 2026-09-12 ✅ 2026-09-12\n" +
    "- [ ] Undated thing #launch\n",

  "Tasks/Recording setup.md":
    "---\ntype: task\ngoal: \"[[\u{1F680} Launch the app]]\"\nstatus: backlog\nstart: 2026-10-15\nend: 2026-11-30\ncompleted: \ntags:\n  - task\n---\n\n# Recording setup\n\n## Sub-tasks\n" +
    "- [ ] Buy the mic \u{1F4C5} 2026-09-12\n" +
    "- [x] Book the studio \u{1F4C5} 2026-09-10 ✅ 2026-09-11\n",

  // status: done -> its sub-tasks must NOT appear in "Planned"; the note itself is a 🏁 row on the 11th
  "Tasks/App foundations.md":
    "---\ntype: task\ngoal: \"[[\u{1F680} Launch the app]]\"\nstatus: done\nstart: 2025-06-01\nend: 2026-08-31\ncompleted: 2026-09-11\ntags:\n  - task\n---\n\n# App foundations\n\n## Sub-tasks\n" +
    "- [x] Pick a name ✅ 2026-08-31\n" +
    "- [ ] Leftover item \u{1F4C5} 2026-09-12\n",

  // a task note with no goal -> the Goal cell must fall back to an em dash
  "Tasks/Loose end.md":
    "---\ntype: task\ngoal: \nstatus: active\nstart: 2026-09-01\nend: \ncompleted: \ntags:\n  - task\n---\n\n## Sub-tasks\n" +
    "- [ ] Orphan step \u{1F4C5} 2026-09-12\n",

  // must never be read (SPEC §2 exclusions)
  "Tasks/_templates/Sample task.md":
    "---\ntype: task\nstatus: active\n---\n\n## Sub-tasks\n- [ ] Template ghost \u{1F4C5} 2026-09-12\n- [x] Template ghost done ✅ 2026-09-11\n",
  "Tasks/\u{1F4CB} Tasks.md": "---\ncssclasses:\n  - dashboard\n---\n",
  "Fitness/2026-09-12 Session.md":
    "---\ntype: workout\n---\n\n- [x] Squats ✅ 2026-09-12\n- [ ] Bench press \u{1F4C5} 2026-09-12\n",

  // daily notes: the 12th carries `date:`, the 11th deliberately does NOT (filename fallback)
  "Daily/2026-09-12 Saturday.md": "---\ndate: 2026-09-12\ntags:\n  - daily\n---\n\n## ⚡ Tasks\n- [ ] Call dentist \u{1F4C5} 2026-09-12\n",
  "Daily/2026-09-11 Friday.md": "---\ntags:\n  - daily\n---\n\n## ⚡ Tasks\n- [ ] A one-off \u{1F4C5} 2026-09-11\n",
  "Daily/2026-09-01 Tuesday.md": "---\ndate: 2026-09-01\ntags:\n  - daily\n---\n",
};

withPage(async (page, errors) => {
  // --- the inherited Workout block still renders (and degrades with no 🏋️ Workouts note)
  const wo = await page.evaluate(async ({ files, WORKOUT }) => {
    const H = window.StormHarness;
    const run = async extra => {
      const app = H.mkVault(Object.assign({}, files, extra), {});
      const dv = H.mkDv(app, "Daily/2026-09-12 Saturday.md");
      return (await H.runBlock(WORKOUT, dv, app)).textContent.trim();
    };
    return { absent: await run({}), present: await run({ "🏋️ Workouts.md": "---\nschedule:\n  Saturday: Rest\n---\n" }) };
  }, { files, WORKOUT });
  assert(/Rest day|Today:|Set up your weekly plan/.test(wo.absent), "workout block renders with no 🏋️ Workouts note (" + wo.absent.slice(0, 40) + "…)");
  assert(/Rest day|Today:/.test(wo.present), "workout block renders against a 🏋️ Workouts schedule");

  const res = await page.evaluate(async ({ files, PLANNED, DONE, GOAL }) => {
    const H = window.StormHarness;
    const readTable = c => {
      const t = c.querySelector("table");
      if (!t) return null;
      const body = t.tBodies[0];
      return {
        cls: t.className,
        headers: [...t.querySelectorAll("thead th")].map(e => e.textContent),
        rows: [...(body ? body.rows : [])].map(tr => ({
          cls: tr.className,
          cells: [...tr.cells].map(td => td.textContent.trim()),
          hrefs: [...tr.querySelectorAll("a.internal-link")].map(a => a.getAttribute("data-href"))
        }))
      };
    };
    const run = async (daily) => {
      const app = H.mkVault(files, {});
      const out = {};
      for (const [key, src] of [["planned", PLANNED], ["done", DONE]]) {
        const dv = H.mkDv(app, daily);
        const c = await H.runBlock(src, dv, app);
        out[key] = {
          wrap: c.classList.contains("dt-wrap"),
          text: c.textContent,
          para: (c.querySelector("p") || {}).textContent || "",
          sum: (c.querySelector(".dt-sum") || {}).textContent || "",
          table: readTable(c)
        };
      }
      return out;
    };
    return {
      d12: await run("Daily/2026-09-12 Saturday.md"),
      d11: await run("Daily/2026-09-11 Friday.md"),
      d01: await run("Daily/2026-09-01 Tuesday.md"),
      GOAL
    };
  }, { files, PLANNED, DONE, GOAL });

  const { d12, d11, d01 } = res;
  const TASK_STORY = "Tasks/Screen design pass.md";
  const TASK_REC = "Tasks/Recording setup.md";
  const TASK_FOUND = "Tasks/App foundations.md";

  // ---------------------------------------------------------------- 2026-09-12
  assert(d12.planned.wrap && d12.done.wrap, "12th: both containers carry .dt-wrap");
  assert(!!d12.planned.table && /\bdt\b/.test(d12.planned.table.cls), "12th: Planned renders table.dt");
  assert(JSON.stringify(d12.planned.table.headers) === JSON.stringify(["Sub-task", "Task", "Goal", "Status"]),
    "12th: Planned headers are Sub-task/Task/Goal/Status");
  const p12 = d12.planned.table.rows;
  assert(p12.length === 4, "12th: Planned has 4 rows (got " + p12.length + ")");
  assert(p12[0].cells[0] === "☐ Orphan step" && p12[0].cells[2] === "—",
    "12th: goal-less task shows an em dash in the Goal column");
  assert(p12[1].cells[0] === "☐ Buy the mic" && p12[1].cells[3] === "backlog",
    "12th: unchecked rows first, sorted by task name — '☐ Buy the mic' (backlog)");
  assert(p12[2].cells[0] === "☐ Draft the arc" && p12[2].cells[3] === "active", "12th: '☐ Draft the arc' (active)");
  assert(p12[3].cells[0] === "☑ Outline beats", "12th: checked sub-task shows ☑ and sorts last");
  assert(p12[2].hrefs[0] === TASK_STORY && p12[2].hrefs[1] === res.GOAL,
    "12th: Task/Goal cells link to the right paths");
  assert(!/Leftover item/.test(d12.planned.text), "12th: sub-tasks of a status:done task are excluded from Planned");
  assert(!/Template ghost/.test(d12.planned.text + d12.done.text), "12th: Tasks/_templates/* is never scanned");
  assert(!/Squats|Bench press/.test(d12.planned.text + d12.done.text), "12th: Fitness/ checkboxes are never included");
  assert(!/Call dentist/.test(d12.planned.text + d12.done.text), "12th: daily-note one-offs are never included");

  assert(d12.done.sum === "1 sub-task across 1 task", "12th: Done summary is '1 sub-task across 1 task' (got '" + d12.done.sum + "')");
  const dn12 = d12.done.table.rows;
  assert(!!d12.done.table && /\bdt\b/.test(d12.done.table.cls), "12th: Done renders table.dt");
  assert(JSON.stringify(d12.done.table.headers) === JSON.stringify(["Sub-task", "Task", "Goal"]),
    "12th: Done headers are Sub-task/Task/Goal");
  assert(dn12.length === 1 && dn12[0].cells[0] === "☑ Outline beats", "12th: Done has the one ✅ 2026-09-12 sub-task");
  assert(dn12[0].hrefs[0] === TASK_STORY && dn12[0].hrefs[1] === res.GOAL, "12th: Done row links resolve to task + goal");
  assert(dn12.filter(r => r.cls === "flag").length === 0, "12th: no 🏁 flag row (no task completed that day)");

  // ---------------------------------------------------------------- 2026-09-11 (day taken from the FILENAME)
  const p11 = d11.planned.table && d11.planned.table.rows;
  assert(!!p11 && p11.length === 1, "11th: Planned has 1 row (day resolved from the filename, no `date:` property)");
  assert(p11[0].cells[0] === "☑ Write the pitch" && p11[0].cells[1] === "Screen design pass",
    "11th: Planned row is '☑ Write the pitch' on Screen design pass");
  assert(!/Draft the arc|Buy the mic|Outline beats/.test(d11.planned.text), "11th: the 12th's sub-tasks do not leak in");

  assert(d11.done.sum === "2 sub-tasks across 2 tasks · 1 task completed",
    "11th: Done summary is '2 sub-tasks across 2 tasks · 1 task completed' (got '" + d11.done.sum + "')");
  const dn11 = d11.done.table.rows;
  assert(dn11.length === 3, "11th: Done has 3 rows (2 sub-tasks + 1 completed task)");
  assert(dn11[0].cells[0] === "☑ Book the studio" && dn11[1].cells[0] === "☑ Write the pitch",
    "11th: sub-task rows come first, ordered by task name");
  assert(dn11[2].cells[0] === "🏁 Task completed", "11th: the completed task renders '🏁 Task completed'");
  assert(dn11[2].cls === "flag", "11th: the completed-task <tr> carries class 'flag'");
  assert(dn11[0].cls === "" && dn11[1].cls === "", "11th: sub-task rows are not flagged");
  assert(dn11[2].hrefs[0] === TASK_FOUND && dn11[2].hrefs[1] === res.GOAL, "11th: flag row links to the task + goal");
  assert(dn11[0].hrefs[0] === TASK_REC, "11th: 'Book the studio' links to Recording setup");
  assert(!/Template ghost done/.test(d11.done.text), "11th: Tasks/_templates/* excluded from Done too");

  // ---------------------------------------------------------------- empty day
  assert(!d01.planned.table && /Nothing planned for this day from your task notes\./.test(d01.planned.para),
    "empty day: Planned shows the spec empty-state message");
  assert(!d01.done.table && /Nothing logged for this day yet — check something off from the Dashboard\./.test(d01.done.para),
    "empty day: Done shows the spec empty-state message");
  assert(d01.done.sum === "", "empty day: no summary line when nothing matched");

  assert(!/error:/i.test(d12.planned.text + d12.done.text + d11.planned.text + d11.done.text),
    "no block printed its try/catch error paragraph");
  assert(errors.length === 0, "no uncaught page errors");
});
