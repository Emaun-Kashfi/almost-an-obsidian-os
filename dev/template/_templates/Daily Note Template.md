---
date: <% tp.date.now("YYYY-MM-DD") %>
tags:
  - daily
---
<%* await tp.file.rename(tp.date.now("YYYY-MM-DD") + " " + tp.date.now("dddd")) -%>

# <% tp.date.now("dddd, MMMM D") %>

[[Dashboard|← Dashboard]]　·　[[Weekly Notes/<% tp.date.now("GGGG-[W]WW") %>|This week]]

## 🎯 One thing
> The single thing that would make today a win.

→ 

## ⚡ Tasks
> One-off actions only — anything that belongs to a goal lives in its own note under `Tasks/`. Type below to add, or use the add box on your dashboard. Add a 📅 date to surface it on the day. Whatever is still unchecked here shows up in the Dashboard's Inbox for 7 days.

- [ ] 

## 📅 Planned today

```dataviewjs
// ── 📅 Planned today ──────────────────────────────────────────────────────────
// Every sub-task in a Tasks/ task note whose 📅 date is THIS note's day.
// Per-day, not "today": open a daily note from last week and it still reads right.
try {
  const iso = v => (v && typeof v.toISODate === "function") ? v.toISODate()
    : (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) ? v.slice(0, 10) : "";
  // local equivalents of the dashboard helpers (standalone note — nothing is imported)
  const clean = s => String(s == null ? "" : s)
    .replace(/(?:📅|⏳|🛫|✅|➕|🔁)\s*\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/[📅⏳🛫✅➕🔁]/gu, " ")
    .replace(/(?:⏫|🔼|🔽|⏬|🔺)/g, " ")
    .replace(/\s+\^[A-Za-z0-9-]+$/, " ")
    .replace(/(^|\s)#(?=[^\s]*[\p{L}_])[\p{L}\p{N}_\/-]+/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const EXCL = /(^|\/)(Fitness|_templates|_archive|Archive|\.trash)(\/|$)/i;
  const SUBSEC = /sub[-\s]?tasks?/i;
  const HABIT_RE = /(^|\s)#habit(\/[\p{L}\p{N}_/-]+)*(?=$|\s)/u;
  const secOf = t => { const s = t && (t.section || t.header); return s ? String(s.subpath || s.display || "") : ""; };
  /* SPEC §1 sub-task selection — heading-ancestor aware, identical in Dashboard.md /
     goal-panel.txt / 🎯 Goals.md / 📋 Tasks.md / daily-tables.txt. Keep it that way. */
  function subMarks(path){
    let hs = [];
    try { const f = app.vault.getAbstractFileByPath(path); hs = (f && (app.metadataCache.getFileCache(f)||{}).headings) || []; } catch(e){ hs = []; }
    const marks = [], stack = [];
    for(const h of hs){
      const lvl = h.level || 1;
      const ln = (h.position && h.position.start) ? h.position.start.line : 0;
      while(stack.length && stack[stack.length-1].lvl >= lvl) stack.pop();
      stack.push({ lvl: lvl, sub: SUBSEC.test(String(h.heading||"")) });
      marks.push({ line: ln, under: stack.some(x => x.sub) });
    }
    return marks;
  }
  function subsOf(p){
    let all = [];
    try { all = Array.from(p.file.tasks || []); } catch(e){ all = []; }
    const marks = subMarks(p.file.path);
    const underAt = ln => { let u = false; for(const m of marks){ if(m.line < ln) u = m.under; else break; } return u; };
    let list = all;
    if(marks.some(m => m.under)) list = all.filter(t => underAt(t.line != null ? t.line : -1));
    else if(all.some(t => SUBSEC.test(secOf(t)))) list = all.filter(t => SUBSEC.test(secOf(t)));
    return list.filter(t => !HABIT_RE.test(String(t.text||"")) && clean(t.text)!=="");
  }
  const goalPathOf = p => {
    const g = p.goal;
    if (!g) return "";
    if (typeof g === "object" && g.path) return g.path;
    const nm = String(g).replace(/^\[\[|\]\]$/g, "").replace(/\|.*$/, "").replace(/#.*$/, "").trim();
    if (!nm) return "";
    try { const dest = app.metadataCache.getFirstLinkpathDest(nm, p.file.path); if (dest) return dest.path; } catch (e) {}
    return "";
  };

  dv.container.classList.add("dt-wrap");

  const me = dv.current();
  const day = iso(me && me.date) || String((me && me.file && me.file.name) || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    dv.paragraph("_Couldn't read this note's day — add a `date: YYYY-MM-DD` property._");
  } else {
    // PAUSE §3 — a paused goal's tasks plan no work either (the cascade is computed,
    // never written), so collect the paused goals once and skip anything under them.
    const pausedGoals = new Set();
    for (const g of dv.pages('"Goals"').where(p => p && p.type === "goal").array()) {
      if (EXCL.test(g.file.path)) continue;
      if (String(g.status == null ? "" : g.status).toLowerCase().trim() === "paused")
        pausedGoals.add(String(g.file.path).toLowerCase());
    }
    const rows = [];
    for (const pg of dv.pages('"Tasks"').where(p => p.type === "task").array()) {
      if (EXCL.test(pg.file.path)) continue;                     // never read templates/archives
      const status = String(pg.status == null ? "" : pg.status).toLowerCase().trim();
      if (status === "done") continue;                            // finished tasks don't plan work
      const gp = goalPathOf(pg);
      if (status === "paused" || (gp && pausedGoals.has(String(gp).toLowerCase()))) continue;
      for (const t of subsOf(pg)) {
        if (iso(t.due) !== day) continue;
        rows.push({
          k0: t.completed ? 1 : 0,
          k1: String(pg.file.name).toLowerCase(),
          k2: (t.line == null ? 0 : t.line),
          cells: [
            (t.completed ? "☑ " : "☐ ") + clean(t.text),
            dv.fileLink(pg.file.path),
            gp ? dv.fileLink(gp) : "—",
            status || "—"
          ]
        });
      }
    }
    rows.sort((a, b) => (a.k0 - b.k0) || a.k1.localeCompare(b.k1) || (a.k2 - b.k2));

    if (!rows.length) {
      dv.paragraph("_Nothing planned for this day from your task notes._");
    } else {
      const before = dv.container.querySelectorAll("table").length;
      dv.table(["Sub-task", "Task", "Goal", "Status"], rows.map(r => r.cells));
      // Dataview fills the rows asynchronously but creates the <table> synchronously,
      // so it is safe to tag the element itself (not its rows) right here.
      const tables = dv.container.querySelectorAll("table");
      if (tables.length > before) tables[tables.length - 1].classList.add("dt");
    }
  }
} catch (e) {
  dv.paragraph("**📅 Planned today — error:** " + ((e && e.message) ? e.message : String(e)));
}
```

## ✅ Done today

```dataviewjs
// ── ✅ Done today ─────────────────────────────────────────────────────────────
// Sub-tasks whose ✅ date is THIS note's day, plus whole task notes whose
// `completed:` property is this day (rendered as a 🏁 flagged row).
// The table is hand-built so the flagged <tr> can carry class `flag`: Dataview's
// dv.table() appends its rows asynchronously, so row classes can't be added after it.
try {
  const iso = v => (v && typeof v.toISODate === "function") ? v.toISODate()
    : (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) ? v.slice(0, 10) : "";
  const clean = s => String(s == null ? "" : s)
    .replace(/(?:📅|⏳|🛫|✅|➕|🔁)\s*\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/[📅⏳🛫✅➕🔁]/gu, " ")
    .replace(/(?:⏫|🔼|🔽|⏬|🔺)/g, " ")
    .replace(/\s+\^[A-Za-z0-9-]+$/, " ")
    .replace(/(^|\s)#(?=[^\s]*[\p{L}_])[\p{L}\p{N}_\/-]+/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const EXCL = /(^|\/)(Fitness|_templates|_archive|Archive|\.trash)(\/|$)/i;
  const SUBSEC = /sub[-\s]?tasks?/i;
  const HABIT_RE = /(^|\s)#habit(\/[\p{L}\p{N}_/-]+)*(?=$|\s)/u;
  const secOf = t => { const s = t && (t.section || t.header); return s ? String(s.subpath || s.display || "") : ""; };
  /* SPEC §1 sub-task selection — heading-ancestor aware, identical in Dashboard.md /
     goal-panel.txt / 🎯 Goals.md / 📋 Tasks.md / daily-tables.txt. Keep it that way. */
  function subMarks(path){
    let hs = [];
    try { const f = app.vault.getAbstractFileByPath(path); hs = (f && (app.metadataCache.getFileCache(f)||{}).headings) || []; } catch(e){ hs = []; }
    const marks = [], stack = [];
    for(const h of hs){
      const lvl = h.level || 1;
      const ln = (h.position && h.position.start) ? h.position.start.line : 0;
      while(stack.length && stack[stack.length-1].lvl >= lvl) stack.pop();
      stack.push({ lvl: lvl, sub: SUBSEC.test(String(h.heading||"")) });
      marks.push({ line: ln, under: stack.some(x => x.sub) });
    }
    return marks;
  }
  function subsOf(p){
    let all = [];
    try { all = Array.from(p.file.tasks || []); } catch(e){ all = []; }
    const marks = subMarks(p.file.path);
    const underAt = ln => { let u = false; for(const m of marks){ if(m.line < ln) u = m.under; else break; } return u; };
    let list = all;
    if(marks.some(m => m.under)) list = all.filter(t => underAt(t.line != null ? t.line : -1));
    else if(all.some(t => SUBSEC.test(secOf(t)))) list = all.filter(t => SUBSEC.test(secOf(t)));
    return list.filter(t => !HABIT_RE.test(String(t.text||"")) && clean(t.text)!=="");
  }
  const goalPathOf = p => {
    const g = p.goal;
    if (!g) return "";
    if (typeof g === "object" && g.path) return g.path;
    const nm = String(g).replace(/^\[\[|\]\]$/g, "").replace(/\|.*$/, "").replace(/#.*$/, "").trim();
    if (!nm) return "";
    try { const dest = app.metadataCache.getFirstLinkpathDest(nm, p.file.path); if (dest) return dest.path; } catch (e) {}
    return "";
  };

  dv.container.classList.add("dt-wrap");

  const me = dv.current();
  const day = iso(me && me.date) || String((me && me.file && me.file.name) || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    dv.paragraph("_Couldn't read this note's day — add a `date: YYYY-MM-DD` property._");
  } else {
    const subs = [], flags = [], touched = new Set();
    for (const pg of dv.pages('"Tasks"').where(p => p.type === "task").array()) {
      if (EXCL.test(pg.file.path)) continue;
      const gp = goalPathOf(pg);
      const nm = String(pg.file.name).toLowerCase();
      for (const t of subsOf(pg)) {
        if (iso(t.completion) !== day) continue;
        subs.push({ k1: nm, k2: (t.line == null ? 0 : t.line), text: "☑ " + clean(t.text), task: pg.file.path, goal: gp });
        touched.add(pg.file.path);
      }
      if (iso(pg.completed) === day) flags.push({ k1: nm, k2: 0, text: "🏁 Task completed", task: pg.file.path, goal: gp });
    }
    const bySort = (a, b) => a.k1.localeCompare(b.k1) || (a.k2 - b.k2);
    subs.sort(bySort); flags.sort(bySort);

    const n = subs.length, m = touched.size, k = flags.length;
    if (!n && !k) {
      dv.paragraph("_Nothing logged for this day yet — check something off from the Dashboard._");
    } else {
      const parts = [];
      if (n) parts.push(n + " sub-task" + (n === 1 ? "" : "s") + " across " + m + " task" + (m === 1 ? "" : "s"));
      if (k) parts.push(k + " task" + (k === 1 ? "" : "s") + " completed");
      const sum = dv.el("div", "", { cls: "dt-sum" });
      sum.className = "dt-sum";
      sum.innerHTML = esc(parts.join(" · "));

      const linkInto = (td, path) => {
        const l = dv.fileLink(path);
        const a = document.createElement("a");
        const href = (l && l.path) ? l.path : String(path);
        a.className = "internal-link";
        a.setAttribute("data-href", href);
        a.setAttribute("href", href);
        a.textContent = (l && l.display) ? l.display : String(path).split("/").pop().replace(/\.md$/, "");
        a.addEventListener("click", ev => {
          ev.preventDefault();
          try { app.workspace.openLinkText(href, "", false); } catch (err) {}
        });
        td.appendChild(a);
      };

      const table = document.createElement("table");
      table.className = "dataview table-view-table dt";
      const thead = document.createElement("thead");
      const htr = document.createElement("tr");
      for (const h of ["Sub-task", "Task", "Goal"]) {
        const th = document.createElement("th"); th.textContent = h; htr.appendChild(th);
      }
      thead.appendChild(htr); table.appendChild(thead);
      const tbody = document.createElement("tbody");
      const push = (r, isFlag) => {
        const tr = document.createElement("tr");
        if (isFlag) tr.className = "flag";
        const c0 = document.createElement("td"); c0.textContent = r.text; tr.appendChild(c0);
        const c1 = document.createElement("td"); linkInto(c1, r.task); tr.appendChild(c1);
        const c2 = document.createElement("td");
        if (r.goal) linkInto(c2, r.goal); else c2.textContent = "—";
        tr.appendChild(c2);
        tbody.appendChild(tr);
      };
      subs.forEach(r => push(r, false));
      flags.forEach(r => push(r, true));
      table.appendChild(tbody);
      dv.container.appendChild(table);
    }
  }
} catch (e) {
  dv.paragraph("**✅ Done today — error:** " + ((e && e.message) ? e.message : String(e)));
}
```

## 🔥 Habits
> Check what you did. These feed your heatmap & streaks automatically. Add new habits from the dashboard's **+ Add a habit** box and they'll appear here too.

- [ ] 🏃 Move / exercise #habit/move
- [ ] 💧 Water #habit/water
- [ ] 📖 Read #habit/read
- [ ] 🧠 Learn something #habit/learn
- [ ] 😴 Sleep prep #habit/sleep

## 🏋️ Workout
```dataviewjs
try {
  const cur = dv.current();
  const w = dv.page("🏋️ Workouts");
  const names = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  let wd = "";
  try { wd = cur.date ? cur.date.toFormat("cccc") : ""; } catch(e){}
  if (!wd) { const d = new Date((cur.file.name.slice(0,10)) + "T00:00"); if (!isNaN(d)) wd = names[d.getDay()]; }
  const sess = (w && w.schedule && wd) ? (w.schedule[wd] || "Rest") : "Rest";
  if (String(sess).toLowerCase() === "rest") dv.paragraph("😴 **Rest day** — light mobility & good sleep.");
  else dv.paragraph("💪 **Today: " + sess + "** — open [[" + sess + "]] for the full session, or tap **＋ Log in today's note** on your [[Dashboard]] to drop the checklist here.");
} catch(e) { dv.paragraph("_Set up your weekly plan in [[🏋️ Workouts]]._"); }
```

## 📝 Notes


## 🌙 Shutdown
**Win of the day:** 

**One next step on anything I touched:** 
