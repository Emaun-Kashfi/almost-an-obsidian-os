/* StormHarness — browser-side mocks of Dataview (dv) + Obsidian (app) for testing dataviewjs blocks.
   Loaded into a Playwright page via addScriptTag. Exposes window.StormHarness.
   Semantics mirror the real APIs the vault code uses (see SPEC.md §10). */
(function(){
  const H = {};
  // ---------- fixed "now" ----------
  const RealDate = Date;
  H.setNow = function(isoLocal){ // e.g. "2026-09-12T10:00:00"
    const FIXED = new RealDate(isoLocal);
    const FakeDate = function(...a){ if(!(this instanceof FakeDate)) return new RealDate(FIXED.getTime()).toString(); return a.length===0 ? new RealDate(FIXED.getTime()) : new RealDate(...a); };
    FakeDate.prototype = RealDate.prototype;
    FakeDate.now = () => FIXED.getTime(); FakeDate.UTC = RealDate.UTC; FakeDate.parse = RealDate.parse;
    window.Date = FakeDate;
    H.NOW = FIXED;
  };
  const two = n => String(n).padStart(2,"0");
  const localIso = d => `${d.getFullYear()}-${two(d.getMonth()+1)}-${two(d.getDate())}`;
  H.localIso = localIso;
  // ---------- Luxon-like DateTime ----------
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const MONL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  function mkDate(iso){
    if(iso==null || iso==="") return null;
    if(typeof iso==="object" && iso.__dt) return iso;
    let d;
    if(iso instanceof RealDate || (iso && typeof iso.getTime==="function")) d = new RealDate(iso.getTime());
    else { const s=String(iso).slice(0,10); const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if(!m) return null; d = new RealDate(+m[1], +m[2]-1, +m[3], 0,0,0,0); }
    const o = {
      __dt:true, year:d.getFullYear(), month:d.getMonth()+1, day:d.getDate(), weekday:((d.getDay()+6)%7)+1,
      toISODate(){ return localIso(d); }, toMillis(){ return d.getTime(); }, valueOf(){ return d.getTime(); },
      toJSDate(){ return new RealDate(d.getTime()); },
      toFormat(f){ return f.replace(/cccc/g,DOW[d.getDay()]).replace(/MMMM/g,MONL[d.getMonth()]).replace(/MMM/g,MON[d.getMonth()]).replace(/yyyy/g,String(d.getFullYear())).replace(/MM/g,two(d.getMonth()+1)).replace(/dd/g,two(d.getDate())).replace(/\bd\b/g,String(d.getDate())); },
      plus(o2){ const n=new RealDate(d.getTime()); if(o2.days) n.setDate(n.getDate()+o2.days); if(o2.weeks) n.setDate(n.getDate()+7*o2.weeks); if(o2.months) n.setMonth(n.getMonth()+o2.months); return mkDate(n); },
      minus(o2){ const n=new RealDate(d.getTime()); if(o2.days) n.setDate(n.getDate()-o2.days); if(o2.weeks) n.setDate(n.getDate()-7*o2.weeks); return mkDate(n); },
      diff(other,unit){ const ms=d.getTime()-other.toMillis(); const days=ms/86400000; return { days, hours: ms/3600000, milliseconds: ms, [unit||"milliseconds"]: unit==="days"?days:ms }; },
      startOf(u){ const n=new RealDate(d.getTime()); if(u==="day") n.setHours(0,0,0,0); if(u==="week"){ n.setHours(0,0,0,0); n.setDate(n.getDate()-((n.getDay()+6)%7)); } if(u==="month"){ n.setHours(0,0,0,0); n.setDate(1);} return mkDate(n); },
      toString(){ return localIso(d); }
    };
    return o;
  }
  H.mkDate = mkDate;
  // ---------- DataArray shim (Proxy: unknown props map over elements & flatten) ----------
  const DA_METHODS = new Set(["where","filter","map","flatMap","sort","array","find","some","every","forEach","length","groupBy","distinct","limit","slice","first","last","reduce","concat","indexOf","includes","join","values","toArray"]);
  function DataArray(arr){
    const a = Array.from(arr||[]);
    const api = {
      where: f => DataArray(a.filter(f)), filter: f => DataArray(a.filter(f)),
      map: f => DataArray(a.map(f)), flatMap: f => DataArray(a.flatMap(f)),
      sort: (f, dir, cmp) => { const c=[...a]; if(typeof f==="function" && f.length>=2){ c.sort(f); return DataArray(c);} const key=f||(x=>x); const d=(dir||"asc")==="desc"?-1:1; c.sort((x,y)=>{ const kx=key(x), ky=key(y); if(cmp) return d*cmp(kx,ky); const vx=(kx&&kx.__dt)?kx.toMillis():kx, vy=(ky&&ky.__dt)?ky.toMillis():ky; return d*(vx<vy?-1:vx>vy?1:0); }); return DataArray(c); },
      array: () => [...a], toArray: () => [...a], values: [...a],
      find: f => a.find(f), some: f => a.some(f), every: f => a.every(f), forEach: f => a.forEach(f),
      groupBy: f => { const g={}; a.forEach(x=>{ const k=f(x); (g[k]=g[k]||[]).push(x); }); return DataArray(Object.keys(g).map(k=>({key:k, rows:DataArray(g[k])}))); },
      distinct: f => { const s=new Set(); const out=[]; a.forEach(x=>{ const k=f?f(x):x; if(!s.has(k)){ s.add(k); out.push(x);} }); return DataArray(out); },
      limit: n => DataArray(a.slice(0,n)), slice: (s,e) => DataArray(a.slice(s,e)), first: () => a[0], last: () => a[a.length-1],
      reduce: (f,i) => a.reduce(f,i), concat: o => DataArray(a.concat(o.array?o.array():o)), indexOf: x => a.indexOf(x), includes: x => a.includes(x), join: s => a.join(s),
      get length(){ return a.length; }
    };
    return new Proxy(a, {
      get(t, p){
        if(p===Symbol.iterator) return a[Symbol.iterator].bind(a);
        if(p==="__isDA") return true;
        if(typeof p==="string" && /^\d+$/.test(p)) return a[p];
        if(DA_METHODS.has(p)) return api[p];
        if(p in api) return api[p];
        if(p in Array.prototype && typeof a[p]==="function") return a[p].bind(a);
        // property projection
        const vals = a.map(x => (x==null?undefined:x[p]));
        const flat = []; vals.forEach(v => { if(v && (Array.isArray(v) || v.__isDA)) flat.push(...Array.from(v)); else flat.push(v); });
        return DataArray(flat);
      }
    });
  }
  H.DataArray = DataArray;
  // ---------- markdown parsing: frontmatter / headings / tasks ----------
  function parseFrontmatter(text){
    text = String(text==null?"":text).replace(/\r\n/g, "\n");   // parse layer is LF-only; the store keeps the file's real line endings
    const fm = {}; let body = text; let end = -1;
    if(text.startsWith("---\n")){ end = text.indexOf("\n---", 4); if(end>=0){ const block = text.slice(4,end); body = text.slice(end+4).replace(/^\r?\n/,""); let curKey=null;
      block.split("\n").forEach(l=>{ const m=l.match(/^([A-Za-z_][\w-]*):\s*(.*)$/); if(m){ curKey=m[1]; let v=m[2].trim(); if(v===""){ fm[curKey]=null; return; } fm[curKey]=parseScalar(v); } else { const a=l.match(/^\s+-\s*(.*)$/); if(a && curKey){ if(!Array.isArray(fm[curKey])) fm[curKey]=[]; fm[curKey].push(parseScalar(a[1].trim())); } } }); } }
    return { fm, body, fmEnd: end };
  }
  function parseScalar(v){ if(/^".*"$/.test(v)||/^'.*'$/.test(v)) v=v.slice(1,-1); if(v==="true") return true; if(v==="false") return false; if(/^-?\d+(\.\d+)?$/.test(v)) return Number(v); if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return mkDate(v); return v; }
  H.parseFrontmatter = parseFrontmatter;
  function serializeFrontmatter(fm){ const lines=["---"]; for(const k of Object.keys(fm)){ const v=fm[k]; if(Array.isArray(v)){ lines.push(k+":"); v.forEach(x=>lines.push("  - "+fmtScalar(x))); } else if(v==null||v===""){ lines.push(k+":"); } else lines.push(k+": "+fmtScalar(v)); } lines.push("---"); return lines.join("\n")+"\n"; }
  function fmtScalar(v){ if(v&&v.__dt) return v.toISODate(); if(typeof v==="string" && (/^\[\[/.test(v)||/[:#]/.test(v))) return JSON.stringify(v); return String(v); }
  H.serializeFrontmatter = serializeFrontmatter;
  function parseHeadings(text){ const out=[]; text.split("\n").forEach((l,i)=>{ const m=l.match(/^(#{1,6})\s+(.*)$/); if(m) out.push({level:m[1].length, heading:m[2].trim(), position:{start:{line:i},end:{line:i}}}); }); return out; }
  function parseTasks(text, path){
    text = String(text==null?"":text).replace(/\r\n/g, "\n");
    const lines = text.split("\n"); const heads = parseHeadings(text); const tasks=[]; const listItems=[];
    lines.forEach((l,i)=>{ const m=l.match(/^(\s*)[-*]\s*\[(.)\]\s?(.*)$/); if(!m) return;
      const raw=m[3]; const status=m[2]; const completed = status!==" ";
      const dateOf = em => { const r=new RegExp(em+"\\s*(\\d{4}-\\d{2}-\\d{2})"); const mm=raw.match(r); return mm?mkDate(mm[1]):null; };
      const sec = [...heads].reverse().find(h=>h.position.start.line<i);
      const tags = (raw.match(/#[\p{L}\p{N}_\/-]+/gu)||[]);
      const t = { text: raw, completed, checked: completed, status, line: i, path, link: {path, subpath: undefined}, tags, section: sec?{subpath: sec.heading, path}:null, header: sec?{subpath: sec.heading}:null,
        due: dateOf("📅"), scheduled: dateOf("⏳"), start: dateOf("🛫"), completion: dateOf("✅"), created: dateOf("➕"), children: [], real:true, task:true, indent: m[1].length };
      tasks.push(t); listItems.push({position:{start:{line:i},end:{line:i}}, task: status, parent: -1});
    });
    return { tasks, listItems, headings: heads };
  }
  H.parseTasks = parseTasks;
  // ---------- in-memory vault ----------
  H.mkVault = function(files, opts){ // files: {path: content}
    opts = opts||{};
    const store = new Map(Object.entries(files||{}));
    const folders = new Set();
    const rescanFolders = () => { folders.clear(); for(const p of store.keys()){ const parts=p.split("/"); for(let i=1;i<parts.length;i++) folders.add(parts.slice(0,i).join("/")); } };
    rescanFolders();
    const log = []; H.log = log;
    const tfile = p => { if(!store.has(p)) return null; const name=p.split("/").pop(); const base=name.replace(/\.[^.]+$/,""); const ext=name.includes(".")?name.split(".").pop():""; const parentPath=p.includes("/")?p.slice(0,p.lastIndexOf("/")):"/"; return { path:p, name, basename:base, extension:ext, parent:{path:parentPath}, stat:{mtime: 1700000000000 + p.length, ctime: 1700000000000}, children: undefined }; };
    const tfolder = p => ({ path:p, name:p.split("/").pop(), children: [] });
    const app = {
      vault: {
        getAbstractFileByPath: p => { p=String(p).replace(/^\/+/,""); if(store.has(p)) return tfile(p); if(folders.has(p)) return tfolder(p); return null; },
        read: async f => { const p=typeof f==="string"?f:f.path; if(!store.has(p)) throw new Error("ENOENT "+p); return store.get(p); },
        cachedRead: async f => store.get(typeof f==="string"?f:f.path),
        modify: async (f, c) => { const p=typeof f==="string"?f:f.path; store.set(p, c); log.push({op:"modify", path:p}); },
        create: async (p, c) => { if(store.has(p)) throw new Error("File already exists: "+p); store.set(p, c); rescanFolders(); log.push({op:"create", path:p}); return tfile(p); },
        createFolder: async p => { folders.add(p); log.push({op:"mkdir", path:p}); },
        createBinary: async (p, b) => { store.set(p, "<binary>"); log.push({op:"createBinary", path:p}); return tfile(p); },
        delete: async f => { store.delete(f.path); log.push({op:"delete", path:f.path}); },
        trash: async f => { store.delete(f.path); log.push({op:"trash", path:f.path}); },
        rename: async (f, np) => { const c=store.get(f.path); store.delete(f.path); store.set(np,c); rescanFolders(); log.push({op:"rename", from:f.path, to:np}); },
        getMarkdownFiles: () => [...store.keys()].filter(p=>p.endsWith(".md")).map(tfile),
        getFiles: () => [...store.keys()].map(tfile),
        getAllLoadedFiles: () => [...[...folders].map(p=>({path:p, children:[]})), ...[...store.keys()].map(tfile)],
        adapter: { getResourcePath: p => "app://local/"+p, exists: async p => store.has(p)||folders.has(p),
          // vault-relative read, like Obsidian's DataAdapter.read — throws when absent
          read: async p => { p=String(p).replace(/^\/+/,""); if(!store.has(p)) throw new Error("ENOENT "+p); return store.get(p); },
          write: async (p, c) => { p=String(p).replace(/^\/+/,""); store.set(p, c); rescanFolders(); log.push({op:"adapterWrite", path:p}); }, mkdir: async p => { folders.add(String(p).replace(/^\/+/,"")); log.push({op:"adapterMkdir", path:p}); } },
        getResourcePath: f => "app://local/"+f.path,
        setConfig: (k,v)=>{ log.push({op:"setConfig", k, v}); }, getConfig: k=>null,
        configDir: ".obsidian"
      },
      metadataCache: {
        getFileCache: f => { const p=typeof f==="string"?f:(f&&f.path); const c=store.get(p); if(c==null) return null; const {fm}=parseFrontmatter(c); const {listItems, headings}=parseTasks(c,p); return { frontmatter: fm, headings, listItems, tags: [] }; },
        getFirstLinkpathDest: (link, src) => { link=String(link).replace(/^\[\[|\]\]$/g,"").replace(/\|.*$/,"").replace(/#.*$/,""); if(store.has(link)) return tfile(link); const cand=[...store.keys()].find(p => p===link+".md" || p.endsWith("/"+link+".md") || p.endsWith("/"+link) ); return cand?tfile(cand):null; },
        trigger: (...a) => { log.push({op:"trigger", args:a}); },
        resolvedLinks: opts.resolvedLinks || {},
        getTags: () => opts.tags || {},
        on: () => ({}), offref: () => {}
      },
      workspace: { openLinkText: (l, s, n) => { log.push({op:"open", link:l}); }, getActiveViewOfType: () => null, trigger: () => {}, on: () => ({}), getLeaf: () => ({ openFile: async f => log.push({op:"openFile", path:f.path}) }) },
      fileManager: { processFrontMatter: async (f, fn) => { const c=store.get(f.path); if(c==null) throw new Error("ENOENT"); const {fm, body, fmEnd}=parseFrontmatter(c); const before=JSON.stringify(fm); fn(fm); const nc = serializeFrontmatter(fm) + (fmEnd>=0 ? body : c); store.set(f.path, nc); log.push({op:"processFrontMatter", path:f.path, before, after: JSON.stringify(fm)}); }, trashFile: async f => { store.delete(f.path); log.push({op:"trash", path:f.path}); } },
      commands: { commands: { "daily-notes": {id:"daily-notes"} }, executeCommandById: id => { log.push({op:"command", id}); if(id==="daily-notes" && opts.createDaily) opts.createDaily(store, rescanFolders); return true; } },
      plugins: { plugins: opts.plugins || {}, enabledPlugins: new Set(Object.keys(opts.plugins||{})) },
      internalPlugins: { plugins: {} },
      // Obsidian's internal snippet registry (app.customCss) — CONTRACT §B. Only
      // the four members initHub touches, and `setCssEnabledStatus` is as strict
      // as the real one: a snippet Obsidian has not read off disk cannot be
      // enabled, so a test proves we call readSnippets() after creating the file.
      // `opts.customCss === false` removes the API entirely, which is the "older
      // build / internal API gone" path that must degrade to a Notice.
      customCss: opts.customCss === false ? undefined : {
        snippets: [],
        enabledSnippets: new Set(opts.enabledSnippets||[]),
        readSnippets(){ this.snippets = [...store.keys()].filter(p=>/snippets\/[^/]+\.css$/.test(p)).map(p=>p.split("/").pop().replace(/\.css$/,"")); log.push({op:"readSnippets"}); },
        setCssEnabledStatus(n, on){ if(on){ if(this.snippets.indexOf(n)<0) return; this.enabledSnippets.add(n); } else this.enabledSnippets.delete(n); log.push({op:"setCssEnabledStatus", name:n, enabled:!!on}); },
        requestLoadSnippets(){ log.push({op:"requestLoadSnippets"}); },
      },
    };
    app.__store = store; app.__log = log;
    return app;
  };
  // ---------- dv ----------
  H.mkDv = function(app, currentPath){
    const store = app.__store;
    const pageOf = p => { const c=store.get(p); if(c==null) return null; const {fm}=parseFrontmatter(c); const {tasks}=parseTasks(c,p); const name=p.split("/").pop().replace(/\.md$/,""); const folder=p.includes("/")?p.slice(0,p.lastIndexOf("/")):"";
      const tagsFm = Array.isArray(fm.tags)?fm.tags:(fm.tags?[fm.tags]:[]); const etags = tagsFm.map(t=>"#"+String(t).replace(/^#/,""));
      const bodyTags = (c.replace(/^---[\s\S]*?\n---\n/,"").match(/(^|\s)#[\p{L}\p{N}_\/-]+/gu)||[]).map(s=>s.trim());
      const allTags = [...new Set([...etags, ...bodyTags])];
      const page = Object.assign({}, fm, { file: { name, path:p, folder, link:{path:p, display:name}, tasks: DataArray(tasks), etags: DataArray(allTags), tags: DataArray(allTags.flatMap(t=>{ const parts=t.split("/"); return parts.map((_,i)=>parts.slice(0,i+1).join("/")); })), mtime: mkDate("2026-09-01"), ctime: mkDate("2026-09-01"), day: (name.match(/^\d{4}-\d{2}-\d{2}/)?mkDate(name.slice(0,10)):null) } });
      // goal links: turn "[[X]]" strings into Link objects when the file exists
      for(const k of Object.keys(page)){ const v=page[k]; if(typeof v==="string" && /^\[\[.*\]\]$/.test(v)){ const nm=v.replace(/^\[\[|\]\]$/g,"").replace(/\|.*$/,""); const dest=app.metadataCache.getFirstLinkpathDest(nm,p); page[k] = { path: dest?dest.path:(nm+".md"), display: nm, type:"file", toString(){ return "[["+nm+"]]"; } }; } }
      return page; };
    const allPages = () => [...store.keys()].filter(p=>p.endsWith(".md")).map(pageOf).filter(Boolean);
    const dv = {
      current: () => pageOf(currentPath),
      pages: q => { let ps = allPages(); if(q){ const src=String(q).trim(); const m=src.match(/^"(.+)"$/); if(m){ const folder=m[1].replace(/\/$/,""); ps=ps.filter(p=>p.file.path===folder+".md"||p.file.path.startsWith(folder+"/")); } else if(/^#/.test(src)){ const tag=src; ps=ps.filter(p=>Array.from(p.file.tags).includes(tag)||Array.from(p.file.etags).some(t=>t===tag||t.startsWith(tag+"/"))); } } return DataArray(ps); },
      page: name => { const f=app.metadataCache.getFirstLinkpathDest(String(name).replace(/\.md$/,""), ""); return f?pageOf(f.path):undefined; },
      date: x => (x&&x.__dt)?x:mkDate(x), duration: () => ({}),
      io: { load: async p => { const f=app.metadataCache.getFirstLinkpathDest(String(p).replace(/\.md$/,""),""); const key=f?f.path:p; return store.get(key)!=null?store.get(key):null; }, csv: async()=>[] },
      fileLink: (p, embed, display) => { const nm=String(p).split("/").pop().replace(/\.md$/,""); return { path:p, display: display||nm, toString(){ return "[["+nm+(display?"|"+display:"")+"]]"; } }; },
      sectionLink: (p, s) => ({path:p, subpath:s}),
      array: a => DataArray(a), isArray: a => Array.isArray(a)||!!(a&&a.__isDA),
      container: null,
      el: (tag, text, attrs) => { const e=document.createElement(tag); e.textContent=text==null?"":String(text); if(attrs&&attrs.cls) e.className=attrs.cls; dv.container.appendChild(e); return e; },
      paragraph: t => { const e=document.createElement("p"); e.innerHTML = H.mdInline(String(t)); dv.container.appendChild(e); return e; },
      header: (n,t) => { const e=document.createElement("h"+n); e.textContent=String(t); dv.container.appendChild(e); return e; },
      span: t => dv.el("span", t), list: arr => { const ul=document.createElement("ul"); Array.from(arr).forEach(x=>{ const li=document.createElement("li"); li.innerHTML=H.mdInline(String(x)); ul.appendChild(li); }); dv.container.appendChild(ul); return ul; },
      table: (headers, rows) => { const t=document.createElement("table"); t.className="dataview table-view-table"; const th=document.createElement("thead"); const tr=document.createElement("tr"); headers.forEach(h=>{ const c=document.createElement("th"); c.textContent=String(h); tr.appendChild(c); }); th.appendChild(tr); t.appendChild(th); const tb=document.createElement("tbody"); Array.from(rows).forEach(r=>{ const rr=document.createElement("tr"); Array.from(r).forEach(v=>{ const c=document.createElement("td"); c.innerHTML = (v&&v.path&&v.display)?`<a class="internal-link" data-href="${v.path}">${v.display}</a>`:H.mdInline(v==null?"":String(v)); rr.appendChild(c); }); tb.appendChild(rr); }); t.appendChild(tb); dv.container.appendChild(t); return t; },
      taskList: () => {}, markdownTable: () => "",
      /* dv.view(name, input) — the REAL thing, not a no-op stub.
         Dataview (src/api/inline-api.ts) resolves `<name>.js` first and
         `<name>/view.js` second through metadataCache.getFirstLinkpathDest, reads
         the file, and evaluates it as `new Function("dv","input", src)` called
         with NO receiver — so inside a view `this` is the global object, NOT the
         block component. We reproduce that: nothing is bound to `this`, so a
         panel that still says `this.container` fails here exactly as it would in
         Obsidian. Neither file found → a visible error element, never a silent
         return (the old `async () => {}` stub let every test pass while the note
         rendered nothing).
         Two deliberate differences from Dataview, both strictly stricter:
           · the view source is AWAITED (Dataview fires the async IIFE and forgets),
             so a test can assert on the finished DOM;
           · an error thrown by the view body is re-thrown after the error element
             is rendered, instead of only being rendered — errors propagate. */
      view: async (viewName, input) => {
        const container = dv.container || document.body;
        const simple = String(viewName) + ".js", complex = String(viewName) + "/view.js";
        const err = msg => { const pre = document.createElement("pre"); pre.className = "dataview dataview-error"; pre.textContent = msg; container.appendChild(pre); return pre; };
        const file = app.metadataCache.getFirstLinkpathDest(simple, currentPath)
                  || app.metadataCache.getFirstLinkpathDest(complex, currentPath);
        if(!file){ err("Dataview: custom view not found for '" + simple + "' or '" + complex + "'."); return; }
        const src = await app.vault.read(file);
        const fn = new Function("dv", "input", "app", "return (async()=>{" + src + "\n})()");
        try {
          const result = await fn(dv, input, app);          // no receiver: `this` is global, as in Dataview
          if(result != null) container.appendChild(document.createTextNode(String(result)));
        } catch(ex){
          err("Dataview: Failed to execute view '" + file.path + "'.\n\n" + ex);
          throw ex;
        }
      }
    };
    return dv;
  };
  H.mdInline = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/_(.+?)_/g,"<i>$1</i>").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(m,a,b)=>`<a class="internal-link" data-href="${a}">${b||a}</a>`).replace(/`([^`]+)`/g,"<code>$1</code>");
  // ---------- running a block ----------
  H.extractBlocks = function(md){ const out=[]; const re=/```dataviewjs\n([\s\S]*?)\n```/g; let m; while((m=re.exec(md))) out.push(m[1]); return out; };
  H.runBlock = async function(src, dv, app, container){
    /* A caller may hand us an element that already sits in an Obsidian-shaped DOM
       (div.block-language-dataviewjs inside a markdown-preview-sizer). Appending it to
       <body> unconditionally would rip it out of that tree — and silently change the
       layout under test. Only adopt a container we created, or one nobody has placed. */
    container = container || document.createElement("div");
    if(!container.isConnected) document.body.appendChild(container);
    dv.container = container;
    const fn = new Function("dv","app","return (async()=>{"+src+"\n})()");
    await fn.call({container}, dv, app);
    return container;
  };
  window.StormHarness = H;
})();
