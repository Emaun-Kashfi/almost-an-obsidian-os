# "Add task" control on goal notes — CONTRACT (today = 2026-09-14)

Vault: the Storm Dashboard, built from `dev/` (one variant per `dev/<name>/variant.json`). Shared code must stay identical between variants.

## The gap
Creating a task today means either the Dashboard's `task:` quick-add (which needs you to type the
goal name and match it by fuzzy search) or the Templater **Task** template (which prompts for the
goal). Both make you re-state the goal you are already looking at. A goal note knows its own
identity, so creating a task from it should need nothing but a name.

## What to build
A `＋ Task` button in the goal panel header (`_scripts/goal-panel.js`, the `.goalhead` row built
around line 292), sitting beside the existing `⏸️ Pause` / `▶ Resume` control and styled to match
it. The same control also goes on each card in `🎯 Goals` (that note
already carries the pause/resume pair, so the pattern exists there).

Clicking it opens an inline row beneath the header, in the same spirit as the Timeline's `＋` row
and the resume bar. Never a modal, never `confirm()`/`prompt()` (dialogs freeze the plugin host).

    [ Task name…              ] [ start ] [ end ]  [ Add ] [ Add & open ] [ Cancel ]

- **Defaults**: start = today; end = the goal's `target` when it has one, else blank. Both are
  `<input type="date">` and both may be cleared.
- **Add** creates the note, clears the name field, leaves the row open and focused, and fires a
  Notice. The new task appears in the goal's chart and list on the next refresh, so several tasks
  can be added in a row without leaving the goal.
- **Add & open** creates it and opens the note (`app.workspace.openLinkText(path, "", false)`).
- Enter in the name field behaves as **Add**. Escape closes the row.
- An empty or whitespace-only name does nothing.

## The note it writes
Exactly what the Task template and the Dashboard's `task:` route already produce, so a task is
indistinguishable from one made any other way. Read both before writing code
(`common/_templates/Task.md`, `dashboard/initHub.js` `createTaskNote`) and match them.

- Path `Tasks/<safe name>.md`. Strip `\ / : * ? " < > | # ^ [ ]` from the name. If the path is
  taken, fall back the same way `freePath()` in `initHub.js` does rather than overwriting.
- Frontmatter: `type: task`, `goal: "[[<this goal's basename>]]"`, `status: active`, `start`, `end`,
  `completed:`, `tags: [task]`.
  (`approver_name`) exactly as the shape's `dynamic` block describes. Do not hand-roll a second
  copy of the shape.
- Body: the back-link line, the `# <name>` heading, the same callout the template uses, the
  `## 📆 Timeline` section containing the one-line `await dv.view("_scripts/task-gantt")` call,
  `## Sub-tasks` with one empty checkbox, and `## 🗒️ Notes`.
- Create the `Tasks` folder if it is missing. One `vault.create` per task.

## Constraints
- The panel is a `dv.view`, so `app` is the Obsidian global and the container is `dv.container`.
  Reuse the file's existing helpers (`notify`, `refresh`, `esc`, `isoOf`, `todayIso`) rather than
  adding new copies.
- Do not use `processFrontMatter`. Build the note text directly.
- Guard against double-submission the way the panel's other writes do (the `busy` flag).
- A paused goal keeps the button. Adding work to a parked goal is legitimate; the new task inherits
  the paused state through the existing cascade, so it stays quiet until the goal resumes.
- CSS goes in `common/storm-additions.css`, appended to the existing paused-controls block.
  New hooks: `.addtaskbtn`, `.addtaskbar`, `.addtaskbar input`, `.addtaskbar button`. Reuse the
  `--storm-*` tokens; do not introduce literal colours.

## Tests
Add to the existing `tests/P` suite in each repo, or a new suite wired the same way.
1. The button renders on a goal note and on each `🎯 Goals` card, paused or not.
2. Clicking it reveals the row with start defaulted to today and end defaulted to the goal's target.
3. **Add** writes `Tasks/<name>.md` with frontmatter and body byte-identical to what the Dashboard's
   `task:` route produces for the same name, goal and dates. Assert that equality directly, so the
   two paths cannot drift.
5. A name colliding with an existing note does not overwrite it.
6. A name with `/`, `:` and `#` produces a safe filename and keeps the punctuation in the `#` heading.
7. Empty name → no write. Two fast clicks → one note, not two.
8. The new task is picked up by the goal's own panel on re-render (chart row and list row present).
9. A task added to a paused goal reads as paused without its own frontmatter saying so.
10. Escape closes the row; Enter in the name field adds.

## Rules
- Every existing suite green: `A B1 B2 E G2 H P T V W`. Update an assertion only when deliberate, and say so.
- `node dev/a11y/audit.js` must still exit 0 (the new control is audited text).
- `npx --yes csstree-validator` clean.
- Screenshot the control closed and open, dark and light, and look at it.
- No device tools, no git, no deploying, no zip rebuilds.
