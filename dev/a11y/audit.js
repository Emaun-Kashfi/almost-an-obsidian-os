#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   CONTRACT §C — colour-contrast audit.

     node audit.js                 → one `ok` / `FAIL` line per surface×palette,
                                     a grouped summary, exit 1 on any failure
     node audit.js --json [file]   → the full finding set as JSON (for FINDINGS.md)
     node audit.js --shots         → also write tests/… PNGs of the worst offenders
     node audit.js --vault <name>  → only that variant's vault
     node audit.js --only gantt    → only surfaces whose key contains this

   Every surface is rendered in real chromium against the vault's REAL shipped
   .obsidian/snippets/storm.css, through the same Obsidian/Dataview harness the
   other suites use. Palettes come from the REAL generator (helpers.js
   _extract/_buildTheme for Match mode).

   Thresholds: 4.5:1 normal text · 3:1 large text (≥24px, or ≥18.66px at ≥700)
   · 3:1 for the non-text boundaries that carry meaning (chart bars against the
   chart ground, the today line, milestones, focus rings).
   ═══════════════════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs");
const path = require("path");
const { withPage, extractBlocks, readFile } = require("../tests/lib.js");
const FX = require("./fixtures.js");
const PAL = require("./palettes.js");

const HERE = __dirname;
const PROBE = fs.readFileSync(path.join(HERE, "probe.js"), "utf8");
const NOW = "2026-09-13T10:00:00";

const ARGV = process.argv.slice(2);
const has = f => ARGV.indexOf(f) >= 0;
const val = (f, d) => { const i = ARGV.indexOf(f); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const WANT_JSON = has("--json");
const JSON_OUT = WANT_JSON ? val("--json", path.join(HERE, "findings.json")) : null;
const WANT_SHOTS = has("--shots");
const ONLY_VAULT = val("--vault", "");
const ONLY_SURFACE = val("--only", "");
const QUIET = WANT_JSON && !has("--verbose");

const { VAULTS, stripThemeKeys } = require("./audit-surfaces.js");
const GRAPHICS = require("./graphics.js");

/* ─────────────────────────── rendering ─────────────────────────── */
/* A panel source is either a fenced ```dataviewjs block inside a note/.txt, or
   — once CONTRACT §A has landed in that vault — a bare _scripts/<name>.js file
   that dv.view() runs directly. Resolve both, so the audit keeps working while
   the migration is half-done. */
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

async function renderAndScan(page, ctx) {
  return page.evaluate(async (c) => {
    document.body.className = c.body;
    document.body.style.cssText = "margin:0;padding:18px;background:" + c.ground +
      ";font-family:Inter,system-ui,sans-serif;min-height:100vh";
    const old = document.getElementById("__pal"); if (old) old.remove();
    if (c.paletteCss) { const s = document.createElement("style"); s.id = "__pal"; s.textContent = c.paletteCss; document.head.appendChild(s); }
    const prev = document.getElementById("__mount"); if (prev) prev.remove();
    const mount = document.createElement("div"); mount.id = "__mount";
    if (c.wrap) mount.className = c.wrap;
    document.body.appendChild(mount);

    const H = window.StormHarness;
    const app = H.mkVault(c.files, {}); window.app = app;
    const dv = H.mkDv(app, c.cur);
    /* Real dv.view(): the shipped harness still stubs it as a no-op (CONTRACT
       §A is landing separately), and a no-op would render the Dashboard's goal
       panel as nothing at all — which would silently hide half the colours we
       are auditing. Resolve p.js / p/view.js against the store and run it with
       the same dv/app/container contract as runBlock. */
    dv.view = async function (p, input) {
      const src = c.files[p + ".js"] != null ? c.files[p + ".js"]
        : (c.files[p + "/view.js"] != null ? c.files[p + "/view.js"]
          : (c.files[p] != null ? c.files[p] : null));
      if (src == null) { const d = document.createElement("div"); d.className = "dataview-error"; d.textContent = "no view " + p; dv.container.appendChild(d); return; }
      const fn = new Function("dv", "app", "input", "return (async()=>{" + src + "\n})()");
      await fn.call({ container: dv.container }, dv, app, input);
    };
    let err = "";
    try { await H.runBlock(c.src, dv, app, mount); }
    catch (e) { err = String(e && e.message || e); }
    await new Promise(r => setTimeout(r, 120));

    /* open anything collapsed so paused / grouped states are on screen */
    if (c.open === "details") mount.querySelectorAll("details").forEach(d => d.setAttribute("open", ""));
    if (c.open === "resumebar" || c.open === "details") {
      const b = mount.querySelector(".resumebtn, .pausebtn");
      if (b) { b.dispatchEvent(new MouseEvent("click", { bubbles: true })); await new Promise(r => setTimeout(r, 60)); }
    }
    if (c.focus) { const f = mount.querySelector(c.focus); if (f) { f.focus(); await new Promise(r => setTimeout(r, 30)); } }

    const rows = window.__A11Y.scan(mount, { graphics: c.graphics });
    return { rows, err, html: mount.innerHTML.length };
  }, ctx);
}

/* ─────────────────────────── CSS source mapping ─────────────────────────── */
function makeLocator(cssText, cssName) {
  const lines = cssText.split("\n");
  const cache = new Map();
  return function locate(sel) {
    if (!sel) return "";
    if (cache.has(sel)) return cache.get(sel);
    const norm = s => s.replace(/\s+/g, " ").trim();
    const want = norm(sel);
    let hit = "";
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.indexOf("{") < 0 && l.indexOf(",") < 0) continue;
      const head = norm(l.split("{")[0]);
      if (!head) continue;
      const parts = head.split(",").map(norm);
      if (parts.indexOf(want) >= 0) { hit = cssName + ":" + (i + 1); break; }
      /* a selector list can span lines — look back a little */
      if (head.indexOf(want) >= 0 && (head === want || head.endsWith(want) || head.startsWith(want))) { hit = cssName + ":" + (i + 1); break; }
    }
    if (!hit) {
      /* last resort: first line containing the last compound of the selector */
      const tail = want.split(/\s+/).pop();
      for (let i = 0; i < lines.length; i++) if (lines[i].indexOf(tail) >= 0 && lines[i].indexOf("{") >= 0) { hit = cssName + ":" + (i + 1); break; }
    }
    cache.set(sel, hit);
    return hit;
  };
}

/* ─────────────────────────── root-cause grouping ─────────────────────────── */
/* One palette token failing in six places is ONE finding. The cause is:
     · the TOKEN the declaration reads (`fill:var(--faint)` → --faint), or the
       literal colour when the rule hard-codes one, AND
     · which palette family it fails in (static CSS / generated match palette /
       community mapping), because those are different fixes.
   The selectors and surfaces it shows up in become rows inside the finding. */
function causeOf(f) {
  const d = String(f.decl || f.rawFg || "").trim();
  const m = /var\(\s*(--[\w-]+)/.exec(d);
  let token = m ? m[1] : null;
  if (!token) {
    const mix = /color-mix\([^)]*var\(\s*(--[\w-]+)/.exec(d);
    if (mix) token = mix[1] + " (via color-mix)";
  }
  let what = token ? "token " + token : "literal " + (d || "?");
  /* a colour that only fails because an ancestor dims it is a DIFFERENT fix
     (raise the opacity / drop the dim) from the same token failing at full
     strength, so it becomes its own finding. */
  const dim = f.opacity != null && f.opacity < 0.95;
  if (dim) what += " dimmed to " + f.opacity + " by " + (f.opacityRules || []).map(r => r.sel).join(" + ");
  /* colour vs fill is the same token and the same fix; a non-text graphic
     boundary is a different one (3:1, and often the stroke rather than the fill) */
  const face = f.kind === "graphic" ? "graphic" : "text";
  return { token: token, what: what, dimmed: dim, face: face, key: what + " ‖ " + f.paletteKind + " ‖ " + face };
}

/* ─────────────────────────── main ─────────────────────────── */
(async () => {
  const findings = [];
  const advisories = [];
  const surfaceResults = [];
  const vaultKeys = Object.keys(VAULTS).filter(k => !ONLY_VAULT || k === ONLY_VAULT);
  let scanned = 0, errored = [];

  for (const vk of vaultKeys) {
    const V = VAULTS[vk];
    const CSS = readFile(V.css);
    const VFILES = V.files;          /* read the vault ONCE (V.files is a getter) */
    const locate = makeLocator(CSS, V.cssName);
    const matrix = PAL.matrix(vk);
    const surfaces = V.surfaces.filter(s => !ONLY_SURFACE || s.key.indexOf(ONLY_SURFACE) >= 0);

    await withPage(async (page) => {
      await page.addStyleTag({ content: CSS });
      await page.addScriptTag({ content: PROBE });
      for (const s of surfaces) {
        const src = blockOf(VFILES, s.src);
        if (!src) { errored.push(vk + "/" + s.key + ": no dataviewjs block at " + s.src[0] + "#" + (s.src[1] || 0)); continue; }
        await page.setViewportSize({ width: s.width || 1000, height: s.height || 1400 });
        const files = s.stripTheme ? stripThemeKeys(VFILES, s.cur) : VFILES;
        for (const m of matrix) {
          if (s.palettes && s.palettes.indexOf(m.key) < 0) continue;
          /* a surface may also select by palette FAMILY, so it keeps covering
             palettes added later — see the `links` surface in audit-surfaces.js */
          if (s.paletteKinds && s.paletteKinds.indexOf(m.kind) < 0) continue;
          const ctx = {
            files, src, cur: s.cur, wrap: s.wrap, body: m.body, ground: m.ground,
            paletteCss: m.css, open: s.open || "", focus: s.focus || "", graphics: GRAPHICS,
          };
          let r;
          try { r = await renderAndScan(page, ctx); }
          catch (e) { errored.push(vk + "/" + s.key + "/" + m.key + ": " + (e.message || e)); continue; }
          if (r.err) errored.push(vk + "/" + s.key + "/" + m.key + ": block threw: " + r.err);
          scanned++;
          const fails = r.rows.filter(x => !x.pass);
          for (const a of r.rows.filter(x => x.advisory)) advisories.push(Object.assign({}, a, {
            vault: vk, surface: s.key, palette: m.key, where: locate(a.sel), cssFile: V.cssName,
          }));
          surfaceResults.push({ vault: vk, surface: s.key, label: s.label, palette: m.key, plabel: m.label, checked: r.rows.length, failed: fails.length });
          for (const f of fails) {
            findings.push(Object.assign({}, f, {
              vault: vk, surface: s.key, surfaceLabel: s.label, palette: m.key, paletteLabel: m.label,
              paletteKind: m.kind, where: locate(f.sel), cssFile: V.cssName,
            }));
          }
          if (!QUIET) {
            const tag = fails.length ? "FAIL" : "ok  ";
            console.log(`${tag} - ${vk} ${s.key.padEnd(16)} ${m.key.padEnd(18)} ${String(r.rows.length).padStart(4)} checked, ${fails.length} below threshold`);
          }
        }
      }
    }, { now: NOW });
  }

  /* ---- group ---- */
  const groups = new Map();
  for (const f of findings) {
    const c = causeOf(f);
    f.cause = c.key;
    if (!groups.has(c.key)) groups.set(c.key, { key: c.key, what: c.what, token: c.token, dimmed: c.dimmed, face: c.face, paletteKind: f.paletteKind, prop: f.prop, worst: f, items: [] });
    const g = groups.get(c.key);
    g.items.push(f);
    if (f.ratio < g.worst.ratio) g.worst = f;
  }
  const grouped = [...groups.values()].sort((a, b) => a.worst.ratio - b.worst.ratio);
  const byRule = g => {
    const m = new Map();
    for (const i of g.items) {
      const k = i.sel + " ‖ " + i.prop + ":" + i.decl;
      if (!m.has(k)) m.set(k, { sel: i.sel, prop: i.prop, decl: i.decl, where: i.where, cssFile: i.cssFile, worst: i, n: 0, surfaces: new Set(), palettes: new Set(), samples: [] });
      const r = m.get(k); r.n++;
      r.surfaces.add(i.vault + "/" + i.surface); r.palettes.add(i.palette);
      if (i.ratio < r.worst.ratio) r.worst = i;
      if (r.samples.length < 6) r.samples.push(i);
    }
    return [...m.values()].sort((a, b) => a.worst.ratio - b.worst.ratio)
      .map(r => Object.assign(r, { surfaces: [...r.surfaces], palettes: [...r.palettes] }));
  };

  if (WANT_JSON) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({
      generated: new Date().toISOString(), today: FX.TODAY, scanned, errored,
      surfaces: surfaceResults, findings, advisories, groups: grouped.map(g => ({
        key: g.key, what: g.what, token: g.token, dimmed: g.dimmed, face: g.face, paletteKind: g.paletteKind, prop: g.prop,
        count: g.items.length, worstRatio: g.worst.ratio, threshold: g.worst.threshold, worst: g.worst,
        vaults: [...new Set(g.items.map(i => i.vault))],
        palettes: [...new Set(g.items.map(i => i.palette))],
        surfaces: [...new Set(g.items.map(i => i.vault + "/" + i.surface))],
        rules: byRule(g),
      })),
    }, null, 1));
    console.log("wrote " + JSON_OUT);
  }

  console.log("");
  console.log("─".repeat(78));
  console.log(`scanned ${scanned} surface×palette renders · ${findings.length} failing elements · ${grouped.length} root causes · ${advisories.length} image-backed advisories`);
  if (errored.length) { console.log("render problems:"); errored.forEach(e => console.log("   ! " + e)); }
  for (const g of grouped) {
    const w = g.worst;
    console.log(`  ${String(w.ratio).padStart(5)}:1 (need ${w.threshold}) ×${String(g.items.length).padStart(4)}  ${g.what}  [${g.paletteKind}/${g.face}]`);
    console.log(`         worst: ${w.sel}  fg ${w.fg} on bg ${w.bg}  — ${w.vault}/${w.surface} @ ${w.palette}  ${w.where}`);
  }

  if (WANT_SHOTS) await writeShots();

  process.exit(findings.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

/* ═══════════ screenshots of the worst offenders ═══════════════════════════ */
async function writeShots() { const S = require("./shots.js"); console.log(""); console.log("screenshots:"); await S.run(VAULTS); }
