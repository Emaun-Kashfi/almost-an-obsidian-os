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

<!-- TASK_GANTT -->

## Sub-tasks

- [ ] 

## 🗒️ Notes

