/* HEALTH contract — look at the badge. Renders the contract's own "Lecture Pipeline"
   fixture against the REAL shipped storm.css, on the four dates of the worked cases,
   plus the goal note that rolls it up.
     node tests/H/shot.js   → tests/H/shot-<view>-<date>-<theme>.png                */
const path = require("path");
const { withPage, extractBlocks, readFile } = require("../lib.js");
const F = require("./fixtures.js");

const B = require("../build.js");
const VAULT = B.VAULT(), COMMON = B.COMMON;
const CSS = readFile(`${VAULT}/.obsidian/snippets/storm.css`);
const GOALS = extractBlocks(readFile(`${VAULT}/Goals/🎯 Goals.md`))[0];
const BOARD = extractBlocks(readFile(`${VAULT}/Tasks/📋 Tasks.md`))[0];
const files = F.files();

const VIEWS = [
  { name: "task",  src: F.GANTT, cur: F.LECTURE,        wrap: "",          width: 900 },
  { name: "goal",  src: F.PANEL, cur: F.LECTURE_GOAL,   wrap: "",          width: 900 },
  { name: "index", src: GOALS,   cur: "Goals/🎯 Goals.md", wrap: "dashboard", width: 980 },
  { name: "board", src: BOARD,   cur: "Tasks/📋 Tasks.md", wrap: "dashboard", width: 980 },
];
const DATES = ["2026-09-14", "2026-09-16", "2026-09-18", "2026-09-21"];

(async () => {
  for (const v of VIEWS) {
    for (const date of DATES) {
      for (const theme of ["dark", "light"]) {
        await withPage(async (page) => {
          await page.setViewportSize({ width: v.width, height: 700 });
          await page.evaluate(({ CSS, theme }) => {
            document.body.className = theme === "light" ? "theme-light" : "theme-dark";
            document.body.style.background = theme === "light" ? "#fff" : "#0a0d11";
            document.body.style.margin = "0";
            document.body.style.padding = "18px";
            document.body.style.fontFamily = "Inter, system-ui, sans-serif";
            const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
          }, { CSS, theme });
          await page.evaluate(async ({ files, src, cur, wrap }) => {
            const H = window.StormHarness;
            const app = H.mkVault(JSON.parse(JSON.stringify(files)), { createDaily: () => {} });
            window.app = app;
            const c = document.createElement("div");
            if (wrap) c.className = wrap;
            document.body.appendChild(c);
            await H.runBlock(src, H.mkDv(app, cur), app, c);
          }, { files, src: v.src, cur: v.cur, wrap: v.wrap });
          const out = path.join(__dirname, `shot-${v.name}-${date}-${theme}.png`);
          await page.screenshot({ path: out, fullPage: true });
          console.log("wrote", out);
        }, { now: date + "T10:00:00" });
      }
    }
  }
})();
