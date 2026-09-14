# Development log

Append-only. **Newest first.** One entry per change set, added at the TOP.

Every commit that touches `dev/` or `Storm Dashboard Vault/` needs an entry here, and the
hooks in `dev/hooks/` refuse the commit without one (after `sh dev/hooks/install.sh`).
This is not paperwork: several models from several vendors work on this repo, none of them
remembers the last session, and the entry below yours is the only thing that tells the next
one why the code is the way it is. Name yourself and your model — honestly, including the
parts you are not sure about.

The shape, which the hook prints back at you when you forget:

    ## YYYY-MM-DD · one short line: what changed, not how
    **Agent:** <tool/model> · **Human:** <who asked>
    **Why:** one or two sentences on the problem, not the diff
    **Changed:** the files, grouped
    **Verified:** which suites ran and their result
    **Risks / follow-ups:** anything left

Entries below 2026-09-14 were written after the fact, from `CHANGELOG.md` and the contracts
in `dev/specs/`. They are reconstructions: the dates and the file lists are real, the
**Agent** lines say only as much as the record actually supports.

---

## 2026-09-14 · development moved into the repo, and made vendor-neutral
**Agent:** Claude Code (Claude Opus 5) · **Human:** the repo owner
**Why:** the vault in this repo was build OUTPUT. Its sources, 24 test suites and 12 contracts
lived only in a throwaway container: nobody could clone the repo and change anything without
re-deriving the whole build by hand. Everything needed to develop the system now lives under
`dev/`, and nothing in it assumes which AI tool is reading it.
**Changed:**
- new `dev/`: `paths.js` + `paths.py` (one path table, two languages), `assemble_dashboard.py`,
  `integrate.py`, `dashboard/`, `common/`, `template/`, `base/`, `tools/`, `a11y/`, `specs/`,
  `tests/{A,B1,B2,E,G2,H,P,T,V,W}`, `package.json`, `scripts/run-tests.sh`
- **every absolute path is gone.** Tests, tools and the auditor each resolved an absolute
  path on the build machine, and some read seed notes out of a staging directory that does
  not exist anywhere else. All of it now resolves from the repo root through `dev/paths.js` /
  `dev/paths.py`, and `tests/V/static_checks.py` asserts the two halves of that table agree.
  `dev/scripts/leakscan.py` treats an absolute home or staging path as a leak, so this cannot
  come back quietly — not even in this file.
- **the build takes a `--variant`.** What used to be two hardcoded vaults ("personal" and
  "template") is now one build driven by `dev/<variant>/variant.json`: frontmatter, greeting
  expression, fallback banner, and whether `.obsidian/appearance.json` is shipped. The repo
  carries one variant, `template`. A private vault is a sibling directory, gitignored, and no
  vault's content can reach the build code — `dashboard/livedata.js` carries a placeholder
  between its `@@VARIANT@@` sentinels and nothing else.
- **the build no longer wipes the vault.** It builds a whole fresh tree into `dev/build/` and
  installs only the files it owns, so `🧭 START HERE.md`, `.obsidian/app.json` and the bundled
  plugins survive a rebuild untouched. `integrate.py --check` compares instead of writing, and
  suite V runs it — which is what keeps the committed vault honest.
- **privacy is a build step.** `dev/privacy/terms.json` holds the forbidden patterns once;
  `dev/scripts/leakscan.py`, `integrate.py`, `tests/V/e2e_template.js` and
  `tests/B2/templates.test.js` all read it, so no two guards can disagree. `npm test` runs the
  scan first.
- **development logging:** this file, `dev/hooks/{pre-commit,commit-msg,devlog-guard.sh}` and
  `dev/hooks/install.sh`.
- suite V's personal end-to-end was re-based onto the template seed as
  `tests/V/e2e_interact.js`; `tests/A/variants.js` now builds a throwaway second variant at run
  time instead of diffing two shipped ones; the colour-contrast engine, which used to be
  duplicated per repo, exists once in `dev/a11y/` and suite W checks that no copy has come back.
**Verified:** `npm test` — 11 suites green, 0 failures (A 194, B1, B2, E 95, G2 66, H 54, P 146,
T 180, V 420, W 238 assertions) plus a 0-hit leak scan. `python3 dev/integrate.py --check` is
byte-identical to `Storm Dashboard Vault/`. A clean clone into a temp directory builds the same
24 files, verified by md5. The build first reproduced the previous vault byte for byte; the
privacy scrub then changed COMMENTS in four of the twenty-four shipped files
(`.obsidian/snippets/storm.css`, `Goals/🎯 Goals.md`, `_scripts/goal-panel.js`,
`_scripts/task-gantt.js`), which named the private build and the directories this was built in.
Strip every `/* … */` from those four and they are identical to the previous vault — no rule,
selector or line of code moved.
**Risks / follow-ups:** `dev/specs/*` are the contracts as written during the original build —
scrubbed of paths and of anything private, but still worded for that build's two-vault world;
`SPEC.md` §3.6 and §8 were rewritten, the rest reads as history. The pre-commit hook can only
warn, never refuse: git writes the commit message after pre-commit runs, so `[skip devlog]` is
readable for the first time in `commit-msg`, and that is where the refusal lives.

## 2026-09-14 · health is measured against deadlines, not elapsed calendar time
**Agent:** Claude Code (Anthropic model; the specific model is not recorded) · **Human:** the repo owner
**Why:** a task whose window ran Sep 9 → Sep 20 with sub-tasks due the 15th, 17th and 20th read
**Behind** on the 14th, because the rule compared progress (0%) against elapsed time (~45%). None
of its deadlines had passed. The rule now counts overdue sub-tasks: none is "on track", one is
"at risk", two or more is "behind", and a task past its end date with work left is "behind".
Undated work falls back to the old pacing rule, which is the only place it makes sense.
**Changed:** `dashboard/livedata.js`, `common/_scripts/goal-panel.js`,
`common/_scripts/task-gantt.js`, `common/Goals/🎯 Goals.md`, `common/Tasks/📋 Tasks.md` —
`healthOf(status, progress, sIso, eIso, opts)` gained the fifth argument and every call site
passes it. `specs/HEALTH.md` is the contract.
**Verified:** suite H (the worked cases in the harness, plus a check that `healthOf()` is
byte-identical across all four standalone copies and that no call site is left on four
arguments); suites A, P, V, W re-run.
**Risks / follow-ups:** the rule is duplicated by design into five self-contained blocks, because
each one ships as a standalone Dataview block. `tests/V/shared_rules.py` and suite H both pin the
copies together. Change every copy or none.

## 2026-09-14 · the colour palette reaches the whole vault, not just the Dashboard
**Agent:** Claude Code (Anthropic model; the specific model is not recorded) · **Human:** the repo owner
**Why:** a palette derived from the banner image stopped at the edge of the Dashboard note. Goal
notes, task notes, the indexes, triage and the daily tables all kept the built-in blue, which made
"Match image" look broken everywhere except the one note it was set on.
**Changed:** every palette literal in `base/.obsidian/snippets/storm.css` and
`common/storm-additions.css` now reads `var(--storm-<token>, <literal>)`; `dashboard/initHub.js`
writes `.obsidian/snippets/storm-theme.css` whenever the theme changes and enables the snippet
through Obsidian's own `app.customCss` API (falling back to a Notice when that internal API is
gone); `integrate.py` generates the default snippet out of the stylesheet's own fallbacks, so the
shipped file is a provable no-op on day one. `specs/THEME2.md` is the contract.
**Verified:** suite T — the computed accent on a goal note, a task note and the board is the
THEMED accent, not "the file was written"; the write path is one file under
`.obsidian/snippets/`, skipped when unchanged, and never touches the user's `appearance.json`.
**Risks / follow-ups:** `--behind` has no literal default — the sheet derives it from `--warm`
with `color-mix()`, which only resolves on the element that declares `--warm`. A generated theme
always carries an explicit `--storm-behind`; the default snippet deliberately leaves the
derivation alone.

## 2026-09-14 · a ＋ Task control on goal notes
**Agent:** Claude Code (Anthropic model; the specific model is not recorded) · **Human:** the repo owner
**Why:** adding a task to a goal meant either typing the goal's exact name into the Dashboard's
quick-add, or copying the Task template and filling in frontmatter by hand. The goal panel already
knows which goal it is on.
**Changed:** `common/_scripts/goal-panel.js` (the control, its open/closed states and the note it
writes), `common/storm-additions.css`. `specs/ADDTASK.md` is the contract.
**Verified:** suite P's `addtask.js` — ten items from the contract, including the closed and open
states in both themes.
**Risks / follow-ups:** none recorded.

## 2026-09-13 · every surface brought to WCAG AA contrast
**Agent:** Claude Code (Anthropic model; the specific model is not recorded) · **Human:** the repo owner
**Why:** the e-ink light theme rendered the greeting, the clock and the date at 1.07:1 — white on
white. An automated audit then found 3,469 failing elements across 18 root causes.
**Changed:** `--faint` moved `#6a7c8c` → `#8899a9`; paused and done states stopped dimming
text-bearing elements with `opacity` and now use dashed edges, flat grounds and strikethrough, so
the state also reads without colour; the primary button gradient was deepened so its label can
stay light; Timeline sub-task checkboxes gained a stroke; a Gantt bar's progress split became a
crisp two-tone division with a `--surface` divider; the palette generators now floor every token
they produce, including the deep accent, against the surfaces that token actually lands on.
New: the audit engine itself (now `dev/a11y/`), and suite W around it.
`specs/A11Y.md` is the contract; `a11y/FINDINGS.md` is the full finding set.
**Verified:** suite W — every surface rendered in real chromium against the vault's own shipped
`storm.css`, across the whole palette matrix, walking every element with text and measuring the
computed foreground against its effective background. 217 surface × palette renders, 0 failing
elements.
**Risks / follow-ups:** the audit measures what it renders. A surface nobody added to
`a11y/audit-surfaces.js` is not audited at all, which is why suite W fails loudly if any surface
fails to render rather than scoring it zero.

## 2026-09-13 · panels load from one file instead of being pasted into every note
**Agent:** Claude Code (Anthropic model; the specific model is not recorded) · **Human:** the repo owner
**Why:** the 22 KB goal panel and the 25 KB Timeline were pasted verbatim into every goal and task
note. Eleven live notes had been rewritten three times in one day to ship panel changes, and each
rewrite was a full-file write to a note the user was also editing.
**Changed:** `common/_scripts/goal-panel.js` and `common/_scripts/task-gantt.js` are now the one
copy each, rendering into `dv.container` (inside a `dv.view` `this` is the global object, not the
block component); every note carries a three-line guarded call instead; `integrate.py` substitutes
the `<!-- GOAL_PANEL -->` / `<!-- TASK_GANTT -->` markers; the Dashboard's own embedded copy is
gone, taking ~22 KB with it. The third line of the guard exists because the vault syncs by iCloud
and a panel file that has not landed on the phone yet used to show Dataview's bare "custom view
not found".
**Verified:** `tests/V/dv_view.js` — the one-liner renders the same DOM the pasted block did,
resolution is `<name>.js` then `<name>/view.js`, neither present gives a VISIBLE error, and a
panel that still said `this.container` fails loudly.
**Risks / follow-ups:** notes written before this change still carry a pasted panel.
`dev/tools/refresh_blocks.py` rewrites them in place, idempotently.

## 2026-09-13 · a 📆 Timeline on every task note
**Agent:** Claude Code (Anthropic model; the specific model is not recorded) · **Human:** the repo owner
**Why:** a goal note showed its tasks as bars, but a task's own sub-tasks had no shape at all —
no way to see which deadline was next or how the work spread across the task's window.
**Changed:** `common/_scripts/task-gantt.js` — one row per sub-task, a bar from the previous
sub-task's `📅` to its own, `🛫` for an explicit start, milestones for `🛫` with no `📅`, dashed
projected bars for undated sub-tasks spread across the window, and click-to-check-off that writes
the `✅` date into the line. `common/storm-additions.css`, `common/_templates/Task.md`,
`tools/inject_task_gantt.py`. `specs/GANTT.md` is the contract.
**Verified:** suite G2 — the shipped `_scripts/task-gantt.js` is byte-identical in every built
vault, no `<!-- TASK_GANTT -->` marker survives, and the line-surgery core still matches
`tests/G2/reference-line-surgery.txt` character for character.
**Risks / follow-ups:** that reference file is a pin. Every surface that ticks a checkbox calls
into the same line surgery, so changing it changes all of them at once.

## 2026-09-13 · a paused state for goals and tasks
**Agent:** Claude Code (Anthropic model; the specific model is not recorded) · **Human:** the repo owner
**Why:** work that is deliberately on hold read as **Behind** for ever, and kept producing next
moves, overdue counts and daily-note rows for something nobody intended to do this month.
**Changed:** `status: paused` on a goal takes it and its tasks out of the Dashboard, the risk
tile and the daily tables, and moves it to a collapsed **Paused** group at the bottom of
`🎯 Goals`; a single task can be paused on its own; resuming offers to shift every remaining date
forward by however long the work sat paused, so a three-month pause does not resume three months
behind. Completed sub-tasks keep their real `✅` dates. Touches all five copies of `healthOf`,
`HL` and `HORDER`, plus `common/storm-additions.css` and the board.
`specs/PAUSE.md` is the contract.
**Verified:** suite P — ten items from the contract, plus a check that the paused branch is
character-for-character identical in all five copies.
**Risks / follow-ups:** none recorded.

## 2026-09-12 · goals and tasks replace the projects board
**Agent:** Claude Code, several agents against one shared spec (the spec names Sonnet for the CSS
and seed-content agents; the others are not recorded) · **Human:** the repo owner
**Why:** a project note mixed the outcome with the work, which made "what do I do next" something
you had to work out by reading. A goal is now an outcome with an area and a target date; a task is
one chunk of work under it with its own window; a sub-task is a checkbox inside a task note.
**Changed:** new `Goals/` and `Tasks/` folders with `🎯 Goals` and `📋 Tasks` indexes, `Goal` and
`Task` templates, a goal panel drawing each goal's tasks as bars, the Dashboard's ⚡ Now card
listing each active task's next move grouped by goal, Planned/Done tables in daily notes, a
`🧹 Triage` note for loose checkboxes, and the removal of `Projects/` and its template.
`specs/SPEC.md` is the contract; `specs/VERIFY.md` is the verification report.
**Verified:** suites A, B1, B2, E and V — 1029 assertions at the time, 0 failures.
**Risks / follow-ups:** `Projects/` is retired, not deleted: nothing reads it, and a vault
upgrading from 1.0.0 can leave it where it is.

## 2026-07-31 · 1.0.0
**Agent:** not recorded — this predates the log · **Human:** the repo owner
**Why:** first public release of the vault.
**Changed:** one DataviewJS dashboard gathering from across the vault (Today card, focus timer,
month calendar, habit heatmap, the day's workout, a job pipeline, a projects board, a reading
shelf, a mini graph), a job tracker, recipes and a meal planner, a reading shelf, a habit system
built from `#habit/*` checkboxes, a six-day training plan, two theme modes, the `storm-winddown`
and `storm-reader` bundled plugins, and sample data throughout.
**Verified:** not recorded.
**Risks / follow-ups:** see `CHANGELOG.md` for the release notes as published.
