# Goal panel — design notes (Agent B1)

Files produced:

| File | What it is |
|---|---|
| `_scripts/goal-panel.js` | the panel itself — ONE file per vault, run by `dv.view` (SPEC §5, CONTRACT A). A goal note carries only the three-line guarded call (THEME2 §C): resolve `_scripts/goal-panel.js` (then `goal-panel/view.js`) the way Dataview does, `await dv.view(p)` when it is there, and a `.panel-err.storm-missing-view` div naming the file and pointing at sync when it is not. It is bare JS (a fence would be evaluated as code) and renders into `dv.container` — inside a view `this` is the global object. |
| `Goals/🎯 Goals.md` | goal index — `.goalsidx` of `.gi-card` |
| `Tasks/📋 Tasks.md` | task board — `.tasksboard` of four `.tb-col` |

All three are **self-contained**: each carries its own `esc / two / localIso / isoOf / dOf / dayDiff /
addDays / minIso / maxIso / fmtMD / clean / linkNames / linksTo / healthOf / subsOf` helpers, uses no
external libraries, and wraps everything in `try/catch` that prints a `.goal-err` div — so a broken
panel degrades to a visible message in the note, and a MISSING `_scripts/goal-panel.js` degrades to
Dataview's own "custom view not found" notice. Never a silent blank.

## Dates

* Every date is reduced to a local ISO string `YYYY-MM-DD` by `isoOf()`, which accepts a Dataview/Luxon
  `DateTime` (`.toISODate()`), a JS `Date`, or a plain string. Comparison is string comparison; arithmetic
  goes through `dayDiff(a,b)` = `Math.round(Δms / 86400000)` on local midnights, so DST never shifts a day.
* `todayIso = localIso(new Date())`.

## Task collection

`dv.pages('"Tasks"')` → `type === "task"` → not under `_templates` / `_archive` / `Archive` / `.trash`
→ `linksTo(p.goal, me)`.

`linksTo` normalises `p.goal` through `linkNames()`, which handles **all** of: a Dataview `Link`
object (`.path`), `"[[Name]]"`, `"[[Name|alias]]"`, a bare `Name`, a full `Goals/Name.md` path, and an
**array** of any of those. A candidate matches when it equals the goal's `file.path` or its basename
equals the goal's `file.name`.

**Sub-tasks** = checkbox lines under a heading matching `/sub[-\s]?tasks?/i`; if the note has no such
heading, *all* of its checkboxes are used (tolerant of hand-made notes). Lines carrying `#habit` and
lines whose cleaned text is empty (the template's blank `- [ ] ` box) are dropped.

`clean()` strips `📅 ⏳ 🛫 ✅ ➕ 🔁` + their dates, the priority emoji, and `#tags`, then collapses whitespace.

## Progress / health / next move (SPEC §2 — identical in all three notes)

* task progress = `done / total` sub-tasks (0 when there are none).
* goal progress = `Σdone / Σtotal` across its tasks; if no task has sub-tasks, `done tasks / total tasks`.
* goal window for health = `min(task.start)` → `goal.target || max(task.end)`.
* health is by DEADLINES (HEALTH contract): `overdue` = unchecked sub-tasks whose `📅` is
  strictly **before** today (due today is not overdue); a goal totals `overdue` across its
  **non-paused** tasks. `end < today` and work remains → `behind`; else `0 → ok`, `1 → risk`,
  `2+ → behind`. `status:done → done`, `status:paused → paused`, missing start **or** end →
  `unscheduled`. When **no** sub-task carries a `📅` there is no deadline to measure, so the
  old pacing rule stands unchanged: `elapsed = clamp((today-start)/(end-start), 0, 1)`,
  `gap = progress - elapsed`, `gap ≥ -0.10 → ok`, `≥ -0.30 → risk`, else `behind`.
  Labels: `On track / At risk / Behind / Done / Unscheduled / Paused`.
* next move = earliest **unchecked** sub-task by `📅`; if none is dated, the first unchecked one in
  document order (undated always sorts after dated).

## Gantt geometry

`viewBox="0 0 1000 H"`, `H = 40 (axis) + rows×26 + 16`, `preserveAspectRatio="xMinYMin meet"`,
`width="100%"` (a presentation attribute, so CSS still wins). Label column = 220 units, right pad 12,
so the plot area is `x ∈ [220, 988]`, `CW = 768`. Row `i` occupies `y ∈ [40+26i, 66+26i)`; its bar is
`y = 45+26i`, `height = 16`, `rx = 4`. Every `<text>` carries `font-size="12"` (≥ 11 as required) —
CSS may override it.

* **Window** = `min(task.start)` → `max(max(task.end), goal.target, today+7d)`, widened to at least
  **8 weeks (56 days)**. With no dated tasks it becomes `today → today+56d`. (For the *window only*, a
  one-sided task's `start` also counts toward the right edge so its bar can never fall off the chart;
  goal *health* still uses `goal.target || max(task.end)` exactly as SPEC §2 states.)
* `x(iso) = 220 + 768 × dayDiff(winStart, iso) / spanDays`, rounded to 2 decimals; bar width is
  `max(4, x(end) − x(start))`, `.g-fill` width is `barWidth × progress`.
* A task is a **row** when it has a start *or* an end (the missing one falls back to the other, so a
  one-sided task still draws a bar and simply reads `unscheduled` for health). A task with **neither**
  date goes to the `.g-backlog` chip lane instead and gets no row. Rows are sorted by start ascending.
* Month axis: a `.g-tick` at every month start inside the window plus a `.g-mon` label; the label is
  skipped every *n*th tick when months would be closer than 30 units apart. January labels carry the
  year (`Jan 2026`).
* `.g-label` truncates to 28 characters with `…`; the full name is on the text's `title` attribute and
  in the row's `<title>` tooltip (`Name · dates · d/t · health`).
* `.g-tasklist` repeats the chart order (rows by start, then the undated backlog tasks).

## Classes emitted (for Agent C)

Panel: `.goalpanel[data-paused]` (outer wrapper) › `.goalhead` › `.goal-hb.hb.<health>`, `.goal-prog`, `.goal-meta`,
`.pausebtn` | `.resumebtn`; then `.resumebar` (empty until ▶ Resume is pressed, then `.rb-q` +
`button[data-resume-do]` × 1–2 + `button[data-resume-cancel]`);
`.gantt-wrap` › `svg.gantt` › `.g-axis` (`.g-aline`, `.g-tick`, `.g-mon`), `g.g-row[data-status][data-health]`
(`.g-label`, `rect.g-bar.st-active|st-backlog|st-waiting|st-done`, `rect.g-fill`; `[data-paused]` when the
task is effective-paused), `line.g-today`;
`.g-backlog` › `.g-blabel`, `.g-chip.st-<status>`; `.g-tasklist` › `.g-task[data-health][data-paused]` ›
`.tchip.st-<status>`, `.g-tname`, `.g-tnext(.none)`, `.g-tdate(.none)`, `.g-tprog`; empty state `.g-empty`;
error `.goal-err`.

Index: `.goalsidx` (plus a trailing `.goalsidx.dim` for DONE goals, preceded by `.gi-sec`, and last of all
`details.goal-paused` › `summary` "Paused (n)" › `.goalsidx`, collapsed by default) ›
`.gi-card[data-health][data-status][data-paused]` › `.gi-top` (`.gi-name`, `.gi-area`), `.gi-mid` (`.hb.<health>`,
`.gi-bar` › `.gi-fill`, `.gi-pct`), `.gi-foot`, and on a paused row `.gi-acts` › `.resumebtn` then `.resumebar`;
empty `.gi-empty`.

Board: `.tasksboard` (five columns: backlog · active · waiting · paused · done) › `.tb-col[data-col]` ›
`.tb-head` (`.tb-n`), `.tb-card[data-status][data-paused]` › `.tb-row1`
(`.tb-name`), `.tb-row2` (`.tb-goal(.none)`, `.tb-dates(.none)`), `.tb-row3` (`.hb.<health>`, `.tb-prog`),
`.tb-next(.none)` (`.tb-due`); empty `.tb-empty`.

Anything with `data-link` is clickable → `app.workspace.openLinkText(path, "", false)`. `data-link` is
never nested inside another `data-link`, so a click opens exactly one note.

## Ambiguities resolved

1. **"Dated task"** — read as *has a start or an end*, not strictly both; the missing endpoint falls back
   to the other so the bar still draws. Only fully undated tasks go to the backlog lane.
2. **Done tasks** count toward the goal window and the goal's progress denominator (SPEC §2 says
   `min(task.start)` / `Σ` with no exclusion), so a goal that began in 2025 shows its whole history.
3. **Task-list order** mirrors the chart (start ascending, undated appended) rather than status, so the
   list reads as a legend for the bars.
4. **Window label** adds the year on both ends when the window spans more than one calendar year.
5. **Goals index next move** = the earliest next move among that goal's `active` tasks only (SPEC §1:
   only active tasks contribute next moves).
