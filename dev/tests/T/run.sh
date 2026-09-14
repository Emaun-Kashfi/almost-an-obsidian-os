#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# specs/THEME2.md §B — suite T: the theme must apply to the WHOLE vault.
#
#   bash dev/tests/T/run.sh
#
# Renders a goal note, a task note and the board in real chromium against the
# vault's REAL shipped .obsidian/snippets/storm.css with a match-mode
# storm-theme.css applied, and asserts the computed accent on those surfaces is
# the THEMED accent — not "the file was written". Then it checks the write path
# itself: one file, under .obsidian/snippets, skipped when unchanged, the
# snippet enabled through Obsidian's own API, a Notice when that API is absent,
# and the user's appearance.json never touched.
#
# Asserts against the built vault, so integrate.py is re-run first.
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail
cd "$(dirname "$0")/../.."          # → dev/

VAULT=$(node -e 'process.stdout.write(require("./tests/build.js").VAULT())')

OK=0; BAD=0
pass(){ echo "ok  - $1"; OK=$((OK+1)); }
fail(){ echo "FAIL: $1"; BAD=$((BAD+1)); }

echo "== rebuilding the vault from the sources =="
python3 integrate.py --no-install >/dev/null 2>&1 || { echo "FAIL: integrate.py crashed"; exit 1; }
pass "integrate.py rebuilt the vault"

echo
echo "── 1. every stylesheet the theme flows through parses ──"
for f in "base/.obsidian/snippets/storm.css" \
         "common/storm-additions.css" \
         "$VAULT/.obsidian/snippets/storm.css" \
         "$VAULT/.obsidian/snippets/storm-theme.css"; do
  out=$(npx --no-install csstree-validator "$f" 2>&1)
  rc=$?
  if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -qi 'could not determine\|not found'; then
    fail "csstree-validator is not installed — run \`npm install\` in dev/ (it is a devDependency)"
  elif [ -z "$out" ]; then pass "csstree-validator clean: ${f#"$VAULT/"}"
  else fail "csstree-validator errors in $f"; echo "$out" | head -10; fi
done

echo
echo "── 2. the theme reaches the whole vault ───────────────"
LOG=$(mktemp)
node tests/T/theme.js >"$LOG" 2>&1; rc=$?
grep -v '^\[page\.error\]' "$LOG"
n_ok=$(grep -c '^ok  - ' "$LOG"); n_bad=$(grep -c '^FAIL' "$LOG")
OK=$((OK+n_ok)); BAD=$((BAD+n_bad))
if [ "$rc" -ne 0 ] && [ "$n_bad" -eq 0 ]; then fail "tests/T/theme.js exited $rc with no FAIL line"; fi
rm -f "$LOG"

echo
echo "════════════════════════════════════════════════════════"
if [ "$BAD" -eq 0 ]; then
  echo "PASS — $OK assertions, 0 failures (suite T: vault-wide theme)"
  exit 0
else
  echo "FAIL — $OK passed, $BAD failed (suite T: vault-wide theme)"
  exit 1
fi
