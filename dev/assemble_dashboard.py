#!/usr/bin/env python3
"""
Assemble the Storm Dashboard (specs/SPEC.md §3.6) out of the parts in dev/dashboard/
into dev/build/<variant>/Dashboard.md, ready for integrate.py to fold into a vault.

    python3 dev/assemble_dashboard.py                 # every variant
    python3 dev/assemble_dashboard.py --variant template

The four parts (helpers, buildHub, initHub, livedata) are concatenated inside one
try/catch and wrapped in a single ```dataviewjs fence. The ONLY thing that differs
between variants is the frontmatter and the three constants substituted into
livedata.js's @@VARIANT@@ block — and all of those come out of the variant's own
dev/<variant>/variant.json, never out of this file.

Idempotent: re-running writes byte-identical files (nothing is timestamped).
"""

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths  # noqa: E402

VARIANT_RE = re.compile(r"/\* @@VARIANT@@ \*/.*?/\* @@/VARIANT@@ \*/", re.S)
BQ = "`"


def read_part(name: str) -> str:
    p = os.path.join(paths.DASHBOARD, name)
    if not os.path.isfile(p):
        sys.exit("missing source part: %s" % p)
    with open(p, encoding="utf-8") as fh:
        return fh.read().rstrip("\n")


def build(cfg) -> str:
    dash = cfg["dashboard"]
    helpers = read_part("helpers.js")
    build_hub = read_part("buildHub.js")
    init_hub = read_part("initHub.js")
    livedata = read_part("livedata.js")

    # NB: the @@VARIANT@@ sentinels live only in the SOURCE part (dashboard/livedata.js);
    # the assembled note must not carry build markers.
    variant_block = "\n".join([
        "/* vault variant: %s */" % cfg["name"],
        "const NAME = %s;" % dash["nameExpr"],
        "const BANNER_FALLBACK_PATH = %s;" % json.dumps(dash["bannerPath"]),
        "const BANNER_FALLBACK_NAME = %s;" % json.dumps(dash["bannerName"]),
    ])
    livedata, n = VARIANT_RE.subn(lambda _m: variant_block, livedata)
    if n != 1:
        sys.exit("livedata.js: expected exactly one @@VARIANT@@ block, found %d" % n)

    # CONTRACT A: the goal panel is no longer embedded here. initHub's `goal:` and
    # `task:` routes write a one-line `await dv.view("_scripts/<name>")` block and
    # the panel code lives in _scripts/<name>.js — one file, never a pasted copy.
    body = "\n\n".join([
        "try {",
        helpers,
        build_hub,
        init_hub,
        livedata,
    ])

    tail = (
        "\n\n} catch(err) {\n"
        "  this.container.innerHTML = '<div style=\"color:#e0736b;padding:18px;"
        "font-family:sans-serif\">⚡ Storm hub error: ' + err.message + '</div>';\n"
        "  console.error(err);\n"
        "}\n"
    )

    fence = BQ * 3
    frontmatter = "\n".join(dash["frontmatter"]) + "\n"
    return frontmatter + "\n" + fence + "dataviewjs\n" + body + tail + fence + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--variant", action="append", default=None,
                    help="variant to assemble (repeatable); default: every variant in dev/")
    args = ap.parse_args()

    names = args.variant or paths.variants()
    if not names:
        sys.exit("no variants found under %s" % paths.DEV)

    for name in names:
        cfg = paths.variant(name)
        md = build(cfg)
        # the outer fence must be the only triple-backtick run in the file
        inner = md.split(BQ * 3)
        if len(inner) != 3:
            sys.exit("%s: the assembled file has %d triple-backtick runs (expected 2)"
                     % (name, len(inner) - 1))
        dest = os.path.join(cfg["stage"], "Dashboard.md")
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        old = None
        if os.path.isfile(dest):
            with open(dest, encoding="utf-8") as fh:
                old = fh.read()
        with open(dest, "w", encoding="utf-8") as fh:
            fh.write(md)
        state = "unchanged" if old == md else ("updated" if old is not None else "created")
        print("%-9s %s  (%d lines, %.1f KB) %s"
              % (name, os.path.relpath(dest, paths.REPO), md.count("\n") + 1,
                 len(md.encode("utf-8")) / 1024.0, state))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
