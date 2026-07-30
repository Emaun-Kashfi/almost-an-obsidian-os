---
cssclasses:
  - dashboard
tags:
  - dashboard
---

# 🔥 Habit Tracker

[[Dashboard|← Dashboard]]

> Everything here is **automatic**. You never edit this page. Just check the habit boxes in your [[Dashboard|daily note]] each day and the heatmap, streaks, and weekly grid below update themselves.

## 🗓️ This year

```dataviewjs
// GitHub-style heatmap. Intensity = how many habits you checked that day.
// Requires the "Heatmap Calendar" community plugin.
if (typeof renderHeatmapCalendar !== "function") {
  dv.paragraph("⚠️ Install & enable the **Heatmap Calendar** plugin to see the heatmap here.");
} else {
  const daily = dv.pages('"Daily"').where(p => p.file.tasks.length);
  const isoOf = p => p.date ? p.date.toISODate() : p.file.name.slice(0,10);
  const entries = [];
  for (const p of daily){
    const done = p.file.tasks.where(t => t.completed && t.tags.some(x => x.startsWith("#habit"))).length;
    if (done > 0) entries.push({ date: isoOf(p), intensity: done, content: "" });
  }
  renderHeatmapCalendar(this.container, {
    year: new Date().getFullYear(),
    colors: { flame: ["#ffd7a8","#ffb066","#ff8c1a","#e86f00","#b34d00"] },
    entries,
  });
}
```

## 🔥 Current streaks

```dataviewjs
const habits = [
  { tag: "#habit/move",     label: "🏋️ Move / exercise" },
  { tag: "#habit/language", label: "🗣️ Language" },
  { tag: "#habit/quran",    label: "📖 Qur'an / faith" },
  { tag: "#habit/water",    label: "💧 Water" },
  { tag: "#habit/sleep",    label: "😴 Sleep prep" },
  { tag: "#habit/meals}",    label: "🍽️ Log meals" },
];
const daily = dv.pages('"Daily"').where(p => p.file.tasks.length);
const isoOf = p => p.date ? p.date.toISODate() : p.file.name.slice(0,10);

const done = {};
for (const h of habits) done[h.tag] = new Set();
for (const p of daily){
  const iso = isoOf(p);
  for (const t of p.file.tasks){
    if (!t.completed) continue;
    for (const h of habits){
      if (t.tags.some(x => x === h.tag || x.startsWith(h.tag + "/"))) done[h.tag].add(iso);
    }
  }
}
const isoStr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function currentStreak(set){
  let s = 0;
  const d = new Date(); d.setHours(0,0,0,0);
  if (!set.has(isoStr(d))) d.setDate(d.getDate() - 1); // today may not be done yet
  while (set.has(isoStr(d))){ s++; d.setDate(d.getDate() - 1); }
  return s;
}
function bestStreak(set){
  const days = [...set].sort();
  let best = 0, run = 0, prev = null;
  for (const iso of days){
    if (prev){
      const gap = (new Date(iso) - new Date(prev)) / 86400000;
      run = gap === 1 ? run + 1 : 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = iso;
  }
  return best;
}
const rows = habits.map(h => {
  const set = done[h.tag];
  const cur = currentStreak(set);
  return [h.label, cur > 0 ? `${cur} day${cur>1?"s":""} 🔥` : "—", `${bestStreak(set)} best`, `${set.size} total`];
});
dv.table(["Habit", "Current streak", "Record", "All-time"], rows);
```

## ✅ This week

```dataviewjs
const habits = [
  { tag: "#habit/move",     label: "🏋️" },
  { tag: "#habit/language", label: "🗣️" },
  { tag: "#habit/quran",    label: "📖" },
  { tag: "#habit/water",    label: "💧" },
  { tag: "#habit/sleep",    label: "😴" },
  { tag: "#habit/meals}",    label: "🍽️" },
];
const daily = dv.pages('"Daily"').where(p => p.file.tasks.length);
const isoOf = p => p.date ? p.date.toISODate() : p.file.name.slice(0,10);

const done = {};
for (const h of habits) done[h.tag] = new Set();
for (const p of daily){
  const iso = isoOf(p);
  for (const t of p.file.tasks){
    if (!t.completed) continue;
    for (const h of habits){
      if (t.tags.some(x => x === h.tag || x.startsWith(h.tag + "/"))) done[h.tag].add(iso);
    }
  }
}
const now = new Date(); now.setHours(0,0,0,0);
const dow = now.getDay();
const mon = new Date(now); mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
const dayLabels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const isoStr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const weekIsos = [];
for (let i=0;i<7;i++){ const d = new Date(mon); d.setDate(mon.getDate()+i); weekIsos.push(isoStr(d)); }
const todayIso = isoStr(now);
const rows = habits.map(h => {
  const cells = weekIsos.map(iso => {
    if (done[h.tag].has(iso)) return "✅";
    return iso < todayIso ? "·" : (iso === todayIso ? "◻️" : " ");
  });
  return [h.label, ...cells];
});
dv.table(["", ...dayLabels], rows);
```

---

> **Add or change a habit?** Edit the checkbox lines in `_templates/Daily Note Template` (keep the `#habit/xxx` tag on each), then update the `habits` list in the two code blocks above to match. That's the only maintenance this page ever needs.
