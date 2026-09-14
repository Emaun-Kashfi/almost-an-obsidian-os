# Task-level Gantt ("sub-task timeline") — CONTRACT v1

Goal: every task note gets an embedded Gantt of ITS sub-tasks, one row per sub-task, tied to the note's own checkbox lines (toggling in the chart edits the line). Templates and the Dashboard's `task:` creation must include it so new tasks get it automatically.

Work ONLY under `dev/`.

## 0. Shared component — `common/_scripts/task-gantt.js` (one file, shared by every vault)
A single fenced ```dataviewjs block, self-contained (own helpers), try/catch → `<div class="tg-err">`. Reads `dv.current()` (the task note). Field names are identical across vaults: frontmatter `start`, `end`, `status`; sub-tasks under a `Sub-tasks` heading.

### Sub-task discovery
Copy `subMarks()` / `subsOf()` / `clean()` VERBATIM from `dev/common/_scripts/goal-panel.js` (heading-ancestor aware `/sub[-\s]?tasks?/i`; fallback all checkboxes when no such heading; blank boxes and `#habit` lines excluded). For each sub-task collect: `text` (cleaned), `line`, `done`, `due` (📅 → `t.due`), `start` (🛫 → `t.start`), `sched` (⏳ → `t.scheduled`), `completion` (✅ → `t.completion`), `group` = nearest preceding non-checkbox line inside the Sub-tasks section that is bold-only (`**…**`) or a `###`/`####` heading (read the note text for this; Dataview does not expose it).

### Dates and bars (all ISO local dates; `dv.date(x).toISODate()`)
- `barEnd = due`. `barStart = start || sched || prevDue || task.start || (due − 7 days)`, where `prevDue` = the due date of the nearest PRECEDING sub-task (document order) that has a due. If `barStart >= barEnd` → `barStart = barEnd − 1 day`. Minimum drawn width 6 viewBox units.
- Sub-task with `start` but no `due` → a milestone marker at `start`. No `due` and no `start` → **backlog chip** (below the chart), still toggleable.
- Row order = document order (the note's sequence is the plan). Group labels render as thin separator rows (`.tg-group`) in place.
- Window: `min(task.start, earliest barStart) − 3d` → `max(task.end, latest due, latest completion, today) + 3d`; minimum span 14 days. Task window (start→end) drawn as a shaded band `.tg-window` behind rows when both dates exist.
- Axis: weekly ticks on Mondays labelled `Sep 15` when span ≤ 16 weeks, else monthly ticks labelled `Oct 2026`. Today = `line.tg-today`.
- Bar state class: `st-done` (checked; also draw `.tg-done-mark` at `completion` if present), `st-over` (unchecked, due < today), `st-today` (due == today), `st-open` (future). Milestones: `.tg-milestone` polygon.

### Render (SVG inside `<div class="tgantt">`)
- Header `.tg-head`: health badge `.hb.<ok|risk|behind|done|unscheduled>` (formula = the Storm rule: elapsed vs progress from task `start`/`end`; copy `health()` from goal-panel.txt), then `n/N done · N overdue · window Sep 1 – Oct 15 · next: <first unchecked by date, else doc order> 📅 <date>`.
- `svg.tg-svg viewBox="0 0 1000 H"`, `preserveAspectRatio="xMinYMin meet"`, H = 34 (axis) + rows×26 + groups×18 + 14. Label column 250. For each sub-task row: `<g class="tg-row" data-line="<line>">` containing `<g class="tg-box[ done]" data-toggle-line="<line>">` (12×12 rounded rect + check path when done) at x=8, `<text class="tg-label">` (truncate 30 chars, `<title>` full) at x=26, `<rect class="tg-bar st-…">` from barStart to barEnd, `<text class="tg-due">Sep 18</text>` just after the bar end (or inside when near the right edge), optional `.tg-done-mark`.
- Backlog: `<div class="tg-backlog">` of `<span class="tg-chip" data-toggle-line>` (checkbox glyph + text).
- Add row `.tg-add`: `<input class="tg-in" placeholder="Add a sub-task…">` `<input type="date" class="tg-date">` `<button class="tg-addbtn">＋</button>` → appends `- [ ] <text>[ 📅 <date>]` at the end of the `## Sub-tasks` section (before the next heading, else EOF; create the section if missing), then refresh.
- Empty state `.tg-empty`: "No sub-tasks yet — add the first one below."
- Toggle: click `.tg-box`/`.tg-chip` → read the file, find the exact line (verify it is a checkbox; fall back to matching by normalized text), flip `[ ]`↔`[x]`, add ` ✅ YYYY-MM-DD` when checking (before a trailing `^block-id` if present) / strip it when unchecking, `app.vault.modify`, then `app.metadataCache.trigger("dataview:refresh-views")`.
- No external libs; no `dv.table`. Everything variable-driven for CSS.

### CSS — `task-gantt.css` (appended to storm.css in every vault)
Style: `.tgantt .tg-head .tg-hb .tg-svg .tg-window .tg-axis .tg-tick(.month) .tg-row(:hover) .tg-group .tg-box(.done) .tg-label .tg-bar.st-open/.st-today/.st-over/.st-done .tg-milestone .tg-due .tg-done-mark .tg-today .tg-backlog .tg-chip(.done) .tg-add .tg-in .tg-date .tg-addbtn .tg-empty .tg-err`, using the storm variables (`--bg --surface --surface2 --text --dim --faint --accent --accent2 --accent-deep --border --border2 --good --warm`) with a local palette declaration on `.tgantt` (same pattern as `.goalpanel`/`.mprep` in `common/storm-additions-work.css`) so it renders in plain notes. SVG text uses `fill`. Dark and light (`body.theme-light`) both legible. Validate with `npx --yes csstree-validator`.

### Placement in notes
A section `## 📆 Timeline` containing the block, placed immediately BEFORE the `## Sub-tasks` heading (after any Brief/callout). Injector `inject_task_gantt.py <note.md>…`: idempotent (skips notes already containing `class="tgantt"` or a `## 📆 Timeline` heading), inserts the section before the first `Sub-tasks` heading (heading-ancestor aware: the `##`/`###` line whose text matches `/sub[-\s]?tasks?/i`), else appends before `## 🗒️ Notes`/EOF. Prints a per-file result.

## 1. Every Storm vault
- `_templates/Task.md` (both variants share one) gains the `## 📆 Timeline` section (the block inline) before `## Sub-tasks`.
- Dashboard `task:` route: the created note body gains `## 📆 Timeline` + the three-line guarded `dv.view("_scripts/task-gantt")` call (CONTRACT A), never a pasted block.
- CSS appended to `dev/common/storm-additions.css` (integrate.py builds storm.css from it).
- Existing task notes in somebody's own vault: run `dev/tools/inject_task_gantt.py` over them once; it is idempotent.

## 3. Tests (harness: `dev/tests/lib.js`)
Fixtures: (a) a task with 8 sub-tasks: two done with ✅, one overdue, one due today (2026-09-13), one with 🛫 start, two undated, one bold group header between; frontmatter start 2026-09-01 end 2026-10-15; (b) a task with no dates anywhere; (c) an empty Sub-tasks section; (d) sub-tasks under `### Phase 1` nested in `## Sub-tasks`; (e) a note with no Sub-tasks heading (fallback). Assert: row count = dated subs; backlog chips = undated; bar start per rule for each row (prevDue chain, 🛫 override, task.start fallback, due−7d fallback, start≥end clamp); window bounds and tick count; state classes; today line x; done marks; group separators; health badge; toggle writes `[x] … ✅ 2026-09-13` and unchecking strips it; block-id safety; add appends the right line in the right place and creates the section when missing; empty state; no error div for all fixtures; SVG viewBox height formula.

Today for tests: 2026-09-13.
