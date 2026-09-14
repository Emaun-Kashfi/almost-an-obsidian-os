// Agent A — render: action strip, next moves, grouping, overdue, inbox, every card.
const { withPage, extractBlocks, readFile, assert } = require("../lib.js");
const M = require("./mock.js");

const B = require("../build.js");
const src = extractBlocks(readFile(B.DASH()))[0];
const files = M.files();

withPage(async (page, errors) => {
  const r = await page.evaluate(async ({ src, files, links }) => {
    const H = window.StormHarness;
    const app = H.mkVault(files, { resolvedLinks: links, tags: { "#daily": 3, "#task": 5, "#goal": 2 } });
    const dv = H.mkDv(app, "Dashboard.md");
    const c = await H.runBlock(src, dv, app);
    const txt = s => [...c.querySelectorAll(s)].map(e => e.textContent.trim());
    const q = s => c.querySelectorAll(s).length;
    const tile = f => { const t = c.querySelector('.act[data-filter="' + f + '"]'); return t ? { n: t.querySelector(".n").textContent.trim(), l: t.querySelector(".l").textContent.trim(), hot: t.classList.contains("hot") } : null; };
    const rowInfo = el => ({
      text: (el.querySelector(".nm-text") || {}).textContent,
      kind: el.getAttribute("data-kind"), path: el.getAttribute("data-path"),
      line: el.getAttribute("data-line"), due: el.getAttribute("data-due"),
      cls: el.className, task: (el.querySelector(".nm-task") || {}).textContent,
      date: (el.querySelector(".nm-date") || {}).textContent,
    });
    const inSec = (label) => {
      // rows that follow the `.nm-sec` whose label starts with `label`, until the next .nm-sec
      const secs = [...c.querySelectorAll(".nowcard .nm-sec")];
      const s = secs.find(x => x.textContent.trim().indexOf(label) === 0);
      if (!s) return null;
      const out = []; let n = s.nextElementSibling;
      while (n && !n.classList.contains("nm-sec") && !n.classList.contains("shutdown") && !n.classList.contains("cardnote")) {
        if (n.classList.contains("nm-row")) out.push(rowInfo(n));
        n = n.nextElementSibling;
      }
      return { count: s.querySelector("span").textContent.trim(), rows: out };
    };
    return {
      err: (c.textContent.match(/Storm hub error[^<]*/) || [null])[0],
      hub: q(".storm-hub"), cards: q(".card"),
      cardSel: { now: q(".nowcard"), pomo: q(".pomo"), goal: q(".goalcard"), pulse: q(".pulse"),
                 job: q(".jobcard"), workout: q(".workout"), music: q(".musiccard"), graph: q(".graphcard"),
                 notes: q(".notescard"), cal: q(".cal"), books: q(".books"), heat: q(".heat") },
      strip: { count: q(".actstrip .act"), nm: tile("nm"), today: tile("today"), over: tile("over"),
               risk: tile("risk"), focus: tile("focus"), streak: tile("streak") },
      stats: q(".stats"),
      navPills: txt(".navpills .pill"),
      groups: [...c.querySelectorAll(".nm-group")].map(g => ({
        head: (g.querySelector(".nm-ghead") || {}).textContent.trim(),
        link: (g.querySelector(".nm-ghead") || {}).getAttribute ? g.querySelector(".nm-ghead").getAttribute("data-link") : "",
        hb: (g.querySelector(".nm-ghead .hb") || {}).className,
        rows: [...g.querySelectorAll(":scope > .nm-row")].map(rowInfo),
        subs: [...g.querySelectorAll(".nm-subs")].map(s => ({ hidden: s.style.display === "none", rows: [...s.querySelectorAll(".nm-row")].map(rowInfo) })),
      })),
      overdueSec: inSec("Overdue"), inboxSec: inSec("Inbox"),
      markdone: [...c.querySelectorAll(".nm-markdone")].map(b => b.getAttribute("data-done-path")),
      heroOne: (c.querySelector(".hero-one .v") || {}).textContent,
      shutdown: [...c.querySelectorAll(".sd-inp")].map(i => i.getAttribute("data-sd") + "=" + i.value),
      addRows: { legacy: q("input[data-add]"), uadd: q("input[data-uadd]"), notesearch: q("input[data-notesearch]"), addbtn: q("[data-uaddbtn]") },
      gcRows: [...c.querySelectorAll(".gc-row")].map(g => ({
        name: (g.querySelector(".gc-name") || {}).textContent, area: (g.querySelector(".gc-area") || {}).textContent,
        hb: (g.querySelector(".hb") || {}).className, meta: (g.querySelector(".gc-meta") || {}).textContent,
        bar: (g.querySelector(".gc-bar span") || {}).style.width })),
      pulse: txt(".pulse .pn").concat(["|"]).concat(txt(".pulse .cardnote")),
      focusOpts: [...c.querySelectorAll(".focussel optgroup")].map(o => o.label + ": " + [...o.querySelectorAll("option")].map(x => x.value).join(" / ")),
      refsec: { present: q(".refsec"), cards: q(".refsec .card"), toggle: q('[data-action="toggle-ref"]') },
      allRowText: txt(".nm-row .nm-text"),
      habitRows: q(".strk"),
      starttoday: q(".starttoday"),
      nowFilter: (c.querySelector(".nowcard") || {}).getAttribute ? c.querySelector(".nowcard").getAttribute("data-filter") : null,
      h3now: (c.querySelector(".nowcard h3") || {}).textContent,
    };
  }, { src, files, links: M.RESOLVED_LINKS });

  assert(!r.err, "no hub error (" + (r.err || "clean") + ")");
  assert(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join("; ") : ""));
  assert(r.hub === 1, "storm-hub rendered");

  // --- cards ---
  assert(r.cards === 12, "12 cards render (got " + r.cards + ")");
  const cs = r.cardSel;
  assert(cs.now === 1 && cs.pomo === 1 && cs.goal === 1 && cs.pulse === 1, "now / pomo / goal / pulse cards present");
  assert(cs.job === 1 && cs.workout === 1 && cs.music === 1 && cs.graph === 1 && cs.notes === 1, "job / workout / music / graph / notes cards present");
  assert(cs.cal === 1 && cs.books === 1 && cs.heat === 1, "calendar / reading / habit-heatmap present");
  assert(r.habitRows === 3, "3 habit streak rows (got " + r.habitRows + ")");

  // --- §3.1 action strip ---
  assert(r.stats === 0, "old vault-stats strip is gone");
  assert(r.strip.count === 6, "6 action tiles (got " + r.strip.count + ")");
  assert(r.strip.nm.n === "2" && r.strip.nm.l === "Next moves", "nm tile = 2 next moves (got " + r.strip.nm.n + ")");
  assert(r.strip.today.n === "1" && r.strip.today.l === "Due today", "today tile = 1 (got " + r.strip.today.n + ")");
  assert(r.strip.over.n === "2" && r.strip.over.l === "Overdue", "over tile = 2 (got " + r.strip.over.n + ")");
  /* HEALTH contract — both goals now carry overdue work, so both count here.
     🚀 Launch the app has 2 overdue sub-tasks (Send the brief 📅 09-08, Confirm
     guest 📅 09-10) → Behind; 🧠 Learn TypeScript has 1 (Buy the domain 📅 09-02, in
     the backlog task) → At risk. Under the old elapsed rule TypeScript read On track
     because 3/6 done beat 11/29 days elapsed — the ten-day-late item was invisible. */
  assert(r.strip.risk.n === "2" && r.strip.risk.l === "Goals at risk", "risk tile = 2 (got " + r.strip.risk.n + ")");
  assert(r.strip.over.hot && r.strip.risk.hot, "overdue + at-risk tiles are hot");
  assert(!r.strip.nm.hot && !r.strip.today.hot, "nm / today tiles are not hot");
  assert(r.strip.focus.n === "0/8" && r.strip.streak.n.indexOf("🔥") === 0, "focus + streak tiles render");

  // --- nav pills ---
  assert(r.navPills.some(p => p.indexOf("🎯 Goals") >= 0), "nav pill '🎯 Goals' present");
  assert(!r.navPills.some(p => /Projects/.test(p)), "nav pill 'Projects' removed");

  // --- §3.3 next moves, grouped by goal, worst health first ---
  assert(r.groups.length === 2, "2 goal groups (got " + r.groups.length + ")");
  assert(/Launch the app/.test(r.groups[0].head), "worst-health goal first: " + r.groups[0].head);
  assert(/behind/.test(r.groups[0].hb), "launch goal badge = behind (" + r.groups[0].hb + ")");
  assert(/Learn TypeScript/.test(r.groups[1].head), "second group = Learn TypeScript");
  /* exactly one overdue sub-task across its non-paused tasks (Buy the domain 📅 2026-09-02) */
  assert(/\brisk\b/.test(r.groups[1].hb), "TypeScript goal badge = at risk, 1 overdue (" + r.groups[1].hb + ")");
  assert(r.groups[0].link === M.GOAL_A, "goal head links to the goal note");

  const nexts = [].concat(...r.groups.map(g => g.rows)).filter(x => x.kind === "next");
  assert(nexts.length === 2, "2 next-move rows (got " + nexts.length + ")");
  assert(nexts[0].text === "Send the brief", "next move = earliest DATED unchecked sub-task (got '" + nexts[0].text + "')");
  assert(nexts[0].due === "2026-09-08" && /is-over/.test(nexts[0].cls), "that next move is flagged is-over");
  assert(nexts[0].date === "Sep 8", "next-move date label 'Sep 8' (got '" + nexts[0].date + "')");
  assert(nexts[0].task === "Design pass — Screen 1", "row shows its task name");
  assert(nexts[0].line === "15", "row carries the sub-task line number (got " + nexts[0].line + ")");
  assert(nexts[1].text === "Pick a framework" && nexts[1].due === "", "undated fallback next move for the all-undated task");

  // expandable sub rows = every unchecked sub-task of the task
  const g0subs = r.groups[0].subs[0];
  assert(g0subs && g0subs.hidden, "sub rows start collapsed");
  assert(g0subs.rows.length === 4 && g0subs.rows.every(x => x.kind === "sub"), "expanding shows all 4 unchecked sub-tasks (got " + (g0subs ? g0subs.rows.length : 0) + ")");
  assert(g0subs.rows.some(x => x.text === "Draft questions" && /is-today/.test(x.cls)), "due-today sub row carries is-today");
  assert(g0subs.rows.every(x => x.text !== "Outline the arc"), "checked sub-tasks are not listed");

  // all-sub-tasks-done nudge
  assert(r.markdone.length === 1 && r.markdone[0] === M.T_CONVERT, "one '✓ Mark task complete' nudge, on the all-done task");

  // --- §3.3.5 overdue section excludes next moves ---
  assert(r.overdueSec && r.overdueSec.count === "1", "Overdue section shows 1 (got " + (r.overdueSec && r.overdueSec.count) + ")");
  assert(r.overdueSec.rows.length === 1 && r.overdueSec.rows[0].text === "Confirm guest", "overdue row = the one NOT shown as a next move");
  assert(r.overdueSec.rows.every(x => x.text !== "Send the brief"), "the overdue next move is not repeated");
  assert(r.allRowText.every(t => !/Buy the domain|Point the DNS/.test(t)), "backlog task rows never reach the dashboard");
  assert(r.allRowText.every(t => !/Bench press|Overhead press/.test(t)), "Fitness/ checkboxes never reach the dashboard");
  assert(r.allRowText.every(t => !/Template placeholder/.test(t)), "_templates/ checkboxes never reach the dashboard");

  // --- §3.3.6 inbox ---
  assert(r.inboxSec && r.inboxSec.count === "3", "Inbox section shows 3 (got " + (r.inboxSec && r.inboxSec.count) + ")");
  const inbox = r.inboxSec.rows.map(x => x.text);
  assert(inbox.join("|") === "Call the dentist|Pay the invoice|Email the sponsor", "inbox = today's + yesterday's ⚡ items (" + inbox.join("|") + ")");
  assert(!inbox.some(t => /Ancient/.test(t)), "⚡ items older than 7 days are ignored");
  assert(!inbox.some(t => /Move/.test(t)), "#habit lines are excluded from the inbox");
  assert(!inbox.some(t => t === ""), "blank checkboxes are excluded from the inbox");
  assert(!inbox.some(t => /Already filed/.test(t)), "checked ⚡ items are excluded");
  assert(r.inboxSec.rows.every(x => x.kind === "inbox" && !/is-today|is-over/.test(x.cls)), "inbox rows are never is-today/is-over");
  assert(r.inboxSec.rows[0].path === M.TODAY_NOTE, "inbox row data-path = the daily note");

  // --- hero, shutdown, add box ---
  assert(r.heroOne === "Ship episode one", "hero One Thing reads today's note (got '" + r.heroOne + "')");
  assert(r.shutdown.join(",") === "win=,next=", "shutdown inputs render empty when the note has no values");
  assert(r.addRows.legacy === 0, "all five per-card add rows are gone");
  assert(r.addRows.uadd === 1 && r.addRows.addbtn === 1, "one universal add box + button");
  assert(r.addRows.notesearch === 1, "the notes search input is kept");
  assert(r.starttoday === 0, "no '▶ Start today' button when today's note exists");
  assert(r.nowFilter === "", "nowcard starts unfiltered");
  assert(/2 next moves/.test(r.h3now), "now card header counts next moves");

  // --- goal card + pulse ---
  assert(r.gcRows.length === 2, "goal card has one row per non-done goal (got " + r.gcRows.length + ")");
  assert(r.gcRows[0].name === "🚀 Launch the app" && r.gcRows[0].area === "Product", "goal row shows name + area");
  assert(/behind/.test(r.gcRows[0].hb), "goal row health badge");
  assert(/2 tasks · 1 active/.test(r.gcRows[0].meta), "goal row task counts (" + r.gcRows[0].meta + ")");
  assert(r.gcRows[0].bar === "50%", "goal progress bar = 4/8 sub-tasks (" + r.gcRows[0].bar + ")");
  assert(r.pulse[0] === "4", "pulse: 4 sub-tasks completed this week (Mon 2026-09-07 → today) (got " + r.pulse[0] + ")");
  assert(r.pulse[1] === "3", "pulse: 3 active tasks (got " + r.pulse[1] + ")");
  assert(/Triage/.test(r.pulse[r.pulse.length - 1]), "pulse links to Triage");

  // --- pomodoro Next up options ---
  assert(r.focusOpts[0] === "Next moves: Send the brief / Pick a framework", "focus select lists next moves (" + r.focusOpts[0] + ")");
  assert(/^Habits: /.test(r.focusOpts[1] || ""), "focus select lists habits (" + r.focusOpts[1] + ")");

  // --- reference section ---
  assert(r.refsec.present === 1 && r.refsec.toggle === 1, "reference section + toggle present");
  assert(r.refsec.cards === 5, "reference holds calendar/reading/notes/graph/music (got " + r.refsec.cards + ")");
});
