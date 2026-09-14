// Agent B2 — static checks on the Obsidian templates (specs/SPEC.md §4, §11).
// Every variant's daily note + Goal.md + Task.md. Pure node.
//
// These templates were originally derived from a vault that is not in this repo,
// and the checks used to diff against that vault's copy. The invariants that
// mattered are pinned here instead, as literals: the habit lines, the two
// Shutdown fields, and the fact that one Workout block is shared by every
// variant rather than re-typed per vault.
const fs = require("fs");
const { readFile, assert } = require("../lib.js");
const B = require("../build.js");

const VARIANTS = B.P.variants();
const GOALT = readFile(B.COMMON + "/_templates/Goal.md");
const TASKT = readFile(B.COMMON + "/_templates/Task.md");
const TABLES = readFile(B.COMMON + "/_scripts/daily-tables.txt");

const stripFences = s => s.replace(/```[\s\S]*?\n```/g, "");
const h2 = s => stripFences(s).split("\n").filter(l => /^##\s/.test(l)).map(l => l.replace(/^##\s+/, ""));
const fences = s => { const out = []; const re = /```dataviewjs\n([\s\S]*?)\n```/g; let m; while ((m = re.exec(s))) out.push(m[1]); return out; };
const habitLines = s => s.split("\n").filter(l => /#habit\//.test(l));
const navOf = s => s.split("\n").find(l => l.startsWith("[[Dashboard|"));
const sectionOf = (s, h) => { const a = s.split("\n## " + h + "\n"); return a.length > 1 ? a[1].split("\n## ")[0] : ""; };
// the ```…``` fence that directly follows a heading, byte for byte
const fencedAfter = (s, h) => {
  const ls = s.split("\n"); const i = ls.indexOf("## " + h); if (i < 0) return "";
  let a = i + 1; while (a < ls.length && ls[a].trim() === "") a++;
  if (!/^```/.test(ls[a])) return "";
  let b = a + 1; while (b < ls.length && ls[b] !== "```") b++;
  return ls.slice(a, b + 1).join("\n");
};

/* the two Shutdown prompts, exactly as the dashboard's shutdown writer looks for them */
const WIN_SRC = "**Win of the day:** ";
const NEXT_SRC = "**One next step on anything I touched:** ";

/* the Workout block is ONE block shared by every variant — the reference copy is
   the first variant's, and every other variant must match it byte for byte. */
const DAILY = Object.fromEntries(VARIANTS.map(v =>
  [v, readFile(B.VAULT(v) + "/_templates/Daily Note Template.md")]));
const WORKOUT_SRC = fencedAfter(DAILY[VARIANTS[0]], "🏋️ Workout");
assert(/dataviewjs/.test(WORKOUT_SRC) && WORKOUT_SRC.split("\n").length > 10,
  "the Workout ```dataviewjs block is present and non-trivial (" + WORKOUT_SRC.split("\n").length + " lines)");

/* the habit lines a fresh vault ships — generic by design (SPEC §11) */
const HABITS = [
  "- [ ] 🏃 Move / exercise #habit/move",
  "- [ ] 💧 Water #habit/water",
  "- [ ] 📖 Read #habit/read",
  "- [ ] 🧠 Learn something #habit/learn",
  "- [ ] 😴 Sleep prep #habit/sleep",
];

const inTxt = TABLES.split(/^<!-- SPLIT -->$/m).map(p => fences(p)[0]);
assert(inTxt.length === 2 && !!inTxt[0] && !!inTxt[1], "daily-tables.txt yields exactly two dataviewjs blocks");
assert(!fs.existsSync(B.COMMON + "/_templates/Daily Note Template.md"),
  "there is no shared daily template in common/ — each variant seeds its own");

const WANT = ["🎯 One thing", "⚡ Tasks", "📅 Planned today", "✅ Done today", "🔥 Habits", "🏋️ Workout", "📝 Notes", "🌙 Shutdown"];

function checkDaily(label, file) {
  console.log("— Daily Note Template · " + label + " —");
  const md = readFile(file);
  const lines = md.split("\n");

  // ---- frontmatter on line 1, rename line straight after the closing --- (SPEC §4)
  assert(lines[0] === "---", label + ": first line is ---");
  assert(!/^<%\*/.test(lines[0]), label + ": no Templater block before the frontmatter (duplicate-frontmatter bug fixed)");
  const close = lines.indexOf("---", 1);
  assert(close === 4, label + ": frontmatter closes on line 5 (date + tags only), got line " + (close + 1));
  assert(lines[1] === 'date: <% tp.date.now("YYYY-MM-DD") %>' && lines[2] === "tags:" && lines[3] === "  - daily",
    label + ": frontmatter is date + tags/- daily");
  assert(lines[close + 1] === '<%* await tp.file.rename(tp.date.now("YYYY-MM-DD") + " " + tp.date.now("dddd")) -%>',
    label + ": the Templater rename line is the line right after the closing ---");
  assert(md.includes('# <% tp.date.now("dddd, MMMM D") %>'), label + ": H1 is the Templater long date");

  // ---- the Tasks-plugin query is gone
  assert(!/```tasks/.test(md), label + ": no ```tasks block remains");
  assert(!/\*\*Due \/ scheduled today:\*\*/.test(md), label + ": the 'Due / scheduled today:' lead-in is gone");
  assert(!/##\s*⏭️ Upcoming|##\s*✅ Completed\b|##\s*✍️ Task Creator|##\s*📝 End of Day/.test(md),
    label + ": the old Upcoming / Completed / Task Creator / End of Day sections are gone");

  // ---- sections, in the SPEC §4 order
  const heads = h2(md);
  assert(JSON.stringify(heads) === JSON.stringify(WANT), label + ": sections are exactly " + WANT.join(" / ") + " (got " + heads.join(" / ") + ")");
  assert(heads.filter(x => x === "⚡ Tasks").length === 1, label + ": exactly one '## ⚡ Tasks' heading");
  assert(heads.indexOf("🏋️ Workout") < heads.indexOf("📝 Notes"),
    label + ": '## 🏋️ Workout' precedes '## 📝 Notes' (the dashboard's logWorkout anchor)");

  // ---- nav line: the ISO week number pairs with the ISO week-YEAR token. `YYYY-[W]WW`
  // mislabels the week across a year boundary (2026-12-28 is 2027-W01, not 2026-W01),
  // so the template must use GGGG and no copy may drift back.
  const nav = navOf(md);
  assert(!!nav && /\[\[Dashboard\|/.test(nav), label + ": the note carries a nav line back to the Dashboard");
  assert(/tp\.date\.now\("GGGG-\[W\]WW"\)/.test(nav),
    label + ": the nav line's week link uses the ISO week-year token — " + nav);
  assert(!/tp\.date\.now\("YYYY-\[W\]WW"\)/.test(md),
    label + ": no YYYY-[W]WW week token is left (ISO week numbers pair with GGGG)");

  // ---- One thing / ⚡ Tasks
  assert(/## 🎯 One thing\n>[^\n]*\n\n→ \n/.test(md), label + ": '## 🎯 One thing' keeps a blurb + the '→ ' line");
  const afterOne = md.split("## 🎯 One thing\n")[1];
  assert(afterOne.split("\n").findIndex(l => l.includes("→")) === 2,
    label + ": the first → after the One thing heading is the answer line (dashboard parses it)");
  const tasksSec = sectionOf(md, "⚡ Tasks");
  assert(/one-off/i.test(tasksSec) && /Tasks\//.test(tasksSec) && /📅/.test(tasksSec) && /Inbox/.test(tasksSec) && /7 days/.test(tasksSec),
    label + ": the ⚡ Tasks blurb covers one-offs / goal work in Tasks/ / 📅 / the 7-day Inbox");
  const blanks = lines.filter(l => /^- \[ \]\s*$/.test(l));
  assert(blanks.length === 1 && blanks[0] === "- [ ] ", label + ": exactly one blank '- [ ] ' box, with its trailing space");
  assert(/## ⚡ Tasks[\s\S]*?\n- \[ \] \n[\s\S]*?## 📅 Planned today/.test(md), label + ": the blank box sits inside ⚡ Tasks");

  // ---- habits: byte-identical to this vault's source (SPEC §11 — never change habit data)
  const got = habitLines(md);
  assert(JSON.stringify(got) === JSON.stringify(HABITS),
    label + ": the five generic habit lines, in order (got " + got.length + ")");
  assert(/## 🔥 Habits\n> /.test(md), label + ": the Habits blurb sits straight under the heading");

  // ---- workout block: ONE block, shared byte for byte by every variant
  assert(fencedAfter(md, "🏋️ Workout") === WORKOUT_SRC,
    label + ": the ```dataviewjs Workout block is string-identical in every variant");
  const woSec = sectionOf(md, "🏋️ Workout");
  assert(!/^\s*[-*]\s*\[/m.test(woSec), label + ": the Workout section holds no checkbox of its own (logWorkout appends them at the end of the section)");

  // ---- shutdown: the two bold fields, byte for byte
  assert(md.includes(WIN_SRC), label + ": Shutdown has **Win of the day:** verbatim");
  assert(md.includes(NEXT_SRC), label + ": Shutdown has **One next step on anything I touched:** verbatim");

  // ---- the two dynamic tables, inlined from _scripts/daily-tables.txt
  const blocks = fences(md);
  assert(blocks.length === 3, label + ": three ```dataviewjs blocks (Planned, Done, Workout) — got " + blocks.length);
  assert(blocks[0] === inTxt[0], label + ": the Planned block matches _scripts/daily-tables.txt exactly");
  assert(blocks[1] === inTxt[1], label + ": the Done block matches _scripts/daily-tables.txt exactly");
  assert(/## 📅 Planned today\n\n```dataviewjs/.test(md) && /## ✅ Done today\n\n```dataviewjs/.test(md),
    label + ": each new heading is followed by its dataviewjs block");
  assert(!blocks.some(b => /^\s*[-*]\s*\[.\]/m.test(b)),
    label + ": no line inside any dataviewjs block looks like a checkbox to Dataview");
}

for (const v of VARIANTS) checkDaily(v, B.VAULT(v) + "/_templates/Daily Note Template.md");

// SPEC §11 — nothing on the forbidden list reaches a shipped template. The terms
// come from dev/privacy/terms.json, the one place they are written down.
{
  const terms = JSON.parse(readFile(B.P.TERMS));
  const pats = Object.keys(terms)
    .filter(k => !k.startsWith("_") && k !== "notes" && Array.isArray(terms[k]))
    .flatMap(k => terms[k]);
  const rx = new RegExp(pats.join("|"), "i");
  for (const v of VARIANTS) {
    const hit = (DAILY[v] + "\n" + GOALT + "\n" + TASKT).match(rx);
    assert(!hit, v + ": the shipped templates carry none of the forbidden terms" +
      (hit ? " — found " + JSON.stringify(hit[0]) : " (" + pats.length + " patterns)"));
  }
}

console.log("— Goal.md —");
assert(/^<%\*\n/.test(GOALT), "goal: opens with a Templater <%* block (vault convention)");
assert(/const title = await tp\.system\.prompt\("Goal name"\);/.test(GOALT), 'goal: prompts "Goal name"');
assert(/if \(title\) \{ await tp\.file\.rename\(title\); \}/.test(GOALT), "goal: renames the note to the answer");
assert(/-%>\n---\ntype: goal\nstatus: active\narea: \ntarget: \ntags:\n  - goal\n---\n/.test(GOALT),
  "goal: frontmatter is type/status/area/target/tags per SPEC §1");
assert(GOALT.includes("# <% tp.file.title %>"), "goal: H1 is the note title");
assert(GOALT.includes("[[🎯 Goals|← Goals]]　·　[[Dashboard|Dashboard]]"), "goal: nav line");
assert(h2(GOALT).includes("🎯 Outcome") && h2(GOALT).includes("🗒️ Notes"), "goal: has ## 🎯 Outcome and ## 🗒️ Notes");
const markers = GOALT.split("\n").filter(l => l.trim() === "<!-- GOAL_PANEL -->");
assert(markers.length === 1, "goal: exactly one <!-- GOAL_PANEL --> marker line (got " + markers.length + ")");
assert(GOALT.indexOf("## 🎯 Outcome") < GOALT.indexOf("<!-- GOAL_PANEL -->") && GOALT.indexOf("<!-- GOAL_PANEL -->") < GOALT.indexOf("## 🗒️ Notes"),
  "goal: the panel marker sits between ## 🎯 Outcome and ## 🗒️ Notes");

console.log("— Task.md —");
assert(/const title = await tp\.system\.prompt\("Task name"\);/.test(TASKT), 'task: prompts "Task name"');
assert(/if \(title\) \{ await tp\.file\.rename\(title\); \}/.test(TASKT), "task: renames the note to the answer");
assert(/await tp\.system\.prompt\("Goal \(exact note name, optional\)"\)/.test(TASKT), 'task: prompts "Goal (exact note name, optional)"');
assert(/-%>\n---\ntype: task\n<% goalLine %>\nstatus: active\nstart: <% tp\.date\.now\("YYYY-MM-DD"\) %>\nend: \ncompleted: \ntags:\n  - task\n---\n/.test(TASKT),
  "task: frontmatter is type/goal/status:active/start:today/end/completed/tags per SPEC §1");
const head = TASKT.match(/^<%\*\n([\s\S]*?)\n-%>/)[1];
const runHead = async answers => {
  const tp = { system: { prompt: async () => answers.shift() }, file: { rename: async () => {} }, date: { now: () => "2026-09-12" } };
  return await new Function("tp", "return (async()=>{" + head + "\nreturn goalLine;})()")(tp);
};
runHead(["My task", "🧠 Learn TypeScript"]).then(withGoal => {
  assert(withGoal === 'goal: "[[🧠 Learn TypeScript]]"', 'task: an answered goal prompt writes goal: "[[<answer>]]" (got ' + withGoal + ")");
  return runHead(["My task", ""]);
}).then(noGoal => {
  assert(noGoal === "goal: ", "task: a blank goal prompt writes an empty 'goal: ' (got " + JSON.stringify(noGoal) + ")");
  return runHead(["My task", null]);
}).then(cancelled => {
  assert(cancelled === "goal: ", "task: a cancelled goal prompt writes an empty 'goal: '");

  assert(TASKT.includes("# <% tp.file.title %>"), "task: H1 is the note title");
  assert(TASKT.includes("[[🎯 Goals|← Goals]]　·　[[Dashboard|Dashboard]]"), "task: nav line");
  const callout = TASKT.split("\n").filter(l => l.startsWith("> "));
  assert(callout.length === 1 && /next move/i.test(callout[0]) && /📅/.test(callout[0]),
    "task: one callout line explaining the Dashboard next move + 📅 dates");
  const th = h2(TASKT);
  // §GANTT.md 1: the sub-task timeline sits in its own section immediately before ## Sub-tasks
  assert(JSON.stringify(th) === JSON.stringify(["📆 Timeline", "Sub-tasks", "🗒️ Notes"]),
    "task: sections are ## 📆 Timeline then ## Sub-tasks then ## 🗒️ Notes (got " + th.join(" / ") + ")");
  const tmarkers = TASKT.split("\n").filter(l => l.trim() === "<!-- TASK_GANTT -->");
  assert(tmarkers.length === 1, "task: exactly one <!-- TASK_GANTT --> marker line (got " + tmarkers.length + ")");
  assert(TASKT.indexOf("## 📆 Timeline") < TASKT.indexOf("<!-- TASK_GANTT -->") &&
         TASKT.indexOf("<!-- TASK_GANTT -->") < TASKT.indexOf("## Sub-tasks"),
    "task: the gantt marker sits between ## 📆 Timeline and ## Sub-tasks");
  assert(/\n## 📆 Timeline\n\n<!-- TASK_GANTT -->\n\n## Sub-tasks\n/.test(TASKT),
    "task: the Timeline section is heading + blank + marker + blank, directly above ## Sub-tasks");
  const tblanks = TASKT.split("\n").filter(l => /^- \[ \]\s*$/.test(l));
  assert(tblanks.length === 1 && tblanks[0] === "- [ ] ", "task: exactly one blank '- [ ] ' under ## Sub-tasks");
  assert(/## Sub-tasks\n\n- \[ \] \n/.test(TASKT), "task: the blank box sits under ## Sub-tasks");
}).catch(e => { console.log("FAIL: templates test threw — " + (e && e.message ? e.message : e)); process.exitCode = 1; });
