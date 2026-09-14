#!/usr/bin/env bash
# Suite E — 🧹 Triage. Usage: bash dev/tests/E/run.sh
set -u
cd "$(dirname "$0")"


fail=0
total=0
passed=0
for f in test_triage.js test_bulk.js test_edges.js; do
  echo "── $f ──────────────────────────────────────────"
  out="$(node "$f" 2>&1)"; rc=$?
  echo "$out"
  n_ok=$(printf '%s\n' "$out" | grep -c '^ok  - ' || true)
  n_bad=$(printf '%s\n' "$out" | grep -c '^FAIL: ' || true)
  total=$((total + n_ok + n_bad)); passed=$((passed + n_ok))
  if [ "$rc" -ne 0 ] || [ "$n_bad" -ne 0 ]; then fail=1; fi
done

echo "────────────────────────────────────────────────"
if [ "$fail" -eq 0 ]; then
  echo "PASS — Agent E (🧹 Triage): $passed/$total assertions across 3 files."
else
  echo "FAIL — Agent E (🧹 Triage): $passed/$total assertions passed."
fi
exit "$fail"
