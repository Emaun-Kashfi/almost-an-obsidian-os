#!/usr/bin/env bash
# Suite H — health by deadlines, not by elapsed calendar time (specs/HEALTH.md).
#   bash dev/tests/H/run.sh
# Asserts against the built vault, so the build is re-run first.
set -uo pipefail
cd "$(dirname "$0")/../.."          # → dev/

LOG=$(mktemp); OK=0; BAD=0
pass(){ echo "ok  - $1"; OK=$((OK+1)); }
fail(){ echo "FAIL: $1"; BAD=$((BAD+1)); }

VAULT=$(node -e 'process.stdout.write(require("./tests/build.js").VAULT())')

echo "== rebuilding the vault from the sources =="
python3 assemble_dashboard.py >"$LOG" 2>&1 || { echo "FAIL: assemble_dashboard.py crashed"; tail -20 "$LOG"; exit 1; }
python3 integrate.py --no-install >"$LOG" 2>&1 || { echo "FAIL: integrate.py crashed"; tail -20 "$LOG"; exit 1; }
grep -q '^OK integrate$' "$LOG" && pass "integrate.py finished with OK integrate" || fail "integrate.py did not print 'OK integrate'"

echo
echo "── 1. the rule is one rule, in every copy ──────────────"
STANDALONE=("common/_scripts/goal-panel.js" "common/_scripts/task-gantt.js" \
            "common/Goals/🎯 Goals.md" "common/Tasks/📋 Tasks.md")
SIG='function healthOf(status, progress, sIso, eIso, opts){'
for f in "${STANDALONE[@]}"; do
  grep -qF "$SIG" "$f" && pass "carries healthOf(status, progress, sIso, eIso, opts): $f" \
                       || fail "$f — healthOf does not take the opts argument"
done
grep -qF 'function healthOf(status, progress, startIso, endIso, opts){' dashboard/livedata.js \
  && pass "dashboard/livedata.js keeps its own older ISO shape, with opts" \
  || fail "dashboard/livedata.js healthOf does not take the opts argument"

if [ "$(for f in "${STANDALONE[@]}"; do awk '/^function healthOf/,/^}/' "$f" | md5sum | cut -d' ' -f1; done | sort -u | wc -l)" = "1" ]; then
  pass "healthOf() is byte-identical across all four standalone copies"
else fail "healthOf() forked between the standalone copies"; fi

# the deadline thresholds and the undated fallback, in the copy they all share
H=$(awk '/^function healthOf/,/^}/' "common/_scripts/goal-panel.js")
for line in 'if(eIso < todayIso && left > 0) return "behind";' \
            'if(over === 0) return "ok";' 'if(over === 1) return "risk";' \
            'const span = dayDiff(sIso, eIso);' 'if(gap >= -0.10) return "ok";'; do
  printf '%s' "$H" | grep -qF "$line" && pass "healthOf carries: $line" || fail "healthOf is missing: $line"
done

# every call site passes the new argument — a bare four-argument call is a bug.
# Parens are matched properly (one call spans two lines), so this cannot be fooled.
LEFTOVER=$(python3 - "dashboard/livedata.js" "${STANDALONE[@]}" <<'PY'
import io, re, sys
bad = []
for p in sys.argv[1:]:
    t = io.open(p, encoding="utf-8").read()
    for m in re.finditer(r"(?<![\w$.])healthOf\(", t):
        i, depth, args, cur, instr = m.end(), 1, [], "", ""
        while i < len(t) and depth:
            c = t[i]
            if instr:
                if c == "\\": cur += t[i:i+2]; i += 2; continue
                if c == instr: instr = ""
            elif c in "\"'`": instr = c
            elif c in "([{": depth += 1
            elif c in ")]}":
                depth -= 1
                if not depth: break
            elif c == "," and depth == 1: args.append(cur); cur = ""; i += 1; continue
            cur += c; i += 1
        args.append(cur)
        if len(args) == 1 and not args[0].strip():
            continue                      # a prose mention in a comment: "healthOf() are copied"
        if len(args) != 5:
            bad.append("%s:%d %d args" % (p, t[:m.start()].count("\n") + 1, len(args)))
print(" | ".join(bad))
PY
)
if [ -z "$LEFTOVER" ]; then pass "every healthOf() call site passes five arguments (opts included)"
else fail "a call site still calls healthOf without opts — $LEFTOVER"; fi

# the built vault carries the same files
cmp -s "$VAULT/_scripts/goal-panel.js" "common/_scripts/goal-panel.js" \
  && cmp -s "$VAULT/_scripts/task-gantt.js" "common/_scripts/task-gantt.js" \
  && pass "the built vault ships the panel + Timeline byte-identical to dev/common" \
  || fail "the built vault drifted from dev/common"
grep -qF "$SIG" "$VAULT/Goals/🎯 Goals.md" && grep -qF "$SIG" "$VAULT/Tasks/📋 Tasks.md" \
  && pass "the built index + board carry the new signature" || fail "the built index/board did not pick up the change"

echo
echo "── 2. tests/H/run.js (the worked cases, in the harness) ─"
node tests/H/run.js >"$LOG" 2>&1; rc=$?
cat "$LOG"
ok=$(grep -c '^ok  - ' "$LOG"); bad=$(grep -c '^FAIL' "$LOG")
OK=$((OK+ok)); BAD=$((BAD+bad))
if [ "$rc" -ne 0 ] && [ "$bad" -eq 0 ]; then echo "FAIL: run.js exited $rc"; BAD=$((BAD+1)); fi
grep -q '^PAGE ERRORS' "$LOG" && { echo "FAIL: uncaught page errors"; BAD=$((BAD+1)); } || true
rm -f "$LOG"

echo
echo "════════════════════════════════════════════════════════"
if [ "$BAD" -eq 0 ]; then
  echo "PASS — $OK assertions, 0 failures (suite H: health by deadlines)"
  exit 0
else
  echo "FAIL — $OK passed, $BAD failed (suite H: health by deadlines)"
  exit 1
fi
