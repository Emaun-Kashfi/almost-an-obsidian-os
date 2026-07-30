---
cssclasses:
  - dashboard
tags:
  - dashboard
---

# 🍽️ Recipe Index

[[Dashboard|← Dashboard]]　·　[[🗓️ Meal Planner|🗓️ Meal Planner]]　·　[[🛒 Shopping List|🛒 Shopping List]]

> Every note in **Recipes/** tagged `#recipe` appears here. New recipe: right-click the Recipes folder → *New from template* → **Recipe Template** (or copy `Recipe Template`), then fill the macros in the properties.

## 🔎 All recipes

```dataview
TABLE WITHOUT ID
  file.link AS "Recipe",
  choice(type, type, "—") AS "Type",
  choice(calories, calories, "—") AS "Cal",
  choice(protein, protein + "g", "—") AS "Protein",
  choice(servings, servings, "—") AS "Serves",
  choice(cuisine, cuisine, "") AS "Cuisine"
FROM #recipe
SORT type ASC, file.name ASC
```

## 💪 High protein (30g+)

```dataview
TABLE WITHOUT ID
  file.link AS "Recipe",
  protein + "g protein" AS "Protein",
  choice(calories, calories + " cal", "—") AS "Calories"
FROM #recipe
WHERE protein >= 30
SORT protein DESC
```

## 🍰 By type

```dataview
TABLE WITHOUT ID rows.file.link AS "Recipes"
FROM #recipe
GROUP BY choice(type, type, "Uncategorized") AS Type
SORT Type ASC
```

---

> **Macros not showing?** Open the recipe and fill the `calories`, `protein`, `carbs`, `fats`, `servings` properties (numbers, no quotes). The template already has the fields ready.
