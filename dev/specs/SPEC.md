# Storm Vault — Goal/Task system + Dashboard rebuild: SHARED SPEC (v1)

Everything in `dev/` builds to THIS contract. Do not invent alternative field names or
class names. Working dir: `dev/`. The vault it produces is `Storm Dashboard Vault/` at the
repo root; the 1.0.0 stylesheet it starts from is vendored at
`dev/base/.obsidian/snippets/storm.css`.

This document is the spec the system was built to, kept as written. Where it names a
"personal" and a "template" vault, read: two VARIANTS of the same build. The repo carries
one, `dev/template/`, and a variant is nothing but a directory of seed notes plus a
`variant.json` — see `dev/README.md`. Nothing about any private variant is recorded here.

Obsidian environment: Dataview (DataviewJS), Templater, Tasks plugin (emoji format), Pomodoro Timer, Homepage.
Today (for examples) = 2026-09-12.

## 1. Data model

Folders (vault root): `Goals/` and `Tasks/`. (`Projects/` is retired; its notes are converted into these.)

### Goal note  `Goals/<Goal name>.md`
```yaml
---
type: goal
status: active          # active | paused | done
area: Podcast           # free text, groups goals
target: 2026-12-31      # optional ISO date (goal deadline)
tags:
  - goal
---
```
Body: a heading, a one-paragraph outcome, then the goal panel block (see §5), then free notes.

### Task note (top-level task)  `Tasks/<Task name>.md`
```yaml
---
type: task
goal: "[[Goal name]]"   # wikilink to the goal note (basename). REQUIRED.
status: active          # backlog | active | waiting | done
start: 2026-09-01       # ISO date. Used by the Gantt. May be empty → task sits in the Backlog lane.
end: 2026-10-15         # ISO date. Used by the Gantt. May be empty.
completed:              # ISO date, set when status becomes done
tags:
  - task
---
```
Body must contain a `## Sub-tasks` section holding the sub-tasks as checkboxes:
```
## Sub-tasks
- [ ] Confirm guest 📅 2026-09-18
- [x] Write the pitch 📅 2026-09-10 ✅ 2026-09-11
- [ ] Draft the arc
```
- Sub-task "do by" date = Tasks-plugin due emoji `📅 YYYY-MM-DD` (Dataview exposes it as `t.due`, a Luxon DateTime).
- Completion date = `✅ YYYY-MM-DD` (Dataview: `t.completion`). Written by the Tasks plugin AND by the dashboard toggle.
- Sub-tasks are excluded from the goal Gantt (only top-level tasks are bars). A task bar's FILL = done/total sub-tasks.
- Sub-tasks MAY be undated; undated ones are still shown, sorted after dated ones.

### Status semantics
- `status: active` on a task = the dashboard on-switch. Only active tasks contribute "next moves" to the dashboard.
- backlog / waiting tasks appear on the goal note (Gantt + list) and the Tasks board, not on the dashboard's next-move list.
- done tasks: keep `completed:` date; shown as finished bars on the Gantt; excluded from next moves.

## 2. Core rules (implement identically everywhere)

**Task sources (for anything "task"):** only notes in `Tasks/` with `type: task`. Never scan the whole vault.
**Exclusions (every query):** lines tagged `#habit` (any `#habit/*`), anything under `Fitness/`, `_templates/`, `.trash/`, `_archive/`, `Archive/`.

**Next move (per active task):** the earliest UNCHECKED sub-task by `📅` date; if no dated unchecked sub-tasks remain, the first unchecked sub-task in document order. Undated sub-tasks always sort after dated ones. A task with zero unchecked sub-tasks has no next move (dashboard nudges "all sub-tasks done — mark task complete?").

**Overdue sub-task:** unchecked AND `📅 < today`.  **Due today:** unchecked AND `📅 == today`.

**Progress:** task progress = done sub-tasks / total sub-tasks (0 if none). Goal progress = sum(done) / sum(total) across its tasks (weighted by sub-task count); if a goal has no sub-tasks at all, use done tasks / total tasks.

**Health (task or goal)** — by DEADLINES, not by elapsed calendar time (HEALTH contract):
```
overdue = unchecked sub-tasks whose 📅 is strictly BEFORE today   # due today is NOT overdue
remaining = unchecked sub-tasks
for a GOAL: overdue / remaining are totalled across its NON-PAUSED tasks
            (paused work is never late), and "dated" means any of those tasks
            has a sub-task with a 📅 anywhere

if status == done          → "done"
if status == paused        → "paused"
if start or end missing    → "unscheduled"    (neutral badge; not counted as at-risk)
if NO sub-task has a 📅     → fall back to the old pacing rule, unchanged:
      elapsed = clamp((today - start) / (end - start), 0, 1)
      gap = progress - elapsed;  gap >= -0.10 → "ok";  gap >= -0.30 → "risk";  else "behind"
if end < today and work remains → "behind"
else if overdue == 0       → "ok"        (on track)
else if overdue == 1       → "risk"      (at risk)
else                       → "behind"
```
start/end for a goal = `min(task.start)` / `goal.target || max(task.end)`.
Badge labels: ok="On track", risk="At risk", behind="Behind", done="Done", unscheduled="Unscheduled", paused="Paused".

The badge now explains itself with a number that is already on screen: the Timeline header
prints "N overdue" right beside it. The old rule's number (the pace gap) appeared nowhere,
and on a three-item task progress could only move in 33-point steps.

**Inbox (one-off actions, NOT part of the goal system):** unchecked, non-blank, non-`#habit` checkboxes found under the `## ⚡` heading (the "⚡ Tasks" section) of daily notes in `Daily/` whose date is within the last 7 days (today inclusive). Daily notes older than 7 days are ignored (this is the non-destructive "archive" policy — nothing is edited).

**Dates:** compare by local ISO date string `YYYY-MM-DD` (helper `localIso(d)`), never by ms across timezones. Dataview dates → `x.toISODate()`.

## 3. Dashboard (`Dashboard.md`) — Agent A

Keep EVERYTHING that exists today except where this spec changes it: clock/greeting, pomodoro (plugin-bound), calendar, habits (heatmap/streaks/toggle/add), workout card + log, job search card + add, reading card, notes index + search + quick note, mini graph, music player, theme match/community machinery, e-ink toggle, nav pills, banner.
Structure of the 1.0.0 file the rebuild started from (1154 lines):
- lines 1–11 frontmatter (vault-specific — see §3.6), line 13 "```dataviewjs", line 14 "try {"
- lines 15–144: helper functions (_two, _esc, _mulberry32, _layoutGraph, theme helpers incl. _themeRule/_paletteFromImage) → KEEP VERBATIM
- lines 145–394: `function buildHub(d)` → REWRITE
- lines 396–863: `function initHub(root)` → REWRITE (preserve existing behaviours listed above; reuse their code)
- line 865: `if(typeof module!=="undefined") module.exports={buildHub,initHub,_two};` → keep
- lines 868–1149: live data → REWRITE/EXTEND;  1150–1154: catch + closing fence → keep

### 3.1 Action strip (replaces the vault-stats strip)
`<div class="actstrip">` of six `<div class="act" data-filter="…">` tiles: Next moves (`nm`), Due today (`today`), Overdue (`over`), Goals at risk (`risk` = goals with health risk|behind), Focus (`focus`, sessions today / goal, not a filter), Streak (`streak`, not a filter). Each tile: `<div class="n">count</div><div class="l">label</div>`. Add class `hot` when Overdue>0 or Goals at risk>0 on those tiles. Clicking a filterable tile toggles class `active` on it and sets `data-filter` on `.nowcard` so only matching rows show (`nm` = all next moves, `today` = due-today rows, `over` = overdue rows); clicking again clears.
The old Notes/Attachments/Folders/Tags numbers move to `⚙️ Settings.md` (Agent D adds a small block there); the dashboard no longer shows them.

### 3.2 Hero
Add One Thing into the hero (`.greet`): `<div class="hero-one" data-action="edit-one"><span class="k">🎯 One thing</span><span class="v">…text or "Set today's one thing →"…</span></div>`. Click → inline `<input>` (class `one-inp`); Enter saves by writing the `→ <text>` line under `## 🎯 One thing` in today's daily note (create today's note via the daily-notes command first if missing, same getToday() approach as now). Escape cancels.

### 3.3 Now card (replaces the ⚡ Today card)  `<div class="card span-4 nowcard" data-filter="">`
Order inside:
1. `<h3>⚡ Now <span class="sp">N next moves</span></h3>`
2. If today's daily note is missing: `<button class="starttoday" data-action="open-today" data-today="…">▶ Start today</button>` (creates it with the template).
3. Universal Add box (§3.4).
4. Next moves grouped by goal: for each goal that has ≥1 active task with a next move: `<div class="nm-group"><div class="nm-ghead" data-link="<goal path>">🎯 Goal name <span class="hb <health>">label</span></div>` then one `.nm-row` per active task:
   `<div class="nm-row" data-path="<task path>" data-line="<sub-task line>" data-due="<iso or ''>" data-kind="next">` containing
   `<span class="nm-box" data-toggle-path data-toggle-line>` · `<span class="nm-text">sub-task text (emoji dates/tags stripped)</span>` · `<span class="nm-date over|today|">Sep 18</span>` · `<span class="nm-task" data-link="<task path>">Task name</span>` · `<span class="nm-acts"><button class="nm-act" data-resched="today">→ today</button><button class="nm-act" data-resched="tomorrow">→ tmrw</button><button class="nm-act" data-expand>▾</button></span>`
   Expanding shows `.nm-sub` rows = ALL unchecked sub-tasks of that task (same row anatomy, `data-kind="sub"`), plus a `.nm-markdone` button "✓ Mark task complete" when the task has zero unchecked sub-tasks.
   Goals ordered: worst health first (behind, risk, ok, unscheduled). Tasks within a goal: by next-move date asc, undated last.
5. `<div class="nm-sec">Overdue <span>N</span></div>` + `.nm-row` (data-kind="over") for every overdue sub-task across active tasks NOT already shown as a next move. Skip section if none.
6. `<div class="nm-sec">Inbox <span>N</span></div>` + `.nm-row` (data-kind="inbox") for inbox one-offs (toggle + `✕` delete as today's `.del`), with `data-path` = the daily note path. Empty state text: "Inbox clear."
7. Shutdown inline: `<div class="shutdown"><div class="sd-row"><label>🏆 Win</label><input class="sd-inp" data-sd="win"></div><div class="sd-row"><label>⏭ Next step</label><input class="sd-inp" data-sd="next"></div></div>` — Enter writes into today's note's `## 🌙 Shutdown` section: replaces the text after `**Win of the day:**` / `**One next step on anything I touched:**` respectively. Prefill from today's note if already set.
8. Footer link "📓 Open today's note →" (keep).

Row toggle behaviour (`.nm-box`): reuse the existing `toggleLine()` (it already flips `[ ]`↔`[x]` and appends/strips `✅ YYYY-MM-DD`). After toggling a `Tasks/` line, if that task now has zero unchecked sub-tasks, show a Notice "All sub-tasks done — mark <task> complete?" (no auto-flip). `data-resched`: rewrite the row's line: replace an existing `📅 YYYY-MM-DD` or append one, with today's/tomorrow's ISO; then refresh. `.nm-markdone`: `processFrontMatter` → `status: done`, `completed: <today>`; refresh.
After any write call `app.metadataCache.trigger("dataview:refresh-views")` (existing `refresh()`).

### 3.4 Universal Add box  `<div class="uadd"><input class="addinput" data-uadd placeholder="Add… (task: · sub: · goal: · habit: · note: · job: · or just type an inbox item)"><button class="addbtn" data-uaddbtn>＋</button><span class="help" title="…">?</span></div>`
Grammar (case-insensitive prefix, trimmed):
- `task: <name> [@<goal>] [<start>-<end>]`  → create `Tasks/<name>.md` from the Task template shape (type task, goal link — if `@goal` omitted and exactly one active goal exists use it, else leave empty and open the note), status active, dates if given, empty `## Sub-tasks` with one blank box. Open the new note.
- `sub: <text> [<date>] -> <task>`  (also accepts `→`)  → append `- [ ] <text> [📅 iso]` to the end of that task's `## Sub-tasks` section (fuzzy match task by basename, case-insensitive prefix/contains; if ambiguous, Notice and do nothing).
- `goal: <name> [@<area>] [<target>]` → create `Goals/<name>.md` (type goal, active) including the goal panel block (`_scripts/goal-panel.txt` content is embedded by the assembler as a JS string constant `GOAL_PANEL`). Open it.
- `habit: <label>` → existing addHabit.   `note: <title>` → existing addQuickNote.   `job: Company — Role` → existing addJobApp.
- otherwise → inbox one-off: append `- [ ] <text>[ 📅 iso][ #tags kept]` under `## ⚡` in today's note (create today's note first if missing).
Natural dates (parse at the END of the text, or before `->`): `today`, `tomorrow`, `tmrw`, weekday names (`mon`…`sunday` → next occurrence, today if same day), `+Nd`, `M/D`, `M/D/YYYY`, `YYYY-MM-DD`. Return `{text, iso}`; strip the date token from text. Date ranges for `task:` = `<date>-<date>` with the same forms (e.g. `9/15-10/10`, `2026-09-15-2026-10-10`).
Expose the parser as `function parseAdd(raw, ctx)` → `{kind, name, text, goal, area, task, iso, start, end, tags}` so it is unit-testable (it must live inside the dataviewjs block; tests extract it by name).
Remove the five per-card add rows (habits, projects, notes, jobs, today) — the universal box replaces them. Keep the notes card's `notesearch` filter input.

### 3.5 Card order + Reference collapse + other cards
Grid order: banner, nowCard, pomoCard (Focus — its "Next up" select options = next-move texts + habits), habitCard, workoutCard, goalCard, jobCard, pulseCard, then a wrapper `<div class="refsec" data-ref>` containing `<div class="reftoggle" data-action="toggle-ref">▾ Reference · Calendar · Reading · Notes · Graph · Music</div>` and calCard, readCard, notesCard, graphCard, musicCard. Toggle adds/removes class `collapsed` on `.refsec` and persists in `localStorage["storm.refCollapsed"]` (try/catch).
`goalCard` (span-8, replaces Projects card): one `.gc-row` per non-done goal: name (data-link), area, `.hb` health badge, progress `.gc-bar`, "N tasks · M active", "gantt →" (opens the goal). Footer link to `🎯 Goals` index and `📋 Tasks` board.
`pulseCard` (span-4, "📈 This week"): sub-tasks done this week (Mon–today) `.pn`, active tasks, streak, and "stale" = active tasks whose next move is > 14 days overdue OR active tasks with no `✅` in 14 days → "Triage →" link to `🧹 Triage`.
Nav pills: replace `{ic:"🚀",label:"Projects",link:"📊 Projects"}` with `{ic:"🎯",label:"Goals",link:"🎯 Goals"}`.

### 3.6 Vault variants (the assembler emits one Dashboard per variant)
Everything that differs between two vaults built from these sources lives in that vault's
`dev/<variant>/variant.json`, and nowhere else:
- `dashboard.frontmatter` — the note's YAML, verbatim, as a list of lines. The template's is
  `name: there` + `stormMode: community`; a vault that themes itself from its banner image
  carries `stormMode: match` plus its own `stormBanner`/`stormTheme`/`stormThemeSrc`.
- `dashboard.bannerPath` / `dashboard.bannerName` — the fallback banner, when the vault has
  no `Images/Banner/` of its own.
- `dashboard.nameExpr` — the JavaScript expression assigned to `const NAME`, i.e. who the
  greeting addresses. The template reads it from its own frontmatter:
  `(_selfFm.name || "there")`.
- `writeAppearanceJson` — true for a vault created from scratch; false for one deployed into
  somebody's existing vault, whose `.obsidian/appearance.json` must not be overwritten.
`dev/dashboard/livedata.js` carries a `/* @@VARIANT@@ */` … `/* @@/VARIANT@@ */` block whose
contents the assembler REPLACES with those constants. The placeholder inside the sentinels is
never shipped; do not put a real vault's data there.
Deliverables: `dev/build/<variant>/Dashboard.md` (+ the assembler `dev/assemble_dashboard.py`
and the source parts under `dev/dashboard/`). `tests/A/variants.js` builds a throwaway second
variant at run time and proves the seam holds.

### 3.7 Live data additions (computed in the dataviewjs block, passed in `data`)
`goals[]` {name, path, area, status, target, health, progress, tasks:[…], nTasks, nActive}, `tasks[]` (all task notes) {name, path, goalName, goalPath, status, start, end, completed, subs:[{text, line, due(iso|""), done, completion}], done, total, progress, health, nextMove}, `nextMoves[]`, `overdue[]`, `dueToday[]`, `inbox[]` {text, path, line, due}, `pulse` {doneThisWeek, activeTasks, stale, streak}, `strip` {nm, today, over, risk, focus, goal, streak}, `todayExists` (bool), `oneThing`, `shutdown` {win, next}. Keep existing: stats (still computed, for Settings/back-compat), habits, cal, workout, jobs, reading, music, notes, graph, pomodoro.
Sub-task text for display: strip `📅|⏳|🛫|✅|➕|⏫|🔼|🔽|⏬|🔁` + their dates and `#tags`, collapse whitespace.

## 4. Templates + daily note — Agent B2
- `_templates/Goal.md` — Templater: prompt for name, rename, frontmatter per §1, `# <title>`, nav line `[[🎯 Goals|← Goals]]　·　[[Dashboard|Dashboard]]`, `## 🎯 Outcome` blurb, then the goal panel block (`_scripts/goal-panel.txt` content pasted inline, inside a ```dataviewjs fence), then `## 🗒️ Notes`.
- `_templates/Task.md` — Templater: prompt for name and (optionally) goal; frontmatter per §1 with `start: <today>`; body: nav, `> Sub-tasks below show on the Dashboard as your next move…`, `## Sub-tasks` with one blank box, `## 🗒️ Notes`.
- `_templates/Daily Note Template.md` — REWRITE with this exact top so the frontmatter is line 1 (fixes the duplicate-frontmatter bug):
  ```
  ---
  date: <% tp.date.now("YYYY-MM-DD") %>
  tags:
    - daily
  ---
  <%* await tp.file.rename(tp.date.now("YYYY-MM-DD") + " " + tp.date.now("dddd")) -%>
  ```
  Then `# <% tp.date.now("dddd, MMMM D") %>`, nav line, `## 🎯 One thing` (unchanged), `## ⚡ Tasks` = the one-off inbox (keep the blank `- [ ] `; REMOVE the old `tasks` code block; update the blurb: goal work lives in Tasks/ notes, this section is for one-offs), NEW `## 📅 Planned today` + NEW `## ✅ Done today` (each a ```dataviewjs block from `_scripts/daily-tables.txt`, see §6), then `## 🔥 Habits` (unchanged lines, same #habit tags), `## 🏋️ Workout` (unchanged block), `## 📝 Notes`, `## 🌙 Shutdown` (unchanged two bold fields).
Deliverables under `dev/common/_templates/` and `dev/common/_scripts/daily-tables.txt`.

## 5. Goal panel (Gantt) — Agent B1 → `dev/common/_scripts/goal-panel.js`
One vault file, bare JavaScript, called from every goal note through `dv.view` (CONTRACT A). It:
1. Reads `me = dv.current()`; collects tasks = `dv.pages('"Tasks"').where(p => p.type==="task" && linksTo(p.goal, me))` (`p.goal` may be a Link object with `.path` or a string `[[Name]]`; match on basename or path).
2. Computes per-task subs/progress/health and goal progress/health per §2 (same formulas — no drift).
3. Renders into `this.container`: `<div class="goalhead"><span class="goal-hb hb <health>">label</span> <span class="goal-prog">NN%</span> <span class="goal-meta">N tasks · window Sep 1 – Dec 31</span></div>` then the Gantt: `<div class="gantt-wrap"><svg class="gantt" viewBox="0 0 <W> <H>">` with a month axis (`.g-axis` ticks + labels), one `.g-row` per DATED task (sorted by start): label at left (`.g-label`, truncated), bar `rect.g-bar.st-<status>` from start→end, inner `rect.g-fill` width = progress, `line.g-today` vertical marker, bars clickable (`data-link`=task path via a `<g data-link>`). Undated tasks listed below the SVG in `<div class="g-backlog">Backlog: …chips…</div>`. Then `<div class="g-tasklist">` rows: status chip, task name (link), next move text + date, progress "3/8".
4. Chart window = min(start) → max(end, goal.target, today+7d); at least 8 weeks wide; W=1000 logical units; row height 26; label column 220.
5. Wire clicks with `app.workspace.openLinkText(path,"",false)`; wrap everything in try/catch printing an error div. No external libs.
Also produce `Goals/🎯 Goals.md` (index: `.goalsidx` of `.gi-card` per goal: name/area/health/progress/N tasks; sorted worst-health first; create-a-goal hint) and `Tasks/📋 Tasks.md` (board `.tasksboard` with `.tb-col` per status backlog/active/waiting/done, `.tb-card` = task name, goal, dates, progress, next move). Both as dataviewjs notes with `cssclasses: [dashboard]` frontmatter.

## 6. Daily dynamic tables — Agent B2 → `_scripts/daily-tables.txt` (two fenced dataviewjs blocks, clearly separated by a line `<!-- SPLIT -->`)
Resolve `day = (dv.current().date ? dv.current().date.toISODate() : dv.current().file.name.slice(0,10))`.
- **Planned today**: every sub-task in `Tasks/` task notes (any status except done) with `t.due` ISO == day. Render `dv.table(["Sub-task","Task","Goal","Status"], rows)` where Task/Goal are `dv.fileLink`s; Sub-task shows a ☐/☑ glyph + cleaned text; wrap in `<div class="dt-wrap">` styling via `dv.container.classList.add("dt-wrap")`. Empty → `_Nothing planned for this day from your task notes._`
- **Done today**: every sub-task with `t.completion` ISO == day, PLUS every task note with `completed == day` rendered as a flagged row ("🏁 Task completed" in the Sub-task column, class `flag`). Summary line above the table: "N sub-tasks across M tasks" (+ "· K tasks completed"). Empty → `_Nothing logged for this day yet — check something off from the Dashboard._`
Both blocks must work when the note's date is in the past (they are per-day, not "today").

## 7. Triage tool — Agent E → `dev/common/🧹 Triage.md`
DataviewJS note (`cssclasses: [dashboard]`). Scans `Daily/` notes from the last 42 days: unchecked, non-blank checkbox lines, EXCLUDING lines with `#habit`, and excluding lines under any heading matching /habit|workout|shutdown|reflection|pomodoro/i (walk headings via `app.metadataCache.getFileCache(f).headings` + `.listItems` or by reading text). Also scans `Note Bank/`. Each `.tr-row`: text, source (`.tr-src` note link + date), and actions `.tr-acts`: `<select class="tr-sel">` of active/backlog task notes + "→ Sub-task" button (appends `- [ ] text` to that task's `## Sub-tasks`, then removes the line from the source note), "→ Inbox" (moves the line into today's note `## ⚡`, creating today's note if needed), "Drop" (removes the line from the source note and appends `- YYYY-MM-DD · text · (from <note>)` to `_archive/Triage log.md`, creating folder/file if needed). Header shows counts; a "Done triaging" hint. Every write via app.vault.read/modify with exact-line matching (verify the line text still matches before removing).

## 8. Seed content — Agent D (Sonnet)
*(This section originally also specified the seed of a private variant. That half is not
part of the public repo and has been removed; only the template's seed is recorded here.
A private variant's seeds live in its own directory, outside this repo.)*

### The template variant (`dev/template/`) — generic, and free of everything in `dev/privacy/terms.json`
Convert the six sample projects into 3 goals + tasks with the template's own generic voice:
- `Goals/💻 Ship the portfolio site.md` (area Side Project, target 2026-11-30) ← tasks `Build the project gallery` (active, 2026-09-01→2026-10-05, subs from the source milestones that remain + 2–3 sensible sub-steps each), `Launch on a custom domain` (backlog, 2026-10-06→2026-11-30).
- `Goals/🧠 Learn TypeScript.md` (area Learning, target 2026-12-31) ← `Convert one JS project to TS` (active, 2026-09-08→2026-10-20), `Build a small typed app` (backlog, 2026-10-21→2026-12-15).
- `Goals/📚 Read 24 books this year.md` (area 2026, target 2026-12-31) ← `Books 10–24` (active, 2026-01-01→2026-12-31, subs Book 1–24 with 1–9 checked).
- `Goals/🏠 Home organization.md` (area Home, paused) ← `Declutter the office` (waiting, undated, 3 subs).
Sprinkle realistic 📅 dates on a few sub-tasks around 2026-09-10 … 2026-09-25 (one or two overdue relative to 2026-09-12, one due 2026-09-12) so the dashboard demo shows Overdue/Due-today. Include one `✅ 2026-09-11` completed sub-task so Done-today tables have data on that date. Also produce `⚙️ Settings.md` addition for the template (its staged Settings is at the template path; if absent, produce a standalone snippet file `settings-stats-block.md`).
Every note gets the nav line `[[🎯 Goals|← Goals]]　·　[[Dashboard|Dashboard]]` (tasks: `[[<goal>|← Goal]]　·　[[Dashboard|Dashboard]]`).

## 9. CSS — Agent C (Sonnet) → `dev/common/storm-additions.css`
Read `dev/base/.obsidian/snippets/storm.css` first: reuse its CSS variables (`--bg, --surface, --surface2, --text, --dim, --faint, --accent, --accent2, --accent-deep, --border, --border2, --good, --warm, --glow`) and existing patterns (`.storm-hub .card`, `.task`, `.box`, `.addrow/.addinput/.addbtn`, `.stat`, `.proj .bar`, `.empty`). Style every class named in §3–§7: `.actstrip .act(.hot,.active)`, `.hero-one(.editing) .k .v .one-inp`, `.nowcard`, `.starttoday`, `.uadd .help`, `.nm-group .nm-ghead`, `.hb.ok/.risk/.behind/.done/.unscheduled`, `.nm-row(.done)`, `.nm-box(.done)`, `.nm-text`, `.nm-date(.over,.today)`, `.nm-task`, `.nm-acts .nm-act`, `.nm-sub`, `.nm-markdone`, `.nm-sec`, `.nm-empty`, `.shutdown .sd-row .sd-inp`, `.goalcard .gc-row .gc-bar .gc-hb`, `.pulse .pn .pl`, `.refsec(.collapsed) .reftoggle`, Gantt `.goalhead .goal-hb .goal-prog .goal-meta .gantt-wrap svg.gantt .g-axis .g-row .g-label .g-bar.st-active/.st-backlog/.st-waiting/.st-done .g-fill .g-today .g-backlog .g-tasklist .g-task`, daily `.dt-wrap table.dt .flag .dt-sum`, triage `.triage .tr-row .tr-src .tr-acts .tr-sel`, index/board `.goalsidx .gi-card .tasksboard .tb-col .tb-card`. Must look right in dark AND light (e-ink) modes using the variables only (no hard-coded colours except semantic: over=warm/red-ish via existing `--warm`, ok=`--good`). Mobile: rows wrap; strip tiles wrap to 3 per row under 700px. Hide `.nowcard[data-filter="today"] .nm-row:not([data-due="<today>"])`-style filtering via attribute selectors is NOT possible for dynamic dates → instead the JS adds classes `is-today` / `is-over` to rows; CSS: `.nowcard[data-filter="today"] .nm-row:not(.is-today){display:none}`, `.nowcard[data-filter="over"] .nm-row:not(.is-over){display:none}`, `.nowcard[data-filter="nm"] .nm-row:not([data-kind="next"]){display:none}`.

## 10. Testing conventions (Agents A, B1, B2, E must self-test; Agent V re-verifies)
**A shared harness already exists and is validated against the current dashboard — USE IT, do not write your own mocks:**
- `dev/tests/lib.js` → `const { withPage, extractBlocks, readFile, assert } = require("../lib.js");`
  `withPage(async (page, errors) => { ... }, { now: "2026-09-12T10:00:00" })` launches Chromium (executablePath already configured), loads the harness, fixes `new Date()` to 2026-09-12 10:00 local, and shims `require("obsidian")` (`window.__notices` collects Notice texts).
- Inside `page.evaluate`: `const H = window.StormHarness;` then `const app = H.mkVault({ "path.md": "content", ... }, { resolvedLinks, tags, plugins, createDaily })`, `const dv = H.mkDv(app, "Dashboard.md")`, `const container = await H.runBlock(src, dv, app)` — returns the rendered container. Writes are visible via `app.__store` (Map path→content) and `app.__log` (ops: modify/create/processFrontMatter/open/trigger/command…). `H.mkDate(iso)` builds Luxon-like dates; `H.DataArray`, `H.parseFrontmatter`, `H.parseTasks`, `H.extractBlocks` are exposed.
- The harness models: Dataview `dv.pages('"Folder"')` / `dv.pages("#tag")` / `dv.pages()`, DataArray property projection (`dv.pages().file.tasks` flattens), Luxon-like `toISODate/toMillis/toFormat/plus/minus/diff/startOf`, page `file.{name,path,folder,link,tasks,etags,tags,day}`, frontmatter `[[wikilink]]` values become Link objects `{path, display}`, tasks `{text (raw incl. emoji), completed, due, scheduled, start, completion, line, path, tags, section}`, `dv.table/paragraph/header/list/el/fileLink/io.load`, `app.vault.*`, `app.metadataCache.{getFileCache→{frontmatter,headings,listItems}, getFirstLinkpathDest, trigger}`, `app.fileManager.processFrontMatter` (real YAML round-trip), `app.workspace.openLinkText` (logged), `app.commands.executeCommandById("daily-notes")` (calls `opts.createDaily(store, rescan)` if supplied so tests can emulate template creation).
- Example: `dev/tests/smoke_existing_dashboard.js` (passes: renders the current dashboard, 11 cards). Copy its shape.
- FACT: 2026-09-12 is a **Saturday** → today's daily note is `Daily/2026-09-12 Saturday.md`. Monday of this week = 2026-09-07.
- Keep tests fast (one browser per file), print `ok  - …`/`FAIL: …` lines via `assert`, exit code 1 on failure. Put them in `dev/tests/<agent>/*.js` plus `run.sh`.
- Playwright is a devDependency of `dev/package.json` and downloads its own chromium on `npm install`. `dev/tests/lib.js` falls back to a pre-seeded `PLAYWRIGHT_BROWSERS_PATH` when one is present, and throws rather than skipping when no browser can be found.
- Extract the dataviewjs source between the fences and run it as `new Function('dv','app','return (async()=>{'+src+'})()')` with `this` bound to `{container: document.createElement('div')}`; provide mocks: `dv.pages(q)` returning DataArray-like arrays with `.where/.map/.array/.find/.sort` (implement a tiny DataArray shim), page objects `{file:{name,path,tasks:[...],link,etags,tags}, type, goal, status, start, end, ...}`, tasks `{text, completed, due, completion, line, path, tags, section}` where dates are Luxon-like objects exposing `.toISODate()`, `.toMillis()`, `.toFormat(fmt)`; `dv.date(x)`, `dv.current()`, `dv.io.load(path)`, `dv.table`, `dv.paragraph`, `dv.header`, `dv.fileLink`, `dv.container`; `app.vault.{read,modify,create,createFolder,getAbstractFileByPath,getMarkdownFiles,getFiles,adapter.getResourcePath,getAllLoadedFiles}`, `app.metadataCache.{getFileCache,getFirstLinkpathDest,trigger,resolvedLinks,getTags}`, `app.workspace.openLinkText`, `app.fileManager.processFrontMatter`, `app.commands.executeCommandById`, `app.plugins.plugins`, `window.require = () => ({Notice: class{constructor(m){log(m)}}})`. Use an in-memory file map so writes can be asserted.
- Each agent writes tests under `dev/tests/<agent>/` and a `run.sh`; all must pass. Also `node --check`-style syntax validation of the extracted JS (wrap in a function). Print a short PASS summary.

## 11. Non-negotiables
- Nothing matching `dev/privacy/terms.json` may appear in ANY shipped output, or anywhere in this repo. `dev/scripts/leakscan.py` is the gate; a single hit fails the build.
- Never modify habit/workout logic or data. Keep all existing dashboard features working.
- All writes to notes go through `app.vault.modify` after `read`, with exact line verification; never rewrite a whole note from a template.
- Use `_two`, `_esc` helpers that already exist (in Dashboard.md) — in standalone notes (goal panel, daily tables, triage) define local equivalents.
- Never write outside the repo. `npm test` writes nothing at all outside `dev/build/`; only `npm run build` updates `Storm Dashboard Vault/`.
