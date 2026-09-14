/* ═══════════════════════════════════════════════════════════════════════════
   a11y/graphics.js — the NON-TEXT boundaries that carry meaning, checked at
   3:1 (WCAG 1.4.11). Chart bars against the chart ground, the today line, the
   milestone diamonds, the sub-task checkbox, and the focus rings.

   Deliberately NOT in this list (and why) — see FINDINGS.md §"not flagged":
     .tg-window / .tg-tick / .tg-aline / .tg-gline  — axis + grid decoration
     .heat .c.i0                                    — an empty heatmap cell
     card borders, dividers, .glow                  — pure decoration
   ═══════════════════════════════════════════════════════════════════════════ */
"use strict";
const GRAPHICS = [
  { sel: ".tgantt .tg-bar", prop: "fill", label: "Gantt bar vs chart ground" },
  { sel: ".tgantt .tg-milestone", prop: "fill", label: "Gantt milestone vs chart ground" },
  { sel: ".tgantt .tg-today", prop: "stroke", label: "Gantt today line" },
  { sel: ".tgantt .tg-box rect", prop: "stroke", label: "Gantt sub-task checkbox boundary" },
  { sel: ".goalpanel .g-fill", prop: "fill", label: "goal-panel progress fill" },
  { sel: ".goalpanel .g-today", prop: "stroke", label: "goal-panel today line" },
  { sel: ".goalsidx .gi-fill", prop: "border", label: "goals-index progress fill" },
  { sel: ".tg-in:focus", prop: "border", label: "focus ring · Timeline add field" },
  { sel: ".tg-date:focus", prop: "border", label: "focus ring · Timeline date field" },
];


module.exports = GRAPHICS;
