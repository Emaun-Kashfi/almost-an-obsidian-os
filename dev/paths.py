#!/usr/bin/env python3
"""dev/paths.py — every path in this repo, resolved from the repo root.

The Python half of the same table as dev/paths.js. Nothing under dev/ may
hardcode an absolute path: a clone has to work from wherever it lands.
tests/V/static_checks.py asserts the two halves agree.
"""
import json
import os

DEV = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(DEV)

COMMON = os.path.join(DEV, "common")
DASHBOARD = os.path.join(DEV, "dashboard")
BASE = os.path.join(DEV, "base")
BASE_CSS = os.path.join(DEV, "base", ".obsidian", "snippets", "storm.css")
TESTS = os.path.join(DEV, "tests")
A11Y = os.path.join(DEV, "a11y")
TOOLS = os.path.join(DEV, "tools")
SPECS = os.path.join(DEV, "specs")
# scratch: everything a build produces that is not the vault. .gitignored.
BUILD = os.path.join(DEV, "build")
TERMS = os.path.join(DEV, "privacy", "terms.json")

DEFAULT_VARIANT = "template"


def variants():
    """Every directory under dev/ that carries a variant.json."""
    return sorted(
        d for d in os.listdir(DEV)
        if os.path.isfile(os.path.join(DEV, d, "variant.json"))
    )


def variant(name=None):
    """The variant's config, with seeds/stage/vault resolved to real paths."""
    name = name or DEFAULT_VARIANT
    # A variant is normally a directory name under dev/. A PATH (anything with a
    # separator) also works, so a private variant can live outside dev/ and a test
    # can build a throwaway one — the build never needs to know the difference.
    if os.sep in name or "/" in name:
        directory = os.path.normpath(os.path.join(REPO, name))
        name = os.path.basename(directory)
    else:
        directory = os.path.join(DEV, name)
    cfg_path = os.path.join(directory, "variant.json")
    if not os.path.isfile(cfg_path):
        raise SystemExit("no such variant: %s (have: %s)" % (name, ", ".join(variants())))
    with open(cfg_path, encoding="utf-8") as fh:
        cfg = json.load(fh)
    cfg["name"] = name
    cfg["seeds"] = directory
    cfg["stage"] = os.path.join(BUILD, name)
    # the whole vault as integrate.py just built it; tests assert against this
    cfg["built"] = os.path.join(BUILD, name, "vault")
    cfg["vault"] = os.path.normpath(os.path.join(REPO, cfg["vault"]))
    return cfg


def forbidden_terms():
    """The privacy guard's patterns, from the one file that holds them."""
    with open(TERMS, encoding="utf-8") as fh:
        data = json.load(fh)
    out = []
    for key, val in data.items():
        if key.startswith("_") or key == "notes" or not isinstance(val, list):
            continue
        out.extend(val)
    return out
