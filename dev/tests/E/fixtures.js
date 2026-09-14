/* Shared mock vault for the 🧹 Triage tests (Agent E).
   Today = 2026-09-12 (Saturday). Ages: 09-09 = 3d, 08-23 = 20d, 08-13 = 30d, 07-24 = 50d. */

const NEW_DAILY = [
  "---",
  "date: 2026-09-09",
  "tags:",
  "  - daily",
  "---",
  "",
  "# Wednesday, September 9",
  "",
  "[[Dashboard|← Dashboard]]",
  "",
  "## 🎯 One thing",
  "→ Finish the outline",
  "",
  "## ⚡ Tasks",
  "- [ ] Email the studio about rates 📅 2026-09-15",
  "- [ ] Book the dentist",
  "- [ ] ",
  "",
  "## 🔥 Habits",
  "- [ ] 💧 Drink water #habit/water",
  "- [x] 📖 Read ten pages #habit/read",
  "",
  "## 🏋️ Workout",
  "- [ ] Push day at the gym",
  "",
  "## 📝 Notes",
  "- [ ] Look up that studio mic ✅ 2026-09-10",
  "",
  "## 🌙 Shutdown",
  "**Win of the day:** shipped the outline",
  "**One next step on anything I touched:** ",
  ""
].join("\n");

const OLD_DAILY = [
  "---",
  "date: 2026-08-23",
  "tags:",
  "  - daily",
  "---",
  "",
  "# Sunday, August 23",
  "",
  "## 📅 Today's Tasks",
  "- [ ] Call the bank about the transfer",
  "- [ ] ",
  "- [x] Renew the parking permit",
  "",
  "## Upcoming",
  "- [ ] Draft the newsletter 📅 2026-08-30",
  "",
  "## ✅ Completed",
  "- [ ] Old thing that was already handled",
  "",
  "## 📊 Habit Tracker",
  "- [ ] Drink enough water",
  "- [ ] Read 10 pages",
  "",
  "## 🛫 Task Backlog",
  "- [ ] Sort out the storage unit",
  "",
  "## 💭 Daily Reflection",
  "- [ ] Reflect on how the week went",
  ""
].join("\n");

const ANCIENT_DAILY = [
  "---",
  "date: 2026-07-24",
  "tags:",
  "  - daily",
  "---",
  "",
  "## 📅 Today's Tasks",
  "- [ ] Ancient loose end from July",
  ""
].join("\n");

// 30 days old — only used by the bulk-drop test
const MID_DAILY = [
  "---",
  "date: 2026-08-13",
  "tags:",
  "  - daily",
  "---",
  "",
  "## 📅 Today's Tasks",
  "- [ ] Chase the insurance refund",
  "- [ ] ",
  "",
  "## 🛫 Task Backlog",
  "- [ ] Replace the kitchen bulb",
  ""
].join("\n");

const NOTE_BANK = [
  "---",
  "tags:",
  "  - note",
  "type: note",
  "status: inbox",
  "---",
  "",
  "# Mic research",
  "",
  "Notes from a rabbit hole.",
  "",
  "- [ ] Compare the SM7B and the MV7",
  ""
].join("\n");

const FITNESS = [
  "---",
  "type: routine",
  "---",
  "",
  "# Push routine",
  "",
  "- [ ] Bench press 3x5",
  ""
].join("\n");

const GOAL = [
  "---",
  "type: goal",
  "status: active",
  "area: Product",
  "target: 2026-12-31",
  "tags:",
  "  - goal",
  "---",
  "",
  "# 🚀 Launch the app",
  ""
].join("\n");

const TASK_ACTIVE = [
  "---",
  "type: task",
  'goal: "[[🚀 Launch the app]]"',
  "status: active",
  "start: 2026-09-01",
  "end: 2026-10-15",
  "tags:",
  "  - task",
  "---",
  "",
  "# Design pass",
  "",
  "## Sub-tasks",
  "- [ ] Draft the arc 📅 2026-09-18",
  "- [x] Write the pitch ✅ 2026-09-11",
  "",
  "## 🗒️ Notes",
  "Loose thoughts.",
  ""
].join("\n");

const TASK_BACKLOG = [
  "---",
  "type: task",
  'goal: "[[🚀 Launch the app]]"',
  "status: backlog",
  "start: 2026-11-15",
  "end: 2026-12-15",
  "tags:",
  "  - task",
  "---",
  "",
  "# Store listing",
  "",
  "## Sub-tasks",
  "- [ ] Register the RSS feed",
  "- [ ] Pick a host",
  "",
  "## 🗒️ Notes",
  "Loose thoughts.",
  ""
].join("\n");

const TASK_DONE = [
  "---",
  "type: task",
  'goal: "[[🚀 Launch the app]]"',
  "status: done",
  "completed: 2026-08-31",
  "tags:",
  "  - task",
  "---",
  "",
  "# App foundations",
  "",
  "## Sub-tasks",
  "- [x] Pick the name ✅ 2026-08-31",
  ""
].join("\n");

// today's note is deliberately ABSENT — "→ Inbox" must run the daily-notes command
const TODAY_TEMPLATE = [
  "---",
  "date: 2026-09-12",
  "tags:",
  "  - daily",
  "---",
  "",
  "# Saturday, September 12",
  "",
  "## 🎯 One thing",
  "→ ",
  "",
  "## ⚡ Tasks",
  "- [ ] ",
  "",
  "## 🔥 Habits",
  "- [ ] 💧 Drink water #habit/water",
  ""
].join("\n");

const files = {
  "Dashboard.md": "---\ncssclasses:\n  - storm-home\ntags:\n  - dashboard\n---\n",
  "🧹 Triage.md": "---\ncssclasses:\n  - dashboard\ntags:\n  - dashboard\n---\n",
  "Daily/2026-09-09 Wednesday.md": NEW_DAILY,
  "Daily/2026-08-23 Sunday.md": OLD_DAILY,
  "Daily/2026-07-24 Friday.md": ANCIENT_DAILY,
  "Note Bank/Mic research.md": NOTE_BANK,
  "Fitness/Push routine.md": FITNESS,
  "Goals/🚀 Launch the app.md": GOAL,
  "Tasks/Design pass.md": TASK_ACTIVE,
  "Tasks/Store listing.md": TASK_BACKLOG,
  "Tasks/App foundations.md": TASK_DONE
};

const MID_PATH = "Daily/2026-08-13 Thursday.md";

module.exports = { files, MID_DAILY, MID_PATH, TODAY_TEMPLATE, TODAY_PATH: "Daily/2026-09-12 Saturday.md" };
