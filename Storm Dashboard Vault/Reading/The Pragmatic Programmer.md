---
tags:
  - book
title: The Pragmatic Programmer
author: Hunt & Thomas
status: want
progress: 0
page: 0
pages: 352
Cover: 
File: 
---

# The Pragmatic Programmer

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
  for(const m of body.matchAll(/<mark[^>]*>([\s\S]*?)<\/mark>/g)){ const t=m[1].replace(/<[^>]+>/g,"").trim(); if(t) found.push(t); }
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

// ---- reading-mode (cssclass) controls ----
function ccList(){ let cc=cur().cssclasses||cur().cssclass||[]; if(!Array.isArray(cc)) cc=[cc].filter(Boolean); return cc.map(String); }
async function setCC(add, remove){
  await app.fileManager.processFrontMatter(bookFile, fm => {
    let cc = fm.cssclasses || fm.cssclass || []; if(!Array.isArray(cc)) cc=[cc].filter(Boolean); cc=cc.map(String);
    cc = cc.filter(c => !remove.includes(c));
    for(const a of add) if(a && !cc.includes(a)) cc.push(a);
    fm.cssclasses = cc; if(fm.cssclass) delete fm.cssclass;
  });
  refresh();
}
const readingOn = () => ccList().includes("reading-mode");
async function toggleReading(){ if(readingOn()) await setCC([], ["reading-mode","reading-sm","reading-lg"]); else await setCC(["reading-mode"], []); }
async function cycleSize(){ const cc=ccList(); if(cc.includes("reading-lg")) await setCC(["reading-sm"],["reading-lg"]); else if(cc.includes("reading-sm")) await setCC([],["reading-sm","reading-lg"]); else await setCC(["reading-mode","reading-lg"],["reading-sm"]); }

// ---- chapters / table of contents ----
function chapters(){
  const hs = (app.metadataCache.getFileCache(bookFile)||{}).headings || [];
  const skip = /^(Highlights|Notes|Reading companion|Reading log|Session|Summary|Outcome|Milestones)\b/i;
  const real = hs.filter(h => !skip.test(h.heading) && h.heading.trim() && h.heading.trim()!==bookName);
  if(!real.length) return [];
  const minL = Math.min(...real.map(h=>h.level));
  return real.filter(h => h.level<=minL);
}

// ---- reading sessions ----
async function logSession(pages, mins){
  pages=Math.max(0,Math.floor(pages||0)); mins=Math.max(0,Math.floor(mins||0));
  if(!pages && !mins){ notice("Enter pages and/or minutes for the session."); return; }
  const pace = mins? Math.round(pages/(mins/60)) : 0;
  const line = `- ${todayIso} · ${pages} pages · ${mins} min${pace?` · ${pace} p/hr`:""}`;
  let txt = await app.vault.read(bookFile);
  if(/^##\s*Reading log/m.test(txt)) txt = txt.replace(/(^##\s*Reading log[^\n]*\n)/m, `$1${line}\n`);
  else txt = txt.replace(/\s*$/,"") + `\n\n## Reading log\n${line}\n`;
  await app.vault.modify(bookFile, txt);
  if(pages) await savePlace(pageNow()+pages, null); else refresh();
  notice("Logged a reading session.");
}

// ---- compile highlights into one summary note ----
async function compileSummary(){
  const hls = myHighlights();
  if(!hls.length){ notice("No highlights to compile yet."); return; }
  await ensureFolder("Reading"); await ensureFolder("Reading/Summaries");
  const parts=[];
  for(const h of hls){
    try{ const t = await app.vault.read(app.vault.getAbstractFileByPath(h.file.path));
      const bd = t.replace(/^---[\s\S]*?\n---\n/,"").trim();
      const pg = (h.page!=null&&h.page!=="")?`**p.${h.page}** · `:"";
      const ty = h.type?` _(${h.type})_`:"";
      parts.push(`${pg}${bd}${ty}`);
    }catch(e){}
  }
  const doc = `---\ntags:\n  - summary\nbook: "[[${bookName}]]"\ncreated: ${todayIso}\n---\n\n# ${bookName} — highlights & notes\n\n[[${bookName}|← back to the book]] · ${hls.length} highlights\n\n${parts.join("\n\n")}\n`;
  const path = `Reading/Summaries/${sanitize(bookName)}.md`;
  const ex = app.vault.getAbstractFileByPath(path);
  try{ if(ex) await app.vault.modify(ex, doc); else await app.vault.create(path, doc);
    notice(`Compiled ${hls.length} highlights.`); app.workspace.openLinkText(path,"",false);
  }catch(e){ console.error(e); notice("Couldn't compile: "+e.message); }
}

function render(){
  const p=pageNow(), t=pagesTot(), pc=pctNow();
  const hls = myHighlights();
  const chaps = chapters();
  const rmOn = readingOn();
  const rows = hls.map(h => {
    const snip = String(h.file.name).replace(sanitize(bookName)+" — ","").replace(/\s\d{10,}$/,"");
    const pg = (h.page!=null && h.page!=="") ? ("p."+esc(String(h.page))) : "—";
    const tc = h.type?(" t-"+esc(String(h.type))):"";
    return `<div class="rd-hl${tc}" data-path="${esc(h.file.path)}"><span class="rd-hlp">${pg}</span><span class="rd-hlt">${esc(snip)}</span><span class="rd-hlacts"><button data-open title="Open note">↗</button><button data-del title="Delete">🗑</button></span></div>`;
  }).join("") || `<div class="rd-empty">No highlights yet. Select text in the note for the popup, use the form below, or write <code>==highlights==</code> and hit Pull inline.</div>`;
  const toc = chaps.length ? `<div class="rd-toc"><div class="rd-sub">Chapters <span class="rd-hln">${chaps.length}</span></div>${chaps.map(c=>`<div class="rd-ch" data-h="${esc(c.heading)}">${esc(c.heading)}</div>`).join("")}</div>` : "";
  box.innerHTML = `<div class="stormreader">
    <div class="rd-head">📖 Reading companion${cur().status?`<span class="rd-status">${esc(String(cur().status))}</span>`:""}
      <span class="rd-appear"><button class="rd-rm${rmOn?" on":""}" title="Comfortable serif reading layout">📖 Reading mode</button><button class="rd-size" title="Cycle text size" ${rmOn?"":'style="display:none"'}>A±</button></span></div>
    <div class="rd-bar"><span style="width:${pc}%"></span></div>
    <div class="rd-pos">
      <label>Page <input class="rd-page" type="number" min="0" value="${p||""}"></label>
      <span class="rd-of">of</span><label><input class="rd-pages" type="number" min="0" placeholder="total" value="${t||""}"></label>
      <span class="rd-pct">${pc}%</span><button class="rd-save">Save place</button></div>
    ${toc}
    <div class="rd-add">
      <textarea class="rd-text" rows="2" placeholder="Paste or type a passage to highlight…"></textarea>
      <input class="rd-note" type="text" placeholder="A note on it (optional)">
      <div class="rd-addrow"><label class="rd-pglbl">p.<input class="rd-hlpage" type="number" min="0" value="${p||""}"></label>
        <button class="rd-addbtn">＋ Save highlight</button>
        <button class="rd-pull" title="Turn ==highlights== / <mark> / quotes under a ## Highlights heading into their own notes">⤵︎ Pull inline</button></div>
    </div>
    <div class="rd-hllist"><div class="rd-hlhead">Highlights <span class="rd-hln">${hls.length}</span>${hls.length?`<button class="rd-compile" title="Gather all highlights into one summary note">📄 Compile</button>`:""}</div>${rows}</div>
    <div class="rd-session"><div class="rd-sub">Log a session</div>
      <div class="rd-addrow"><label>read <input class="rd-spages" type="number" min="0" placeholder="pages"></label>
        <label>in <input class="rd-smin" type="number" min="0" placeholder="min"></label>
        <button class="rd-slog">Log session</button></div></div>
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
  const rm=q(".rd-rm"), sz=q(".rd-size");
  if(rm) rm.onclick=()=>toggleReading();
  if(sz) sz.onclick=()=>cycleSize();
  const comp=q(".rd-compile"); if(comp) comp.onclick=()=>compileSummary();
  const slog=q(".rd-slog"); if(slog) slog.onclick=()=>{ const sp=q(".rd-spages").value, sm=q(".rd-smin").value; logSession(Number(sp)||0, Number(sm)||0); };
  box.querySelectorAll(".rd-ch").forEach(el=>el.onclick=()=>{ try{ app.workspace.openLinkText("#"+el.getAttribute("data-h"), me.file.path, false); }catch(e){} });
  box.querySelectorAll(".rd-hl").forEach(row=>{ const path=row.getAttribute("data-path");
    const o=row.querySelector("[data-open]"); if(o) o.onclick=()=>{ if(path) app.workspace.openLinkText(path,"",false); };
    const d=row.querySelector("[data-del]"); if(d) d.onclick=()=>{ if(d.getAttribute("data-armed")==="1"){ delHighlight(path); return; } d.setAttribute("data-armed","1"); d.textContent="✓?"; setTimeout(()=>{ if(d.isConnected){ d.removeAttribute("data-armed"); d.textContent="🗑"; } },2500); };
  });
}
render();
} catch(err){ this.container.innerHTML = '<div style="color:#e0736b;padding:14px;font-family:sans-serif">📖 Reader error: '+err.message+'</div>'; console.error(err); }
```

## Highlights

> Paste quotes here as you read (or wrap phrases in ==marks==), then hit **Pull inline** in the panel above to turn them into their own linked notes.


[[📚 Books|← Books]]

**Author:** Hunt & Thomas

## Notes
- Example book — update progress and status in the properties.
