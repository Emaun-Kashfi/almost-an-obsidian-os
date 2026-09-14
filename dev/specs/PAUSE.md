# Paused goals and tasks — CONTRACT v1 (today = 2026-09-13)

Problem: the system only understands `status: done`. Every other value falls through the same
health math, so a goal you are not working on keeps reporting **Behind** and its sub-tasks keep
surfacing as overdue next moves. The user's workaround was deleting `type: goal` to make the note
invisible. Replace that with a real paused state.

Applies to every vault this repo builds. Field names are identical in all of them.

## 1. The state

- **`status: paused`** on a goal note or a task note. Case-insensitive, trimmed.
- **`paused: YYYY-MM-DD`** — optional; the day it was paused. Written by the Pause button, used to
  offer a date shift on resume. Absent (someone typed the status by hand) → resume offers no shift.
- **Cascade is COMPUTED, never written.** A task's *effective* paused =
  `own status === "paused" || its goal's status === "paused"`. Pausing a goal must not rewrite its
  task notes. Expose it as a boolean on the task object (`paused`), set where goals already write
  `t.goalName / t.goalPath / t.goalHealth` back onto their tasks (`dashboard/livedata.js` ≈ line 225).
  A task with no goal is paused only by its own status.

## 2. Health

In **every** copy of `healthOf`, insert the paused branch immediately after the done branch:

```js
function healthOf(status, progress, sIso, eIso){
  if(String(status||"").toLowerCase()==="done") return "done";
  if(String(status||"").toLowerCase()==="paused") return "paused";
  ...
```

`HL` / `_HBL` gain `paused: "Paused"`. `HORDER` / `_HORDER` gain `paused: 5` (sorts last, after
`done: 4`). These helpers are copied VERBATIM across files and pinned by identity tests — change
**every** copy identically:

    dashboard/livedata.js · common/_scripts/goal-panel.js · common/_scripts/task-gantt.js
         common/Goals/🎯 Goals.md · common/Tasks/📋 Tasks.md

For a TASK the health input is its *effective* paused, so a task under a paused goal shows the
Paused badge on its own note without its file changing.

## 3. What goes quiet (the actual ask)

Effective-paused goals and tasks are excluded from:
- `livedata.js`: `activeTasks` (≈233) — the single chokepoint for `nextMoves` / `overdue` /
  `dueToday`; `strip.risk` (≈281) must also skip paused goals; `pulse.activeTasks` and
  `pulse.stale`.
- `buildHub.js`: `groupsSrc` and `orphan` (≈77–79) — the ⚡ Now card; the 🎯 Goals card rows
  (≈234, currently `.filter(gl => gl.status !== "done")` → also drop paused).
- `common/_scripts/daily-tables.txt`: **Planned today** skips paused tasks (it already skips
  `done` at ≈67). **Done today** is unchanged — work actually completed still counts.
- `common/🧹 Triage.md`: the "tasks without a goal / stale" style nags (≈172) skip paused.

Still visible (paused is not deletion):
- **🎯 Goals**: a `Paused (n)` group at the BOTTOM, collapsed by default (`<details>`), muted rows,
  each with a **▶ Resume** control. Active goals render exactly as today above it.
- **📋 Tasks**: a new `paused` column labelled **Paused**, placed between `waiting` and `done`.
  Only tasks paused by their OWN status appear there; cascade-paused ones stay under their goal's
  column but render muted (`.tb-card[data-paused]`).
- The goal's own note and the task's own note keep rendering their panels, with the Paused badge.

## 4. Pause / Resume controls

Pause (`⏸ Pause`) and resume (`▶ Resume`) appear in two places: the goal panel header on a goal
note (`_scripts/goal-panel.txt`) and each row of the 🎯 Goals index. Tasks get the same pair in the
task-note Timeline header (`_scripts/task-gantt.txt`) — pausing one task only.

- **Pause** writes `status: paused` and `paused: <today>` in one modify, then refreshes. Use a
  line-based frontmatter writer — `setFm(text, patch)` in `dashboard/initHub.js`
  into the panels rather than `processFrontMatter` (it reorders and reformats keys). Preserve the
  note's line endings. Never touch the body.
- **Resume** with a `paused:` date at least 1 day old renders an inline two-button confirm inside
  the panel (no modal, no `confirm()` — dialogs freeze the extension):
      Resume “<name>”? paused N days.  [ Shift remaining dates +Nd ]  [ Resume as-is ]  [ Cancel ]
  `N = dayDiff(paused, today)`.
  - **Resume as-is**: `status: active`, delete `paused:`. One file.
  - **Shift +Nd**: same, plus shift by N days — the goal's `target`; each cascade-resumed task's
    `start` and `end`; and on every **unchecked** sub-task of those tasks, each of `📅 🛫 ⏳`.
    Checked sub-tasks are never touched (their `✅` is a real historical date). A task with its OWN
    `status: paused` is NOT resumed and NOT shifted — it stays paused deliberately.
    One `vault.modify` per file; report `Resumed “X” — shifted 31 dates across 3 notes by 94 days.`
  - Resuming a TASK shifts only that task and its unchecked sub-tasks.
- All writes go through the same exact-match line resolution already used by the Timeline
  (`findLine`): never a substring match.

## 5. CSS (append to `common/storm-additions.css`)

`.hb.paused` — neutral/dim, clearly not an alarm colour, legible in dark and light. Muted rows:
`.gc-row[data-paused]`, `.g-row[data-paused]`, `.tb-card[data-paused]`, `.nm-row[data-paused]`
(~55% opacity, no accent). The Goals index paused group: `.goal-paused`, `.goal-paused summary`.
Pause/resume controls: `.pausebtn`, `.resumebtn`, `.resumebar`, `.resumebar button`. Reuse the
existing variables; `npx --yes csstree-validator` must report zero errors.

## 6. Tests (harness `dev/tests/lib.js`, `now: "2026-09-13T10:00:00"`)

New suite `tests/P/`. Fixtures and assertions:
1. Goal `status: paused` + 2 tasks, each with overdue + today + future sub-tasks → the ⚡ Now card
   shows none of them; `strip.nm/today/over/risk` all exclude them; `pulse.activeTasks` excludes
   them; the Goals dashboard card omits the goal; daily **Planned** omits it; **Done today** still
   lists a sub-task completed today; Triage omits it.
2. The same vault with the goal `active` → every one of those numbers is non-zero (proves the
   fixture would otherwise fire, and that nothing regressed for unpaused work).
3. A single task `status: paused` under an ACTIVE goal → that task is silent, its sibling task
   still shows its next move, the goal still reports its own health from the remaining work.
4. Badges: paused goal → `Paused`; its task's Timeline header → `Paused`; a task under it opened
   directly → `Paused` although its own frontmatter says `active`.
5. 🎯 Goals: paused goals appear only inside `details.goal-paused`, count in the summary is right,
   active goals are unaffected and still sorted worst-health-first.
6. 📋 Tasks: own-paused task lands in the Paused column; cascade-paused task stays in its column
   with `data-paused`.
7. Pause button → writes exactly `status: paused` + `paused: 2026-09-13`, one modify, body and every
   other frontmatter key byte-identical, CRLF preserved on a CRLF fixture.
8. Resume **as-is** → `status: active`, `paused` key gone, no date anywhere changed.
9. Resume **+Nd** (fixture paused 2026-06-15, so N = 90) → goal `target`, task `start`/`end`, and
   unchecked `📅 🛫 ⏳` all +90 days; a checked sub-task's `📅` and `✅` unchanged; an
   individually-paused task under that goal untouched and still paused; one modify per file; the
   notice text matches.
10. A goal paused by hand (no `paused:` key) → resume offers no shift, single button, works.
11. Regression: every existing suite stays green.

## 7. Out of scope
No quick-add `pause:` verb. No archive state. No auto-pause on inactivity.
