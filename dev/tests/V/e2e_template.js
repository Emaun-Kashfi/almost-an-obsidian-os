/* Agent V — check 2f: the TEMPLATE deployable tree against its own seed.
   Counts are computed by hand from dev/template/Tasks/*.md (today = 2026-09-12):
     active tasks = Books 10–24 (9/24, undated subs), Build the project gallery
     (1/5, 📅 09-10 overdue · 📅 09-12 today · 📅 09-25), Convert one JS project to TS
     (0/2, 📅 09-09 overdue)  → next moves 3 · due today 1 · overdue 2
     goals: Read 24 books = behind, portfolio + TypeScript = on track,
     Home organization = PAUSED (hidden from the ⚡ Now card, the Goals card and the
     risk tile; visible only in 🎯 Goals' collapsed Paused group) → goals at risk 1 */
const { withPage, extractBlocks, readFile, assert } = require("../lib.js");
const V = require("./vault.js");

const B = require("../build.js");
const src = extractBlocks(readFile(B.VAULT() + "/Dashboard.md"))[0];
const files = V.build("template");

withPage(async (page, errors) => {
  const r = await page.evaluate(async ({ src, files }) => {
    const H = window.StormHarness;
    const app = H.mkVault(files, { createDaily: () => {} });
    const dv = H.mkDv(app, "Dashboard.md");
    const c = await H.runBlock(src, dv, app);
    const q = s => c.querySelectorAll(s).length;
    const tile = f => { const t = c.querySelector('.act[data-filter="' + f + '"]'); return t ? { n: t.querySelector(".n").textContent.trim(), hot: t.classList.contains("hot") } : null; };
    const rowInfo = el => ({
      text: (el.querySelector(".nm-text") || {}).textContent,
      kind: el.getAttribute("data-kind"), due: el.getAttribute("data-due"),
      cls: el.className, task: (el.querySelector(".nm-task") || {}).textContent,
      date: (el.querySelector(".nm-date") || {}).textContent,
    });
    const visible = sel => [...c.querySelectorAll(sel)].filter(e => e.getClientRects().length > 0).length;

    const out = {
      err: (c.textContent.match(/Storm hub error[^\n]*/) || [null])[0],
      cards: q(".card"),
      banner: (c.querySelector(".banner-img") || {}).getAttribute ? c.querySelector(".banner-img").getAttribute("src") : "",
      greet: (c.querySelector(".greet .g") || {}).textContent.trim(),
      strip: { nm: tile("nm"), today: tile("today"), over: tile("over"), risk: tile("risk") },
      groups: [...c.querySelectorAll(".nm-group")].map(g => ({
        head: (g.querySelector(".nm-ghead") || {}).textContent.trim(),
        hb: (g.querySelector(".nm-ghead .hb") || {}).className.replace("hb ", ""),
        rows: [...g.querySelectorAll(":scope > .nm-row")].map(rowInfo),
        subs: [...g.querySelectorAll(".nm-subs .nm-row")].map(rowInfo),
      })),
      overdueSec: !![...c.querySelectorAll(".nowcard .nm-sec")].find(x => /^Overdue/.test(x.textContent.trim())),
      inboxCount: ([...c.querySelectorAll(".nowcard .nm-sec")].find(x => /^Inbox/.test(x.textContent.trim())) || { textContent: "" }).textContent.replace(/\D+/g, ""),
      gcRows: [...c.querySelectorAll(".gc-row")].map(g => ({
        name: (g.querySelector(".gc-name") || {}).textContent,
        hb: (g.querySelector(".hb") || {}).textContent,
      })),
      refCards: q(".refsec .card"),
      text: c.textContent,
      filters: {},
    };
    // clicking a tile must reveal exactly as many rows as the tile counts
    for (const f of ["nm", "today", "over", "risk"]) {
      c.querySelector('.act[data-filter="' + f + '"]').click();
      out.filters[f] = visible(".nowcard .nm-row");
      c.querySelector('.act[data-filter="' + f + '"]').click();
    }
    out.unfiltered = visible(".nowcard .nm-row");
    return out;
  }, { src, files });

  console.log("── 2f: template tree ──");
  assert(!r.err, "no error div" + (r.err ? " (" + r.err + ")" : ""));
  assert(r.cards === 12, "12 cards render, got " + r.cards);
  assert(/storm-banner\.png$/.test(r.banner || ""), "banner falls back to Images/System Images/storm-banner.png — " + r.banner);
  assert(/,\s*there\s*⚔️/.test(r.greet), 'greeting uses "there" (name from the note\'s own frontmatter) — ' + r.greet);

  assert(r.strip.nm.n === "3", "strip · Next moves = 3 (Books, gallery, TS convert), got " + r.strip.nm.n);
  assert(r.strip.today.n === "1", "strip · Due today = 1 (Add a contact form 📅 2026-09-12), got " + r.strip.today.n);
  assert(r.strip.over.n === "2", "strip · Overdue = 2 (📅 09-10 and 📅 09-09), got " + r.strip.over.n);
  /* HEALTH contract — the two overdue sub-tasks the tile above counts belong to two
     different goals, so both of those goals are now At risk, and 📚 Read 24 books
     (24 undated sub-tasks, so still on the pacing fallback) stays Behind: 3 in all.
     💻 Ship the portfolio site — "Build the project gallery" 📅 2026-09-10, 2 days late.
     🧠 Learn TypeScript   — "Convert one JS project to TS" 📅 2026-09-09, 3 days late.
     Under the old rule both read On track, because 2/9 and 0/3 done still beat
     11/90 and 4/114 days elapsed — young windows hid genuinely late work. */
  assert(r.strip.risk.n === "3", "strip · Goals at risk = 3 (Books behind + 2 goals with an overdue sub-task), got " + r.strip.risk.n);
  assert(r.strip.over.hot && r.strip.risk.hot, "Overdue and Goals-at-risk tiles are both hot");

  assert(r.groups.length === 3, "3 goal groups (one per goal with an active task), got " + r.groups.length);
  assert(r.groups[0].hb === "behind", "the behind goal sorts first — " + r.groups.map(g => g.hb).join(", "));
  const ORDER = { behind: 0, risk: 1, ok: 2, unscheduled: 3, done: 4 };
  const hs = r.groups.map(g => ORDER[g.hb]);
  assert(hs.every((v, i) => i === 0 || hs[i - 1] <= v), "goal groups ordered worst-health first");
  const nexts = r.groups.flatMap(g => g.rows.map(x => x.text));
  assert(nexts.length === 3 && nexts.includes("Book 10") && nexts.includes("Build the project gallery") && nexts.includes("Convert one JS project to TS"),
    "the three next moves are the expected ones — " + JSON.stringify(nexts));
  const overRows = r.groups.flatMap(g => g.rows).filter(x => /is-over/.test(x.cls));
  const todayRows = r.groups.flatMap(g => g.rows.concat(g.subs)).filter(x => /is-today/.test(x.cls));
  assert(overRows.length === 2, "exactly 2 next-move rows carry is-over, got " + overRows.length);
  assert(todayRows.length === 1 && todayRows[0].text === "Add a contact form",
    "exactly 1 row carries is-today and it is the contact-form sub-task — " + JSON.stringify(todayRows.map(x => x.text)));
  assert(!r.overdueSec, "no separate Overdue section — both overdue sub-tasks are already shown as next moves (SPEC §3.3.5)");
  assert(r.inboxCount === "3", "Inbox holds the 3 in-window one-offs, got " + r.inboxCount);

  /* PAUSE §3 — 🏠 Home organization is `status: paused` in the template seed, so the
     Dashboard's Goals card no longer lists it (it lives on 🎯 Goals instead). */
  assert(r.gcRows.length === 3, "Goals card lists the 3 live goals (paused 🏠 Home organization is not one), got " + r.gcRows.length);
  assert(r.gcRows.filter(g => g.hb === "At risk").length === 2 && r.gcRows.some(g => g.hb === "Behind") && !r.gcRows.some(g => /Home organization/.test(g.name)),
    "goal health badges read 2×At risk (1 overdue each) / 1×Behind and no paused goal — " + r.gcRows.map(g => g.name + "=" + g.hb).join(", "));
  assert(r.refCards === 5, "Reference section holds 5 cards, got " + r.refCards);

  console.log("── 2f: the action-strip filters show what they count ──");
  assert(r.filters.nm === 3, 'filtering by "Next moves" leaves 3 visible rows, got ' + r.filters.nm);
  assert(r.filters.over === 2, 'filtering by "Overdue" leaves 2 visible rows, got ' + r.filters.over);
  assert(r.filters.today === 1, 'filtering by "Due today" leaves 1 visible row, got ' + r.filters.today +
    " — a matching row must not stay hidden inside a collapsed .nm-subs list");
  assert(r.filters.risk >= 1, 'filtering by "Goals at risk" leaves the at-risk rows visible, got ' + r.filters.risk);
  assert(r.unfiltered > r.filters.nm, "clearing the filter brings every row back, got " + r.unfiltered);

  console.log("── 2f: sanitised template vault ──");
  /* SPEC §11 — nothing on the forbidden list may reach the screen. The patterns
     come from dev/privacy/terms.json, the one place they are written down, so
     this guard and dev/scripts/leakscan.py can never disagree. */
  const terms = JSON.parse(readFile(B.P.TERMS));
  const pats = Object.keys(terms)
    .filter(k => !k.startsWith("_") && k !== "notes" && Array.isArray(terms[k]))
    .flatMap(k => terms[k]);
  const bad = r.text.match(new RegExp(pats.join("|"), "i"));
  assert(!bad, "none of the " + pats.length + " forbidden terms appears in anything the Dashboard renders" +
    (bad ? " — found " + JSON.stringify(bad[0]) : ""));

  if (errors.length) assert(false, "page errors: " + errors.join(" | "));
  else assert(true, "no uncaught page errors");
}).catch(e => { console.log("FAIL: " + e.stack); process.exitCode = 1; });
