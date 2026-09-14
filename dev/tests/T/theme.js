/* ═══════════════════════════════════════════════════════════════════════════
   CONTRACT §B — suite T: the theme must apply to the WHOLE vault.

   The bug this pins down: `_themeRule(t)` scoped every palette declaration to
   `body:not(.theme-light) .storm-hub` and shipped it as a `<style>` inside the
   Dashboard note's own output, so a palette derived from the banner image died
   at the edge of the Dashboard — goal notes, task notes, 🎯 Goals, 📋 Tasks,
   🧹 Triage and the daily tables all kept the hardcoded blue.

   What is asserted here, in order:
     1. every palette literal in the SHIPPED stylesheet is now
        `var(--storm-<name>, <the same literal>)` — the fallback is unchanged,
        so a vault with no theme file looks exactly as it did (and every §C
        accessibility value survives verbatim);
     2. `_themeFileCss()` renders a real snippet: `--storm-*` on <body>, a
        `body.theme-light` block only where the palette is light or community,
        the community mapping lifted from `_themeRule` rather than re-derived,
        and byte-stable across calls (no timestamp → the write can be skipped);
     3. THE POINT — with a match-mode storm-theme.css present, the computed
        accent on a goal note, a task note and 📋 Tasks equals the THEMED accent
        and no default-blue token survives anywhere on those surfaces;
     4. the Dashboard writes exactly one file, into .obsidian/snippets, skips
        the write when nothing changed, turns the snippet on through Obsidian's
        own API, falls back to a Notice when that API is missing, and never
        touches the user's appearance.json;
     5. the build ships the snippet, and enables it only in a vault created from
        scratch.

   `../W/palettes.js` and `../W/fixtures.js` are reused on purpose: the palettes
   come from the REAL generators and the notes from the REAL shipped vault, so a
   pass here cannot be an artefact of a fixture written to suit the test.
   ═══════════════════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs");
const path = require("path");
const B = require("../build.js");
const A = path.join(__dirname, "..", "..", "a11y");
const PAL = require(path.join(A, "palettes.js"));
const FX = require(path.join(A, "fixtures.js"));
const { withPage, extractBlocks, readFile, assert } = require(path.join(__dirname, "..", "lib.js"));

const S = PAL.S;                                  // the shipped helpers, loaded as-is
const VARIANT = B.VARIANT;
const VDIR = B.VAULT();
const SHEET = VDIR + "/.obsidian/snippets/storm.css";
const THEME_FILE = VDIR + "/.obsidian/snippets/storm-theme.css";
const NOW = "2026-09-13T10:00:00";

/* the 19 palette tokens, and the DEFAULT dark literal each one must still carry
   as its var() fallback. Pinned by hand: this list is the §C accessibility work,
   and §B is only allowed to move it behind an indirection, never to change it. */
const DEFAULT_DARK = {
  "bg": "#0a0d11", "surface": "#141b23", "surface2": "#1a222c", "track": "#0f161d",
  "border": "rgba(126,158,186,.14)", "border2": "rgba(126,158,186,.26)",
  "text": "#e8eff6", "dim": "#9db0c1", "faint": "#8899a9",
  "accent": "#5ec8e8", "accent2": "#a7e9fb", "accent-deep": "#2b8fb5",
  "glow": "rgba(94,200,232,.45)", "btn": "linear-gradient(180deg,#297893,#22718e)",
  "on-accent": "#eafaff", "accent-rgb": "94,200,232", "warm": "#e0a458", "good": "#63d3b0",
};
/* the blues that must NOT survive on a themed surface */
const DEFAULT_BLUES = ["rgb(94, 200, 232)", "rgb(167, 233, 251)", "rgb(43, 143, 181)"];

const SURFACES = [
  { key: "goal note", sel: ".goalpanel", src: ["_scripts/goal-panel.js"], cur: "Goals/AX On track.md", wrap: "" },
  { key: "task note · Timeline", sel: ".tgantt", src: ["_scripts/task-gantt.js"], cur: "Tasks/AX ok task.md", wrap: "" },
  { key: "📋 Tasks", sel: ".tasksboard", src: ["Tasks/📋 Tasks.md", 0], cur: "Tasks/📋 Tasks.md", wrap: "dashboard" },
];

const FILES = FX.files();
function blockOf(spec) {
  const [p, i] = spec;
  const t = FILES[p];
  if (t == null) throw new Error("suite T: no such vault file " + p);
  return /\.js$/.test(p) ? t : extractBlocks(t)[i || 0];
}

/* ══ 1. the stylesheet indirection ═══════════════════════════════════════ */
const sheet = readFile(SHEET);
let missing = [], changed = [];
for (const tok of Object.keys(DEFAULT_DARK)) {
  const want = "--" + tok + ":var(--storm-" + tok + "," + DEFAULT_DARK[tok] + ")";
  if (sheet.indexOf("var(--storm-" + tok + ",") < 0) missing.push(tok);
  else if (sheet.indexOf(want) < 0) changed.push(tok);
}
assert(!missing.length, "every palette token reads var(--storm-*) in the shipped storm.css" +
  (missing.length ? " — missing: " + missing.join(", ") : ""));
assert(!changed.length, "every var(--storm-*) keeps its §C default as the fallback, byte for byte" +
  (changed.length ? " — moved: " + changed.join(", ") : ""));
/* a bare literal left in a palette block is a root the theme can never reach */
/* `(?=\S)` pins the whitespace run so `\s*` cannot backtrack past the lookahead */
const BARE = new RegExp("(^|[\\s;{])--(" + Object.keys(DEFAULT_DARK).join("|").replace(/-/g, "\\-") +
  "|behind)\\s*:\\s*(?=\\S)(?!var\\(--storm-)", "m");
{
  const lines = sheet.split("\n");
  const bad = [];
  for (let i = 0; i < lines.length; i++) if (BARE.test(lines[i])) bad.push((i + 1) + ": " + lines[i].trim().slice(0, 70));
  assert(!bad.length, "no palette block declares a bare literal any more" + (bad.length ? ":\n      " + bad.join("\n      ") : ""));
}

/* ══ 2. the generated snippet ════════════════════════════════════════════ */
const MP = PAL.matchPalettes();
const DARKPAL = MP["match-verydark"];             // a cold night photo  → dark palette
const LIGHTPAL = MP["match-verylight"];           // a warm sand banner  → light palette
assert(DARKPAL.mode === "dark", "the cold banner fixture derives a DARK palette (" + DARKPAL.accent + ")");
assert(LIGHTPAL.mode === "light", "the warm banner fixture derives a LIGHT palette (" + LIGHTPAL.accent + ")");

const darkCss = S._themeFileCss(DARKPAL);
const lightCss = S._themeFileCss(LIGHTPAL);
const commCss = S._themeFileCss({ mode: "community" });

assert(darkCss === S._themeFileCss(DARKPAL),
  "_themeFileCss is byte-stable for the same palette — the Dashboard can skip an unchanged write");
assert(/^\/\*[\s\S]*?\*\/\nbody:not\(\.theme-light\)\{/.test(darkCss),
  "the file opens with a comment header, then body:not(.theme-light){…}");
for (const v of PAL.STORM_VARS) {
  if (darkCss.indexOf("--storm-" + v + ":") < 0) { assert(false, "the generated file defines --storm-" + v); break; }
}
assert(PAL.STORM_VARS.every(v => darkCss.indexOf("--storm-" + v + ":") >= 0),
  "the generated file defines all " + PAL.STORM_VARS.length + " --storm-* tokens, --behind included (§C F13)");
assert(darkCss.indexOf("--storm-accent:" + DARKPAL.accent) >= 0,
  "the generated file carries the derived accent " + DARKPAL.accent);
assert(darkCss.indexOf("body.theme-light{") < 0,
  "a DARK palette is emitted for body:not(.theme-light) only — Obsidian's light mode keeps the e-ink palette");
assert(lightCss.indexOf("body.theme-light{") >= 0,
  "a LIGHT palette also gets a body.theme-light block, or the e-ink override would throw it away");
assert(lightCss.split("--storm-accent:" + LIGHTPAL.accent).length === 3,
  "the light palette's accent appears in both blocks");
assert(/body:not\(\.theme-light\) \.storm-hub \.heat \.c\.i1\{background:rgba\(/.test(darkCss),
  "the habit heatmap ramp is re-tinted from the matched accent");
assert(darkCss.indexOf(".storm-home .view-content{background:" + DARKPAL.bg + " !important;}") >= 0 ||
  darkCss.indexOf("{background:" + DARKPAL.bg + " !important;}") >= 0,
  "the Dashboard page background follows the palette");
/* the community mapping must be the SAME object _themeRule uses — a second copy
   is how the product and the audit drifted apart in §C F12 */
{
  const rule = S._themeRule({ mode: "community" });
  const m = /body:not\(\.theme-light\) \.storm-hub\{([^}]*)\}/.exec(rule);
  const pairs = m[1].split(";").map(d => d.slice(0, d.indexOf(":")) + "|" + d.slice(d.indexOf(":") + 1));
  const bad = pairs.filter(p => {
    const [k, v] = p.split("|");
    return commCss.indexOf("--storm-" + k.slice(2) + ":" + v) < 0;
  });
  assert(!bad.length, "the community theme file maps all " + pairs.length +
    " tokens exactly as _themeRule does" + (bad.length ? " — differs on " + bad.join(", ") : ""));
  assert(commCss.indexOf("body.theme-light{") >= 0,
    "community mode is emitted for light AND dark — its values follow the installed theme");
}
/* a palette can also arrive from a CACHE (`stormTheme:` in the frontmatter) that
   an older build wrote — this vault ships one that predates the §C floors. §B
   spreads that cache across the whole vault, so it is re-floored on the way in.
   A palette straight from the generator must come through untouched. */
{
  const gen = [DARKPAL, LIGHTPAL, MP["match-saturated"], MP["match-neargrey"]];
  const moved = [];
  for (const t of gen) { const n = S._normalizeTheme(t); for (const k of Object.keys(t)) if (t[k] !== n[k]) moved.push((t.__source || t.mode) + "." + k); }
  assert(!moved.length, "_normalizeTheme passes a freshly generated palette through untouched" +
    (moved.length ? " — moved " + moved.join(", ") : ""));
}
{
  /* a palette written into a Dashboard's frontmatter by a build that predates §C */
  const stale = {
    bg: "#16140f", surface: "#231f17", surface2: "#2e291f", text: "#efeeeb", dim: "#c0bbaf",
    faint: "#a49d8e", accent: "#77add9", accent2: "#abcfed", accentDeep: "#2e70a8",
    warm: "#f4c27b", good: "#7dd4a8", mode: "dark",
  };
  const gnd = S._worstGround(stale.surface2, false);
  const n = S._normalizeTheme(stale);
  assert(S._contrast(stale.accentDeep, gnd) < 3 && S._contrast(n.accentDeep, gnd) >= 3,
    "a pre-§C cache is re-floored on the way in: --accent-deep " + stale.accentDeep + " (" +
    S._contrast(stale.accentDeep, gnd).toFixed(2) + ":1) → " + n.accentDeep + " (" + S._contrast(n.accentDeep, gnd).toFixed(2) + ":1)");
  assert(S._contrast(stale.faint, gnd) < 4.5 && S._contrast(n.faint, gnd) >= 4.5,
    "…and --faint " + stale.faint + " (" + S._contrast(stale.faint, gnd).toFixed(2) + ":1) → " +
    n.faint + " (" + S._contrast(n.faint, gnd).toFixed(2) + ":1)");
  assert(n.bg === stale.bg && n.surface === stale.surface && n.accent === stale.accent,
    "…while the grounds and the accent hue it was chosen for are left alone");
}

/* ══ 3-5. everything that needs a browser ════════════════════════════════ */
withPage(async (page) => {
  await page.addStyleTag({ content: sheet });
  const CSS = { none: "", dark: darkCss, light: lightCss };

  /* ---- 3. the colour actually changes on a note that is NOT the Dashboard ---- */
  const RUNS = [
    { theme: "none", body: "theme-dark", pal: null, label: "no theme file" },
    { theme: "dark", body: "theme-dark", pal: DARKPAL, label: "cold-dark image palette" },
    { theme: "light", body: "theme-dark", pal: LIGHTPAL, label: "warm-light image palette" },
    { theme: "light", body: "theme-light", pal: LIGHTPAL, label: "warm-light image palette · Obsidian light mode" },
  ];
  for (const s of SURFACES) {
    const src = blockOf(s.src);
    const seen = {};
    for (const run of RUNS) {
      const res = await page.evaluate(async (c) => {
        document.body.className = c.body;
        const old = document.getElementById("__theme"); if (old) old.remove();
        if (c.css) { const st = document.createElement("style"); st.id = "__theme"; st.textContent = c.css; document.head.appendChild(st); }
        const prev = document.getElementById("__mount"); if (prev) prev.remove();
        const mount = document.createElement("div"); mount.id = "__mount";
        if (c.wrap) mount.className = c.wrap;
        document.body.appendChild(mount);
        const H = window.StormHarness;
        const app = H.mkVault(c.files, {}); window.app = app;
        const dv = H.mkDv(app, c.cur);
        await H.runBlock(c.src, dv, app, mount);
        await new Promise(r => setTimeout(r, 60));
        const root = mount.querySelector(c.sel) || mount;
        const cs = getComputedStyle(root);
        const read = n => cs.getPropertyValue(n).trim();
        /* every colour actually painted in the subtree */
        const painted = new Set();
        for (const el of [root, ...root.querySelectorAll("*")]) {
          const s2 = getComputedStyle(el);
          painted.add(s2.color);
          const f = s2.fill; if (f && f !== "none") painted.add(f);
          const b = s2.backgroundColor; if (b && b !== "rgba(0, 0, 0, 0)") painted.add(b);
        }
        return {
          found: !!mount.querySelector(c.sel), n: root.querySelectorAll("*").length,
          accent: read("--accent"), accent2: read("--accent2"), deep: read("--accent-deep"),
          bg: read("--bg"), surface: read("--surface"), text: read("--text"),
          painted: [...painted],
        };
      }, { files: FILES, src, cur: s.cur, wrap: s.wrap, sel: s.sel, body: run.body, css: CSS[run.theme] });

      if (run === RUNS[0]) {
        assert(res.found, s.key + ": renders a " + s.sel + " root (" + res.n + " elements)");
        assert(res.accent === DEFAULT_DARK.accent,
          s.key + " · no theme file → --accent is the built-in " + DEFAULT_DARK.accent + " (got " + res.accent + ")");
        seen.base = res;
        continue;
      }
      const p = run.pal;
      assert(res.accent === p.accent,
        s.key + " · " + run.label + " → --accent is the THEMED " + p.accent + " (got " + res.accent + ")");
      assert(res.accent !== seen.base.accent,
        s.key + " · " + run.label + " → the accent differs from the untouched default");
      assert(res.accent2 === p.accent2 && res.deep === p.accentDeep && res.surface === p.surface && res.text === p.text,
        s.key + " · " + run.label + " → --accent2/--accent-deep/--surface/--text all follow the theme");
      const leftovers = DEFAULT_BLUES.filter(b => res.painted.indexOf(b) >= 0);
      assert(!leftovers.length,
        s.key + " · " + run.label + " → no default Storm blue is painted anywhere on the surface" +
        (leftovers.length ? " — still showing " + leftovers.join(", ") : ""));
    }
  }

  /* ---- 3b. THEME2 §A/§B — the PAGE and the LINKS, not just the panels ----
     A goal note, a task note, 📋 Tasks and a PLAIN note, each rendered in an
     Obsidian-shaped reading view whose grounds and link colours come from
     Obsidian's OWN variables, against the SAME Obsidian stand-in the audit uses
     (a11y/palettes.js obsidianBase — one copy, never a second derivation).
     Before §A that page stayed the installed theme's colour while the panels
     inside it painted with the palette, which is the bug the user reported. */
  const rgbOf = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return "rgb(" + c.join(", ") + ")"; };
  const varOf = (css, name) => { const m = new RegExp("--" + name + ":([^;!}]+)").exec(css.slice(css.indexOf("html "))); return m ? m[1].trim() : ""; };
  const PAGE_CSS =
    ".ax-page,.ax-page .markdown-reading-view,.ax-page .markdown-preview-view{background:var(--background-primary)}" +
    ".ax-page{color:var(--text-normal);padding:16px;font-size:16px}" +
    ".ax-page a.internal-link{color:var(--link-color)}" +
    ".ax-page a.internal-link.is-unresolved{color:var(--link-unresolved-color);opacity:var(--link-unresolved-opacity)}" +
    ".ax-page a.external-link{color:var(--link-external-color)}";
  const PAGE_HTML =
    '<div class="markdown-reading-view"><div class="markdown-preview-view" id="axpage">' +
    '<h1>A plain note</h1><p>Prose with <a class="internal-link" id="axr" href="#">a resolved link</a>, ' +
    '<a class="internal-link is-unresolved" id="axu" href="#">an unresolved one</a> and ' +
    '<a class="external-link" id="axe" href="#">an external one</a>.</p>' +
    '<div class="el-pre"><div class="block-language-dataviewjs" id="axblock"></div></div></div></div>';

  const PAGES = SURFACES.map(s => ({ key: s.key, src: blockOf(s.src), cur: s.cur, wrap: s.wrap }))
    .concat([{ key: "plain note", src: "", cur: SURFACES[0].cur, wrap: "" }]);

  for (const pg of PAGES) {
    const seen = {};
    for (const run of RUNS) {
      const res = await page.evaluate(async (c) => {
        document.body.className = c.body;
        for (const id of ["__theme", "__obs", "__pagecss"]) { const e = document.getElementById(id); if (e) e.remove(); }
        const add = (id, text) => { const st = document.createElement("style"); st.id = id; st.textContent = text; document.head.appendChild(st); };
        add("__obs", c.obs);                       /* Obsidian's own variables + link rules */
        add("__pagecss", c.pageCss);
        if (c.css) add("__theme", c.css);          /* …then the generated storm-theme.css */
        const prev = document.getElementById("__mount"); if (prev) prev.remove();
        const mount = document.createElement("div"); mount.id = "__mount"; mount.className = "ax-page";
        mount.innerHTML = c.html;
        document.body.appendChild(mount);
        if (c.src) {
          const H = window.StormHarness;
          const app = H.mkVault(c.files, {}); window.app = app;
          const dv = H.mkDv(app, c.cur);
          await H.runBlock(c.src, dv, app, document.getElementById("axblock"));
          await new Promise(r => setTimeout(r, 60));
        }
        const col = id => getComputedStyle(document.getElementById(id)).color;
        return {
          pageBg: getComputedStyle(document.getElementById("axpage")).backgroundColor,
          text: getComputedStyle(document.getElementById("axpage")).color,
          link: col("axr"), unresolved: col("axu"), external: col("axe"),
          panels: document.querySelectorAll("#axblock .goalpanel, #axblock .tgantt, #axblock .tasksboard").length,
        };
      }, {
        files: FILES, src: pg.src, cur: pg.cur, body: run.body, css: CSS[run.theme],
        html: PAGE_HTML, pageCss: PAGE_CSS, obs: PAL.obsidianBase(run.body === "theme-light"),
      });

      if (run === RUNS[0]) { seen.base = res; continue; }
      const p = run.pal, css = CSS[run.theme];
      assert(res.pageBg === rgbOf(p.bg),
        pg.key + " · " + run.label + " → the note surface is the THEMED background " + p.bg + " (got " + res.pageBg + ")");
      assert(res.pageBg !== seen.base.pageBg,
        pg.key + " · " + run.label + " → …and differs from the untouched default (" + seen.base.pageBg + ")");
      assert(res.text === rgbOf(p.text),
        pg.key + " · " + run.label + " → body text is the themed --text-normal " + p.text);
      const wantLink = varOf(css, "link-color"), wantGhost = varOf(css, "link-unresolved-color");
      assert(res.link === rgbOf(wantLink) && res.external === rgbOf(wantLink),
        pg.key + " · " + run.label + " → an internal AND an external link are the themed link colour " + wantLink +
        " (got " + res.link + " / " + res.external + ")");
      assert(res.link !== seen.base.link,
        pg.key + " · " + run.label + " → …not the accent Obsidian derives from the user's accentColor (" + seen.base.link + ")");
      assert(res.unresolved === rgbOf(wantGhost) && res.unresolved !== res.link,
        pg.key + " · " + run.label + " → an unresolved link stays visually distinct (" + wantGhost + " vs " + wantLink + ")");
      assert(S._contrast(wantLink, p.bg) >= 4.5 && S._contrast(wantGhost, p.bg) >= 4.5,
        pg.key + " · " + run.label + " → both link colours clear 4.5:1 on the page background (" +
        S._contrast(wantLink, p.bg).toFixed(2) + ":1 / " + S._contrast(wantGhost, p.bg).toFixed(2) + ":1)");
      if (pg.src) assert(res.panels >= 1, pg.key + " · " + run.label + " → …with the panel rendered inside that page");
    }
  }

  /* ---- 4. the Dashboard writes the snippet ---- */
  const dashMd = FILES["Dashboard.md"];
  const dashSrc = extractBlocks(dashMd)[0];
  /* the shipped Dashboard's cached palette is keyed to its banner file, so the
     banner has to exist for livedata to trust the cache (stormThemeSrc === path) */
  const DASH_FILES = Object.assign({}, FILES);
  const bannerFm = /^stormBanner:\s*(.+)$/m.exec(dashMd);
  if (bannerFm) DASH_FILES[bannerFm[1].trim()] = "<binary>";
  const USER_APPEARANCE = JSON.stringify(
    { accentColor: "#7f6df2", cssTheme: "Minimal", enabledCssSnippets: ["storm"], theme: "obsidian" }, null, 2) + "\n";
  const dash = await page.evaluate(async (c) => {
    document.body.className = "theme-dark";
    const H = window.StormHarness;
    const files = Object.assign({}, c.files);
    files[".obsidian/appearance.json"] = c.appearance;      // the user's own settings
    const app = H.mkVault(files, {}); window.app = app;
    window.__notices = [];
    const render = async () => {
      const prev = document.getElementById("__mount"); if (prev) prev.remove();
      const mount = document.createElement("div"); mount.id = "__mount"; mount.className = "storm-hub";
      document.body.appendChild(mount);
      const dv = H.mkDv(app, "Dashboard.md");
      await H.runBlock(c.src, dv, app, mount);
      await new Promise(r => setTimeout(r, 150));
      return mount;
    };
    const m1 = await render();
    const writes1 = app.__log.filter(l => l.op === "adapterWrite").map(l => l.path);
    const before = app.__log.length;
    await render();                    /* re-render: the theme has not changed */
    const writes2 = app.__log.slice(before).filter(l => l.op === "adapterWrite").map(l => l.path);
    const root = m1.querySelector(".storm-hub") || m1;
    return {
      writes1, writes2,
      file: app.__store.get(".obsidian/snippets/storm-theme.css") || null,
      appearance: app.__store.get(".obsidian/appearance.json"),
      /* every op that CHANGES something under .obsidian/ (mkdir is not a change) */
      touched: app.__log.filter(l => l.path && String(l.path).indexOf(".obsidian/") === 0 &&
        ["adapterWrite", "modify", "create", "delete", "trash", "rename"].indexOf(l.op) >= 0).map(l => l.op + " " + l.path),
      enabled: [...app.customCss.enabledSnippets],
      order: app.__log.filter(l => ["readSnippets", "setCssEnabledStatus", "requestLoadSnippets"].indexOf(l.op) >= 0).map(l => l.op),
      notices: window.__notices.slice(),
      mode: root.getAttribute("data-mode"),
      pal: root.getAttribute("data-storm-palette"),
    };
  }, { files: DASH_FILES, src: dashSrc, appearance: USER_APPEARANCE });

  assert(dash.writes1.length === 1 && dash.writes1[0] === ".obsidian/snippets/storm-theme.css",
    "the Dashboard (mode: " + dash.mode + ") writes exactly ONE file, .obsidian/snippets/storm-theme.css" +
    " (wrote " + JSON.stringify(dash.writes1) + ")");
  assert(dash.file && /^\/\*[\s\S]*?\*\/\nbody:not\(\.theme-light\)\{--storm-/.test(dash.file),
    "…and what it wrote is a storm-theme.css, not a fragment");
  assert(dash.writes2.length === 0,
    "a second render with the same theme writes nothing — the file is not thrashed on every render");
  assert(dash.appearance === USER_APPEARANCE,
    "the user's .obsidian/appearance.json is byte-identical afterwards — Storm never rewrites it");
  assert(dash.touched.length === 1,
    "exactly one path under .obsidian/ is changed in total (" + JSON.stringify(dash.touched) + ")");
  assert(dash.enabled.indexOf("storm-theme") >= 0,
    "the snippet is switched on through Obsidian's own app.customCss.setCssEnabledStatus");
  assert(dash.order[0] === "readSnippets" && dash.order.indexOf("setCssEnabledStatus") === 1,
    "…after readSnippets(), because a file Obsidian has not read cannot be enabled (" + dash.order.join(" → ") + ")");
  assert(dash.order.indexOf("requestLoadSnippets") >= 0,
    "…and requestLoadSnippets() makes it apply without a restart");
  assert(!dash.notices.length, "no Notice is raised when the API works (" + JSON.stringify(dash.notices) + ")");

  /* the file the Dashboard writes is the one the theme actually needs. Which
     palette it starts from depends on the variant's stormMode: `community` maps
     onto Obsidian's own variables, `match` hands initHub the cached banner
     palette out of the frontmatter. Both must round-trip through _themeFileCss. */
  if (dash.mode === "community") {
    assert(dash.file === S._themeFileCss({ mode: "community" }),
      "community mode writes exactly _themeFileCss({mode:\"community\"}) — the Obsidian-variable mapping");
    assert(dash.file.indexOf("body.theme-light{") >= 0,
      "…for light AND dark, so the e-ink toggle needs no second write");
  } else {
    assert(dash.mode === "match" && !!dash.pal,
      "a match-mode Dashboard hands its cached palette to initHub");
    assert(dash.file === S._themeFileCss(JSON.parse(dash.pal)),
      "the written file is exactly _themeFileCss(<the Dashboard's cached banner palette>)");
  }

  /* ---- the file is already right but the user turned the snippet off ---- */
  const already = await page.evaluate(async (c) => {
    const prev = document.getElementById("__mount"); if (prev) prev.remove();
    const mount = document.createElement("div"); mount.id = "__mount"; mount.className = "storm-hub";
    document.body.appendChild(mount);
    const H = window.StormHarness;
    const files = Object.assign({}, c.files);
    files[".obsidian/snippets/storm-theme.css"] = c.file;   // exactly what this Dashboard would write
    const app = H.mkVault(files, {}); window.app = app;
    window.__notices = [];
    const dv = H.mkDv(app, "Dashboard.md");
    await H.runBlock(c.src, dv, app, mount);
    await new Promise(r => setTimeout(r, 150));
    return {
      writes: app.__log.filter(l => l.op === "adapterWrite").map(l => l.path),
      enabled: [...app.customCss.enabledSnippets],
      notices: window.__notices.slice(),
    };
  }, { files: DASH_FILES, src: dashSrc, file: dash.file });
  assert(already.writes.length === 0,
    "an up-to-date storm-theme.css is not rewritten (" + JSON.stringify(already.writes) + ")");
  assert(already.enabled.indexOf("storm-theme") >= 0 && !already.notices.length,
    "…but the snippet is still switched on, so turning it off in Settings is not a dead end");

  /* ---- the fallback when Obsidian's internal API is not there ---- */
  const noApi = await page.evaluate(async (c) => {
    const prev = document.getElementById("__mount"); if (prev) prev.remove();
    const mount = document.createElement("div"); mount.id = "__mount"; mount.className = "storm-hub";
    document.body.appendChild(mount);
    const H = window.StormHarness;
    const app = H.mkVault(Object.assign({}, c.files), { customCss: false }); window.app = app;
    window.__notices = [];
    const dv = H.mkDv(app, "Dashboard.md");
    await H.runBlock(c.src, dv, app, mount);
    await new Promise(r => setTimeout(r, 150));
    return {
      wrote: !!app.__store.get(".obsidian/snippets/storm-theme.css"),
      notices: window.__notices.slice(),
    };
  }, { files: DASH_FILES, src: dashSrc });
  assert(noApi.wrote, "with app.customCss missing the file is still written");
  assert(noApi.notices.some(n => /storm-theme/.test(n) && /Settings\s*→\s*Appearance/.test(n)),
    "…and a Notice tells the user where the switch is (" + JSON.stringify(noApi.notices) + ")");
});

/* ══ 5. what the BUILD ships ═════════════════════════════════════════════ */
assert(fs.existsSync(THEME_FILE), "the build ships .obsidian/snippets/storm-theme.css");
{
  const t = readFile(THEME_FILE);
  const bad = Object.keys(DEFAULT_DARK).filter(k => t.indexOf("--storm-" + k + ":" + DEFAULT_DARK[k]) < 0);
  assert(!bad.length, "the shipped default snippet is the built-in palette, unchanged" +
    (bad.length ? " — differs on " + bad.join(", ") : ""));
  assert(t.indexOf("body.theme-light{") < 0,
    "the shipped default is dark-only, so the e-ink light palette is untouched out of the box");
}
{
  /* `writeAppearanceJson` in the variant's own variant.json decides whether the
     build ships .obsidian/appearance.json at all. A variant that CREATES a vault
     ships one; a variant deployed INTO somebody's existing vault must not, because
     that file holds their cssTheme and accentColor and shipping one wipes them.
     Suite A proves the flag really is what decides, by building a second variant
     with it turned off. Here we check this variant got what it asked for. */
  const cfg = B.P.variant(VARIANT);
  const app = VDIR + "/.obsidian/appearance.json";
  if (cfg.writeAppearanceJson) {
    // every snippet the vault relies on must stay enabled — dropping "dashboard"
    // would unstyle the board notes and unhide the #habit plumbing tags
    assert(fs.existsSync(app) && ["dashboard", "storm", "storm-theme"]
             .every(sn => JSON.parse(readFile(app)).enabledCssSnippets.indexOf(sn) >= 0),
      VARIANT + " ships appearance.json with dashboard + storm + storm-theme enabled");
  } else {
    assert(!fs.existsSync(app),
      VARIANT + " ships NO appearance.json — it is deployed INTO a vault whose settings are the user's");
  }
  assert(fs.existsSync(VDIR + "/.obsidian/snippets/storm-theme.css"),
    "…and the snippet file itself ships either way");
}
