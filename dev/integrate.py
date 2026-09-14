#!/usr/bin/env python3
"""Build a deployable Obsidian vault from the sources under dev/.

    python3 dev/integrate.py                     # build + install every variant
    python3 dev/integrate.py --variant template  # just one
    python3 dev/integrate.py --check             # build, then FAIL if the vault
                                                 # in the repo differs from it
    python3 dev/integrate.py --no-install        # build only, touch nothing else
    python3 dev/integrate.py --out /tmp/x        # install somewhere else

What it does, in order:
  · re-runs the dashboard assembler (dev/assemble_dashboard.py)
  · substitutes the <!-- GOAL_PANEL --> / <!-- TASK_GANTT --> markers with the
    ONE-LINE `await dv.view("_scripts/<name>")` block (CONTRACT A) — the panel
    code itself lives in exactly one file per vault, _scripts/<name>.js, and is
    never pasted
  · re-embeds the two daily-table blocks from _scripts/daily-tables.txt
  · builds storm.css = base sheet + additions (+ risk filter rule)
  · generates .obsidian/snippets/storm-theme.css out of storm.css's own fallbacks
  · copies the shared notes/templates/scripts from dev/common/ in

The whole vault is built from scratch into dev/build/<variant>/vault (wiped every
run, so a deleted source cannot leave a stale file behind), and only then installed
over the real vault. Files in the vault that this build does not produce — README
notes, .obsidian settings, bundled plugins — are never touched or deleted.

Idempotent: a second run writes byte-identical files.
"""
import argparse
import filecmp
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths  # noqa: E402

OUT = paths.COMMON
STALE = []   # sources --check found out of date


def read(p):
    with open(p, encoding="utf-8") as fh:
        return fh.read()


def write(p, s):
    d = os.path.dirname(p)
    if d:
        os.makedirs(d, exist_ok=True)
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(s)


def md5(p):
    with open(p, "rb") as fh:
        return hashlib.md5(fh.read()).hexdigest()


# ── CONTRACT A / THEME2 §C: a panel is CALLED, not pasted — and it says so when
# the file is not there ────────────────────────────────────────────────────────
# Dataview resolves dv.view("p") to the vault file `p.js` (then `p/view.js`) and
# evaluates it as `new Function("dv","input", src)` — called with NO receiver, so
# `this` inside a view is the global object. The view files therefore render into
# dv.container, and the note carries only the three lines below.
#
# Line 1 resolves the view THE WAY DATAVIEW DOES (getFirstLinkpathDest on `p.js`
# then `p/view.js`), so the guard can never disagree with the call it guards —
# including if a panel is ever split into a folder, or _scripts/ is moved.
# Line 2 is the old call site, unchanged.
# Line 3 is the only thing the note knows about the panel beyond its name: the
# vault syncs by iCloud, and a file that has not landed on this phone yet used to
# show Dataview's "custom view not found for …", which names the file and tells
# the user nothing. This names it and says what to do.
# Nothing here mentions what the panel DOES, so a year of panel changes does not
# reach the note: the name is the whole interface.
FENCE = "`" * 3


def view_block(name):
    return (f'{FENCE}dataviewjs\n'
            f'const p = "_scripts/{name}", f = x => app.metadataCache.getFirstLinkpathDest(x, "");\n'
            'if (f(p + ".js") || f(p + "/view.js")) await dv.view(p);\n'
            'else dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. '
            'On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, '
            'then reopen this note.", { cls: "panel-err storm-missing-view" });\n'
            f'{FENCE}')


# The one file per panel. Bare JavaScript — a fence here would be evaluated as code.
VIEWS = {"goal-panel": f"{OUT}/_scripts/goal-panel.js",
         "task-gantt": f"{OUT}/_scripts/task-gantt.js"}
for _n, _p in VIEWS.items():
    _src = read(_p)
    assert "```" not in _src, f"{_p}: a dv.view file is bare JS — no code fence"
    assert "dv.container" in _src, f"{_p}: must render into dv.container, not this.container"
    assert not re.search(r"(?<![.\w$])this\s*[.\[]", _src), f"{_p}: `this` is not the container inside a view"

panel = view_block("goal-panel")


def sub_panel(text, name):
    n = text.count("<!-- GOAL_PANEL -->")
    assert n == 1, f"{name}: expected exactly one GOAL_PANEL marker, found {n}"
    return text.replace("<!-- GOAL_PANEL -->", panel)


gantt = view_block("task-gantt")


def sub_gantt(text, name):
    n = text.count("<!-- TASK_GANTT -->")
    assert n == 1, f"{name}: expected exactly one TASK_GANTT marker, found {n}"
    return text.replace("<!-- TASK_GANTT -->", gantt)


# the two daily-table blocks live in _scripts/daily-tables.txt; the Daily Note Template
# embeds them verbatim. Re-embed on every build so the copies can never drift.
_halves = [h.strip() for h in read(f"{OUT}/_scripts/daily-tables.txt").split("<!-- SPLIT -->")]
assert len(_halves) == 2, "daily-tables.txt must hold exactly two blocks split by <!-- SPLIT -->"
assert all(h.startswith("```dataviewjs") and h.endswith("```") for h in _halves)
_BLOCK_RE = re.compile(r"```dataviewjs\n.*?\n```", re.S)


def sub_daily_tables(text, name):
    for head, block in (("## 📅 Planned today", _halves[0]), ("## ✅ Done today", _halves[1])):
        i = text.find(head)
        assert i >= 0, f"{name}: no `{head}` heading"
        m = _BLOCK_RE.search(text, i)
        assert m, f"{name}: no dataviewjs block under `{head}`"
        text = text[:m.start()] + block + text[m.end():]
    return text


# storm.css: base + additions + risk-filter rule
# CONTRACT §C: the base sheet is VENDORED at dev/base/.obsidian/snippets/storm.css
# (byte-identical to the upstream snippet at import time). It had to be: the §C
# accessibility fixes change palette tokens and `opacity:` values that live in the
# base sheet, and the upstream copy is read-only third-party input. Fixing a token
# where it is declared is the whole point — the alternative is ~90 duplicate
# selector overrides in the appended block, which tests/V/css_audit.py rightly
# rejects. dev/base/README.md records every delta from the upstream snippet.
def build_css():
    orig_css = read(paths.BASE_CSS)
    add_css = read(f"{OUT}/storm-additions.css")
    risk_rule = ('\n/* risk filter (dashboard tile "Goals at risk") */\n'
                 '.storm-hub .nowcard[data-filter="risk"] .nm-row:not(.is-risk){display:none}\n')
    if '[data-filter="risk"]' in add_css:
        risk_rule = ""
    return orig_css.rstrip("\n") + "\n\n" + add_css.rstrip("\n") + "\n" + risk_rule


# ── CONTRACT §B: .obsidian/snippets/storm-theme.css ───────────────────────────
# Every palette block reads `var(--storm-<name>, <literal>)`, so one file of
# `--storm-*` definitions on <body> repaints EVERY Storm surface in the vault —
# goal notes, task notes, 🎯 Goals, 📋 Tasks, 🧹 Triage, daily tables — instead of
# the palette dying at the edge of the Dashboard note.
# A fresh vault ships that file with the DEFAULT palette, parsed straight out of
# the stylesheet's own fallbacks so the two can never drift: the file is a no-op
# on day one, the snippet is registered and enabled, and the Dashboard's first
# theme write (initHub → app.vault.adapter.write) lands with nothing to set up.
THEME_SNIPPET = "storm-theme"
# --behind is deliberately NOT in this list: it has no literal default — the sheet
# derives it from --warm (`color-mix(in srgb, var(--warm) 60%, #e0736b)`), which is
# only resolvable on the element that declares --warm, not on <body>. A GENERATED
# theme always carries an explicit --storm-behind (CONTRACT §C F13); the default
# snippet leaves the derivation alone.
_TOKENS = ["bg", "surface", "surface2", "track", "border", "border2", "text", "dim", "faint",
           "accent", "accent2", "accent-deep", "glow", "btn", "on-accent", "accent-rgb",
           "warm", "good"]
_BLOCK_SEL = ".dashboard, .goalpanel, .dt-wrap, .triage, .goalsidx, .tasksboard {"


def _block_bodies(css, sel):
    """every rule body whose selector list ends with `sel`, in document order"""
    out, i = [], 0
    while True:
        i = css.find(sel, i)
        if i < 0:
            return out
        i += len(sel)
        out.append(css[i:css.index("}", i)])


def default_theme_snippet(css):
    """The default palette, as `--storm-*` on <body>, read out of the sheet itself."""
    bodies = _block_bodies(css, _BLOCK_SEL)          # the --behind block, then the palette block
    assert len(bodies) >= 2, f"storm-theme.css: `{_BLOCK_SEL}` appears {len(bodies)}× in storm.css"
    vals = {}
    for src in bodies:
        # the fallback may itself hold a `)`: park the one nested function first
        src = src.replace("color-mix(in srgb, var(--warm) 60%, #e0736b)", "@MIX@")
        src = re.sub(r"linear-gradient\(([^()]*)\)", lambda m: "@LG@" + m.group(1) + "@/LG@", src)
        for tok in _TOKENS:
            m = re.search(r"--" + re.escape(tok) + r":\s*var\(--storm-" + re.escape(tok) + r",(.*?)\)\s*[;\n]", src)
            if m and tok not in vals:
                vals[tok] = (m.group(1).strip()
                             .replace("@MIX@", "color-mix(in srgb, var(--warm) 60%, #e0736b)")
                             .replace("@LG@", "linear-gradient(").replace("@/LG@", ")"))
    missing = [t for t in _TOKENS if t not in vals]
    assert not missing, f"storm-theme.css: no var(--storm-*) fallback for {missing} in `{_BLOCK_SEL}`"
    decls = ";".join(f"--storm-{t}:{vals[t]}" for t in _TOKENS)
    return (
        "/* storm-theme.css — GENERATED. The Storm Dashboard rewrites this file whenever\n"
        "   the theme changes (⚙️ Settings → Theme / Match image). Every palette block in\n"
        "   storm.css reads var(--storm-*, <default>), so these definitions paint every\n"
        "   Storm surface in the vault — goal notes, task notes, 🎯 Goals, 📋 Tasks,\n"
        "   🧹 Triage and the daily tables — not just the Dashboard.\n"
        "   This is the built-in default palette: identical to the fallbacks in storm.css,\n"
        "   so a fresh vault looks exactly as it would with no theme file at all. */\n"
        f"body:not(.theme-light){{{decls}}}\n")


# the shared notes every variant ships, and where they come from
COMMON_FILES = {
    "_templates/Task.md": f"{OUT}/_templates/Task.md",
    "_scripts/goal-panel.js": VIEWS["goal-panel"],
    "_scripts/daily-tables.txt": f"{OUT}/_scripts/daily-tables.txt",
    "_scripts/task-gantt.js": VIEWS["task-gantt"],
    "Goals/🎯 Goals.md": f"{OUT}/Goals/🎯 Goals.md",
    "Tasks/📋 Tasks.md": f"{OUT}/Tasks/📋 Tasks.md",
    "🧹 Triage.md": f"{OUT}/🧹 Triage.md",
}
# dev/<variant>/ holds seeds; these are build config, not vault content
SEED_SKIP = {"variant.json"}


def build_variant(cfg, combined_css, theme_css, check_only=False):
    """Build the whole vault into dev/build/<variant>/vault and return that path."""
    dst = os.path.join(cfg["stage"], "vault")
    if os.path.exists(dst):
        shutil.rmtree(dst)

    # 1b) keep the SOURCE daily template in sync with _scripts/daily-tables.txt, so the
    #     canonical block never has a stale twin (tests/B2 asserts they are identical).
    tpl = os.path.join(cfg["seeds"], "_templates", "Daily Note Template.md")
    if os.path.isfile(tpl):
        old = read(tpl)
        new = sub_daily_tables(old, f"{cfg['name']}/_templates/Daily Note Template.md")
        if new != old:
            if check_only:
                print("  OUT OF SYNC %s ← common/_scripts/daily-tables.txt"
                      % os.path.relpath(tpl, paths.REPO))
                STALE.append(os.path.relpath(tpl, paths.REPO))
            else:
                write(tpl, new)
                print(f"synced   {os.path.relpath(tpl, paths.REPO)} ← common/_scripts/daily-tables.txt")

    # per-variant files: the seeds on disk, plus the assembled Dashboard from dev/build/
    for root_dir in (cfg["seeds"], cfg["stage"]):
        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d != "vault"]
            for fn in files:
                src = os.path.join(root, fn)
                rel = os.path.relpath(src, root_dir).replace(os.sep, "/")
                if rel in SEED_SKIP:
                    continue
                text = read(src) if fn.endswith((".md", ".json", ".txt", ".css")) else None
                if fn.endswith(".md") and "<!-- GOAL_PANEL -->" in text:
                    text = sub_panel(text, rel)
                if fn.endswith(".md") and "<!-- TASK_GANTT -->" in text:
                    text = sub_gantt(text, rel)
                if rel == "_templates/Daily Note Template.md":
                    text = sub_daily_tables(text, rel)
                if text is None:
                    os.makedirs(os.path.dirname(f"{dst}/{rel}"), exist_ok=True)
                    shutil.copy2(src, f"{dst}/{rel}")
                else:
                    write(f"{dst}/{rel}", text)

    # common files — _templates/Task.md carries the <!-- TASK_GANTT --> marker
    for rel, src in COMMON_FILES.items():
        text = read(src)
        if rel == "_templates/Task.md":
            text = sub_gantt(text, f"common/{rel}")
        write(f"{dst}/{rel}", text)
    # Goal template with the panel substituted
    write(f"{dst}/_templates/Goal.md", sub_panel(read(f"{OUT}/_templates/Goal.md"), "Goal.md"))
    # stylesheets — storm.css and the generated palette snippet beside it
    write(f"{dst}/.obsidian/snippets/storm.css", combined_css)
    write(f"{dst}/.obsidian/snippets/{THEME_SNIPPET}.css", theme_css)
    # appearance.json is written ONLY for a variant that creates a vault from
    # scratch. A variant deployed INTO an existing vault must leave that file
    # alone — it holds the user's own cssTheme/accentColor, and shipping one
    # would wipe those settings. There the Dashboard turns the snippet on through
    # Obsidian itself (app.customCss.setCssEnabledStatus), and falls back to a
    # Notice pointing at Settings → Appearance.
    if cfg.get("writeAppearanceJson"):
        write(f"{dst}/.obsidian/appearance.json", json.dumps(
            {"accentColor": "", "cssTheme": "",
             "enabledCssSnippets": ["dashboard", "storm", THEME_SNIPPET],
             "theme": "obsidian"}, indent=2) + "\n")
    return dst


def check_clean(built, name):
    """no build markers left anywhere, and none of the forbidden terms"""
    for root, _, files in os.walk(built):
        for fn in files:
            p = os.path.join(root, fn)
            if fn.endswith(".md"):
                t = read(p)
                assert "<!-- GOAL_PANEL -->" not in t, f"marker left in {p}"
                assert "<!-- TASK_GANTT -->" not in t, f"marker left in {p}"
    bad = re.compile("|".join(paths.forbidden_terms()), re.I)
    for root, _, files in os.walk(built):
        for fn in files:
            p = os.path.join(root, fn)
            if fn.endswith((".md", ".txt", ".css", ".json")):
                m = bad.search(read(p))
                assert not m, f"forbidden term {m.group(0)!r} in built file {p} ({name})"


def rel_files(root):
    out = []
    for dirpath, _, files in os.walk(root):
        for fn in files:
            p = os.path.join(dirpath, fn)
            out.append(os.path.relpath(p, root).replace(os.sep, "/"))
    return sorted(out)


def install(built, dest, check_only):
    """Copy every built file over `dest`. Files dest holds that the build does not
       produce are left alone — they are the vault's own (README notes, .obsidian
       settings, bundled plugins). Returns the list of differences."""
    diffs = []
    for rel in rel_files(built):
        src, dst = os.path.join(built, rel), os.path.join(dest, rel)
        same = os.path.isfile(dst) and filecmp.cmp(src, dst, shallow=False)
        if same:
            continue
        diffs.append(("changed" if os.path.isfile(dst) else "new", rel))
        if not check_only:
            os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
            shutil.copyfile(src, dst)
    return diffs


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--variant", action="append", default=None,
                    help="variant to build (repeatable); default: every variant in dev/")
    ap.add_argument("--out", default=None,
                    help="install into this directory instead of the variant's own vault")
    ap.add_argument("--check", action="store_true",
                    help="build and compare only — write nothing, exit 1 on any difference")
    ap.add_argument("--no-install", dest="no_install", action="store_true",
                    help="build into dev/build/ and stop; do not touch the vault (what the suites use)")
    args = ap.parse_args()

    names = args.variant or paths.variants()
    if not names:
        sys.exit("no variants found under %s" % paths.DEV)

    # 1) re-run the dashboard assembler (idempotent; embeds the view-block routes)
    cmd = [sys.executable, os.path.join(paths.DEV, "assemble_dashboard.py")]
    for n in names:
        cmd += ["--variant", n]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=paths.DEV)
    print(r.stdout.strip())
    if r.returncode != 0:
        print(r.stderr)
        sys.exit("assembler failed")
    for n in names:
        d = read(os.path.join(paths.variant(n)["stage"], "Dashboard.md"))
        # CONTRACT A: the Dashboard no longer carries a copy of the goal panel — its
        # `goal:` route writes the one-line dv.view block instead.
        assert "🎯 GOAL PANEL" not in d, f"{n} Dashboard still pastes the goal panel"
        assert "📆 TASK GANTT" not in d, f"{n} Dashboard still pastes the task Gantt"
        assert 'viewBlock("goal-panel")' in d, f"{n} Dashboard's goal: route does not write the view block"
        assert 'viewBlock("task-gantt")' in d, f"{n} Dashboard's task: route does not write the view block"

    combined_css = build_css()
    theme_css = default_theme_snippet(combined_css)

    failed = False
    for n in names:
        cfg = paths.variant(n)
        built = build_variant(cfg, combined_css, theme_css, args.check or args.no_install)
        check_clean(built, n)
        dest = os.path.abspath(args.out) if args.out else cfg["vault"]
        diffs = [] if args.no_install else install(built, dest, args.check)

        print("")
        print("== %s → %s ==" % (n, os.path.relpath(dest, paths.REPO)))
        files = rel_files(built)
        for rel in files:
            p = os.path.join(built, rel)
            print("  %s  %7d  %s" % (rel, os.path.getsize(p), md5(p)[:8]))
        print("  (%d files)" % len(files))
        if args.no_install:
            print("  built only (--no-install); the vault was not touched")
        elif args.check:
            if diffs or STALE:
                failed = True
                print("  DIFFERS from the tree in the repo:")
                for kind, rel in diffs:
                    print("    %-8s %s" % (kind, rel))
            else:
                print("  identical to the tree in the repo (%d files compared)" % len(files))
        elif diffs:
            print("  wrote %d file(s): %s" % (len(diffs), ", ".join(r for _, r in diffs[:6])
                                              + (" …" if len(diffs) > 6 else "")))
        else:
            print("  nothing to write — already up to date")

    print("")
    if failed:
        print("FAIL integrate — the vault in the repo is not what dev/ builds. Run `npm run build`.")
        return 1
    print("OK integrate")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
