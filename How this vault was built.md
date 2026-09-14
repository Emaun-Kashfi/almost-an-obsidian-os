# How this vault was built

This is the technical write-up. If you want to understand how the vault works before you
change it, or you want to build something like it yourself, start here.

If you are a coding agent, read `AGENTS.md` at the repo root first, then
`dev/ARCHITECTURE.md`.

---

## The idea

Markdown is the database. There is no app, no sidecar file and no hidden state. A goal is a
note. A task is a note. A sub-task is a checkbox line inside a task note. Every screen you
see is a DataviewJS block that reads those notes and writes HTML into the page. Every
button writes plain text back into a note.

That constraint is the whole design. It means you can delete every view in this vault and
still have your data, in files you can read in any text editor. It also means the views are
disposable. If one of them annoys you, rewrite it.

---

## The data model

Three levels, and they map to three things you already think about.

**A goal** lives in `Goals/`. It is an outcome with an area and a target date.

```yaml
---
type: goal
status: active        # active | paused | done
area: Side Project
target: 2026-11-30
tags: [goal]
---
```

**A task** lives in `Tasks/`. It is one chunk of work under one goal, with its own window.

```yaml
---
type: task
goal: "[[💻 Ship the portfolio site]]"
status: active        # backlog | active | waiting | paused | done
start: 2026-09-01
end: 2026-10-05
completed:
tags: [task]
---
```

**A sub-task** is a checkbox under a `## Sub-tasks` heading in a task note.

```markdown
## Sub-tasks
- [x] Pick the tech stack 📅 2026-09-09 ✅ 2026-09-11
- [ ] Build the gallery 📅 2026-09-10
- [ ] Cross-browser QA pass
```

Dates come from the Tasks plugin emoji and nowhere else. `📅` is a deadline, `🛫` is a
start, `⏳` is scheduled, `✅` is the day you finished. The vault never keeps a second copy
of a date, so there is nothing to fall out of sync.

Version 1 of this vault used a Projects board instead, where one note mixed the outcome and
the work. That made it hard to answer the only question that matters in the morning, which
is what to do next. Goals and tasks replaced it in 2.0.0. The `Projects/` folder, its
template and its dashboard card are gone.

---

## How a screen gets drawn

Everything renders through one of three shapes.

**The dashboard** is a single DataviewJS block, built from four source files with strict
jobs. Helpers are pure maths. A render function turns a data object into an HTML string and
touches nothing else. A behaviour function wires every click. A data layer does all the
reading. A Python script concatenates the four into `Dashboard.md`. Keeping the render pure
is what lets the whole dashboard run in a test browser with a fake vault behind it.

**Panels** are the goal chart and the task timeline. Each one lives in exactly one file
under `_scripts/`, and a note calls it:

```dataviewjs
const p = "_scripts/goal-panel", f = x => app.metadataCache.getFirstLinkpathDest(x, "");
if (f(p + ".js") || f(p + "/view.js")) await dv.view(p);
else dv.el("div", "the panel file is missing from this device", { cls: "panel-err" });
```

Three lines. Panels used to be pasted into every note, which meant every panel change
rewrote every goal and task note, and notes were about 35 KB each. They are under 1 KB now,
and a panel change reaches every note at once without touching a single one.

The third line matters more than it looks. My vault syncs by iCloud. On a phone where the
panel file had not landed yet, every goal note showed Dataview's own message naming a file
I had never heard of. Now it says the file is still syncing and what to do about it.

One thing to know if you write your own view. Inside a `dv.view` file, `this` is not the
render container. Render into `dv.container`, which is correct both in a view and in an
inline block.

**Index notes** are `🎯 Goals`, `📋 Tasks` and `🧹 Triage`. They carry their own inline
block, because nothing else loads them.

The daily note is the odd one out. It holds two blocks, Planned today and Done today, and
both are copies of a canonical file under `_scripts/`. The build re-embeds that file into
the template on every run. The first time I fixed a bug in the canonical block, the
template kept running the old code, and I did not notice until a test compared them.

---

## The three write-back APIs

Every button in this vault ends in one of three calls. If you add a button, pick the right
one.

### 1. Line surgery, for checkboxes

Read the file, find the exact line, change that one line, write the file back.

```
app.vault.read → find the line → splice → app.vault.modify
```

The finder never does a substring match. It normalises both the stored text and the line
text, strips the emoji and the tags, and compares whole checkbox text. If it finds no match
or several, it refuses and says so. That sounds paranoid until you have a note with `Step 1`
and `Step 10` in it and the note shifted while the dashboard was open.

Two details cost me real bugs:

- A trailing block id has to stay last on the line. `- [ ] Draft ^outline-1` becomes
  `- [ ] Draft ✅ 2026-09-14 ^outline-1`, not the other way round, because Obsidian stops
  resolving a block reference that is not terminal.
- Checking the last open sub-task never marks the task done on its own. It offers.

### 2. Frontmatter

Obsidian gives you `app.fileManager.processFrontMatter`, which hands you a plain object.
The dashboard uses it.

The panels do not. `processFrontMatter` reorders and reformats the whole properties block,
and a goal note is a note you wrote by hand. The panels use a small line-based writer
instead. It patches a key in place, appends one if it is missing, and preserves your line
endings. Pausing a goal changes exactly two lines and leaves every other byte alone.

### 3. Creating a note

`app.vault.create`, once, after making sure the folder exists. Names get stripped of
characters a filename cannot hold. A collision falls back to `<name> 2.md` and then to a
timestamp. Nothing ever overwrites a note that already exists.

There is a fourth write, and it is the exception that proves the rule. The theme file lives
at `.obsidian/snippets/storm-theme.css`, and files in the config folder are not in
Obsidian's file index, so the vault API cannot see them. That one write goes through
`app.vault.adapter.write`, touches exactly one file, and skips itself when the content has
not changed.

---

## The rules every screen agrees on

Four screens compute the same numbers: the dashboard, the goal chart, the goals index and
the tasks board. They have to agree, and a DataviewJS block cannot import anything, so each
one carries its own copy of the rules. The copies are byte-identical and a test asserts it.
Every time a copy has forked, two screens started showing different numbers for the same
note.

### Which checkboxes count

A checkbox is a sub-task when **any heading above it** matches `sub-tasks`, with or without
the hyphen, singular or plural. The code walks the note's headings keeping a stack by
level, so `## Sub-tasks` then `### Phase 1` still counts, and a following `## 🗒️ Notes`
closes the section.

It reads the ancestry and not just the nearest heading because my own notes use phase
sub-headings, and the first version silently dropped every checkbox under one. Blank
checkboxes never count, because the task template ships one. `#habit` lines never count,
and the test for that has word boundaries, because a plain match also swallowed `#habitat`.

### Health

Every goal and task carries a badge: On track, At risk, Behind, Done, Unscheduled, Paused.

It reads deadlines:

```
overdue = unchecked sub-tasks whose 📅 is before today (due today is not overdue)

end date passed with work left  → Behind
0 overdue                       → On track
1 overdue                       → At risk
2 or more                       → Behind
```

It used to compare progress against elapsed calendar time, and that was wrong in a way I
only saw on my own data. A task ran Sep 9 to Sep 20 with three sub-tasks due Sep 15, Sep 17
and Sep 20. On Sep 14, nothing done, it read **Behind**, because 45% of the days had gone
and 0% of the work. Nothing was due yet. The task was exactly on plan.

The old rule never read a single deadline. It also moved in 33-point steps on a three-item
task, so finishing one item the next day would still have read At risk.

The badge now agrees with a number that is already on the screen next to it. The panel
header prints "2 overdue" beside the badge, so the badge explains itself. The old rule's
number, the pace gap, appeared nowhere.

When no sub-task carries a date there is no deadline to measure, so the old pacing
comparison stays as the fallback, unchanged. The fork is on whether dates exist, not on
whether anything is overdue.

### Paused

`status: paused` on a goal means you are not working on it. Its tasks stop producing next
moves, overdue counts and daily-note rows. Nothing is deleted, and the goal moves to a
collapsed group at the bottom of `🎯 Goals`.

The cascade is computed, never written. A task's effective paused state is its own status
or its goal's, worked out at read time. Pausing a goal with fifteen tasks touches one file.
That keeps resume symmetrical, keeps each task's own status intact through the round trip,
and means a task you paused deliberately stays paused when the goal comes back.

Resuming offers to shift every remaining date forward by however long the work sat paused,
so a three-month pause does not resume three months behind. Completed sub-tasks are never
touched, because their `✅` is a real historical date.

---

## The timeline

Every task note draws a chart of its own sub-tasks. One row per sub-task, in document
order, because the order you wrote them in is the plan.

A sub-task with a `📅` gets a bar. Its start is its `🛫`, or its `⏳`, or the previous
sub-task's deadline, or the task's start date, in that order. A sub-task with `🛫` and no
`📅` becomes a milestone marker.

A sub-task with neither used to become a chip below the chart, which meant a task with a
real plan and no per-item dates drew an empty chart. Now, if the task has a start and an
end, undated sub-tasks spread evenly across that window as **projected** bars. Click one
and it writes its projected date into the line as a real `📅`. That is how a guess becomes
a commitment.

A projected bar can never be overdue. It has no deadline, so the health rule skips it. A
projected slot that has already passed is drawn differently, which is a hint and not an
alarm.

---

## The theme

Two modes, set in `⚙️ Settings`. **Community theme** follows whatever Obsidian theme you
have installed. **Match image** builds a palette from your banner image and goes light or
dark to match it.

Every colour in the stylesheets reads through a variable with the old value as its
fallback:

```css
--bg:    var(--storm-bg, #0a0d11);
--faint: var(--storm-faint, #8899a9);
```

So one file of `--storm-*` definitions on `body` repaints the whole vault, and a vault with
no theme file looks exactly as it did before any of this existed. The dashboard writes that
file, `.obsidian/snippets/storm-theme.css`, whenever the theme changes.

It used to paint only the dashboard, because the rule was scoped to the dashboard's own
output and died at the edge of the note. Goal notes, task notes, the indexes and the daily
tables all kept the built-in blue.

In match mode the file also hands the palette to Obsidian's own variables, so a plain note,
the sidebars and the modals agree with the dashboard. It sets link colours there too.
Obsidian derives link colour from your accent colour, and mine was set to black, so on a
dark theme every internal link rendered black on near-black. That was my setting and not a
bug in the vault, but the vault should not depend on it.

Community mode never writes that second block. Community mode reads those variables to
build the palette in the first place, so writing them back would be circular.

Turn the snippet off, delete it, or switch to Community, and the vault goes straight back to
your installed theme with nothing of mine on it.

### Contrast

A palette generated from an arbitrary photo can produce any colour at all, so the generator
corrects every colour it produces against the surface it actually lands on. An automated
audit renders each surface in a real browser, walks every element that holds text, reads the
computed foreground and the effective background, and measures the WCAG ratio. It fails
anything under 4.5:1 for normal text, and 3:1 for large text and for the chart marks that
carry meaning.

The first full run found 3,469 failing elements in 18 root causes. The most embarrassing
was the light e-ink theme rendering the greeting at 1.07:1, which is white on white.

Three things the audit taught me that I would not have guessed:

- The worst background is usually not the card. Half the interface paints a translucent
  layer on top of the card, so a colour has to clear the ratio one step further in.
- A status chip tints its own background with its own colour, which drags the two together
  and costs about 0.3 of a ratio.
- Dimming a whole element with `opacity` to show a "done" or "paused" state pushes an
  already-marginal colour far under. Dashed borders, a flat background and strikethrough
  carry the state instead, and they also work without colour.

---

## Where it stops being notes

Twice. Two small bundled plugins do jobs a Dataview block cannot do, because a block only
runs while its note is being rendered. A wind-down nudge has to fire whether or not you
have a note open, and a reading view has to own its own pane. Everything else in this vault
is Markdown, CSS and one DataviewJS block per screen.

---

## If you want to change it

The vault under `Storm Dashboard Vault/` is build output. The sources live in `dev/`, with
the build, the tests and a much longer architecture document. `dev/README.md` has the
thirty-line version of how to build and test.

The short version:

```sh
cd dev
npm install
npm run build
npm test
```

Ten test suites run every shipped block in a real browser against a fake vault, then assert
the exact lines each button wrote. They exist because four screens compute the same numbers
from the same notes, and the only way to keep them honest is to check.
