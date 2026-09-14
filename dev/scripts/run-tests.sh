#!/usr/bin/env bash
# Every suite, in order, with one summary line each and a roll-up at the end.
#   npm test          (from dev/)     ·     bash dev/scripts/run-tests.sh
#
# A suite that cannot run is a FAILURE here, never a skip: a green run that
# quietly tested nothing is the worst outcome this harness can produce.
set -uo pipefail
cd "$(dirname "$0")/.."             # → dev/

SUITES="A B1 B2 E G2 H P T V W"
[ "$#" -gt 0 ] && SUITES="$*"

LOGDIR=$(mktemp -d)
FAILED=""; PASSED=""
START=$(date +%s)

echo "════════════════════════════════════════════════════════════"
echo " Storm Dashboard — test run"
echo " node $(node -v) · python $(python3 -V 2>&1 | cut -d' ' -f2)"
echo "════════════════════════════════════════════════════════════"
echo

# ── build first. Suites A and B2 read dev/build/, so on a fresh clone (no
#    build/ yet) they would fail for the wrong reason, which is the first thing
#    a new contributor would see. Building here costs a couple of seconds and
#    also proves the build itself still works before any suite runs. ──────────
echo "── build ───────────────────────────────────────────────────"
if python3 assemble_dashboard.py > "$LOGDIR/build.log" 2>&1 && \
   python3 integrate.py >> "$LOGDIR/build.log" 2>&1; then
  tail -1 "$LOGDIR/build.log"
else
  cat "$LOGDIR/build.log"
  echo
  echo " FAIL — the build failed, so no suite can be trusted. Fix this first."
  exit 1
fi
echo

# ── the privacy gate runs first and on its own: this repo is public ──────────
echo "── privacy · leak scan ─────────────────────────────────────"
if python3 scripts/leakscan.py > "$LOGDIR/leak.log" 2>&1; then
  tail -2 "$LOGDIR/leak.log"
  PASSED="$PASSED leakscan"
else
  cat "$LOGDIR/leak.log"
  FAILED="$FAILED leakscan"
fi
echo

for s in $SUITES; do
  if [ ! -f "tests/$s/run.sh" ]; then
    echo "── suite $s ── FAIL: tests/$s/run.sh does not exist"
    FAILED="$FAILED $s"
    continue
  fi
  printf '── suite %-3s ' "$s"
  t0=$(date +%s)
  bash "tests/$s/run.sh" > "$LOGDIR/$s.log" 2>&1
  rc=$?
  t1=$(date +%s)
  line=$(grep -E '^(PASS|FAIL) —' "$LOGDIR/$s.log" | tail -1)
  if [ "$rc" -eq 0 ] && [ -n "$line" ] && [ "${line#PASS}" != "$line" ]; then
    echo "$((t1-t0))s  $line"
    PASSED="$PASSED $s"
  else
    echo "$((t1-t0))s  ${line:-FAIL — suite produced no PASS/FAIL line (exit $rc)}"
    FAILED="$FAILED $s"
    echo "   ── last 25 lines of tests/$s/run.sh ──"
    tail -25 "$LOGDIR/$s.log" | sed 's/^/   /'
  fi
done

END=$(date +%s)
echo
echo "════════════════════════════════════════════════════════════"
echo " full logs: $LOGDIR"
if [ -z "$FAILED" ]; then
  echo " PASS — everything green ($(echo $PASSED | wc -w | tr -d ' ') suites, $((END-START))s)"
  exit 0
else
  echo " FAIL —$FAILED  (passed:$PASSED, $((END-START))s)"
  exit 1
fi
