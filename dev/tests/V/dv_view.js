/* CONTRACT A — the dv.view() contract itself.

   The panels used to be pasted into every goal and task note; now each is ONE vault
   file (`_scripts/<name>.js`) and the note carries three lines (THEME2 §C):

       ```dataviewjs
       const p = "_scripts/<name>", f = x => app.metadataCache.getFirstLinkpathDest(x, "");
       if (f(p + ".js") || f(p + "/view.js")) await dv.view(p);
       else dv.el("div", "⚠️ " + p + ".js is missing from this device, …", { cls: "panel-err storm-missing-view" });
       ```

   This file pins the four things that make that safe, against the REAL deployable
   tree (dev/build/<variant>/vault), and against the harness's real dv.view — which is modelled on
   Dataview's own `DataviewInlineApi.view` (src/api/inline-api.ts):

     1. the one-liner renders exactly the DOM the pasted block rendered;
     2. resolution is `<name>.js` first, then `<name>/view.js`;
     3. neither present → a VISIBLE error in the note, never a silent blank — and
        through the block the note actually carries, that error is OURS: it names
        the file and points at sync, instead of Dataview's bare not-found notice;
     4. inside a view `this` is the global object, NOT the block component — so a
        panel that still said `this.container` would fail loudly here.
*/
const fs = require("fs");
const { withPage, readFile, assert } = require("../lib.js");
const V = require("./vault.js");

const B = require("../build.js");
const blocks = md => { const o = []; const re = /```dataviewjs\n([\s\S]*?)\n```/g; let m; while ((m = re.exec(md))) o.push(m[0]); return o; };
const VIEW = name => '```dataviewjs\nconst p = "_scripts/' + name + '", f = x => app.metadataCache.getFirstLinkpathDest(x, "");\nif (f(p + ".js") || f(p + "/view.js")) await dv.view(p);\nelse dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.", { cls: "panel-err storm-missing-view" });\n```';

/* THEME2 §C — the SHIPPED call site is guarded: three lines that resolve the view
   the way Dataview does, call it when it is there, and say why when it is not. */
const GUARD = name => VIEW(name).split("\n").slice(1, -1).join("\n");
/* the notes that used to carry a pasted panel, and the view each one calls */
const VARIANT = B.VARIANT;
const CASES = [
  { variant: VARIANT, note: "Goals/💻 Ship the portfolio site.md", view: "goal-panel", root: ".goalpanel, .goal-head, .goalhead" },
  { variant: VARIANT, note: "Goals/🧠 Learn TypeScript.md", view: "goal-panel", root: ".goalpanel, .goal-head, .goalhead" },
  { variant: VARIANT, note: "Tasks/Build the project gallery.md", view: "task-gantt", root: ".tgantt" },
  { variant: VARIANT, note: "Tasks/Books 10–24.md", view: "task-gantt", root: ".tgantt" },
  { variant: VARIANT, note: "_templates/Task.md", view: "task-gantt", root: ".tgantt" },
];

/* ── static: the one file, and the one line ───────────────────────────────── */
for (const variant of B.P.variants()) {
  for (const name of ["goal-panel", "task-gantt"]) {
    const p = `${B.VAULT(variant)}/_scripts/${name}.js`;
    const src = fs.existsSync(p) ? readFile(p) : "";
    assert(!!src, `${variant}: _scripts/${name}.js is shipped`);
    assert(!/```/.test(src), `${variant}/${name}.js is bare JavaScript — a fence would be evaluated as code`);
    assert(/^const root = dv\.container;$/m.test(src), `${variant}/${name}.js renders into dv.container`);
    assert(!/(?<![.\w$])this\s*[.[]/.test(src), `${variant}/${name}.js never reads \`this\` — in a view it is the global object`);
    assert(/dv\.container\.innerHTML/.test(src), `${variant}/${name}.js still degrades to its own error div in catch`);
    assert(!fs.existsSync(`${B.VAULT(variant)}/_scripts/${name}.txt`), `${variant}: the old _scripts/${name}.txt is gone`);
  }
}
for (const c of CASES) {
  const t = readFile(`${B.VAULT(c.variant)}/${c.note}`);
  const bs = blocks(t);
  assert(bs.length === 1 && bs[0] === VIEW(c.view),
    `${c.variant}/${c.note} carries exactly the one-line ${c.view} call (${bs.length} block(s))`);
  assert(t.length < 4096, `…and the note is small again (${t.length} bytes)`);
}

/* ── in the browser ───────────────────────────────────────────────────────── */
withPage(async (page, errors) => {
  const trees = { [VARIANT]: V.build(VARIANT) };
  const SEED = VARIANT;
  const r = await page.evaluate(async ({ trees, CASES, GUARD, SEED }) => {
    const H = window.StormHarness;
    const mk = files => H.mkVault(JSON.parse(JSON.stringify(files)), { createDaily: () => {} });
    const run = async (files, note, src) => {
      const app = mk(files);
      const dv = H.mkDv(app, note);
      const c = await H.runBlock(src, dv, app);
      return c;
    };
    const out = { same: [], missing: null, folder: null, thrown: null, thisIsNotContainer: null, input: null };

    /* 1. the one-liner vs the source run inline — the same DOM */
    for (const c of CASES) {
      const files = trees[c.variant];
      const viaView = await run(files, c.note, 'await dv.view("_scripts/' + c.view + '")');
      const inline = await run(files, c.note, files["_scripts/" + c.view + ".js"]);
      out.same.push({
        note: c.variant + "/" + c.note,
        equal: viaView.innerHTML === inline.innerHTML,
        lens: [viaView.innerHTML.length, inline.innerHTML.length],
        roots: viaView.querySelectorAll(c.root).length,
        err: viaView.querySelectorAll(".goal-err, .tg-err, .dataview-error").length,
      });
    }

    /* 2. the `<name>/view.js` fallback resolves too */
    {
      const files = Object.assign({}, trees[SEED]);
      const src = files["_scripts/goal-panel.js"];
      delete files["_scripts/goal-panel.js"];
      files["_scripts/goal-panel/view.js"] = src;
      const c = await run(files, "Goals/💻 Ship the portfolio site.md", 'await dv.view("_scripts/goal-panel")');
      out.folder = { roots: c.querySelectorAll(".goalpanel, .goal-head, .goalhead").length, err: c.querySelectorAll(".dataview-error").length };
    }

    /* 3. neither file → a visible error, never a silent blank */
    {
      const files = Object.assign({}, trees[SEED]);
      delete files["_scripts/goal-panel.js"];
      const c = await run(files, "Goals/💻 Ship the portfolio site.md", 'await dv.view("_scripts/goal-panel")');
      out.missing = { text: (c.textContent || "").trim(), nodes: c.children.length };
    }

    /* 3b. THEME2 §C — the same vault, but through the block the NOTE actually
       carries. Dataview never gets the chance to print "custom view not found":
       the guard resolves first and renders the panel's own error element. */
    {
      const files = Object.assign({}, trees[SEED]);
      delete files["_scripts/goal-panel.js"];
      const c = await run(files, "Goals/💻 Ship the portfolio site.md", GUARD);
      const el = c.querySelector(".storm-missing-view");
      out.guarded = {
        text: (c.textContent || "").trim(), cls: el ? el.className : "", tag: el ? el.tagName : "",
        nodes: c.children.length, dvErr: c.querySelectorAll(".dataview-error").length,
      };
    }
    /* 3c. …and with the file there, the guard is invisible. */
    {
      const c = await run(trees[SEED], "Goals/💻 Ship the portfolio site.md", GUARD);
      out.guardedOk = {
        roots: c.querySelectorAll(".goalpanel, .goal-head, .goalhead").length,
        missing: c.querySelectorAll(".storm-missing-view").length,
      };
    }

    /* 4. a throwing view propagates instead of returning quietly */
    {
      const files = Object.assign({}, trees[SEED]);
      files["_scripts/boom.js"] = 'await Promise.resolve();\nthrow new Error("kaboom");\n';
      const app = mk(files);
      const dv = H.mkDv(app, "Goals/💻 Ship the portfolio site.md");
      let threw = "";
      const c = document.createElement("div"); document.body.appendChild(c);
      try { await H.runBlock('await dv.view("_scripts/boom")', dv, app, c); }
      catch (e) { threw = String((e && e.message) || e); }
      out.thrown = { threw, text: (c.textContent || "").trim() };
    }

    /* 5. inside a view `this` is NOT the container (that is why the panels use dv.container) */
    {
      const files = Object.assign({}, trees[SEED]);
      files["_scripts/probe.js"] = 'await Promise.resolve();\n' +
        'dv.container.setAttribute("data-this-container", String(typeof this === "undefined" ? "undefined" : (this && this.container) === dv.container));\n' +
        'dv.container.setAttribute("data-input", String(input && input.tag));\n';
      const c = await run(files, "Goals/💻 Ship the portfolio site.md",
        'await dv.view("_scripts/probe", { tag: "hello" })');
      out.thisIsNotContainer = c.getAttribute("data-this-container");
      out.input = c.getAttribute("data-input");
    }
    return out;
  }, { trees, CASES, GUARD: GUARD("goal-panel"), SEED });

  console.log("── 1: the one-liner renders the DOM the pasted block rendered ──");
  for (const s of r.same) {
    assert(s.equal, `${s.note}: dv.view output is byte-identical to the source run inline` +
      (s.equal ? "" : ` — ${s.lens.join(" vs ")} chars`));
    assert(s.roots >= 1, `${s.note}: …and it really rendered the panel (${s.roots} root(s))`);
    assert(s.err === 0, `${s.note}: …with no error element`);
  }

  console.log("── 2: resolution order — <name>.js, then <name>/view.js ──");
  assert(r.folder.roots >= 1 && r.folder.err === 0,
    "a vault that ships _scripts/goal-panel/view.js instead renders the panel too — " + JSON.stringify(r.folder));

  console.log("── 3: a missing view file is VISIBLE ──");
  assert(/custom view not found/.test(r.missing.text),
    "no view file → Dataview's not-found notice in the note — " + JSON.stringify(r.missing.text.slice(0, 140)));
  assert(/_scripts\/goal-panel\.js/.test(r.missing.text) && /_scripts\/goal-panel\/view\.js/.test(r.missing.text),
    "…naming both paths it looked for");
  assert(r.missing.nodes >= 1, "…as a real element, not an empty container");

  console.log("── 3b: THEME2 §C — the note's own guard explains a missing panel file ──");
  assert(/is missing from this device/.test(r.guarded.text),
    "the shipped call site says the file is missing from THIS device — " + JSON.stringify(r.guarded.text.slice(0, 200)));
  assert(/_scripts\/goal-panel\.js/.test(r.guarded.text), "…and names the file it wants");
  assert(/iPhone or iPad/.test(r.guarded.text) && /syncing/.test(r.guarded.text),
    "…and points at sync on mobile as the likely cause");
  assert(!/custom view not found/.test(r.guarded.text),
    "…instead of Dataview's raw notice, which the user saw before");
  assert(r.guarded.tag === "DIV" && /\bpanel-err\b/.test(r.guarded.cls) && /\bstorm-missing-view\b/.test(r.guarded.cls),
    "…rendered as the panel's own error element — " + JSON.stringify(r.guarded.cls));
  assert(r.guarded.dvErr === 0 && r.guarded.nodes === 1,
    "…and nothing else is in the container (" + r.guarded.nodes + " node(s), " + r.guarded.dvErr + " Dataview errors)");
  assert(r.guardedOk.roots >= 1 && r.guardedOk.missing === 0,
    "with the file present the guard is invisible and the panel renders (" + r.guardedOk.roots + " root(s))");

  console.log("── 4: errors propagate, they are not swallowed ──");
  assert(/kaboom/.test(r.thrown.threw), "a view that throws rejects dv.view — got " + JSON.stringify(r.thrown.threw));
  assert(/Failed to execute view/.test(r.thrown.text), "…and leaves a visible error element behind — " + JSON.stringify(r.thrown.text.slice(0, 120)));

  console.log("── 5: `this` inside a view is not the container ──");
  assert(r.thisIsNotContainer === "false",
    "`this.container` is NOT dv.container inside a view — that is why the panels use dv.container (got " + r.thisIsNotContainer + ")");
  assert(r.input === "hello", "dv.view's second argument arrives as `input` (got " + r.input + ")");

  if (errors.length) assert(false, "page errors: " + errors.join(" | "));
  else assert(true, "no uncaught page errors");
}).catch(e => { console.log("FAIL: " + e.stack); process.exitCode = 1; });
