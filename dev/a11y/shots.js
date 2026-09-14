/* ═══════════════════════════════════════════════════════════════════════════
   a11y/shots.js — PNGs of the worst offenders, so the fixes can be judged by
   eye rather than only by ratio.

     node shots.js                → shots/*.png (plain + annotated pairs)
     node audit.js --shots        → the same, after the audit run

   Each entry is rendered exactly the way audit.js renders it. The `-marked`
   copy outlines every element the audit failed and prints its ratio, so it is
   obvious WHICH pixels the number is talking about.
   ═══════════════════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs");
const path = require("path");
const { withPage, extractBlocks, readFile } = require("../tests/lib.js");
const FX = require("./fixtures.js");
const PAL = require("./palettes.js");

const HERE = __dirname;
const OUT = path.join(HERE, "shots");
const PROBE = fs.readFileSync(path.join(HERE, "probe.js"), "utf8");
const NOW = "2026-09-13T10:00:00";

const GRAPHICS = require("./graphics.js");
const { stripThemeKeys } = require("./audit-surfaces.js");
const VAULT = require("../paths.js").DEFAULT_VARIANT;

/* the shot list — one per root cause worth looking at.
   After CONTRACT §C every one of these is clean; each note says what the shot
   used to show and what it shows now, so the pair in `shots-before/` reads as a
   before/after. */
const SHOTS = [
  { name: "01-banner-eink-light", vault: VAULT, surface: "dashboard", palette: "static-light", crop: ".banner", note: "F1 · was an invisible white-on-white greeting (1.07:1); now black clock, dark greeting, grey date on the e-ink white ground" },
  { name: "04-gantt-dark", vault: VAULT, surface: "gantt-ok", palette: "static-dark", note: "F2 + F4 · brighter --faint axis labels and due dates, and sub-task checkboxes that are actually outlined (was 1.56:1)" },
  { name: "05-gantt-behind-dark", vault: VAULT, surface: "gantt-behind", palette: "static-dark", note: "overdue bars + --warm labels" },
  { name: "06-dashboard-dark", vault: VAULT, surface: "dashboard", palette: "static-dark", note: "F2 + F12 + F15 · card headings, strip labels and the Settings-style controls across the hub" },
  { name: "07-goals-index-dark", vault: VAULT, surface: "goals", palette: "static-dark", note: "F3 · paused and done cards are marked by a dashed edge and a flattened ground instead of opacity:.62" },
  { name: "08-board-dark", vault: VAULT, surface: "board", palette: "static-dark", note: "F2 + F3 · column meta at the lifted --faint; paused cards dashed rather than dimmed" },
  { name: "09-match-verylight", vault: VAULT, surface: "gantt-ok", palette: "match-verylight", note: "a light derived palette: accent-deep bars (F11), inside dates" },
  { name: "10-match-verydark", vault: VAULT, surface: "panel-ok", palette: "match-verydark", note: "F7 · the progress split is a crisp two-tone bar with a --surface divider (was a 1.01:1 wash)" },
  { name: "11-community-dark", vault: VAULT, surface: "gantt-ok", palette: "community-dark", note: "F12 · --faint now maps to Obsidian --text-muted, not the decorative --text-faint #666" },
  { name: "15-settings-dark", vault: VAULT, surface: "settings", palette: "static-dark", note: "F15 + F17 · the segmented control's fill and the banner caption scrim" },
  { name: "18-gantt-light", vault: VAULT, surface: "gantt-ok", palette: "static-light", note: "the e-ink Timeline — clean before and after, deliberately untouched" },
  { name: "19-shipped-dashboard", vault: VAULT, surface: "dashboard-shipped", palette: "static-dark", note: "the Dashboard exactly as the vault ships it, with whatever theme mode its frontmatter selects" },
  { name: "22-goalpanel-done-light", vault: VAULT, surface: "panel-done", palette: "static-light", note: "F7 in e-ink · a fully completed bar stays visible because the white fill is outlined" },
  { name: "23-goals-index-light", vault: VAULT, surface: "goals", palette: "static-light", note: "F3 + F14 in e-ink · paused/done cards marked by dashed edges and a grey ground, no opacity" },
];

/* draws the outline + ratio label over every failing element, INSIDE the mount
   so an element-cropped screenshot keeps them */
function markOverlay(rows) {
  const mount = document.getElementById("__mount");
  const mb = mount.getBoundingClientRect();
  const cs = getComputedStyle(mount);
  if (cs.position === "static") mount.style.position = "relative";
  const box = document.createElement("div");
  box.id = "__marks";
  box.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:99999";
  mount.appendChild(box);
  for (const r of rows) {
    if (!r.rect) continue;
    const d = document.createElement("div");
    d.style.cssText = "position:absolute;outline:2px solid #ff00d0;outline-offset:1px;border-radius:2px;"
      + "left:" + (r.rect.x - mb.left) + "px;top:" + (r.rect.y - mb.top) + "px;"
      + "width:" + r.rect.w + "px;height:" + r.rect.h + "px";
    const t = document.createElement("span");
    t.textContent = r.ratio + "";
    t.style.cssText = "position:absolute;left:0;top:-11px;font:700 9px/1 ui-monospace,monospace;"
      + "color:#fff;background:#ff00d0;padding:1px 2px;border-radius:3px;white-space:nowrap";
    d.appendChild(t); box.appendChild(d);
  }
}

function blockOf(files, spec) {
  const [p, i] = spec;
  for (const cand of [p, p + ".js", p + "/view.js", p + ".txt", p + ".md"]) {
    const t = files[cand];
    if (t == null) continue;
    if (/\.js$/.test(cand)) return t;
    const b = extractBlocks(t);
    if (b[i || 0]) return b[i || 0];
  }
  return null;
}

async function run(VAULTS) {
  fs.mkdirSync(OUT, { recursive: true });
  const written = [];
  for (const vk of Object.keys(VAULTS)) {
    const list = SHOTS.filter(s => s.vault === vk);
    if (!list.length) continue;
    const V = VAULTS[vk];
    const CSS = readFile(V.css);
    const VFILES = V.files;          /* read the vault ONCE (V.files is a getter) */
    const matrix = PAL.matrix(vk);
    await withPage(async (page) => {
      await page.addStyleTag({ content: CSS });
      await page.addScriptTag({ content: PROBE });
      for (const shot of list) {
        const s = V.surfaces.find(x => x.key === shot.surface);
        const m = matrix.find(x => x.key === shot.palette);
        if (!s || !m) { console.log("  ! no such surface/palette for " + shot.name); continue; }
        const src = blockOf(VFILES, s.src);
        if (!src) { console.log("  ! no block for " + shot.name); continue; }
        await page.setViewportSize({ width: s.width || 1000, height: s.height || 1400 });
        const rows = await page.evaluate(async (c) => {
          document.body.className = c.body;
          document.body.style.cssText = "margin:0;padding:18px;background:" + c.ground +
            ";font-family:Inter,system-ui,sans-serif;min-height:100vh";
          const old = document.getElementById("__pal"); if (old) old.remove();
          const om = document.getElementById("__marks"); if (om) om.remove();
          if (c.paletteCss) { const st = document.createElement("style"); st.id = "__pal"; st.textContent = c.paletteCss; document.head.appendChild(st); }
          const prev = document.getElementById("__mount"); if (prev) prev.remove();
          const mount = document.createElement("div"); mount.id = "__mount";
          if (c.wrap) mount.className = c.wrap;
          document.body.appendChild(mount);
          const H = window.StormHarness;
          const app = H.mkVault(c.files, {}); window.app = app;
          const dv = H.mkDv(app, c.cur);
          dv.view = async function (p, input) {
            const s2 = c.files[p + ".js"] != null ? c.files[p + ".js"] : (c.files[p + "/view.js"] != null ? c.files[p + "/view.js"] : c.files[p]);
            if (s2 == null) return;
            const fn = new Function("dv", "app", "input", "return (async()=>{" + s2 + "\n})()");
            await fn.call({ container: dv.container }, dv, app, input);
          };
          try { await H.runBlock(c.src, dv, app, mount); } catch (e) { }
          await new Promise(r => setTimeout(r, 150));
          if (c.open === "details") mount.querySelectorAll("details").forEach(d => d.setAttribute("open", ""));
          if (c.open) { const b = mount.querySelector(".resumebtn, .pausebtn"); if (b) { b.dispatchEvent(new MouseEvent("click", { bubbles: true })); await new Promise(r => setTimeout(r, 60)); } }
          if (c.focus) { const f = mount.querySelector(c.focus); if (f) { f.focus(); await new Promise(r => setTimeout(r, 30)); } }
          return window.__A11Y.scan(mount, { graphics: c.graphics }).filter(x => !x.pass)
            .map(x => ({ ratio: x.ratio, threshold: x.threshold, path: x.path, rect: x.rect }));
        }, {
          files: s.stripTheme ? stripThemeKeys(VFILES, s.cur) : VFILES, src, cur: s.cur, wrap: s.wrap, body: m.body, ground: m.ground,
          paletteCss: m.css, open: s.open || "", focus: s.focus || "", graphics: GRAPHICS,
        });
        const marks = rows.filter(r => r.rect && r.rect.w > 0);

        const plain = path.join(OUT, shot.name + ".png");
        const el = shot.crop ? await page.$("#__mount " + shot.crop) : await page.$("#__mount");
        if (el) await el.screenshot({ path: plain }); else await page.screenshot({ path: plain, fullPage: true });
        written.push(plain);

        await page.evaluate(markOverlay, marks);
        const marked = path.join(OUT, shot.name + "-marked.png");
        const el2 = shot.crop ? await page.$("#__mount " + shot.crop) : await page.$("#__mount");
        if (el2) await el2.screenshot({ path: marked }); else await page.screenshot({ path: marked, fullPage: true });
        await page.evaluate(() => { const b = document.getElementById("__marks"); if (b) b.remove(); });
        written.push(marked);
        console.log("  shot " + shot.name + "  (" + rows.length + " failures) — " + shot.note);
      }
    }, { now: NOW });
  }
  /* an index so the next agent knows what each PNG shows */
  fs.writeFileSync(path.join(OUT, "INDEX.md"),
    "# a11y/shots\n\nRendered by `node a11y/shots.js` (or `node a11y/audit.js --shots`).\n" +
    "Each `-marked` copy outlines the elements the audit failed and prints the ratio.\n\n" +
    SHOTS.map(s => `- **${s.name}.png** — ${s.surface} · ${s.palette}: ${s.note}`).join("\n") + "\n");
  return written;
}

module.exports = { run, SHOTS };

if (require.main === module) {
  const A = require("./audit-surfaces.js");
  run(A.VAULTS).then(w => console.log("wrote " + w.length + " files to " + OUT)).catch(e => { console.error(e); process.exit(2); });
}
