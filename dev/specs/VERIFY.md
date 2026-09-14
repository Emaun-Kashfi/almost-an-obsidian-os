# Verification report — what suite V checks, and what it found

Scope: everything `dev/` builds. Verified the deployable vault against `SPEC.md`, by
reading the sources and by running the real blocks against a harness vault built from
**every file in the built tree** plus a daily note generated from the tree's own Templater
daily template.

This is the record of the verification pass, kept as written on 2026-09-14 and updated for
the repo's layout. It was originally run over two variants of the same build; the private
one's observations are not part of the public record, and the rows that named its notes have
been replaced by the equivalents from the template seed. `bash dev/tests/V/run.sh` re-runs
every check here.

Nothing is deployed by a test. Fixes are made in the **source** parts only
(`dev/dashboard/*.js`, `dev/common/*`, `dev/<variant>/*`, `dev/assemble_dashboard.py`,
`dev/integrate.py`), and the vault is regenerated with `npm run build`.

---

## 1. Defect list

Severity: **H** = wrong/lost data or a broken feature · **M** = visibly wrong behaviour,
recoverable · **L** = cosmetic / hygiene / robustness.

| # | Sev | File(s) | Defect | Status |
|---|-----|---------|--------|--------|
| 1 | **M** | `dashboard/livedata.js` (`inSec`), `common/_scripts/goal-panel.txt`, `common/Goals/🎯 Goals.md`, `common/Tasks/📋 Tasks.md`, `common/🧹 Triage.md`, `dashboard/initHub.js` | **Sub-task heading rule forked.** Dashboard + `addSubTask` + Triage matched `/sub-?tasks/i`; panel/index/board matched `/sub[-\s]?tasks?/i`. A note using `## Sub tasks` or `### Subtask` therefore fell into the dashboard's "no heading → count every checkbox" fallback and counted checkboxes from `## 🗒️ Notes` as sub-tasks, while the panel counted only the real ones. Proven divergence on fixture `B4 spaced heading with notes`: dashboard 3 sub-tasks vs panel 1. | **fixed** — one regex `/sub[-\s]?tasks?/i` everywhere; the two *writers* (`addSubTask`, Triage → Sub-task) use `/^#{1,6}\s+.*sub[-\s]?tasks?\b/i` |
| 2 | **M** | same files | **`#habit` exclusion forked.** Dashboard tested Dataview's `t.tags` with `^#habit(\/|$)`; the three standalone notes tested the raw text with `/#habit/i`, which also swallows `#habitat`, `#habits`, `#habit-tracker`. Proven divergence on fixture `A4 habitat`: dashboard 2 sub-tasks vs panel 1. | **fixed** — one regex `/(^|\s)#habit(\/[\p{L}\p{N}_/-]+)*(?=$|\s)/u` in all five blocks (dashboard, panel, index, board, daily tables) **and** in Triage |
| 3 | **M** | `dashboard/livedata.js` | **Sub-task filter order.** The dashboard dropped `#habit` lines *before* choosing the `Sub-tasks` section, so a note whose `## Sub-tasks` held only habit lines silently fell back to every checkbox in the note; the panel returned an empty set. | **fixed** — section is selected first, then blank/`#habit` lines are dropped (the order SPEC §1 implies and the unification rule states) |
| 4 | **M** | `dashboard/livedata.js` (`linkKey`) | **`goal:` link resolution forked.** The dashboard collapsed the value with `v.path \|\| v.display \|\| String(v)`, which **cannot read an array**: `goal:\n  - "[[Podcast]]"` produced the garbage key `a]],[[b`, so the task fell into the "No goal yet" pseudo-group on the dashboard while the goal note's own panel still listed it. The dashboard also matched case-insensitively while the other three matched case-sensitively. | **fixed** — the dashboard now uses the same `linkNames()` (byte-identical source) and all four match case-insensitively on full path or basename |
| 5 | **M** | `dashboard/initHub.js` (`parseAdd`) | **A trailing `#tag` hid the date.** `Buy batteries tomorrow #home` produced no `📅` at all, because the date parser only looked at the very last whitespace token. SPEC §3.4's own output shape (`- [ ] <text>[ 📅 iso][ #tags kept]`) puts the tags *after* the date, i.e. they are meant to be separable. | **fixed** — `pullDateTags()` peels trailing tags, reads the date, and `addLine()` re-appends the tags after it. Output is now exactly `- [ ] Buy batteries 📅 2026-09-13 #home`. Mid-text tags are untouched (`Email #work the sponsor #urgent` still round-trips verbatim) |
| 6 | **M** | `dashboard/initHub.js` (action-strip filters) | **"Due today" filtered to an empty card.** The tile counts sub-tasks, but a due-today sub-task that is not its task's next move is rendered only inside the pre-rendered `.nm-subs` list, which is `display:none`. In the template vault the tile reads **1** and clicking it showed **0** rows. | **fixed** — `syncSubLists()` reveals exactly the matching rows (minus the duplicate of the visible head row) while `today`/`over` is active and restores the previous state afterwards; a hand-expanded list now survives a filter round-trip (`data-open`) |
| 7 | **M** | `integrate.py` + both `_templates/Daily Note Template.md` | **The daily tables had no single source of truth.** `_scripts/daily-tables.txt` is the canonical block, but both daily templates embed a *copy* and nothing re-substituted it — editing the canonical file left the templates running stale code (exactly what happened when fixing #1/#2). | **fixed** — `integrate.py` now re-embeds both halves of `daily-tables.txt` into the `## 📅 Planned today` / `## ✅ Done today` blocks of each vault's daily template on every build (asserting the headings + blocks exist); the two source templates were re-synced so B2's byte-equality test still holds |
| 8 | **M** | `common/_scripts/daily-tables.txt` | **Planned/Done scanned every checkbox of a task note**, ignoring the `## Sub-tasks` section, `#habit` lines, blank boxes and the `Fitness/` exclusion — so a dated checkbox in `## 🗒️ Notes` appeared in "Planned today" but never on the dashboard. Its `clean()` also stripped *any* `YYYY-MM-DD` (including dates that are part of the text) and used a non-unicode `#[\w/-]+` tag regex. | **fixed** — both blocks use the shared `subsOf()` + the shared `clean()` |
| 9 | **L→M** | `dashboard/initHub.js` (`goalNotes`/`taskNotes`) | **The index notes were pickable destinations.** `Goals/🎯 Goals.md` and `Tasks/📋 Tasks.md` have no `type:`, so they passed the `!x.type` tolerance filter: `sub: … -> Tasks` could append a checkbox into the task **board**, and — worse — `🎯 Goals.md` counted as an "active goal", so the "exactly one active goal → auto-assign it" shortcut in `task:` never fired in a vault with one real goal. | **fixed** — notes declaring `cssclasses: dashboard/storm-home` are excluded from both pickers |
| 10 | **L** | `dashboard/initHub.js` (`createGoalNote`) | **`goal: X @<area>` could emit invalid YAML.** The area is free text written unquoted: `goal: Ship it @Q4: crunch` produced `area: Q4: crunch`, which Obsidian cannot parse (broken properties block on a brand-new note). | **fixed** — the area is JSON-quoted whenever it is not a plain word |
| 11 | **L** | `assemble_dashboard.py` | Build sentinels `/* @@VARIANT@@ */` survived into both shipped `Dashboard.md` files. | **fixed** — the assembled file now carries `/* vault variant: personal */`; the `@@` markers exist only in `dashboard/livedata.js` |
| 12 | **L** | `common/_scripts/goal-panel.txt`, `🎯 Goals.md`, `📋 Tasks.md` | **Default `status` forked**: a task note without a `status:` was `active` for the dashboard but `backlog` for the panel/index/board, and the standalone notes did not `.trim()` the value (`status: "active "` → `status==="done"` checks and `st-` classes both misbehave). | **fixed** — default `active` + `.trim()` everywhere (matches SPEC §1's Task template and the dashboard's on-switch) |
| 13 | **L** | same three notes + `daily-tables.txt` | **Folder-exclusion list forked**: SPEC §2 names `Fitness/` but only the dashboard excluded it, and the dashboard anchored the pattern at the path root (`^Fitness/`) while the others used `(^|/)`. | **fixed** — `/(^|\/)(Fitness|_templates|_archive|Archive|\.trash)(\/|$)/i` in all five |
| 14 | **L** | `common/_scripts/goal-panel.txt`, `🎯 Goals.md`, `📋 Tasks.md`, `daily-tables.txt`, `livedata.js` | **`clean()` forked four ways** (bare `📅` with no date; `🔺` vs `⏬`; `#2026`-style numeric tags; mid-word `a#tag`). This feeds the "blank box" test, so it could change *counts*, not just labels. | **fixed** — one four-pass cleaner everywhere, using Obsidian's own tag rule (`#` preceded by start/space, must contain a letter or `_`) |
| 15 | **L** | `template/_templates/Daily Note Template.md:10` | The daily template's weekly link used `tp.date.now("YYYY-[W]WW")`; `YYYY` + an ISO week number mislabels the week across a year boundary (2026-12-28 → `2026-W01`, should be `2027-W01`). The personal vault already used `GGGG`. | **fixed** — both vaults now use `GGGG-[W]WW`; `tests/B2/templates.test.js`'s "nav line kept verbatim" assertion now allows exactly that one token substitution and additionally fails if any `YYYY-[W]WW` survives |
| 16 | **M** | `dashboard/livedata.js`, `common/_scripts/goal-panel.txt`, `common/Goals/🎯 Goals.md`, `common/Tasks/📋 Tasks.md`, `common/_scripts/daily-tables.txt` | **Sub-task selection only read the innermost heading** (`t.section.subpath`), so checkboxes under `## Sub-tasks` › `### Phase 1` silently dropped out of progress, next move and the daily tables. | **fixed** — all five now share `subMarks()`/`subsOf()`: the note's headings are walked keeping a **level stack** (a level-L heading pops every heading of level ≥ L) and a checkbox counts when any heading on the stack matches `/sub[-\s]?tasks?/i`. Fallbacks kept: no such heading anywhere → every checkbox; blank boxes and `#habit` lines never count; if the metadata cache yields no headings it degrades to the old innermost test |
| 17 | **M** | `dashboard/initHub.js` (`toggleLine`, `markFocusDone`, `reschedule`) | **A trailing block id was pushed out of last position.** `- [ ] Draft ^outline-1` became `- [x] Draft ^outline-1 ✅ 2026-09-12`, and Obsidian stops resolving a block reference that is not terminal. `reschedule()` had the identical flaw with `📅`. | **fixed** — shared `stampAtEnd()` inserts before a trailing `\s\^[A-Za-z0-9-]+$`, `stampDone()`/`stripDone()` wrap it; un-checking already stripped `✅` wherever it sat and is now covered by a test. The shared `clean()` also strips a trailing `^id` so block ids no longer leak into the rendered row text |

### Not fixed — reported instead

(Findings 15–17 were raised here in the first pass and have since been closed at the coordinator's request; they are in the table above.)

| # | Sev | File | Finding | Recommendation |
|---|-----|------|---------|----------------|
| 18 | **M** | the built `Dashboard.md` | Size headroom was **thin** at the time: ~128 KB against a 130 KB budget (≈1.9 KB left). CONTRACT A has since removed the embedded panel, and `tests/A/variants.js` now guards a 140 KB ceiling against accidental duplication. SPEC §3.4 requires the goal panel to be embedded as the `GOAL_PANEL` string constant, so the panel ships twice and every byte added to `_scripts/goal-panel.txt` costs ≈1.15 bytes in each Dashboard too. | not a defect today, but the next feature added to the panel will breach it. The remedy is a SPEC §3.4 decision: let `createGoalNote()` read `_scripts/goal-panel.txt` via `dv.io.load()` (keeping the constant only as a fallback would not help — the constant has to go to reclaim the ~14 KB). |
| 19 | **info** | `.obsidian/snippets/storm.css` | 18 emitted classes carry no rule of their own. All are accounted for: JS hooks (`js-clock`, `js-secs`, `js-date`, `js-greet`, `pomo-live`), `<style>` elements, Obsidian/Dataview-owned (`dataview`, `table-view-table`, `internal-link`), inline-styled error divs (`goal-err`, `triage-error`), children of styled parents (`dur`), and state flags fully covered by a co-class (`expanded`, `nm-inbox`, `pill-toggle`, `pulse`, `tr-bulk`). SPEC §9's `.pulse .pn .pl` requirement is met through `.storm-hub .pn` / `.pl`. | `tests/V/css_audit.py` now carries that allow-list with a reason per class and **fails on anything new**. |
| 20 | **info** | `.obsidian/snippets/storm.css` | Exactly **one** selector is declared in both the original 74 KB portion and the appended portion: `.storm-hub`, and only to add the `--behind` token (`var(--warm)` + a `color-mix()` upgrade). No existing declaration is overridden. 717 original selectors vs 316 appended, no other overlap. | none |

---

## 2. What was verified (and how)

* **1a Sub-task definition** — an 18-task synthetic set (`tests/V/fixtures.js`) covering
  `## Sub-tasks`, no heading at all, `## Sub tasks`, `### Subtask`, checkboxes in another
  section, **`## Sub-tasks` › `### Phase 1` (ancestry)**, **`## Plan` › `### Sub-tasks`**,
  a later `## 🗒️ Notes` closing the section, an `# H1` above everything, blank boxes,
  `#habit` lines, `#habitat` look-alikes, bold group headings, a task with zero sub-tasks. Fed to the dashboard, the goal panel, the Goals index, the
  Tasks board and both daily tables; every `done/total`, health label and next move must
  match, and match SPEC §2 arithmetic computed by hand.
* **1b Health / progress / next move** — same table, three-way assertion
  (dashboard `.gc-row` ↔ panel `.goalhead`/`.g-task` ↔ index `.gi-card` ↔ board `.tb-card`),
  including the `-0.10` / `-0.30` boundaries (`Beta` lands on `risk` at gap −0.29,
  `B2` on `behind` at −0.46) and both goal-progress branches (Σsubs, and done-tasks/total
  when a goal has no sub-tasks).
* **1c `goal:` link resolution** — the link helpers are lifted out of all four blocks and
  run against 14 shapes: Link object, `[[Name]]`, `[[Name|alias]]`, `![[Name]]`,
  `[[Name#Heading]]`, bare name, full path, array (match + no match), different case,
  wrong goal, `""`, `null`, `undefined`. All four must agree **and** give the right answer.
* **1d CSS ↔ DOM** — 254 emitted classes extracted from the JS and the notes and matched
  against the combined stylesheet; selector-level duplication check between the original
  and appended portions; `npx csstree-validator` on both trees.
* **2a–2e end-to-end** — the real seed, a real Templater-substituted daily note,
  🏋️ Workouts deliberately absent. `tests/V/e2e_interact.js` drives the chrome that only
  answers to a click (reference collapse, the action-strip filters, a hand-expanded sub-list
  surviving a filter toggle, the One-Thing empty state) and then the seven interactions from
  the brief, each asserted at the **line level** in the written note: ticking a box writes
  `- [x] Book 10 ✅ 2026-09-12`; → tmrw rewrites one 📅 and nothing else; `sub: … -> …`
  appends inside `## Sub-tasks`; a plain add-box line lands under `## ⚡` with its date and
  tag; `goal:` creates a note carrying the ONE-LINE panel call and an area containing `:`
  still parses as YAML; One Thing and the shutdown win write their own lines.
  `tests/V/e2e_notes.js` then re-runs the goal panels, both daily tables (for 09-12 **and**
  09-20), the Goals index, the Tasks board and Triage against the post-interaction vault.
* **2f Template end-to-end** — computed by hand from the template seed: next moves 3,
  due today 1, overdue 2, goals at risk 1, no separate Overdue section (both overdue
  sub-tasks *are* next moves), greeting "there", `storm-banner` fallback, and zero
  occurrences of anything in `dev/privacy/terms.json` in what the Dashboard renders.
* **3 Static** — one fence pair per Dashboard, no `@@` / `TODO(` / `GOAL_PANEL_PLACEHOLDER`
  anywhere in the built vault, size budget, YAML frontmatter of all 21 files per tree via
  PyYAML (the two Templater templates legitimately start with `<%*`), daily template starts
  with `---` and keeps `<%*` out of the frontmatter, `data.json` parses with
  `globalFilter: ""`, every built tree's `storm.css` byte-identical.
* **Extra** — every ```dataviewjs``` block that ships in either tree (39 blocks) is executed
  against the seed vault and must neither throw nor print its own error state; this is what
  covers `⚙️ Settings.md`'s vault-stats block and the daily note's Workout block.
* **Block-id line surgery** (`tests/V/line_surgery.js`) — a task note whose sub-tasks end in
  `^outline-1` / `^room-2` / `^mic-3`, driven through the real Dashboard: check, check a line
  that already carries `📅`, un-check, and `→ tmrw`. Every write must leave the id terminal.
* **Extra** — `tests/V/shared_rules.py` pins the deliberately-duplicated rules
  (`SUBSEC`, `HABIT_RE`, `subMarks`, `subsOf`, `healthOf`, `linkNames`, the five cleaning
  passes, the exclusion list) as character-identical, so a future one-sided edit fails the suite instead of
  silently forking behaviour again.

---

## 3. Test tallies

Run `npm test` from `dev/` for the current numbers. At the time this record was last
updated (2026-09-14, after development moved into the repo):

| Suite | Result |
|---|---|
| privacy · `scripts/leakscan.py` | **PASS** — 0 hits over 25 patterns |
| `tests/A/run.sh` (dashboard + the variant seam) | **PASS** — 194 assertions, 0 failures |
| `tests/B1/run.sh` (goal panel, 🎯 Goals, 📋 Tasks) | **PASS** |
| `tests/B2/run.sh` (templates + daily tables) | **PASS** |
| `tests/E/run.sh` (🧹 Triage) | **PASS** — 95 assertions, 0 failures |
| `tests/G2/run.sh` (task Timeline) | **PASS** — 66 assertions, 0 failures |
| `tests/H/run.sh` (health by deadlines) | **PASS** — 54 assertions, 0 failures |
| `tests/P/run.sh` (paused + ＋ Task) | **PASS** — 146 assertions, 0 failures |
| `tests/T/run.sh` (vault-wide theme) | **PASS** — 180 assertions, 0 failures |
| `tests/V/run.sh` (verification) | **PASS** — 420 assertions, 0 failures |
| `tests/W/run.sh` (colour contrast) | **PASS** — 238 assertions, 0 failures |

`tests/V/run.sh` also re-runs the build twice and asserts the whole built tree
is byte-identical across runs (idempotent build).

---

## 4. Residual risk — what the harness cannot cover

1. **Dataview / metadata-cache heading shapes.** Sub-task selection now walks
   `app.metadataCache.getFileCache(f).headings` (`{heading, level, position.start.line}`),
   which the harness models faithfully — but the real cache can be *cold* for a file Dataview
   has already indexed. The code degrades to the old innermost-`t.section` test when the
   cache returns no headings, so the worst case is the pre-existing behaviour, never a crash.
   Untested for real: a note with two headings of the same text, and `getFileCache` returning
   `null` for a file that is open but unsaved.
2. **Dataview task flattening.** `page.file.tasks` is treated as flat. Indented child
   checkboxes therefore count toward `done/total` in every view. Consistent, but confirm it
   reads the way the user expects on a real note with nested steps.
3. **Templater timing / daily-note settings.** `getToday()` fires
   `app.commands.executeCommandById("daily-notes")` and then polls for
   `Daily/<YYYY-MM-DD dddd>.md` for ~2.2 s. The template renames the file **after** creation
   (`tp.file.rename`), so the poll is racing Templater. If the core Daily-notes plugin is not
   set to folder `Daily/` with format `YYYY-MM-DD dddd`, or Templater's "trigger on new file
   creation" is off, every write that needs today's note (inbox add, One Thing, Shutdown,
   Triage → Inbox, habit add) fails with a Notice instead of writing. **Check these two
   plugin settings first on deploy.** The harness short-circuits this with a `createDaily` hook.
4. **Tasks-plugin `✅` format.** The dashboard toggle appends `✅ YYYY-MM-DD` at end of line,
   bypassing the plugin. Consequences to sanity-check in the real vault:
   (a) **recurring tasks** (`🔁 every week`) will **not** spawn their next occurrence when
   checked from the dashboard — only when checked in the note; (b) block ids are now handled
   (finding 17: `✅`/`📅` are inserted *before* a trailing `^id`), but the ordering of the
   emoji fields themselves is "append at the end", not the plugin's canonical field order —
   the plugin parses either way; (c) the plugin's own "completed date" setting must stay on
   emoji format.
   `globalFilter` is now `""`, so every checkbox is a Tasks task — intended, but it changes
   how the plugin treats habit lines in daily notes.
5. **Pomodoro Timer plugin API.** `plugins["pomodoro-timer"].timer.{subscribe,toggleTimer,
   reset,timeup}` and the `st.{count,elapsed,remained.millis,mode,running,inSession}` shape
   are private API. Every call is guarded (`typeof … === "function"`, try/catch, a Notice
   fallback), so a version change degrades to "Enable the Pomodoro Timer plugin" rather than
   breaking the hub — but the ✓ Done → check-off-the-focus-task chain is untested against a
   real plugin build.
6. **`app.metadataCache.trigger("dataview:refresh-views")`** is undocumented. If Dataview
   changes it, writes will land but views will need a manual refresh.
7. **CSS `color-mix()`** is used for `--behind` (with a plain `var(--warm)` fallback line
   immediately before it). Fine on current Obsidian/Electron; older builds silently take the
   fallback, which is the intended degradation.
8. **Visual layout, light/e-ink mode and mobile** are not covered here — `the a11y suite's screenshots (`node dev/a11y/shots.js`)` are
   the screenshots for that, and they were taken before these changes (only behaviour, not
   markup, changed; no class names were added or removed).
9. **Concurrent edits.** All writes are read→splice→`modify`. If the target note is open with
   unsaved editor state, Obsidian may clobber one side. Standard for this pattern; the
   line-drift fallback (`findLine`) limits damage to "the write lands on the right line".
10. **Emoji filenames.** Everything resolves by full path, which the harness exercises with
    the real names (`Tasks/Books 10–24.md`, `Goals/💻 Ship the portfolio site.md`), but the
    en-dash and emoji round-trip through Obsidian's own link resolver is untested.
