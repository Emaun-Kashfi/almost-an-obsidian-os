#!/usr/bin/env bash
# Agent B2 test suite: Obsidian templates (SPEC §4) + the two daily dynamic tables (SPEC §6).
set -u
cd "$(dirname "$0")/../.."


fail=0
for f in tests/B2/templates.test.js tests/B2/daily_tables.test.js; do
  echo "=== $f ==="
  node "$f" || fail=1
done

echo
if [ "$fail" -eq 0 ]; then
  echo "PASS — suite B2 (templates + daily tables)"
else
  echo "FAIL — suite B2 (templates + daily tables)"
fi
exit "$fail"
