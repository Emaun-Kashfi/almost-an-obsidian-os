/* ═══════════════════════════════════════════════════════════════════════════
   a11y/audit-surfaces.js — which block renders in which note.
   Shared by audit.js and shots.js so a surface is only described once.
   ═══════════════════════════════════════════════════════════════════════════ */
"use strict";
const path = require("path");
const P = require("../paths.js");
const FX = require("./fixtures.js");

/* ─────────────────────────── vault definitions ─────────────────────────── */
const V = FX.VAULT;
const NAME = P.DEFAULT_VARIANT;

/* CONTRACT §B — link colour on Obsidian's OWN grounds (--background-primary,
   --background-secondary, --background-secondary-alt). Identical in both vaults,
   so it is written once.

   `paletteKinds` limits it to "match": that is the mode in which
   the generated storm-theme.css writes --link-color / --text-accent / the
   unresolved colour, so they are the rows where a failure is OURS to fix. The
   static and community rows are deliberately out of scope — with no theme file,
   or in community mode, links are whatever the installed theme derives from the
   user's accentColor, which is precisely what community mode promises to leave
   alone. (For the record: Obsidian's own defaults measure 4.36:1 dark and
   4.26:1 light for a resolved link and 1.75:1 for an unresolved one, which is
   why the fix writes explicit colours instead of nudging the accent.) */
const LINKS = {
  key: "links", label: "plain note · links on Obsidian's own grounds",
  src: ["_scripts/ax-links", 0], cur: "Goals/AX On track.md", wrap: "",
  width: 900, height: 900, paletteKinds: ["match"],
};

/* `files` is a getter: reading the vault off disk costs ~0.5 s, and nothing
   should pay for it until a surface is actually rendered. */
const VAULTS = {
  [NAME]: {
    root: V,
    css: path.join(V, ".obsidian/snippets/storm.css"),
    cssName: path.relative(P.REPO, path.join(V, ".obsidian/snippets/storm.css")),
    get files() { return FX.files(); },
    surfaces: [
      { key: "dashboard", label: "Dashboard", src: ["Dashboard.md", 0], cur: "Dashboard.md", wrap: "storm-hub", width: 1180, height: 2600, stripTheme: true },
      { key: "dashboard-shipped", label: "Dashboard · exactly as the vault ships it", src: ["Dashboard.md", 0], cur: "Dashboard.md", wrap: "storm-hub", width: 1180, height: 2600, palettes: ["static-dark", "static-light"] },
      { key: "goals", label: "🎯 Goals", src: ["Goals/🎯 Goals.md", 0], cur: "Goals/🎯 Goals.md", wrap: "dashboard", width: 1100, open: "details" },
      { key: "board", label: "📋 Tasks", src: ["Tasks/📋 Tasks.md", 0], cur: "Tasks/📋 Tasks.md", wrap: "dashboard", width: 1180 },
      { key: "triage", label: "🧹 Triage", src: ["🧹 Triage.md", 0], cur: "🧹 Triage.md", wrap: "dashboard", width: 1100 },
      { key: "panel-ok", label: "goal panel · on track", src: ["_scripts/goal-panel", 0], cur: "Goals/AX On track.md", wrap: "", width: 900 },
      { key: "panel-risk", label: "goal panel · at risk", src: ["_scripts/goal-panel", 0], cur: "Goals/AX At risk.md", wrap: "", width: 900 },
      { key: "panel-behind", label: "goal panel · behind", src: ["_scripts/goal-panel", 0], cur: "Goals/AX Behind.md", wrap: "", width: 900 },
      { key: "panel-done", label: "goal panel · done", src: ["_scripts/goal-panel", 0], cur: "Goals/AX Done.md", wrap: "", width: 900 },
      { key: "panel-unsched", label: "goal panel · unscheduled", src: ["_scripts/goal-panel", 0], cur: "Goals/AX Unscheduled.md", wrap: "", width: 900 },
      { key: "panel-paused", label: "goal panel · paused", src: ["_scripts/goal-panel", 0], cur: "Goals/AX Paused.md", wrap: "", width: 900, open: "resumebar" },
      { key: "gantt-ok", label: "Timeline · on track", src: ["_scripts/task-gantt", 0], cur: "Tasks/AX ok task.md", wrap: "", width: 900, focus: ".tg-in" },
      { key: "gantt-risk", label: "Timeline · at risk", src: ["_scripts/task-gantt", 0], cur: "Tasks/AX risk task.md", wrap: "", width: 900 },
      { key: "gantt-behind", label: "Timeline · behind", src: ["_scripts/task-gantt", 0], cur: "Tasks/AX behind task.md", wrap: "", width: 900 },
      { key: "gantt-done", label: "Timeline · done", src: ["_scripts/task-gantt", 0], cur: "Tasks/AX done task.md", wrap: "", width: 900 },
      { key: "gantt-unsched", label: "Timeline · unscheduled", src: ["_scripts/task-gantt", 0], cur: "Tasks/AX unscheduled task.md", wrap: "", width: 900 },
      { key: "gantt-paused", label: "Timeline · paused", src: ["_scripts/task-gantt", 0], cur: "Tasks/AX paused task.md", wrap: "", width: 900, open: "resumebar" },
      { key: "gantt-empty", label: "Timeline · empty state", src: ["_scripts/task-gantt", 0], cur: "Tasks/AX empty task.md", wrap: "", width: 900 },
      { key: "daily-planned", label: "daily · Planned today", src: ["_scripts/daily-tables", 0], cur: "Daily/2026-09-13 Sunday.md", wrap: "", width: 900 },
      { key: "daily-done", label: "daily · Done today", src: ["_scripts/daily-tables", 1], cur: "Daily/2026-09-13 Sunday.md", wrap: "", width: 900 },
      { key: "daily-empty", label: "daily · empty day", src: ["_scripts/daily-tables", 0], cur: "Daily/2026-09-14 Monday.md", wrap: "", width: 900 },
      { key: "settings", label: "⚙️ Settings", src: ["⚙️ Settings.md", 0], cur: "⚙️ Settings.md", wrap: "storm-settings", width: 1000 },
      LINKS,
    ],
  },
};


/* A note whose frontmatter carries stormMode/stormTheme paints its OWN palette
   into the note via <style class="storm-theme-css">, which would override the
   matrix palette. For the matrix runs we strip those keys; the shipped values
   get their own `dashboard-shipped` surface. */
function stripThemeKeys(files, notePath) {
  const md = files[notePath];
  if (md == null) return files;
  const out = Object.assign({}, files);
  out[notePath] = md.replace(/^---\n([\s\S]*?)\n---/, (m, fm) =>
    "---\n" + fm.split("\n").filter(l => !/^storm(Mode|Theme|ThemeSrc|Banner)\s*:/.test(l)).join("\n") + "\n---");
  return out;
}

module.exports = { VAULTS, stripThemeKeys };
