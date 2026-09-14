/* Shared mock vault for the Agent-A dashboard tests.
   Today = 2026-09-12 (Saturday). Monday of this week = 2026-09-07. */

const DASH_FM_PERSONAL =
  "---\ncssclasses:\n  - storm-home\n  - max\ntags:\n  - dashboard\nstormMode: community\n---\n\n";

const GOAL_A = "Goals/🚀 Launch the app.md";
const GOAL_B = "Goals/🧠 Learn TypeScript.md";
const T_STORY = "Tasks/Design pass — Screen 1.md";
const T_CONVERT = "Tasks/Convert one JS project to TS.md";     // active, ALL sub-tasks done
const T_BACKLOG = "Tasks/Launch on a custom domain.md";        // backlog
const T_DONE = "Tasks/App foundations.md";                 // done
const T_TYPED = "Tasks/Build a small typed app.md";            // active, only undated sub-tasks
const TODAY_NOTE = "Daily/2026-09-12 Saturday.md";
const OLD_NOTE = "Daily/2026-09-03 Thursday.md";

const DAILY_TEMPLATE =
`---
date: <% tp.date.now("YYYY-MM-DD") %>
tags:
  - daily
---

# Day

## 🎯 One thing

→

## ⚡ Tasks

- [ ]

## 🔥 Habits

- [ ] 🏃 Move #habit/move
- [ ] 💧 Water #habit/water
- [ ] 📖 Read #habit/read

## 🌙 Shutdown

**Win of the day:**

**One next step on anything I touched:**
`;

const TODAY_BODY =
`---
date: 2026-09-12
tags:
  - daily
---

# Saturday, September 12

## 🎯 One thing

→ Ship episode one

## ⚡ Tasks

- [ ] Call the dentist
- [ ] Pay the invoice 📅 2026-09-12
- [ ]
- [x] Already filed the receipts ✅ 2026-09-12
- [ ] 🏃 Move #habit/move

## 🔥 Habits

- [x] 🏃 Move #habit/move ✅ 2026-09-12
- [x] 💧 Water #habit/water ✅ 2026-09-12
- [ ] 📖 Read #habit/read

## 🌙 Shutdown

**Win of the day:**

**One next step on anything I touched:**
`;

function files(opts){
  opts = opts || {};
  const f = {
    "Dashboard.md": (opts.dashFm || DASH_FM_PERSONAL) + "```dataviewjs\n```\n",

    [GOAL_A]:
`---
type: goal
status: active
area: Product
target: 2026-12-31
tags:
  - goal
---

# 🚀 Launch the app

## 🎯 Outcome

Episode one published.
`,
    [GOAL_B]:
`---
type: goal
status: active
area: Learning
target: 2026-09-30
tags:
  - goal
---

# 🧠 Learn TypeScript
`,

    // active — dated + undated sub-tasks, one overdue next move, one more overdue, one due today
    [T_STORY]:
`---
type: task
goal: "[[🚀 Launch the app]]"
status: active
start: 2026-09-01
end: 2026-10-15
completed:
tags:
  - task
---

# Design pass — Screen 1

## Sub-tasks
- [x] Outline the arc 📅 2026-09-05 ✅ 2026-09-08
- [ ] Send the brief 📅 2026-09-08
- [ ] Confirm guest 📅 2026-09-10
- [ ] Draft questions 📅 2026-09-12
- [ ] Record intro

## 🗒️ Notes
- nothing yet
`,

    // active — every sub-task done → "mark task complete" nudge
    [T_CONVERT]:
`---
type: task
goal: "[[🧠 Learn TypeScript]]"
status: active
start: 2026-09-01
end: 2026-09-20
completed:
tags:
  - task
---

# Convert one JS project to TS

## Sub-tasks
- [x] Add tsconfig 📅 2026-09-08 ✅ 2026-09-08
- [x] Rename the entry point ✅ 2026-09-10

## 🗒️ Notes
`,

    // backlog — its overdue sub-task must NOT reach the dashboard
    [T_BACKLOG]:
`---
type: task
goal: "[[🧠 Learn TypeScript]]"
status: backlog
start: 2026-09-08
end: 2026-11-30
completed:
tags:
  - task
---

# Launch on a custom domain

## Sub-tasks
- [ ] Buy the domain 📅 2026-09-02
- [ ] Point the DNS 📅 2026-09-12
`,

    // done
    [T_DONE]:
`---
type: task
goal: "[[🚀 Launch the app]]"
status: done
start: 2025-06-01
end: 2026-08-31
completed: 2026-08-31
tags:
  - task
---

# App foundations

## Sub-tasks
- [x] Name the show ✅ 2026-07-02
- [x] Buy the mic ✅ 2026-08-01
- [x] Book the studio ✅ 2026-08-31
`,

    // active — only undated unchecked sub-tasks (next-move fallback)
    [T_TYPED]:
`---
type: task
goal: "[[🧠 Learn TypeScript]]"
status: active
start: 2026-09-05
end: 2026-11-15
completed:
tags:
  - task
---

# Build a small typed app

## Sub-tasks
- [x] Sketch the API ✅ 2026-09-11
- [ ] Pick a framework

## 🗒️ Notes
`,

    "Daily/2026-09-11 Friday.md":
`---
date: 2026-09-11
tags:
  - daily
---

## ⚡ Tasks

- [ ] Email the sponsor

## 🔥 Habits

- [x] 💧 Water #habit/water ✅ 2026-09-11
`,

    // 9 days old — its ⚡ items must be ignored
    [OLD_NOTE]:
`---
date: 2026-09-03
tags:
  - daily
---

## ⚡ Tasks

- [ ] Ancient forgotten errand

## 🔥 Habits

- [x] 💧 Water #habit/water ✅ 2026-09-03
`,

    // never scanned: Fitness routine checkboxes
    "Fitness/Push Day.md":
`---
type: routine
icon: 🏋️
---

# Push Day

## Session
- [ ] Bench press 5x5 📅 2026-09-10
- [ ] Overhead press 3x8
`,

    "_templates/Daily Note Template.md": DAILY_TEMPLATE,
    "_templates/Task.md": "---\ntype: task\nstatus: active\ntags:\n  - task\n---\n\n## Sub-tasks\n- [ ] Template placeholder 📅 2026-09-01\n",

    "🏋️ Workouts.md": "---\nschedule:\n  Saturday: Rest\n---\n\n# Workouts\n",
    "Reading/Deep Work.md": "---\ntags:\n  - book\ntitle: Deep Work\nauthor: Cal Newport\nstatus: reading\nprogress: 70\n---\n",
    "Note Bank/Interview questions.md": "---\ntype: note\n---\n\n# Interview questions\n",
    "Job Search/Applications/Acme — Editor.md": "---\ntags:\n  - application\ncompany: Acme\nrole: Editor\nstatus: applied\ndeadline: 2026-09-30\n---\n",
    "🎧 Now Playing.md": "---\ntags:\n  - music\n---\n",
  };
  if(!opts.noToday) f[TODAY_NOTE] = TODAY_BODY;
  return f;
}

const RESOLVED_LINKS = {
  "Dashboard.md": { [GOAL_A]: 1, [GOAL_B]: 1 },
  [GOAL_A]: { "Dashboard.md": 1, [T_STORY]: 1, [T_DONE]: 1 },
  [GOAL_B]: { "Dashboard.md": 1, [T_CONVERT]: 1, [T_TYPED]: 1, [T_BACKLOG]: 1 },
  [T_STORY]: { [GOAL_A]: 1 },
  [T_DONE]: { [GOAL_A]: 1 },
};

module.exports = {
  files, RESOLVED_LINKS, DAILY_TEMPLATE, TODAY_BODY, DASH_FM_PERSONAL,
  GOAL_A, GOAL_B, T_STORY, T_CONVERT, T_BACKLOG, T_DONE, T_TYPED, TODAY_NOTE, OLD_NOTE,
};
