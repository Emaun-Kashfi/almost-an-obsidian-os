// Agent A — parseAdd() unit cases (SPEC §3.4): every grammar form + every natural-date form.
const { withPage, extractBlocks, readFile, assert } = require("../lib.js");

const B = require("../build.js");
const src = extractBlocks(readFile(B.DASH()))[0];

withPage(async (page, errors) => {
  const r = await page.evaluate(async ({ src }) => {
    // extract `function parseAdd(...) { ... }` from the assembled block and eval it standalone
    // (brace matching that skips strings, comments and regex literals)
    const i = src.search(/function\s+parseAdd\s*\(/);
    if (i < 0) return { fatal: "parseAdd not found in the assembled source" };
    const PRE = "(,=:[!&|?{};+-*%~^<>";
    const skipStr = (s, k, q) => { for (k++; k < s.length; k++) { if (s[k] === "\\") k++; else if (s[k] === q) return k; } return s.length; };
    const skipRe = (s, k) => { let cls = false; for (k++; k < s.length; k++) { const c = s[k]; if (c === "\\") k++; else if (c === "[") cls = true; else if (c === "]") cls = false; else if (c === "/" && !cls) return k; } return s.length; };
    let depth = 0, prev = "", end = -1;
    for (let k = src.indexOf("{", i); k < src.length; k++) {
      const ch = src[k];
      if (ch === "/" && src[k + 1] === "/") { const nl = src.indexOf("\n", k); if (nl < 0) break; k = nl; continue; }
      if (ch === "/" && src[k + 1] === "*") { k = src.indexOf("*/", k) + 1; continue; }
      if (ch === '"' || ch === "'" || ch === "`") { k = skipStr(src, k, ch); prev = ch; continue; }
      if (ch === "/" && (prev === "" || PRE.indexOf(prev) >= 0)) { k = skipRe(src, k); prev = "/"; continue; }
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (!depth) { end = k + 1; break; } }
      if (!/\s/.test(ch)) prev = ch;
    }
    if (end < 0) return { fatal: "could not brace-match parseAdd" };
    const fnSrc = src.slice(i, end);
    const parseAdd = new Function(fnSrc + "; return parseAdd;")();
    const CTX = { todayIso: "2026-09-12" };
    const P = s => parseAdd(s, CTX);
    const pick = (s, keys) => { const o = P(s); const out = {}; keys.split(" ").forEach(k => out[k] = o[k]); return out; };
    const isoOfInbox = s => P(s).iso;
    return {
      fnLen: fnSrc.length,
      task_plain:  pick("task: Book the studio", "kind name goal start end iso"),
      task_goal:   pick("task: Book the studio @Launch the app", "kind name goal start end"),
      task_range:  pick("task: Book the studio @Launch 9/15-10/10", "kind name goal start end"),
      task_isoRange: pick("task: Ship v1 2026-09-15-2026-10-10", "kind name start end"),
      task_single: pick("task: Ship v1 9/20", "kind name iso start end"),
      task_caps:   pick("TASK:  Caps test ", "kind name"),
      task_goalThenRange: pick("task: Ship v1 9/15-10/10 @Launch", "kind name goal start end"),
      sub_plain:   pick("sub: Draft the intro -> Design pass", "kind text task iso"),
      sub_dated:   pick("sub: Draft the intro 9/18 -> Design pass", "kind text task iso"),
      sub_arrow:   pick("sub: Draft the intro → Design pass", "kind text task"),
      sub_noarrow: pick("sub: Draft the intro", "kind text task"),
      subtask_alias: pick("subtask: Thing -> Story", "kind task"),
      goal_full:   pick("goal: Learn guitar @Music 2026-12-31", "kind name area iso end"),
      goal_plain:  pick("goal: Learn guitar", "kind name area iso end"),
      habit:       pick("habit: 🧘 Meditate", "kind text"),
      note:        pick("note: Interview prep", "kind text"),
      job:         pick("job: Acme — Editor", "kind text"),
      inbox:       pick("Buy cables", "kind text iso"),
      inbox_dated: pick("Buy cables tomorrow", "kind text iso"),
      inbox_tags:  pick("Email #work the sponsor #urgent", "kind text tags"),
      inbox_onlyDate: pick("tomorrow", "kind text iso"),
      dates: {
        today:    isoOfInbox("x today"),
        tomorrow: isoOfInbox("x tomorrow"),
        tmrw:     isoOfInbox("x tmrw"),
        mon:      isoOfInbox("x mon"),
        monday:   isoOfInbox("x monday"),
        sat:      isoOfInbox("x sat"),
        saturday: isoOfInbox("x saturday"),
        sunday:   isoOfInbox("x sunday"),
        fri:      isoOfInbox("x fri"),
        plus3d:   isoOfInbox("x +3d"),
        plus0d:   isoOfInbox("x +0d"),
        md:       isoOfInbox("x 9/20"),
        mdy:      isoOfInbox("x 9/20/2027"),
        mdy2:     isoOfInbox("x 9/20/27"),
        iso:      isoOfInbox("x 2026-11-05"),
        none:     isoOfInbox("x nonsense"),
      },
    };
  }, { src });

  if (r.fatal) { assert(false, r.fatal); return; }
  assert(r.fnLen > 500, "parseAdd extracted from the assembled block (" + r.fnLen + " chars)");
  const eq = (got, want, msg) => assert(JSON.stringify(got) === JSON.stringify(want), msg + " → " + JSON.stringify(got));

  // --- grammar ---
  eq(r.task_plain, { kind: "task", name: "Book the studio", goal: "", start: "", end: "", iso: "" }, "task: <name>");
  eq(r.task_goal, { kind: "task", name: "Book the studio", goal: "Launch the app", start: "", end: "" }, "task: <name> @<goal> (multi-word goal)");
  eq(r.task_range, { kind: "task", name: "Book the studio", goal: "Launch", start: "2026-09-15", end: "2026-10-10" }, "task: <name> @<goal> <M/D-M/D>");
  eq(r.task_isoRange, { kind: "task", name: "Ship v1", start: "2026-09-15", end: "2026-10-10" }, "task: <name> <ISO-ISO>");
  eq(r.task_single, { kind: "task", name: "Ship v1", iso: "2026-09-20", start: "", end: "" }, "task: <name> <single date> → iso (creator uses it as the end)");
  eq(r.task_caps, { kind: "task", name: "Caps test" }, "prefix is case-insensitive + trimmed");
  eq(r.task_goalThenRange, { kind: "task", name: "Ship v1", goal: "Launch", start: "2026-09-15", end: "2026-10-10" }, "task: dates before @goal still parse");
  eq(r.sub_plain, { kind: "sub", text: "Draft the intro", task: "Design pass", iso: "" }, "sub: <text> -> <task>");
  eq(r.sub_dated, { kind: "sub", text: "Draft the intro", task: "Design pass", iso: "2026-09-18" }, "sub: <text> <date> -> <task>");
  eq(r.sub_arrow, { kind: "sub", text: "Draft the intro", task: "Design pass" }, "sub: accepts the → arrow");
  eq(r.sub_noarrow, { kind: "sub", text: "Draft the intro", task: "" }, "sub: without an arrow leaves task empty");
  eq(r.subtask_alias, { kind: "sub", task: "Story" }, "subtask: is an alias for sub:");
  eq(r.goal_full, { kind: "goal", name: "Learn guitar", area: "Music", iso: "2026-12-31", end: "2026-12-31" }, "goal: <name> @<area> <target>");
  eq(r.goal_plain, { kind: "goal", name: "Learn guitar", area: "", iso: "", end: "" }, "goal: <name>");
  eq(r.habit, { kind: "habit", text: "🧘 Meditate" }, "habit: <label>");
  eq(r.note, { kind: "note", text: "Interview prep" }, "note: <title>");
  eq(r.job, { kind: "job", text: "Acme — Editor" }, "job: Company — Role");
  eq(r.inbox, { kind: "inbox", text: "Buy cables", iso: "" }, "bare text → inbox");
  eq(r.inbox_dated, { kind: "inbox", text: "Buy cables", iso: "2026-09-13" }, "inbox item with a trailing date");
  eq(r.inbox_tags, { kind: "inbox", text: "Email #work the sponsor #urgent", tags: ["#work", "#urgent"] }, "#tags are kept in the text and reported");
  eq(r.inbox_onlyDate, { kind: "inbox", text: "tomorrow", iso: "" }, "a lone date token stays the text (nothing to date)");

  // --- natural dates (§3.4), today = Saturday 2026-09-12 ---
  const d = r.dates;
  assert(d.today === "2026-09-12", "date: today");
  assert(d.tomorrow === "2026-09-13", "date: tomorrow");
  assert(d.tmrw === "2026-09-13", "date: tmrw");
  assert(d.mon === "2026-09-14", "date: mon → next Monday");
  assert(d.monday === "2026-09-14", "date: monday (long form)");
  assert(d.sat === "2026-09-12" && d.saturday === "2026-09-12", "date: same weekday → today");
  assert(d.sunday === "2026-09-13", "date: sunday");
  assert(d.fri === "2026-09-18", "date: fri");
  assert(d.plus3d === "2026-09-15", "date: +3d");
  assert(d.plus0d === "2026-09-12", "date: +0d");
  assert(d.md === "2026-09-20", "date: M/D (current year)");
  assert(d.mdy === "2027-09-20", "date: M/D/YYYY");
  assert(d.mdy2 === "2027-09-20", "date: M/D/YY");
  assert(d.iso === "2026-11-05", "date: YYYY-MM-DD");
  assert(d.none === "", "a non-date trailing word is left alone");
  assert(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join("; ") : ""));
});
