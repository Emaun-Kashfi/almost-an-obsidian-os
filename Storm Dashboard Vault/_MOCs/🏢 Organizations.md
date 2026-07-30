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
const norm = s => String(s||"").toLowerCase().replace(/[.,]/g,"").replace(/\s+/g," ").trim();

const orgs = dv.pages("#org").array().map(o => ({
  name: o.name ? String(o.name) : o.file.name,
  category: String(o.category||"").toLowerCase(),
  type: String(o.type||"employer").toLowerCase(),
  location: o.location ? String(o.location) : "",
  careers: o.careers ? String(o.careers) : "",
  notePath: o.file.path,
}));

const jobs = dv.pages("#application").array()
  .filter(p => !String(p.file.path).startsWith("_templates/"))
  .map(p => ({
    company: p.company ? String(p.company) : "",
    role: p.role ? String(p.role) : "",
    status: String(p.status||"saved").toLowerCase().trim(),
    location: p.location ? String(p.location) : "",
    applied: p.applied ? String(p.applied).slice(0,10) : "",
    path: p.file.path, name: p.file.name,
    expired: (String(p.expired)==="true") || /expired/i.test(String(p.description_status||"")),
  }));

const byCo = {};
jobs.forEach(j => { const k = norm(j.company); (byCo[k]=byCo[k]||[]).push(j); });

const catMeta = { target:{icon:"🎯",label:"Target companies",rank:0}, local:{icon:"📍",label:"Local / nearby",rank:1} };
const typeRank = { employer:0, recruiter:1 };
orgs.sort((a,b) => ((catMeta[a.category]||{rank:2}).rank - (catMeta[b.category]||{rank:2}).rank)
  || ((typeRank[a.type]||0) - (typeRank[b.type]||0)) || a.name.localeCompare(b.name));

const SI = {saved:"🔖",applied:"📤",screen:"📞",interview:"🎤",final:"🏁",offer:"🎉",rejected:"✖️",archived:"🗄️"};
let totalJobs = 0;
const groups = orgs.map(o => {
  const items = (byCo[norm(o.name)]||[]).sort((a,b)=>(b.applied||"").localeCompare(a.applied||"") || a.role.localeCompare(b.role));
  totalJobs += items.length;
  const cat = catMeta[o.category] || {icon:"🏢",label:o.category||"Other"};
  const rows = items.map(a => {
    const meta = [a.location?esc(a.location):"", a.status?esc(a.status):"", a.applied?("applied "+esc(a.applied)):""].filter(Boolean).join(" · ");
    return `<div class="jrow${a.expired?" isexp":""}" data-path="${esc(a.path)}">
      <span class="jsi" title="${esc(a.status)}">${SI[a.status]||"•"}</span>
      <div class="jinfo"><div class="jt">${esc(a.role||a.name)}${a.expired?'<span class="jexp">Expired</span>':''}</div>${meta?`<div class="jm">${meta}</div>`:''}</div>
      <button class="jact" data-open title="Open note">↗</button>
    </div>`;
  }).join("") || `<div class="jempty">— no jobs from this org in your vault yet —</div>`;
  const badge = o.type==="recruiter" ? `<span class="jcat rec">recruiter</span>` : `<span class="jcat">${cat.icon} ${esc(cat.label)}</span>`;
  const careers = o.careers ? `<a class="jorgc" href="${esc(o.careers)}" target="_blank" rel="noopener">careers ↗</a>` : "";
  return `<div class="jgroup">
     <div class="jgh"><span class="jgi">${cat.icon}</span> <span class="jorgname" data-orgpath="${esc(o.notePath)}">${esc(o.name)}</span> ${badge} ${careers} <span class="jgc">${items.length}</span></div>
     <div class="jrows">${rows}</div></div>`;
}).join("");

box.innerHTML = `<div class="jsm">
  <div class="jsm-head"><span class="h">🏢 Organizations</span><span class="n">${orgs.length} followed · ${totalJobs} job${totalJobs===1?"":"s"} · grouped by organization</span></div>
  <div class="jhint">Group the organizations you're tracking, with all their roles in one place. Add one: make a note tagged <b>#org</b> whose <b>name</b> matches the company (see <b>Job Search/Organizations/</b>).</div>
  ${orgs.length ? `<div class="jlist">${groups}</div>` : `<div class="jempty2">No followed organizations yet — add notes tagged <b>#org</b> in the Organizations folder.</div>`}
</div>`;

const root = box.querySelector(".jsm");
const openPath = p => { if(p) app.workspace.openLinkText(p, "", false); };
root.querySelectorAll(".jrow").forEach(r => {
  const p = r.getAttribute("data-path");
  r.addEventListener("click", e => { if(e.target.closest("a")) return; e.stopPropagation(); openPath(p); });
});
root.querySelectorAll(".jorgname[data-orgpath]").forEach(el => el.addEventListener("click", e => { e.stopPropagation(); openPath(el.getAttribute("data-orgpath")); }));

} catch(err){ this.container.innerHTML = '<div style="color:#e0736b;padding:16px;font-family:sans-serif">🏢 Organizations error: ' + err.message + '</div>'; console.error(err); }
```
