/* ═══════════════════════════════════════════════════════════════════════════
   a11y/palettes.js — every palette the audit has to paint a surface with.

   The derived ("Match image") palettes are NOT invented here: we load the real
   shipping generator out of dev/dashboard/helpers.js and drive it the way
   _paletteFromImage would — synthetic 80×N RGBA buffers standing in for four
   representative banner images — so the audit tests the algorithm that ships,
   not a re-implementation of it.
   ═══════════════════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs");
const P = require("../paths.js");

const HELPERS = P.DASHBOARD + "/helpers.js";
/* the storm-theme.css the build SHIPS (CONTRACT §B), audited as its own palette */
const themeFile = v => P.variant(v).built + "/.obsidian/snippets/storm-theme.css";

/* ---- load the shipped helpers as-is (plain function declarations) ---- */
function loadShipped() {
  const helpers = fs.readFileSync(HELPERS, "utf8");
  const src = helpers + "\n" +
    "return { _extract, _buildTheme, _themeRule, _themeFileCss, _normalizeTheme, _worstGround, _contrast, _relLum, _hex, _rgb2hsl, _fixAcc, _fixText };";
  return new Function(src)();
}
const S = loadShipped();

/* ---- synthetic banner images -------------------------------------------
   _extract() walks an RGBA buffer, buckets into a 5×5×5 cube, and picks the
   dominant bucket plus the most "vibrant" one. Feeding it a weighted mix of a
   handful of hexes is exactly what a real photo reduces to after the 80px
   downscale that _paletteFromImage does, so the numbers below stand in for the
   four image families the contract asks for. ---------------------------- */
function hexToRgb(h) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function imageData(mix) {
  // mix: [[hex, weight], …] → a deterministic RGBA buffer of 80×45 px
  const W = 80, H = 45, N = W * H;
  const total = mix.reduce((a, m) => a + m[1], 0);
  const data = new Uint8ClampedArray(N * 4);
  let i = 0;
  for (const [hex, w] of mix) {
    const [r, g, b] = hexToRgb(hex);
    const n = Math.round(N * w / total);
    for (let k = 0; k < n && i < N; k++, i++) { data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255; }
  }
  const [r, g, b] = hexToRgb(mix[0][0]);
  for (; i < N; i++) { data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255; }
  return data;
}

const IMAGES = {
  /* a night photograph — nearly black, one cold highlight */
  "img-verydark": [["#070a12", 0.70], ["#141d33", 0.18], ["#2f4f8f", 0.09], ["#7fb0ff", 0.03]],
  /* a bright paper / sand banner — the light branch of _buildTheme */
  "img-verylight": [["#f4f1e8", 0.62], ["#e6dcc6", 0.23], ["#c9a15e", 0.11], ["#8a6a2f", 0.04]],
  /* a poster — highly saturated, mid luminance, goes to the DARK branch */
  "img-saturated": [["#d81b60", 0.44], ["#ff6f00", 0.30], ["#3b0a20", 0.20], ["#ffd54f", 0.06]],
  /* a concrete/fog photo — no bucket clears s ≥ .25, so hasColor is false */
  "img-neargrey": [["#6e7378", 0.55], ["#9aa0a6", 0.28], ["#3d4145", 0.17]],
  /* a saturated LIGHT banner — vivid but bright, the light branch with colour */
  "img-satlight": [["#ffe9f0", 0.50], ["#ffc2d6", 0.26], ["#e0218a", 0.18], ["#fff6b0", 0.06]],
};

function matchPalettes() {
  const out = {};
  for (const k of Object.keys(IMAGES)) {
    const ex = S._extract(imageData(IMAGES[k]));
    const t = S._buildTheme(ex);
    t.__source = k;
    t.__overallLum = ex.overallLum;
    t.__hasColor = ex.hasColor;
    out["match-" + k.replace("img-", "")] = t;
  }
  return out;
}

/* ---- community mode ------------------------------------------------------
   _themeRule({mode:"community"}) maps every --storm-* onto the INSTALLED
   Obsidian theme's variables, so what we are really auditing there is the
   stock Obsidian palette flowing through our selectors. These are Obsidian
   1.5's own default dark / default light values. ------------------------- */
/* CONTRACT §B — the link family. Obsidian derives every one of these from the
   accent (--color-accent ← the user's accentColor), and storm.css does not
   colour `a.internal-link` outside a Storm surface, so without them a plain note
   would measure as "no colour set" and the link fix would be invisible here.
   The values below are Obsidian's own defaults for its default themes. */
const OBS_LINKS_DARK = {
  "--color-accent": "#8b6cef", "--color-accent-1": "#af9af4", "--color-accent-2": "#d3c4f9",
};
const OBS_LINKS_LIGHT = {
  "--color-accent": "#7b6cd9", "--color-accent-1": "#9e93e4", "--color-accent-2": "#c2bbef",
};
const OBS_LINKS_COMMON = {
  "--link-color": "var(--color-accent)", "--link-color-hover": "var(--color-accent-1)",
  "--link-external-color": "var(--color-accent)", "--link-external-color-hover": "var(--color-accent-1)",
  "--link-unresolved-color": "var(--color-accent)",
  "--link-unresolved-opacity": "0.4", "--link-unresolved-filter": "none",
  "--text-accent": "var(--color-accent)", "--text-accent-hover": "var(--color-accent-1)",
};
/* Obsidian's own link rules, and the three grounds a link lands on outside a
   Storm surface. Deliberately scoped to the `links` fixture: every other surface
   in the matrix is a Storm surface whose links storm.css colours itself, and an
   unscoped `a{color:…}` here would silently re-colour them and change what those
   rows measure. `--link-unresolved-filter` is read but NOT applied: the probe
   models `opacity` exactly and `filter` not at all, so applying saturate(.25)
   would turn a measurement into a guess. */
const OBS_LINK_CSS = [
  ".axlinks .ax-pane{padding:16px 18px;font-size:16px;line-height:1.65;font-family:Inter,system-ui,sans-serif}",
  ".axlinks .ax-primary{background:var(--background-primary)}",
  ".axlinks .ax-secondary{background:var(--background-secondary)}",
  ".axlinks .ax-secalt{background:var(--background-secondary-alt)}",
  ".axlinks .ax-pane,.axlinks p,.axlinks li,.axlinks h2{color:var(--text-normal)}",
  ".axlinks h2{font-size:20px;margin:0 0 8px}",
  ".axlinks .ax-lbl{color:var(--text-muted);font-size:12.5px;margin-bottom:6px}",
  ".axlinks a{text-decoration:underline}",
  ".axlinks a.internal-link{color:var(--link-color)}",
  ".axlinks a.internal-link.is-unresolved{color:var(--link-unresolved-color);opacity:var(--link-unresolved-opacity)}",
  ".axlinks a.external-link{color:var(--link-external-color)}",
].join("\n") + "\n";

const OBSIDIAN_DARK = {
  "--background-primary": "#1e1e1e",
  "--background-primary-alt": "#1a1a1a",
  "--background-secondary": "#161616",
  "--background-secondary-alt": "#000000",
  "--background-modifier-border": "#333333",
  "--background-modifier-border-hover": "#444444",
  "--background-modifier-form-field": "#161616",
  "--text-normal": "#dadada",
  "--text-muted": "#b3b3b3",
  "--text-faint": "#666666",
  "--text-on-accent": "#ffffff",
  "--interactive-accent": "#8b6cef",
  "--interactive-accent-hover": "#7a5cdb",
  "--color-orange": "#e9973f",
  "--color-green": "#44cf6e",
  "--color-red": "#fb464c",
  "--accent-h": "254", "--accent-s": "80%", "--accent-l": "68%",
};
const OBSIDIAN_LIGHT = {
  "--background-primary": "#ffffff",
  "--background-primary-alt": "#fafafa",
  "--background-secondary": "#f2f3f5",
  "--background-secondary-alt": "#e3e5e8",
  "--background-modifier-border": "#dcddde",
  "--background-modifier-border-hover": "#c9cacb",
  "--background-modifier-form-field": "#ffffff",
  "--text-normal": "#222222",
  "--text-muted": "#5c5c5c",
  "--text-faint": "#999999",
  "--text-on-accent": "#ffffff",
  "--interactive-accent": "#7b6cd9",
  "--interactive-accent-hover": "#6a5bc8",
  "--color-orange": "#ec7500",
  "--color-green": "#08b94e",
  "--color-red": "#e93147",
  "--accent-h": "254", "--accent-s": "60%", "--accent-l": "63%",
};

/* ---- the palette the vault actually SHIPS ---------------------------------
   A Dashboard may carry a cached "Match image" palette in its own frontmatter
   (`stormTheme:`). Until CONTRACT §B that palette only ever painted the Dashboard
   note; now it is written to storm-theme.css and paints every surface in the
   vault, so it has to be audited on every surface — the one real-world palette
   the synthetic banner fixtures cannot stand in for. A variant in community mode
   (the template) carries no cache and simply contributes no row here. ------- */
function shippedPalette(vault) {
  const p = P.variant(vault).built + "/Dashboard.md";
  if (!fs.existsSync(p)) return null;
  const m = /^stormTheme:\s*'(.*)'\s*$/m.exec(fs.readFileSync(p, "utf8").slice(0, 4000));
  if (!m) return null;
  try {
    const t = JSON.parse(m[1]);
    t.__source = "Dashboard.md stormTheme (as shipped)";
    return t;
  } catch (e) { return null; }
}

/* ---- the palette → CSS bridge -------------------------------------------
   CONTRACT §B has landed: every literal in every palette block is now
   `var(--storm-<name>, <literal>)`, and the palette reaches the whole vault as
   `.obsidian/snippets/storm-theme.css` — a set of `--storm-*` definitions on
   <body>, written by the Dashboard.

   So the audit no longer re-declares anything of its own: it renders each
   surface under the REAL file the product writes, byte for byte, produced by
   the shipping `_themeFileCss()`. If that generator lets an illegible colour
   through, or the indirection misses a root so the theme never reaches it, the
   audit sees exactly what the user would. Community mode included — the mapping
   is lifted from the same generator, never re-derived (a second copy is how the
   audit and the product drifted apart in §C F12).

   The `pal` class on <body> is kept only as a marker for the matrix; the file
   itself is scoped `body:not(.theme-light)` / `body.theme-light`, which is what
   ships. ------------------------------------------------------------------- */
const PALETTE_ROOTS = [
  ".storm-hub", ".dashboard", ".goalpanel", ".dt-wrap", ".triage", ".goalsidx", ".tasksboard",
  ".tgantt", ".bm", ".wm", ".jsm", ".qa",
  ".mprep", ".serpanel", ".cpanel", ".rpanel",
];
/* every --storm-* the sheet reads; a generated file that drops one silently
   falls back to the hardcoded blue on that token, which is the §B bug itself */
const STORM_VARS = [
  "bg", "surface", "surface2", "track", "border", "border2", "text", "dim", "faint",
  "accent", "accent2", "accent-deep", "glow", "btn", "on-accent", "accent-rgb",
  "warm", "good", "behind",
];
function checkFile(css, what, allowMissing) {
  if (!/^body:not\(\.theme-light\)\{/m.test(css))
    throw new Error("palettes.js: _themeFileCss(" + what + ") no longer opens with a body:not(.theme-light) block");
  const skip = allowMissing || [];
  const missing = STORM_VARS.filter(v => skip.indexOf(v) < 0 && css.indexOf("--storm-" + v + ":") < 0);
  if (missing.length)
    throw new Error("palettes.js: _themeFileCss(" + what + ") defines no --storm-" + missing.join(", --storm-"));
  return css;
}
/* the real `.obsidian/snippets/storm-theme.css`, for a derived or brand palette */
function paletteCss(t, lightT) {
  if (!t) return "";
  /* A palette CACHED in a note's frontmatter before §C F13 carries no `behind`;
     the sheet then keeps its own derivation (color-mix off the THEMED --warm),
     which is exactly what shipped before §B as well. That is legitimate, and the
     `shipped-theme` matrix row measures it on every surface rather than assuming
     it. Anything else missing would be a generator bug, so it still throws. */
  return checkFile(S._themeFileCss(t, lightT), t.__source || t.mode || "?", t.behind ? [] : ["behind"]);
}
/* …and for community mode, where the file maps --storm-* onto Obsidian's own
   variables and therefore has to be emitted for light AND dark alike. */
function communityCss(vars) {
  void vars; /* the Obsidian base vars are injected for every palette by matrix() */
  const css = checkFile(S._themeFileCss({ mode: "community" }), "community");
  if (!/^body\.theme-light\{/m.test(css))
    throw new Error("palettes.js: the community theme file lost its body.theme-light block");
  if (css.indexOf("--storm-faint:var(--text-muted)") < 0)
    throw new Error("palettes.js: community mapping lost --faint");
  return css;
}

/* Obsidian itself always defines its own variables, in every theme and mode.
   ⚙️ Settings deliberately styles itself with them (--text-muted, --text-normal,
   --interactive-accent …), so the audit has to supply them in EVERY palette or
   those rules would read as "invalid → black" and produce phantom failures. */
function obsidianBase(light) {
  const v = Object.assign({}, light ? OBSIDIAN_LIGHT : OBSIDIAN_DARK,
    light ? OBS_LINKS_LIGHT : OBS_LINKS_DARK, OBS_LINKS_COMMON);
  return "body{" + Object.keys(v).map(k => `${k}:${v[k]}`).join(";") + "}\n" + OBS_LINK_CSS;
}

/* the full matrix the audit runs: each entry is {key, theme, css, ground} */
function matrix(vault) {
  const out = [];
  out.push({ key: "static-dark", label: "shipped storm.css · dark · no theme file", body: "theme-dark", css: "", ground: "#0a0d11", kind: "static" });
  out.push({ key: "static-light", label: "shipped storm.css · body.theme-light (e-ink) · no theme file", body: "theme-light", css: "", ground: "#ffffff", kind: "static" });
  /* CONTRACT §B — the file the BUILD ships: .obsidian/snippets/storm-theme.css
     with the default palette. It is meant to be a no-op (the same values the
     sheet already falls back to), which is exactly the kind of claim that has to
     be measured rather than assumed, so it gets its own line in the matrix. */
  const shipped = themeFile(vault);
  if (fs.existsSync(shipped)) {
    out.push({ key: "default-file", label: "shipped .obsidian/snippets/storm-theme.css (default palette)", body: "theme-dark pal", css: fs.readFileSync(shipped, "utf8"), ground: "#0a0d11", kind: "static" });
  }
  out.push({ key: "community-dark", label: "community mode · Obsidian default dark · storm-theme.css", body: "theme-dark pal", css: communityCss(OBSIDIAN_DARK), ground: OBSIDIAN_DARK["--background-primary"], kind: "community" });
  out.push({ key: "community-light", label: "community mode · Obsidian default light · storm-theme.css", body: "theme-light pal", css: communityCss(OBSIDIAN_LIGHT), ground: OBSIDIAN_LIGHT["--background-primary"], kind: "community" });
  const sp = shippedPalette(vault);
  if (sp) {
    out.push({
      key: "shipped-theme", label: "the palette this vault ships · Dashboard stormTheme · storm-theme.css",
      palette: sp, body: (sp.mode === "light" ? "theme-light" : "theme-dark") + " pal",
      css: paletteCss(sp), ground: sp.bg, kind: "match",
    });
  }
  const mp = matchPalettes();
  for (const k of Object.keys(mp)) {
    const t = mp[k];
    out.push({
      key: k, label: "match image · " + t.__source + " → " + t.mode + " · storm-theme.css", palette: t,
      body: (t.mode === "light" ? "theme-light" : "theme-dark") + " pal",
      css: paletteCss(t), ground: t.bg, kind: "match",
    });
  }
  for (const m of out) m.css = obsidianBase(/theme-light/.test(m.body)) + (m.css || "");
  return out;
}

module.exports = { matrix, matchPalettes, shippedPalette, paletteCss, communityCss, obsidianBase, S, OBSIDIAN_DARK, OBSIDIAN_LIGHT, PALETTE_ROOTS, STORM_VARS, themeFile };
