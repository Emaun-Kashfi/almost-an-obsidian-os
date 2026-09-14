#!/usr/bin/env bash
# Suite A — assemble the Dashboard for every variant, then run every dashboard test.
#   bash dev/tests/A/run.sh
set -uo pipefail
cd "$(dirname "$0")/../.."          # → dev/

LOG=$(mktemp); TOTAL_OK=0; TOTAL_FAIL=0; FAILED_FILES=""

echo "── assembling ──────────────────────────────────────────"
python3 assemble_dashboard.py || { echo "FAIL: assembler crashed"; exit 1; }

# idempotency: a second run must produce byte-identical files
H1=$(find build -maxdepth 2 -name Dashboard.md | sort | xargs sha256sum)
python3 assemble_dashboard.py >/dev/null || { echo "FAIL: assembler crashed on re-run"; exit 1; }
H2=$(find build -maxdepth 2 -name Dashboard.md | sort | xargs sha256sum)
if [ -n "$H1" ] && [ "$H1" = "$H2" ]; then echo "ok  - assembly is idempotent"; TOTAL_OK=$((TOTAL_OK+1));
else echo "FAIL: assembly is not idempotent (or produced nothing)"; TOTAL_FAIL=$((TOTAL_FAIL+1)); fi

echo
for f in parseadd render interact variants; do
  echo "── tests/A/$f.js ───────────────────────────────────────"
  node "tests/A/$f.js" >"$LOG" 2>&1; rc=$?
  cat "$LOG"
  ok=$(grep -c '^ok  - ' "$LOG"); bad=$(grep -c '^FAIL' "$LOG")
  TOTAL_OK=$((TOTAL_OK+ok)); TOTAL_FAIL=$((TOTAL_FAIL+bad))
  if [ "$rc" -ne 0 ] || [ "$bad" -ne 0 ]; then
    FAILED_FILES="$FAILED_FILES $f"
    [ "$bad" -eq 0 ] && { echo "FAIL: $f.js exited $rc"; TOTAL_FAIL=$((TOTAL_FAIL+1)); }
  fi
  echo
done
rm -f "$LOG"

echo "════════════════════════════════════════════════════════"
if [ "$TOTAL_FAIL" -eq 0 ]; then
  echo "PASS — $TOTAL_OK assertions, 0 failures (suite A: dashboard)"
  exit 0
else
  echo "FAIL — $TOTAL_OK passed, $TOTAL_FAIL failed in:$FAILED_FILES"
  exit 1
fi
