#!/usr/bin/env bash
# Suite G2 — the task-level sub-task Timeline inside the Storm build (specs/GANTT.md §1).
#   bash dev/tests/G2/run.sh
# Asserts against the built vault, so integrate.py is re-run first.
set -uo pipefail
cd "$(dirname "$0")/../.."          # → dev/

LOG=$(mktemp); OK=0; BAD=0

echo "== rebuilding the vault from the sources =="
python3 integrate.py --no-install >"$LOG" 2>&1 || { echo "FAIL: integrate.py crashed"; tail -20 "$LOG"; exit 1; }
if grep -q '^OK integrate$' "$LOG"; then echo "ok  - integrate.py finished with OK integrate"; OK=$((OK+1));
else echo "FAIL: integrate.py did not print 'OK integrate'"; BAD=$((BAD+1)); fi

# no build marker may survive into a deployable note
if grep -rl 'TASK_GANTT' build --include='*.md' >/dev/null 2>&1; then
  echo "FAIL: <!-- TASK_GANTT --> left in the built vault:"; grep -rl 'TASK_GANTT' build --include='*.md'
  BAD=$((BAD+1))
else
  echo "ok  - no <!-- TASK_GANTT --> marker anywhere in the built vault"; OK=$((OK+1))
fi
echo

echo "── tests/G2/run.js ─────────────────────────────────────"
node tests/G2/run.js >"$LOG" 2>&1; rc=$?
cat "$LOG"
ok=$(grep -c '^ok  - ' "$LOG"); bad=$(grep -c '^FAIL' "$LOG")
OK=$((OK+ok)); BAD=$((BAD+bad))
if [ "$rc" -ne 0 ] && [ "$bad" -eq 0 ]; then echo "FAIL: run.js exited $rc"; BAD=$((BAD+1)); fi
rm -f "$LOG"

# the migration tools must write EXACTLY the block the build writes, or a note
# migrated by hand ends up subtly different from a note the build produced.
echo
echo "── the tools in dev/tools/ emit the shipped block ──────"
TMP=$(mktemp -d)
VAULT=$(node -e 'process.stdout.write(require("./tests/build.js").VAULT())')
blk() { python3 -c "import io,re,sys; s=io.open(sys.argv[1],encoding='utf-8').read(); print(re.search(r'\`\`\`dataviewjs\n[\s\S]*?\n\`\`\`', s).group(0))" "$1"; }
printf -- '---\ntype: task\ngoal: "[[G]]"\nstatus: active\ntags:\n  - task\n---\n\n# t\n\n## Sub-tasks\n- [ ] one\n' > "$TMP/t.md"
python3 tools/inject_task_gantt.py "$TMP/t.md" >/dev/null 2>&1
if [ "$(blk "$TMP/t.md")" = "$(blk "$VAULT/Tasks/Books 10–24.md")" ]; then
  echo "ok  - inject_task_gantt.py writes the shipped task-gantt block, byte for byte"; OK=$((OK+1))
else echo "FAIL: inject_task_gantt.py drifted from the block integrate.py writes"; BAD=$((BAD+1)); fi
python3 tools/refresh_blocks.py --view _scripts/goal-panel "$TMP/t.md" >/dev/null 2>&1
if [ "$(blk "$TMP/t.md")" = "$(blk "$VAULT/Goals/🧠 Learn TypeScript.md")" ]; then
  echo "ok  - refresh_blocks.py --view writes the shipped goal-panel block, byte for byte"; OK=$((OK+1))
else echo "FAIL: refresh_blocks.py drifted from the block integrate.py writes"; BAD=$((BAD+1)); fi
rm -rf "$TMP"

echo
echo "════════════════════════════════════════════════════════"
if [ "$BAD" -eq 0 ]; then
  echo "PASS — $OK assertions, 0 failures (suite G2: task Timeline integration)"
  exit 0
else
  echo "FAIL — $OK passed, $BAD failed (suite G2: task Timeline integration)"
  exit 1
fi
