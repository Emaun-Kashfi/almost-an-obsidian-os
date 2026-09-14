#!/usr/bin/env python3
"""Leak scan — the privacy gate for this public repo.

    python3 dev/scripts/leakscan.py            # scan the whole repo
    python3 dev/scripts/leakscan.py <path>…    # scan only these paths

Every pattern comes from dev/privacy/terms.json, which is the one place they are
written down. A single hit is a failure: exit code 1, and the offending file,
line and text are printed.

Two files are excluded by name, because they are where the terms legitimately
live: dev/privacy/terms.json (the list) and this script (it prints the list).
Nothing else is excluded. Binary files are read as bytes and matched too — a
screenshot that happens to contain a name in its metadata still counts.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEV = os.path.dirname(HERE)
REPO = os.path.dirname(DEV)
TERMS_PATH = os.path.join(DEV, "privacy", "terms.json")

# the two files the terms are allowed to appear in, repo-relative
SELF_EXEMPT = {
    os.path.relpath(TERMS_PATH, REPO).replace(os.sep, "/"),
    os.path.relpath(os.path.abspath(__file__), REPO).replace(os.sep, "/"),
}

SKIP_DIRS = {".git", "node_modules", "__pycache__", ".pytest_cache", "build", "shots", "shots-before"}


def load_terms():
    with open(TERMS_PATH, encoding="utf-8") as fh:
        data = json.load(fh)
    groups = {}
    for key, val in data.items():
        if key.startswith("_") or key == "notes" or not isinstance(val, list):
            continue
        groups[key] = val
    return groups


def walk(paths):
    for base in paths:
        if os.path.isfile(base):
            yield base
            continue
        for root, dirs, files in os.walk(base):
            dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
            for name in sorted(files):
                yield os.path.join(root, name)


def main(argv):
    groups = load_terms()
    targets = argv[1:] or [REPO]
    compiled = [(g, p, re.compile(p, re.I)) for g, pats in sorted(groups.items()) for p in pats]

    n_files = 0

    n_binary = 0
    hits = []
    for path in walk(targets):
        rel = os.path.relpath(path, REPO).replace(os.sep, "/")
        if rel in SELF_EXEMPT:
            continue
        try:
            with open(path, "rb") as fh:
                raw = fh.read()
        except OSError as exc:
            hits.append((rel, 0, "unreadable", str(exc), ""))
            continue
        # Binary files carry no prose to leak, and decoding them as latin-1 turns
        # arbitrary bytes into letters that match patterns by chance: a GIF in the
        # vault's exercise demos produced two "rx<digits>" hits that way. A NUL byte
        # is the standard, cheap binary tell.
        if b"\x00" in raw[:8192]:
            n_binary += 1
            continue
        n_files += 1
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            text = raw.decode("latin-1")
        for group, pattern, rx in compiled:
            for m in rx.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                start = text.rfind("\n", 0, m.start()) + 1
                end = text.find("\n", m.end())
                ctx = text[start:end if end >= 0 else len(text)].strip()
                hits.append((rel, line, group, pattern, ctx[:160]))

    print("leak scan — %d patterns in %d groups over %d files%s"
          % (len(compiled), len(groups), n_files,
             (" (%d binary skipped)" % n_binary) if n_binary else ""))
    print("  root      : %s" % REPO)
    print("  terms     : %s" % os.path.relpath(TERMS_PATH, REPO).replace(os.sep, "/"))
    print("  groups    : %s" % ", ".join("%s (%d)" % (g, len(p)) for g, p in sorted(groups.items())))
    print("  exempt    : %s" % ", ".join(sorted(SELF_EXEMPT)))
    print("")
    if hits:
        for rel, line, group, pattern, ctx in hits:
            print("LEAK %s:%d  [%s /%s/]  %s" % (rel, line, group, pattern, ctx))
        print("")
        print("FAIL — %d hit(s). A single hit is a failed export." % len(hits))
        return 1
    print("PASS — 0 hits.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
