#!/usr/bin/env python3
"""V-3 — static checks over every built vault (dev/build/<variant>/vault).
  * exactly one ```dataviewjs fence pair in each Dashboard.md
  * no leftover "@@", "TODO(", "GOAL_PANEL_PLACEHOLDER"
  * file size < 140 KB (THEME2 §A/§B/§C — see the comment at the check)
  * every .md has valid frontmatter (--- on line 1 where present; YAML parses)
    EXCEPT _templates/Goal.md and _templates/Task.md, which start with <%*
  * the daily template starts with ---
  * a bundled obsidian-tasks-plugin data.json parses and globalFilter == ""
  * the combined storm.css is identical in every tree and non-trivial
  * dev/paths.js and dev/paths.py resolve to the same places
"""
import json, os, re, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import paths  # noqa: E402

VARIANTS = paths.variants()
BUILT = {v: paths.variant(v)["built"] for v in VARIANTS}
fails, oks = [], []

def ok(msg):
    oks.append(msg); print("ok  - " + msg)

def bad(msg):
    fails.append(msg); print("FAIL: " + msg)

def read(p):
    return open(p, encoding="utf-8").read()

try:
    import yaml
except ImportError:
    yaml = None
    print("note: PyYAML not available — frontmatter YAML parse will be skipped")

TEMPLATER_START = ("_templates/Goal.md", "_templates/Task.md")

for v in VARIANTS:
    root = BUILT[v]
    dash = f"{root}/Dashboard.md"
    txt = read(dash)

    # -- exactly one fence pair --------------------------------------------
    runs = txt.split("```")
    if len(runs) == 3:
        ok(f"{v}: Dashboard.md has exactly one ``` fence pair")
    else:
        bad(f"{v}: Dashboard.md has {len(runs)-1} triple-backtick runs (expected 2)")
    if re.search(r"^```dataviewjs$", txt, re.M):
        ok(f"{v}: the fence opens with ```dataviewjs")
    else:
        bad(f"{v}: no ```dataviewjs opening fence")

    # -- leftovers ----------------------------------------------------------
    for tok in ("@@", "TODO(", "GOAL_PANEL_PLACEHOLDER", "<!-- GOAL_PANEL -->"):
        if tok in txt:
            bad(f"{v}: Dashboard.md still contains {tok!r}")
        else:
            ok(f"{v}: Dashboard.md has no {tok!r}")

    # -- size ---------------------------------------------------------------
    # A "did something duplicate itself?" guard, not a budget. It went 130 → 160 KB
    # when PAUSE §4 grew the goal panel the Dashboard used to embed verbatim as the
    # GOAL_PANEL string; CONTRACT A dropped that embed (the `goal:` route writes a
    # one-line dv.view block instead). CONTRACT §B then added ~6 KB of genuinely new
    # code (initHub's storm-theme.css writer + helpers' _themeFileCss /
    # _normalizeTheme), taking the honest figure to ~131 KB — so the ceiling moves to
    # 136, still far below the ~160 KB a duplicated panel produces.
    sz = os.path.getsize(dash)
    # THEME2 §A/§B adds the --storm-* → Obsidian-variable mapping and the link
    # derivation to helpers.js (~2.5 KB here — the parts are embedded unminified),
    # and §C the three-line guard: 136 → 140, still far below the ~160 KB a
    # duplicated panel produces, which is what this guard is for.
    if sz < 140 * 1024:
        ok(f"{v}: Dashboard.md is {sz/1024:.1f} KB (< 140 KB)")
    else:
        bad(f"{v}: Dashboard.md is {sz/1024:.1f} KB (>= 140 KB)")
    # CONTRACT A: no pasted panel anywhere in the Dashboard
    for banner in ("🎯 GOAL PANEL", "📆 TASK GANTT"):
        if banner in txt:
            bad(f"{v}: Dashboard.md still pastes the {banner} panel")
        else:
            ok(f"{v}: Dashboard.md does not paste the {banner} panel")

    # -- frontmatter of every .md ------------------------------------------
    nmd = 0
    for dirpath, _, files in os.walk(root):
        for fn in sorted(files):
            if not fn.endswith(".md"):
                continue
            p = os.path.join(dirpath, fn)
            rel = os.path.relpath(p, root)
            body = read(p)
            nmd += 1
            if rel.replace(os.sep, "/") in TEMPLATER_START:
                if body.startswith("<%*"):
                    ok(f"{v}/{rel}: Templater template legitimately starts with <%*")
                else:
                    bad(f"{v}/{rel}: expected a <%* Templater opener, got {body[:12]!r}")
                continue
            if not body.startswith("---"):
                bad(f"{v}/{rel}: does not start with frontmatter (starts {body[:12]!r})")
                continue
            m = re.match(r"^---\n(.*?)\n---(\n|$)", body, re.S)
            if not m:
                bad(f"{v}/{rel}: frontmatter block is not closed by --- on its own line")
                continue
            if yaml:
                try:
                    d = yaml.safe_load(m.group(1))
                    if d is not None and not isinstance(d, dict):
                        bad(f"{v}/{rel}: frontmatter YAML is not a mapping ({type(d).__name__})")
                except Exception as e:
                    bad(f"{v}/{rel}: frontmatter YAML does not parse — {e}")
    ok(f"{v}: {nmd} markdown files checked for frontmatter")

    # -- daily template -----------------------------------------------------
    dt = read(f"{root}/_templates/Daily Note Template.md")
    if dt.startswith("---\n"):
        ok(f"{v}: Daily Note Template.md starts with --- on line 1")
    else:
        bad(f"{v}: Daily Note Template.md does not start with ---")
    if "<%*" in dt.split("---", 2)[-1].split("\n")[1] if False else True:
        pass
    # the <%* rename line must sit AFTER the frontmatter
    fm_end = dt.index("\n---", 4) + 4
    if "<%*" not in dt[:fm_end]:
        ok(f"{v}: no Templater command inside the daily template's frontmatter")
    else:
        bad(f"{v}: a <%* command sits inside the daily template's frontmatter")

    # -- CSS ----------------------------------------------------------------
    css = read(f"{root}/.obsidian/snippets/storm.css")
    if len(css) > 60000:
        ok(f"{v}: storm.css is {len(css)/1024:.1f} KB (original + additions)")
    else:
        bad(f"{v}: storm.css looks truncated ({len(css)} bytes)")

# -- the combined css is the same sheet in every tree ------------------------
sheets = {v: read(f"{BUILT[v]}/.obsidian/snippets/storm.css") for v in VARIANTS}
if len(set(sheets.values())) == 1:
    ok(f"storm.css is byte-identical across all {len(VARIANTS)} built tree(s)")
else:
    bad("storm.css differs between the built trees — every variant ships one sheet")

# -- a bundled Tasks-plugin config, if a variant ships one -------------------
seen = 0
for v in VARIANTS:
    dj = f"{BUILT[v]}/.obsidian/plugins/obsidian-tasks-plugin/data.json"
    if not os.path.isfile(dj):
        continue
    seen += 1
    try:
        d = json.load(open(dj, encoding="utf-8"))
        ok(f"{v} data.json parses as JSON")
        if d.get("globalFilter") == "":
            ok(f'{v} data.json globalFilter == ""')
        else:
            bad(f"{v} data.json globalFilter == {d.get('globalFilter')!r}")
    except Exception as e:
        bad(f"{v} data.json: {e}")
if not seen:
    ok("no variant bundles an obsidian-tasks-plugin data.json (nothing to validate)")

# -- leftovers anywhere in the built trees ----------------------------------
for v in VARIANTS:
    for dirpath, _, files in os.walk(BUILT[v]):
        for fn in files:
            p = os.path.join(dirpath, fn)
            if not fn.endswith((".md", ".txt", ".css", ".json")):
                continue
            t = read(p)
            for tok in ("GOAL_PANEL_PLACEHOLDER", "<!-- GOAL_PANEL -->", "TODO("):
                if tok in t:
                    bad(f"{v}/{os.path.relpath(p, BUILT[v])} contains {tok!r}")
ok("no GOAL_PANEL_PLACEHOLDER / marker / TODO( anywhere in a built vault")

# -- the two halves of the path table agree ---------------------------------
# Nothing under dev/ may hardcode an absolute path, and there are two tables that
# say where things are — one for node, one for python. A clone breaks in a very
# confusing way if they disagree, so they are compared here rather than trusted.
try:
    js = json.loads(subprocess.check_output(
        ["node", "-e",
         "const P=require(process.argv[1]);const v=P.variant();"
         "process.stdout.write(JSON.stringify({REPO:P.REPO,DEV:P.DEV,COMMON:P.COMMON,"
         "BASE_CSS:P.BASE_CSS,BUILD:P.BUILD,TERMS:P.TERMS,variants:P.variants(),"
         "seeds:v.seeds,stage:v.stage,built:v.built,vault:v.vault}))",
         os.path.join(paths.DEV, "paths.js")], text=True))
    py = {"REPO": paths.REPO, "DEV": paths.DEV, "COMMON": paths.COMMON,
          "BASE_CSS": paths.BASE_CSS, "BUILD": paths.BUILD, "TERMS": paths.TERMS,
          "variants": paths.variants(), "seeds": paths.variant()["seeds"],
          "stage": paths.variant()["stage"], "built": paths.variant()["built"],
          "vault": paths.variant()["vault"]}
    off = [k for k in py if js.get(k) != py[k]]
    if off:
        bad("dev/paths.js and dev/paths.py disagree on " + ", ".join(
            f"{k} ({js.get(k)!r} vs {py[k]!r})" for k in off))
    else:
        ok(f"dev/paths.js and dev/paths.py agree on all {len(py)} locations")
except Exception as e:
    bad(f"could not compare dev/paths.js with dev/paths.py — {e}")

print()
print(f"V static: {len(oks)} ok, {len(fails)} failed")
sys.exit(1 if fails else 0)
