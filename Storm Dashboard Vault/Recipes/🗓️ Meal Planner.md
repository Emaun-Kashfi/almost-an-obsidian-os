---
cssclasses:
  - dashboard
tags:
  - dashboard
---

# 🗓️ Meal Planner

[[🍽️ Recipe Index|← Recipes]]　·　[[🛒 Shopping List|🛒 Shopping List →]]

> Drop `[[recipe]]` links into the week below (type `[[` and pick a recipe). Then open the [[🛒 Shopping List]] — it builds your list from whatever you planned here. The sample week is pre-filled with the example recipes; overwrite it each week.

| Meal | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 🍳 Breakfast | [[Overnight Oats with Berries]] | [[Overnight Oats with Berries]] | [[Overnight Oats with Berries]] |  |  |  |  |
| 🥪 Lunch | [[Black Bean & Corn Tacos]] |  | [[Black Bean & Corn Tacos]] |  |  |  |  |
| 🍽️ Dinner | [[Sheet-Pan Chicken & Vegetables]] | [[Lentil Coconut Curry]] | [[Garlic Butter Salmon]] |  |  |  |  |
| 🍰 Treat |  |  |  |  |  |  |  |

## 📊 This week's recipes

```dataviewjs
const me = dv.current();
const recipes = me.file.outlinks
  .map(l => dv.page(l.path))
  .filter(p => p && p.file.folder.startsWith("Recipes") && p.file.tags.includes("#recipe"));
const seen = new Set(); const rows = [];
let cal = 0, pro = 0;
for (const r of recipes){
  if (seen.has(r.file.path)) continue; seen.add(r.file.path);
  rows.push([r.file.link, r.type ?? "—", r.calories ?? "—", (r.protein != null ? r.protein + "g" : "—")]);
  if (typeof r.calories === "number") cal += r.calories;
  if (typeof r.protein === "number") pro += r.protein;
}
if (rows.length){
  dv.table(["Recipe", "Type", "Cal", "Protein"], rows);
  dv.paragraph(`**${rows.length} recipes planned** · rough per-serving totals across them: **${cal} cal**, **${pro}g protein**.`);
} else {
  dv.paragraph("_Add [[recipe]] links in the table above to see them here._");
}
```
