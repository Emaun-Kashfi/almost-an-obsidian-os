<%*
const title = await tp.system.prompt("Goal name");
if (title) { await tp.file.rename(title); }
-%>
---
type: goal
status: active
area: 
target: 
tags:
  - goal
---

# <% tp.file.title %>

[[🎯 Goals|← Goals]]　·　[[Dashboard|Dashboard]]

> **Status:** active · paused · done — edit the `status` property, or use **⏸️ Pause** in the panel below. Set `area` to group this goal on the Goals index, and `target` to the deadline the Gantt draws to.
> A **paused** goal and its tasks stop reporting health, next moves and overdue work everywhere; it waits in the collapsed **Paused** group at the bottom of 🎯 Goals until you hit **▶ Resume**.

## 🎯 Outcome
> What does "done" look like? One or two sentences.



```dataviewjs
const p = "_scripts/goal-panel", f = x => app.metadataCache.getFirstLinkpathDest(x, "");
if (f(p + ".js") || f(p + "/view.js")) await dv.view(p);
else dv.el("div", "⚠️ " + p + ".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.", { cls: "panel-err storm-missing-view" });
```

## 🗒️ Notes

