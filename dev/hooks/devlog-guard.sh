#!/bin/sh
# ════════════════════════════════════════════════════════════════════════════
# devlog-guard.sh — the one implementation of the DEVLOG rule.
#
#   sh dev/hooks/devlog-guard.sh warn   [<commit-msg-file>]
#   sh dev/hooks/devlog-guard.sh block  [<commit-msg-file>]
#
# The rule: if a commit touches anything under dev/ or "Storm Dashboard Vault/",
# then dev/DEVLOG.md must be staged AND must have gained a NEW top entry.
#
# Called by both hooks in this directory:
#   pre-commit   runs it in `warn` mode — early, but git has not written the
#                commit message yet, so `[skip devlog]` is unreadable there.
#   commit-msg   runs it in `block` mode with the message file, which is the only
#                place both escape hatches can be honoured.
#
# POSIX sh. No dependencies. Nothing here is GNU-only, so it works on macOS.
#
# IT MUST NOT TOUCH THE INDEX. This repo lives on a mount where git sometimes
# cannot unlink, and a stale .git/index.lock left behind by an ordinary status
# refresh has already broken one commit. So: GIT_OPTIONAL_LOCKS=0, and nothing
# but read-only plumbing (`git diff-index --cached`, `git show`). No `git add`,
# no `git status`, no `git stash`, no `git update-index`.
# ════════════════════════════════════════════════════════════════════════════
set -u
GIT_OPTIONAL_LOCKS=0
export GIT_OPTIONAL_LOCKS

MODE="${1:-block}"
MSGFILE="${2:-}"

DEVLOG="dev/DEVLOG.md"
# git's fixed hash of the empty tree — lets the very first commit diff against
# "nothing" without creating any object.
EMPTY_TREE="4b825dc642cb6eb9a060e54bf8d69288fbee4904"

TOP=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$TOP" || exit 0

if git rev-parse --verify -q HEAD >/dev/null 2>&1; then
  BASE=HEAD
else
  BASE="$EMPTY_TREE"
fi

STAGED=$(git diff-index --cached --name-only "$BASE" -- 2>/dev/null)
[ -n "$STAGED" ] || exit 0

# does this commit touch the code or the built vault?
WATCHED=$(printf '%s\n' "$STAGED" | grep -E '^(dev/|Storm Dashboard Vault/)' || true)
[ -n "$WATCHED" ] || exit 0

# escape hatch 2: "[skip devlog]" anywhere in the commit message (block mode only;
# in warn mode git has not written the message yet, so there is nothing to read)
if [ -n "$MSGFILE" ] && [ -f "$MSGFILE" ]; then
  if grep -qi '\[skip devlog\]' "$MSGFILE"; then
    exit 0
  fi
fi

# the first `## ` heading of a DEVLOG revision — "" when the file is not there
top_entry() {
  git show "$1" 2>/dev/null | awk '/^## /{print; exit}'
}

STAGED_DEVLOG=$(printf '%s\n' "$STAGED" | grep -x "$DEVLOG" || true)
NEW_TOP=$(top_entry ":$DEVLOG")
OLD_TOP=$(top_entry "$BASE:$DEVLOG")

REASON=""
if [ -z "$STAGED_DEVLOG" ]; then
  REASON="$DEVLOG is not staged."
elif [ -z "$NEW_TOP" ]; then
  REASON="$DEVLOG has no '## ' entry at all."
elif [ "$NEW_TOP" = "$OLD_TOP" ]; then
  REASON="$DEVLOG still opens with the same entry as HEAD:
             $NEW_TOP
           A change set needs its OWN entry, added at the TOP (newest first)."
fi

if [ -z "$REASON" ]; then
  # The entry is there. Nothing below blocks — it is only a nudge, because the
  # hook's job is "there is a record", not "the record is well written".
  BODY=$(git show ":$DEVLOG" 2>/dev/null | awk '/^## /{n++} n==1' | head -20)
  printf '%s' "$BODY" | grep -q '\*\*Agent:\*\*' || \
    echo "devlog: note — the new entry has no '**Agent:** <tool/model>' line. Please name yourself."
  printf '%s' "$BODY" | grep -q '\*\*Why:\*\*' || \
    echo "devlog: note — the new entry has no '**Why:**' line. The reason matters more than the diff."
  exit 0
fi

TODAY=$(date +%Y-%m-%d)
N=$(printf '%s\n' "$WATCHED" | wc -l | tr -d ' ')

# pre-commit: a one-line heads-up, printed before the editor opens. The full
# instructions belong with the refusal, which happens in commit-msg a moment
# later; printing them twice just buries them.
if [ "$MODE" != "block" ]; then
  cat >&2 <<EOF

  devlog: this commit changes $N file(s) under dev/ or "Storm Dashboard Vault/".
          $REASON
          commit-msg will refuse it. Add an entry at the top of $DEVLOG,
          or use --no-verify / [skip devlog].

EOF
  exit 0
fi

cat >&2 <<EOF

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  DEVLOG required                                                         │
  └──────────────────────────────────────────────────────────────────────────┘

  This commit changes $N file(s) under dev/ or "Storm Dashboard Vault/", and
  every change to this system is logged so the next agent — any vendor, any
  model — can see what changed and why.

  $REASON

  Add an entry at the TOP of $DEVLOG (newest first), stage it, and commit again:

## $TODAY · <one short line: what changed, not how>
**Agent:** <your tool and model, e.g. "Codex CLI (gpt-x)" or "Claude Code (claude-x)"> · **Human:** <who asked>
**Why:** one or two sentences on the problem, not the diff
**Changed:** the files, grouped
**Verified:** which suites ran and their result
**Risks / follow-ups:** anything left

  Then:  git add $DEVLOG

  Two ways out, when an entry genuinely does not apply:
    git commit --no-verify                  (skips every hook)
    git commit -m "... [skip devlog]"       (skips only this check)

EOF
exit 1
