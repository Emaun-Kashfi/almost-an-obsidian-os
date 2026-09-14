#!/usr/bin/env python3
"""V-1a/1b/1c regression guard: the SPEC §1/§2 rules are duplicated by design into
five self-contained blocks. Assert the duplicates are still character-identical, so a
future edit to one of them cannot silently fork the behaviour again."""
import io, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import paths  # noqa: E402

FIN = paths.variant()["built"]
SRC = {
    "Dashboard.md":      f"{FIN}/Dashboard.md",
    "goal-panel.js":     f"{FIN}/_scripts/goal-panel.js",
    "🎯 Goals.md":       f"{FIN}/Goals/🎯 Goals.md",
    "📋 Tasks.md":       f"{FIN}/Tasks/📋 Tasks.md",
    "daily-tables.txt":  f"{FIN}/_scripts/daily-tables.txt",
    "🧹 Triage.md":      f"{FIN}/🧹 Triage.md",
}
T = {}
for k, p in SRC.items():
    t = io.open(p, encoding="utf-8").read()
    if k == "Dashboard.md":          # skip the goal panel embedded as a JS string constant
        t = t[t.index("/* ===================== live data ===================== */"):]
    T[k] = t

fails, oks = [], []
def ok(m): oks.append(m); print("ok  - " + m)
def bad(m): fails.append(m); print("FAIL: " + m)

def norm(s):
    return re.sub(r"\s+", " ", s).strip()

def grab(key, pat, flags=0):
    m = re.search(pat, T[key], flags)
    return norm(m.group(0)) if m else None

# ---- 1. the sub-task heading + habit rules, verbatim, in every file that selects sub-tasks
SUBSEC = r"/sub\[-\\s\]\?tasks\?/i"
HABIT = r"/\(\^\|\\s\)#habit\(\\/\[\\p\{L\}\\p\{N\}_/-\]\+\)\*\(\?=\$\|\\s\)/u"
for k in ("Dashboard.md", "goal-panel.js", "🎯 Goals.md", "📋 Tasks.md", "daily-tables.txt"):
    if re.search(SUBSEC, T[k]): ok(f"{k}: uses the shared sub-task heading regex /sub[-\\s]?tasks?/i")
    else: bad(f"{k}: does not use the shared sub-task heading regex")
    if re.search(HABIT, T[k]): ok(f"{k}: uses the shared #habit regex")
    else: bad(f"{k}: does not use the shared #habit regex")
if re.search(HABIT, T["🧹 Triage.md"]): ok("🧹 Triage.md: uses the shared #habit regex too")
else: bad("🧹 Triage.md: uses a different #habit rule")

# the two writers that append into a `## Sub-tasks` section must accept the same spellings
RAW = {k: io.open(p, encoding="utf-8").read() for k, p in SRC.items()}
for k, pat in (("Dashboard.md", r"const SUBSEC_HEAD = [^\n]+"), ("🧹 Triage.md", r"insertInSection\(tl, /[^\n]*?/i,")):
    m = re.search(pat, RAW[k])
    if m and "sub[-\\s]?tasks?" in m.group(0): ok(f"{k}: the `## Sub-tasks` insert target accepts the same spellings — {norm(m.group(0))}")
    else: bad(f"{k}: the `## Sub-tasks` insert target uses a different regex — {m and norm(m.group(0))}")

# ---- 2. healthOf(), character-identical in the three standalone notes
# HEALTH contract: the signature now carries `opts` = { overdue, dated, remaining }.
H = {k: grab(k, r"function healthOf\(status, progress, sIso, eIso, opts\)\{.*?\n\}", re.S)
     for k in ("goal-panel.js", "🎯 Goals.md", "📋 Tasks.md")}
if len(set(H.values())) == 1 and all(H.values()):
    ok("healthOf() is character-identical in goal-panel / 🎯 Goals / 📋 Tasks")
else:
    bad("healthOf() differs between the standalone notes: " + repr(H))
# the deadline rule itself, in the copy they all share
h = list(H.values())[0] or ""
if ('if(eIso < todayIso && left > 0) return "behind";' in h
        and 'if(over === 0) return "ok";' in h and 'if(over === 1) return "risk";' in h):
    ok("healthOf() reads the sub-task deadlines: end-passed → behind, 0 → ok, 1 → risk, 2+ → behind")
else:
    bad("healthOf() no longer carries the HEALTH-contract deadline thresholds — " + repr(h))
if "if(o.dated){" in h and "const span = dayDiff(sIso, eIso);" in h:
    ok("healthOf() keeps the undated fallback (elapsed vs progress) behind the `dated` fork")
else:
    bad("healthOf() lost the undated elapsed-vs-progress fallback — " + repr(h))
# the dashboard's own healthOf is written against ISO strings; compare its thresholds
d = grab("Dashboard.md", r"function healthOf\(status, progress, startIso, endIso, opts\)\{.*?\n\}", re.S)
if d and 'gap >= -0.10 ? "ok" : gap >= -0.30 ? "risk" : "behind"' in d and '"unscheduled"' in d and '"done"' in d:
    ok("Dashboard healthOf() keeps the same -0.10 / -0.30 fallback thresholds and the same five labels")
else:
    bad("Dashboard healthOf() thresholds/labels drifted — " + repr(d))
if d and 'if (endIso < todayIso && left > 0) return "behind";' in d \
     and 'return over === 0 ? "ok" : over === 1 ? "risk" : "behind";' in d:
    ok("Dashboard healthOf() applies the same deadline thresholds as the standalone copies")
else:
    bad("Dashboard healthOf() deadline thresholds drifted — " + repr(d))

# ---- 2b. the heading-ancestor sub-task selector, character-identical in all five
for fn in ("subMarks", "subsOf"):
    S = {k: grab(k, r"function " + fn + r"\(\w+\)\{.*?\n\s*\}", re.S)
         for k in ("Dashboard.md", "goal-panel.js", "🎯 Goals.md", "📋 Tasks.md", "daily-tables.txt")}
    if len(set(S.values())) == 1 and all(S.values()):
        ok(f"{fn}() is character-identical in all five implementations")
    else:
        bad(f"{fn}() differs: " + repr({k: (v or "")[:70] for k, v in S.items()}))
# and it really is ancestor-aware, not innermost-heading only
for k in ("Dashboard.md", "goal-panel.js", "🎯 Goals.md", "📋 Tasks.md", "daily-tables.txt"):
    if "stack[stack.length-1].lvl >= lvl" in T[k] and "stack.some(x => x.sub)" in T[k]:
        ok(f"{k}: sub-task selection walks the heading ANCESTRY (level stack)")
    else:
        bad(f"{k}: sub-task selection is not ancestor-aware")

# ---- 3. linkNames(), character-identical everywhere (incl. the dashboard)
L = {k: grab(k, r"function linkNames\(v, out\)\{.*?\n\}", re.S)
     for k in ("Dashboard.md", "goal-panel.js", "🎯 Goals.md", "📋 Tasks.md")}
if len(set(L.values())) == 1 and all(L.values()):
    ok("linkNames() is character-identical in all four implementations")
else:
    bad("linkNames() differs: " + repr({k: (v or "")[:60] for k, v in L.items()}))

# ---- 4. clean(): the same five passes everywhere
PASSES = [
    r"\(\?:📅\|⏳\|🛫\|✅\|➕\|🔁\)",     # emoji + its date
    r"\[📅⏳🛫✅➕🔁\]",                    # bare emoji
    r"\(\?:⏫\|🔼\|🔽\|⏬\|🔺\)",          # priority emoji
    r"\(\^\|\\s\)#\(\?=\[\^\\s\]\*\[\\p\{L\}_\]\)",   # #tags (Obsidian rules)
    r"\\s\+\\\^\[A-Za-z0-9-\]\+\$",                   # trailing ^block-id
]
for k in ("Dashboard.md", "goal-panel.js", "🎯 Goals.md", "📋 Tasks.md", "daily-tables.txt"):
    miss = [i for i, p in enumerate(PASSES) if not re.search(p, T[k])]
    if miss: bad(f"{k}: text cleaning is missing pass(es) {miss}")
    else: ok(f"{k}: text cleaning runs the same five passes")

# ---- 5. folder exclusions (SPEC §2)
for k in ("Dashboard.md", "goal-panel.js", "🎯 Goals.md", "📋 Tasks.md", "daily-tables.txt"):
    m = re.search(r"(Fitness\|_templates\|_archive\|Archive\|\\\.trash)", T[k])
    if m: ok(f"{k}: excludes Fitness/_templates/_archive/Archive/.trash")
    else: bad(f"{k}: folder exclusion list drifted")

print()
print(f"V shared-rules: {len(oks)} ok, {len(fails)} failed")
sys.exit(1 if fails else 0)
