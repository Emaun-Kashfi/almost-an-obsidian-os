---
type: task
goal: "[[💻 Ship the portfolio site]]"
status: backlog
start: 2026-10-06
end: 2026-11-30
completed: 
tags:
  - task
---

# Launch on a custom domain

[[💻 Ship the portfolio site|← Goal]]　·　[[Dashboard|Dashboard]]

## 📆 Timeline

```dataviewjs
const p = "_scripts/task-gantt", f = x => app.metadataCache.getFirstLinkpathDest(x, "");
if (f(p + ".js") || f(p + "/view.js")) await dv.view(p);
else dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.", { cls: "panel-err storm-missing-view" });
```

## Sub-tasks
- [ ] Buy and configure the domain
- [ ] Point DNS and set up HTTPS
- [ ] Deploy to a custom domain
- [ ] Final content review before going live

## 🗒️ Notes
- 
