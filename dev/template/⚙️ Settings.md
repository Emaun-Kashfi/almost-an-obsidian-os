---
cssclasses:
  - storm-settings
tags:
  - settings
---

```dataviewjs
try {
const root = dv.container;
const g = (typeof window!=="undefined") ? window : globalThis;
const IMGEXT = ["png","jpg","jpeg","webp","gif","avif","bmp"];
const BANNERDIR = "Images/Banner";
const DEFAULT_BANNER = "Images/System Images/storm-banner.png";

function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function resPath(p){ try{ return app.vault.adapter.getResourcePath(p); }catch(e){ const f=app.vault.getAbstractFileByPath(p); return f?app.vault.getResourcePath(f):""; } }

// locate the dashboard note (cssclass storm-home), fall back to Dashboard.md
function findDash(){
  for(const f of app.vault.getMarkdownFiles()){
    const fm=(app.metadataCache.getFileCache(f)||{}).frontmatter||{};
    let cc=fm.cssclasses||fm.cssclass||[]; if(!Array.isArray(cc)) cc=[cc];
    if(cc.includes("storm-home")) return f;
  }
  return app.vault.getAbstractFileByPath("Dashboard.md");
}
const dash = findDash();
function dashFm(){ return dash ? ((app.metadataCache.getFileCache(dash)||{}).frontmatter||{}) : {}; }

// optimistic local state (frontmatter cache updates async, so we drive the UI from here)
let state = null;
function initState(){ const fm=dashFm(); state = { mode:(fm.stormMode==="match")?"match":"community", banner: fm.stormBanner||"" }; }

async function writeCfg(mut){
  if(!dash){ return; }
  try{ await app.fileManager.processFrontMatter(dash, fm=>mut(fm)); }catch(e){ console.error("storm settings write", e); }
  try{ app.metadataCache.trigger("dataview:refresh-views"); }catch(e){}
}

function listBanners(){
  return app.vault.getFiles()
    .filter(f=>f.path.startsWith(BANNERDIR+"/") && IMGEXT.includes((f.extension||"").toLowerCase()))
    .sort((a,b)=>a.name.localeCompare(b.name));
}

function tile(path, label, on){
  return `<div class="bantile${on?" on":""}" data-path="${esc(path)}"><div class="bthumb"><img src="${esc(resPath(path))}" alt="" loading="lazy"></div><span>${esc(label)}</span></div>`;
}

function render(){
  const mode = state.mode, chosen = state.banner;
  const banners = listBanners();
  const effective = chosen || (banners[0] && banners[0].path) || DEFAULT_BANNER;
  const einkLight = (typeof document!=="undefined") && document.body.classList.contains("theme-light");

  const tiles = [ tile(DEFAULT_BANNER, "Built-in", effective===DEFAULT_BANNER) ];
  for(const b of banners){ tiles.push(tile(b.path, b.basename, effective===b.path)); }

  root.innerHTML = `<div class="storm-settings-ui">
    <header class="sethead"><div class="seticon">⚙️</div><div><h1>Dashboard settings</h1><div class="setsub">Appearance for your Storm dashboard. Changes apply when the dashboard reloads.</div></div></header>

    <section class="setrow"><h2>Theme</h2>
      <div class="seg">
        <button class="segbtn${mode==="match"?" on":""}" data-mode="match">🎨 Match image</button>
        <button class="segbtn${mode==="community"?" on":""}" data-mode="community">🧩 Community theme</button>
      </div>
      <div class="modehint">${mode==="match"
        ? "Colors are built from your banner image — going light or dark to match it, contrast-corrected for readability."
        : "The dashboard inherits whatever Obsidian theme you have installed (Settings → Appearance → Themes). Its colors follow that theme."}</div>
    </section>

    <section class="setrow"><h2>Banner</h2>
      <div class="curbanner"><img src="${esc(resPath(effective))}" alt="banner preview"><span class="curcap">Current banner</span></div>
      <div class="bantiles">${tiles.join("")}</div>
      <div class="uploadrow"><button class="upbtn">⬆︎ Upload an image</button><input type="file" accept="image/*" class="upinput" hidden><span class="upmsg"></span></div>
      <div class="modehint">Pick any image in <code>Images/Banner/</code>, or upload one. In Match mode the theme re-derives from the image you choose.</div>
    </section>

    <section class="setrow"><h2>Reading mode</h2>
      <div class="seg">
        <button class="segbtn eink${!einkLight?" on":""}" data-eink="dark">🌙 Normal</button>
        <button class="segbtn eink${einkLight?" on":""}" data-eink="light">☀︎ Light (e-ink)</button>
      </div>
      <div class="modehint">A high-contrast monochrome look for e-ink screens and bright rooms. It overrides colors while active.</div>
    </section>

    <div class="setfoot"><span class="dashlink" data-open="1">← Back to dashboard</span></div>
  </div>`;
  wire();
}

function wire(){
  root.querySelectorAll(".segbtn[data-mode]").forEach(el=>el.onclick=(ev)=>{
    ev.stopPropagation();
    state.mode = el.getAttribute("data-mode");
    writeCfg(fm=>{ fm.stormMode = state.mode; delete fm.stormTheme; delete fm.stormThemeSrc; });
    render();
  });
  root.querySelectorAll(".bantile").forEach(el=>el.onclick=(ev)=>{
    ev.stopPropagation();
    const p = el.getAttribute("data-path");
    state.banner = p;
    writeCfg(fm=>{ fm.stormBanner = p; delete fm.stormTheme; delete fm.stormThemeSrc; });
    render();
  });
  const inp=root.querySelector(".upinput"), up=root.querySelector(".upbtn"), msg=root.querySelector(".upmsg");
  if(up && inp){
    up.onclick=()=>inp.click();
    inp.onchange=async ()=>{
      const file = inp.files && inp.files[0]; if(!file) return;
      if(msg) msg.textContent="Uploading…";
      try{
        const buf = await file.arrayBuffer();
        try{ await app.vault.createFolder(BANNERDIR); }catch(e){}
        let base = (file.name||"banner").replace(/[\\/:*?"<>|]/g,"_").replace(/\s+/g," ").trim();
        if(!/\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(base)) base += ".png";
        let path = BANNERDIR+"/"+base, i=1;
        while(app.vault.getAbstractFileByPath(path)){ path = BANNERDIR+"/"+base.replace(/(\.[^.]+)$/, "-"+(i++)+"$1"); }
        await app.vault.createBinary(path, buf);
        if(msg) msg.textContent="Added ✓";
        state.banner = path;
        await writeCfg(fm=>{ fm.stormBanner = path; delete fm.stormTheme; delete fm.stormThemeSrc; });
        setTimeout(render, 80);
      }catch(e){ console.error("storm upload", e); if(msg) msg.textContent="Upload failed: "+e.message; }
    };
  }
  root.querySelectorAll("[data-eink]").forEach(el=>el.onclick=(ev)=>{
    ev.stopPropagation();
    const light = el.getAttribute("data-eink")==="light";
    try{
      const b=document.body; b.classList.toggle("theme-light",light); b.classList.toggle("theme-dark",!light);
      if(g.app){ g.app.vault.setConfig("theme", light?"moonstone":"obsidian"); g.app.workspace.trigger("css-change"); }
    }catch(e){}
    render();
  });
  const dl=root.querySelector("[data-open]");
  if(dl) dl.onclick=()=>{ try{ if(dash && g.app) g.app.workspace.openLinkText(dash.basename,"",false); }catch(e){} };
}

initState();
render();
} catch(err){
  dv.container.innerHTML = '<div style="color:#e0736b;padding:16px;font-family:sans-serif">⚙️ Settings error: '+err.message+'</div>';
  console.error(err);
}
```

## 📊 Vault stats

```dataviewjs
try {
  const notes = app.vault.getMarkdownFiles().length;
  const allFiles = app.vault.getFiles().length;
  const attachments = Math.max(0, allFiles - notes);
  let folders = 0; try { folders = app.vault.getAllLoadedFiles().filter(f => f && f.children !== undefined).length - 1; } catch(e){}
  let tags = 0; try { tags = Object.keys(app.metadataCache.getTags()).length; } catch(e){}

  dv.container.innerHTML = `<div class="storm-settings-stats"><div class="stats">
    <div class="stat"><div class="n">${notes}</div><div class="l">Notes</div></div>
    <div class="stat"><div class="n">${attachments}</div><div class="l">Attachments</div></div>
    <div class="stat"><div class="n">${Math.max(0, folders)}</div><div class="l">Folders</div></div>
    <div class="stat"><div class="n">${tags}</div><div class="l">Tags</div></div>
  </div></div>`;
} catch(err){
  dv.container.innerHTML = '<div style="color:#e0736b;padding:12px;font-family:sans-serif">📊 Vault stats error: '+err.message+'</div>';
  console.error(err);
}
```
