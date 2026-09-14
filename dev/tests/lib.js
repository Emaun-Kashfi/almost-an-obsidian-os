/* Node-side helper: launch chromium with the harness loaded. Usage:
     const { withPage, extractBlocks, readFile } = require("../lib.js");
     await withPage(async (page) => { ... await page.evaluate(...) ... });

   Playwright is a devDependency of dev/package.json, so `require("playwright")`
   resolves from dev/node_modules wherever the repo is cloned. The browser itself
   comes from `npx playwright install chromium` (npm's postinstall does it) — see
   chromiumExecutable() below for the one case where it does not.
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const HARNESS = fs.readFileSync(path.join(__dirname, "harness.js"), "utf8");

/* Which chrome binary to drive.

   Normally: none of our business. `npx playwright install chromium` puts the exact
   build this Playwright version expects where Playwright looks, and launch() finds
   it. That is the path a clean clone takes, and chromiumExecutable() returns
   undefined so Playwright decides.

   The exception is a machine that pre-seeds PLAYWRIGHT_BROWSERS_PATH with a
   DIFFERENT chromium revision than this Playwright pins (sandboxes and CI images
   do this, and cannot download). Playwright refuses to launch that one by itself,
   so we find it and pass it explicitly rather than let the whole suite skip.
   STORM_CHROMIUM=<path> overrides everything. */
function chromiumExecutable() {
  if (process.env.STORM_CHROMIUM) return process.env.STORM_CHROMIUM;
  try {
    const own = chromium.executablePath();
    if (own && fs.existsSync(own)) return undefined;        // the normal case
  } catch (e) { /* fall through to the search */ }

  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const candidates = [];
  if (base && fs.existsSync(base)) {
    for (const d of fs.readdirSync(base)) {
      if (!/^chromium(_headless_shell)?-\d+$/.test(d)) continue;
      for (const rel of ["chrome-linux/chrome", "chrome-linux/headless_shell",
                         "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
                         "chrome-win/chrome.exe"]) {
        const p = path.join(base, d, rel);
        if (fs.existsSync(p)) candidates.push(p);
      }
    }
  }
  /* prefer a full chromium build over a headless shell, then the newest revision */
  if (candidates.length) {
    const rank = p => (/_headless_shell-/.test(p) ? 0 : 1) * 1e9 + (+(p.match(/-(\d+)[\\/]/) || [0, 0])[1]);
    return candidates.sort((a, b) => rank(b) - rank(a))[0];
  }

  throw new Error(
    "no chromium for Playwright.\n" +
    "  Run `npm --prefix dev install` (its postinstall downloads one), or\n" +
    "  `npx playwright install chromium`, or point STORM_CHROMIUM at a chrome binary.\n" +
    "  Refusing to run: a browser suite that quietly skips is worse than one that fails.");
}

async function withPage(fn, opts = {}) {
  const browser = await chromium.launch({ executablePath: chromiumExecutable(), args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (opts.echoConsole || m.type() === "error") console.log("[page." + m.type() + "]", m.text()); });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body class="theme-dark"></body></html>`);
  await page.addScriptTag({ content: HARNESS });
  await page.evaluate((now) => window.StormHarness.setNow(now), opts.now || "2026-09-12T10:00:00");
  // `require("obsidian")` shim inside blocks
  await page.evaluate(() => {
    window.__notices = [];
    window.require = (m) => { if (m === "obsidian") return { Notice: class { constructor(msg) { window.__notices.push(String(msg)); } }, Modal: class { constructor(){} open(){} close(){} }, MarkdownView: class {} }; throw new Error("no module " + m); };
  });
  try { const r = await fn(page, errors); if (errors.length) { console.log("PAGE ERRORS:\n" + errors.join("\n")); } return r; }
  finally { await browser.close(); }
}
function extractBlocks(md) { const out = []; const re = /```dataviewjs\n([\s\S]*?)\n```/g; let m; while ((m = re.exec(md))) out.push(m[1]); return out; }
function readFile(p) { return fs.readFileSync(p, "utf8"); }
function assert(cond, msg) { if (!cond) { console.log("FAIL: " + msg); process.exitCode = 1; } else console.log("ok  - " + msg); }
module.exports = { withPage, extractBlocks, readFile, assert, chromiumExecutable };
