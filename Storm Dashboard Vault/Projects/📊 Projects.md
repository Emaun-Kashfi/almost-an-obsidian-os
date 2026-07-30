---
cssclasses:
  - dashboard
tags:
  - dashboard
---

# 📊 Projects

[[Dashboard|← Dashboard]]

> Every note in **Projects/** with `type: project` shows up here automatically, with a progress bar from its checklist. To start one: right-click the Projects folder → *New from template* → **Project Template** (or copy `_templates/Project Template`).

## 🟢 In motion

```dataviewjs
const order = { active: 0, planning: 1, "on-hold": 2 };
const statusLabel = { active:"🟢 Active", planning:"🔵 Planning", "on-hold":"🟡 On hold" };
const pages = dv.pages('"Projects"')
  .where(p => p.type === "project" && p.status !== "done" && p.status !== "archived");

if (!pages.length){
  dv.paragraph("_No active projects yet._");
} else {
  // group by area
  const byArea = {};
  for (const p of pages){
    const a = p.area ?? "Unsorted";
    (byArea[a] ??= []).push(p);
  }
  for (const area of Object.keys(byArea).sort()){
    dv.header(3, area);
    const rows = byArea[area]
      .sort((a,b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))
      .map(p => {
        const tasks = p.file.tasks;
        const done = tasks.where(t => t.completed).length;
        const total = tasks.length;
        const pct = total ? Math.round(done/total*100) : 0;
        const filled = Math.round(pct/10);
        const bar = "▓".repeat(filled) + "░".repeat(10 - filled);
        const due = p.due ? dv.date(p.due).toFormat("MMM d") : "—";
        return [p.file.link, statusLabel[p.status] ?? p.status, `\`${bar}\` ${done}/${total}`, due];
      });
    dv.table(["Project", "Status", "Progress", "Due"], rows);
  }
}
```

## 🗂️ Someday / backlog

```dataview
TABLE WITHOUT ID file.link AS Project, area AS Area, started AS Started
FROM "Projects"
WHERE type = "project" AND status = "someday"
SORT area ASC
```

## ✅ Done & archived

```dataview
TABLE WITHOUT ID file.link AS Project, area AS Area, status AS Status
FROM "Projects"
WHERE type = "project" AND (status = "done" OR status = "archived")
SORT file.mtime DESC
```
