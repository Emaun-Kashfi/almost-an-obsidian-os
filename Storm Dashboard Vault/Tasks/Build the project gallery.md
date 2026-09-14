---
type: task
goal: "[[💻 Ship the portfolio site]]"
status: active
start: 2026-09-01
end: 2026-10-05
completed: 
tags:
  - task
---

# Build the project gallery

[[💻 Ship the portfolio site|← Goal]]　·　[[Dashboard|Dashboard]]

## 📆 Timeline

```dataviewjs
const p = "_scripts/task-gantt", f = x => app.metadataCache.getFirstLinkpathDest(x, "");
if (f(p + ".js") || f(p + "/view.js")) await dv.view(p);
else dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.", { cls: "panel-err storm-missing-view" });
```

## Sub-tasks
- [x] Sketch the gallery layout and card design
- [x] Pick the tech stack for the gallery page 📅 2026-09-09 ✅ 2026-09-11
- [ ] Build the project gallery 📅 2026-09-10
- [ ] Add a contact form 📅 2026-09-12
- [ ] Cross-browser and mobile QA pass 📅 2026-09-25

## 🗒️ Notes
- 
