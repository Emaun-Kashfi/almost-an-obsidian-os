#!/usr/bin/env python3
"""V-3 / V-1d: CSS audit.
 (a) every class emitted by the dashboard JS + standalone notes has a rule in the
     combined storm.css;
 (b) the appended portion never re-declares a selector that the ORIGINAL portion
     already declares (a silent override of existing intent).
Prints a report; exit 1 only on hard failures (unstyled classes that matter).
"""
import re, sys, os, json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import paths  # noqa: E402

R = paths.DEV
FIN = paths.variant()["built"]
# CONTRACT §C vendored the base sheet into the repo (see integrate.py); the
# "original portion" of the combined stylesheet is now that file, which is what
# integrate.py actually concatenates. Splitting on the read-only upstream copy
# would misalign the moment a §C fix changes a byte count in the base sheet.
ORIG = paths.BASE_CSS

SRC_FILES = [
    f"{R}/dashboard/buildHub.js",
    f"{R}/dashboard/initHub.js",
    f"{R}/dashboard/livedata.js",
    f"{FIN}/_scripts/goal-panel.js",
    f"{FIN}/_scripts/daily-tables.txt",
    f"{FIN}/Goals/🎯 Goals.md",
    f"{FIN}/Tasks/📋 Tasks.md",
    f"{FIN}/🧹 Triage.md",
]

def read(p):
    return open(p, encoding="utf-8").read()

# ---------- 1. classes emitted by the code ----------
emitted = {}   # cls -> set(files)
def note(cls, f):
    cls = cls.strip()
    if not cls or "${" in cls or "+" in cls:
        return
    emitted.setdefault(cls, set()).add(os.path.basename(f))

for f in SRC_FILES:
    txt = read(f)
    # class="a b c"  /  class=\"a b\"  (inside template literals)
    for m in re.finditer(r'class\s*=\s*\\?"([^"$<>]*?)\\?"', txt):
        for c in m.group(1).split():
            note(c, f)
    # class="a ${...}"  -> take the literal leading part
    for m in re.finditer(r'class\s*=\s*\\?"([^"<>]*?)\\?"', txt):
        lit = re.sub(r'\$\{[^}]*\}', ' ', m.group(1))
        for c in lit.split():
            note(c, f)
    # classList.add("x") / .toggle("x", ..) / classList.remove
    for m in re.finditer(r'classList\.(?:add|toggle|remove|contains)\(\s*"([^"]+)"', txt):
        note(m.group(1), f)
    # className = "x y"
    for m in re.finditer(r'className\s*=\s*"([^"]+)"', txt):
        for c in m.group(1).split():
            note(c, f)
    # cls: "x"
    for m in re.finditer(r'cls\s*:\s*"([^"]+)"', txt):
        for c in m.group(1).split():
            note(c, f)
    # push a literal class in a cls array:  cls.push("nm-sub")
    for m in re.finditer(r'cls\.push\(\s*"([^"]+)"', txt):
        note(m.group(1), f)

# ---------- 2. selectors present in the combined stylesheet ----------
css = read(f"{FIN}/.obsidian/snippets/storm.css")
orig = read(ORIG)
split_at = len(orig.rstrip("\n"))
css_orig, css_add = css[:split_at], css[split_at:]

def strip_comments(s):
    return re.sub(r'/\*.*?\*/', '', s, flags=re.S)

def classes_in(s):
    return set(re.findall(r'\.(-?[_a-zA-Z][\w-]*)', strip_comments(s)))

have_all = classes_in(css)
have_orig = classes_in(css_orig)
have_add = classes_in(css_add)

missing = sorted(c for c in emitted if c not in have_all)

# ---------- 3. duplicated selectors between the two portions ----------
def selectors_of(block):
    """return list of normalised selector strings (each comma-part) with their rule body"""
    block = strip_comments(block)
    out = []
    depth = 0
    buf = ""
    i = 0
    while i < len(block):
        ch = block[i]
        if ch == "{":
            if depth == 0:
                sel = buf.strip()
                # find the matching close brace
                j, d = i, 0
                while j < len(block):
                    if block[j] == "{": d += 1
                    elif block[j] == "}":
                        d -= 1
                        if d == 0: break
                    j += 1
                body = block[i+1:j]
                if sel and not sel.startswith("@"):
                    for part in sel.split(","):
                        p = re.sub(r'\s+', ' ', part).strip()
                        if p:
                            out.append((p, re.sub(r'\s+', ' ', body).strip()))
                elif sel.startswith("@"):
                    out.extend(selectors_of(body))
                buf = ""
                i = j + 1
                continue
            depth += 1
        elif ch == "}":
            depth = max(0, depth - 1)
            buf = ""
        else:
            buf += ch
        i += 1
    return out

so = selectors_of(css_orig)
sa = selectors_of(css_add)
orig_sel = {}
for s, b in so:
    orig_sel.setdefault(s, []).append(b)
dupes = []
for s, b in sa:
    if s in orig_sel:
        dupes.append((s, orig_sel[s], b))

# classes that legitimately carry no rule of their own — each with the reason
NO_RULE_OK = {
    "js-clock": "JS hook only", "js-secs": "JS hook only", "js-date": "JS hook only",
    "js-greet": "JS hook only", "pomo-live": "JS hook only",
    "storm-base-css": "<style> element", "storm-theme-css": "<style> element",
    "dataview": "Obsidian/Dataview own class", "table-view-table": "Obsidian/Dataview own class",
    "internal-link": "Obsidian own class",
    "goal-err": "error div carries its own inline style",
    "triage-error": "error div carries its own inline style",
    "dur": "child of the styled .music .mtime flex row",
    "st-": "extractor artefact of st-${status} (st-active/backlog/waiting/done are styled)",
    "expanded": "state flag on .nm-row; the ▾/▴ glyph is the affordance",
    "nm-inbox": "inbox rows are fully styled by .nm-row",
    "pill-toggle": "styled by .pill",
    "pulse": "the card is styled by .card; SPEC §9's .pn/.pl are styled",
    "tr-bulk": "styled by .tr-btn.pill (+ .armed for the confirm state)",
}
# selectors the appended portion may legitimately restate
DUPE_OK = {".storm-hub"}

def ok(m): print("ok  - " + m)
def bad(m): print("FAIL: " + m)

fails = 0
print("== V-1d CSS audit ==")
print(f"classes emitted by code : {len(emitted)}")
print(f"classes with a rule     : {len(emitted)-len(missing)}")
unexpected = [c for c in missing if c not in NO_RULE_OK]
for c in missing:
    if c in NO_RULE_OK:
        print(f"   (no rule, by design) .{c:<18} — {NO_RULE_OK[c]}")
if unexpected:
    for c in unexpected:
        bad(f"unstyled class .{c} (emitted by {', '.join(sorted(emitted[c]))})")
        fails += 1
else:
    ok(f"every class emitted by the JS/notes has a rule in storm.css ({len(emitted)-len(missing)}/{len(emitted)}; "
       f"{len(missing)} documented exceptions)")

print()
print(f"selectors in ORIGINAL portion : {len(orig_sel)}")
print(f"selectors in APPENDED portion : {len({s for s,_ in sa})}")
badd = [d for d in dupes if d[0] not in DUPE_OK]
for s, old, new in dupes:
    if s in DUPE_OK:
        print(f"   (restated, by design) {s} → {new[:90]}")
if badd:
    for s, old, new in badd:
        bad(f"the appended CSS re-declares an existing selector `{s}`")
        print(f"      orig: {old[0][:150]}")
        print(f"      new : {new[:150]}")
        fails += 1
else:
    ok("the appended CSS never re-declares an existing storm.css selector with different intent")

json.dump({"missing": missing, "dupes": [d[0] for d in dupes]},
          open("/tmp/css_audit.json", "w"))
sys.exit(1 if fails else 0)
