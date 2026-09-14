---
cssclasses:
  - dashboard
tags:
  - dashboard
---

# 📋 Tasks

[[Dashboard|← Dashboard]]　·　[[🎯 Goals|Goals]]

> Every task note lives in `Tasks/`, points at one goal, and keeps its checkboxes under `## Sub-tasks`.
> Add one from the Dashboard with `task: <name> @<goal> <start>-<end>`, and add a step with `sub: <text> <date> -> <task>`.
> Move a card between columns by changing the note's `status` property: `backlog → active → waiting → done`.
> Set `status: paused` to park a task — it lands in **Paused** and stops surfacing on the Dashboard. Tasks under a paused goal stay in their own column, greyed out.

```dataviewjs
try {
/* ═══ 📋 Task board — four status columns (SPEC §1/§2/§5) ═══ */
const root = this.container;

/* ── local helpers ── */
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const two = n => String(n).padStart(2,"0");
const localIso = d => `${d.getFullYear()}-${two(d.getMonth()+1)}-${two(d.getDate())}`;
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const todayIso = localIso(new Date());
const isoOf = v => {
  if(v==null || v==="") return "";
  if(typeof v==="object"){
    if(typeof v.toISODate==="function"){ const s=v.toISODate(); return s||""; }
    if(typeof v.getTime==="function") return localIso(v);
  }
  const s = String(v).trim().slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};
const dOf = iso => { const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso)); return m ? new Date(+m[1], +m[2]-1, +m[3]) : null; };
const dayDiff = (a,b) => { const x=dOf(a), y=dOf(b); return (!x||!y) ? 0 : Math.round((y.getTime()-x.getTime())/86400000); };
const fmtMD = iso => { const d=dOf(iso); return d ? MON[d.getMonth()]+" "+d.getDate() : ""; };
const clean = s => String(s==null?"":s)
  .replace(/(?:📅|⏳|🛫|✅|➕|🔁)\s*\d{4}-\d{2}-\d{2}/g," ")
  .replace(/[📅⏳🛫✅➕🔁]/gu," ")
  .replace(/(?:⏫|🔼|🔽|⏬|🔺)/g," ")
  .replace(/\s+\^[A-Za-z0-9-]+$/," ")
  .replace(/(^|\s)#(?=[^\s]*[\p{L}_])[\p{L}\p{N}_\/-]+/gu,"$1")
  .replace(/\s+/g," ").trim();

const baseOf = s => String(s==null?"":s).split("/").pop().replace(/\.md$/i,"");
function linkNames(v, out){
  out = out || [];
  if(v==null) return out;
  if(Array.isArray(v) || v.__isDA===true){ Array.from(v).forEach(x=>linkNames(x,out)); return out; }
  let raw = "";
  if(typeof v==="object") raw = String(v.path || v.display || (typeof v.toString==="function" ? v.toString() : ""));
  else raw = String(v);
  raw = raw.trim().replace(/^!?\[\[/,"").replace(/\]\]$/,"");
  raw = raw.split("|")[0].split("#")[0].trim();
  if(raw) out.push(raw);
  return out;
}

const HL = { ok:"On track", risk:"At risk", behind:"Behind", done:"Done", unscheduled:"Unscheduled", paused:"Paused" };
function healthOf(status, progress, sIso, eIso, opts){
  if(String(status||"").toLowerCase()==="done") return "done";
  if(String(status||"").toLowerCase()==="paused") return "paused";
  if(!sIso || !eIso) return "unscheduled";
  /* HEALTH contract — deadlines, not elapsed calendar time. opts = { overdue, dated,
     remaining }: overdue = unchecked sub-tasks whose 📅 due date is strictly BEFORE
     today (due TODAY is not overdue — it is the chart's st-today state), dated =
     whether any sub-task carries a 📅 at all, remaining = unchecked count. A goal
     totals overdue/remaining across its non-paused tasks and runs the same rule. */
  const o = opts || {};
  if(o.dated){
    const over = Number(o.overdue) || 0, left = Number(o.remaining) || 0;
    if(eIso < todayIso && left > 0) return "behind";
    if(over === 0) return "ok";
    if(over === 1) return "risk";
    return "behind";
  }
  /* Nothing is dated, so there are no deadlines to measure against: keep the old
     elapsed-vs-progress pacing rule exactly as it was — projected bars already
     assume even pacing across the window, so pace is the only signal available. */
  const span = dayDiff(sIso, eIso);
  let elapsed = span>0 ? dayDiff(sIso, todayIso)/span : (todayIso>=sIso ? 1 : 0);
  elapsed = Math.max(0, Math.min(1, elapsed));
  const gap = progress - elapsed;
  if(gap >= -0.10) return "ok";
  if(gap >= -0.30) return "risk";
  return "behind";
}

/* ── sources ── */
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

/* goal lookup so a card can link to the goal note */
const goalByKey = {};
dv.pages('"Goals"').where(p => p && p.type==="goal" && !EXCL.test(p.file.path)).array().forEach(g => {
  goalByKey[String(g.file.path).toLowerCase()] = g; goalByKey[String(g.file.name).toLowerCase()] = g;
});

const tasks = dv.pages('"Tasks"').where(p => p && p.type==="task" && !EXCL.test(p.file.path)).array().map(p => {
  const subs = subsOf(p);
  const total = subs.length, done = subs.filter(t=>!!t.completed).length;
  const progress = total ? done/total : 0;
  const open = subs.filter(t=>!t.completed);
  const dated = open.filter(t=>isoOf(t.due)).sort((a,b)=>{ const x=isoOf(a.due), y=isoOf(b.due); return x<y?-1:x>y?1:(a.line||0)-(b.line||0); });
  const nm = dated[0] || open[0] || null;
  const keys = linkNames(p.goal);
  let gp = null;
  for(const k of keys){ const kk = String(k).toLowerCase(); const hit = goalByKey[kk] || goalByKey[baseOf(kk)]; if(hit){ gp = hit; break; } }
  const status = String(p.status||"active").toLowerCase().trim();
  const start = isoOf(p.start), end = isoOf(p.end);
  /* PAUSE §1/§3 — only OWN-paused tasks move to the Paused column; a task whose
     goal is paused keeps its column and simply renders muted. */
  const goalPaused = !!(gp && String(gp.status||"").toLowerCase().trim() === "paused");
  const paused = status === "paused" || goalPaused;
  /* HEALTH contract — counted in the walk this board already does over the sub-tasks */
  const hOpts = { overdue: open.filter(t => { const d = isoOf(t.due); return d && d < todayIso; }).length,
                  dated: subs.some(t => !!isoOf(t.due)), remaining: open.length };
  return { name:p.file.name, path:p.file.path, status, start, end, paused, goalPaused,
           completed:isoOf(p.completed), done, total, progress,
           health: healthOf(paused ? "paused" : status, progress, start, end, hOpts),
           goalName: gp ? gp.file.name : (keys[0] ? baseOf(keys[0]) : ""),
           goalPath: gp ? gp.file.path : (keys[0] || ""),
           next: nm ? clean(nm.text) : "", nextDue: nm ? isoOf(nm.due) : "" };
});

const COLS = [
  { key:"backlog", label:"Backlog" },
  { key:"active",  label:"Active"  },
  { key:"waiting", label:"Waiting" },
  { key:"paused",  label:"Paused"  },
  { key:"done",    label:"Done"    }
];
const byStart = (a,b) => {
  const x=a.start||"9999-99-99", y=b.start||"9999-99-99";
  return x<y?-1:x>y?1:(a.name<b.name?-1:a.name>b.name?1:0);
};
const byCompleted = (a,b) => {
  const x=a.completed||"", y=b.completed||"";
  return x>y?-1:x<y?1:(a.name<b.name?-1:a.name>b.name?1:0);
};

const card = t => {
  const dates = (t.start || t.end)
    ? `${esc(fmtMD(t.start||t.end))} → ${esc(fmtMD(t.end||t.start))}`
    : "unscheduled";
  const nx = t.next ? esc(t.next) + (t.nextDue ? ` <span class="tb-due">📅 ${esc(fmtMD(t.nextDue))}</span>` : "") : "—";
  return `<div class="tb-card" data-status="${esc(t.status)}"${t.paused?` data-paused="1"`:``}>`
    + `<div class="tb-row1"><span class="tb-name" data-link="${esc(t.path)}">${esc(t.name)}</span></div>`
    + `<div class="tb-row2">`
    + (t.goalName ? `<span class="tb-goal" data-link="${esc(t.goalPath)}">🎯 ${esc(t.goalName)}</span>` : `<span class="tb-goal none">no goal</span>`)
    + `<span class="tb-dates${(t.start||t.end)?"":" none"}">${dates}</span></div>`
    + `<div class="tb-row3"><span class="hb ${esc(t.health)}">${esc(HL[t.health])}</span>`
    + `<span class="tb-prog">${t.done}/${t.total}</span></div>`
    + `<div class="tb-next${t.next?"":" none"}">${nx}</div>`
    + `</div>`;
};

const board = COLS.map(c => {
  let rows = tasks.filter(t => t.status===c.key);
  const total = rows.length;
  rows = c.key==="done" ? rows.sort(byCompleted).slice(0,10) : rows.sort(byStart);
  const body = rows.length ? rows.map(card).join("") : `<div class="tb-empty">Nothing here.</div>`;
  return `<div class="tb-col" data-col="${c.key}"><div class="tb-head">${c.label} <span class="tb-n">${total}</span></div>${body}</div>`;
}).join("");

root.innerHTML = `<div class="tasksboard">${board}</div>`;

root.querySelectorAll("[data-link]").forEach(el => {
  el.addEventListener("click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    const link = el.getAttribute("data-link");
    if(link && app && app.workspace) app.workspace.openLinkText(link, "", false);
  });
});

} catch(err) {
  this.container.innerHTML = '<div class="goal-err" style="color:#e0736b;padding:14px;font-family:sans-serif">📋 Task board error: ' + (err && err.message ? err.message : String(err)) + '</div>';
  console.error(err);
}
```
