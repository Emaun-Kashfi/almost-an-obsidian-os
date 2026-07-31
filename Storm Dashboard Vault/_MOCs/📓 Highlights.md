---
cssclasses:
  - dashboard
tags:
  - moc
---

# 📓 Highlights

[[📚 Books|← Books]]　·　[[🔁 Daily Review|Daily Review]]　·　[[📈 Reading Stats|Reading Stats]]

> Every note tagged **#highlight** shows here, grouped by book. Each one is created from a book's reading panel and links back to it. Click a highlight to open its note.

```dataviewjs
try {
const box = this.container;
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const hls = dv.pages("#highlight").array();
const sanitize = s => String(s).replace(/[\\/:*?"<>|#^\[\]]/g,"").replace(/\s+/g," ").trim();
const byBook = {};
for (const h of hls) {
  const bk = h.book && h.book.path ? h.book : null;
  const name = bk ? bk.path.split("/").pop().replace(/\.md$/,"") : (h.book ? String(h.book).replace(/^\[\[|\]\]$/g,"").replace(/\|.*$/,"") : "Unsorted");
  (byBook[name] = byBook[name] || { name, path: bk ? bk.path : "", items: [] }).items.push(h);
}
const groups = Object.values(byBook).sort((a,b)=>a.name.localeCompare(b.name));
if (!hls.length) {
  box.innerHTML = `<div class="hl-empty">No highlights yet. Open a book in <b>Reading/</b> and add one from its reading panel.</div>`;
} else {
  const html = groups.map(g => {
    const items = g.items.slice().sort((a,b)=>(Number(a.page)||0)-(Number(b.page)||0));
    const rows = items.map(h => {
      const snip = String(h.file.name).replace(sanitize(g.name)+" — ","").replace(/\s\d{10,}$/,"");
      const pg = (h.page!=null && h.page!=="") ? ("p."+esc(String(h.page))) : "—";
      return `<div class="hl-row" data-path="${esc(h.file.path)}"><span class="hl-pg">${pg}</span><span class="hl-tx">${esc(snip)}</span></div>`;
    }).join("");
    return `<div class="hl-group"><div class="hl-bk" ${g.path?`data-path="${esc(g.path)}"`:""}>📖 ${esc(g.name)} <span class="hl-ct">${items.length}</span></div>${rows}</div>`;
  }).join("");
  box.innerHTML = `<div class="hlm"><div class="hl-tot">${hls.length} highlight${hls.length===1?"":"s"} across ${groups.length} book${groups.length===1?"":"s"}</div>${html}</div>`;
}
const root = box.querySelector(".hlm") || box;
root.querySelectorAll("[data-path]").forEach(el => { el.style.cursor="pointer"; el.addEventListener("click", () => { const p=el.getAttribute("data-path"); if(p) app.workspace.openLinkText(p,"",false); }); });
} catch(err){ this.container.innerHTML = '<div style="color:#e0736b;padding:14px">📓 Highlights error: '+err.message+'</div>'; console.error(err); }
```
