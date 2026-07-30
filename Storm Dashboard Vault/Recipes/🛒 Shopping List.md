---
cssclasses:
  - dashboard
tags:
  - dashboard
---

# 🛒 Shopping List

[[🗓️ Meal Planner|← Meal Planner]]

> This list is built automatically from the recipes you planned in the [[🗓️ Meal Planner]] — grouped by recipe so you can see what's for what. Plan meals there, then shop from here.

```dataviewjs
const plan = dv.page("🗓️ Meal Planner");
if (!plan){
  dv.paragraph("⚠️ Couldn't find the **🗓️ Meal Planner** note.");
} else {
  const seen = new Set();
  const recipes = plan.file.outlinks
    .map(l => dv.page(l.path))
    .filter(p => p && p.file.folder.startsWith("Recipes") && p.file.tags.includes("#recipe"));
  let any = false;
  for (const r of recipes){
    if (seen.has(r.file.path)) continue;
    seen.add(r.file.path);
    const ings = r.file.lists.where(l => l.section && l.section.subpath === "Ingredients" && !l.text.startsWith("**"));
    dv.header(3, r.file.link);
    if (ings.length){ dv.list(ings.map(i => i.text)); any = true; }
    else dv.paragraph("_No ingredient list found in this recipe._");
  }
  if (!any) dv.paragraph("_Plan some recipes in the Meal Planner to fill this list._");
}
```

---

## ➕ Extras (add anything not in a recipe)
- [ ] 
- [ ] 
- [ ] 

> Tip: check items off here as you shop. To reuse the list next week, just re-plan the [[🗓️ Meal Planner]] and this rebuilds itself.
