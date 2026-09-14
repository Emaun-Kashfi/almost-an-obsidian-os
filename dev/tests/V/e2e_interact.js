/* Agent V — end-to-end INTERACTION of the built vault against its real seed
   (specs/SPEC.md §2 / §3). Checks 2a (the chrome that only reacts to a click) and
   2b (every write path).

   e2e_template.js already pins what the Dashboard RENDERS from this seed. This
   file is the other half: what happens when someone actually uses it — a box is
   ticked, a next move is pushed to tomorrow, the add box is typed into, the One
   Thing and the shutdown win are set — and exactly which line lands in which note.
   Both run against dev/build/<variant>/vault, which tests/V proves is the vault
   this repo ships.                                                 today = 2026-09-12 */
const { withPage, extractBlocks, readFile, assert } = require("../lib.js");
const V = require("./vault.js");
const B = require("../build.js");

const src = extractBlocks(readFile(B.VAULT() + "/Dashboard.md"))[0];
const files = V.build();

/* CONTRACT A — the one-line block a goal note carries instead of a pasted panel. */
const VIEW_PANEL = '```dataviewjs\nconst p = "_scripts/' + 'goal-panel' + '", f = x => app.metadataCache.getFirstLinkpathDest(x, "");\nif (f(p + ".js") || f(p + "/view.js")) await dv.view(p);\nelse dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.", { cls: "panel-err storm-missing-view" });\n```';

/* the three seed task notes the interactions write into */
const T_BOOKS = "Tasks/Books 10–24.md";
const T_GALLERY = "Tasks/Build the project gallery.md";
const T_DOMAIN = "Tasks/Launch on a custom domain.md";

withPage(async (page, errors) => {
  const r = await page.evaluate(async ({ src, files, links, TODAY_PATH }) => {
    const H = window.StormHarness;
    const app = H.mkVault(files, {
      resolvedLinks: links,
      tags: { "#daily": 3, "#task": 6, "#goal": 4, "#dashboard": 3 },
      createDaily: () => {},
    });
    const dv = H.mkDv(app, "Dashboard.md");
    const c = await H.runBlock(src, dv, app);
    const q = s => c.querySelectorAll(s).length;

    const before = {
      err: (c.textContent.match(/Storm hub error[^\n]*/) || [null])[0],
      hub: q(".storm-hub"),
      ref: { cards: c.querySelectorAll(".refsec .card").length, toggle: !!c.querySelector(".reftoggle"), collapsed: c.querySelector(".refsec").classList.contains("collapsed") },
      workoutRest: q(".workout.rest"),
      starttoday: q(".starttoday"),
      shutdown: [...c.querySelectorAll(".sd-inp")].map(i => i.getAttribute("data-sd") + "=" + i.value),
      heroOne: (c.querySelector(".hero-one .v") || {}).textContent,
      heroUnset: !!(c.querySelector(".hero-one") || {}).classList && c.querySelector(".hero-one").classList.contains("unset"),
    };

    // --- collapse the reference section -----------------------------------
    c.querySelector(".reftoggle").click();
    before.ref.afterToggle = c.querySelector(".refsec").classList.contains("collapsed");
    c.querySelector(".reftoggle").click();

    // --- filter tiles -------------------------------------------------------
    const nowcard = c.querySelector(".nowcard");
    c.querySelector('.act[data-filter="nm"]').click();
    const filterOn = nowcard.getAttribute("data-filter");
    c.querySelector('.act[data-filter="nm"]').click();
    const filterOff = nowcard.getAttribute("data-filter");
    // a manually expanded sub-list must survive a filter being switched on and off
    const expandBtn = c.querySelector('.nm-row[data-kind="next"] [data-expand]');
    expandBtn.click();
    const subsEl = expandBtn.closest(".nm-row").nextElementSibling;
    const expandedBefore = subsEl.style.display !== "none";
    c.querySelector('.act[data-filter="over"]').click();
    c.querySelector('.act[data-filter="over"]').click();
    const expandedAfter = subsEl.style.display !== "none" &&
      [...subsEl.querySelectorAll(".nm-row")].every(x => x.style.display !== "none");
    expandBtn.click();

    /* ============ 2b — interactions ============ */
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // 1. check off the undated next move "Book 10"
    const bookRow = [...c.querySelectorAll(".nm-row")].find(x => (x.querySelector(".nm-text") || {}).textContent === "Book 10");
    if (bookRow) bookRow.querySelector(".nm-box").click();
    await sleep(60);
    const booksTxt = app.__store.get("Tasks/Books 10–24.md") || "";

    // 2. reschedule the gallery's next move to tomorrow (it is overdue: 📅 09-10)
    const galleryRow = [...c.querySelectorAll('.nm-row[data-kind="next"]')]
      .find(x => (x.getAttribute("data-path") || "").indexOf("Build the project gallery") >= 0);
    const galleryText = galleryRow ? galleryRow.querySelector(".nm-text").textContent : "";
    if (galleryRow) galleryRow.querySelector('[data-resched="tomorrow"]').click();
    await sleep(80);
    const galleryTxt = app.__store.get("Tasks/Build the project gallery.md") || "";

    // 3. sub: into "Launch on a custom domain"
    const inp = c.querySelector("input[data-uadd]");
    const enter = async v => {
      inp.value = v;
      inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await sleep(120);
    };
    await enter("sub: Confirm the hosting plan 9/20 -> Launch on a custom");
    const domainTxt = app.__store.get("Tasks/Launch on a custom domain.md") || "";

    // 4. plain inbox item with a natural date and a tag
    await enter("Buy batteries tomorrow #home");
    const todayTxt = app.__store.get(TODAY_PATH) || "";

    // 5. goal: with area + target
    await enter("goal: Test goal @Area 2026-12-01");
    const goalPath = [...app.__store.keys()].find(k => /^Goals\/Test goal/.test(k)) || "";
    const goalTxt = goalPath ? app.__store.get(goalPath) : "";

    // 5b. an area with YAML-significant punctuation must still produce valid frontmatter
    await enter("goal: Crunch @Q4: crunch time");
    const goal2 = app.__store.get("Goals/Crunch.md") || "";

    // 6. hero One Thing
    const hero = c.querySelector('[data-action="edit-one"]');
    hero.click();
    const oneInp = hero.querySelector(".one-inp");
    if (oneInp) {
      oneInp.value = "Ship it";
      oneInp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }
    await sleep(120);

    // 7. shutdown win
    const sdWin = c.querySelector('.sd-inp[data-sd="win"]');
    sdWin.value = "Win";
    sdWin.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await sleep(120);
    const todayAfter = app.__store.get(TODAY_PATH) || "";

    return {
      before, filterOn, filterOff, expandedBefore, expandedAfter,
      notices: window.__notices.slice(),
      store: {
        book: booksTxt.split("\n").filter(l => /^- \[.\] Book 10(\s|$)/.test(l)),
        gallery: galleryTxt.split("\n").filter(l => /Build the project gallery 📅/.test(l)),
        galleryText,
        domain: domainTxt.split("\n").filter(l => /Confirm the hosting plan/.test(l)),
        domainAfterHeading: (domainTxt.split("## Sub-tasks")[1] || "").split(/\n#{2,6} /)[0],
        domainHasHeading: /## Sub-tasks/.test(domainTxt),
        inboxLine: todayTxt.split("\n").filter(l => /Buy batteries/.test(l)),
        inboxSection: (todayTxt.split(/^## ⚡[^\n]*$/m)[1] || "").split(/\n## /)[0],
        goalPath, goalNote: goalTxt, goalBlocks: (goalTxt.match(/```dataviewjs/g) || []).length,
        goalHasPanelCode: goalTxt.indexOf("🎯 GOAL PANEL") >= 0,
        goalFm: goalTxt.split("---")[1] || "",
        goal2Area: (goal2.split("\n").find(l => l.indexOf("area:") === 0) || ""),
        oneThingSection: (todayAfter.split(/^## 🎯[^\n]*$/m)[1] || "").split(/\n## /)[0],
        winLine: todayAfter.split("\n").filter(l => /Win of the day/.test(l)),
      },
      log: app.__log.filter(x => x.op === "modify" || x.op === "create").map(x => x.op + " " + x.path),
    };
  }, { src, files, links: V.RESOLVED_LINKS, TODAY_PATH: V.TODAY_PATH });

  const Bf = r.before, S = r.store;

  /* ---------- 2a — the chrome that only answers to a click ---------- */
  console.log("── 2a: the interactive chrome ──");
  assert(!Bf.err, "no error div — the block ran clean" + (Bf.err ? " (" + Bf.err + ")" : ""));
  assert(Bf.hub === 1, "the hub renders (1 .storm-hub)");
  assert(Bf.ref.cards === 5, "Reference section holds 5 cards, got " + Bf.ref.cards);
  assert(Bf.ref.collapsed === false && Bf.ref.afterToggle === true, "Reference section collapses on click");
  assert(Bf.workoutRest === 1, "🏋️ Workouts note is absent → workout card falls back to Rest day (no crash)");
  assert(Bf.starttoday === 0, "today's note exists → no ▶ Start today button");
  assert(Bf.heroOne.trim() === "Set today's one thing →" && Bf.heroUnset,
    "One Thing shows its empty state — " + Bf.heroOne.trim());
  assert(r.filterOn === "nm" && r.filterOff === "", "action-strip tile toggles the .nowcard filter on and off");
  assert(r.expandedBefore && r.expandedAfter, "a hand-expanded sub-task list survives a filter being switched on and off again");

  /* ---------- 2b — interactions ---------- */
  console.log("── 2b: interactions write the right lines ──");
  assert(S.book.length === 1 && S.book[0] === "- [x] Book 10 ✅ 2026-09-12",
    'clicking the "Book 10" box writes `- [x] Book 10 ✅ 2026-09-12` — got ' + JSON.stringify(S.book));
  assert(S.gallery.length === 1 && S.gallery[0] === "- [ ] Build the project gallery 📅 2026-09-13",
    "→ tmrw rewrites the 📅 on that exact sub-task line and changes nothing else — got " + JSON.stringify(S.gallery));
  assert(S.domain.length === 1 && S.domain[0] === "- [ ] Confirm the hosting plan 📅 2026-09-20",
    "`sub: Confirm the hosting plan 9/20 -> Launch on a custom` → `- [ ] Confirm the hosting plan 📅 2026-09-20` — got " + JSON.stringify(S.domain));
  assert(/- \[ \] Confirm the hosting plan 📅 2026-09-20/.test(S.domainAfterHeading),
    "…appended inside the `## Sub-tasks` section of Launch on a custom domain");
  assert(S.inboxLine.length === 1 && /📅 2026-09-13/.test(S.inboxLine[0]) && /#home/.test(S.inboxLine[0]),
    "`Buy batteries tomorrow #home` → dated 📅 2026-09-13 and keeps #home — got " + JSON.stringify(S.inboxLine));
  assert(S.inboxSection.indexOf("Buy batteries") >= 0, "…and lands under `## ⚡` of today's note");
  assert(/^Goals\/Test goal\.md$/.test(S.goalPath), "`goal:` creates Goals/Test goal.md — got " + S.goalPath);
  /* CONTRACT A — the note calls the panel, it does not carry it. */
  assert(S.goalBlocks === 1 && S.goalNote.includes(VIEW_PANEL),
    "the new goal note carries the ONE-LINE goal-panel view block (blocks=" + S.goalBlocks + ")");
  /* THEME2 §C: the guard is three lines, so ~330 bytes more than the bare call. */
  assert(!S.goalHasPanelCode && S.goalNote.length < 900,
    "…and none of the panel's own code (" + S.goalNote.length + " chars, was 22 KB)");
  assert(/area: Area/.test(S.goalFm) && /target: 2026-12-01/.test(S.goalFm),
    "…with area and target from the command — " + S.goalFm.replace(/\n/g, " | ").trim());
  assert(S.goal2Area === 'area: "Q4: crunch time"',
    "an area containing `:` is quoted so the YAML frontmatter still parses — got " + JSON.stringify(S.goal2Area));
  assert(/→ Ship it/.test(S.oneThingSection), "One Thing writes `→ Ship it` under `## 🎯 One thing` — " + JSON.stringify(S.oneThingSection.trim()));
  assert(S.winLine.length === 1 && S.winLine[0] === "**Win of the day:** Win",
    "shutdown writes after `**Win of the day:**` — got " + JSON.stringify(S.winLine));

  if (errors.length) assert(false, "page errors: " + errors.join(" | "));
  else assert(true, "no uncaught page errors");
}).catch(e => { console.log("FAIL: " + e.stack); process.exitCode = 1; });
