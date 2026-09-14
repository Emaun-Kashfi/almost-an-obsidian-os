# `dev/base/` — the vendored base stylesheet

`base/.obsidian/snippets/storm.css` is the Storm stylesheet this system started
from: the snippet version 1.0.0 shipped, imported verbatim on 2026-09-13 and kept
here so the build has one fixed input it owns. `integrate.py` concatenates it with
`common/storm-additions.css` (plus the risk-filter rule) to produce the
`.obsidian/snippets/storm.css` that every built vault ships.

## Why it is vendored

It used to be read straight out of the read-only upload directory. CONTRACT §C
changes palette tokens and `opacity:` values that are **declared in this sheet**,
and a token has to be fixed where it is declared — the alternative is ~90
duplicate selector overrides appended after it, which `tests/V/css_audit.py`
rightly rejects as "the appended CSS re-declares an existing selector". So the
sheet lives here, in the repo, and every §C fix is applied to it directly. The
table below records every byte that differs from the 1.0.0 snippet.

## Deltas from the imported upstream (all CONTRACT §C, all from `a11y/FINDINGS.md`)

| line(s) | finding | change |
|---|---|---|
| 88, 431, 552, 600, 742 | F2 | `--faint: #6a7c8c → #8899a9` in every dark palette copy (the old value is 4.34:1 on the worst ground it lands on) |
| 91–94 | F6 | `.storm-hub` now declares `--btn` / `--on-accent`, so `var(--btn, var(--accent-deep))` never falls through to a fill nothing checked |
| 205, 443, 630, 676 | F6 | the primary-button gradient `#3aa5c8→#2b8fb5` → `#297893→#22718e` (its `#eafaff` label was 2.65:1, now 4.67:1 on the top stop; both stops also clear 3:1 against the card they sit on) |
| 209 | F6 | the pomodoro BREAK button's green gradient darkened for the same reason |
| 253 | — | the placeholder album-art gradient darkened; its 24px glyph was 2.77:1 against the light stop (needs 3) |
| 310 | F6 | the e-ink `.theme-light .storm-hub` palette declares `--btn:#000 / --on-accent:#fff` |
| 324–333 | F1 | the e-ink banner greeting/clock/date get white-ground colours, scoped `:not(.brand-grad)` so a painted banner opts out |
| 496 | F3 | `.jobcard .jpip.z` marks "zero" with a hollow chip instead of `opacity:.4` |
| 786–790 | F15 | `.storm-settings .segbtn.on` darkens the fill under `--text-on-accent` |
| 795 | F17 | `.storm-settings .curcap` scrim `rgba(0,0,0,.5) → .72`, so `#fff` clears 4.5:1 even over a white banner thumbnail |
| 800 | F15 | `.storm-settings .dashlink` mixes the Obsidian accent towards `--text-normal` |

## Delta from the imported upstream (THEME2 §A/§B — one variable, read for the wrong job)

| line(s) | change |
|---|---|
| 809 | `.storm-settings .dashlink` reads `var(--text-accent, var(--interactive-accent))` instead of `var(--interactive-accent)` |

`--interactive-accent` is Obsidian's accent **fill** — what `.mod-cta` paints
behind `--text-on-accent`, and what `.storm-settings .segbtn.on` (F15, above)
deliberately darkens *further* before putting a label on it. Reading it as TEXT
was already marginal on Obsidian's own dark theme (4.36:1); once THEME2 §A points
it at the palette's contrast-checked BUTTON fill it collapses to 2.54:1, because a
fill dark enough to carry a light label cannot also be light enough to read as
text on a dark page. `--text-accent` is the variable Obsidian gives accent-coloured
text — with no theme file it is the installed theme's own accent text colour, which
is what this link should have been all along, and with one `storm-theme.css` floors
it at 4.5:1 against `--background-primary` / `-secondary` / `-secondary-alt`.
`dashboard/helpers.js` `_communityMap()` had the same bug in `--accent` / `--accent2`
/ `--accent-deep` and got the same fix. `tests/W` (suite W) measures both.

## Deltas from the imported upstream (CONTRACT §B — the vault-wide theme)

Every palette **declaration** in this sheet changed from a literal to
`var(--storm-<name>, <the same literal>)`:

| block | line(s) |
|---|---|
| `.storm-home .storm-hub` | 86–94 |
| `.theme-light .storm-hub` (e-ink) | 304–310 |
| `.bm` / `.theme-light .bm` | 429–431, 458 |
| `.wm` / `.theme-light .wm` | 552, 579 |
| `.jsm` / `.theme-light .jsm` | 598–601, 729 |
| `.qa` / `.theme-light .qa` | 740–742, 769 |

The fallback is the literal that was there, byte for byte, so a vault with no
`.obsidian/snippets/storm-theme.css` renders exactly as before — including every
§C value in the table above. What it buys is that ONE file of `--storm-*`
definitions on `<body>` (written by the Dashboard, see `dashboard/helpers.js`
`_themeFileCss`) now repaints every Storm surface in the vault instead of the
palette dying at the edge of the Dashboard note. `common/storm-additions.css`
got the same treatment for `.dashboard/.goalpanel/.dt-wrap/.triage/.goalsidx/
.tasksboard` and `.tgantt`.

Nothing else in the file was touched. If the 1.0.0 snippet is ever re-imported,
re-apply the table above — `bash tests/W/run.sh` fails loudly if any of it is
lost, and that suite is the only thing standing between this sheet and a silent
contrast regression.

To see what the build makes of it:

```
python3 integrate.py --no-install
diff base/.obsidian/snippets/storm.css build/template/vault/.obsidian/snippets/storm.css
```
