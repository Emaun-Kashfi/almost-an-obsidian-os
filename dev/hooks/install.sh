#!/bin/sh
# Point git at this directory, so the DEVLOG hooks actually run.
#
#   sh dev/hooks/install.sh          (or: npm --prefix dev run hooks:install)
#
# One git config setting, per clone. Nothing is copied into .git/hooks, so the
# hooks stay under version control and an update to them reaches everyone.
set -e
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath dev/hooks
chmod +x dev/hooks/pre-commit dev/hooks/commit-msg dev/hooks/devlog-guard.sh 2>/dev/null || true
echo "core.hooksPath = $(git config core.hooksPath)"
echo "hooks installed: $(ls dev/hooks | tr '\n' ' ')"
echo
echo "A commit that touches dev/ or \"Storm Dashboard Vault/\" now needs a new"
echo "entry at the top of dev/DEVLOG.md. Escape hatches: git commit --no-verify,"
echo "or put [skip devlog] in the commit message."
