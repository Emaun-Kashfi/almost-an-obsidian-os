<%*
const dayNum = parseInt(tp.date.now("d"));
const monOffset = dayNum === 0 ? -6 : 1 - dayNum;
const monDate = tp.date.now("YYYY-MM-DD", monOffset);
const weekLabel = tp.date.now("MMMM D", monOffset);
const weekKey = tp.date.now("YYYY-[W]WW");
await tp.file.rename(weekKey);
-%>
---
week: <% weekKey %>
week_start: <% monDate %>
tags: [weekly]
---

# Week of <% weekLabel %>

[[Dashboard|← Dashboard]]

---

## 🎯 Top 3 for the week

1. 
2. 
3. 

---

## 📌 Focus areas

> Give each task a 📅 date so it lands on the right day. Tag by area (`#work`, `#project`, `#home`, `#learning`) so it sorts on your daily note and dashboard.

**Work / career**
- [ ] #work  📅 <% monDate %>

**Side project**
- [ ] #project  📅 <% monDate %>

**Home / life**
- [ ] #home  📅 <% monDate %>

**Learning**
- [ ] #learning  📅 <% monDate %>

---

## 🪞 Weekly review

**What moved forward this week?**

**What got stuck or skipped — and why?**

**One thing to change next week:**

**Top 3 focus for next week:**
1. 
2. 
3. 
