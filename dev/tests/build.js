/* ═══════════════════════════════════════════════════════════════════════════
   dev/tests/build.js — the things the build produces, named once.

   Every suite asserts against what `npm run build` just made, never against a
   path someone typed. Two artefacts matter:

     DASH(variant)   dev/build/<variant>/Dashboard.md — the assembled note, as
                     assemble_dashboard.py leaves it, before the shared notes
                     are folded in.
     VAULT(variant)  dev/build/<variant>/vault — the whole deployable vault, as
                     integrate.py leaves it. tests/V then proves that tree is
                     byte-identical to the vault committed at the repo root, so
                     asserting here is asserting about what ships.

   Nothing under dev/ may hardcode an absolute path; ask dev/paths.js instead.
   ═══════════════════════════════════════════════════════════════════════════ */
"use strict";
const path = require("path");
const P = require("../paths.js");

module.exports = {
  P,
  REPO: P.REPO,
  DEV: P.DEV,
  COMMON: P.COMMON,
  DASH: name => path.join(P.variant(name).stage, "Dashboard.md"),
  VAULT: name => P.variant(name).built,
  VARIANT: P.DEFAULT_VARIANT,
};
