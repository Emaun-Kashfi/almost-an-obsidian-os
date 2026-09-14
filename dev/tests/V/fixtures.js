/* Agent V — synthetic table-driven fixtures. Every case exercises ONE rule from
   SPEC §1/§2 that all four implementations (dashboard, goal panel, 🎯 Goals index,
   📋 Tasks board) must answer identically. Today = 2026-09-12. */
const fs = require("fs");
/* CONTRACT A — the goal panel is ONE vault file; a note carries a one-line call.
   PANEL is that file's source (bare JS); VIEW_BLOCK is what the note holds. */
const B = require("../build.js");
const PANEL = fs.readFileSync(B.VAULT() + "/_scripts/goal-panel.js", "utf8");
const VIEW_BLOCK = '```dataviewjs\nconst p = "_scripts/' + 'goal-panel' + '", f = x => app.metadataCache.getFirstLinkpathDest(x, "");\nif (f(p + ".js") || f(p + "/view.js")) await dv.view(p);\nelse dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.", { cls: "panel-err storm-missing-view" });\n```';

const goal = (name, extra) =>
  `---\ntype: goal\nstatus: active\narea: Test\n${extra || ""}tags:\n  - goal\n---\n\n# ${name}\n\n## 🎯 Outcome\n\nx\n\n${VIEW_BLOCK}\n\n## 🗒️ Notes\n`;

const task = (fm, body) => `---\ntype: task\n${fm}tags:\n  - task\n---\n\n# t\n\n${body}\n`;

const files = {
  // the one file every goal note calls through dv.view
  "_scripts/goal-panel.js": PANEL,

  "Dashboard.md": "---\ncssclasses:\n  - storm-home\ntags:\n  - dashboard\n---\n\n```dataviewjs\n```\n",

  // ---------------- Alpha: sub-task selection + next move ----------------
  "Goals/Alpha.md": goal("Alpha", "target: 2026-12-31\n"),
  // 5 sub-tasks, 2 done, next move = the earliest DATED open one
  "Tasks/A1 plain.md": task('goal: "[[Alpha]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-10-15\ncompleted:\n',
    "## Sub-tasks\n- [x] Did one ✅ 2026-09-05\n- [x] Did two ✅ 2026-09-06\n- [ ] Later dated 📅 2026-09-18\n- [ ] Earlier dated 📅 2026-09-14\n- [ ] Undated tail\n\n## 🗒️ Notes\n- none"),
  // no `Sub-tasks` heading at all → every checkbox in the note counts
  "Tasks/A2 no heading.md": task('goal: "[[Alpha]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-10-15\ncompleted:\n',
    "Some prose.\n\n- [x] Loose done\n- [ ] Loose open one\n- [ ] Loose open two"),
  // blank box + #habit line are dropped from BOTH the count and the next move
  "Tasks/A3 habit and blank.md": task('goal: "[[Alpha]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-10-15\ncompleted:\n',
    "## Sub-tasks\n- [x] Real done\n- [ ] \n- [ ] 🏃 Move #habit/move\n- [ ] Real open\n\n## 🗒️ Notes"),

  // a `#habitat` tag is NOT a `#habit` tag — the two rules used to disagree here
  "Tasks/A4 habitat.md": task('goal: "[[Alpha]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-10-15\ncompleted:\n',
    "## Sub-tasks\n- [x] Filed the permit ✅ 2026-09-02\n- [ ] Survey the #habitat corridor"),

  // ---------------- Beta: heading spellings ----------------
  "Goals/Beta.md": goal("Beta"),
  "Tasks/B1 spaced heading.md": task('goal: "[[Beta]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-11-01\ncompleted:\n',
    "## Sub tasks\n- [x] One\n- [ ] Two\n- [ ] Three"),
  "Tasks/B2 singular heading.md": task('goal: "[[Beta]]"\nstatus: active\nstart: 2026-08-01\nend: 2026-11-01\ncompleted:\n',
    "### Subtask\n- [ ] Alpha step\n- [ ] Beta step"),
  // a checkbox outside the Sub-tasks section must NOT count when the section exists
  "Tasks/B3 other section.md": task('goal: "[[Beta]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-11-01\ncompleted:\n',
    "## Sub-tasks\n- [ ] The only sub-task\n\n## 🗒️ Notes\n- [x] A note checkbox\n- [ ] Another note checkbox"),

  // `## Sub tasks` + boxes in another section: the "no heading → use them all"
  // fallback must NOT fire, or the Notes checkboxes would be counted as sub-tasks
  "Tasks/B4 spaced heading with notes.md": task('goal: "[[Beta]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-11-01\ncompleted:\n',
    "## Sub tasks\n- [ ] Only this one\n\n## 🗒️ Notes\n- [x] A note checkbox\n- [ ] Another note checkbox"),

  // heading ANCESTRY: `## Sub-tasks` › `### Phase 1` items still count, and a later
  // `## 🗒️ Notes` closes the section (a `# Title` above everything must not break it)
  "Tasks/B5 nested phases.md": task('goal: "[[Beta]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-11-01\ncompleted:\n',
    "## Sub-tasks\n- [x] Kick-off\n\n### Phase 1\n- [ ] Phase one step 📅 2026-09-16\n\n### Phase 2\n- [ ] Phase two step\n\n## 🗒️ Notes\n- [ ] A note checkbox 📅 2026-09-16\n\n### Scratch\n- [x] Another note checkbox ✅ 2026-09-05"),
  // the Sub-tasks heading is itself nested under another section
  "Tasks/B6 nested subtasks heading.md": task('goal: "[[Beta]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-11-01\ncompleted:\n',
    "## Plan\n- [ ] Not a sub-task\n\n### Sub-tasks\n- [ ] Nested heading step\n- [x] Nested heading done\n\n## Wrap up\n- [ ] Also not a sub-task"),

  // ---------------- Gamma: statuses + missing dates ----------------
  "Goals/Gamma.md": goal("Gamma", "target: 2026-12-31\n"),
  "Tasks/G1 done.md": task('goal: "[[Gamma]]"\nstatus: done\nstart: 2026-08-01\nend: 2026-09-01\ncompleted: 2026-09-01\n',
    "## Sub-tasks\n- [x] a ✅ 2026-08-20\n- [x] b ✅ 2026-09-01"),
  "Tasks/G2 unscheduled.md": task('goal: "[[Gamma]]"\nstatus: active\nstart:\nend:\ncompleted:\n',
    "## Sub-tasks\n- [ ] Nothing scheduled"),
  "Tasks/G3 empty.md": task('goal: "[[Gamma]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-10-01\ncompleted:\n',
    "## Sub-tasks\n- [ ] \n\n## 🗒️ Notes"),

  // ---------------- Delta: every `goal:` link shape ----------------
  "Goals/Delta.md": goal("Delta", "target: 2026-12-31\n"),
  "Tasks/D1 bare name.md": task("goal: Delta\nstatus: active\nstart: 2026-09-01\nend: 2026-10-01\ncompleted:\n",
    "## Sub-tasks\n- [ ] bare"),
  "Tasks/D2 full path.md": task("goal: Goals/Delta.md\nstatus: active\nstart: 2026-06-01\nend: 2026-10-01\ncompleted:\n",
    "## Sub-tasks\n- [ ] path"),
  "Tasks/D3 array.md": task('goal:\n  - "[[Delta]]"\n  - "[[Nowhere]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-10-01\ncompleted:\n',
    "## Sub-tasks\n- [ ] array"),
};

/* what SPEC §1/§2 says the answer is — asserted against every implementation.
   health: clamp((today-start)/(end-start)) vs done/total, today = 2026-09-12. */
const EXPECT = {
  tasks: {
    "A1 plain":            { done: 2, total: 5, next: "Earlier dated",     nextDue: "2026-09-14", health: "ok" },
    "A2 no heading":       { done: 1, total: 3, next: "Loose open one",    nextDue: "", health: "ok" },
    "A3 habit and blank":  { done: 1, total: 2, next: "Real open",         nextDue: "", health: "ok" },
    "A4 habitat":          { done: 1, total: 2, next: "Survey the corridor", nextDue: "", health: "ok" },
    "B1 spaced heading":   { done: 1, total: 3, next: "Two",               nextDue: "", health: "ok" },
    "B2 singular heading": { done: 0, total: 2, next: "Alpha step",        nextDue: "", health: "behind" },
    "B3 other section":    { done: 0, total: 1, next: "The only sub-task", nextDue: "", health: "risk" },
    "B4 spaced heading with notes": { done: 0, total: 1, next: "Only this one", nextDue: "", health: "risk" },
    "B5 nested phases":    { done: 1, total: 3, next: "Phase one step",    nextDue: "2026-09-16", health: "ok" },
    "B6 nested subtasks heading": { done: 1, total: 2, next: "Nested heading step", nextDue: "", health: "ok" },
    "G1 done":             { done: 2, total: 2, next: "",                  nextDue: "", health: "done" },
    "G2 unscheduled":      { done: 0, total: 1, next: "Nothing scheduled", nextDue: "", health: "unscheduled" },
    "G3 empty":            { done: 0, total: 0, next: "",                  nextDue: "", health: "behind" },
    "D1 bare name":        { done: 0, total: 1, next: "bare",              nextDue: "", health: "behind" },
    "D2 full path":        { done: 0, total: 1, next: "path",              nextDue: "", health: "behind" },
    "D3 array":            { done: 0, total: 1, next: "array",             nextDue: "", health: "behind" },
  },
  goals: {
    // progress = Σdone/Σtotal over the goal's tasks; window = min(start) → target || max(end)
    Alpha: { done: 5, total: 12, nTasks: 4, pct: 42, health: "ok" },
    /* HEALTH contract — Beta's only dated sub-task is B5's "Phase one step 📅 2026-09-16",
       four days out on 2026-09-12, and its window runs to 2026-11-01: 0 overdue → ok.
       It read At risk under the old rule purely on pace (25% done vs 42/92 days). */
    Beta:  { done: 3, total: 12, nTasks: 6, pct: 25, health: "ok" },
    Gamma: { done: 2, total: 3,  nTasks: 3, pct: 67, health: "ok" },
    Delta: { done: 0, total: 3,  nTasks: 3, pct: 0,  health: "behind" },
  },
};

module.exports = { files, EXPECT, PANEL, VIEW_BLOCK };
