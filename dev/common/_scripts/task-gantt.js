try {
/* ═══════════════════════════════════════════════════════════════════════════
   📆 TASK GANTT — the sub-task timeline for ONE task note (GANTT.md §0).
   Loaded by `await dv.view("_scripts/task-gantt")`; the note holds that ONE line.
   Renders into dv.container (in a view `this` is NOT the block component).
   The note property contract is unchanged: `type: task`.
   Reads dv.current() and the note's own text (ONE vault read, no dv.pages).
   Sub-task selection (subMarks/subsOf/clean) and healthOf() are copied
   VERBATIM from _scripts/goal-panel.js — those rules are pinned by tests/H,
   tests/P and tests/V/shared_rules.py and must stay byte-identical. The
   `goal-panel.txt` line references in the section headers below are the
   original wording, kept byte-for-byte so the lineage pin in tests/G2 still
   holds (the file is .js now).
   Interface: .tg-row[data-line] · .tg-box/.tg-chip[data-toggle-line]
              [data-toggle-text] · see NOTES.md.
   ═══════════════════════════════════════════════════════════════════════════ */
const root = dv.container;

/* ── 1. tiny local helpers (goal-panel.txt lines 12–52) ────────────────────── */
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

/* ── 2. SPEC §2 health (goal-panel.txt lines 75–87, verbatim) ─────────────── */
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

/* ── 3. sub-task selection (goal-panel.txt lines 153–181, VERBATIM) ───────── */
const SUBSEC = /sub[-\s]?tasks?/i;
const HABIT_RE = /(^|\s)#habit(\/[\p{L}\p{N}_/-]+)*(?=$|\s)/u;
const secOf = t => { const s = t && (t.section || t.header); return s ? String(s.subpath || s.display || "") : ""; };
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

/* ── 4. the note text — group labels and the Sub-tasks section bounds ─────── */
const me = dv.current();
if(!me || !me.file) throw new Error("no current note");
const NOTE = me.file.path;
let noteText = "";
try { const f = app.vault.getAbstractFileByPath(NOTE); if(f) noteText = await app.vault.read(f); } catch(e){ noteText = ""; }
if(!noteText){ try { noteText = await app.vault.adapter.read(NOTE); } catch(e){ noteText = ""; } }

/* one pass over the text: fenced-code map + headings (fences are never code) */
function scanText(txt){
  const lines = String(txt==null?"":txt).split("\n");
  const fenced = []; let inF = false, fch = "";
  const raw = i => String(lines[i]).replace(/\r$/, "");           // `.`/`$` never see a CRLF's \r
  for(let i=0;i<lines.length;i++){
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(raw(i));
    if(m && (!inF || m[1][0]===fch)){ inF = !inF; fch = inF ? m[1][0] : ""; fenced[i] = true; continue; }
    fenced[i] = inF;
  }
  const heads = [];
  for(let i=0;i<lines.length;i++){
    if(fenced[i]) continue;
    const m = /^(#{1,6})\s+(.*)$/.exec(raw(i));
    if(m) heads.push({ line:i, level:m[1].length, text:m[2].trim().replace(/\s+#+\s*$/,"") });
  }
  return { lines, fenced, heads, eol: /\r\n/.test(String(txt||"")) ? "\r" : "" };
}
const DOC = scanText(noteText);
const subHead = DOC.heads.find(h => SUBSEC.test(h.text)) || null;
const subLevel = subHead ? subHead.level : 0;
/* nearest preceding bold-only line or ###/#### heading still inside the region */
function groupAt(ln){
  if(!DOC.lines.length || ln==null || ln<0) return "";
  for(let j=ln-1; j>=0; j--){
    if(DOC.fenced[j]) continue;
    const L = String(DOC.lines[j]).replace(/\r$/, "");
    if(/^\s*(?:[-*+]|\d+[.)])\s+/.test(L)) continue;              // any list item
    const hm = /^(#{1,6})\s+(.*)$/.exec(L);
    if(hm){
      const lvl = hm[1].length, tx = hm[2].trim().replace(/\s+#+\s*$/,"");
      if(lvl >= 3 && !SUBSEC.test(tx) && (subLevel === 0 || lvl > subLevel)) return tx;
      return "";                                                  // section boundary
    }
    const bm = /^\s*\*\*([^*]+)\*\*\s*$/.exec(L);
    if(bm) return bm[1].trim();
  }
  return "";
}

/* ── 5. model — one entry per sub-task, in document order ─────────────────── */
const taskStart = isoOf(me.start), taskEnd = isoOf(me.end);
const status = String(me.status || "active").toLowerCase().trim();
const raw = subsOf(me);
/* PROJECTED bars: when the note carries a real start→end window, a sub-task with
   no 📅 and no 🛫 (and no ⏳ — those stay backlog, as before) is not a chip but a
   planned slot, pacing all N sub-tasks evenly across the window in document order. */
const hasWindow = !!(taskStart && taskEnd && taskEnd > taskStart);
const N = raw.length, wSpan = hasWindow ? dayDiff(taskStart, taskEnd) : 0;
function slotOf(i){
  let bs = addDays(taskStart, Math.floor(i*wSpan/N)), be = addDays(taskStart, Math.floor((i+1)*wSpan/N));
  if(be <= bs) be = addDays(bs, 1);
  if(be > taskEnd) be = taskEnd;
  if(bs >= taskEnd){ bs = addDays(taskEnd, -1); be = taskEnd; }
  return { bs: bs, be: be };
}
const items = []; let prevDue = "";
raw.forEach((t, idx) => {
  const line = (t.line != null ? t.line : -1);
  const due = isoOf(t.due), st = isoOf(t.start), sc = isoOf(t.scheduled), cp = isoOf(t.completion);
  const it = { text: clean(t.text), line, done: !!t.completed, due, start: st, sched: sc,
               completion: cp, group: groupAt(line), kind: "backlog", bs: "", be: "", projected: false };
  if(due){
    it.kind = "bar"; it.be = due;
    let bs = st || sc || prevDue || taskStart || addDays(due, -7);
    if(bs >= it.be) bs = addDays(it.be, -1);
    it.bs = bs;
  } else if(st){ it.kind = "milestone"; it.bs = it.be = st; }
  else if(hasWindow && !sc){
    const s = slotOf(idx);
    it.kind = "bar"; it.projected = true; it.bs = s.bs; it.be = s.be;
  }
  /* a projected end feeds the prevDue chain too, so real bars stay continuous */
  if(due) prevDue = due; else if(it.projected) prevDue = it.be;
  items.push(it);
});
const charted = items.filter(i => i.kind !== "backlog");
const backlog = items.filter(i => i.kind === "backlog");
const total = items.length, doneN = items.filter(i => i.done).length;
const nProj = items.filter(i => i.projected).length;
/* a projected item has no 📅, so it can never be overdue */
const overdue = items.filter(i => !i.done && !i.projected && i.due && i.due < todayIso).length;
const progress = total ? doneN/total : 0;
/* PAUSE §1/§2 — effective paused = own status, or the goal this task points at.
   The cascade is computed; a task under a paused goal shows Paused without its
   own file changing. Read from the metadata cache — still ONE vault read. */
const pausedOn = isoOf(me.paused);
function goalStatus(){
  try{
    let g = me.goal; if(g == null || g === "") return "";
    if(Array.isArray(g) || g.__isDA === true){ g = Array.from(g)[0]; if(g == null) return ""; }
    let raw = (typeof g === "object") ? String(g.path || g.display || g) : String(g);
    raw = raw.trim().replace(/^!?\[\[/,"").replace(/\]\]$/,"").split("|")[0].split("#")[0].trim();
    if(!raw) return "";
    const f = app.vault.getAbstractFileByPath(raw) || app.vault.getAbstractFileByPath(raw + ".md")
           || app.metadataCache.getFirstLinkpathDest(raw, NOTE);
    if(!f) return "";
    const fm = (app.metadataCache.getFileCache(f) || {}).frontmatter || {};
    return String(fm.status == null ? "" : fm.status).toLowerCase().trim();
  } catch(e){ return ""; }
}
const ownPaused = status === "paused";
const paused = ownPaused || goalStatus() === "paused";
/* HEALTH contract — `overdue` above is exactly the count the rule wants, and it is
   the same number this header prints, so the badge and "N overdue" cannot disagree. */
const health = healthOf(paused ? "paused" : status, progress, taskStart, taskEnd,
                        { overdue: overdue, dated: items.some(i => !!i.due), remaining: total - doneN });

/* next move: earliest unchecked by due, then document order */
const open = items.filter(i => !i.done);
const dated = open.filter(i => i.due).sort((a,b)=> a.due<b.due ? -1 : a.due>b.due ? 1 : a.line-b.line);
const nextIt = dated[0] || open[0] || null;

/* ── 6. window — min span 14 days, extended at the END ────────────────────── */
let winStart = "", winEnd = "";
for(const i of charted){ winStart = minIso(winStart, i.bs); winEnd = maxIso(winEnd, i.be); }
for(const i of items){ winEnd = maxIso(winEnd, i.completion); }
winStart = minIso(winStart, taskStart);
winEnd = maxIso(maxIso(winEnd, taskEnd), todayIso);
winStart = addDays(winStart || todayIso, -3);
winEnd = addDays(winEnd || todayIso, 3);
if(dayDiff(winStart, winEnd) < 14) winEnd = addDays(winStart, 14);
const spanDays = Math.max(1, dayDiff(winStart, winEnd));
const showYears = String(winStart).slice(0,4) !== String(winEnd).slice(0,4);

/* ── 7. geometry (logical viewBox units) ──────────────────────────────────── */
const W = 1000, LBL = 250, PADR = 10, X0 = LBL, X1 = W - PADR, CW = X1 - X0;
const AXIS = 34, ROWH = 26, GRPH = 18, PADB = 14, BARH = 14, BOX = 12, NEAR = 60;
const xOf = iso => r2(X0 + CW * (dayDiff(winStart, iso) / spanDays));
const clampX = x => Math.max(X0, Math.min(X1, x));

/* render sequence: a group separator before the first charted row it owns */
const seq = []; let lastGroup = null;
for(const i of charted){
  const g = i.group || "";
  if(g && g !== lastGroup) seq.push({ kind:"group", label:g });
  lastGroup = g;
  seq.push({ kind:"row", it:i });
}
const nRows = seq.filter(s => s.kind==="row").length;
const nGroups = seq.filter(s => s.kind==="group").length;
const H = AXIS + nRows*ROWH + nGroups*GRPH + PADB;

/* ── 8. axis: weekly Monday ticks ≤ 16 weeks, else monthly on the 1st ─────── */
const monthly = spanDays > 112;
const ticks = [];
(function(){
  const s = dOf(winStart); if(!s) return;
  let guard = 0;
  if(monthly){
    let m = new Date(s.getFullYear(), s.getMonth(), 1);
    if(localIso(m) < winStart) m = new Date(s.getFullYear(), s.getMonth()+1, 1);
    while(localIso(m) <= winEnd && guard++ < 400){
      ticks.push({ iso: localIso(m), label: MON[m.getMonth()] + " " + m.getFullYear() });
      m = new Date(m.getFullYear(), m.getMonth()+1, 1);
    }
  } else {
    const d = new Date(s.getTime());
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7));               // first Monday ≥ winStart
    while(localIso(d) <= winEnd && guard++ < 400){
      ticks.push({ iso: localIso(d), label: fmtMD(localIso(d)) });
      d.setDate(d.getDate() + 7);
    }
  }
})();
let axisSvg = `<g class="tg-axis"><line class="tg-aline" x1="${X0}" y1="24" x2="${X1}" y2="24"></line>`;
let lastRight = -1e9;
ticks.forEach(tk => {
  const x = xOf(tk.iso), cls = monthly ? "tg-tick month" : "tg-tick";
  axisSvg += `<line class="${cls}" x1="${x}" y1="24" x2="${x}" y2="${H-6}"></line>`;
  /* a label that would run past the right edge flips to the left of its tick;
     one that would then collide with the previous label is dropped, not stacked */
  const lw = 6.1*String(tk.label).length, flip = x + 3 + lw > W, left = flip ? x-3-lw : x+3;
  if(left < lastRight + 4) return;
  lastRight = left + lw;
  axisSvg += `<text class="tg-tlabel${monthly?" month":""}" x="${r2(flip ? x-3 : x+3)}" y="17" font-size="11"`
    + (flip ? ` text-anchor="end"` : ``) + `>${esc(tk.label)}</text>`;
});
axisSvg += `</g>`;

/* ── 9. rows ──────────────────────────────────────────────────────────────── */
const stateOf = i => i.done ? "done" : i.projected ? "plan"
  : (i.due && i.due < todayIso) ? "over" : (i.due === todayIso) ? "today" : "open";
const tipOf = i => (i.group ? i.group + " · " : "") + i.text
  + (i.projected ? " · projected " + fmtMD(i.bs, showYears) + " → " + fmtMD(i.be, showYears)
                 + " · click the bar to set 📅 " + fmtMD(i.be, showYears)
     : i.kind==="milestone" ? " · 🛫 " + fmtMD(i.start, showYears)
     : i.be ? " · " + fmtMD(i.bs, showYears) + " → " + fmtMD(i.be, showYears) : "")
  + (i.completion ? " · ✅ " + fmtMD(i.completion, showYears) : "");
function boxSvg(i, y){
  const bx = 8, by = y + (ROWH - BOX)/2;
  return `<g class="tg-box${i.done?" done":""}" data-toggle-line="${i.line}" data-toggle-text="${esc(i.text)}" role="checkbox" tabindex="0" aria-checked="${i.done?"true":"false"}">`
    + `<rect x="${bx}" y="${by}" width="${BOX}" height="${BOX}" rx="3"></rect>`
    + (i.done ? `<path class="tg-check" d="M${bx+2.7} ${by+6.2} L${bx+5} ${by+8.6} L${bx+9.3} ${by+3.4}"></path>` : "")
    + `</g>`;
}
let rowsSvg = "", y = AXIS;
for(const s of seq){
  if(s.kind === "group"){
    rowsSvg += `<g class="tg-group" data-group="${esc(s.label)}">`
      + `<text class="tg-glabel" x="8" y="${y+13}" font-size="11">${esc(trunc(s.label,34))}</text>`
      + `<line class="tg-gline" x1="${X0}" y1="${y+9}" x2="${X1}" y2="${y+9}"></line></g>`;
    y += GRPH; continue;
  }
  const i = s.it, st = stateOf(i);
  let body = "";
  if(i.kind === "milestone"){
    const mx = clampX(xOf(i.start)), my = y + ROWH/2;
    body = `<polygon class="tg-milestone" data-state="${st}" points="${r2(mx)},${my-6} ${r2(mx+6)},${my} ${r2(mx)},${my+6} ${r2(mx-6)},${my}"></polygon>`
      + `<text class="tg-due" x="${r2(mx+10)}" y="${y+17}" font-size="11">${esc(fmtMD(i.start))}</text>`;
  } else {
    const bx = clampX(xOf(i.bs));
    const bw = Math.max(6, r2(clampX(xOf(i.be)) - bx));
    /* a projected bar keeps st-done when checked, else st-plan (+ late once its slot passed);
       the rect is its own click target — set 📅 to the slot end — never a toggle. */
    const barCls = i.projected && !i.done ? "st-plan" + (i.be < todayIso ? " late" : "") : "st-" + st;
    const proj = i.projected
      ? ` data-projected="1" data-due-line="${i.line}" data-due-text="${esc(i.text)}" data-set-due="${esc(i.be)}"`
      : ``;
    body = `<rect class="tg-bar ${barCls}" data-state="${st}"${proj} x="${bx}" y="${y+6}" width="${bw}" height="${BARH}" rx="4"></rect>`;
    /* the date sits past whichever is further right, the bar end or a late ✅ mark */
    const dmx = (i.done && i.completion) ? clampX(xOf(i.completion)) : null;
    const anchor = dmx == null ? bx + bw : Math.max(bx + bw, dmx + 5);
    const inside = (X1 - anchor) < NEAR;
    const dueCls = i.projected ? "tg-due proj" : "tg-due";
    const dueTxt = (i.projected ? "~" : "") + fmtMD(i.be);
    body += inside
      ? `<text class="${dueCls} inside" x="${r2(bx+bw-6)}" y="${y+17}" font-size="11" text-anchor="end">${esc(dueTxt)}</text>`
      : `<text class="${dueCls}" x="${r2(anchor+6)}" y="${y+17}" font-size="11">${esc(dueTxt)}</text>`;
    if(dmx != null) body += `<circle class="tg-done-mark" cx="${dmx}" cy="${y+13}" r="3.5"></circle>`;
  }
  rowsSvg += `<g class="tg-row" data-line="${i.line}" data-state="${st}" data-kind="${i.kind}"${i.projected?` data-projected="1"`:""}${i.group?` data-group="${esc(i.group)}"`:""}>`
    + `<title>${esc(tipOf(i))}</title>` + boxSvg(i, y)
    + `<text class="tg-label" x="26" y="${y+17}" font-size="12" title="${esc(i.text)}">${esc(trunc(i.text,30))}</text>`
    + body + `</g>`;
  y += ROWH;
}

/* ── 10. task window band + today line ────────────────────────────────────── */
let bandSvg = "";
if(taskStart && taskEnd){
  const wx = clampX(xOf(taskStart)), ww = Math.max(1, r2(clampX(xOf(taskEnd)) - wx));
  bandSvg = `<rect class="tg-window" x="${wx}" y="24" width="${ww}" height="${H-30}"></rect>`;
}
let todaySvg = "";
if(todayIso >= winStart && todayIso <= winEnd){
  const tx = xOf(todayIso);
  todaySvg = `<line class="tg-today" x1="${tx}" y1="24" x2="${tx}" y2="${H-6}"></line>`;
}

/* ── 11. header ───────────────────────────────────────────────────────────── */
/* "window" = the TASK's own start→end (GANTT.md §0's example), chart window
   as a fallback when the note carries no dates. */
const hs = (taskStart && taskEnd) ? taskStart : winStart;
const he = (taskStart && taskEnd) ? taskEnd : winEnd;
const hy = String(hs).slice(0,4) !== String(he).slice(0,4);
const meta = `${doneN}/${total} done`
  + ((overdue && !paused) ? ` · ${overdue} overdue` : "")   /* PAUSE §3 — paused work is not late */
  + (nProj ? ` · ${nProj} projected` : "")
  + ` · window ${fmtMD(hs,hy)} – ${fmtMD(he,hy)}`
  + ` · next: ` + (nextIt ? nextIt.text + (nextIt.due ? " 📅 " + fmtMD(nextIt.due) : "") : "—");
const head = `<div class="tg-head"><span class="tg-hb hb ${esc(health)}">${esc(HL[health])}</span> `
  + `<span class="tg-meta">${esc(meta)}</span>`
  + (ownPaused
      ? `<button class="resumebtn" type="button" data-resume title="Resume this task">▶ Resume</button>`
      : `<button class="pausebtn" type="button" data-pause title="${paused?"Its goal is paused. Pause this task on its own too":"Pause this task — it goes quiet on the Dashboard until you resume"}">⏸️ Pause</button>`)
  + `</div>`
  + `<div class="resumebar"></div>`;

/* ── 12. chart / backlog / add row / empty state ──────────────────────────── */
const chart = nRows
  ? `<svg class="tg-svg" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMinYMin meet" role="img" aria-label="Timeline of this task's sub-tasks">`
    + bandSvg + axisSvg + rowsSvg + todaySvg + `</svg>`
  : "";
const backlogHtml = backlog.length
  ? `<div class="tg-backlog">` + backlog.map(i =>
      `<span class="tg-chip${i.done?" done":""}" data-toggle-line="${i.line}" data-toggle-text="${esc(i.text)}"`
      + (i.group?` data-group="${esc(i.group)}"`:"")
      + ` title="${esc((i.group?i.group+" · ":"") + i.text)}" role="checkbox" tabindex="0" aria-checked="${i.done?"true":"false"}">`
      + `${i.done?"☑":"☐"} ${esc(i.text)}</span>`).join("") + `</div>`
  : "";
const emptyHtml = total ? "" : `<div class="tg-empty">No sub-tasks yet — add the first one below.</div>`;
const addHtml = `<div class="tg-add">`
  + `<input class="tg-in" type="text" placeholder="Add a sub-task…">`
  + `<input class="tg-date" type="date">`
  + `<button class="tg-addbtn" type="button" title="Add sub-task">＋</button></div>`;
root.innerHTML = `<div class="tgantt"${paused?` data-paused="1"`:``}>${head}${emptyHtml}${chart}${backlogHtml}${addHtml}</div>`;

/* ── 13. line surgery (Dashboard.md lines 627–639, reproduced) ────────────── */
const BLOCKID = /(\s+\^[A-Za-z0-9-]+)\s*$/;
function stampAtEnd(ln, suffix){
  const m = String(ln).match(BLOCKID);
  return m ? String(ln).slice(0, m.index).replace(/\s*$/,"") + suffix + m[1]
           : String(ln).replace(/\s*$/,"") + suffix;
}
const isoToday = () => { const dt=new Date(); return dt.getFullYear()+"-"+two(dt.getMonth()+1)+"-"+two(dt.getDate()); };
const stampDone = ln => /✅/.test(ln) ? ln : stampAtEnd(ln, " ✅ " + isoToday());
const stripDone = ln => String(ln).replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, "").replace(/\s+$/,"");
const refresh = () => { try { app.metadataCache.trigger("dataview:refresh-views"); } catch(e){} };

/* ── 14. toggle ───────────────────────────────────────────────────────────── */
const isBox = l => /^\s*[-*]\s*\[[ xX]\]/.test(l||"");
const norm = s => String(s||"").replace(/\s+/g," ").trim().toLowerCase();
/* the checkbox line's own text, cleaned the same way data-toggle-text was */
const boxText = l => norm(clean(String(l||"").replace(/^\s*[-*]\s*\[[ xX]\]\s?/, "")));
const notify = msg => { try { const ob = require("obsidian"); new ob.Notice(msg, 5000); } catch(e){ console.warn(msg); } };
/* Resolve the line to edit. The recorded line wins when it is still the SAME sub-task
   (exact cleaned text — never a substring, so `Step 1` can never hit `Step 10`). When the
   note shifted underneath the chart, fall back to the one line with exactly that text;
   zero or several candidates → refuse and redraw rather than guess. */
function findLine(lines, line, text){
  const want = norm(text);
  const at = Number(line);
  if(at >= 0 && at < lines.length && isBox(lines[at]) && want && boxText(lines[at]) === want) return at;
  if(!want) return -1;
  const hits = []; lines.forEach((l,i) => { if(isBox(l) && boxText(l) === want) hits.push(i); });
  if(hits.length === 1) return hits[0];
  notify(hits.length ? "Two sub-tasks have the same text — edit that one in the note itself." : "That sub-task moved — the chart is refreshing, try again.");
  refresh();
  return -1;
}
let busy = false;
async function toggleLine(line, text){
  if(busy) return; busy = true;
  try{
    const f = app.vault.getAbstractFileByPath(NOTE); if(!f) return;
    const lines = (await app.vault.read(f)).split("\n");
    const target = findLine(lines, line, text);
    if(target < 0) return;
    let ln = lines[target];
    const cr = /\r$/.test(ln) ? "\r" : ""; if(cr) ln = ln.slice(0,-1);
    ln = /\[[xX]\]/.test(ln) ? stripDone(ln.replace(/\[[xX]\]/, "[ ]"))
                             : stampDone(ln.replace(/\[\s\]/, "[x]"));
    lines[target] = ln + cr;
    await app.vault.modify(f, lines.join("\n"));
    refresh();
  } catch(e){ console.error("task-gantt toggle", e); }
  finally { busy = false; }
}

/* ── 14b. promote a projected slot to a real 📅 (click on the bar) ────────── */
async function setDue(line, text, date){
  if(busy) return; busy = true;
  try{
    const f = app.vault.getAbstractFileByPath(NOTE); if(!f) return;
    const lines = (await app.vault.read(f)).split("\n");
    const target = findLine(lines, line, text);
    if(target < 0) return;
    let ln = lines[target];
    if(/📅/.test(ln)) return;                        // already dated — leave it alone
    const cr = /\r$/.test(ln) ? "\r" : ""; if(cr) ln = ln.slice(0,-1);
    lines[target] = stampAtEnd(ln, " 📅 " + date) + cr;
    await app.vault.modify(f, lines.join("\n")); refresh();
  } catch(e){ console.error("task-gantt set-due", e); }
  finally { busy = false; }
}

/* ── 15. add a sub-task at the end of the Sub-tasks section ───────────────── */
const BLANKBOX = /^\s*[-*]\s*\[[ xX]\]\s*$/;
function withAdded(txt, text, date){
  const S = scanText(txt);
  const NL = S.eol + "\n";                                     // the note's own line ending
  const nl = "- [ ] " + text + (date ? " 📅 " + date : "") + S.eol;
  const sh = S.heads.find(h => SUBSEC.test(h.text));
  if(!sh) return String(txt).replace(/\s*$/,"") + NL + NL + "## Sub-tasks" + NL + NL + nl + "\n";
  const nx = S.heads.find(h => h.line > sh.line && h.level <= sh.level);
  const end = nx ? nx.line : S.lines.length;                    // exclusive
  let k = end - 1;
  while(k > sh.line && String(S.lines[k]).trim() === "") k--;
  if(k > sh.line && BLANKBOX.test(S.lines[k])) S.lines[k] = nl;
  else S.lines.splice(k+1, 0, nl);
  return S.lines.join("\n");
}
async function addSub(){
  if(busy) return;
  const inp = root.querySelector(".tg-in"), dte = root.querySelector(".tg-date");
  const text = String(inp && inp.value || "").trim();
  if(!text) return;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(dte && dte.value || "")) ? dte.value : "";
  busy = true;
  try{
    const f = app.vault.getAbstractFileByPath(NOTE); if(!f) return;
    const txt = await app.vault.read(f);
    await app.vault.modify(f, withAdded(txt, text, date));
    inp.value = ""; if(dte) dte.value = "";
    refresh();
  } catch(e){ console.error("task-gantt add", e); }
  finally { busy = false; }
}

/* ── 15b. PAUSE §4 — pause / resume this one task. Line-based frontmatter
      (setFm is the same routine as in dashboard/initHub.js — processFrontMatter
      reorders and reformats keys); one vault.modify per file; no dialogs. ─────── */
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
const isCRLF = s => /\r\n/.test(String(s||""));
const toLF = s => String(s||"").replace(/\r\n/g,"\n");
const SHIFT_RE = /(\u{1F4C5}|\u{1F6EB}|⏳)(\s*)(\d{4}-\d{2}-\d{2})/gu;
const tgBar = root.querySelector(".resumebar");
let resumed = false;
const clearBar = () => { if(tgBar) tgBar.innerHTML = ""; };

async function doPause(){
  if(busy) return; busy = true;
  try{
    const f = app.vault.getAbstractFileByPath(NOTE); if(!f) return;
    const txt = await app.vault.read(f);
    if(String(fmValueOf(toLF(txt),"status")||"").toLowerCase().trim() === "paused"){ refresh(); return; }  // already paused — no-op
    const crlf = isCRLF(txt);
    let out = setFm(toLF(txt), { status:"paused", paused: todayIso });
    if(crlf) out = out.replace(/\n/g,"\r\n");
    await app.vault.modify(f, out);
    notify(`Paused “${me.file.name}”.`);
    refresh();
  } catch(e){ console.error("task-gantt pause", e); notify("Could not pause this task — " + (e && e.message ? e.message : e)); }
  finally { busy = false; }
}

async function doResume(shiftN){
  if(busy || resumed) return; busy = true;
  try{
    const f = app.vault.getAbstractFileByPath(NOTE); if(!f) return;
    const txt = await app.vault.read(f);
    const tLF = toLF(txt);
    const cur = String(fmValueOf(tLF,"status")||"").toLowerCase().trim();
    if(cur !== "paused" && !fmValueOf(tLF,"paused")){ clearBar(); refresh(); return; }   // already resumed
    const crlf = isCRLF(txt);
    const lines = toLF(txt).split("\n");
    let moved = 0;
    if(shiftN){
      for(const i of items){                               /* checked sub-tasks keep their real ✅ history */
        if(i.done) continue;
        const at = findLine(lines, i.line, i.text);
        if(at < 0) continue;
        lines[at] = lines[at].replace(SHIFT_RE, (m,e,sp,d) => { moved++; return e+sp+addDays(d, shiftN); });
      }
    }
    let out = lines.join("\n");
    const patch = { status:"active" };
    if(shiftN){
      const st = fmValueOf(out,"start"), en = fmValueOf(out,"end");
      if(/^\d{4}-\d{2}-\d{2}$/.test(st)){ patch.start = addDays(st, shiftN); moved++; }
      if(/^\d{4}-\d{2}-\d{2}$/.test(en)){ patch.end = addDays(en, shiftN); moved++; }
    }
    out = delFm(setFm(out, patch), "paused");
    if(crlf) out = out.replace(/\n/g,"\r\n");
    await app.vault.modify(f, out);
    resumed = true; clearBar();
    notify(shiftN
      ? `Resumed “${me.file.name}” — shifted ${moved} date${moved===1?"":"s"} across 1 note by ${shiftN} day${shiftN===1?"":"s"}.`
      : `Resumed “${me.file.name}”.`);
    refresh();
  } catch(e){ console.error("task-gantt resume", e); notify("Could not resume this task — " + (e && e.message ? e.message : e)); }
  finally { busy = false; }
}

function openResumeBar(){
  if(!tgBar || busy || resumed) return;
  const n = pausedOn ? dayDiff(pausedOn, todayIso) : 0;
  const lead = n >= 1 ? `Resume “${esc(me.file.name)}”? paused ${n} day${n===1?"":"s"}.`
                      : `Resume “${esc(me.file.name)}”?`;
  tgBar.innerHTML = `<span class="rb-q">${lead}</span>`
    + (n >= 1 ? `<button type="button" data-resume-do="${n}">Shift remaining dates +${n}d</button>` : ``)
    + `<button type="button" data-resume-do="0">${n >= 1 ? "Resume as-is" : "Resume"}</button>`
    + `<button type="button" data-resume-cancel>Cancel</button>`;
  tgBar.querySelectorAll("[data-resume-do]").forEach(b => b.addEventListener("click", ev => {
    ev.preventDefault(); ev.stopPropagation(); doResume(parseInt(b.getAttribute("data-resume-do"),10) || 0);
  }));
  const cx = tgBar.querySelector("[data-resume-cancel]");
  if(cx) cx.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); clearBar(); });
}

/* ── 16. wiring ───────────────────────────────────────────────────────────── */
root.querySelectorAll("[data-toggle-line]").forEach(el => {
  el.style.cursor = "pointer";
  const go = ev => { ev.preventDefault(); ev.stopPropagation();
    toggleLine(el.getAttribute("data-toggle-line"), el.getAttribute("data-toggle-text")); };
  el.addEventListener("click", go);
  el.addEventListener("keydown", ev => { if(ev.key === "Enter" || ev.key === " ") go(ev); });
});
/* projected bars only — a separate handler, so .tg-box stays the only toggle */
root.querySelectorAll("rect.tg-bar[data-projected]").forEach(el => {
  el.style.cursor = "pointer";
  el.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation();
    setDue(el.getAttribute("data-due-line"), el.getAttribute("data-due-text"), el.getAttribute("data-set-due")); });
});
const pauseBtn = root.querySelector("[data-pause]");
if(pauseBtn) pauseBtn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); doPause(); });
const resumeBtn = root.querySelector("[data-resume]");
if(resumeBtn) resumeBtn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); openResumeBar(); });
const addBtn = root.querySelector(".tg-addbtn"), addIn = root.querySelector(".tg-in");
if(addBtn) addBtn.addEventListener("click", ev => { ev.preventDefault(); addSub(); });
if(addIn) addIn.addEventListener("keydown", ev => { if(ev.key === "Enter"){ ev.preventDefault(); addSub(); } });

} catch(err) {
  dv.container.innerHTML = '<div class="tg-err" style="color:#e0736b;padding:12px;font-family:sans-serif">📆 Task timeline error: ' + String(err && err.message ? err.message : err).replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])) + '</div>';
  console.error(err);
}
