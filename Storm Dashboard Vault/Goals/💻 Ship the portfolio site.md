---
type: goal
status: active
area: Side Project
target: 2026-11-30
tags:
  - goal
---

# 💻 Ship the portfolio site

[[🎯 Goals|← Goals]]　·　[[Dashboard|Dashboard]]

## 🎯 Outcome
Get the personal portfolio site fully built — with a project gallery that actually shows finished work — and live on a custom domain.

```dataviewjs
const p = "_scripts/goal-panel", f = x => app.metadataCache.getFirstLinkpathDest(x, "");
if (f(p + ".js") || f(p + "/view.js")) await dv.view(p);
else dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.", { cls: "panel-err storm-missing-view" });
```

## 🗒️ Notes
- 
