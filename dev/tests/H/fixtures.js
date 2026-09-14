/* HEALTH contract — the worked cases, verbatim from the contract.

   "Lecture Pipeline": window Sep 9 → Sep 20, three sub-tasks due Sep 15 / 17 / 20,
   none done. On Sep 14 the shipped rule read Behind because it compared 0 % progress
   against 5/11 days of calendar time; nothing was due yet. The new rule reads the
   sub-task deadlines instead.

   Every note carries the real one-line dv.view call, so the fixture exercises the
   shipped _scripts files, not a copy.                                            */
const fs = require("fs");

const B = require("../build.js");
const FIN = B.VAULT();
const PANEL = fs.readFileSync(FIN + "/_scripts/goal-panel.js", "utf8");
const GANTT = fs.readFileSync(FIN + "/_scripts/task-gantt.js", "utf8");
const FENCE = "```";
const view = n => FENCE + 'dataviewjs\nconst p = "_scripts/' + n + '", f = x => app.metadataCache.getFirstLinkpathDest(x, "");\nif (f(p + ".js") || f(p + "/view.js")) await dv.view(p);\nelse dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.", { cls: "panel-err storm-missing-view" });\n' + FENCE;

const goalNote = (name, extra) =>
  `---\ntype: goal\nstatus: active\narea: Test\n${extra || ""}tags:\n  - goal\n---\n\n# ${name}\n\n${view("goal-panel")}\n`;

const taskNote = (name, fm, subs) =>
  `---\ntype: task\n${fm}tags:\n  - task\n---\n\n# ${name}\n\n## 📆 Timeline\n\n${view("task-gantt")}\n\n` +
  `## Sub-tasks\n${subs}\n\n## 🗒️ Notes\n`;

/* ── the contract's own fixture ───────────────────────────────────────────── */
const LECTURE = "Tasks/Lecture Pipeline.md";
const LECTURE_GOAL = "Goals/Lecture series.md";
const LECTURE_SUBS = [
  "- [ ] Record the lecture 📅 2026-09-15",
  "- [ ] Edit the audio 📅 2026-09-17",
  "- [ ] Publish the episode 📅 2026-09-20",
].join("\n");

/* ── the remaining worked cases ───────────────────────────────────────────── */
const LASTDAY = "Tasks/All due on the last day.md";       // checked the day before → On track
const FINISHED = "Tasks/Finished long ago.md";            // status done, every date passed
const UNDATED = "Tasks/Thirty undated steps.md";          // the elapsed-vs-progress fallback
const UNDATED_GOAL = "Goals/Undated goal.md";

const undatedSubs = (doneN, total) => {
  const out = [];
  for (let i = 1; i <= total; i++) out.push((i <= doneN ? "- [x] " : "- [ ] ") + "Step " + i);
  return out.join("\n");
};

function files() {
  return {
    "_scripts/goal-panel.js": PANEL,
    "_scripts/task-gantt.js": GANTT,
    "Dashboard.md": "---\ncssclasses:\n  - storm-home\ntags:\n  - dashboard\n---\n\n```dataviewjs\n```\n",
    "Goals/🎯 Goals.md": "---\ncssclasses:\n  - dashboard\ntags:\n  - dashboard\n---\n\n# 🎯 Goals\n",
    "Tasks/📋 Tasks.md": "---\ncssclasses:\n  - dashboard\ntags:\n  - dashboard\n---\n\n# 📋 Tasks\n",

    /* the goal holds ONLY this task, so the goal roll-up must track it exactly */
    [LECTURE_GOAL]: goalNote("Lecture series", "target: 2026-09-20\n"),
    [LECTURE]: taskNote("Lecture Pipeline",
      'goal: "[[Lecture series]]"\nstatus: active\nstart: 2026-09-09\nend: 2026-09-20\ncompleted:\n',
      LECTURE_SUBS),

    "Goals/Other work.md": goalNote("Other work", "target: 2026-12-31\n"),
    /* every sub-task due on the task's LAST day, all checked the day before */
    [LASTDAY]: taskNote("All due on the last day",
      'goal: "[[Other work]]"\nstatus: active\nstart: 2026-09-09\nend: 2026-09-20\ncompleted:\n',
      ["- [x] One 📅 2026-09-20 ✅ 2026-09-19",
       "- [x] Two 📅 2026-09-20 ✅ 2026-09-19",
       "- [x] Three 📅 2026-09-20 ✅ 2026-09-19"].join("\n")),

    /* finished, and every date on it is in the past */
    [FINISHED]: taskNote("Finished long ago",
      'goal: "[[Other work]]"\nstatus: done\nstart: 2026-01-01\nend: 2026-02-01\ncompleted: 2026-02-01\n',
      ["- [x] Alpha 📅 2026-01-10 ✅ 2026-01-09",
       "- [ ] Beta 📅 2026-01-20"].join("\n")),

    /* 30 sub-tasks, not one of them dated → the elapsed-vs-progress fallback */
    [UNDATED_GOAL]: goalNote("Undated goal", "target: 2026-12-31\n"),
    [UNDATED]: taskNote("Thirty undated steps",
      'goal: "[[Undated goal]]"\nstatus: active\nstart: 2026-01-01\nend: 2026-12-31\ncompleted:\n',
      undatedSubs(6, 30)),
  };
}

module.exports = { files, PANEL, GANTT, LECTURE, LECTURE_GOAL, LASTDAY, FINISHED,
                   UNDATED, UNDATED_GOAL, taskNote, goalNote, undatedSubs, view };
