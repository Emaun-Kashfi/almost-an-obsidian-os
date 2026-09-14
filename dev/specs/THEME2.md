# Vault-wide colour, links, and a self-explaining panel — CONTRACT (today = 2026-09-14)

Vault: the Storm Dashboard, built from `dev/` (one variant per `dev/<name>/variant.json`).
Three user-reported defects, all seen on a real vault.

────────────────────────────────────────────────────────────────
## A. The vault background does not match the dashboard

`storm-theme.css` currently defines only `--storm-*` custom properties, which the Storm palette
blocks consume. Obsidian's own `--background-primary` is never touched, so a plain note, the
sidebars and the modals keep the installed theme's background while the dashboard and the panels
paint with the chosen palette. The two do not agree, which is what the user sees.

Extend `_themeFileCss()` so that in **match** mode the generated file also maps the
palette onto Obsidian's own variables, at minimum:

    --background-primary, --background-primary-alt,
    --background-secondary, --background-secondary-alt,
    --background-modifier-border, --background-modifier-border-hover,
    --text-normal, --text-muted, --text-faint,
    --interactive-accent, --interactive-accent-hover, --text-on-accent

Do **not** emit these in **community** mode. That mode reads Obsidian's variables to build
`--storm-*`; writing them back would be circular and would fight the installed theme.

Keep it reversible and honest: the file's header comment must say that turning the snippet off, or
switching to community mode, hands the vault straight back to the installed theme. Verify that
claim by rendering with the snippet disabled.

## B. Links are dark on a dark background

The user's `appearance.json` carries `accentColor: "#000000"`. Obsidian derives link colour from
the accent, so with Minimal every internal link renders black, unreadable on a dark background.
That is their setting, not a bug we introduced, but the vault should not depend on it.

In match mode, drive the link colours from the Storm accent in the same generated file:
`--link-color`, `--link-color-hover`, `--link-unresolved-color`, `--text-accent`,
`--text-accent-hover`. Check against Obsidian's current variable names rather than assuming; set
the ones that actually exist, and prefer setting both the modern and legacy names when both are
live. Unresolved links must stay visually distinct from resolved ones.

Every colour written here is subject to the same WCAG floor as the rest of the system: links must
clear 4.5:1 against the background they land on, in both themes and across generated palettes.
Extend the auditor's matrix to cover link text on `--background-primary` and on
`--background-secondary`, and fix the generator rather than the symptom if a palette fails.

## C. A missing panel file should explain itself

On the user's phone, goal and task notes show Dataview's raw text:
`Dataview: custom view not found for '_scripts/goal-panel.js' or '_scripts/goal-panel/view.js'.`
The vault syncs by iCloud, so the likely cause is that the file has not landed on that device yet.
The message names the file but tells the user nothing about what to do.

Replace the one-line call in the notes with a short guarded loader, still small enough to stay a
one-liner in spirit (three lines is fine, thirty is not):

- Resolve the view file first. If it exists, call `dv.view(...)` exactly as now.
- If it does not, render the panel's own error element with a message that says the panel file is
  missing from this device, names it, and points at sync as the likely cause on mobile.
- The text must be identical everywhere except for the file name.

This changes every goal and task note one more time. That is acceptable: the notes are ~54 bytes
now, `dev/tools/refresh_blocks.py` already migrates them safely, and this is the last time
the call site should ever change. Update the migration tool so it converts BOTH a bare
`await dv.view("…")` one-liner and an older embedded panel block to the new guarded form, and keep
its existing safety properties (exactly one fenced block, every other byte preserved, line endings
preserved, `--dry-run`).

Everything that emits the call must emit the new form: `integrate.py` in both repos, the
the `task:` creation route, the `＋ Task` button, and the templates.

────────────────────────────────────────────────────────────────
## Verification
- Render a goal note, a task note, 📋 Tasks and a plain note with a match-mode theme file present,
  and assert the computed `background-color` of the note surface equals the themed background and
  differs from the default. The existing suite T asserts this for panels only; extend it to the
  page background and to link colour.
- Screenshot, in a realistic Obsidian shell (`a scripted Obsidian-shaped DOM` builds one), a
  plain note with links, a goal note and the dashboard under the same match palette, dark and
  light. They must look like one vault. Look at them before declaring done.
- Simulate the missing-file case and screenshot the message.
- `node dev/a11y/audit.js` exits 0, with the new link and page-background pairs in
  the matrix.
- Every suite green: `A B1 B2 E G2 H P T V W`. Update an assertion only when deliberate, and say so.
- `npx --yes csstree-validator` clean on every stylesheet.

## Rules
No device tools, no git, no deploying, no zip rebuilds. The orchestrator does all of that.
