<%*
const title = await tp.system.prompt("Book title");
if (title) { await tp.file.rename(title); }
-%>
---
tags:
  - book
title: <% tp.file.title %>
author: 
status: reading
page: 0
pages: 
progress: 0
color: linear-gradient(160deg,#2f6f8a,#12303f)
Cover: 
File: 
---

# <% tp.file.title %>

[[📚 Books|← Books]]

```dataviewjs
try {
const me = dv.current();
const box = this.container;
const bookFile = app.vault.getAbstractFileByPath(me.file.path);
const bookName = me.file.name;
const HLDIR = "Reading/Highlights";
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const two = n => String(n).padStart(2,"0");
const todayIso = (()=>{ const d=new Date(); return `${d.getFullYear()}-${two(d.getMonth()+1)}-${two(d.getDate())}`; })();
const cur = () => (app.metadataCache.getFileCache(bookFile)||{}).frontmatter || me;
const pageNow = () => Number(cur().page)||0;
const pagesTot = () => Number(cur().pages)||0;
const pctNow = () => { const t=pagesTot(); return t? Math.min(100,Math.round(pageNow()/t*100)) : Math.max(0,Math.min(100,Number(cur().progress)||0)); };
const refresh = () => setTimeout(()=>{ try{ app.metadataCache.trigger("dataview:refresh-views"); }catch(e){} }, 60);
const notice = m => { try{ new (require("obsidian").Notice)(m, 4000); }catch(e){} };
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g," ").trim().slice(0,90);
const sanitize = s => String(s).replace(/[\\/:*?"<>|#^\[\]]/g,"").replace(/\s+/g," ").trim();
async function ensureFolder(p){ if(!app.vault.getAbstractFileByPath(p)){ try{ await app.vault.createFolder(p); }catch(e){} } }

async function savePlace(np, nt){
  await app.fileManager.processFrontMatter(bookFile, fm => {
    if(np!=null) fm.page = Math.max(0, Math.floor(np));
    if(nt!=null) fm.pages = Math.max(0, Math.floor(nt));
    const p = Number(fm.page)||0, t = Number(fm.pages)||0;
    if(t) fm.progress = Math.max(0, Math.min(100, Math.round(p/t*100)));
    if(p>0 && (!fm.status || ["want","to-read","want-to-read"].includes(String(fm.status).toLowerCase()))) fm.status = "reading";
  });
  refresh();
}

function myHighlights(){
  return dv.pages('"'+HLDIR+'"').where(h => (h.file.tags||[]).includes("#highlight")).array()
    .filter(h => { const bk=h.book; if(!bk) return false;
      if(bk.path) return bk.path===me.file.path;
      return String(bk).replace(/^\[\[|\]\]$/g,"").replace(/\|.*$/,"").trim()===bookName; })
    .sort((a,b)=>(Number(a.page)||0)-(Number(b.page)||0) || String(a.file.name).localeCompare(b.file.name));
}

async function createHighlight(text, note, page){
  text=(text||"").trim(); if(!text) return null;
  await ensureFolder("Reading"); await ensureFolder(HLDIR);
  const snip = sanitize(text).slice(0,52) || "highlight";
  let path = `${HLDIR}/${sanitize(bookName)} — ${snip}.md`;
  if(app.vault.getAbstractFileByPath(path)) path = `${HLDIR}/${sanitize(bookName)} — ${snip} ${Date.now()}.md`;
  const quote = text.split(/\n/).map(l=>"> "+l).join("\n");
  const body = `---\ntags:\n  - highlight\nbook: "[[${bookName}]]"\npage: ${page!=null&&page!==""?page:""}\ncreated: ${todayIso}\nkey: ${JSON.stringify(norm(text))}\n---\n\n${quote}\n\n${note&&note.trim()?note.trim()+"\n":""}`;
  try{ return await app.vault.create(path, body); }
  catch(e){ console.error(e); notice("Couldn't save highlight: "+e.message); return null; }
}

async function pullInline(){
  const txt = await app.vault.read(bookFile);
  const body = txt.replace(/^---[\s\S]*?\n---\n/,"").replace(/```dataviewjs[\s\S]*?```/g,"");
  const found = [];
  for(const m of body.matchAll(/==([^=\n]+)==/g)){ const t=m[1].trim(); if(t) found.push(t); }
  const sec = body.split(/^##\s+/m).find(s=>/^highlights/i.test(s));
  if(sec){ for(const m of sec.matchAll(/^>\s?(.+)$/gm)){ const t=m[1].trim(); if(t && !/^\[!/.test(t)) found.push(t); } }
  const have = new Set(myHighlights().map(h => String(h.key||norm(h.file.name))));
  let made=0;
  for(const t of found){ const k=norm(t); if(!t||have.has(k)) continue; have.add(k); const f=await createHighlight(t,"",pageNow()); if(f) made++; }
  notice(made? `Pulled ${made} new highlight${made===1?"":"s"} into their own notes.` : "No new inline highlights found. Use ==marks== or a ## Highlights section.");
  refresh();
}

function delHighlight(path){ const f=app.vault.getAbstractFileByPath(path); if(!f) return;
  try{ if(app.fileManager.trashFile) app.fileManager.trashFile(f); else if(app.vault.trash) app.vault.trash(f,true); }catch(e){ console.error(e); } refresh(); }

function render(){
  const p=pageNow(), t=pagesTot(), pc=pctNow();
  const hls = myHighlights();
  const rows = hls.map(h => {
    const snip = String(h.file.name).replace(sanitize(bookName)+" — ","").replace(/\s\d{10,}$/,"");
    const pg = (h.page!=null && h.page!=="") ? ("p."+esc(String(h.page))) : "—";
    return `<div class="rd-hl" data-path="${esc(h.file.path)}"><span class="rd-hlp">${pg}</span><span class="rd-hlt">${esc(snip)}</span><span class="rd-hlacts"><button data-open title="Open note">↗</button><button data-del title="Delete">🗑</button></span></div>`;
  }).join("") || `<div class="rd-empty">No highlights yet. Add one above, or write <code>==highlights==</code> (or quotes under a <code>## Highlights</code> heading) and hit Pull inline.</div>`;
  box.innerHTML = `<div class="stormreader">
    <div class="rd-head">📖 Reading companion${cur().status?`<span class="rd-status">${esc(String(cur().status))}</span>`:""}</div>
    <div class="rd-bar"><span style="width:${pc}%"></span></div>
    <div class="rd-pos">
      <label>Page <input class="rd-page" type="number" min="0" value="${p||""}"></label>
      <span class="rd-of">of</span>
      <label><input class="rd-pages" type="number" min="0" placeholder="total" value="${t||""}"></label>
      <span class="rd-pct">${pc}%</span>
      <button class="rd-save">Save place</button>
    </div>
    <div class="rd-add">
      <textarea class="rd-text" rows="2" placeholder="Paste or type a passage to highlight…"></textarea>
      <input class="rd-note" type="text" placeholder="A note on it (optional)">
      <div class="rd-addrow">
        <label class="rd-pglbl">p.<input class="rd-hlpage" type="number" min="0" value="${p||""}"></label>
        <button class="rd-addbtn">＋ Save highlight</button>
        <button class="rd-pull" title="Turn ==highlights== and quotes under a ## Highlights heading into their own linked notes">⤵︎ Pull inline</button>
      </div>
    </div>
    <div class="rd-hllist"><div class="rd-hlhead">Highlights <span class="rd-hln">${hls.length}</span></div>${rows}</div>
  </div>`;
  wire();
}

function wire(){
  const q = s => box.querySelector(s);
  const pageI=q(".rd-page"), pagesI=q(".rd-pages"), saveB=q(".rd-save");
  const doSave = () => savePlace(pageI.value===""?0:Number(pageI.value), pagesI.value===""?null:Number(pagesI.value));
  if(saveB) saveB.onclick=doSave;
  [pageI,pagesI].forEach(el=>{ if(el) el.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); doSave(); } }); });
  const textA=q(".rd-text"), noteI=q(".rd-note"), hlpage=q(".rd-hlpage"), addB=q(".rd-addbtn"), pullB=q(".rd-pull");
  if(addB) addB.onclick=async ()=>{ const tx=(textA.value||"").trim(); if(!tx){ textA.focus(); return; } addB.disabled=true;
    const f=await createHighlight(tx, noteI.value, hlpage.value===""?pageNow():Number(hlpage.value));
    if(f){ textA.value=""; noteI.value=""; } addB.disabled=false; refresh(); };
  if(pullB) pullB.onclick=()=>pullInline();
  box.querySelectorAll(".rd-hl").forEach(row=>{ const path=row.getAttribute("data-path");
    const o=row.querySelector("[data-open]"); if(o) o.onclick=()=>{ if(path) app.workspace.openLinkText(path,"",false); };
    const d=row.querySelector("[data-del]"); if(d) d.onclick=()=>{ if(d.getAttribute("data-armed")==="1"){ delHighlight(path); return; } d.setAttribute("data-armed","1"); d.textContent="✓?"; setTimeout(()=>{ if(d.isConnected){ d.removeAttribute("data-armed"); d.textContent="🗑"; } },2500); };
  });
}
render();
} catch(err){ this.container.innerHTML = '<div style="color:#e0736b;padding:14px;font-family:sans-serif">📖 Reader error: '+err.message+'</div>'; console.error(err); }
```

## Highlights

> Paste quotes here as you read (or wrap phrases in ==marks==). Use the panel's **Pull inline** button to turn anything here into its own linked note.

## Notes

- 
