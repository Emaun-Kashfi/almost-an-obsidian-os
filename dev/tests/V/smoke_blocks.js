/* Agent V — every ```dataviewjs block in the built vault must run against the real
   seed vault without throwing and without printing its own error state. Catches blocks
   nobody else exercises (⚙️ Settings vault stats, the daily Workout block, the panel
   embedded in _templates/Goal.md, …). */
const { withPage, assert } = require("../lib.js");
const V = require("./vault.js");
const B = require("../build.js");

const blocks = md => { const o = []; const re = /```dataviewjs\n([\s\S]*?)\n```/g; let m; while ((m = re.exec(md))) o.push({ src: m[1], at: m.index }); return o; };

const ERR = /(Storm hub error|Goal panel error|Goals index error|Task board error|Triage error|Planned today — error|Done today — error)/;

(async () => {
  for (const variant of B.P.variants()) {
    const files = V.build(variant);
    const jobs = [];
    for (const [path, content] of Object.entries(files)) {
      if (!path.endsWith(".md")) continue;
      blocks(content).forEach((b, i) => jobs.push({ path, i, src: b.src }));
    }
    const r = await withPage(async (page, errors) => {
      const res = await page.evaluate(async ({ files, jobs }) => {
        const H = window.StormHarness;
        const out = [];
        for (const j of jobs) {
          const app = H.mkVault(JSON.parse(JSON.stringify(files)), { createDaily: () => {} });
          const dv = H.mkDv(app, j.path);
          let threw = "", text = "";
          try { const c = await H.runBlock(j.src, dv, app); text = c.textContent || ""; }
          catch (e) { threw = String((e && e.message) || e); }
          out.push({ path: j.path, i: j.i, threw, text: text.slice(0, 400) });
        }
        return out;
      }, { files, jobs });
      return { res, errors: errors.slice() };
    });
    console.log("── " + variant + ": " + jobs.length + " dataviewjs blocks ──");
    for (const b of r.res) {
      const label = variant + "/" + b.path + " [block " + b.i + "]";
      assert(!b.threw, label + " runs without throwing" + (b.threw ? " — " + b.threw : ""));
      const m = b.text.match(ERR);
      assert(!m, label + " prints no error state" + (m ? " — " + b.text.replace(/\s+/g, " ").slice(0, 200) : ""));
    }
    assert(r.errors.length === 0, variant + ": no uncaught page errors" + (r.errors.length ? " — " + r.errors.join(" | ") : ""));
  }
})().catch(e => { console.log("FAIL: " + e.stack); process.exitCode = 1; });
