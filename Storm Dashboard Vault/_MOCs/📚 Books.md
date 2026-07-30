---
cssclasses:
  - books-moc
tags:
  - moc
---

```dataviewjs
try {
const box = this.container;

// resolve a book's cover → resource URL (Cover frontmatter, or Reading/Covers/<name>.<ext>)
function resolveCover(p){
  try {
    let c = (p.Cover != null ? p.Cover : (p.cover != null ? p.cover : p.COVER));
    let file = null;
    if (c) {
      if (typeof c === "object" && c.path) { file = app.vault.getAbstractFileByPath(c.path) || app.metadataCache.getFirstLinkpathDest(c.path, p.file.path); }
      else { let s = String(c).replace(/^!?\[\[/,"").replace(/\]\]$/,"").replace(/\|.*$/,"").trim(); if (s) file = app.vault.getAbstractFileByPath(s) || app.metadataCache.getFirstLinkpathDest(s, p.file.path); }
    }
    if (!file) { for (const ext of ["png","jpg","jpeg","webp"]) { const f = app.vault.getAbstractFileByPath("Reading/Covers/" + p.file.name + "." + ext); if (f) { file = f; break; } } }
    if (file) { try { return app.vault.adapter.getResourcePath(file.path); } catch(e2){ return app.vault.getResourcePath(file); } }
  } catch(e){}
  return "";
}
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

const order = { reading:0, want:1, "to-read":1, "want-to-read":1, done:2, finished:2, read:2 };
const books = dv.pages("#book").array().map(p => {
  const raw = (p.file.etags || p.file.tags || []);
  const etags = (Array.isArray(raw) ? raw : [raw]).map(String);
  const extra = etags
    .map(t => t.replace(/^#/,"").trim())
    .filter(t => t && t.toLowerCase() !== "book")
    .filter(t => /^[\p{L}\p{N}][\p{L}\p{N}_\-\/]*$/u.test(t));   // real word-tags only (kills blank/emoji chips)
  const status = (p.status || "").toString().toLowerCase();
  const keys = [];
  if (status) keys.push("status:" + status);
  extra.forEach(t => keys.push("tag:" + t.toLowerCase()));
  return { title: p.title || p.file.name, author: p.author || "", pct: Number(p.progress) || 0,
    color: p.color || "linear-gradient(160deg,#2f6f8a,#12303f)", cover: resolveCover(p),
    status, extra, link: p.file.path, keys };
}).sort((a,b) => (order[a.status] ?? 5) - (order[b.status] ?? 5) || b.pct - a.pct || a.title.localeCompare(b.title));

const statusVals = [...new Set(books.map(b => b.status).filter(Boolean))];
const tagVals = [...new Set(books.flatMap(b => b.extra.map(t => t.toLowerCase())))];

let chips = `<span class="chip active" data-f="all">All <span style="opacity:.55">${books.length}</span></span>`;
statusVals.forEach(s => { const n = books.filter(b => b.status === s).length; if(n>0) chips += `<span class="chip" data-f="status:${esc(s)}">${esc(s)} <span style="opacity:.55">${n}</span></span>`; });
tagVals.forEach(t => { const n = books.filter(b => b.extra.map(x=>x.toLowerCase()).includes(t)).length; if(n>0) chips += `<span class="chip" data-f="tag:${esc(t)}">#${esc(t)} <span style="opacity:.55">${n}</span></span>`; });

const cards = books.map((b,i) => {
  const badge = b.status ? `<span class="status">${esc(b.status)}</span>` : "";
  const cov = b.cover
    ? `<div class="cov"><img src="${esc(b.cover)}" alt="${esc(b.title)}" loading="lazy">${badge}</div>`
    : `<div class="cov" style="background:${esc(b.color)}">${badge}${esc(b.title)}</div>`;
  return `<div class="card" data-keys="${esc(b.keys.join(" "))}" data-link="${esc(b.link)}">
    ${cov}
    <div class="tt">${esc(b.title)}</div>
    ${b.author ? `<div class="au">${esc(b.author)}</div>` : ""}
    <div class="bar"><span style="width:${Math.max(0,Math.min(100,b.pct))}%"></span></div>
    <div class="pc">${b.pct}%${b.status === "reading" ? " · in progress" : ""}</div>
  </div>`;
}).join("");

box.innerHTML = `<div class="bm">
  <div class="bm-head"><span class="h">📚 Books</span><span class="n">${books.length} in your library · click a cover to open · filter below</span></div>
  ${(statusVals.length + tagVals.length) ? `<div class="filters"><span class="fg-label">Filter</span>${chips}</div>` : ""}
  <div class="grid">${cards || `<div class="empty">No books yet. Create a note tagged <b>#book</b> in <b>Reading/</b> (with <code>title</code>, <code>author</code>, <code>status</code>, <code>progress</code>, and an optional <code>Cover</code>) and it will show up here.</div>`}</div>
</div>`;

const root = box.querySelector(".bm");
root.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    root.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    const f = chip.getAttribute("data-f");
    root.querySelectorAll(".card").forEach(card => {
      const keys = (card.getAttribute("data-keys") || "").split(" ");
      card.classList.toggle("hidden", !(f === "all" || keys.includes(f)));
    });
  });
});
root.querySelectorAll(".card[data-link]").forEach(card => {
  card.style.cursor = "pointer";
  card.addEventListener("click", () => { const l = card.getAttribute("data-link"); if (l) app.workspace.openLinkText(l, "", false); });
});

} catch(err){
  this.container.innerHTML = '<div style="color:#e0736b;padding:16px;font-family:sans-serif">📚 Books MOC error: ' + err.message + '</div>';
  console.error(err);
}
```
