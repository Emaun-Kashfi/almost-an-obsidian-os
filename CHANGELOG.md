# Changelog

All notable changes to this vault are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Versions
describe the vault, not the third-party plugins it depends on.

## [2.0.0] - 2026-09-14

This release replaces the projects board with a goals system, gives every task note
its own timeline, adds a paused state, extends the dashboard theme to the whole vault,
and brings every surface up to WCAG AA contrast.

### Added

- **Goals, tasks, and sub-tasks.** A goal is an outcome with an area and a target date.
  A task is one chunk of work assigned to a goal, with its own start and end dates. A
  sub-task is a checkbox inside a task note. New folders `Goals/` and `Tasks/`, new
  `Goal` and `Task` templates, and two index notes: `🎯 Goals` and `📋 Tasks`.
- **A Gantt chart on every goal note.** Each goal note draws its tasks as bars across
  the goal's window, colored by health, with a progress split on each bar.
- **A 📆 Timeline on every task note.** The timeline draws one row per sub-task. A bar
  runs from the previous sub-task's `📅` deadline to its own. Add `🛫 YYYY-MM-DD` to a
  sub-task to pin an explicit start. A sub-task with `🛫` and no `📅` becomes a milestone.
- **Projected bars.** When a task has both a start and an end date, undated sub-tasks
  spread evenly across that window as dashed bars. Click one to write its projected date
  into the line as a real `📅` date.
- **Click to check off.** Clicking a box in the chart ticks that checkbox in the note and
  stamps it with today's `✅` date. Clicking again removes the date. A `＋` row at the
  bottom adds a sub-task without leaving the chart.
- **A next-move card.** The dashboard's ⚡ Now card lists each active task's next move,
  which is the earliest dated sub-task still open, grouped under its goal.
- **A paused state.** Set `status: paused` on a goal and it leaves the dashboard. Its
  tasks stop producing next moves, overdue counts, daily-note rows, and health warnings.
  Nothing is deleted. The goal moves to a collapsed **Paused** group at the bottom of
  `🎯 Goals`. A single task can be paused on its own. Resuming offers to shift every
  remaining date forward by however long the work sat paused, so a three-month pause does
  not resume three months behind. Completed sub-tasks keep their real `✅` dates.
- **Planned and Done tables in daily notes.** Both tables read from task notes, so the
  daily note reflects the plan without duplicating it.
- **A `🧹 Triage` note** for checkbox items captured in daily notes that do not belong to
  a task yet.
- **A vault-wide theme file.** `.obsidian/snippets/storm-theme.css` carries the palette
  chosen in the dashboard's ⚙️ Settings.
- **Shared panel scripts.** `_scripts/goal-panel.js` and `_scripts/task-gantt.js`.

### Changed

- **Panels load from one file.** Goal and task notes call `await dv.view("_scripts/goal-panel")`
  instead of carrying a pasted copy of the panel code. Notes drop from roughly 35 KB to
  under 1 KB, and an update to a panel reaches every note at once.
- **The theme now paints the whole vault.** Previously the palette derived from the banner
  image stopped at the edge of the dashboard, and every other note kept the built-in blue.
  Every palette token in `storm.css` now reads `var(--storm-*, <default>)`, and the
  dashboard writes those values to `storm-theme.css` whenever the theme changes. Goal notes,
  task notes, the indexes, triage, and the daily tables all follow the same palette. A vault
  without that file renders exactly as before.
- **`.obsidian/appearance.json`** enables the new `storm-theme` snippet alongside `storm`
  and `dashboard`.
- **`🧭 START HERE.md`** documents goals, tasks, and sub-tasks in place of the projects board.
- **`⚙️ Settings.md`** shows vault statistics.
- **`_templates/Daily Note Template.md`** includes the Planned and Done tables.
- **`README.md`** describes the goals system.

### Removed

- **The projects board**, the `Projects/` folder and its seven sample notes, and
  `_templates/Project Template.md`. Goals and tasks replace them. Projects mixed outcomes
  and work in one note, which made it hard to see what to do next.

### Fixed

- **Color contrast across every surface.** An automated audit renders each surface in a
  browser, reads the computed foreground and background of every element, and measures the
  WCAG 2.1 contrast ratio. It runs in both themes, in community and image-matched modes,
  and across generated palettes. The audit found 3,469 failing elements in 18 root causes,
  and all of them now pass 4.5:1 for normal text and 3:1 for large text and meaningful
  graphics. The visible results:
  - The e-ink light theme rendered the greeting, clock, and date at 1.07:1, which is white
    on white. They are legible now.
  - `--faint` moved from `#6a7c8c` to `#8899a9`. It previously cleared 4.5:1 only against
    the page background, and failed on cards, chips, and chart grounds.
  - Paused and done states no longer dim whole elements with `opacity`. Dashed borders,
    flattened backgrounds, and strikethrough carry the state instead, which also reads
    without relying on color.
  - The primary button gradient is a deeper teal, which lets its label stay light.
  - Sub-task checkboxes in a timeline have a visible outline.
  - A Gantt bar's progress split is a crisp two-tone division rather than a wash.
  - Palette generators now correct every token they produce, including the deep accent,
    against the surfaces the token actually lands on.

### Upgrading from 1.0.0

Nothing migrates automatically, and nothing breaks if you skip the migration. A vault
installed from 1.0.0 keeps working. To adopt the new system:

1. Copy `Goals/`, `Tasks/`, `_scripts/`, `_templates/Goal.md`, `_templates/Task.md`,
   `🧹 Triage.md`, `Dashboard.md`, `⚙️ Settings.md`, and `.obsidian/snippets/` from this
   release into your vault.
2. Enable the `storm-theme` snippet under Settings → Appearance → CSS snippets. The
   dashboard tries to enable it for you on first render.
3. Recreate any project notes as goal notes with task notes underneath. The old
   `Projects/` folder can stay where it is; nothing reads it.

No new plugins are required. The timeline and the panels are Dataview blocks, the same as
the rest of the vault, so Dataview's JavaScript queries have to stay on.

## [1.0.0] - 2026-07-31

First public release.

### Added

- One DataviewJS dashboard note that gathers from across the vault and renders a Today
  card, a focus timer, a month calendar, a habit heatmap, the day's workout, a job
  pipeline, a projects board, a reading shelf, and a mini graph.
- A job tracker with a status pipeline, inline status dropdowns, starring, and per-role notes.
- Recipes, a meal planner, and a shopping list built from one source.
- A reading shelf with cover cards and progress bars.
- A habit system built from `#habit/*` checkboxes in daily notes.
- A six-day training plan with looping form demos.
- Two theme modes: community theme, and a palette matched to the banner image.
- `storm-winddown`, a bundled plugin that nudges you off the screen at night.
- `storm-reader`, a bundled reading plugin.
- Sample data throughout, so every widget renders on first open.
