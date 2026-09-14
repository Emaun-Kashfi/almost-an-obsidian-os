#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""inject_task_gantt.py — add the `📆 Timeline` section to task notes (GANTT.md §0).

    python3 inject_task_gantt.py [--marker | --block PATH] [--dry-run] [--force] NOTE.md …

Modes
    (default)                 insert the three-line guarded `dv.view` call — the same
                              block dev/integrate.py writes into a shipped note.
    --marker                  insert `<!-- TASK_GANTT -->` instead, for a note that
                              will go through the build rather than into a vault.
    --block PATH              insert the fenced block in PATH verbatim (for a panel
                              that is not a `dv.view` file).

Placement
    Immediately BEFORE the first heading whose text matches /sub[-\\s]?tasks?/i
    (any level; the new heading copies that level), with exactly one blank line
    on each side.  If there is no such heading: before the `🗒️ Notes` heading
    when present, else appended at the end of the note.  Frontmatter, a
    Templater `<%* … -%>` preamble and fenced code blocks are never scanned and
    never written into.

Idempotent
    A note that already contains `class="tgantt"`, a `📆 Timeline` heading or
    `<!-- TASK_GANTT -->` is left alone.

Safety
    Only notes whose frontmatter says `type: task` are touched (use --force to
    override).  Line endings (LF/CRLF) and the trailing newline are preserved.

Exit code 0 unless a file could not be read or written.
"""

import argparse
import os
import re
import sys

HEADING = "📆 Timeline"
MARKER = "<!-- TASK_GANTT -->"

# CONTRACT A / THEME2 §C — what a note carries instead of a pasted panel. This is
# the same text dev/integrate.py substitutes for the marker; tests/G2 asserts every
# shipped note matches it character for character, so keep the two in step.
FENCE = "`" * 3
VIEW_BLOCK = (
    FENCE + "dataviewjs\n"
    'const p = "%s", f = x => app.metadataCache.getFirstLinkpathDest(x, "");\n'
    'if (f(p + ".js") || f(p + "/view.js")) await dv.view(p);\n'
    'else dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. '
    'On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, '
    'then reopen this note.", { cls: "panel-err storm-missing-view" });\n'
    + FENCE)

FENCE_RE = re.compile(r"^\s{0,3}(`{3,}|~{3,})")
HEAD_RE = re.compile(r"^(#{1,6})\s+(.*)$")
SUBSEC_RE = re.compile(r"sub[-\s]?tasks?", re.I)
TYPE_TASK_RE = re.compile(r"^\s*type\s*:\s*[\"']?task[\"']?\s*$", re.M)
ALREADY_RE = re.compile(r"class=\"tgantt\"|class='tgantt'|<!--\s*TASK_GANTT\s*-->")
TIMELINE_HEAD_RE = re.compile(r"^#{1,6}\s+.*📆\s*Timeline", re.M)


# ─────────────────────────────────────────────────────────────────────────────
# scanning
# ─────────────────────────────────────────────────────────────────────────────
def scan(lines):
    """→ (body_start, frontmatter_text, headings) with headings = [(i, level, text)].

    Skips a leading Templater `<%* … -%>` preamble, the YAML frontmatter and
    every fenced code block, so nothing inside them is ever matched."""
    n = len(lines)
    i = 0

    # Templater preamble: a leading `<%` tag, ended by the first line with `%>`
    if i < n and lines[i].lstrip().startswith("<%"):
        j = i
        while j < n and "%>" not in lines[j]:
            j += 1
        if j < n:
            i = j + 1

    while i < n and lines[i].strip() == "":
        i += 1

    fm_text = ""
    if i < n and lines[i].strip() == "---":
        j = i + 1
        while j < n and lines[j].strip() not in ("---", "..."):
            j += 1
        if j < n:
            fm_text = "\n".join(lines[i + 1:j])
            i = j + 1

    body_start = i
    heads, in_fence, fence_ch = [], False, ""
    for k in range(body_start, n):
        m = FENCE_RE.match(lines[k])
        if m:
            ch = m.group(1)[0]
            if not in_fence:
                in_fence, fence_ch = True, ch
                continue
            if ch == fence_ch:
                in_fence, fence_ch = False, ""
                continue
        if in_fence:
            continue
        hm = HEAD_RE.match(lines[k])
        if hm:
            heads.append((k, len(hm.group(1)), hm.group(2).strip()))
    return body_start, fm_text, heads


def is_notes_heading(text):
    """`🗒️ Notes`, `Notes`, `## 📝 notes` … — the emoji is optional."""
    return re.sub(r"^[^0-9A-Za-z]+", "", text).strip().lower() == "notes"


# ─────────────────────────────────────────────────────────────────────────────
# injection
# ─────────────────────────────────────────────────────────────────────────────
def inject(lines, payload):
    """→ (new_lines, where) with where in {'sub-tasks', 'notes', 'end'}."""
    body_start, _fm, heads = scan(lines)

    target, level = None, 2
    for (idx, lvl, text) in heads:
        if SUBSEC_RE.search(text):
            target, level, where = idx, lvl, "sub-tasks"
            break
    if target is None:
        for (idx, lvl, text) in heads:
            if is_notes_heading(text):
                target, level, where = idx, lvl, "notes"
                break

    section = ["#" * level + " " + HEADING, ""] + list(payload)

    if target is None:
        k = len(lines)
        while k > body_start and lines[k - 1].strip() == "":
            k -= 1
        lead = [""] if k > 0 else []
        return lines[:k] + lead + section, "end"

    prev = target
    while prev > body_start and lines[prev - 1].strip() == "":
        prev -= 1
    lead = [""] if prev > 0 else []
    return lines[:prev] + lead + section + [""] + lines[target:], where


def process(path, payload, force=False, dry_run=False):
    """→ (status_line, ok)."""
    try:
        # newline="" keeps CRLF intact so it can be restored on write
        with open(path, "r", encoding="utf-8", newline="") as fh:
            raw = fh.read()
    except Exception as exc:                                   # unreadable
        return "failed (%s)  %s" % (exc.__class__.__name__, path), False

    crlf = "\r\n" in raw
    text = raw.replace("\r\n", "\n")
    tail_nl = text.endswith("\n")
    lines = text.split("\n")
    if tail_nl:
        lines.pop()

    if ALREADY_RE.search(text) or TIMELINE_HEAD_RE.search(text):
        return "skipped (already has timeline)  %s" % path, True

    _bs, fm_text, _heads = scan(lines)
    if not force and not TYPE_TASK_RE.search(fm_text):
        return "skipped (not a task note)  %s" % path, True

    new_lines, where = inject(lines, payload)
    out = "\n".join(new_lines) + ("\n" if tail_nl else "")
    if crlf:
        out = out.replace("\n", "\r\n")

    label = {"sub-tasks": "injected  %s",
             "notes": "injected (before 🗒️ Notes)  %s",
             "end": "injected (no sub-tasks heading, appended at end)  %s"}[where] % path
    if dry_run:
        return "[dry-run] " + label, True
    try:
        with open(path, "w", encoding="utf-8", newline="") as fh:
            fh.write(out)
    except Exception as exc:                                   # unwritable
        return "failed (%s)  %s" % (exc.__class__.__name__, path), False
    return label, True


# ─────────────────────────────────────────────────────────────────────────────
# cli
# ─────────────────────────────────────────────────────────────────────────────
def load_payload(args):
    if args.marker:
        return [MARKER]
    if not args.block:
        return (VIEW_BLOCK % args.view).split("\n")
    with open(args.block, "r", encoding="utf-8") as fh:
        block = fh.read()
    return block.replace("\r\n", "\n").rstrip("\n").split("\n")


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="inject_task_gantt.py",
        description="Insert the 📆 Timeline section into task notes (idempotent).")
    grp = ap.add_mutually_exclusive_group()
    grp.add_argument("--marker", action="store_true",
                     help="insert <!-- TASK_GANTT --> instead of the block")
    grp.add_argument("--block", metavar="PATH",
                     help="insert the fenced block in PATH verbatim, instead of a dv.view call")
    ap.add_argument("--view", metavar="PATH", default="_scripts/task-gantt",
                    help="vault path of the view the inserted block calls, no .js "
                         "(default: _scripts/task-gantt) — same spelling as refresh_blocks.py")
    ap.add_argument("--dry-run", action="store_true", help="report, write nothing")
    ap.add_argument("--force", action="store_true",
                    help="inject even when the frontmatter is not `type: task`")
    ap.add_argument("notes", nargs="+", metavar="NOTE.md")
    args = ap.parse_args(argv)

    try:
        payload = load_payload(args)
    except Exception as exc:
        print("failed (%s)  %s" % (exc.__class__.__name__, args.block or ("dv.view " + args.view)))
        return 1

    rc = 0
    for path in args.notes:
        line, ok = process(path, payload, force=args.force, dry_run=args.dry_run)
        print(line)
        if not ok:
            rc = 1
    return rc


if __name__ == "__main__":
    sys.exit(main())
