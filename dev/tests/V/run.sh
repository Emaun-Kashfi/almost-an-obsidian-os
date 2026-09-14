#!/usr/bin/env bash
# Suite V — independent verification of the built vault (specs/VERIFY.md).
#   bash dev/tests/V/run.sh
set -uo pipefail
cd "$(dirname "$0")/../.."          # → dev/

VAULT=$(node -e 'process.stdout.write(require("./tests/build.js").VAULT())')

LOG=$(mktemp); OK=0; BAD=0; FAILED=""

step () {  # step <label> <command...>
  local label="$1"; shift
  echo "── $label ────────────────────────────────────────────"
  "$@" >"$LOG" 2>&1; local rc=$?
  cat "$LOG"
  local ok bad
  ok=$(grep -c '^ok  - ' "$LOG"); bad=$(grep -c '^FAIL' "$LOG")
  OK=$((OK+ok)); BAD=$((BAD+bad))
  if [ "$rc" -ne 0 ] && [ "$bad" -eq 0 ]; then echo "FAIL: $label exited $rc"; BAD=$((BAD+1)); fi
  if [ "$rc" -ne 0 ] || [ "$bad" -ne 0 ]; then FAILED="$FAILED $label"; fi
  echo
}

# The build is run in --check mode: it writes the vault NOWHERE, and fails if the
# vault committed at the repo root is not exactly what dev/ produces. That single
# check is what keeps `Storm Dashboard Vault/` honest — hand-edit a generated file
# and this is what goes red. Run `npm run build` to fix it.
echo "== rebuilding the vault from the sources (no writes) =="
if python3 integrate.py --check >"$LOG" 2>&1; then
  echo "ok  - the vault in the repo is byte-identical to what dev/ builds"; OK=$((OK+1))
else
  echo "FAIL: the vault in the repo is NOT what dev/ builds — run \`npm run build\`"
  grep -E '^\s{2}(DIFFERS|changed|new|OUT OF SYNC)' "$LOG" | head -20
  BAD=$((BAD+1)); FAILED="$FAILED build-check"
fi
H1=$(find build -name vault -maxdepth 2 -type d -exec find {} -type f \; | sort | xargs sha256sum | sha256sum)
python3 integrate.py --check >/dev/null 2>&1
H2=$(find build -name vault -maxdepth 2 -type d -exec find {} -type f \; | sort | xargs sha256sum | sha256sum)
if [ "$H1" = "$H2" ]; then echo "ok  - the build is idempotent"; OK=$((OK+1));
else echo "FAIL: the build is not idempotent"; BAD=$((BAD+1)); FAILED="$FAILED idempotence"; fi
echo

step "privacy · leak scan over the whole repo" python3 scripts/leakscan.py
step "static checks (§3)"         python3 tests/V/static_checks.py
step "css audit (§1d)"            python3 tests/V/css_audit.py
step "shared rules are identical" python3 tests/V/shared_rules.py
step "css validity"               bash -c 'npx --no-install csstree-validator "$0/.obsidian/snippets/storm.css" && echo "ok  - storm.css passes csstree-validator"' "$VAULT"
step "cross-agent consistency (§1a-c)" node tests/V/consistency.js
step "seed render + interactions (§2a-b)" node tests/V/e2e_interact.js
step "standalone notes (§2c-e)"   node tests/V/e2e_notes.js
step "template e2e (§2f)"         node tests/V/e2e_template.js
step "block-id line surgery"      node tests/V/line_surgery.js
step "every shipped block runs"    node tests/V/smoke_blocks.js
step "dv.view() contract (A)"      node tests/V/dv_view.js

rm -f "$LOG"
echo "════════════════════════════════════════════════════════"
if [ "$BAD" -eq 0 ]; then
  echo "PASS — $OK assertions, 0 failures (suite V: verification)"
  exit 0
else
  echo "FAIL — $OK passed, $BAD failed in:$FAILED"
  exit 1
fi
