# Dashboard rebuild — build notes & resolved spec ambiguities (Agent A)

## Layout of the parts

| file | contents |
|---|---|
| `helpers.js` | lines 15–144 of the staged `Dashboard.md`, **verbatim** (`_two`, `_esc`, `_mulberry32`, `_layoutGraph`, the whole match-theme toolkit). Never edit — re-extract with `sed -n '15,144p'` if it ever needs refreshing. |
| `buildHub.js` | `buildHub(d)` + three tiny module-level render helpers (`_dayLbl`, `_hbSpan`, `_pct`, `_MON3`, `_HBL`, `_HORDER`). Pure: no `dv`/`app` access. |
| `initHub.js` | `parseAdd(raw, ctx)` (top-level so tests can extract it) + `initHub(root, app)` + the `module.exports` line. |
| `livedata.js` | everything that touches `dv`/`app`, ending with `data`, `buildHub(data)` and `initHub(…, app)`. Holds one `/* @@VARIANT@@ */ … /* @@/VARIANT@@ */` block the assembler rewrites per vault. |

`assemble_dashboard.py` concatenates: frontmatter → ```dataviewjs → `try {` → helpers → buildHub → initHub
(+ `module.exports`) → livedata → `} catch(err) {…}` → closing fence.

**No `GOAL_PANEL` any more (CONTRACT A).** The dashboard used to embed the whole 22 KB goal panel as a
```-escaped string so the `goal:` verb could paste it into a new note. The panel now lives in ONE vault
file, `_scripts/goal-panel.js`, and `initHub`'s `viewBlock(name)` writes a single line into the note:

```dataviewjs
const p = "_scripts/goal-panel", f = x => app.metadataCache.getFirstLinkpathDest(x, "");
if (f(p + ".js") || f(p + "/view.js")) await dv.view(p);
else dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.", { cls: "panel-err storm-missing-view" });
```

`task:` does the same with `_scripts/task-gantt`. That dropped ~24 KB from `Dashboard.md` (140 → 116 KB).
The fence in `viewBlock` is still spelled with ``` escapes: a literal triple-backtick inside the
dashboard's own fence would close it in Obsidian's parser. The assembler still asserts the finished file
contains exactly two triple-backtick runs (the outer fence).

**THEME2 §C — the call is guarded.** The user's vault syncs by iCloud, and on the phone a note whose
`_scripts/goal-panel.js` had not landed yet showed Dataview's own
`Dataview: custom view not found for '_scripts/goal-panel.js' or '_scripts/goal-panel/view.js'.` —
which names the file and then tells the user nothing. The block is three lines now: line 1 resolves the
view exactly the way Dataview does (`getFirstLinkpathDest` on `<name>.js`, then `<name>/view.js`), so the
guard can never disagree with the call it guards; line 2 is the call, unchanged; line 3 renders the
panel's own error element with a message that names the file and points at sync. **Nothing in those three
lines knows what the panel does — only its name — which is why this is the last time the call site has to
change.** One emitter per repo writes it and they must stay byte-identical: `integrate.py` `view_block()`,
`initHub.js` `viewBlock()`, `_scripts/goal-panel.js` + `Goals/🎯 Goals.md` (the ＋ Task control), and
`dev/tools/refresh_blocks.py` `one_liner()` for notes already in the vault.

## Resolved ambiguities

1. **Which checkboxes count as sub-tasks.** §1 says the body "must contain a `## Sub-tasks` section".
   Implementation: if a task note has *any* checkbox under a heading matching `/sub-?tasks/i`, only those
   count; otherwise every non-`#habit` checkbox in the note is used (tolerates notes written without the
   heading). Blank boxes (`- [ ]` with no text after cleaning) are dropped everywhere — the Task template
   ships one, and it must not become a next move or skew progress.
2. **Goal groups with no next move.** §3.3.4 says a group renders "for each goal that has ≥1 active task
   with a next move", but §2 also demands the "all sub-tasks done — mark task complete?" nudge. A goal is
   therefore grouped when it has ≥1 active task that either has a next move **or** has zero unchecked
   sub-tasks. The latter renders as `.nm-row[data-kind="alldone"]` (class `nm-alldone`) carrying the
   `.nm-markdone` button. `alldone` rows are never counted in `strip.nm`.
3. **Tasks with no resolvable goal.** §1 makes `goal:` required, but a mistyped link must not hide work.
   Such active tasks are grouped under a pseudo-goal "No goal yet" (`health: unscheduled`, sorted last,
   no `data-link`).
4. **What `today` / `over` count (and filter).** §2 defines due-today/overdue for *sub-tasks*; the Inbox is
   explicitly "NOT part of the goal system". So `strip.today` / `strip.over` count only sub-tasks of
   **active** tasks, and only `next`/`sub`/`over` rows ever get `is-today` / `is-over`. Inbox rows keep
   their `data-due` but are never classed — which keeps the tile counts exactly equal to the number of
   rows the corresponding filter shows.
5. **The `risk` tile filter.** §3.1 lists six tiles and marks only Focus and Streak as "not a filter", but
   §9 only specifies CSS for `nm`/`today`/`over`. `risk` is wired as a filter: rows whose goal health is
   `risk|behind` get `is-risk`, and the hub ships a minimal `<style class="storm-base-css">` with the four
   `.nowcard[data-filter=…]` rules plus `.refsec.collapsed .card{display:none}` so filtering and the
   reference collapse work even before `storm.css` is updated. Agent C's identical rules are harmless.
   `strip.risk` counts non-done goals with health `risk|behind`.
6. **`task:` with a single trailing date.** The grammar only specifies a `<start>-<end>` range. `parseAdd`
   returns a lone date as `iso` (leaving `start`/`end` empty); the note creator then uses
   `start = parsed start || today` (matching §4's Task template, which sets `start: <today>`) and
   `end = parsed end || iso`. So `task: Ship v1 9/20` = starts today, ends 2026-09-20.
7. **`M/D` without a year** resolves in the current year (no roll-forward) — deterministic and testable.
8. **`sub:` into a section that only holds the template's blank box** replaces that blank box instead of
   appending after it; otherwise the new sub-task is appended after the last real checkbox of the section
   (= the end of the section).
9. **Shutdown field labels.** §3.3 names `**Win of the day:**` / `**One next step on anything I touched:**`
   (the §4 template's wording), but the *current* daily template says `**What got done:**` /
   `**Next concrete step on anything I worked on:**`. Reads and writes match either spelling; writes
   normalise to the §3.3 wording, on the same line as the label. The section heading is matched as
   `## 🌙 …` first, falling back to `## 📝 End of Day`.
10. **`## 🎯 One thing`** is matched as any heading starting with 🎯, so both the old
    ("Today's One Thing") and new headings work. Saving replaces an existing `→ …` line, else inserts one
    after the heading's blank line.
11. **`initHub(root, appRef)`** takes the app explicitly (falling back to `window.app`) so the test harness,
    which passes `app` as a block parameter rather than a global, can exercise every write path. The
    `module.exports` line is extended to `{buildHub,initHub,parseAdd,_two}` (purely additive).
12. **`.nm-subs`** are pre-rendered next to their `next` row with `style="display:none"` and toggled by the
    `▾` button, so expanding needs no re-query of the vault.
13. **`data-toggle-text` / `data-del-text`** carry the *raw* checkbox text (emoji + tags included) while
    `.nm-text` shows the §3.7-cleaned text — the raw form is what the line-drift fallback matches against.
14. **Text cleaning (§3.7)** strips the Tasks-plugin emoji together with the date that follows them, then
    bare emoji, then `#tags`. A date that is *not* attached to an emoji is left in the text.
15. **Old data kept:** `data.stats` is still computed (for ⚙️ Settings / back-compat) but no longer
    rendered; `data.projects` / the old annual-`goals` shape are gone — `data.goals` is now the §3.7 goal
    list and `data.tasks` the §3.7 task list.

## Behaviour preserved from the old file

clock/greeting, pomodoro plugin binding (incl. `markFocusDone` and BREAK handling), `data-link` navigation,
theme toggle, MATCH-mode palette compute + cache, `open-graph`, `open-today` / `open-daily`, `toggleLine`
(flips `[ ]`↔`[x]`, appends/strips `✅ date`), delete-line, workout logging, notes search, the local audio
player, `addHabit` / `addQuickNote` / `addJobApp` (now reached through the universal add box), and the
pomodoro focus picker (now offering next moves instead of today's dated tasks).

---

## Amendments after verification (Agent V)

These supersede the items above where they conflict; full rationale, severity and test
coverage in `dev/specs/VERIFY.md`.

1. **(amends §1)** Sub-task selection is **heading-ancestor aware** and shared verbatim by
   `livedata.js`, `goal-panel.txt`, `🎯 Goals.md`, `📋 Tasks.md` and `daily-tables.txt`
   (`subMarks()` + `subsOf()`): the note's headings are walked keeping a stack by level (a
   level-L heading pops every heading of level ≥ L) and a checkbox counts when **any** heading
   on the stack matches `/sub[-\s]?tasks?/i` — so `## Sub-tasks` › `### Phase 1` counts and a
   following `## 🗒️ Notes` closes the section. No such heading anywhere → every checkbox
   counts; blank boxes and `#habit` lines never count; if the metadata cache yields no
   headings it falls back to the old innermost-`t.section` test. The two *writers*
   (`addSubTask`, Triage → Sub-task) match the same spellings via
   `/^#{1,6}\s+.*sub[-\s]?tasks?\b/i`.
2. **`#habit` lines** are identified by one shared regex,
   `/(^|\s)#habit(\/[\p{L}\p{N}_/-]+)*(?=$|\s)/u`, so `#habitat` / `#habits` are no longer
   treated as habits anywhere.
3. **(amends §4/§5)** `today` and `over` filters now reveal a matching sub-task that sits in
   a collapsed `.nm-subs` list (minus the duplicate of the visible head row), so each tile's
   count always equals the number of rows the filter shows. `nm` and `risk` remain per-task /
   per-goal filters and keep sub lists collapsed. A hand-expanded list is remembered with
   `data-open` and survives a filter round-trip.
4. **`parseAdd`** peels trailing `#tags` before reading a natural date, and the checkbox is
   written in SPEC §3.4's order: `- [ ] <text> [📅 iso] [#tags]`. Mid-text tags are untouched.
5. **`goal:` values** go through the same `linkNames()` as the standalone notes (arrays
   supported, case-insensitive on basename or full path).
6. Notes declaring `cssclasses: dashboard` (the 🎯 Goals index and 📋 Tasks board) are never
   offered as `task:`/`sub:` destinations and never count as "the one active goal".
7. `_scripts/daily-tables.txt` is the single source of the two daily blocks; `integrate.py`
   re-embeds it into both daily templates on every build.
8. **Block ids.** `toggleLine()`, `markFocusDone()` and `reschedule()` insert ` ✅ <date>` /
   ` 📅 <date>` **before** a trailing block id (` ^abc-1`) so the id stays terminal and the
   block reference keeps resolving; un-checking strips the ✅ wherever it sits. The shared
   `clean()` also drops a trailing `^id` from displayed text.
9. **Build.** `integrate.py` keeps `out/{personal,template}/_templates/Daily Note Template.md`
   in sync with `_scripts/daily-tables.txt` (source *and* built vault), and the assembled
   `Dashboard.md` no longer carries `@@VARIANT@@` sentinels.
