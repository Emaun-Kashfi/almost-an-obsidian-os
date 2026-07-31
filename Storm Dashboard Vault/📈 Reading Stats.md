---
cssclasses:
  - dashboard
tags:
  - moc
---

# 📈 Reading Stats

[[📚 Books|← Books]]　·　[[🔁 Daily Review|Daily Review]]

> Built from your books' status and the reading sessions you log in each book's panel. Log sessions (pages + minutes) to power the pace and projections.

```dataviewjs
try {
const box = this.container;
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const two = n => String(n).padStart(2,"0");
const iso = d => `${d.getFullYear()}-${two(d.getMonth()+1)}-${two(d.getDate())}`;
const books = dv.pages("#book").array();
const st = b => String(b.status||"").toLowerCase();
const reading = books.filter(b => st(b)==="reading");
const finished = books.filter(b => ["done","finished","read"].includes(st(b)));
const want = books.filter(b => ["want","to-read","want-to-read"].includes(st(b)));

// gather reading-log sessions across all books
let sessions = [];
for(const b of books){
  try{ const t = await dv.io.load(b.file.path) || "";
    const seg = t.split(/^##\s*Reading log/m)[1];
    if(seg){ const body = seg.split(/\n##\s/)[0];
      for(const m of body.matchAll(/^-\s*(\d{4}-\d{2}-\d{2})\s*·\s*(\d+)\s*pages(?:\s*·\s*(\d+)\s*min)?/gm))
        sessions.push({ date:m[1], pages:+m[2], min:+(m[3]||0), book:b.file.name });
    }
  }catch(e){}
}
const now = new Date();
const monday = new Date(now); monday.setHours(0,0,0,0); monday.setDate(monday.getDate() - ((now.getDay()+6)%7));
const weekPages = sessions.filter(s => new Date(s.date+"T00:00") >= monday).reduce((a,s)=>a+s.pages,0);
const totalPages = sessions.reduce((a,s)=>a+s.pages,0);
const withMin = sessions.filter(s => s.min>0);
const pace = withMin.length ? Math.round(withMin.reduce((a,s)=>a+s.pages,0) / (withMin.reduce((a,s)=>a+s.min,0)/60)) : 0;
// reading streak (consecutive days with a session)
const dset = new Set(sessions.map(s=>s.date));
let streak=0; { const dd=new Date(now); dd.setHours(0,0,0,0); if(!dset.has(iso(dd))) dd.setDate(dd.getDate()-1); while(dset.has(iso(dd))){ streak++; dd.setDate(dd.getDate()-1); } }
// pages/day over last 14 days (for projections)
const recent = sessions.filter(s => (now - new Date(s.date+"T00:00"))/(864e5) <= 14);
const perDay = recent.length ? Math.max(1, Math.round(recent.reduce((a,s)=>a+s.pages,0)/14)) : 0;

const tile = (n,l) => `<div class="rs-tile"><div class="rs-n">${esc(String(n))}</div><div class="rs-l">${esc(l)}</div></div>`;
const tiles = [
  tile(reading.length,"Reading now"), tile(finished.length,"Finished"), tile(want.length,"Want to read"),
  tile(weekPages,"Pages this week"), tile(pace?pace+" p/hr":"—","Reading pace"), tile("🔥 "+streak,"Day streak"),
].join("");

const projRows = reading.map(b => {
  const page = Number(b.page)||0, pages = Number(b.pages)||0;
  const pct = pages ? Math.round(page/pages*100) : (Number(b.progress)||0);
  const remain = pages ? Math.max(0, pages-page) : 0;
  const days = (remain && perDay) ? Math.ceil(remain/perDay) : null;
  const proj = days!=null ? `~${days} day${days===1?"":"s"} left` : (pages?`${remain} pages left`:"set a page count to project");
  return `<div class="rs-row" data-path="${esc(b.file.path)}"><span class="rs-bk">${esc(b.title||b.file.name)}</span><span class="rs-bar"><span style="width:${pct}%"></span></span><span class="rs-proj">${esc(proj)}</span></div>`;
}).join("") || `<div class="rs-empty">Nothing in progress. Set a book's status to “reading”.</div>`;

box.innerHTML = `<div class="rsm">
  <div class="rs-tiles">${tiles}</div>
  <div class="rs-h2">In progress</div>
  <div class="rs-rows">${projRows}</div>
  <div class="rs-foot">${sessions.length} sessions logged · ${totalPages} pages tracked all-time</div>
</div>`;
box.querySelectorAll(".rs-row").forEach(r=>{ r.style.cursor="pointer"; r.onclick=()=>{ const p=r.getAttribute("data-path"); if(p) app.workspace.openLinkText(p,"",false); }; });
} catch(err){ this.container.innerHTML = '<div style="color:#e0736b;padding:14px">📈 Stats error: '+err.message+'</div>'; console.error(err); }
```
