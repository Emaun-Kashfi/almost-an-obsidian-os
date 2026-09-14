/* B1 — 🎯 Goals index + 📋 Tasks board — SPEC §5 / §9 / §10. Today = 2026-09-12. */
const { withPage, extractBlocks, readFile, assert } = require("../lib.js");
const { files } = require("./fixtures.js");

const B = require("../build.js");
const GOALS_MD = readFile(B.COMMON + "/Goals/🎯 Goals.md");
const TASKS_MD = readFile(B.COMMON + "/Tasks/📋 Tasks.md");
const GOALS_SRC = extractBlocks(GOALS_MD)[0];
const TASKS_SRC = extractBlocks(TASKS_MD)[0];

/* ── 0. note shape + syntax ──────────────────────────────────────────────── */
[["🎯 Goals.md", GOALS_MD, GOALS_SRC], ["📋 Tasks.md", TASKS_MD, TASKS_SRC]].forEach(([n, md, src]) => {
  assert(/^---\n[\s\S]*?cssclasses:\n\s+- dashboard[\s\S]*?tags:\n\s+- dashboard\n---/.test(md), n + " has cssclasses+tags dashboard frontmatter");
  assert(/\[\[Dashboard\|← Dashboard\]\]/.test(md), n + " has the ← Dashboard nav link");
  assert(!!src, n + " contains a dataviewjs block");
  try { new Function("dv", "app", "return (async()=>{" + src + "\n})()"); assert(true, n + " block parses"); }
  catch (e) { assert(false, n + " block parses: " + e.message); }
});
assert(/task:\s*<name>\s*@<goal>/.test(GOALS_MD) && /goal:\s*<name>\s*@<area>/.test(GOALS_MD), "🎯 Goals.md explains how to create goals and tasks");

withPage(async (page) => {
  /* ── 1. Goals index ────────────────────────────────────────────────────── */
  const gi = await page.evaluate(async ({ src, files }) => {
    const H = window.StormHarness;
    const app = H.mkVault(files, {});
    const dv = H.mkDv(app, "Goals/🎯 Goals.md");
    const c = await H.runBlock(src, dv, app);
    const read = root => [...root.querySelectorAll(".gi-card")].map(e => ({
      name: e.querySelector(".gi-name").textContent,
      link: e.querySelector(".gi-name").getAttribute("data-link"),
      area: (e.querySelector(".gi-area") || {}).textContent,
      hb: e.querySelector(".hb").textContent,
      hbCls: e.querySelector(".hb").className,
      fill: e.querySelector(".gi-fill").getAttribute("style"),
      pct: e.querySelector(".gi-pct").textContent,
      foot: e.querySelector(".gi-foot").textContent
    }));
    const grids = [...c.querySelectorAll(".goalsidx")];
    const det = c.querySelector("details.goal-paused");
    const out = {
      err: !!c.querySelector(".goal-err"), errText: (c.querySelector(".goal-err") || {}).textContent,
      grids: grids.length, live: read(grids[0]), rest: grids[1] ? read(grids[1]) : [],
      restCls: grids[1] ? grids[1].className : "", sec: (c.querySelector(".gi-sec") || {}).textContent,
      total: c.querySelectorAll(".gi-card").length, all: c.textContent,
      pausedOpen: det ? det.hasAttribute("open") : null,
      pausedSummary: det ? det.querySelector("summary").textContent : "",
      pausedCards: det ? read(det) : [],
      pausedFlag: det ? [...det.querySelectorAll(".gi-card")].every(e => e.getAttribute("data-paused") === "1") : false,
      pausedResume: det ? det.querySelectorAll(".resumebtn").length : 0,
      pausedIsLast: det ? (c.lastElementChild === det) : false,
      pausedOutside: c.querySelectorAll('.gi-card[data-paused]:not(details.goal-paused .gi-card)').length
    };
    c.querySelector(".gi-name").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    out.log = app.__log.filter(o => o.op === "open");
    return out;
  }, { src: GOALS_SRC, files });

  assert(!gi.err, "goals index rendered without error" + (gi.err ? " — " + gi.errText : ""));
  assert(gi.total === 3, "3 goal cards (index note itself is not a goal), got " + gi.total);
  assert(gi.grids === 2, "live grid + the paused group's own grid");
  assert(gi.live.map(g => g.name).join(",") === "Launch the app,Learn TypeScript", "live goals sorted worst-health first: " + gi.live.map(g => g.name + "/" + g.hb).join(", "));
  /* HEALTH contract — 1 overdue sub-task across the goal's non-paused tasks (Record
     episode 1 📅 2026-09-10) and a target of 2026-12-31 → At risk, not Behind. */
  assert(gi.live[0].hb === "At risk" && /\bhb\b/.test(gi.live[0].hbCls) && /risk/.test(gi.live[0].hbCls), "launch goal badge = hb risk / At risk");
  assert(gi.live[0].area === "Product" && gi.live[0].pct === "39%" && gi.live[0].fill === "width:39%", "launch card: area Product, 39% bar + label");
  assert(gi.live[0].foot === "5 tasks · 2 active · next: Record episode 1", "launch card footer: " + gi.live[0].foot);
  assert(gi.live[1].hb === "On track" && gi.live[1].pct === "67%", "typescript goal = On track, 4/6 = 67%");
  assert(gi.live[1].foot === "2 tasks · 1 active · next: Fix the type errors", "typescript card footer: " + gi.live[1].foot);
  /* PAUSE §3 — paused goals now sit in their own collapsed group at the bottom,
     with the Paused badge and a ▶ Resume control; the old "Done & paused" grid is
     reserved for done goals (there are none in this fixture). */
  assert(gi.pausedCards.length === 1 && gi.pausedCards[0].name === "Home organization", "paused goal is inside details.goal-paused");
  assert(gi.pausedOutside === 0, "no paused goal card renders outside details.goal-paused");
  assert(gi.pausedOpen === false, "the paused group is collapsed by default");
  assert(/^Paused \(1\)$/.test((gi.pausedSummary || "").trim()), "summary counts the paused goals — " + gi.pausedSummary);
  assert(gi.pausedIsLast, "the paused group is the last thing on the page");
  assert(gi.pausedFlag && gi.pausedResume === 1, "paused card carries data-paused and one ▶ Resume control");
  // a paused card must NOT advertise a next move — suppressing that nag is the point of pausing
  assert(gi.pausedCards[0].hb === "Paused" && /^1 task · paused/.test(gi.pausedCards[0].foot)
         && gi.pausedCards[0].foot.indexOf("next:") < 0,
    "paused card: Paused badge, no next move — got " + JSON.stringify(gi.pausedCards[0].foot));
  assert(!/Other goal task|Ancient leftover/.test(gi.all), "archived task excluded from goal roll-ups");
  assert(gi.log.length === 1 && gi.log[0].link === "Goals/Launch the app.md", "clicking a card name opens the goal note");

  /* ── 2. Tasks board ────────────────────────────────────────────────────── */
  const tb = await page.evaluate(async ({ src, files }) => {
    const H = window.StormHarness;
    const app = H.mkVault(files, {});
    const dv = H.mkDv(app, "Tasks/📋 Tasks.md");
    const c = await H.runBlock(src, dv, app);
    const cols = [...c.querySelectorAll(".tasksboard .tb-col")].map(col => ({
      key: col.getAttribute("data-col"),
      head: col.querySelector(".tb-head").textContent.trim(),
      n: col.querySelector(".tb-n").textContent,
      cards: [...col.querySelectorAll(".tb-card")].map(e => ({
        name: e.querySelector(".tb-name").textContent,
        paused: e.getAttribute("data-paused"),
        link: e.querySelector(".tb-name").getAttribute("data-link"),
        goal: e.querySelector(".tb-goal").textContent,
        goalLink: e.querySelector(".tb-goal").getAttribute("data-link"),
        dates: e.querySelector(".tb-dates").textContent,
        hb: e.querySelector(".hb").textContent,
        prog: e.querySelector(".tb-prog").textContent,
        next: e.querySelector(".tb-next").textContent
      }))
    }));
    const out = { err: !!c.querySelector(".goal-err"), errText: (c.querySelector(".goal-err") || {}).textContent, cols, total: c.querySelectorAll(".tb-card").length, all: c.textContent };
    c.querySelector('.tb-col[data-col="active"] .tb-card .tb-name').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    out.log = app.__log.filter(o => o.op === "open");
    return out;
  }, { src: TASKS_SRC, files });

  assert(!tb.err, "tasks board rendered without error" + (tb.err ? " — " + tb.errText : ""));
  assert(tb.cols.map(c => c.key).join(",") === "backlog,active,waiting,paused,done", "five columns in order backlog/active/waiting/paused/done");
  assert(tb.cols.map(c => c.head.replace(/\s+/g, " ")).join(" | ") === "Backlog 2 | Active 3 | Waiting 2 | Paused 0 | Done 2", "column headers carry counts: " + tb.cols.map(c => c.head.replace(/\s+/g, " ")).join(" | "));
  assert(tb.total === 9, "9 task cards on the board (archive excluded, index note excluded), got " + tb.total);
  assert(!/Ancient leftover|Old app task|Leg day/.test(tb.all), "archived + Fitness notes never reach the board");

  const backlog = tb.cols[0], active = tb.cols[1], waiting = tb.cols[2], paused = tb.cols[3], done = tb.cols[4];
  assert(paused.cards.length === 0, "no task is paused on its own in this fixture");
  /* PAUSE §3 — Declutter the office hangs off the paused goal: it keeps its own
     column and is merely muted, because its own status is still `waiting`. */
  const decl = waiting.cards.find(c => c.name === "Declutter the office");
  assert(decl && decl.paused === "1", "a task under a paused goal stays in its column with data-paused");
  assert(!active.cards.some(c => c.paused) && !backlog.cards.some(c => c.paused), "unpaused work carries no data-paused");
  assert(backlog.cards.map(c => c.name).join(",") === "Store listing,Other goal task", "backlog sorted by start, undated last");
  assert(active.cards.map(c => c.name).join(",") === "Cross-browser and mobile QA pass,Design pass,Convert one JS project", "active sorted by start: " + active.cards.map(c => c.name).join(", "));
  assert(waiting.cards.map(c => c.name).join(",") === "Cover art and branding,Declutter the office", "waiting sorted by name (both undated)");
  assert(done.cards.map(c => c.name).join(",") === "Set up tsconfig,App foundations", "done column: most recent `completed` first");

  const story = active.cards[1];
  assert(story.dates === "Sep 1 → Oct 15", 'dated card shows "Sep 1 → Oct 15" (got "' + story.dates + '")');
  assert(story.hb === "On track" && story.prog === "3/8", "story card: On track, 3/8");
  assert(story.next === "Write the questions 📅 Sep 16", "story card next move + date: " + story.next);
  assert(story.goal === "🎯 Launch the app" && story.goalLink === "Goals/Launch the app.md", "card links to the goal note");
  assert(active.cards[0].hb === "At risk", "recording card is At risk");

  const cover = waiting.cards[0];
  assert(cover.dates === "unscheduled" && cover.hb === "Unscheduled" && cover.prog === "1/3" && cover.next === "Brief the designer", "undated waiting card: unscheduled / Unscheduled / 1/3 / Brief the designer");
  assert(backlog.cards[1].goal === "🎯 Another goal" && backlog.cards[1].hb === "Unscheduled", "a task whose goal note does not exist still shows the goal name");
  assert(done.cards[0].hb === "Done" && done.cards[0].prog === "2/2", "done card badge = Done");
  assert(tb.log.length === 1 && tb.log[0].link === "Tasks/Cross-browser and mobile QA pass.md", "clicking a card name opens the task note");
});
