<%*
const title = await tp.system.prompt("Project name");
if (title) { await tp.file.rename(title); }
-%>
---
type: project
status: active
area: 
started: <% tp.date.now("YYYY-MM-DD") %>
due: 
tags:
  - project
---

# <% tp.file.title %>

[[📊 Projects|← Projects]]　·　[[Dashboard|Dashboard]]

> **Status:** active · planning · on-hold · someday · done — edit the `status` property to move this around the board.
> **Area:** set the `area` property (e.g. Career, Side Project, Health, Home, Finance, Learning) so it groups on the board.

## 🎯 Outcome
> What does "done" look like? One or two sentences.



## 🧭 Milestones
> The board's progress bar counts these. Keep them as checkboxes.

- [ ] 
- [ ] 
- [ ] 

## ⏭️ Next actions
- [ ] 

## 🗒️ Notes / log

