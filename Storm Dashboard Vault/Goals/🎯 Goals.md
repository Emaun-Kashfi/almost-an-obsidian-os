---
cssclasses:
  - dashboard
tags:
  - dashboard
---

# 🎯 Goals

[[Dashboard|← Dashboard]]　·　[[📋 Tasks|Task board]]

> **Goals** are the outcomes you care about; **tasks** are the work that moves them.
> Add a goal from the Dashboard's add box with `goal: <name> @<area> <target date>` — it lands in `Goals/` with its own Gantt panel.
> Point work at it with `task: <name> @<goal> <start>-<end>`, then keep the checkboxes inside that task note's `## Sub-tasks` section. The earliest unchecked sub-task is what the Dashboard shows as your next move.
> Easier still: press **＋ Task** on a card below (or in the goal note's own panel) and type a name. The goal, the start date and the goal's target come along for free, and **Add** keeps you where you are — so adding four tasks to one goal is four names, not four trips to the Dashboard.
> Not working on one right now? Set `status: paused` (or press **⏸️ Pause** on the goal note). The goal and its tasks go quiet — no health, no next moves, no overdue nags — and wait in the collapsed **Paused** group at the bottom of this page. **▶ Resume** brings them back, and offers to shift the remaining dates by however long the goal was parked.

```dataviewjs
try {
/* ═══ 🎯 Goals index — one card per goal, worst health first (SPEC §2/§5) ═══ */
const root = this.container;

/* ── local helpers ── */
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const two = n => String(n).padStart(2,"0");
const localIso = d => `${d.getFullYear()}-${two(d.getMonth()+1)}-${two(d.getDate())}`;
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
const minIso = (a,b) => !a ? (b||"") : !b ? a : (a<b?a:b);
const maxIso = (a,b) => !a ? (b||"") : !b ? a : (a>b?a:b);
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
function linksTo(v, target){
  if(!target || !target.file) return false;
  const p = String(target.file.path).toLowerCase(), n = String(target.file.name).toLowerCase();
  return linkNames(v).some(r => String(r).toLowerCase()===p || baseOf(r).toLowerCase()===n);
}

/* ── PAUSE §4 — writes. Line-based frontmatter (setFm ported VERBATIM from the
      work vault's initHub.js) + the Timeline's exact-match line resolution. ── */
const addDays = (iso,n) => { const d=dOf(iso); if(!d) return ""; d.setDate(d.getDate()+n); return localIso(d); };
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
const isCRLF = s => /\r\n/.test(String(s||""));
const toLF = s => String(s||"").replace(/\r\n/g,"\n");
function applyFm(text, patch, drop){
  const crlf = isCRLF(text);
  let s = toLF(text);
  if(patch && Object.keys(patch).length) s = setFm(s, patch);
  (drop||[]).forEach(k => { s = delFm(s, k); });
  return crlf ? s.replace(/\n/g,"\r\n") : s;
}
/* exact-match line resolution — copied from _scripts/task-gantt.txt (never a substring) */
const isBox = l => /^\s*[-*]\s*\[[ xX]\]/.test(l||"");
const norm = s => String(s||"").replace(/\s+/g," ").trim().toLowerCase();
const boxText = l => norm(clean(String(l||"").replace(/^\s*[-*]\s*\[[ xX]\]\s?/, "")));
function findLine(lines, line, text){
  const want = norm(text);
  const at = Number(line);
  if(at >= 0 && at < lines.length && isBox(lines[at]) && want && boxText(lines[at]) === want) return at;
  if(!want) return -1;
  const hits = []; lines.forEach((l,i) => { if(isBox(l) && boxText(l) === want) hits.push(i); });
  return hits.length === 1 ? hits[0] : -1;
}
const SHIFT_RE = /(\u{1F4C5}|\u{1F6EB}|⏳)(\s*)(\d{4}-\d{2}-\d{2})/gu;

/* ═══ ADDTASK §1 — the note a "＋ Task" writes ════════════════════════════════
   A goal card knows the goal it belongs to, so creating work under it needs
   nothing but a name. There are three ways to make a task note — the Templater
   template, the Dashboard's `task:` route and this button — and they must not
   drift, so the text below is the body expression of `createTaskNote()` in
   dashboard/initHub.js, character for character, and is kept identical to the
   copy in _scripts/goal-panel.js. Change one, change all (tests/P asserts it).
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

const HL = { ok:"On track", risk:"At risk", behind:"Behind", done:"Done", unscheduled:"Unscheduled", paused:"Paused" };
const HORDER = { behind:0, risk:1, ok:2, unscheduled:3, done:4, paused:5 };
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

const allTasks = dv.pages('"Tasks"').where(p => p && p.type==="task" && !EXCL.test(p.file.path)).array().map(p => {
  const subs = subsOf(p);
  const total = subs.length, done = subs.filter(t=>!!t.completed).length;
  const open = subs.filter(t=>!t.completed);
  const dated = open.filter(t=>isoOf(t.due)).sort((a,b)=>{ const x=isoOf(a.due), y=isoOf(b.due); return x<y?-1:x>y?1:(a.line||0)-(b.line||0); });
  const nm = dated[0] || open[0] || null;
  /* HEALTH contract — counted in the walk this index already does over the sub-tasks */
  const hOpts = { overdue: open.filter(t => { const d = isoOf(t.due); return d && d < todayIso; }).length,
                  dated: subs.some(t => !!isoOf(t.due)), remaining: open.length };
  return { name:p.file.name, path:p.file.path, goalRaw:p.goal, hOpts,
           status:String(p.status||"active").toLowerCase().trim(),
           start:isoOf(p.start), end:isoOf(p.end), done, total,
           progress: total ? done/total : 0,
           subs: subs.map(x => ({ line: (x.line != null ? x.line : -1), text: clean(x.text), done: !!x.completed })),
           next: nm ? clean(nm.text) : "", nextDue: nm ? isoOf(nm.due) : "" };
});

const goals = dv.pages('"Goals"').where(p => p && p.type==="goal" && !EXCL.test(p.file.path)).array().map(g => {
  const mine = allTasks.filter(t => linksTo(t.goalRaw, g));
  const sumDone = mine.reduce((a,t)=>a+t.done,0), sumTotal = mine.reduce((a,t)=>a+t.total,0);
  const progress = sumTotal ? sumDone/sumTotal : (mine.length ? mine.filter(t=>t.status==="done").length/mine.length : 0);
  let gStart="", maxEnd="";
  mine.forEach(t => { if(t.start) gStart=minIso(gStart,t.start); if(t.end) maxEnd=maxIso(maxEnd,t.end); });
  const target = isoOf(g.target);
  const status = String(g.status||"active").toLowerCase().trim();
  /* HEALTH contract — total the overdue across the goal's non-paused tasks */
  const live = mine.filter(t => t.status !== "paused" && t.status !== "done");
  const gOpts = { overdue: live.reduce((a,t)=>a+t.hOpts.overdue,0),
                  dated: live.some(t => t.hOpts.dated),
                  remaining: live.reduce((a,t)=>a+t.hOpts.remaining,0) };
  const active = mine.filter(t=>t.status==="active");
  const nexts = active.filter(t=>t.next).sort((a,b)=>{
    const x=a.nextDue||"9999-99-99", y=b.nextDue||"9999-99-99";
    return x<y?-1:x>y?1:(a.name<b.name?-1:1);
  });
  return { name:g.file.name, path:g.file.path, area:String(g.area||""), status, progress,
           target,
           health: healthOf(status, progress, gStart, target || maxEnd, gOpts),
           nTasks: mine.length, nActive: active.length, tasks: mine,
           paused: status === "paused", pausedOn: isoOf(g.paused),
           next: nexts.length ? nexts[0].next : "" };
});

const cmp = (a,b) => (HORDER[a.health]-HORDER[b.health]) || (a.name<b.name?-1:a.name>b.name?1:0);
/* PAUSE §3 — active goals render exactly as before; done sits under them; paused
   goals keep their own collapsed group at the very bottom, each with ▶ Resume. */
const live = goals.filter(g => g.status!=="done" && !g.paused).sort(cmp);
const rest = goals.filter(g => g.status==="done").sort(cmp);
const held = goals.filter(g => g.paused).sort(cmp);

const card = g => `<div class="gi-card" data-health="${esc(g.health)}" data-status="${esc(g.status)}"${g.paused?` data-paused="1"`:``}>`
  + `<div class="gi-top"><span class="gi-name" data-link="${esc(g.path)}">${esc(g.name)}</span>`
  + (g.area ? `<span class="gi-area">${esc(g.area)}</span>` : "")
  + `</div>`
  + `<div class="gi-mid"><span class="hb ${esc(g.health)}">${esc(HL[g.health])}</span>`
  + `<span class="gi-bar"><span class="gi-fill" style="width:${Math.round(g.progress*100)}%"></span></span>`
  + `<span class="gi-pct">${Math.round(g.progress*100)}%</span></div>`
  /* a paused goal does not advertise a next move — that nag is what pausing removes */
  + `<div class="gi-foot">${g.nTasks===1?"1 task":g.nTasks+" tasks"}`
  + (g.status==="paused" ? ` · paused${g.pausedOn&&dayDiff(g.pausedOn,todayIso)>0?" "+dayDiff(g.pausedOn,todayIso)+" days":""}` : ` · ${g.nActive} active · next: ${g.next?esc(g.next):"—"}`)
  + `</div>`
  /* ADDTASK §1 — a paused goal keeps the ＋ button on purpose: parking a goal stops
     it nagging, it does not stop you planning. The new task inherits the pause
     through the existing cascade, so it stays quiet until the goal resumes. */
  + `<div class="gi-acts"><button class="addtaskbtn" type="button" data-addtask="${esc(g.path)}" title="Add a ${NOUN} to this goal">＋ ${NOUNC}</button>`
  + (g.paused ? `<button class="resumebtn" type="button" data-resume="${esc(g.path)}" title="Resume this goal">▶ Resume</button>` : "")
  + `</div>`
  + `<div class="addtaskbar" data-addbar="${esc(g.path)}"></div>`
  + (g.paused ? `<div class="resumebar" data-bar="${esc(g.path)}"></div>` : "")
  + `</div>`;

let html = "";
if(!goals.length){
  html = `<div class="gi-empty">No goals yet — add one from the Dashboard with <code>goal: &lt;name&gt; @&lt;area&gt;</code>.</div>`;
} else {
  html = `<div class="goalsidx">${live.map(card).join("") || `<div class="gi-empty">Every goal is done or paused. 🎉</div>`}</div>`;
  if(rest.length) html += `<div class="gi-sec">Done</div><div class="goalsidx dim">${rest.map(card).join("")}</div>`;
  if(held.length) html += `<details class="goal-paused"><summary>Paused (${held.length})</summary>`
    + `<div class="goalsidx">${held.map(card).join("")}</div></details>`;
}
root.innerHTML = html;

root.querySelectorAll("[data-link]").forEach(el => {
  el.addEventListener("click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    const link = el.getAttribute("data-link");
    if(link && app && app.workspace) app.workspace.openLinkText(link, "", false);
  });
});

/* ── PAUSE §4 — ▶ Resume on a paused row, inline confirm, no dialogs ──────── */
let busy = false;
const doneFor = new Set();

async function resumeGoal(g, shiftN, bar){
  if(busy || doneFor.has(g.path)) return; busy = true;
  try{
    const gf = app.vault.getAbstractFileByPath(g.path); if(!gf) return;
    const gtxt = await app.vault.read(gf);
    const gLF = toLF(gtxt);
    const cur = String(fmValueOf(gLF,"status")||"").toLowerCase().trim();
    if(cur !== "paused" && !fmValueOf(gLF,"paused")){ refresh(); return; }   // already resumed
    let notes = 0, dates = 0;
    const patch = { status:"active" };
    if(shiftN){ const tg = fmValueOf(gLF,"target"); if(/^\d{4}-\d{2}-\d{2}$/.test(tg)){ patch.target = addDays(tg, shiftN); dates++; } }
    await app.vault.modify(gf, applyFm(gtxt, patch, ["paused"]));
    notes++;
    if(shiftN){
      for(const t of (g.tasks||[])){
        if(t.status === "paused") continue;                 /* paused on its own — stays paused, never shifted */
        const f = app.vault.getAbstractFileByPath(t.path); if(!f) continue;
        const txt = await app.vault.read(f);
        const crlf = isCRLF(txt);
        const lines = toLF(txt).split("\n");
        let moved = 0;
        for(const s of (t.subs||[])){                       /* checked sub-tasks keep their real ✅ history */
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
    doneFor.add(g.path);
    if(bar) bar.innerHTML = "";
    notify(shiftN
      ? `Resumed “${g.name}” — shifted ${dates} date${dates===1?"":"s"} across ${notes} note${notes===1?"":"s"} by ${shiftN} day${shiftN===1?"":"s"}.`
      : `Resumed “${g.name}”.`);
    refresh();
  } catch(e){ console.error("goals index resume", e); notify("Could not resume this goal — " + (e && e.message ? e.message : e)); }
  finally { busy = false; }
}

root.querySelectorAll("[data-resume]").forEach(btn => {
  const path = btn.getAttribute("data-resume");
  const g = held.find(x => x.path === path);
  const bar = btn.closest(".gi-card") ? btn.closest(".gi-card").querySelector(".resumebar") : null;
  if(!g || !bar) return;
  btn.addEventListener("click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    if(busy || doneFor.has(g.path)) return;
    const n = g.pausedOn ? dayDiff(g.pausedOn, todayIso) : 0;
    bar.innerHTML = `<span class="rb-q">${n>=1 ? `Resume “${esc(g.name)}”? paused ${n} day${n===1?"":"s"}.` : `Resume “${esc(g.name)}”?`}</span>`
      + (n>=1 ? `<button type="button" data-resume-do="${n}">Shift remaining dates +${n}d</button>` : ``)
      + `<button type="button" data-resume-do="0">${n>=1 ? "Resume as-is" : "Resume"}</button>`
      + `<button type="button" data-resume-cancel>Cancel</button>`;
    bar.querySelectorAll("[data-resume-do]").forEach(b => b.addEventListener("click", e2 => {
      e2.preventDefault(); e2.stopPropagation(); resumeGoal(g, parseInt(b.getAttribute("data-resume-do"),10) || 0, bar);
    }));
    const cx = bar.querySelector("[data-resume-cancel]");
    if(cx) cx.addEventListener("click", e2 => { e2.preventDefault(); e2.stopPropagation(); bar.innerHTML = ""; });
  });
});

/* ═══ ADDTASK §2 — the inline row on a card, one vault.create per task ════════
   Same spirit as the resume bar above and the Timeline's ＋ row: an in-card row,
   never a modal and never a confirm / prompt dialog (both freeze the plugin host).
   Add keeps the row open and focused so several tasks can be added to one goal
   without leaving this page; Add & open hands the note over. `busy` is shared
   with resume, so two fast clicks write one note.
   ═══════════════════════════════════════════════════════════════════════════ */
async function addTaskTo(g, barEl, openIt){
  if(busy || !barEl) return;
  const nameIn = barEl.querySelector('[data-at="name"]'); if(!nameIn) return;
  const raw = String(nameIn.value == null ? "" : nameIn.value).trim();
  if(!raw) return;                                   /* empty / whitespace-only → no write */
  busy = true;
  try{
    const sIn = barEl.querySelector('[data-at="start"]'), eIn = barEl.querySelector('[data-at="end"]');
    const start = isoOf(sIn && sIn.value), end = isoOf(eIn && eIn.value);   /* both may be cleared */
    const nm = safeName(raw) || ("Untitled " + NOUN);
    await ensureFolder("Tasks");
    const path = await freePath("Tasks", nm);        /* never overwrites an existing note */
    await app.vault.create(path, taskNoteText(nm, g.name, start, end));
    notify(`Added ${NOUN} \u201C${nm}\u201D to \u201C${g.name}\u201D.`);
    refresh();
    if(openIt){ barEl.innerHTML = ""; if(app && app.workspace) app.workspace.openLinkText(path, "", false); }
    else { nameIn.value = ""; try{ nameIn.focus(); }catch(e){} }
  } catch(e){ console.error("goals index add " + NOUN, e); notify(`Could not create that ${NOUN} — ` + (e && e.message ? e.message : e)); }
  finally { busy = false; }
}

function openAddBar(g, barEl){
  if(!barEl) return;
  const focus = () => { const n = barEl.querySelector('[data-at="name"]'); if(n){ try{ n.focus(); }catch(e){} } };
  if(barEl.firstChild){ focus(); return; }            /* already open — never wipe a half-typed name */
  barEl.innerHTML =
      `<input type="text" data-at="name" placeholder="${esc(NOUNC)} name…" aria-label="${esc(NOUNC)} name" spellcheck="false">`
    + `<input type="date" data-at="start" aria-label="Start date" value="${esc(todayIso)}">`
    + `<input type="date" data-at="end" aria-label="End date" value="${esc(g.target||"")}">`
    + `<button type="button" data-at="add" title="Create it and stay on this page">Add</button>`
    + `<button type="button" data-at="open" title="Create it and open the note">Add &amp; open</button>`
    + `<button type="button" data-at="cancel">Cancel</button>`;
  barEl.querySelectorAll("button[data-at]").forEach(b => b.addEventListener("click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    const k = b.getAttribute("data-at");
    if(k === "cancel") barEl.innerHTML = ""; else addTaskTo(g, barEl, k === "open");
  }));
  barEl.addEventListener("keydown", ev => {
    if(ev.key === "Escape"){ ev.preventDefault(); ev.stopPropagation(); barEl.innerHTML = ""; }
    else if(ev.key === "Enter" && ev.target && ev.target.getAttribute("data-at") === "name"){
      ev.preventDefault(); ev.stopPropagation(); addTaskTo(g, barEl, false);
    }
  });
  focus();
}

root.querySelectorAll("[data-addtask]").forEach(btn => {
  const path = btn.getAttribute("data-addtask");
  const g = goals.find(x => x.path === path);
  const barEl = btn.closest(".gi-card") ? btn.closest(".gi-card").querySelector(".addtaskbar") : null;
  if(!g || !barEl) return;
  btn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); openAddBar(g, barEl); });
});

} catch(err) {
  this.container.innerHTML = '<div class="goal-err" style="color:#e0736b;padding:14px;font-family:sans-serif">🎯 Goals index error: ' + (err && err.message ? err.message : String(err)) + '</div>';
  console.error(err);
}
```
