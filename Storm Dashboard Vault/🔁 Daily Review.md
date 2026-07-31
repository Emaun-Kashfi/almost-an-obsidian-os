---
cssclasses:
  - dashboard
tags:
  - moc
---

# 🔁 Daily Review

[[📓 Highlights|← Highlights]]　·　[[📚 Books|Books]]

> A few highlights resurfaced from across everything you've read. The set is stable through the day and reshuffles tomorrow — or hit Shuffle for a fresh pull. The habit of seeing old highlights is what makes them stick.

```dataviewjs
try {
const box = this.container;
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const hls = dv.pages("#highlight").array();
const N = 5;

function mulberry(seed){ let s=seed>>>0; return function(){ s=s+0x6D2B79F5|0; let t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function pick(rand){ const a=hls.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(rand()*(i+1)); const x=a[i]; a[i]=a[j]; a[j]=x; } return a.slice(0,N); }

async function cardHtml(h){
  let quote="";
  try{ const t = await dv.io.load(h.file.path) || ""; quote = t.replace(/^---[\s\S]*?\n---\n/,"").trim(); }catch(e){}
  quote = quote.replace(/^>\s?/gm,"").trim();
  const bk = (h.book && h.book.path) ? h.book.path.split("/").pop().replace(/\.md$/,"") : (h.book ? String(h.book).replace(/^\[\[|\]\]$/g,"").replace(/\|.*$/,"") : "");
  const pg = (h.page!=null && h.page!=="") ? ` · p.${esc(String(h.page))}` : "";
  const ty = h.type ? ` · ${esc(String(h.type))}` : "";
  return `<div class="rv-card${h.type?" t-"+esc(String(h.type)):""}" data-path="${esc(h.file.path)}"><div class="rv-q">${esc(quote)}</div><div class="rv-meta">📖 ${esc(bk)}${pg}${ty}</div></div>`;
}
async function draw(chosen){
  const parts = []; for(const h of chosen) parts.push(await cardHtml(h));
  box.querySelector(".rv-cards").innerHTML = parts.join("") || `<div class="rv-empty">—</div>`;
  box.querySelectorAll(".rv-card").forEach(c=>{ c.style.cursor="pointer"; c.onclick=()=>{ const p=c.getAttribute("data-path"); if(p) app.workspace.openLinkText(p,"",false); }; });
}

if(!hls.length){
  box.innerHTML = `<div class="rv-empty">No highlights yet. Add some from any book's reading panel, then check back here.</div>`;
} else {
  box.innerHTML = `<div class="rvm"><div class="rv-head"><span class="rv-n">${hls.length} highlight${hls.length===1?"":"s"} in your library</span><button class="rv-shuffle">🔀 Shuffle</button></div><div class="rv-cards"></div></div>`;
  const d = new Date();
  const seed = d.getFullYear()*400 + (d.getMonth()+1)*32 + d.getDate();
  await draw(pick(mulberry(seed)));
  box.querySelector(".rv-shuffle").onclick = async () => { await draw(pick(mulberry((Math.random()*1e9)>>>0))); };
}
} catch(err){ this.container.innerHTML = '<div style="color:#e0736b;padding:14px">🔁 Review error: '+err.message+'</div>'; console.error(err); }
```
