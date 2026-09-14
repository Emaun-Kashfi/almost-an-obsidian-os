#!/usr/bin/env python3
"""Rewrite the ONE embedded dataviewjs block in a goal / task note, leaving every
other byte of the note untouched.

Two modes:

  --view NAME     CONTRACT A + THEME2 §C: replace the block with the guarded call

                      ```dataviewjs
                      const p = "_scripts/NAME", f = x => app.metadataCache.getFirstLinkpathDest(x, "");
                      if (f(p + ".js") || f(p + "/view.js")) await dv.view(p);
                      else dv.el("div", "⚠️ " + p + ".js is missing from this device, …", …);
                      ```

                  The panel code lives in exactly one vault file, `_scripts/NAME.js`,
                  and the note never has to be rewritten again: the three lines know
                  the panel's NAME and nothing else about it.

                  This mode converts BOTH shapes that can be in a note today — an
                  older pasted panel block (tens of KB of dataviewjs) and the bare
                  `await dv.view("…")` one-liner that replaced it — because it
                  replaces whatever the note's single fenced block is, whole.

  --panel FILE    the older behaviour: replace the block with the current contents
                  of FILE (itself one fenced dataviewjs block). Only needed for a
                  panel that is not a `dv.view` file.

Both modes REFUSE any note that does not contain exactly one fenced dataviewjs
block, so a note with hand-added dataviewjs is never silently rewritten.

Guarantees, checked per file before anything is written:
  * exactly one ```dataviewjs … ``` block in the note
  * only that block changes — the bytes before and after it are compared and must
    be identical, so nothing else can move
  * line endings are preserved: a CRLF note gets a CRLF one-liner, an LF note LF;
    no other line in the file is touched, and no trailing newline is added or removed
  * the file is read and written as bytes (UTF-8), so a BOM survives too

Usage:
  refresh_blocks.py --view _scripts/task-gantt  --expect-heading '## 📆 Timeline' NOTE.md ...
  refresh_blocks.py --view _scripts/goal-panel  --dry-run  Goals/*.md
  refresh_blocks.py --panel some-panel.txt NOTE.md ...

Exit status: 0 when every note was rewritten or already current, 1 if any was refused.
"""
import argparse
import re
import sys

# tolerate CRLF notes; the fence must open at the start of a line
BLOCK = re.compile(r"(?m)^```dataviewjs\r?\n.*?\r?\n```", re.S)


def one_liner(view_name, eol):
    """The block CONTRACT A + THEME2 §C puts in a note, in the note's own line ending.

    Byte-identical to what integrate.py's view_block() and the Dashboard's own
    viewBlock() write, in both vaults — tests compare the three.
    """
    return eol.join([
        "```dataviewjs",
        'const p = "%s", f = x => app.metadataCache.getFirstLinkpathDest(x, "");' % view_name,
        'if (f(p + ".js") || f(p + "/view.js")) await dv.view(p);',
        'else dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. '
        'On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, '
        'then reopen this note.", { cls: "panel-err storm-missing-view" });',
        "```",
    ])


def main():
    ap = argparse.ArgumentParser(
        description="Swap the one embedded dataviewjs block in a note.",
        formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--view", metavar="NAME",
                      help='vault path of the view, e.g. _scripts/task-gantt (no .js)')
    mode.add_argument("--panel", metavar="FILE",
                      help="file holding one fenced dataviewjs block to paste in")
    ap.add_argument("--expect-heading", default=None,
                    help="refuse unless the note contains this heading")
    ap.add_argument("-n", "--dry-run", action="store_true",
                    help="report what would change and write nothing")
    ap.add_argument("notes", nargs="+")
    a = ap.parse_args()

    panel = None
    if a.panel:
        panel = open(a.panel, encoding="utf-8").read().rstrip("\n")
        if not (panel.startswith("```dataviewjs") and panel.endswith("```")):
            sys.exit("%s is not one fenced dataviewjs block" % a.panel)
    else:
        view = a.view[:-3] if a.view.endswith(".js") else a.view
        if view != a.view:
            print("note: --view takes the path WITHOUT .js — using %r" % view)

    rc = 0
    changed = skipped = refused = 0
    for p in a.notes:
        try:
            raw = open(p, "rb").read()
        except OSError as exc:
            print("REFUSED (unreadable)      %s — %s" % (p, exc)); refused += 1; rc = 1; continue
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            print("REFUSED (not UTF-8)       %s — %s" % (p, exc)); refused += 1; rc = 1; continue

        hits = list(BLOCK.finditer(text))
        if len(hits) != 1:
            print("REFUSED (%d blocks)        %s" % (len(hits), p)); refused += 1; rc = 1; continue
        m = hits[0]
        old = m.group(0)

        if a.expect_heading and a.expect_heading not in text:
            print("REFUSED (no %r)  %s" % (a.expect_heading, p)); refused += 1; rc = 1; continue

        # the note's own line ending, taken from the block that is being replaced
        eol = "\r\n" if "\r\n" in old else "\n"
        new = panel if panel is not None else one_liner(view, eol)
        if panel is not None and eol == "\r\n":
            new = new.replace("\r\n", "\n").replace("\n", "\r\n")

        if old == new:
            print("already current           %s" % p); skipped += 1; continue

        out = text[:m.start()] + new + text[m.end():]

        # nothing outside the block may move
        if out[:m.start()] != text[:m.start()] or out[m.start() + len(new):] != text[m.end():]:
            print("REFUSED (collateral change) %s" % p); refused += 1; rc = 1; continue
        blob = out.encode("utf-8")
        if blob.replace(new.encode("utf-8"), b"\0", 1) != raw.replace(old.encode("utf-8"), b"\0", 1):
            print("REFUSED (collateral change) %s" % p); refused += 1; rc = 1; continue

        verb = "would rewrite" if a.dry_run else "rewrote      "
        print("%s %6d → %-5d %s%s" % (verb, len(old.encode("utf-8")), len(new.encode("utf-8")), p,
                                      "  (CRLF)" if eol == "\r\n" else ""))
        if not a.dry_run:
            open(p, "wb").write(blob)
        changed += 1

    print("\n%s: %d rewritten, %d already current, %d refused"
          % ("dry run" if a.dry_run else "done", changed, skipped, refused))
    return rc


if __name__ == "__main__":
    sys.exit(main())
