# dev/ — build and test

The vault at `../Storm Dashboard Vault/` is **generated**. Edit it here, then build.

```sh
cd dev
npm install                # node ≥ 20, python ≥ 3.8. Playwright downloads a chromium (~120 MB).
sh hooks/install.sh        # one-time: turns on the DEVLOG hooks for this clone
npm run build              # writes ../Storm Dashboard Vault/
npm test                   # leak scan + all 10 suites (~90 s, real chromium)
npm run test:a11y          # just the colour-contrast audit
npm run test:privacy       # just the leak scan
```

`npm test` writes nothing outside `dev/build/`. Only `npm run build` touches the vault.
A change is not done until `npm test` is green.

**Where things are.** `dashboard/*.js` are the four parts of `Dashboard.md`;
`common/` is everything every vault shares (the two panel scripts, the index notes,
triage, the templates, the added CSS); `base/` is the vendored 1.0.0 stylesheet;
`template/` is the seed notes for the vault this repo publishes; `specs/` are the
contracts each feature was built to; `a11y/` is the contrast auditor; `tools/` migrate
notes already living in somebody's vault. Nothing hardcodes a path — ask `paths.js` or
`paths.py`.

**Variants.** A variant is a directory with a `variant.json` and seed notes. This repo
has one, `template/`. To keep a private vault of your own, copy `template/` to
`dev/myvault/`, edit its `variant.json` (frontmatter, greeting, banner, whether to ship
`.obsidian/appearance.json`), add `/myvault/` to `dev/.gitignore`, and
`npm run build -- --variant myvault`. No vault's content ever belongs in the build code.

**The vault must match the build.** `python3 integrate.py --check` rebuilds and compares
without writing; suite V runs it, so hand-editing a generated file turns the suite red.
Run `npm run build` and commit the result alongside the source change.

**Privacy.** This repo is public. `privacy/terms.json` is the one list of strings that
must never appear in it; `scripts/leakscan.py` scans every file and a single hit fails.
Both the build and two test suites read that same list.

**The log.** Every commit touching `dev/` or `Storm Dashboard Vault/` needs a new entry at
the top of `DEVLOG.md`, naming the agent and model that made the change. `hooks/pre-commit`
warns and `hooks/commit-msg` refuses — but only after `sh hooks/install.sh`, which is
per-clone. Escape hatches: `git commit --no-verify`, or `[skip devlog]` in the message.

**Playwright.** `npm install` downloads its own chromium; that is the normal path and
needs no `PLAYWRIGHT_BROWSERS_PATH`. A sandbox that pre-seeds that variable with a
different chromium revision is detected by `tests/lib.js`, which uses it rather than
skipping; `STORM_CHROMIUM=/path/to/chrome` overrides both. If no browser can be found the
suites fail loudly — they never skip.

**Before you start:** `../AGENTS.md` is the short list of what breaks; `ARCHITECTURE.md`
beside this file is the long version.
