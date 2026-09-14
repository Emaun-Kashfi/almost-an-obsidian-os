/* Visual check for the ＋ Task control (ADDTASK): the goal panel header and the
   🎯 Goals cards, closed and open, dark and light, against the REAL shipped
   the built vault's .obsidian/snippets/storm.css.
     node tests/P/shot-addtask.js   → tests/P/addtask-<view>-<state>-<theme>.png   */
const path = require("path");
const { withPage, extractBlocks, readFile } = require("../lib.js");

const B = require("../build.js");
const VAULT = B.VAULT(), COMMON = B.COMMON;
const CSS = readFile(`${VAULT}/.obsidian/snippets/storm.css`);
const PANEL = readFile(`${VAULT}/_scripts/goal-panel.js`);
const GOALS = extractBlocks(readFile(`${VAULT}/Goals/🎯 Goals.md`))[0];

const T = (fm, subs) => `---\n${fm}\n---\n\n# Task\n\n## Sub-tasks\n${subs}\n\n## 🗒️ Notes\n- \n`;
const files = {
  "Goals/🎯 Goals.md": "---\ncssclasses:\n  - dashboard\ntags:\n  - dashboard\n---\n\n# 🎯 Goals\n",
  "Tasks/📋 Tasks.md": "---\ncssclasses:\n  - dashboard\ntags:\n  - dashboard\n---\n\n# 📋 Tasks\n",
  "Goals/🚀 Launch the app.md":
    "---\ntype: goal\nstatus: active\narea: Product\ntarget: 2026-10-31\ntags:\n  - goal\n---\n\n# 🚀 Launch the app\n",
  "Goals/🧠 Learn TypeScript.md":
    "---\ntype: goal\nstatus: active\narea: Learning\ntarget: 2026-12-31\ntags:\n  - goal\n---\n\n# 🧠 Learn TypeScript\n",
  "Goals/📖 Read 24 books.md":
    "---\ntype: goal\nstatus: paused\npaused: 2026-08-15\narea: Reading\ntarget: 2026-12-31\ntags:\n  - goal\n---\n\n# 📖 Read 24 books\n",
  "Tasks/Design pass.md": T(
    'type: task\ngoal: "[[🚀 Launch the app]]"\nstatus: active\nstart: 2026-08-01\nend: 2026-10-15\ncompleted:\ntags:\n  - task',
    ["- [x] Outline the arc 📅 2026-09-02 ✅ 2026-09-13",
     "- [ ] Confirm the guest 📅 2026-09-20",
     "- [ ] Book the studio 📅 2026-10-01"].join("\n")),
  "Tasks/Recording and editing.md": T(
    'type: task\ngoal: "[[🚀 Launch the app]]"\nstatus: active\nstart: 2026-08-10\nend: 2026-10-20\ncompleted:\ntags:\n  - task',
    ["- [ ] Rough cut 📅 2026-09-18", "- [ ] Master it 📅 2026-10-05"].join("\n")),
  "Tasks/Convert a project.md": T(
    'type: task\ngoal: "[[🧠 Learn TypeScript]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-10-10\ncompleted:\ntags:\n  - task',
    ["- [x] Rename to .ts ✅ 2026-09-09", "- [ ] Fix the type errors 📅 2026-09-16"].join("\n")),
};

const SHOTS = [
  { name: "panel",  src: PANEL, cur: "Goals/🚀 Launch the app.md", wrap: "", width: 900 },
  { name: "paused", src: PANEL, cur: "Goals/📖 Read 24 books.md",      wrap: "", width: 900 },
  { name: "goals",  src: GOALS, cur: "Goals/🎯 Goals.md",              wrap: "dashboard", width: 980 },
];

(async () => {
  for (const v of SHOTS) {
    for (const open of [false, true]) {
      for (const theme of ["dark", "light"]) {
        await withPage(async (page) => {
          await page.setViewportSize({ width: v.width, height: 900 });
          await page.evaluate(({ CSS, theme }) => {
            document.body.className = theme === "light" ? "theme-light" : "theme-dark";
            document.body.style.background = theme === "light" ? "#fff" : "#0a0d11";
            document.body.style.margin = "0";
            document.body.style.padding = "18px";
            document.body.style.fontFamily = "Inter, system-ui, sans-serif";
            const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
          }, { CSS, theme });
          await page.evaluate(async ({ files, src, cur, wrap, open }) => {
            const H = window.StormHarness;
            const app = H.mkVault(files, {}); window.app = app;
            const c = document.createElement("div");
            if (wrap) c.className = wrap;
            document.body.appendChild(c);
            await H.runBlock(src, H.mkDv(app, cur), app, c);
            const det = c.querySelector("details.goal-paused");
            if (det) det.setAttribute("open", "");
            if (open) {
              c.querySelectorAll(".addtaskbtn").forEach(b => b.dispatchEvent(new MouseEvent("click", { bubbles: true })));
              await new Promise(r => setTimeout(r, 60));
              /* a name half-typed, so the row is shown doing its job */
              c.querySelectorAll('[data-at="name"]').forEach(i => { i.value = "Record episode two"; });
            }
          }, { files, src: v.src, cur: v.cur, wrap: v.wrap, open });
          const out = path.join(__dirname, `addtask-${v.name}-${open ? "open" : "closed"}-${theme}.png`);
          await page.screenshot({ path: out, fullPage: true });
          console.log("wrote", out);
        }, { now: "2026-09-14T10:00:00" });
      }
    }
  }
})();
