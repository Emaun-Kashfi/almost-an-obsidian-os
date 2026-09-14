# Health by deadlines, not by elapsed time — CONTRACT (today = 2026-09-14)

Vault: the Storm Dashboard, built from `dev/` (one variant per `dev/<name>/variant.json`). Shared code must stay identical between variants.

## The bug, in the user's own data
Task "Lecture Pipeline": window Sep 9 → Sep 20, three sub-tasks due Sep 15, Sep 17 and Sep 20,
none done, today Sep 14. The shipped rule reads **Behind**, because it compares progress (0%)
against elapsed calendar time (5 of 11 days = 45.5%) and calls a 45-point gap Behind. Nothing is
due yet. By the user's own plan the task is exactly on schedule. The rule never reads the sub-task
deadlines at all, and on a three-item task progress can only move in 33-point steps, so finishing
one item tomorrow would still read At risk.

## The new rule
`healthOf` keeps its `done` and `paused` short-circuits and its `unscheduled` case. Replace the
elapsed-vs-progress comparison with deadlines:

    overdue = unchecked sub-tasks whose 📅 due date is strictly BEFORE today
              (due today is not overdue — it matches the chart's st-today state)

    if the item is done      -> "done"          (unchanged)
    if paused                -> "paused"        (unchanged)
    if no start AND no end   -> "unscheduled"   (unchanged)
    if end date < today and work remains -> "behind"
    else if overdue == 0     -> "ok"
    else if overdue == 1     -> "risk"
    else                     -> "behind"

**Fallback.** When NO sub-task carries a 📅 date there are no deadlines to measure, so keep the
existing elapsed-vs-progress comparison exactly as it is today (projected bars already assume even
pacing across the window, so pace is the only signal available). Decide the fork on whether any
sub-task has a due date, not on whether any is overdue.

**Goals** roll up the same way: a goal's `overdue` is the total overdue sub-tasks across its
non-paused tasks, run through the same thresholds, plus "goal `target` has passed and work
remains -> behind". A goal whose tasks have no dated sub-tasks anywhere falls back to elapsed
against the goal window.

Why this shape: `overdue` is a number the panels already compute and already print in the header
("2 overdue"), so the badge now explains itself with a figure that is on screen next to it. The old
rule's number appeared nowhere.

## Worked cases that must hold
- Lecture Pipeline as described -> **On track** (0 overdue).
- Same task on Sep 16 with nothing done -> **At risk** (Sep 15 overdue).
- Same task on Sep 18 with nothing done -> **Behind** (Sep 15 and Sep 17 overdue).
- Same task on Sep 21 with nothing done -> **Behind** (end date passed).
- A 30 sub-task goal with every sub-task undated -> unchanged from today's behaviour.
- A task whose sub-tasks are all due on its last day, checked the day before -> **On track**.
- A finished task whose dates have all passed -> **Done**, never Behind.

## Where it lives
`healthOf` is copied VERBATIM across these files and pinned by identity tests. Change every copy
identically, and keep them byte-identical to each other:

    dashboard/livedata.js · common/_scripts/goal-panel.js · common/_scripts/task-gantt.js
         common/Goals/🎯 Goals.md · common/Tasks/📋 Tasks.md

The signature has to carry the new input. `healthOf(status, progress, sIso, eIso)` becomes something
like `healthOf(status, progress, sIso, eIso, opts)` where `opts` supplies `overdue`, `dated`
(whether any sub-task has a due date) and `remaining` (unchecked count). Every call site must pass
it. A call site that cannot compute `overdue` is a bug: find where the sub-tasks are already being
walked and count there. `livedata.js` keeps its own older shape and is not in the byte-identity set,
but its behaviour must match exactly.

## Ripple effects to get right
- The dashboard's "Goals at risk" tile counts `risk` and `behind` goals. It will now count
  different goals. That is the point, but check the tile still reads sensibly.
- The 📋 Tasks board sorts and badges by health. The 🎯 Goals index sorts worst-health-first.
- The Timeline header already prints "N overdue"; make sure the badge and that number never
  disagree (0 overdue must never show Behind unless the end date has passed).
- The `⚡ Now` card's risk highlighting keys off goal health.
- Paused work is excluded from overdue counts already; keep it that way.

## Tests
- A new suite, or extend `tests/P`, covering every worked case above by asserting the badge text
  rendered in the harness, not by calling the function directly.
- Add the Lecture Pipeline fixture verbatim (window Sep 9 → Sep 20, three sub-tasks due Sep 15/17/20,
  none done) with `now` set to Sep 14, Sep 16, Sep 18 and Sep 21, and assert On track / At risk /
  Behind / Behind.
- Assert the undated fallback is byte-for-byte the old behaviour: build a fixture with no dated
  sub-tasks and check the badge matches what the current rule produces for it.
- Assert badge and header never disagree, across every fixture already in the suites.
- Every existing suite stays green: `A B1 B2 E G2 H P T V W`.
  Many of them pin health strings computed under the old rule. Each one
  you change, recompute by hand under the new rule and say in your report which fixture moved and
  why it is correct.
- `node dev/a11y/audit.js` still exits 0.

## Rules
- No device tools, no git, no deploying, no zip rebuilds. The orchestrator handles all of that.
- Screenshot a goal note and a task note under the new rule and look at them.
