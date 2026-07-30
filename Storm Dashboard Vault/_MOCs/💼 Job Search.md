---
cssclasses:
  - jobsearch-moc
tags:
  - moc
  - jobsearch
---

```dataviewjs
try {
const box = this.container;
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const two = n => String(n).padStart(2,"0");
const now = new Date();
const isoOf = d => `${d.getFullYear()}-${two(d.getMonth()+1)}-${two(d.getDate())}`;
const todayIso = isoOf(now);

const STAGES = [
  {key:"saved",     label:"Saved",     icon:"🔖"},
  {key:"applied",   label:"Applied",   icon:"📤"},
  {key:"screen",    label:"Screen",    icon:"📞"},
  {key:"interview", label:"Interview", icon:"🎤"},
  {key:"final",     label:"Final",     icon:"🏁"},
  {key:"offer",     label:"Offer",     icon:"🎉"},
];
const stageIdx = k => STAGES.findIndex(s => s.key === k);
// full status set (pipeline + closed) used for the per-row dropdown and grouping
const ALLST = STAGES.concat([
  {key:"rejected", label:"Rejected", icon:"✖️"},
  {key:"archived", label:"Archived", icon:"🗄️"},
]);
const statusOptions = cur => ALLST.map(o => `<option value="${o.key}"${o.key===cur?" selected":""}>${o.icon} ${o.label}</option>`).join("");

const apps = dv.pages("#application").array()
  .filter(p => !String(p.file.path).startsWith("_templates/"))
  .map(p => ({
  path: p.file.path, name: p.file.name,
  company: p.company ? String(p.company) : "",
  role: p.role ? String(p.role) : "",
  status: String(p.status || "saved").toLowerCase().trim(),
  applied: p.applied ? String(p.applied).slice(0,10) : "",
  deadline: p.deadline ? String(p.deadline).slice(0,10) : "",
  source: p.source ? String(p.source) : "",
  location: p.location ? String(p.location) : "",
  salary: p.salary ? String(p.salary) : "",
  next: p.next ? String(p.next) : "",
  link: p.link ? String(p.link) : "",
  priority: String(p.priority || "").toLowerCase(),
  expired: (String(p.expired) === "true") || /expired/i.test(String(p.description_status || "")),
}));

// ---- stats ----
const activeSt = ["saved","applied","screen","interview","final"];
const appliedEver = apps.filter(a => ["applied","screen","interview","final","offer","rejected"].includes(a.status)).length;
const responded = apps.filter(a => ["screen","interview","final","offer"].includes(a.status)).length;
const active = apps.filter(a => activeSt.includes(a.status)).length;
const interviewing = apps.filter(a => ["screen","interview","final"].includes(a.status)).length;
const offers = apps.filter(a => a.status === "offer").length;
const respRate = appliedEver ? Math.round(responded / appliedEver * 100) : 0;
const monday = new Date(now); monday.setHours(0,0,0,0); monday.setDate(monday.getDate() - ((now.getDay()+6)%7));
const appliedThisWeek = apps.filter(a => a.applied && new Date(a.applied+"T00:00") >= monday).length;
const upcoming = apps.filter(a => a.deadline && activeSt.includes(a.status))
  .map(a => ({...a, dl: new Date(a.deadline+"T00:00")}))
  .filter(a => !isNaN(a.dl) && a.dl >= new Date(todayIso+"T00:00"))
  .sort((x,y) => x.dl - y.dl).slice(0,4);

const statCells = [
  ["Active", active], ["Interviewing", interviewing], ["Offers", offers],
  ["Response rate", respRate+"%"], ["Applied this wk", appliedThisWeek], ["Total", apps.length],
].map(([l,v]) => `<div class="jstat"><div class="jn">${esc(String(v))}</div><div class="jl">${esc(l)}</div></div>`).join("");

const dlHtml = upcoming.length
  ? `<div class="jdeadlines"><span class="jdl-h">⏳ Upcoming:</span>${upcoming.map(a=>`<span class="jdl-pill" data-path="${esc(a.path)}">${esc(a.company||a.name)} · ${esc(a.deadline)}</span>`).join("")}</div>`
  : "";

// ---- status-grouped list (each row has a status dropdown) ----
const list = ALLST.map(s => {
  const items = apps.filter(a => a.status === s.key)
    .sort((a,b) => (b.applied||"").localeCompare(a.applied||"") || a.company.localeCompare(b.company));
  const isPipeline = stageIdx(s.key) >= 0;
  if(!items.length && !isPipeline) return "";              // hide empty Rejected/Archived; always show pipeline stages
  const rows = items.map(a => {
    const meta = [a.location?esc(a.location):"", a.source?esc(a.source):"", a.applied?("applied "+esc(a.applied)):"", a.deadline?("⏳ "+esc(a.deadline)):""].filter(Boolean).join(" · ");
    return `<div class="jrow${a.priority==="high"?" hi":""}${a.expired?" isexp":""}" data-path="${esc(a.path)}" data-link="${esc(a.link)}">
      <select class="jsel" data-path="${esc(a.path)}" aria-label="Status for ${esc(a.company||a.name)}">${statusOptions(a.status)}</select>
      <div class="jinfo">
        <div class="jt">${esc(a.company||a.name)}${a.role?` <span class="jr">— ${esc(a.role)}</span>`:""}${a.expired?`<span class="jexp">Expired</span>`:""}</div>
        ${meta?`<div class="jm">${meta}</div>`:""}
        <div class="jnotebox" hidden><input class="jnoteinput" type="text" placeholder="Add a note to this job…" aria-label="Add a note"><button class="jnotesave" data-noteadd>Save</button></div>
      </div>
      <div class="jacts">
        <button class="jact jstar${a.priority==="high"?" on":""}" data-prio title="Toggle high priority">${a.priority==="high"?"★":"☆"}</button>
        <button class="jact" data-note title="Add a note">📝</button>
        ${a.link?`<button class="jact" data-posting title="Open the posting (check if expired)">🔗</button>`:""}
        <button class="jact${a.expired?" on":""}" data-expire title="Mark expired / live">⧖</button>
        <button class="jact" data-open title="Open note">↗</button>
        <button class="jact jdel" data-del title="Delete from dashboard">🗑</button>
      </div>
    </div>`;
  }).join("") || `<div class="jempty">— none yet —</div>`;
  return `<div class="jgroup" data-stage="${s.key}"><div class="jgh"><span class="jgi">${s.icon}</span> ${s.label} <span class="jgc">${items.length}</span></div><div class="jrows">${rows}</div></div>`;
}).join("");
const listHtml = apps.length ? `<div class="jlist">${list}</div>` : `<div class="jempty2">No applications yet — add one above, or make a note from the Job Application template to get started.</div>`;

box.innerHTML = `<div class="jsm">
  <div class="jsm-head"><span class="h">💼 Job Search</span><span class="n">${active} active · ${interviewing} interviewing · ${offers} offer${offers===1?"":"s"}</span></div>
  <div class="jstats">${statCells}</div>
  ${dlHtml}
  <div class="jadd"><input class="jinput" type="text" placeholder="Add application — “Company — Role”…" aria-label="Add application"><button class="jaddbtn" title="Add application">＋ Add</button></div>
  <div class="jhint">Set each job's <b>status</b> with its dropdown — the list regroups automatically.</div>
  ${listHtml}
</div>`;

const root = box.querySelector(".jsm");
const refresh = () => { try{ app.metadataCache.trigger("dataview:refresh-views"); }catch(e){} };
const openPath = p => { if(p) app.workspace.openLinkText(p, "", false); };

async function setStatus(path, status){
  const f = app.vault.getAbstractFileByPath(path); if(!f) return;
  try{
    if(app.fileManager && app.fileManager.processFrontMatter){
      await app.fileManager.processFrontMatter(f, fm => { fm.status = status; if(status==="applied" && !fm.applied) fm.applied = todayIso; });
    }
  }catch(e){ console.error(e); }
  refresh();
}
// per-row status dropdown → write frontmatter, list regroups on refresh
root.querySelectorAll("select.jsel").forEach(sel => {
  sel.addEventListener("click", e => e.stopPropagation());
  sel.addEventListener("change", () => { const path = sel.getAttribute("data-path"), v = sel.value; if(path && v) setStatus(path, v); });
});
// ---- per-row actions: add note / open posting / mark expired / open note / delete ----
function openExternal(url){ if(!url) return; try{ window.open(url, "_blank"); }catch(e){ try{ require("electron").shell.openExternal(url); }catch(e2){ console.error(e2); } } }
async function addNote(path, text){
  const f = app.vault.getAbstractFileByPath(path); if(!f) return;
  try{
    let c = await app.vault.read(f);
    const line = "- " + todayIso + ": " + text.trim();
    const h = c.indexOf("## 🗒️ Notes");
    if(h >= 0){ const nl = c.indexOf("\n", h); const at = nl >= 0 ? nl+1 : c.length; c = c.slice(0, at) + line + "\n" + c.slice(at); }
    else { c = c.replace(/\s*$/, "") + "\n\n## 🗒️ Notes\n" + line + "\n"; }
    await app.vault.modify(f, c);
  }catch(e){ console.error(e); }
  refresh();
}
async function toggleExpired(path){
  const f = app.vault.getAbstractFileByPath(path); if(!f) return;
  try{ if(app.fileManager && app.fileManager.processFrontMatter){
    await app.fileManager.processFrontMatter(f, fm => {
      const cur = (String(fm.expired) === "true") || /expired/i.test(String(fm.description_status || ""));
      fm.expired = !cur;
    });
  }}catch(e){ console.error(e); }
  refresh();
}
async function togglePriority(path){
  const f = app.vault.getAbstractFileByPath(path); if(!f) return;
  let nowHigh = false;
  try{ if(app.fileManager && app.fileManager.processFrontMatter){
    await app.fileManager.processFrontMatter(f, fm => {
      const cur = String(fm.priority || "").toLowerCase() === "high";
      fm.priority = cur ? "" : "high"; nowHigh = !cur;
    });
  }}catch(e){ console.error(e); }
  try{ await syncStarTask(f, nowHigh); }catch(e){ console.error(e); }
  refresh();
}
// starring a job auto-creates a dated #job to-do inside the job note (shows in the Today card);
// un-starring removes that auto-task again (only the untouched, unchecked one).
async function syncStarTask(f, nowHigh){
  let c = await app.vault.read(f);
  const autoRe = /^- \[ \] ⭐ .*#job.*$/m;
  const hasAuto = autoRe.test(c);
  if(nowHigh){
    if(hasAuto) return;
    const st = (c.match(/^status:\s*(.*)$/m)||[])[1] || "saved";
    const company = ((c.match(/^company:\s*(.*)$/m)||[])[1]||"").replace(/^["']|["']$/g,"").trim();
    const role = ((c.match(/^role:\s*(.*)$/m)||[])[1]||"").replace(/^["']|["']$/g,"").trim();
    const title = (company + (role?(" — "+role):"")) || f.basename;
    const verb = /saved/i.test(st) ? "Apply to" : "Follow up on";
    const line = "- [ ] ⭐ " + verb + " " + title + " 📅 " + todayIso + " #job";
    const hIdx = c.indexOf("## ✅ To do");
    if(hIdx>=0){ const nl=c.indexOf("\n",hIdx); const at=nl>=0?nl+1:c.length; c=c.slice(0,at)+line+"\n"+c.slice(at); }
    else { const m=c.match(/\n## /); const at=m?m.index+1:c.length; c=c.slice(0,at)+"## ✅ To do\n"+line+"\n\n"+c.slice(at); }
    await app.vault.modify(f, c);
  } else {
    if(!hasAuto) return;
    c = c.replace(/^- \[ \] ⭐ .*#job.*\n?/m, "");
    c = c.replace(/## ✅ To do\n(\s*\n)?(?=## |$)/, "");
    await app.vault.modify(f, c);
  }
}
function deleteJob(path){
  const f = app.vault.getAbstractFileByPath(path); if(!f) return;
  try{ if(app.fileManager && app.fileManager.trashFile) app.fileManager.trashFile(f); else if(app.vault.trash) app.vault.trash(f, true); }catch(e){ console.error(e); }
  refresh();
}
root.querySelectorAll(".jrow").forEach(row => {
  const path = row.getAttribute("data-path");
  const link = row.getAttribute("data-link");
  const sel = s => row.querySelector(s);
  const ob = sel('[data-open]'); if(ob) ob.addEventListener("click", e => { e.stopPropagation(); openPath(path); });
  const pb = sel('[data-posting]'); if(pb) pb.addEventListener("click", e => { e.stopPropagation(); openExternal(link); });
  const xb = sel('[data-expire]'); if(xb) xb.addEventListener("click", e => { e.stopPropagation(); toggleExpired(path); });
  const sb = sel('[data-prio]'); if(sb) sb.addEventListener("click", e => { e.stopPropagation(); togglePriority(path); });
  // add-note toggle + submit
  const nb = sel('[data-note]'), box = sel('.jnotebox'), inp = sel('.jnoteinput'), sv = sel('[data-noteadd]');
  if(nb && box) nb.addEventListener("click", e => { e.stopPropagation(); box.hidden = !box.hidden; if(!box.hidden && inp) inp.focus(); });
  const doNote = () => { if(inp && inp.value.trim()){ addNote(path, inp.value); inp.value = ""; if(box) box.hidden = true; } };
  if(inp){ inp.addEventListener("click", e => e.stopPropagation());
    inp.addEventListener("keydown", e => { if(e.key==="Enter"){ e.preventDefault(); doNote(); } else if(e.key==="Escape"){ inp.value=""; if(box) box.hidden = true; } }); }
  if(sv) sv.addEventListener("click", e => { e.stopPropagation(); doNote(); });
  // delete with a two-step inline confirm (no modal)
  const db = sel('[data-del]');
  if(db) db.addEventListener("click", e => {
    e.stopPropagation();
    if(db.getAttribute("data-armed") === "1"){ deleteJob(path); return; }
    db.setAttribute("data-armed","1"); db.textContent = "Delete?"; db.classList.add("armed");
    setTimeout(() => { if(db && db.isConnected){ db.removeAttribute("data-armed"); db.textContent = "🗑"; db.classList.remove("armed"); } }, 3000);
  });
});
// deadline pills open the note
root.querySelectorAll(".jdl-pill[data-path]").forEach(el => el.addEventListener("click", () => openPath(el.getAttribute("data-path"))));

// add application
async function ensureFolder(p){ if(!app.vault.getAbstractFileByPath(p)){ try{ await app.vault.createFolder(p); }catch(e){} } }
async function addApp(text){
  text = (text||"").trim(); if(!text) return;
  let company = text, role = "";
  const m = text.split(/\s+[—–-]\s+/);
  if(m.length>=2){ company=m[0].trim(); role=m.slice(1).join(" — ").trim(); }
  const safe = (company + (role?" — "+role:"")).replace(/[\\/:*?"<>|#^\[\]]/g,"").trim() || "Untitled application";
  await ensureFolder("Job Search"); await ensureFolder("Job Search/Applications");
  let path = "Job Search/Applications/"+safe+".md";
  if(app.vault.getAbstractFileByPath(path)) path = "Job Search/Applications/"+safe+" "+Date.now()+".md";
  const body = `---\ntags:\n  - application\ncompany: ${JSON.stringify(company)}\nrole: ${JSON.stringify(role)}\nstatus: saved\napplied: \ndeadline: \nlink: \nlocation: \nremote: \nsalary: \nsource: \ncontact: \nresume: \ncoverletter: \nnext: \npriority: \n---\n\n# ${safe}\n\n## 📝 Job description\n\n\n## 🎤 Interviews & timeline\n- \n\n## 🗒️ Notes\n- \n`;
  try{ const nf = await app.vault.create(path, body); refresh(); app.workspace.openLinkText(nf.path,"",false); }
  catch(e){ console.error(e); }
}
const jin = root.querySelector(".jinput"), jbtn = root.querySelector(".jaddbtn");
if(jin){ jin.addEventListener("keydown", e => { if(e.key==="Enter"){ e.preventDefault(); addApp(jin.value); jin.value=""; } }); }
if(jbtn){ jbtn.addEventListener("click", () => { addApp(jin.value); jin.value=""; }); }

} catch(err){ this.container.innerHTML = '<div style="color:#e0736b;padding:16px;font-family:sans-serif">💼 Job Search error: ' + err.message + '</div>'; console.error(err); }
```
