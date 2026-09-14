/* Shared mock vault for the B1 (goal panel / goals index / tasks board) tests.
   Today is fixed at 2026-09-12 (Saturday) by the harness. */

const T = (fm, subs) => `---\n${fm}\n---\n\n# Task\n\n## Sub-tasks\n${subs}\n\n## 🗒️ Notes\n- \n`;

const files = {
  /* ── index notes (must NOT be picked up as goals/tasks: no `type`) ── */
  "Goals/🎯 Goals.md": "---\ncssclasses:\n  - dashboard\ntags:\n  - dashboard\n---\n\n# 🎯 Goals\n",
  "Tasks/📋 Tasks.md": "---\ncssclasses:\n  - dashboard\ntags:\n  - dashboard\n---\n\n# 📋 Tasks\n",

  /* ── goals ── */
  "Goals/Launch the app.md":
    "---\ntype: goal\nstatus: active\narea: Product\ntarget: 2026-12-31\ntags:\n  - goal\n---\n\n# Launch the app\n",
  "Goals/Learn TypeScript.md":
    "---\ntype: goal\nstatus: active\narea: Learning\ntarget: 2026-12-31\ntags:\n  - goal\n---\n\n# Learn TypeScript\n",
  "Goals/Home organization.md":
    "---\ntype: goal\nstatus: paused\narea: Home\ntarget:\ntags:\n  - goal\n---\n\n# Home organization\n",

  /* ── the five tasks that point at "Launch the app" ── */
  // 1. done, 3/3
  "Tasks/App foundations.md": T(
    'type: task\ngoal: "[[Launch the app]]"\nstatus: done\nstart: 2025-06-01\nend: 2026-08-31\ncompleted: 2026-08-31\ntags:\n  - task',
    "- [x] Name the show ✅ 2025-07-02\n- [x] Buy the mic ✅ 2025-08-14\n- [x] Cut the intro music ✅ 2026-08-31"
  ),
  // 2. active, 3/8, dated + undated subs
  "Tasks/Design pass.md": T(
    'type: task\ngoal: "[[Launch the app]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-10-15\ncompleted:\ntags:\n  - task',
    [
      "- [x] Outline the arc ✅ 2026-09-02",
      "- [x] Pick the theme ✅ 2026-09-03",
      "- [x] Draft the cold open ✅ 2026-09-05",
      "- [ ] Confirm the guest 📅 2026-09-18",
      "- [ ] Write the questions 📅 2026-09-16",
      "- [ ] Book the studio 📅 2026-10-01",
      "- [ ] Send the prep doc",
      "- [ ] Record a teaser"
    ].join("\n")
  ),
  // 3. active, 2/5, long name (tests label truncation), behind-ish window
  "Tasks/Cross-browser and mobile QA pass.md": T(
    'type: task\ngoal: "[[Launch the app]]"\nstatus: active\nstart: 2026-08-15\nend: 2026-09-30\ncompleted:\ntags:\n  - task',
    [
      "- [x] Set up the rig ✅ 2026-08-20",
      "- [x] Test the levels ✅ 2026-08-22",
      "- [ ] Record episode 1 📅 2026-09-10",
      "- [ ] Rough cut 📅 2026-09-25",
      "- [ ] Mix and master"
    ].join("\n")
  ),
  // 4. backlog, dated entirely in the future, 0/4
  "Tasks/Store listing.md": T(
    'type: task\ngoal: "[[Launch the app]]"\nstatus: backlog\nstart: 2026-11-01\nend: 2026-12-15\ncompleted:\ntags:\n  - task',
    [
      "- [ ] Pick a host 📅 2026-11-05",
      "- [ ] Set up the RSS feed",
      "- [ ] Submit to Apple",
      "- [ ] Submit to Spotify"
    ].join("\n")
  ),
  // 5. waiting, UNDATED (backlog lane), 1/3 — aliased wikilink form
  "Tasks/Cover art and branding.md": T(
    'type: task\ngoal: "[[Launch the app|the launch]]"\nstatus: waiting\nstart:\nend:\ncompleted:\ntags:\n  - task',
    "- [x] Shortlist designers ✅ 2026-09-01\n- [ ] Brief the designer\n- [ ] Approve the cover"
  ),

  /* ── a task pointing at a DIFFERENT goal: must be excluded from the panel ── */
  "Tasks/Other goal task.md": T(
    'type: task\ngoal: "[[Another goal]]"\nstatus: backlog\nstart:\nend:\ncompleted:\ntags:\n  - task',
    "- [ ] Something unrelated"
  ),

  /* ── tasks for the second goal (board + index coverage) ── */
  "Tasks/Convert one JS project.md": T(
    'type: task\ngoal: "[[Learn TypeScript]]"\nstatus: active\nstart: 2026-09-08\nend: 2026-10-20\ncompleted:\ntags:\n  - task',
    [
      "- [x] Rename files to .ts ✅ 2026-09-09",
      "- [x] Add a tsconfig ✅ 2026-09-10",
      "- [ ] Fix the type errors 📅 2026-09-14",
      "- [ ] Enable strict mode"
    ].join("\n")
  ),
  "Tasks/Set up tsconfig.md": T(
    'type: task\ngoal: "[[Learn TypeScript]]"\nstatus: done\nstart: 2026-09-01\nend: 2026-09-10\ncompleted: 2026-09-11\ntags:\n  - task',
    "- [x] Install typescript ✅ 2026-09-09\n- [x] Commit the config ✅ 2026-09-10"
  ),
  "Tasks/Declutter the office.md": T(
    'type: task\ngoal: "[[Home organization]]"\nstatus: waiting\nstart:\nend:\ncompleted:\ntags:\n  - task',
    "- [ ] Empty the desk drawers\n- [ ] Shred the old paperwork\n- [ ] Donate the spare monitor"
  ),

  /* ── exclusions: archived task note, and a Fitness note full of checkboxes ── */
  "Tasks/_archive/Old app task.md": T(
    'type: task\ngoal: "[[Launch the app]]"\nstatus: active\nstart: 2024-01-01\nend: 2024-02-01\ncompleted:\ntags:\n  - task',
    "- [ ] Ancient leftover"
  ),
  "Fitness/Leg day.md":
    "---\ntags:\n  - workout\n---\n\n# Leg day\n\n## Sets\n- [x] Squats 5x5\n- [ ] Lunges 3x12\n- [ ] Calf raises\n"
};

module.exports = { files };
