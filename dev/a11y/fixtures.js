/* ═══════════════════════════════════════════════════════════════════════════
   a11y/fixtures.js — the vault content every surface is rendered against.

   Base = the REAL built vault (dev/build/<variant>/vault), so the audit sees the
   notes users actually get. On top of that we add synthetic notes chosen so that
   every colour-bearing STATE is on screen at least once: on track / at risk / behind / done / unscheduled / paused,
   overdue + due-today + future + undated(projected) sub-tasks, completed marks,
   backlog chips, the add rows, and the empty states.

   Today = 2026-09-13 everywhere (matches the other suites).
   ═══════════════════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs");
const path = require("path");

const TODAY = "2026-09-13";
const P = require("../paths.js");
const VAULT = P.variant().built;

const SKIP_DIR = /(^|\/)(\.obsidian|\.git|\.trash)(\/|$)/;
const TEXT_EXT = /\.(md|txt|json|js|css|svg)$/i;

function readVault(root) {
  const out = {};
  (function walk(dir, rel) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const r = rel ? rel + "/" + name : name;
      if (SKIP_DIR.test(r)) continue;
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p, r);
      else if (TEXT_EXT.test(name) && st.size < 400000) out[r] = fs.readFileSync(p, "utf8");
    }
  })(root, "");
  return out;
}

/* ---------- synthetic notes: one goal per health state -------------------- */
const G = (name, o) => {
  const fm = ["---", "type: goal", "status: " + (o.status || "active")];
  if (o.paused) fm.push("paused: " + o.paused);
  fm.push("area: " + (o.area || "Audit"));
  fm.push("target: " + (o.target == null ? "2026-12-31" : o.target));
  fm.push("tags:", "  - goal", "---");
  return fm.join("\n") + "\n\n# " + name + "\n\n## 🗒️ Notes\n- \n";
};
const T = (name, o) => {
  const fm = ["---", "type: task", 'goal: "[[' + o.goal + ']]"', "status: " + (o.status || "active")];
  if (o.paused) fm.push("paused: " + o.paused);
  fm.push("start: " + (o.start == null ? "" : o.start), "end: " + (o.end == null ? "" : o.end),
    "completed: " + (o.completed || ""), "tags:", "  - task", "---");
  return fm.join("\n") + "\n\n# " + name + "\n\n## 📆 Timeline\n\n## Sub-tasks\n" +
    (o.subs || []).join("\n") + "\n\n## 🗒️ Notes\n- \n";
};

/* sub-task line kits — every bar state the Gantt can paint */
const SUBS = {
  /* 3 of 5 done → gap ≈ +0.03 → "ok"; one overdue, one due today, one future,
     one undated (→ a projected .st-plan bar + a backlog chip) */
  ok: [
    "- [x] Draft the outline 📅 2026-08-05 ✅ 2026-08-05",
    "- [x] Collect the sources 📅 2026-08-19 ✅ 2026-08-18",
    "- [x] Write the first pass 📅 2026-09-02 ✅ " + TODAY,
    "- [ ] Chase the overdue reply 📅 2026-09-05",
    "- [ ] Record the segment 📅 " + TODAY,
    "- [ ] Final polish 📅 2026-10-08",
    "- [ ] Something with no date at all",
  ],
  /* 2 of 7 → gap ≈ -0.29 → "risk" */
  risk: [
    "- [x] Book the room 📅 2026-08-10 ✅ 2026-08-10",
    "- [x] Confirm the budget ✅ 2026-09-01",
    "- [ ] Overdue: send the brief 📅 2026-08-28",
    "- [ ] Overdue: get the sign-off 📅 2026-09-07",
    "- [ ] Due today: publish 📅 " + TODAY,
    "- [ ] Later: measure 📅 2026-10-06",
    "- [ ] Undated follow-up",
  ],
  /* 0 of 5 → gap ≈ -0.57 → "behind" */
  behind: [
    "- [ ] Overdue: kick-off 📅 2026-08-06",
    "- [ ] Overdue: first draft 📅 2026-08-24",
    "- [ ] Overdue: review 📅 2026-09-04",
    "- [ ] Due today: ship it 📅 " + TODAY,
    "- [ ] Undated stretch item",
  ],
  done: [
    "- [x] Everything 📅 2026-08-14 ✅ 2026-08-14",
    "- [x] Absolutely everything 📅 2026-09-01 ✅ 2026-09-01",
  ],
  /* no dates anywhere → every bar is projected */
  unscheduled: [
    "- [ ] No date one",
    "- [ ] No date two",
    "- [x] No date three, but finished ✅ 2026-09-10",
  ],
  paused: [
    "- [ ] Paused overdue step 📅 2026-08-30",
    "- [ ] Paused today step 📅 " + TODAY,
    "- [ ] Paused future step 📅 2026-10-02",
  ],
};

/* ---------- CONTRACT §B: a PLAIN note with links ---------------------------
   Not a Storm surface — no .storm-hub / .dashboard root, no storm.css palette
   block — which is exactly the point: outside Storm's own surfaces a link takes
   Obsidian's --link-color, and until the theme file sets it the user's
   `accentColor: "#000000"` paints every link black on a dark background.
   Rendered on all three grounds Obsidian gives a link: --background-primary (the
   note), --background-secondary (the sidebar) and --background-secondary-alt.
   It lives in _scripts/ as a .txt so Dataview never indexes it as a note and no
   other surface's query can see it. -------------------------------------- */
const LINKS_BLOCK = [
  "```dataviewjs",
  'const L = (c, t) => \'<a class="\' + c + \'" href="#">\' + t + "</a>";',
  "const body = '<h2>Reading list</h2>' +",
  "  '<p>Plain body text on the page background, with ' + L(\"internal-link\", \"a resolved link\") +",
  "  ', ' + L(\"internal-link is-unresolved\", \"an unresolved one\") + ' and ' +",
  "  L(\"external-link\", \"an external one\") + ' in the same sentence.</p>' +",
  "  '<ul><li>' + L(\"internal-link\", \"🎯 Goals\") + ' · ' +",
  "  L(\"internal-link is-unresolved\", \"Not created yet\") + '</li></ul>';",
  "dv.container.innerHTML = '<div class=\"axlinks\">' +",
  "  '<div class=\"ax-pane ax-primary\">' + body + '</div>' +",
  "  '<div class=\"ax-pane ax-secondary\"><div class=\"ax-lbl\">sidebar · --background-secondary</div>' + body + '</div>' +",
  "  '<div class=\"ax-pane ax-secalt\"><div class=\"ax-lbl\">--background-secondary-alt</div>' + body + '</div>' +",
  "  '</div>';",
  "```",
].join("\n") + "\n";

function extra() {
  const f = {};
  f["_scripts/ax-links.txt"] = LINKS_BLOCK;
  /* The Dashboard's banner. livedata only trusts a cached `stormTheme` when
     `stormThemeSrc` equals the RESOLVED banner path, so without the file in the
     store the `dashboard-shipped` surface silently falls back to the built-in
     palette instead of showing what a user sees. The path comes from the
     variant's own config, never from a literal here. */
  f[P.variant().dashboard.bannerPath] = "<binary>";
  f["Goals/AX On track.md"] = G("AX On track", { area: "Audit", target: "2026-10-31" });
  f["Goals/AX At risk.md"] = G("AX At risk", { area: "Audit", target: "2026-10-20" });
  f["Goals/AX Behind.md"] = G("AX Behind", { area: "Audit", target: "2026-09-25" });
  f["Goals/AX Done.md"] = G("AX Done", { status: "done", area: "Audit", target: "2026-09-10" });
  f["Goals/AX Unscheduled.md"] = G("AX Unscheduled", { area: "Audit", target: "" });
  f["Goals/AX Paused.md"] = G("AX Paused", { status: "paused", paused: "2026-06-15", area: "Audit", target: "2026-12-01" });

  f["Tasks/AX ok task.md"] = T("AX ok task", { goal: "AX On track", start: "2026-08-01", end: "2026-10-15", subs: SUBS.ok });
  f["Tasks/AX risk task.md"] = T("AX risk task", { goal: "AX At risk", start: "2026-08-01", end: "2026-10-15", subs: SUBS.risk });
  f["Tasks/AX behind task.md"] = T("AX behind task", { goal: "AX Behind", start: "2026-08-01", end: "2026-10-15", subs: SUBS.behind });
  f["Tasks/AX done task.md"] = T("AX done task", { goal: "AX Done", status: "done", start: "2026-08-01", end: "2026-09-10", completed: "2026-09-10", subs: SUBS.done });
  f["Tasks/AX unscheduled task.md"] = T("AX unscheduled task", { goal: "AX Unscheduled", start: "", end: "", subs: SUBS.unscheduled });
  f["Tasks/AX paused task.md"] = T("AX paused task", { goal: "AX Paused", status: "paused", paused: "2026-06-15", start: "2026-08-01", end: "2026-11-01", subs: SUBS.paused });
  /* a task with NO sub-tasks at all → the Gantt's empty state + add row */
  f["Tasks/AX empty task.md"] = T("AX empty task", { goal: "AX On track", start: "2026-09-01", end: "2026-10-01", subs: [] });

  f["Daily/" + TODAY + " Sunday.md"] =
    "---\ndate: " + TODAY + "\ntags:\n  - daily\n---\n\n# Sunday, September 13\n\n" +
    "## 🎯 One thing\n\n→ Ship the audit\n\n" +
    "## ⚡ Tasks\n\n- [ ] A loose inbox line 📅 " + TODAY + "\n- [ ] An older loose line 📅 2026-09-08\n- [x] A finished loose line ✅ " + TODAY + "\n\n" +
    "## 📅 Planned today\n\n## ✅ Done today\n\n## 🌙 Shutdown\n**Win of the day:** \n";
  /* a second daily note so the daily tables have an EMPTY day to render too */
  f["Daily/2026-09-14 Monday.md"] =
    "---\ndate: 2026-09-14\ntags:\n  - daily\n---\n\n# Monday, September 14\n\n## 🎯 One thing\n\n→ \n\n## ⚡ Tasks\n\n- [ ] \n\n## 📅 Planned today\n\n## ✅ Done today\n";
  return f;
}

function files() { return Object.assign(readVault(VAULT), extra()); }

module.exports = { files, extra, readVault, TODAY, VAULT };
