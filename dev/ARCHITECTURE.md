# Architecture

Everything a new contributor needs before changing this vault. Read `AGENTS.md` at the
repo root first. It is short and it lists the rules. This file explains why those rules
exist, so you do not simplify one of them away.

Written for someone with no history on this project. Dates in worked examples use
2026-09-14 as "today", because that is the date the current rules were fixed and the
date the test fixtures pin.

---

## 1. What this is

An Obsidian vault whose interface is Markdown. There is no app. Every screen you see is a
DataviewJS block that reads notes and writes HTML into a container. Every button writes
plain text back into a note. Nothing stores state outside the notes.

The domain has three levels:

| Level | Lives in | Identified by |
|---|---|---|
| Goal | `Goals/<name>.md` | `type: goal` |
| Task | `Tasks/<name>.md` | `type: task`, plus `goal: "[[Goal name]]"` |
| Sub-task | a checkbox inside a task note | a `- [ ]` line under a `Sub-tasks` heading |

A goal is an outcome. A task is one chunk of work under it. A sub-task is a single
checkbox. Dates come from the Tasks plugin emoji: `📅` due, `🛫` start, `⏳` scheduled,
`✅` completed. The vault never invents a second date store.

Version 1 of this vault had a Projects board instead. Version 2.0.0 removed it, along with
`Projects/`, the project template and the project card. Nothing reads them.

---

## 2. The build graph

The vault is build output. You edit `dev/`, run the build, and the build writes the vault.

```
dev/dashboard/helpers.js     (theme maths, escaping, graph layout)
dev/dashboard/buildHub.js    (pure render: data in, HTML string out)
dev/dashboard/initHub.js     (behaviour: every click handler and every write)
dev/dashboard/livedata.js    (every dv/app read, then buildHub + initHub)
        │
        │  assemble_dashboard.py    concatenates the four parts into ONE
        │                           ```dataviewjs block, per variant
        ▼
dev/template/Dashboard.md
        │
        │  dev/common/_scripts/goal-panel.js      the goal panel view
        │  dev/common/_scripts/task-gantt.js      the task timeline view
        │  dev/common/_scripts/daily-tables.txt   two blocks, split by <!-- SPLIT -->
        │  dev/common/Goals/🎯 Goals.md           the goals index
        │  dev/common/Tasks/📋 Tasks.md           the tasks board
        │  dev/common/🧹 Triage.md                the daily-note sweeper
        │  dev/common/_templates/{Goal,Task}.md   Templater templates
        │  dev/common/storm-additions.css         appended to the base stylesheet
        │  dev/template/**                        seeds, ⚙️ Settings, appearance.json
        ▼
        integrate.py
        ▼
Storm Dashboard Vault/       the deployable vault, committed to this repo
```

`integrate.py` does six jobs, in this order:

1. Re-runs `assemble_dashboard.py`, then asserts the assembled Dashboard does not carry a
   pasted copy of either panel.
2. Substitutes `<!-- GOAL_PANEL -->` and `<!-- TASK_GANTT -->` markers with the three-line
   loader block described in section 3.3. It asserts exactly one marker per file.
3. Re-embeds both halves of `_scripts/daily-tables.txt` into the `## 📅 Planned today` and
   `## ✅ Done today` sections of the daily template. The daily template holds a copy, and
   without this step the copy goes stale. That has happened once already.
4. Builds `storm.css` by concatenating the vendored base stylesheet and
   `common/storm-additions.css`. The base sheet is vendored, not referenced. The
   accessibility fixes change palette tokens declared inside it. Fixing a token where it is
   declared beats around ninety override rules in the appended block.
5. Generates `.obsidian/snippets/storm-theme.css` by parsing the default palette out of
   the stylesheet's own `var(--storm-*, <literal>)` fallbacks, so the two cannot drift.
6. Walks the finished tree and fails on a leftover marker or a banned term.

The build is idempotent. Two runs produce a byte-identical tree, and `tests/V` asserts
that by hashing the whole tree twice. **This is your strongest check.** Change `dev/`,
rebuild, then diff against the committed `Storm Dashboard Vault/`. The diff shows exactly
what you changed, including the parts you did not mean to change.

The assembler keeps a variant seam. `dev/dashboard/livedata.js` holds one
`/* @@VARIANT@@ */ … /* @@/VARIANT@@ */` block, and the assembler replaces it with the
greeting name and the banner fallback for the variant it is building. The assembler fails
if it does not find exactly one such block. The public repo ships one variant. The seam
stays because the source needs it.

---

## 3. The render model

### 3.1 The dashboard is three parts in one block

`Dashboard.md` is a single fenced `dataviewjs` block of about 2,250 lines. The whole thing
sits inside one `try` / `catch`, so a thrown error paints a message instead of a blank
note. The four source parts have strict jobs:

- **`helpers.js`** holds pure maths. Colour conversion, WCAG contrast, the palette
  generator, the force-directed graph layout. No `dv`, no `app`.
- **`buildHub.js`** is `buildHub(data) -> HTML string`. It is pure. It never touches `dv`
  or `app` and never reads a file. Give it the same data and it returns the same string.
  That is what makes the dashboard testable without Obsidian.
- **`initHub.js`** is `initHub(rootEl, app)`. It wires every click, and it owns every
  write. It takes `app` as an argument, falling back to the global, so tests can pass a
  fake vault.
- **`livedata.js`** is the only part that reads. It queries Dataview, builds the `data`
  object, then calls `buildHub` and `initHub`.

Keep that split. If you put a `dv.pages()` call inside `buildHub`, the render tests stop
being able to run it, and the next agent will not notice until something silently renders
empty.

The dashboard renders about twelve cards. The ones that belong to the goal system are the
action strip, the `⚡ Now` card, the `🎯 Goals` card and the `📈 This week` card. The rest
(pomodoro, habits, workout, jobs, reading, calendar, notes index, graph, music) predate the
goal system and are untouched by it. Do not refactor them for tidiness. They have no spec
beyond "keep working", and the suites only cover them at the smoke level.

### 3.2 Panels are called, never pasted

A goal note and a task note each render a panel. The panel code lives in exactly one file
per panel:

- `_scripts/goal-panel.js`, about 31 KB, draws the goal's Gantt chart of tasks.
- `_scripts/task-gantt.js`, about 36 KB, draws one task's timeline of sub-tasks.

Dataview resolves `dv.view("p")` to the vault file `p.js`, then `p/view.js`, and evaluates
it. It calls the function with no receiver, so **`this` inside a view is the global
object, not the render container.** Both view files open with `const root = dv.container;`
for that reason. `dv.container` is correct in a view and in an inline block, so it is the
only spelling that works in both. `integrate.py` enforces this: it refuses to ship a view
file that contains a bare `this.` or that lacks `dv.container`.

The view files are bare JavaScript. They carry no code fence. Dataview would evaluate a
fence inside a view file as code. `integrate.py` asserts that too.

### 3.3 Why a note is three lines

Panels used to be pasted into every note. Eleven live notes got rewritten three times in
one day to ship panel changes, and each rewrite was a full-file write to a note the user
also edits by hand. Notes were about 35 KB each. They are now under 1 KB.

Every goal and task note carries this block and nothing else of the panel:

```dataviewjs
const p = "_scripts/goal-panel", f = x => app.metadataCache.getFirstLinkpathDest(x, "");
if (f(p + ".js") || f(p + "/view.js")) await dv.view(p);
else dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.", { cls: "panel-err storm-missing-view" });
```

Line 1 resolves the view the same way Dataview does, so the guard can never disagree with
the call it guards. Line 2 is the call. Line 3 handles the file being absent.

That third line exists because of a real report. The vault syncs by iCloud. On a phone
where `_scripts/goal-panel.js` had not landed yet, every goal note showed Dataview's own
message: `Dataview: custom view not found for '_scripts/goal-panel.js'`. It names the file
and then tells the user nothing.

**Nothing in those three lines knows what the panel does. It knows the name and nothing
else.** That is the point. A year of panel changes will not reach the note, which is why
this call site should never change again.

Five places emit that block and they must stay byte-identical:

| Emitter | File |
|---|---|
| `view_block()` | `dev/integrate.py` |
| `viewBlock()` | `dev/dashboard/initHub.js`, the `goal:` and `task:` quick-add routes |
| `viewBlock` | `dev/common/_scripts/goal-panel.js`, the `＋ Task` control |
| `viewBlock` | `dev/common/Goals/🎯 Goals.md`, the same control on each card |
| `one_liner()` | `dev/tools/refresh_blocks.py`, for notes already in a vault |

`refresh_blocks.py` migrates a note that holds an older form. It refuses any note that does
not contain exactly one fenced `dataviewjs` block, it compares every byte outside that
block before and after, and it preserves line endings and a byte-order mark. It has a
`--dry-run`. Use it rather than writing a one-off rewriter.

### 3.4 The index notes

`Goals/🎯 Goals.md` and `Tasks/📋 Tasks.md` are ordinary notes carrying their own inline
`dataviewjs` block. They are not views, because they are not loaded from anywhere else.
They carry their own copies of the shared rules, which is the duplication section 10 is
about.

Both declare `cssclasses: [dashboard]`. That is load-bearing, not cosmetic. The dashboard's
`task:` and `sub:` quick-add routes exclude notes with that class from their pickers.
Without it, `🎯 Goals.md` counted as "an active goal", which broke the
"exactly one active goal, so use it" shortcut in a vault that had exactly one real goal.

---

## 4. The three write-back paths

Every button in this vault writes plain text into a note. There are three ways it does
that, and they are not interchangeable.

### 4.1 Line surgery, for checkboxes

Read the file, find the exact line, splice it, write the file back.

```
read → findLine(lines, line, text) → edit that one line → app.vault.modify
```

`findLine` never does a substring match. It normalises both sides through `clean()`,
lower-cases, and compares whole checkbox text. It tries the recorded line number first,
then scans. If it finds zero or several candidates it **refuses and tells the user**,
because a substring match would let `Step 1` land on `Step 10` when the note has shifted
under the dashboard. Every write path takes this route, including the panel writes.

Two rules about the line text itself:

- **A trailing block id must stay terminal.** `- [ ] Draft ^outline-1` has to become
  `- [ ] Draft ✅ 2026-09-14 ^outline-1`, not `… ^outline-1 ✅ 2026-09-14`. Obsidian stops
  resolving a block reference that is not the last thing on the line. `stampAtEnd()`
  inserts before a trailing `\s\^[A-Za-z0-9-]+$`. `stampDone()` and `stripDone()` wrap it.
  This was a real defect, and `tests/V/line_surgery.js` exists to stop it returning.
- **Toggling never auto-completes the task.** When the last unchecked sub-task gets ticked,
  the dashboard shows a notice offering to mark the task complete. It does not flip
  `status` on its own.

### 4.2 Frontmatter, two ways on purpose

The dashboard uses `app.fileManager.processFrontMatter` for `status: done`,
`completed: <date>` and the pomodoro focus key.

The panels do not, and that is deliberate. **`processFrontMatter` reorders and reformats
every key in the block.** A goal note is a note a person writes and edits by hand, so
rewriting their whole properties block to change one value is rude and makes the diff
unreadable. The panels use their own line-based writer instead: `setFm(text, patch)`,
`delFm(text, key)` and `applyFm`. It patches a key in place, appends one if it is absent,
handles a multi-line value, and preserves CRLF. `tests/P` asserts that pausing a goal
rewrites the `status` line, adds the `paused` line, and leaves every other byte alone,
including on a CRLF fixture.

If you add a frontmatter write inside a panel, use `setFm`. The `ADDTASK` contract states
this outright: do not use `processFrontMatter` in the panels.

### 4.3 New notes

`app.vault.create`, one call per note, after `ensureFolder`. Names go through `safeName`,
which strips `\ / : * ? " < > | # ^ [ ]`. Collisions go through `freePath`, which tries
`<name> 2.md` and then `<name> <timestamp>.md`. **Nothing ever overwrites an existing
note.**

Three code paths create a task note: the Templater `Task` template, the dashboard's
`task:` quick-add, and the `＋ Task` button on a goal. They must produce identical text.
`tests/P` asserts the equality of the button's output against the quick-add's output
directly, so the two cannot drift. If you change one, change the other, and check the
template by hand.

### 4.4 The one write that is not a note

`.obsidian/snippets/storm-theme.css` is written with `app.vault.adapter.write`, not
`app.vault.create` or `modify`. Files under the config directory are not in Obsidian's
file index, so the vault API cannot see them. Rules for that write:

- Touch exactly one file. Never read-modify-write anything else in `.obsidian/`.
- Skip the write when the content has not changed, so a re-render does not thrash the file.
- Turn the snippet on through Obsidian's own `app.customCss.setCssEnabledStatus`, never by
  editing `appearance.json`. That file holds the user's own theme and accent colour.
- Every call into `app.customCss` is guarded, because it is internal API. When it is
  missing, the code shows a notice naming the snippet and the settings pane instead.

---

## 5. Sub-task discovery

This is the rule most likely to be "simplified" by someone who has not read this section.

A checkbox in a task note counts as a sub-task when **any heading above it in the
hierarchy** matches `/sub[-\s]?tasks?/i`. The implementation walks the note's headings from
`app.metadataCache.getFileCache(f).headings`, keeping a stack by level. A level-L heading
pops every heading of level greater than or equal to L. A checkbox inherits `under: true`
from the nearest preceding heading whose stack contains a matching entry.

```
## Sub-tasks          → stack [Sub-tasks]        boxes count
### Phase 1           → stack [Sub-tasks, Phase] boxes count
## 🗒️ Notes           → pops both                boxes do NOT count
```

### Why it is ancestor-aware and not innermost-heading

The first version read `t.section.subpath`, which is the innermost heading only. Checkboxes
under `## Sub-tasks` then `### Phase 1` reported their section as `Phase 1`, failed the
match, and **silently dropped out of progress, the next move and the daily tables.** Task
notes with phase sub-headings are ordinary, and every one of them under-counted. The bug
was invisible, because the counts were simply lower than they should have been.

### The fallbacks, and why each one is there

1. **No matching heading anywhere in the note** means every checkbox counts. Notes written
   before the convention existed still work.
2. **The metadata cache returns no headings** means fall back to the old innermost
   `t.section` test. A cold cache degrades to the previous behaviour, never to a crash.
3. **Blank boxes never count.** The Task template ships one empty `- [ ] ` line. If it
   counted, every new task would start with a next move that is an empty string, and
   progress arithmetic would be wrong from the first day.
4. **`#habit` lines never count.** The regex is
   `/(^|\s)#habit(\/[\p{L}\p{N}_/-]+)*(?=$|\s)/u`. Note the boundaries: a plain `/#habit/i`
   also matched `#habitat`, `#habits` and `#habit-tracker`. Two files matched one way and
   three the other, and a fixture with the tag `#habitat` produced 2 sub-tasks on the
   dashboard and 1 in the panel.
5. **Folder exclusions** are `/(^|\/)(Fitness|_templates|_archive|Archive|\.trash)(\/|$)/i`.
   The anchor matters. One copy used `^Fitness/` and the others used `(^|/)`.

### The order of operations is part of the rule

Select the section first, **then** drop blank and `#habit` lines. The reverse order failed
on a real note. Its `## Sub-tasks` section held only habit lines, so dropping habits first
emptied the section before selection ran. Selection then fell through to the "no heading,
count everything" path and picked up checkboxes from `## 🗒️ Notes`.

### The writers use a different regex, deliberately

`addSubTask` in `initHub.js` and the Triage "to Sub-task" action need to find the heading
**line** in the text, not classify a checkbox. They use
`/^#{1,6}\s+.*sub[-\s]?tasks?\b/i`. It has to accept the same spellings as `SUBSEC`, and
`tests/V/shared_rules.py` checks that both writers carry a regex containing
`sub[-\s]?tasks?`.

---

## 6. Health

Every goal and every task carries a health label. It drives the badge, the sort order of
the goals index, the "Goals at risk" tile and the highlighting in the `⚡ Now` card.

### The rule as it stands

```
overdue   = unchecked sub-tasks whose 📅 is strictly BEFORE today
            (due today is NOT overdue, it matches the chart's st-today state)
remaining = unchecked sub-tasks
dated     = any sub-task carries a 📅 at all

status done               -> "done"
status paused             -> "paused"
start or end missing      -> "unscheduled"     (neutral, never counted as at risk)

if NOT dated:                                  # the pacing fallback, see below
    elapsed = clamp((today - start) / (end - start), 0, 1)
    gap     = progress - elapsed
    gap >= -0.10 -> "ok"   ·  gap >= -0.30 -> "risk"  ·  else "behind"

if dated:
    end < today AND remaining > 0 -> "behind"
    overdue == 0                  -> "ok"
    overdue == 1                  -> "risk"
    otherwise                     -> "behind"
```

Labels: `ok` reads "On track", `risk` reads "At risk", `behind` reads "Behind", plus
"Done", "Unscheduled" and "Paused". Sort order puts `behind` first and `paused` last:
`{ behind:0, risk:1, ok:2, unscheduled:3, done:4, paused:5 }`.

A goal rolls up the same way. Its `overdue` and `remaining` are totals across its
**non-paused, non-done** tasks, and `dated` is true when any of those tasks has a dated
sub-task. A goal's window is `min(task.start)` to `goal.target || max(task.end)`.

### Why it changed

The original rule compared progress against elapsed calendar time and never read a single
deadline. A real task broke it. Window Sep 9 to Sep 20. Three sub-tasks, due Sep 15, Sep 17
and Sep 20. None done. On Sep 14 the badge read **Behind**, because 5 of 11 days had
elapsed (45.5%) and progress was 0%, and a 45-point gap crossed the `behind` threshold.

Nothing was due yet. By the plan the task was exactly on schedule.

The second half of the problem was granularity. On a three-item task, progress only moves
in 33-point steps, so finishing one item the next day would still have read **At risk**.

The deadline rule reads the same case as **On track**, and the worked cases the test suite
pins are:

| Date | State | Badge | Why |
|---|---|---|---|
| Sep 14 | nothing done | On track | 0 overdue |
| Sep 16 | nothing done | At risk | Sep 15 is overdue |
| Sep 18 | nothing done | Behind | Sep 15 and Sep 17 are overdue |
| Sep 21 | nothing done | Behind | the end date has passed with work left |
| any | task finished, dates long past | Done | the `done` short-circuit runs first |

There is a second reason for this shape, and it is the one to keep in mind if you are
tempted to change the thresholds. **The badge now explains itself with a number that is
already on screen.** The panel header prints "2 overdue" right beside the badge. The old
rule's number, the pace gap, appeared nowhere in the interface. Keep the two in agreement:
0 overdue must never render Behind unless the end date has passed.

### Why the pacing fallback stayed

When no sub-task carries a `📅`, there is no deadline to measure. Pace is the only signal
left, so the old comparison stays, unchanged, byte for byte. This also keeps the projected
bars honest, because they already assume even pacing across the window (section 8).

**The fork is on `dated`, not on `overdue`.** A task with dates and zero overdue items is
"On track". A task with no dates at all falls to pacing. Getting that backwards would make
every undated task read On track forever.

---

## 7. Pause

`status: paused` on a goal or a task means "I am not working on this". Before it existed,
every non-`done` status fell through the same health arithmetic. A parked goal kept
reporting Behind and kept pushing overdue next moves at whoever opened the dashboard. The
workaround in the field was deleting `type: goal`, which hides the note from every query
and loses the goal with it.

Two frontmatter keys:

- `status: paused`, case-insensitive and trimmed.
- `paused: YYYY-MM-DD`, optional, written by the Pause button. It is what makes the date
  shift on resume possible. If someone typed the status by hand there is no date, and
  resume simply offers no shift.

### The cascade is computed, never written

A task's **effective** paused state is `own status is paused OR its goal's status is
paused`. It is computed at read time, in the same loop that already writes `goalName`,
`goalPath` and `goalHealth` back onto the task objects. Nothing is written to disk.

Pausing a goal with fifteen tasks therefore touches one file, not sixteen. This is not an
optimisation, it is a correctness property:

- Resume is one file too, so the two operations cannot fall out of step.
- A task keeps its own `status` untouched, so `waiting` stays `waiting` and `backlog` stays
  `backlog` through a pause and a resume.
- A task paused **on its own** stays paused when the goal resumes. Resume deliberately
  skips it and does not shift its dates.
- Nothing has to be repaired if a bulk write fails halfway.

If you ever find yourself writing `status: paused` into task notes from a goal, stop. That
is the design this replaced.

### What goes quiet

`livedata.js` has one chokepoint:

```js
const activeTasks = TASKS.filter(t => t.status === "active" && !t.paused);
```

`nextMoves`, `overdue`, `dueToday`, `pulse.activeTasks` and `pulse.stale` all read from
that list, so a paused task disappears from everything at once. `strip.risk` skips paused
goals separately. `buildHub.js` drops paused goals from the `⚡ Now` card groups and from
the goals card. The daily **Planned today** table skips paused tasks. **Done today** does
not, because work that actually happened still counts. Triage skips paused tasks in its
nags.

### What stays visible

Paused is not deletion. The goals index shows a collapsed `<details class="goal-paused">`
group at the bottom with a Resume control on each row. The tasks board gains a `Paused`
column between `Waiting` and `Done`. **Only tasks paused by their own status go in that
column.** A cascade-paused task stays in its own status column and renders muted through
`data-paused`, because moving it would lie about its own state.

### Resume, and the date shift

Resume with a `paused:` date at least a day old shows an inline confirm row inside the
panel. Never a modal, never `confirm()`. Dialogs freeze the plugin host.

```
Resume "X"? paused N days.  [ Shift remaining dates +Nd ]  [ Resume as-is ]  [ Cancel ]
```

"Shift" moves the goal's `target`, each cascade-resumed task's `start` and `end`, and every
`📅 🛫 ⏳` on every **unchecked** sub-task of those tasks. **Checked sub-tasks are never
touched**, because their `✅` is a real historical date and so is the `📅` beside it. One
`vault.modify` per file.

---

## 8. Projected bars

On a task note, the Timeline draws one row per sub-task. A sub-task with a `📅` gets a real
bar. A sub-task with `🛫` and no `📅` gets a milestone marker. A sub-task with neither used
to fall to a chip below the chart, which meant a task with a plan and no per-item dates
drew an empty chart.

When the note has a real `start` to `end` window, an undated sub-task now becomes a
**projected** bar instead. The N sub-tasks pace evenly across the window in document order:

```js
bs = start + floor(i     * span / N)
be = start + floor((i+1) * span / N)
```

A `⏳` scheduled date keeps a sub-task in the backlog chips, deliberately. `⏳` says
"scheduled but not planned here", so the chart does not invent a slot for it.

Four properties matter:

- **A projected bar can never be overdue.** It has no `📅`, so the overdue count skips it.
  A projected slot that has already passed renders as `st-plan late`, which is a visual
  cue, not a health input. Without this, the health rule would count dates the user never
  wrote.
- **A projected end feeds the `prevDue` chain**, so a real bar after a run of projected
  ones still starts where the previous item ended rather than jumping back.
- **Clicking a projected bar promotes it.** It writes its projected end date into the line
  as a real `📅`. That is how a projection becomes a commitment.
- The header counts them separately: `3/8 done · 1 overdue · 4 projected`.

The bar start rule for a real dated bar, in order:
`start = 🛫 || ⏳ || previous sub-task's 📅 || task.start || (due minus 7 days)`, clamped so
it is always at least one day before the end.

---

## 9. The theme pipeline

Two modes. **Community** inherits the installed Obsidian theme. **Match** derives a palette
from the banner image. The user picks in `⚙️ Settings`, which writes `stormMode` into the
Dashboard note's frontmatter.

### The indirection

Every palette declaration in the stylesheets reads through a `--storm-*` variable with the
old literal as the fallback:

```css
--bg:      var(--storm-bg, #0a0d11);
--surface: var(--storm-surface, #141b23);
--faint:   var(--storm-faint, #8899a9);
```

There are fourteen such palette blocks across `storm.css` and `storm-additions.css`: dark
and light copies for `.storm-hub`, `.dashboard`, `.goalpanel`, `.dt-wrap`, `.triage`,
`.goalsidx`, `.tasksboard` and `.tgantt`. **The literal is the default.** A vault with no
theme file renders exactly as it did before the indirection existed. That is the whole
reason the fallback stayed inline instead of moving into one root block.

### The generated file

`.obsidian/snippets/storm-theme.css` carries the palette as `--storm-*` on `body`, so one
file repaints every Storm surface in the vault. Before it existed, `_themeRule()` scoped
every declaration to `.storm-hub` inside the Dashboard note's own output, and the palette
died at the edge of that note. Goal notes, task notes, the indexes, Triage and the daily
tables all kept the hardcoded blue.

The build ships the file with the **default** palette, parsed straight out of the
stylesheet's own `var(--storm-*, …)` fallbacks. So a fresh vault gets a file that does
nothing, with the snippet already registered and enabled, and the Dashboard's first theme
write has nothing to set up.

One token is left out on purpose. `--behind` has no literal default in the sheet. It is
derived with `color-mix(in srgb, var(--warm) 60%, #e0736b)`, which only resolves on the
element that declares `--warm`, not on `body`. A generated palette always carries an
explicit `--storm-behind`. The default snippet leaves the derivation alone.

### The second block, and why community mode skips it

`--storm-*` only reaches surfaces our stylesheet paints. A plain note, the sidebars, the
modals and the settings pane read Obsidian's own variables. So in **match** and **brand**
mode the generated file also maps the palette onto `--background-primary`, `--text-normal`,
`--interactive-accent`, `--link-color` and the rest.

**Community mode never emits that block.** Community mode reads those variables to build
`--storm-*`. Writing them back would be circular and would fight the installed theme.

Link colours are in that block for a specific reason. Obsidian derives link colour from the
`accentColor` in `appearance.json`. Set that to `#000000` and every internal link renders
black, which is unreadable on a dark theme. That is a user setting and not a bug we
introduced, but the vault should not depend on it. The file sets `--link-color`,
`--text-accent` and `--color-accent`. Different theme generations read different ones, and
setting only the modern names leaves the legacy ones black. Unresolved links get their own colour at a third of the
saturation, still floored at 4.5:1, rather than Obsidian's accent at 0.4 opacity, which
measures 1.75:1 on its own background.

The file's header comment says that turning the snippet off, deleting it, or switching to
community mode hands the vault straight back to the installed theme. Keep that claim true.

### Contrast is enforced, not hoped for

`_buildTheme()` generates a palette from the image and floors every token it produces. Four
things about the flooring are easy to get wrong:

- **The worst ground is not `--surface2`.** Half the product paints a translucent overlay
  on top of `--surface2`: card inners, the Timeline window band, a projected bar, the tinted
  health chips. `_worstGround()` steps one further from the page, and every text colour is
  floored against that. Floor against `--surface2` alone and the palette is AA on paper and
  fails on screen.
- **A health chip tints its own ground with 12% to 20% of its own ink.** `_floorTinted()`
  floors the ink against the tinted ground, which costs about 0.3 of a ratio.
- **`--accent-deep` fills the un-started Timeline bar**, which is a meaningful graphic
  boundary. It gets a 3:1 floor, not 4.5:1, and it gets one at all. It used to get none,
  and a dark banner produced 2.37:1 bars.
- **`--on-accent` is a pair with `--btn`.** A hue that stays light at L=0.12 cannot carry
  the house light ink, so `_btnPair()` gives such a button dark ink instead of a 2.6:1
  label.

`_normalizeTheme()` re-floors a palette at apply time, because `stormTheme:` in frontmatter
is a **cache**. It may have been written by an older build or edited by hand. A palette
straight from a generator carries `aa:1` and passes through untouched, and `tests/T` pins
that no-op so a good palette can never be quietly restyled.

Community mode has its own mapping, `_communityMap()`, and there is exactly one copy of it,
read by both the in-note rule and the vault-wide file. Two copies is how the audit and the
product drifted apart the first time. One entry in it is opinionated. `--faint` maps to
`--text-muted` and never to `--text-faint`. We use `--faint` for load-bearing text. Obsidian
documents `--text-faint` as decorative, and it measures 2.85:1 to 3.66:1 in Obsidian's own
themes. Shipping a rule that depends on it being legible is our bug, not Obsidian's.

---

## 10. The rules that are duplicated on purpose

Four families of rule live byte-for-byte in every block that needs them, because each block
has to stand alone. A `dataviewjs` block in a note cannot import anything.

| Rule | What it does | Hand-maintained copies in `dev/` |
|---|---|---|
| `subMarks` / `subsOf` | which checkboxes are sub-tasks | 7, in 6 files |
| `clean` | strips Tasks emoji, dates, tags, block ids | 7, in 6 files |
| `SUBSEC` / `HABIT_RE` | the two regexes those two use | 7, plus `HABIT_RE` in Triage |
| `healthOf` | the health label | 5, in 5 files |
| `HL` | the label strings | 5, counting `_HBL` in `buildHub.js` |
| `HORDER` | the sort order | 2, counting `_HORDER` in `buildHub.js` |
| `linkNames` / `linkKeys` | resolves a `goal:` value to a name | 4, in 4 files |

The six files are `dev/dashboard/livedata.js`, `dev/common/_scripts/goal-panel.js`,
`dev/common/_scripts/task-gantt.js`, `dev/common/Goals/🎯 Goals.md`,
`dev/common/Tasks/📋 Tasks.md`, and `dev/common/_scripts/daily-tables.txt`, which holds two
blocks and therefore two copies of the selector family. `dev/common/🧹 Triage.md` carries
`HABIT_RE` only.

Count `subsOf` in a clean checkout and you find **sixteen copies**: seven in `dev/` that you
maintain by hand, and nine inside `Storm Dashboard Vault/` that the build writes. **Nine of
those sixteen are generated. Editing one of them does nothing and silently reverts.**

Two deliberate exceptions, so you do not "unify" them by mistake:

- `dashboard/livedata.js` keeps an older `healthOf` signature,
  `healthOf(status, progress, startIso, endIso, opts)`, working on ISO strings rather than
  the panels' day arithmetic. It is not in the byte-identity set. **Its behaviour must still
  match exactly**, and `tests/H` and `tests/P` assert the thresholds line by line.
- `initHub.js` has its own small `clean`. It is the comparator for `findLine`, not the
  display cleaner: it also strips the checkbox prefix and lower-cases the result. It is a
  different function doing a different job. Leave it alone.

### What happens when a copy forks

Every item below happened. This is not a hypothetical list.

- The heading regex forked between `/sub-?tasks/i` and `/sub[-\s]?tasks?/i`. A note titled
  `## Sub tasks` counted 3 sub-tasks on the dashboard and 1 in the panel.
- The `#habit` test forked between a tag check and a raw `/#habit/i`. A `#habitat` tag gave
  2 against 1.
- `goal:` resolution forked. The dashboard collapsed the value with
  `v.path || v.display || String(v)`, which cannot read an array. A YAML list of one link
  produced a garbage key. The task fell into "No goal yet" on the dashboard while the
  goal's own panel still listed it.
- Default `status` forked. A task with no `status:` was `active` for the dashboard and
  `backlog` for the panel. Two of the copies also skipped `.trim()`, so `status: "active "`
  broke both the `done` check and the CSS class.
- `clean()` forked four ways: a bare `📅` with no date, `🔺` against `⏬`, numeric tags like
  `#2026`, and mid-word `a#tag`. That one changes **counts**, not labels alone, because a
  cleaned-to-empty line is how a blank box is detected.

`dev/tests/V/shared_rules.py` extracts each function from the built vault and asserts the
copies are character-identical. It is the guard that makes this design survivable. If you
change a rule and that file fails, it is telling you that you changed one copy.

---

## 11. The tests

Ten suites, each with a `run.sh`, each printing `ok  - …` and `FAIL: …` lines and exiting
non-zero on failure. Most of them re-run `integrate.py` first and assert against the built
vault, not the sources, so a suite that passes proves the **shipped** file works.

| Suite | Pins | Why it exists |
|---|---|---|
| **A** | The dashboard. `parseAdd` grammar, `buildHub` output, `initHub` interactions, and the two variants. Also that the assembler is idempotent. | The dashboard is the largest single artefact and the only one with a quick-add grammar. `parseAdd` is a top-level function so tests can extract it by name. |
| **B1** | The goal panel, the `🎯 Goals` index, the `📋 Tasks` board. Health, progress and next move must agree across all three. | These three compute the same numbers three times. The suite exists to catch them disagreeing. |
| **B2** | The two Templater templates and the two daily tables. Byte-equality between `_scripts/daily-tables.txt` and the copies embedded in the daily template. | The daily template holds a copy of a canonical block. This is the suite that noticed it going stale. |
| **E** | `🧹 Triage`. Scanning daily notes, the three actions, and bulk edges. | Triage is the only tool that **deletes** lines from a user's notes. Every removal verifies the line text still matches first. |
| **G2** | The task Timeline end to end inside the built vault. Bar geometry, window bounds, tick counts, state classes, toggles, the add row. | The Timeline has the most arithmetic in the system. It also checks no build marker survived into a shipped note. |
| **H** | Health by deadlines. The worked cases in section 6, at four dates, asserted on the **rendered badge text**, not by calling the function. Plus that `healthOf` is byte-identical across the four standalone copies. | Written for the rule change, kept because the fixture is the clearest statement of the rule. Asserting the rendered badge is deliberate: a unit test on the function would pass while the panel called it wrongly. |
| **P** | Paused goals and tasks, and the `＋ Task` control. Ten fixtures each. Includes CRLF preservation, one-modify-per-file, and the byte-equality of the two task-creation paths. | The pause cascade is invisible in the files, so only a rendering test can prove it. |
| **T** | The theme reaching the whole vault. Renders a goal note, a task note and the board in real Chromium against the real shipped `storm.css` with a match-mode theme file, and asserts the computed background is the themed one. | "The file was written" is not the same claim as "the note is painted". The suite exists because the first version of this feature passed the first test and failed the second. |
| **V** | Verification of the built tree. Idempotency, static checks, the CSS audit, `shared_rules.py`, cross-block consistency, end-to-end runs, block-id line surgery, and that **every** shipped `dataviewjs` block executes without throwing. | The integration net. It is where `shared_rules.py` lives, and it is the suite that catches a build that produced a tree nobody can run. |
| **W** | Colour contrast. Renders every surface in Chromium against the real stylesheet across a palette matrix, walks every element with text, reads the computed colour and the effective background, and fails below 4.5:1 for normal text and 3:1 for large text and meaningful graphics. | A palette generated from an arbitrary image can produce any colour. The only way to keep AA is to measure it. |

The harness is `tests/lib.js` plus `tests/harness.js`. It launches Chromium, fixes
`new Date()` to a known instant, shims `require("obsidian")` so `Notice` texts land in
`window.__notices`, and models Dataview and the `app` API over an in-memory file map.
Writes are visible through `app.__store` and `app.__log`, so a test can assert the exact
line a button wrote.

Two things about the harness are worth knowing before you touch it:

- **`dv.view` is implemented for real.** It used to be stubbed as `async () => {}`. With a
  no-op stub every test passes while rendering nothing. There is a test asserting that a
  missing view file produces the error div, specifically so the stub can never come back.
- **Screenshot output is not an assertion.** Several suites write PNGs. Look at them. They
  are evidence for a human, and no test reads them.

Run the whole set with `npm test` from `dev/`, and the contrast audit with
`npm run test:a11y`. A change is not finished until both pass.

---

## 12. Known risks

These are open. They are not bugs to fix on sight. They are things to know before you
trust a result.

1. **The metadata cache can be cold.** Sub-task selection reads
   `getFileCache(f).headings`. For a file Dataview has indexed but the cache has not filled,
   the code degrades to the innermost-heading test. The worst case is the pre-existing
   behaviour. Two cases are untested for real: a note with two headings of the same text,
   and `getFileCache` returning null for a file that is open and unsaved.
2. **Dataview flattens nested checkboxes.** The code treats `page.file.tasks` as flat, so an
   indented child checkbox counts toward `done/total` everywhere. That stays consistent
   across screens, but nobody has confirmed it reads the way a user expects on a note with
   nested steps.
3. **Daily-note creation races Templater.** `getToday()` fires the `daily-notes` command
   and polls for `Daily/<YYYY-MM-DD dddd>.md` for about 2.2 seconds. The template renames
   the file **after** creation, so the poll is racing Templater. Two plugin settings have to
   be right: the core Daily Notes plugin set to folder `Daily/` with format
   `YYYY-MM-DD dddd`, and Templater's "trigger on new file creation" turned on. Get either
   wrong and every write that needs today's note fails with a notice instead of writing.
   The harness short-circuits this with a hook, so **no test covers the race.**
4. **The dashboard toggle bypasses the Tasks plugin.** It appends `✅ YYYY-MM-DD` at end of
   line itself. A recurring task with `🔁 every week` will **not** spawn its next occurrence
   when checked from the dashboard, only when checked in the note. The plugin's completed
   date setting must stay on emoji format. `globalFilter` ships as `""`, so every checkbox
   is a Tasks task.
5. **`app.metadataCache.trigger("dataview:refresh-views")` is undocumented.** Every write
   ends with it. If Dataview changes it, writes will land and views will need a manual
   refresh.
6. **`app.customCss` is internal API.** Every call is guarded and falls back to a notice,
   but the enable path is untested against a build where the shape has changed.
7. **The Pomodoro Timer plugin's timer object is private API.** Every call is guarded, so a
   version change degrades to "enable the plugin". The chain where finishing a session
   checks off the focus task is untested against a real plugin build.
8. **`color-mix()` is used for `--behind`** with a plain `var(--warm)` fallback line
   immediately before it. Older Electron builds silently take the fallback, which is the
   intended degradation.
9. **Concurrent edits.** All writes are read, splice, modify. If the target note is open
   with unsaved editor state, Obsidian may clobber one side. The `findLine` drift fallback
   limits the damage to "the write lands on the right line", not "the write is safe".
10. **Emoji and en-dash filenames.** Everything resolves by full path, which the tests
    exercise with real names, but the round trip through Obsidian's own link resolver is
    untested.
11. **The contrast audit has limits it states itself.** It cannot sample a
    `background-image`, so text over the banner is an advisory and not a failure. It audits
    resting state only, not hover. Its Match palettes come from synthetic buffers fed to
    the real extractor, so a given user's banner will produce different hexes.
12. **Two dimming rules in the `opacity` family never fired in the fixtures**,
    `.nm-row.done` and `.nm-row[data-paused]`, because no completed or paused row reached
    the `⚡ Now` card in any fixture. They are the same defect class the audit already fixed
    elsewhere. Treat them as unproven, not as clean.

---

## 13. Where to change what

| You want to change | Edit | Then |
|---|---|---|
| A dashboard card's markup | `dev/dashboard/buildHub.js` | `npm run build`, suite A |
| A dashboard button's behaviour | `dev/dashboard/initHub.js` | `npm run build`, suite A |
| What the dashboard reads | `dev/dashboard/livedata.js` | `npm run build`, suites A and V |
| The goal chart | `dev/common/_scripts/goal-panel.js` | `npm run build`, suite B1 |
| The task Timeline | `dev/common/_scripts/task-gantt.js` | `npm run build`, suite G2 |
| The goals index or tasks board | `dev/common/Goals/🎯 Goals.md`, `dev/common/Tasks/📋 Tasks.md` | `npm run build`, suite B1 |
| The daily tables | `dev/common/_scripts/daily-tables.txt` | `npm run build`, suite B2. The build re-embeds them |
| Triage | `dev/common/🧹 Triage.md` | `npm run build`, suite E |
| Any shared rule | **all copies**, see section 10 | `npm run build`, then V, H and P |
| Styling | `dev/common/storm-additions.css`, or the base sheet for a token | `npm run build`, then T and W |
| The palette generator | `dev/dashboard/helpers.js` | `npm run build`, then T and W |
| A seed note in the sample vault | `dev/template/**` | `npm run build`, suite V |

And one entry with no row of its own: never edit anything under `Storm Dashboard Vault/`.
