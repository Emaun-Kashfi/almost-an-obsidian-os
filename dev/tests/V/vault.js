/* Agent V — build a harness mock vault from the REAL deployable tree.
   Reads every file under dev/build/<variant>/vault from disk and returns {path: content},
   then adds the pieces a fresh vault would gain on day one:
     · a dummy banner image
     · today's daily note, produced by substituting the Templater tags of the
       tree's own _templates/Daily Note Template.md (today = 2026-09-12, Saturday)
     · a daily note 6 days back  (inside  the 7-day inbox window)
     · a daily note 9 days back  (outside the window, inside triage's 42 days)
   The 🏋️ Workouts note is deliberately ABSENT.
*/
const fs = require("fs");
const path = require("path");
const P = require("../../paths.js");

const TODAY = "2026-09-12";
const TODAY_NAME = "2026-09-12 Saturday";
const TODAY_PATH = `Daily/${TODAY_NAME}.md`;
const NEAR_PATH = "Daily/2026-09-06 Sunday.md";   // 6 days back → inside the inbox window
const FAR_PATH = "Daily/2026-09-03 Thursday.md";  // 9 days back → outside it

function readTree(root) {
  const out = {};
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      const rel = path.relative(root, p).split(path.sep).join("/");
      out[rel] = fs.readFileSync(p, "utf8");
    }
  })(root);
  return out;
}

/* Templater substitution — exactly what Templater would emit on 2026-09-12. */
function renderDaily(tpl, extraInbox) {
  let t = tpl
    .replace(/^<%\*[\s\S]*?-%>\n?/m, "")                       // drop the rename command line
    .replace(/<%\s*tp\.date\.now\("YYYY-MM-DD"\)\s*%>/g, TODAY)
    .replace(/<%\s*tp\.date\.now\("dddd, MMMM D"\)\s*%>/g, "Saturday, September 12")
    .replace(/<%\s*tp\.date\.now\("(?:GGGG|YYYY)-\[W\]WW"\)\s*%>/g, "2026-W37")
    .replace(/<%\s*tp\.date\.now\("dddd"\)\s*%>/g, "Saturday");
  if (/<%/.test(t)) throw new Error("unsubstituted Templater tag left in the daily note:\n" +
    (t.match(/<%[^\n]*/g) || []).join("\n"));
  // two one-off items under `## ⚡ Tasks`, one of them dated today
  const lines = t.split("\n");
  const h = lines.findIndex(l => /^#{1,6}\s*⚡/.test(l));
  if (h < 0) throw new Error("daily template has no ## ⚡ section");
  let end = h + 1;
  while (end < lines.length && !/^#{1,6}\s/.test(lines[end])) end++;
  let at = end; while (at - 1 > h && lines[at - 1].trim() === "") at--;
  lines.splice(at, 0, ...(extraInbox || [
    "- [ ] Call the storage unit",
    "- [ ] Pay the hosting invoice 📅 2026-09-12",
  ]));
  return lines.join("\n");
}

function dayNote(iso, name, items) {
  return `---\ndate: ${iso}\ntags:\n  - daily\n---\n\n# ${name}\n\n## 🎯 One thing\n\n→ \n\n## ⚡ Tasks\n\n${items.join("\n")}\n\n## 🔥 Habits\n\n- [x] 🏃 Move / exercise #habit/move ✅ ${iso}\n- [ ] 💧 Water #habit/water\n\n## 🌙 Shutdown\n**Win of the day:** \n\n**One next step on anything I touched:** \n`;
}

function build(variant, opts) {
  opts = opts || {};
  const root = P.variant(variant).built;
  const files = readTree(root);
  // a real banner file so the variant's own fallback path resolves
  files[P.variant(variant).dashboard.bannerPath] = "<<binary banner>>";
  if (!opts.noToday) {
    files[TODAY_PATH] = renderDaily(files["_templates/Daily Note Template.md"], opts.inbox);
  }
  files[NEAR_PATH] = dayNote("2026-09-06", "Sunday, September 6",
    ["- [ ] Chase the missing invoice", "- [ ] "]);
  files[FAR_PATH] = dayNote("2026-09-03", "Thursday, September 3",
    ["- [ ] Ancient forgotten errand"]);
  return files;
}

const RESOLVED_LINKS = {
  "Dashboard.md": { "Goals/🎯 Goals.md": 1, "Tasks/📋 Tasks.md": 1 },
};

module.exports = { build, readTree, renderDaily, TODAY, TODAY_NAME, TODAY_PATH, NEAR_PATH, FAR_PATH, RESOLVED_LINKS };
