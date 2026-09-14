<%*
const title = await tp.system.prompt("Task name");
if (title) { await tp.file.rename(title); }
const goal = await tp.system.prompt("Goal (exact note name, optional)");
const goalLine = goal ? `goal: "[[${goal}]]"` : "goal: ";
-%>
---
type: task
<% goalLine %>
status: active
start: <% tp.date.now("YYYY-MM-DD") %>
end: 
completed: 
tags:
  - task
---

# <% tp.file.title %>

[[🎯 Goals|← Goals]]　·　[[Dashboard|Dashboard]]

> Sub-tasks below show up on the Dashboard as this task's next move — give one a `📅 YYYY-MM-DD` date to schedule it.

## 📆 Timeline

```dataviewjs
const p = "_scripts/task-gantt", f = x => app.metadataCache.getFirstLinkpathDest(x, "");
if (f(p + ".js") || f(p + "/view.js")) await dv.view(p);
else dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.", { cls: "panel-err storm-missing-view" });
```

## Sub-tasks

- [ ] 

## 🗒️ Notes

