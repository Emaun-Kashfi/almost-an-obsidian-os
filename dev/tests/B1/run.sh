#!/usr/bin/env bash
# B1 — goal panel + goals index + tasks board.  Usage: bash tests/B1/run.sh
set -uo pipefail
cd "$(dirname "$0")/../.."


fail=0
for f in tests/B1/goal_panel.js tests/B1/indexes.js; do
  echo "── $f ──────────────────────────────────────────────"
  node "$f" || fail=1
done

echo "────────────────────────────────────────────────────"
if [ "$fail" -eq 0 ]; then echo "PASS — B1 (goal panel, 🎯 Goals index, 📋 Tasks board)"; else echo "FAIL — B1"; fi
exit $fail
