// Suite A — the variant mechanism itself: everything that differs between two
// vaults built from the same sources comes out of that vault's variant.json and
// nowhere else. The test builds a SECOND, throwaway variant at run time (different
// greeting, different banner, no appearance.json), assembles both, and checks:
//   · the frontmatter, the NAME expression and the two banner constants follow
//     variant.json, byte for byte;
//   · nothing from one variant leaks into the other;
//   · both blocks parse, in node and in the browser;
//   · both render identically against the SAME mock vault — the variant may change
//     the greeting and the fallback banner, and nothing else;
//   · a vault with no goals and no tasks still renders, and the add box can
//     bootstrap today's daily note.
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");
const { withPage, extractBlocks, readFile, assert } = require("../lib.js");
const B = require("../build.js");
const M = require("./mock.js");

/* ── a second variant, invented here, built from the same dev/ sources ─────── */
const PROBE_DIR = path.join(B.P.BUILD, "__probe_variant");
const PROBE_FM = [
  "---", "cssclasses:", "  - storm-home", "  - max", "tags:", "  - dashboard",
  "stormMode: match", "---",
];
fs.rmSync(PROBE_DIR, { recursive: true, force: true });
fs.mkdirSync(PROBE_DIR, { recursive: true });
fs.writeFileSync(path.join(PROBE_DIR, "variant.json"), JSON.stringify({
  vault: path.relative(B.P.REPO, path.join(B.P.BUILD, "__probe_vault")),
  label: "throwaway variant, built by tests/A/variants.js",
  dashboard: {
    frontmatter: PROBE_FM,
    nameExpr: '"Probe"',
    bannerPath: "Images/System Images/probe-banner.png",
    bannerName: "probe-banner",
  },
  writeAppearanceJson: false,
}, null, 2) + "\n");

const REL_PROBE = path.relative(B.P.REPO, PROBE_DIR).split(path.sep).join("/");
execFileSync("python3", [path.join(B.P.DEV, "assemble_dashboard.py"), "--variant", REL_PROBE],
  { cwd: B.P.DEV, stdio: "pipe" });

const NAMES = { main: B.VARIANT, probe: REL_PROBE };
const raw = { main: readFile(B.DASH()), probe: readFile(B.DASH(REL_PROBE)) };
const src = { main: extractBlocks(raw.main)[0], probe: extractBlocks(raw.probe)[0] };
const cfg = { main: B.P.variant().dashboard, probe: B.P.variant(REL_PROBE).dashboard };

// ---- frontmatter + banner + name wiring (SPEC §3.6) ----
for (const v of ["main", "probe"]) {
  const c = cfg[v];
  assert(raw[v].startsWith(c.frontmatter.join("\n") + "\n\n"),
    v + ": the note opens with exactly the frontmatter in its variant.json");
  assert(src[v].includes("const NAME = " + c.nameExpr + ";"),
    v + ": const NAME is the variant's nameExpr — " + c.nameExpr);
  assert(src[v].includes('const BANNER_FALLBACK_PATH = ' + JSON.stringify(c.bannerPath) + ";") &&
         src[v].includes('const BANNER_FALLBACK_NAME = ' + JSON.stringify(c.bannerName) + ";"),
    v + ": the two banner constants are the variant's — " + c.bannerPath);
  assert(src[v].includes("/* vault variant: " + path.basename(NAMES[v]) + " */"),
    v + ": the assembled block names the variant it was built for");
}
assert(!raw.main.includes(cfg.probe.bannerName) && !raw.probe.includes(cfg.main.bannerName),
  "neither variant carries the other's banner — nothing leaks across the seam");
assert(!raw.main.includes(cfg.probe.nameExpr), "…nor the other's greeting expression");

/* a "did something duplicate itself?" guard, not a budget. It went 130 → 160 KB when
   PAUSE §4 grew the embedded GOAL_PANEL string; CONTRACT A deleted that embed.
   CONTRACT §B then added ~6 KB of genuinely new code to the block (the
   storm-theme.css writer in initHub + _themeFileCss/_normalizeTheme in helpers),
   which took the honest figure from ~123 to ~129 KB — so the ceiling moves to 136,
   still far below the ~160 KB a duplicated panel produces.
   THEME2 §A/§B/§C added ~2.9 KB more (the Obsidian-variable mapping, the link
   derivation, the guarded call site) — the ceiling moves to 140. */
assert(src.main.length < 140 * 1024 && src.probe.length < 140 * 1024,
  "both blocks stay under 140 KB (" + Math.round(src.main.length / 1024) + " / " + Math.round(src.probe.length / 1024) + " KB)");
assert(!/🎯 GOAL PANEL/.test(raw.main) && !/🎯 GOAL PANEL/.test(raw.probe),
  "neither Dashboard pastes the goal panel — the `goal:` route writes a one-line dv.view block");
assert((raw.main.match(/```/g) || []).length === 2 && (raw.probe.match(/```/g) || []).length === 2,
  "exactly one code fence per file (the view block the routes write is \\u0060-escaped)");
assert(/module\.exports=\{buildHub,initHub,parseAdd,_two\}/.test(src.main), "the module.exports line is kept");

// ---- node-side syntax check ----
for (const v of ["main", "probe"]) {
  let ok = true, msg = "";
  try { new vm.Script("(async function(dv,app){" + src[v] + "\n});"); } catch (e) { ok = false; msg = e.message; }
  assert(ok, "vm.Script syntax check — " + v + (ok ? "" : ": " + msg));
}

withPage(async (page, errors) => {
  const r = await page.evaluate(async ({ src, files, links, dashFmTemplate, dailyTpl }) => {
    const H = window.StormHarness;
    const out = {};

    // in-page `new Function` syntax check (the same wrap runBlock uses)
    out.syntax = {};
    for (const v of ["main", "probe"]) {
      try { new Function("dv", "app", "return (async()=>{" + src[v] + "\n})()"); out.syntax[v] = "ok"; }
      catch (e) { out.syntax[v] = String(e.message); }
    }

    const run = async (blockSrc, f, opts) => {
      const app = H.mkVault(f, opts || {});
      const dv = H.mkDv(app, "Dashboard.md");
      const c = await H.runBlock(blockSrc, dv, app);
      return { app, c };
    };
    const snap = c => ({
      err: (c.textContent.match(/Storm hub error[^<]*/) || [null])[0],
      cards: c.querySelectorAll(".card").length,
      nm: (c.querySelector('.act[data-filter="nm"] .n') || {}).textContent,
      over: (c.querySelector('.act[data-filter="over"] .n') || {}).textContent,
      groups: c.querySelectorAll(".nm-group").length,
      rows: [...c.querySelectorAll('.nm-row[data-kind="next"] .nm-text')].map(e => e.textContent),
      greet: (c.querySelector(".greet .g") || {}).textContent.trim(),
      banner: (c.querySelector(".banner-img") || {}).getAttribute ? c.querySelector(".banner-img").getAttribute("src") : "",
      empty: (c.querySelector(".nm-empty") || {}).textContent,
      goalEmpty: (c.querySelector(".goalcard .empty") || {}).textContent,
      start: c.querySelectorAll(".starttoday").length,
    });

    // the same mock vault through both variants (both fallback banners present,
    // so each variant has to pick its OWN and cannot pass by accident)
    files["Images/System Images/storm-banner.png"] = "<binary>";
    files["Images/System Images/probe-banner.png"] = "<binary>";
    const mf = Object.assign({}, files);
    mf["Dashboard.md"] = dashFmTemplate + "```dataviewjs\n```\n";
    const a = await run(src.main, mf, { resolvedLinks: links });
    out.main = snap(a.c);
    const b = await run(src.probe, files, { resolvedLinks: links });
    out.probe = snap(b.c);

    // a vault with zero goals / zero tasks / no daily notes at all
    const bare = { "Dashboard.md": dashFmTemplate + "```dataviewjs\n```\n" };
    let created = null;
    const emptyRun = await run(src.main, bare, {
      createDaily: (store) => { created = "Daily/2026-09-12 Saturday.md"; store.set(created, dailyTpl.replace(/<%[^%]*%>/g, "2026-09-12")); }
    });
    out.empty = snap(emptyRun.c);

    // ... and the universal add box can still bootstrap today's note
    const uadd = emptyRun.c.querySelector("input[data-uadd]");
    uadd.value = "Call the plumber";
    uadd.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await new Promise(r2 => setTimeout(r2, 400));
    out.createdDaily = created;
    out.dailyBody = emptyRun.app.__store.get("Daily/2026-09-12 Saturday.md") || "";
    out.dailyCmd = emptyRun.app.__log.some(x => x.op === "command" && x.id === "daily-notes");
    return out;
  }, { src, files: M.files(), links: M.RESOLVED_LINKS,
       dashFmTemplate: "---\ncssclasses:\n  - storm-home\n  - max\ntags:\n  - dashboard\nname: Alex\nstormMode: community\n---\n\n",
       dailyTpl: M.DAILY_TEMPLATE });

  assert(r.syntax.main === "ok", "new Function syntax check — main (" + r.syntax.main + ")");
  assert(r.syntax.probe === "ok", "new Function syntax check — probe (" + r.syntax.probe + ")");

  assert(!r.main.err && !r.probe.err, "neither variant errors on the same vault");
  assert(r.main.cards === r.probe.cards && r.main.cards === 12, "both variants render 12 cards");
  assert(r.main.nm === r.probe.nm && r.main.over === r.probe.over, "both variants compute the same strip counts");
  assert(r.main.groups === 2 && r.probe.groups === 2, "both variants group by goal");
  assert(r.main.rows.join("|") === r.probe.rows.join("|"), "both variants list the same next moves");
  assert(/Alex/.test(r.main.greet), "the shipped variant greets _selfFm.name (" + r.main.greet + ")");
  assert(/Probe/.test(r.probe.greet), "the probe variant greets its hardcoded name (" + r.probe.greet + ")");
  assert(/storm-banner\.png$/.test(r.main.banner || ""), "the shipped variant falls back to its own banner — " + r.main.banner);
  assert(/probe-banner\.png$/.test(r.probe.banner || ""), "the probe variant falls back to its own banner — " + r.probe.banner);

  assert(!r.empty.err, "a vault with zero goals/tasks still renders (" + (r.empty.err || "clean") + ")");
  assert(r.empty.cards === 12, "empty vault still renders every card (" + r.empty.cards + ")");
  assert(r.empty.nm === "0" && r.empty.over === "0", "empty vault action strip reads 0");
  assert(/No goals yet/.test(r.empty.empty || ""), "empty vault shows the inviting Now empty state → " + JSON.stringify(r.empty.empty));
  assert(/No goals yet/.test(r.empty.goalEmpty || ""), "empty vault shows the goal-card empty state");
  assert(r.empty.start === 1, "a missing daily note shows ▶ Start today");
  assert(r.dailyCmd && r.createdDaily === "Daily/2026-09-12 Saturday.md", "the add box runs the daily-notes command to create today's note");
  assert(/- \[ \] Call the plumber/.test(r.dailyBody), "the inbox item lands in the freshly created daily note");
  assert(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join("; ") : ""));

  /* ---- the same flag, built: writeAppearanceJson decides, nothing else ---- */
  execFileSync("python3", [path.join(B.P.DEV, "integrate.py"), "--variant", REL_PROBE],
    { cwd: B.P.DEV, stdio: "pipe" });
  const probeVault = B.P.variant(REL_PROBE).vault;
  assert(!fs.existsSync(path.join(probeVault, ".obsidian/appearance.json")),
    "writeAppearanceJson:false ships NO .obsidian/appearance.json — a variant deployed into someone's existing vault must not overwrite their settings");
  assert(fs.existsSync(path.join(probeVault, ".obsidian/snippets/storm-theme.css")),
    "…while the theme snippet itself still ships");
  assert(fs.existsSync(path.join(B.VAULT(), ".obsidian/appearance.json")),
    "writeAppearanceJson:true (this repo's vault) does ship one");

  const probeStage = B.P.variant(REL_PROBE).stage;
  fs.rmSync(PROBE_DIR, { recursive: true, force: true });
  fs.rmSync(probeVault, { recursive: true, force: true });
  fs.rmSync(probeStage, { recursive: true, force: true });
  assert(true, "the throwaway variant and its vault are cleaned up");
});
