/* Visual check for the paused state: renders the ⚡ Now card (dashboard), the 🎯 Goals
   index, a paused goal note's panel and a paused task's Timeline against the REAL
   the built vault's .obsidian/snippets/storm.css, dark and light.
     node tests/P/shot.js            → tests/P/shot-<view>-<theme>.png              */
const path = require("path");
const { withPage, extractBlocks, readFile } = require("../lib.js");

const B = require("../build.js");
const VAULT = B.VAULT(), COMMON = B.COMMON;
const CSS = readFile(`${VAULT}/.obsidian/snippets/storm.css`);
const DASH = extractBlocks(readFile(`${VAULT}/Dashboard.md`))[0];
const GOALS = extractBlocks(readFile(`${VAULT}/Goals/🎯 Goals.md`))[0];
const PANEL = readFile(`${VAULT}/_scripts/goal-panel.js`);
const GANTT = readFile(`${VAULT}/_scripts/task-gantt.js`);
const BOARD = extractBlocks(readFile(`${VAULT}/Tasks/📋 Tasks.md`))[0];

const T = (fm, subs) => `---\n${fm}\n---\n\n# Task\n\n## Sub-tasks\n${subs}\n\n## 🗒️ Notes\n- \n`;
const files = {
  "Dashboard.md": "---\ncssclasses:\n  - storm-home\ntags:\n  - dashboard\n---\n\n```dataviewjs\n```\n",
  "Goals/🎯 Goals.md": "---\ncssclasses:\n  - dashboard\ntags:\n  - dashboard\n---\n\n# 🎯 Goals\n",
  "Goals/🚀 Launch the app.md":
    "---\ntype: goal\nstatus: paused\npaused: 2026-06-15\narea: Product\ntarget: 2026-12-31\ntags:\n  - goal\n---\n\n# 🚀 Launch the app\n",
  "Goals/📖 Read 24 books.md":
    "---\ntype: goal\nstatus: paused\npaused: 2026-08-30\narea: Reading\ntarget: 2026-12-31\ntags:\n  - goal\n---\n\n# 📖 Read 24 books\n",
  "Goals/🧠 Learn TypeScript.md":
    "---\ntype: goal\nstatus: active\narea: Learning\ntarget: 2026-12-31\ntags:\n  - goal\n---\n\n# 🧠 Learn TypeScript\n",
  "Goals/🏠 Home organization.md":
    "---\ntype: goal\nstatus: active\narea: Home\ntarget: 2026-10-05\ntags:\n  - goal\n---\n\n# 🏠 Home organization\n",
  "Tasks/Design pass.md": T(
    'type: task\ngoal: "[[🚀 Launch the app]]"\nstatus: active\nstart: 2026-08-01\nend: 2026-10-15\ncompleted:\ntags:\n  - task',
    ["- [x] Outline the arc 📅 2026-09-02 ✅ 2026-09-13",
     "- [ ] Confirm the guest 📅 2026-09-05",
     "- [ ] Write the questions 📅 2026-09-13",
     "- [ ] Book the studio 📅 2026-10-01"].join("\n")),
  "Tasks/Recording and editing.md": T(
    'type: task\ngoal: "[[🚀 Launch the app]]"\nstatus: active\nstart: 2026-08-10\nend: 2026-10-20\ncompleted:\ntags:\n  - task',
    ["- [ ] Rough cut 📅 2026-09-08", "- [ ] Mix the episode 📅 2026-09-13", "- [ ] Master it 📅 2026-10-05"].join("\n")),
  "Tasks/Convert a project.md": T(
    'type: task\ngoal: "[[🧠 Learn TypeScript]]"\nstatus: active\nstart: 2026-09-01\nend: 2026-10-10\ncompleted:\ntags:\n  - task',
    ["- [x] Rename to .ts ✅ 2026-09-09", "- [ ] Fix the type errors 📅 2026-09-11",
     "- [ ] Enable strict mode 📅 2026-09-13", "- [ ] Delete the shims 📅 2026-10-02"].join("\n")),
  "Tasks/Type the API.md": T(
    'type: task\ngoal: "[[🧠 Learn TypeScript]]"\nstatus: paused\npaused: 2026-08-01\nstart: 2026-09-02\nend: 2026-10-12\ncompleted:\ntags:\n  - task',
    ["- [ ] Write the request types 📅 2026-09-04", "- [ ] Write the response types 📅 2026-09-13"].join("\n")),
  "Tasks/Declutter the office.md": T(
    'type: task\ngoal: "[[🏠 Home organization]]"\nstatus: active\nstart: 2026-09-03\nend: 2026-09-25\ncompleted:\ntags:\n  - task',
    ["- [ ] Empty the desk drawers 📅 2026-09-12", "- [ ] Shred the paperwork 📅 2026-09-20"].join("\n")),
  "Daily/2026-09-13 Sunday.md":
    "---\ndate: 2026-09-13\ntags:\n  - daily\n---\n\n# Sunday, September 13\n\n## 🎯 One thing\n\n→ Ship the gallery\n\n" +
    "## ⚡ Tasks\n\n- [ ] Chase the studio invoice\n\n## 🌙 Shutdown\n**Win of the day:** \n",
};

const VIEWS = [
  { name: "now",    src: DASH,  cur: "Dashboard.md",           wrap: "storm-hub", width: 1180, crop: ".nowcard" },
  { name: "goals",  src: GOALS, cur: "Goals/🎯 Goals.md",       wrap: "dashboard", width: 980 },
  { name: "panel",  src: PANEL, cur: "Goals/🚀 Launch the app.md", wrap: "", width: 900, openBar: ".resumebtn" },
  { name: "gantt",  src: GANTT, cur: "Tasks/Type the API.md",   wrap: "", width: 900 },
  { name: "live",   src: PANEL, cur: "Goals/🏠 Home organization.md", wrap: "", width: 900 },
  { name: "board",  src: BOARD, cur: "Tasks/📋 Tasks.md",      wrap: "dashboard", width: 1180 },
];

(async () => {
  for (const v of VIEWS) {
    for (const theme of ["dark", "light"]) {
      await withPage(async (page) => {
        await page.setViewportSize({ width: v.width, height: 1000 });
        await page.evaluate(({ CSS, theme }) => {
          document.body.className = theme === "light" ? "theme-light" : "theme-dark";
          document.body.style.background = theme === "light" ? "#fff" : "#0a0d11";
          document.body.style.margin = "0";
          document.body.style.padding = "18px";
          document.body.style.fontFamily = "Inter, system-ui, sans-serif";
          const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
        }, { CSS, theme });
        await page.evaluate(async ({ files, src, cur, wrap, openBar }) => {
          const H = window.StormHarness;
          const app = H.mkVault(files, {}); window.app = app;
          const dv = H.mkDv(app, cur);
          const c = document.createElement("div");
          if (wrap) c.className = wrap;
          document.body.appendChild(c);
          await H.runBlock(src, dv, app, c);
          if (openBar) {
            const b = c.querySelector(openBar);
            if (b) b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            await new Promise(r => setTimeout(r, 40));
          }
          const det = c.querySelector("details.goal-paused");
          if (det) { window.__collapsed = det.outerHTML.length; }
        }, { files, src: v.src, cur: v.cur, wrap: v.wrap, openBar: v.openBar || "" });
        const target = v.crop ? await page.$(v.crop) : null;
        const out = path.join(__dirname, `shot-${v.name}-${theme}.png`);
        if (target) await target.screenshot({ path: out });
        else await page.screenshot({ path: out, fullPage: true });
        console.log("wrote", out);
      }, { now: "2026-09-13T10:00:00" });
    }
  }
  /* the Goals index again, with the Paused group expanded */
  for (const theme of ["dark", "light"]) {
    await withPage(async (page) => {
      await page.setViewportSize({ width: 980, height: 1000 });
      await page.evaluate(({ CSS, theme }) => {
        document.body.className = theme === "light" ? "theme-light" : "theme-dark";
        document.body.style.background = theme === "light" ? "#fff" : "#0a0d11";
        document.body.style.margin = "0"; document.body.style.padding = "18px";
        document.body.style.fontFamily = "Inter, system-ui, sans-serif";
        const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
      }, { CSS, theme });
      await page.evaluate(async ({ files, src }) => {
        const H = window.StormHarness;
        const app = H.mkVault(files, {}); window.app = app;
        const c = document.createElement("div"); c.className = "dashboard"; document.body.appendChild(c);
        await H.runBlock(src, H.mkDv(app, "Goals/🎯 Goals.md"), app, c);
        const det = c.querySelector("details.goal-paused");
        if (det) det.setAttribute("open", "");
        const btn = det && det.querySelector(".resumebtn");
        if (btn) btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await new Promise(r => setTimeout(r, 40));
      }, { files, src: GOALS });
      const out = path.join(__dirname, `shot-goals-open-${theme}.png`);
      await page.screenshot({ path: out, fullPage: true });
      console.log("wrote", out);
    }, { now: "2026-09-13T10:00:00" });
  }
})();
