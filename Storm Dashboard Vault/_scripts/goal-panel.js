try {
/* ═══════════════════════════════════════════════════════════════════════════
   🎯 GOAL PANEL — health + custom SVG Gantt + task list.
   Loaded by `await dv.view("_scripts/goal-panel")`; the note holds that ONE line.
   Renders into dv.container (in a view `this` is NOT the block component).
   The note property contract is unchanged: `type: goal`.
   Reads dv.current() as the goal; collects Tasks/ notes whose `goal:` links here.
   Rules follow SPEC §2 exactly (progress / health / next move / dates).
   ═══════════════════════════════════════════════════════════════════════════ */
const root = dv.container;

/* ── tiny local helpers (standalone note — no Dashboard helpers available) ── */
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const two = n => String(n).padStart(2,"0");
const localIso = d => `${d.getFullYear()}-${two(d.getMonth()+1)}-${two(d.getDate())}`;
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const todayIso = localIso(new Date());
/* any Dataview date / Date / "YYYY-MM-DD" → local ISO string ("" when absent) */
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
const addDays = (iso,n) => { const d=dOf(iso); if(!d) return ""; d.setDate(d.getDate()+n); return localIso(d); };
const minIso = (a,b) => !a ? (b||"") : !b ? a : (a<b?a:b);
const maxIso = (a,b) => !a ? (b||"") : !b ? a : (a>b?a:b);
const fmtMD = (iso,yr) => { const d=dOf(iso); return d ? MON[d.getMonth()]+" "+d.getDate()+(yr?" "+d.getFullYear():"") : ""; };
const r2 = n => Math.round(n*100)/100;
const trunc = (s,n) => { s=String(s==null?"":s); return s.length>n ? s.slice(0,n-1)+"…" : s; };
/* strip Tasks-plugin emoji + dates + #tags from a checkbox line */
const clean = s => String(s==null?"":s)
  .replace(/(?:📅|⏳|🛫|✅|➕|🔁)\s*\d{4}-\d{2}-\d{2}/g," ")
  .replace(/[📅⏳🛫✅➕🔁]/gu," ")
  .replace(/(?:⏫|🔼|🔽|⏬|🔺)/g," ")
  .replace(/\s+\^[A-Za-z0-9-]+$/," ")
  .replace(/(^|\s)#(?=[^\s]*[\p{L}_])[\p{L}\p{N}_\/-]+/gu,"$1")
  .replace(/\s+/g," ").trim();

/* ── robust link matching: p.goal may be a Link {path}, "[[Name]]",
      "[[Name|alias]]", a bare name, or an array of any of those ── */
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
function linksTo(v, target){
  if(!target || !target.file) return false;
  const p = String(target.file.path).toLowerCase(), n = String(target.file.name).toLowerCase();
  return linkNames(v).some(r => String(r).toLowerCase()===p || baseOf(r).toLowerCase()===n);
}

/* ── SPEC §2 health ── */
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

/* ── PAUSE §4 — writes. Line-based frontmatter (setFm ported VERBATIM from the
      work vault's initHub.js) + the Timeline's exact-match line resolution.
      processFrontMatter is deliberately NOT used: it reorders and reformats keys. ── */
const notify = msg => { try { const ob = require("obsidian"); new ob.Notice(msg, 6000); } catch(e){ console.warn(msg); } };
const refresh = () => { try { app.metadataCache.trigger("dataview:refresh-views"); } catch(e){} };
function fmBounds(text){
  const lines = String(text||"").split("\n");
  if(lines[0] !== "---") return null;
  let end = 1; while(end<lines.length && lines[end] !== "---") end++;
  return end < lines.length ? { lines, end } : null;
}
function fmValueOf(text, key){
  const b = fmBounds(text); if(!b) return "";
  const re = new RegExp("^"+key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+":\\s*(.*)$");
  for(let i=1;i<b.end;i++){ const m=re.exec(b.lines[i]); if(m) return m[1].trim().replace(/^["']|["']$/g,""); }
  return "";
}
function setFm(text, patch){
  const b = fmBounds(text);
  const fmt = v => (v===""||v==null) ? "" : " "+v;
  if(!b){
    const head = ["---"]; for(const k of Object.keys(patch)) head.push(k+":"+fmt(patch[k]));
    head.push("---");
    return head.concat(String(text||"").split("\n")).join("\n");
  }
  const lines = b.lines; let end = b.end;
  for(const k of Object.keys(patch)){
    const re = new RegExp("^"+k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+":");
    let hit = -1; for(let i=1;i<end;i++){ if(re.test(lines[i])){ hit=i; break; } }
    const line = k+":"+fmt(patch[k]);
    if(hit>=0){ let j=hit+1; while(j<end && /^\s+\S/.test(lines[j])) j++; lines.splice(hit, j-hit, line); end -= (j-hit-1); }
    else { lines.splice(end, 0, line); end++; }
  }
  return lines.join("\n");
}
function delFm(text, key){
  const b = fmBounds(text); if(!b) return text;
  const lines = b.lines; let end = b.end;
  const re = new RegExp("^"+key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+":");
  for(let i=1;i<end;i++){
    if(!re.test(lines[i])) continue;
    let j=i+1; while(j<end && /^\s+\S/.test(lines[j])) j++;
    lines.splice(i, j-i); end -= (j-i); i--;
  }
  return lines.join("\n");
}
/* setFm/delFm are LF-only; the note keeps whatever line endings it already had */
const isCRLF = s => /\r\n/.test(String(s||""));
const toLF = s => String(s||"").replace(/\r\n/g,"\n");
function applyFm(text, patch, drop){
  const crlf = isCRLF(text);
  let s = toLF(text);
  if(patch && Object.keys(patch).length) s = setFm(s, patch);
  (drop||[]).forEach(k => { s = delFm(s, k); });
  return crlf ? s.replace(/\n/g,"\r\n") : s;
}
/* exact-match line resolution — copied from _scripts/task-gantt.js (never a substring) */
const isBox = l => /^\s*[-*]\s*\[[ xX]\]/.test(l||"");
const norm = s => String(s||"").replace(/\s+/g," ").trim().toLowerCase();
const boxText = l => norm(clean(String(l||"").replace(/^\s*[-*]\s*\[[ xX]\]\s?/, "")));
function findLine(lines, line, text){
  const want = norm(text);
  const at = Number(line);
  if(at >= 0 && at < lines.length && isBox(lines[at]) && want && boxText(lines[at]) === want) return at;
  if(!want) return -1;
  const hits = []; lines.forEach((l,i) => { if(isBox(l) && boxText(l) === want) hits.push(i); });
  if(hits.length === 1) return hits[0];
  return -1;
}
/* every Tasks-plugin date stamp that a date shift moves */
const SHIFT_RE = /(\u{1F4C5}|\u{1F6EB}|⏳)(\s*)(\d{4}-\d{2}-\d{2})/gu;

/* ═══ ADDTASK §1 — the note a "＋ Task" writes ════════════════════════════════
   A goal note knows its own identity, so creating work under it needs nothing but
   a name. There are three ways to make a task note — the Templater template, the
   Dashboard's `task:` route and this button — and they must not drift, so the text
   below is the body expression of `createTaskNote()` in dashboard/initHub.js,
   character for character. Change one, change both (tests/P asserts the equality).
   ═══════════════════════════════════════════════════════════════════════════ */
const NOUN = "task", NOUNC = "Task";          /* rx3 says campaign / Campaign */
/* CONTRACT A + THEME2 §C — the Timeline is CALLED, not pasted, and the call says
   so when the file is not there. Line 1 resolves the view exactly as Dataview
   does, line 2 is the call, line 3 is the message a half-synced phone sees
   instead of Dataview's "custom view not found for '…'". The fence is spelled
   with \u0060 escapes so this file holds no literal triple backtick: one would
   close the fenced block in 🎯 Goals.md, and integrate.py rejects one in a
   dv.view file. The whole ADDTASK §1 block is byte-identical in both — keep it so. */
const FENCE = "\u0060\u0060\u0060";
const viewBlock = n => FENCE + "dataviewjs\n" +
  "const p = \"_scripts/" + n + "\", f = x => app.metadataCache.getFirstLinkpathDest(x, \"\");\n" +
  "if (f(p + \".js\") || f(p + \"/view.js\")) await dv.view(p);\n" +
  "else dv.el(\"div\", \"⚠️ \" + p + \".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.\", { cls: \"panel-err storm-missing-view\" });\n" +
  FENCE;
/* safeName / freePath / ensureFolder — ported VERBATIM from dashboard/initHub.js */
const safeName = s => String(s||"").replace(/[\\/:*?"<>|#^[\]]/g,"").trim();
async function ensureFolder(p){ if(!app.vault.getAbstractFileByPath(p)){ try{ await app.vault.createFolder(p); }catch(e){} } }
async function freePath(folder, name){
  let p = folder+"/"+name+".md";
  if(app.vault.getAbstractFileByPath(p)) p = folder+"/"+name+" 2.md";
  if(app.vault.getAbstractFileByPath(p)) p = folder+"/"+name+" "+Date.now()+".md";
  return p;
}
function taskNoteText(nm, goalName, start, end){
  return "---\ntype: task\ngoal: "+(goalName?JSON.stringify("[["+goalName+"]]"):"")+"\nstatus: active\nstart: "+start+"\nend: "+end+"\ncompleted: \ntags:\n  - task\n---\n\n"
    + (goalName?"[["+goalName+"|← Goal]]":"[[🎯 Goals|← Goals]]")+"　·　[[Dashboard|Dashboard]]\n\n# "+nm+"\n\n"
    + "> Sub-tasks below show on the Dashboard as your next move. Add a 📅 date to any of them.\n\n"
    + "## 📆 Timeline\n\n" + viewBlock("task-gantt") + "\n\n"
    + "## Sub-tasks\n- [ ] \n\n## 🗒️ Notes\n";
}

/* ── collect this goal's tasks ── */
const me = dv.current();
const NOTE = (me && me.file) ? me.file.path : "";
const gName = (me && me.file) ? me.file.name : "";
const gPausedOn = isoOf(me && me.paused);          /* PAUSE §1 — set by the Pause button */
const gPaused = String((me && me.status) || "active").toLowerCase().trim() === "paused";
const EXCL = /(^|\/)(Fitness|_templates|_archive|Archive|\.trash)(\/|$)/i;
const SUBSEC = /sub[-\s]?tasks?/i;
const HABIT_RE = /(^|\s)#habit(\/[\p{L}\p{N}_/-]+)*(?=$|\s)/u;
const secOf = t => { const s = t && (t.section || t.header); return s ? String(s.subpath || s.display || "") : ""; };
/* SPEC §1 sub-task selection — heading-ancestor aware, identical in Dashboard.md /
   goal-panel.js / 🎯 Goals.md / 📋 Tasks.md / daily-tables.txt. Keep it that way. */
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
const pages = dv.pages('"Tasks"').where(p => p && p.type==="task" && !EXCL.test(p.file.path) && linksTo(p.goal, me));

const tasks = pages.array().map(p => {
  const subs = subsOf(p);
  const total = subs.length;
  const done = subs.filter(t => !!t.completed).length;
  const progress = total ? done/total : 0;
  const s = isoOf(p.start), e = isoOf(p.end);
  const status = String(p.status || "active").toLowerCase().trim();
  const open = subs.filter(t => !t.completed);
  const dated = open.filter(t => isoOf(t.due)).sort((a,b)=>{ const x=isoOf(a.due), y=isoOf(b.due); return x<y?-1:x>y?1:(a.line||0)-(b.line||0); });
  const nm = dated[0] || open[0] || null;
  /* HEALTH contract — counted here, in the walk the panel already does over the
     sub-tasks, and carried on the row so the goal roll-up below can total it. */
  const hOpts = { overdue: open.filter(t => { const d = isoOf(t.due); return d && d < todayIso; }).length,
                  dated: subs.some(t => !!isoOf(t.due)), remaining: open.length };
  /* PAUSE §1/§2 — effective paused cascades from the goal; the task note is never rewritten */
  const paused = status === "paused" || gPaused;
  return { name:p.file.name, path:p.file.path, status, start:s, end:e,
           completed:isoOf(p.completed), done, total, progress, paused, hOpts,
           subs: subs.map(x => ({ line: (x.line != null ? x.line : -1), text: clean(x.text), done: !!x.completed })),
           health: healthOf(paused ? "paused" : status, progress, s, e, hOpts),
           next: nm ? clean(nm.text) : "", nextDue: nm ? isoOf(nm.due) : "" };
});

/* ── goal roll-up (SPEC §2) ── */
const nTasks = tasks.length;
const sumDone = tasks.reduce((a,t)=>a+t.done,0);
const sumTotal = tasks.reduce((a,t)=>a+t.total,0);
const gProg = sumTotal ? sumDone/sumTotal : (nTasks ? tasks.filter(t=>t.status==="done").length/nTasks : 0);
let gStart = "", maxEnd = "", maxAny = "";
tasks.forEach(t => {
  if(t.start){ gStart = minIso(gStart, t.start); maxAny = maxIso(maxAny, t.start); }
  if(t.end){ maxEnd = maxIso(maxEnd, t.end); maxAny = maxIso(maxAny, t.end); }
});
const target = isoOf(me && me.target);
const gEnd = target || maxEnd;
const gStatus = String((me && me.status) || "active").toLowerCase().trim();
/* HEALTH contract — the goal's overdue is the total across its non-paused tasks
   (PAUSE §3: paused work is never late), run through the same thresholds. */
const gLive = tasks.filter(t => t.status !== "paused" && t.status !== "done");
const gOpts = { overdue: gLive.reduce((a,t)=>a+t.hOpts.overdue,0),
                dated: gLive.some(t => t.hOpts.dated),
                remaining: gLive.reduce((a,t)=>a+t.hOpts.remaining,0) };
const gHealth = healthOf(gStatus, gProg, gStart, gEnd, gOpts);

/* ── chart window: min(start) → max(end, target, today+7d), at least 8 weeks ── */
let winStart = gStart || todayIso;
let winEnd = maxIso(maxIso(maxAny, target), addDays(todayIso, 7));   // maxAny keeps every bar inside the window
if(!winEnd || winEnd < winStart) winEnd = addDays(winStart, 56);
if(dayDiff(winStart, winEnd) < 56) winEnd = addDays(winStart, 56);
const spanDays = Math.max(1, dayDiff(winStart, winEnd));
const showYears = String(winStart).slice(0,4) !== String(winEnd).slice(0,4);

/* ── geometry (logical viewBox units) ── */
const W = 1000, LBL = 220, PADR = 12, X0 = LBL, X1 = W - PADR, CW = X1 - X0;
const AXIS = 40, ROWH = 26, BARH = 16, PADB = 16;
const xOf = iso => r2(X0 + CW * (dayDiff(winStart, iso) / spanDays));
const clampX = x => Math.max(X0, Math.min(X1, x));

const rows = tasks.filter(t => t.start || t.end)
  .map(t => ({ t, bs: t.start || t.end, be: t.end || t.start }))
  .sort((a,b) => a.bs<b.bs ? -1 : a.bs>b.bs ? 1 : (a.t.name<b.t.name ? -1 : 1));
const backlog = tasks.filter(t => !t.start && !t.end);
const H = AXIS + rows.length*ROWH + PADB;

/* ── month axis ── */
const ticks = [];
(function(){
  const s = dOf(winStart); if(!s) return;
  let m = new Date(s.getFullYear(), s.getMonth(), 1);
  if(localIso(m) < winStart) m = new Date(s.getFullYear(), s.getMonth()+1, 1);
  let guard = 0;
  while(localIso(m) <= winEnd && guard++ < 400){
    ticks.push({ iso: localIso(m), label: MON[m.getMonth()] + (m.getMonth()===0 ? " " + m.getFullYear() : "") });
    m = new Date(m.getFullYear(), m.getMonth()+1, 1);
  }
})();
const monthW = CW * (30.44/spanDays);
const lblEvery = Math.max(1, Math.ceil(30/Math.max(1, monthW)));

let axisSvg = `<g class="g-axis"><line class="g-aline" x1="${X0}" y1="28" x2="${X1}" y2="28"></line>`;
ticks.forEach((tk,i) => {
  const x = xOf(tk.iso);
  axisSvg += `<line class="g-tick" x1="${x}" y1="28" x2="${x}" y2="${H-6}"></line>`;
  if(i % lblEvery === 0) axisSvg += `<text class="g-mon" x="${r2(x+3)}" y="20" font-size="12">${esc(tk.label)}</text>`;
});
axisSvg += `</g>`;

/* ── rows ── */
const rowsSvg = rows.map((r,i) => {
  const t = r.t;
  const y = AXIS + i*ROWH;
  const bx = clampX(xOf(r.bs));
  const bw = Math.max(4, r2(clampX(xOf(r.be)) - bx));
  const fw = r2(bw * t.progress);
  const dates = fmtMD(r.bs, showYears) + " → " + fmtMD(r.be, showYears);
  const tip = `${t.name} · ${dates} · ${t.done}/${t.total} · ${HL[t.health]}`;
  return `<g class="g-row" data-link="${esc(t.path)}" data-status="${esc(t.status)}" data-health="${esc(t.health)}"${t.paused?` data-paused="1"`:``} tabindex="0" role="link">`
    + `<title>${esc(tip)}</title>`
    + `<text class="g-label" x="8" y="${y+17}" font-size="12" title="${esc(t.name)}">${esc(trunc(t.name,28))}</text>`
    + `<rect class="g-bar st-${esc(t.status)}" x="${bx}" y="${y+5}" width="${bw}" height="${BARH}" rx="4"></rect>`
    + `<rect class="g-fill" x="${bx}" y="${y+5}" width="${fw}" height="${BARH}" rx="4"></rect>`
    + `</g>`;
}).join("");

/* ── today marker ── */
let todaySvg = "";
if(todayIso >= winStart && todayIso <= winEnd){
  const tx = xOf(todayIso);
  todaySvg = `<line class="g-today" x1="${tx}" y1="28" x2="${tx}" y2="${H-6}"></line>`;
}

/* ── head ── */
const head = `<div class="goalhead">`
  + `<span class="goal-hb hb ${esc(gHealth)}">${esc(HL[gHealth])}</span> `
  + `<span class="goal-prog">${Math.round(gProg*100)}%</span> `
  + `<span class="goal-meta">${nTasks===1?"1 task":nTasks+" tasks"} · window ${esc(fmtMD(winStart,showYears))} – ${esc(fmtMD(winEnd,showYears))}</span>`
  + (gPaused
      ? `<button class="resumebtn" type="button" data-resume title="Resume this goal">▶ Resume</button>`
      : `<button class="pausebtn" type="button" data-pause title="Pause this goal — it and its tasks go quiet on the Dashboard until you resume">⏸️ Pause</button>`)
  /* ADDTASK §1 — a paused goal keeps this button on purpose: parking a goal stops
     it nagging, it does not stop you planning. The new task inherits the pause
     through the existing cascade, so it stays quiet until the goal resumes. */
  + `<button class="addtaskbtn" type="button" data-addtask title="Add a ${NOUN} to this goal">＋ ${NOUNC}</button>`
  + `</div>`
  + `<div class="addtaskbar"></div>`
  + `<div class="resumebar"></div>`;

/* ── chart / empty state ── */
let chart = "";
if(!nTasks){
  chart = `<div class="g-empty">No tasks point at this goal yet — press <b>＋ ${NOUNC}</b> above to add the first one.</div>`;
} else {
  chart = `<div class="gantt-wrap"><svg class="gantt" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMinYMin meet" role="img" aria-label="Gantt chart of tasks for this goal">`
    + axisSvg + rowsSvg + todaySvg + `</svg></div>`;
}

/* ── backlog chips (undated tasks) ── */
let backlogHtml = "";
if(backlog.length){
  backlogHtml = `<div class="g-backlog"><span class="g-blabel">Backlog:</span>`
    + backlog.map(t => `<span class="g-chip st-${esc(t.status)}" data-link="${esc(t.path)}" title="${esc(t.name)} · no dates yet">${esc(t.name)}</span>`).join("")
    + `</div>`;
}

/* ── task list (same order as the chart, undated appended) ── */
const listOrder = rows.map(r=>r.t).concat(backlog);
let listHtml = "";
if(nTasks){
  listHtml = `<div class="g-tasklist">` + listOrder.map(t => {
    const nx = t.next ? esc(t.next) : "—";
    const dt = t.nextDue ? `📅 ${esc(fmtMD(t.nextDue))}` : "—";
    return `<div class="g-task" data-health="${esc(t.health)}"${t.paused?` data-paused="1"`:``}>`
      + `<span class="tchip st-${esc(t.status)}">${esc(t.status)}</span>`
      + `<span class="g-tname" data-link="${esc(t.path)}">${esc(t.name)}</span>`
      + `<span class="g-tnext${t.next?"":" none"}">${nx}</span>`
      + `<span class="g-tdate${t.nextDue?"":" none"}">${dt}</span>`
      + `<span class="g-tprog">${t.done}/${t.total}</span>`
      + `</div>`;
  }).join("") + `</div>`;
}

root.innerHTML = `<div class="goalpanel"${gPaused?` data-paused="1"`:``}>${head}${chart}${backlogHtml}${listHtml}</div>`;

/* ── PAUSE §4 — pause / resume, one vault.modify per file, no dialogs ─────── */
const bar = root.querySelector(".resumebar");
let busy = false, resumed = false;
function clearBar(){ if(bar) bar.innerHTML = ""; }

async function doPause(){
  if(busy) return; busy = true;
  try{
    const f = app.vault.getAbstractFileByPath(NOTE); if(!f) return;
    const txt = await app.vault.read(f);
    if(String(fmValueOf(toLF(txt),"status")||"").toLowerCase().trim() === "paused"){ refresh(); return; }  // already paused — no-op
    await app.vault.modify(f, applyFm(txt, { status:"paused", paused: todayIso }, []));
    notify(`Paused “${gName}”. It stays on 🎯 Goals; resume any time.`);
    refresh();
  } catch(e){ console.error("goal-panel pause", e); notify("Could not pause this goal — " + (e && e.message ? e.message : e)); }
  finally { busy = false; }
}

async function doResume(shiftN){
  if(busy || resumed) return; busy = true;
  try{
    const gf = app.vault.getAbstractFileByPath(NOTE); if(!gf) return;
    const gtxt = await app.vault.read(gf);
    const gLF = toLF(gtxt);
    const cur = String(fmValueOf(gLF,"status")||"").toLowerCase().trim();
    if(cur !== "paused" && !fmValueOf(gLF,"paused")){ clearBar(); refresh(); return; }   // already resumed
    let notes = 0, dates = 0;
    const patch = { status:"active" };
    if(shiftN){ const tg = fmValueOf(gLF,"target"); if(/^\d{4}-\d{2}-\d{2}$/.test(tg)){ patch.target = addDays(tg, shiftN); dates++; } }
    await app.vault.modify(gf, applyFm(gtxt, patch, ["paused"]));
    notes++;
    if(shiftN){
      for(const t of tasks){
        if(t.status === "paused") continue;                 /* paused on its own — stays paused, never shifted */
        const f = app.vault.getAbstractFileByPath(t.path); if(!f) continue;
        const txt = await app.vault.read(f);
        const crlf = isCRLF(txt);
        const lines = toLF(txt).split("\n");
        let moved = 0;
        for(const s of t.subs){                              /* checked sub-tasks are history — never touched */
          if(s.done) continue;
          const at = findLine(lines, s.line, s.text);
          if(at < 0) continue;
          lines[at] = lines[at].replace(SHIFT_RE, (m,e,sp,d) => { moved++; return e+sp+addDays(d, shiftN); });
        }
        let out = lines.join("\n");
        const fp = {}, st = fmValueOf(out,"start"), en = fmValueOf(out,"end");
        if(/^\d{4}-\d{2}-\d{2}$/.test(st)){ fp.start = addDays(st, shiftN); moved++; }
        if(/^\d{4}-\d{2}-\d{2}$/.test(en)){ fp.end = addDays(en, shiftN); moved++; }
        if(Object.keys(fp).length) out = setFm(out, fp);
        if(crlf) out = out.replace(/\n/g,"\r\n");
        if(out !== txt){ await app.vault.modify(f, out); notes++; dates += moved; }
      }
    }
    resumed = true;
    clearBar();
    notify(shiftN
      ? `Resumed “${gName}” — shifted ${dates} date${dates===1?"":"s"} across ${notes} note${notes===1?"":"s"} by ${shiftN} day${shiftN===1?"":"s"}.`
      : `Resumed “${gName}”.`);
    refresh();
  } catch(e){ console.error("goal-panel resume", e); notify("Could not resume this goal — " + (e && e.message ? e.message : e)); }
  finally { busy = false; }
}

function openResumeBar(){
  if(!bar || busy || resumed) return;
  const n = gPausedOn ? dayDiff(gPausedOn, todayIso) : 0;
  const lead = n >= 1
    ? `Resume “${esc(gName)}”? paused ${n} day${n===1?"":"s"}.`
    : `Resume “${esc(gName)}”?`;
  bar.innerHTML = `<span class="rb-q">${lead}</span>`
    + (n >= 1 ? `<button type="button" data-resume-do="${n}">Shift remaining dates +${n}d</button>` : ``)
    + `<button type="button" data-resume-do="0">${n >= 1 ? "Resume as-is" : "Resume"}</button>`
    + `<button type="button" data-resume-cancel>Cancel</button>`;
  bar.querySelectorAll("[data-resume-do]").forEach(b => b.addEventListener("click", ev => {
    ev.preventDefault(); ev.stopPropagation(); doResume(parseInt(b.getAttribute("data-resume-do"),10) || 0);
  }));
  const cx = bar.querySelector("[data-resume-cancel]");
  if(cx) cx.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); clearBar(); });
}

const pauseBtn = root.querySelector("[data-pause]");
if(pauseBtn) pauseBtn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); doPause(); });
const resumeBtn = root.querySelector("[data-resume]");
if(resumeBtn) resumeBtn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); openResumeBar(); });

/* ═══ ADDTASK §2 — the inline row, one vault.create per task ══════════════════
   Same spirit as the Timeline's ＋ row and the resume bar: an in-panel row, never
   a modal and never a confirm / prompt dialog (both freeze the plugin host). Add
   keeps the row open and focused so several tasks can be added without leaving the
   goal; Add & open hands the note over. The `busy` flag above is shared with pause/resume,
   so two fast clicks write one note.
   ═══════════════════════════════════════════════════════════════════════════ */
const addBar = root.querySelector(".addtaskbar");
const atq = sel => addBar ? addBar.querySelector(sel) : null;
function closeAdd(){ if(addBar) addBar.innerHTML = ""; }
function focusAdd(){ const n = atq('[data-at="name"]'); if(n){ try{ n.focus(); }catch(e){} } }

async function doAdd(openIt){
  if(busy || !addBar) return;
  const nameIn = atq('[data-at="name"]'); if(!nameIn) return;
  const raw = String(nameIn.value == null ? "" : nameIn.value).trim();
  if(!raw) return;                                   /* empty / whitespace-only → no write */
  busy = true;
  try{
    const sIn = atq('[data-at="start"]'), eIn = atq('[data-at="end"]');
    const start = isoOf(sIn && sIn.value), end = isoOf(eIn && eIn.value);   /* both may be cleared */
    const nm = safeName(raw) || ("Untitled " + NOUN);
    await ensureFolder("Tasks");
    const path = await freePath("Tasks", nm);        /* never overwrites an existing note */
    await app.vault.create(path, taskNoteText(nm, gName, start, end));
    notify(`Added ${NOUN} “${nm}” to “${gName}”.`);
    refresh();
    if(openIt){ closeAdd(); if(app && app.workspace) app.workspace.openLinkText(path, "", false); }
    else { nameIn.value = ""; focusAdd(); }          /* stay on the goal, ready for the next one */
  } catch(e){ console.error("goal-panel add " + NOUN, e); notify(`Could not create that ${NOUN} — ` + (e && e.message ? e.message : e)); }
  finally { busy = false; }
}

function openAdd(){
  if(!addBar) return;
  if(addBar.firstChild){ focusAdd(); return; }        /* already open — never wipe a half-typed name */
  addBar.innerHTML =
      `<input type="text" data-at="name" placeholder="${esc(NOUNC)} name…" aria-label="${esc(NOUNC)} name" spellcheck="false">`
    + `<input type="date" data-at="start" aria-label="Start date" value="${esc(todayIso)}">`
    + `<input type="date" data-at="end" aria-label="End date" value="${esc(target)}">`
    + `<button type="button" data-at="add" title="Create it and stay on this goal">Add</button>`
    + `<button type="button" data-at="open" title="Create it and open the note">Add &amp; open</button>`
    + `<button type="button" data-at="cancel">Cancel</button>`;
  addBar.querySelectorAll("button[data-at]").forEach(b => b.addEventListener("click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    const k = b.getAttribute("data-at");
    if(k === "cancel") closeAdd(); else doAdd(k === "open");
  }));
  addBar.addEventListener("keydown", ev => {
    if(ev.key === "Escape"){ ev.preventDefault(); ev.stopPropagation(); closeAdd(); }
    else if(ev.key === "Enter" && ev.target && ev.target.getAttribute("data-at") === "name"){
      ev.preventDefault(); ev.stopPropagation(); doAdd(false);
    }
  });
  focusAdd();
}

const addBtn = root.querySelector("[data-addtask]");
if(addBtn) addBtn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); openAdd(); });

/* ── clicks ── */
root.querySelectorAll("[data-link]").forEach(el => {
  el.addEventListener("click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    const link = el.getAttribute("data-link");
    if(link && app && app.workspace) app.workspace.openLinkText(link, "", false);
  });
});

} catch(err) {
  dv.container.innerHTML = '<div class="goal-err" style="color:#e0736b;padding:14px;font-family:sans-serif">🎯 Goal panel error: ' + (err && err.message ? err.message : String(err)) + '</div>';
  console.error(err);
}
