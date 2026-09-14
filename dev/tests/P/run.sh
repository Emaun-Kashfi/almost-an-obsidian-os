#!/usr/bin/env bash
# Suite P — the paused goal/task state (specs/PAUSE.md §6, items 1–10)
#           + the ＋ Task control on goals (specs/ADDTASK.md, items 1–10).
#   bash dev/tests/P/run.sh
# Asserts against the built vault, so integrate.py is re-run first.
set -uo pipefail
cd "$(dirname "$0")/../.."          # → dev/

LOG=$(mktemp); OK=0; BAD=0

echo "== rebuilding the vault from the sources =="
python3 integrate.py --no-install >"$LOG" 2>&1 || { echo "FAIL: integrate.py crashed"; tail -20 "$LOG"; exit 1; }
if grep -q '^OK integrate$' "$LOG"; then echo "ok  - integrate.py finished with OK integrate"; OK=$((OK+1));
else echo "FAIL: integrate.py did not print 'OK integrate'"; BAD=$((BAD+1)); fi

# the paused branch is copied verbatim into every healthOf — a fork here would
# silently re-introduce the "Behind for ever" bug in one surface only.
echo
echo "── healthOf / HL / HORDER carry the paused state everywhere ──"
for f in "common/_scripts/goal-panel.js" "common/_scripts/task-gantt.js" \
         "common/Goals/🎯 Goals.md" "common/Tasks/📋 Tasks.md" "dashboard/livedata.js"; do
  if grep -qF 'if(String(status||"").toLowerCase()==="paused") return "paused";' "$f"; then
    echo "ok  - $f carries the paused branch, character for character"; OK=$((OK+1))
  else
    echo "FAIL: $f is missing the paused branch of healthOf"; BAD=$((BAD+1))
  fi
done
for f in "common/_scripts/goal-panel.js" "common/_scripts/task-gantt.js" \
         "common/Goals/🎯 Goals.md" "common/Tasks/📋 Tasks.md"; do
  if grep -qF 'unscheduled:"Unscheduled", paused:"Paused" };' "$f"; then
    echo "ok  - $f: HL gains paused:\"Paused\""; OK=$((OK+1))
  else echo "FAIL: $f: HL has no paused label"; BAD=$((BAD+1)); fi
done
if grep -qF 'unscheduled:3, done:4, paused:5 };' "common/Goals/🎯 Goals.md" \
  && grep -qF 'unscheduled:3, done:4, paused:5 };' dashboard/buildHub.js; then
  echo "ok  - HORDER/_HORDER sort paused last (5, after done:4)"; OK=$((OK+1))
else echo "FAIL: HORDER/_HORDER do not sort paused last"; BAD=$((BAD+1)); fi
# the four standalone copies must stay character-identical to each other
if [ "$(for f in "common/_scripts/goal-panel.js" "common/_scripts/task-gantt.js" \
                 "common/Goals/🎯 Goals.md" "common/Tasks/📋 Tasks.md"; do
          awk '/^function healthOf/,/^}/' "$f" | md5sum | cut -d' ' -f1; done | sort -u | wc -l)" = "1" ]; then
  echo "ok  - healthOf() is still byte-identical across all four standalone copies"; OK=$((OK+1))
else echo "FAIL: healthOf() forked between the standalone copies"; BAD=$((BAD+1)); fi

echo
echo "── tests/P/run.js ──────────────────────────────────────"
node tests/P/run.js >"$LOG" 2>&1; rc=$?
cat "$LOG"
ok=$(grep -c '^ok  - ' "$LOG"); bad=$(grep -c '^FAIL' "$LOG")
OK=$((OK+ok)); BAD=$((BAD+bad))
if [ "$rc" -ne 0 ] && [ "$bad" -eq 0 ]; then echo "FAIL: run.js exited $rc"; BAD=$((BAD+1)); fi
rm -f "$LOG"

echo
echo "── tests/P/addtask.js (ADDTASK — the ＋ Task control) ───"
LOG2=$(mktemp)
node tests/P/addtask.js >"$LOG2" 2>&1; rc=$?
cat "$LOG2"
ok=$(grep -c '^ok  - ' "$LOG2"); bad=$(grep -c '^FAIL' "$LOG2")
OK=$((OK+ok)); BAD=$((BAD+bad))
if [ "$rc" -ne 0 ] && [ "$bad" -eq 0 ]; then echo "FAIL: addtask.js exited $rc"; BAD=$((BAD+1)); fi
if grep -q '^PAGE ERRORS' "$LOG2"; then echo "FAIL: uncaught page errors in tests/P/addtask.js"; BAD=$((BAD+1)); fi
rm -f "$LOG2"

echo
echo "════════════════════════════════════════════════════════"
if [ "$BAD" -eq 0 ]; then
  echo "PASS — $OK assertions, 0 failures (suite P: paused goals and tasks + ＋ Task)"
  exit 0
else
  echo "FAIL — $OK passed, $BAD failed (suite P: paused goals and tasks + ＋ Task)"
  exit 1
fi
