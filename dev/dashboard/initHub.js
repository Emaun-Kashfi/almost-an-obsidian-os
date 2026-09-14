/* ============================================================
   parseAdd(raw, ctx) — grammar for the universal Add box (SPEC §3.4).
   Self-contained on purpose: the test-suite extracts it by name and evals it.
   → {kind, name, text, goal, area, task, iso, start, end, tags, raw}
   ============================================================ */
function parseAdd(raw, ctx){
  ctx = ctx || {};
  const p2 = n => String(n).padStart(2,"0");
  const isoOf = dt => dt.getFullYear()+"-"+p2(dt.getMonth()+1)+"-"+p2(dt.getDate());
  const todayIso = /^\d{4}-\d{2}-\d{2}$/.test(ctx.todayIso||"") ? ctx.todayIso : isoOf(new Date());
  const base = new Date(+todayIso.slice(0,4), +todayIso.slice(5,7)-1, +todayIso.slice(8,10));
  const DOW = {sun:0,sunday:0,mon:1,monday:1,tue:2,tues:2,tuesday:2,wed:3,weds:3,wednesday:3,thu:4,thur:4,thurs:4,thursday:4,fri:5,friday:5,sat:6,saturday:6};
  const addDays = n => { const d = new Date(base.getTime()); d.setDate(d.getDate()+n); return isoOf(d); };

  // one token → ISO date, or "" when it isn't a date
  function tokenIso(tok){
    let t = String(tok==null?"":tok).trim().toLowerCase().replace(/^[([]+/,"").replace(/[)\],.;]+$/,"");
    if(!t) return "";
    if(t==="today"||t==="tod") return todayIso;
    if(t==="tomorrow"||t==="tmrw"||t==="tmr"||t==="tom") return addDays(1);
    let m = t.match(/^\+(\d+)\s*d$/); if(m) return addDays(+m[1]);
    if(/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
    if(m){ const mo=+m[1], da=+m[2]; if(mo<1||mo>12||da<1||da>31) return "";
      const y = m[3] ? (m[3].length===2 ? 2000+ +m[3] : +m[3]) : base.getFullYear();
      return y+"-"+p2(mo)+"-"+p2(da); }
    if(DOW[t]!=null) return addDays((DOW[t]-base.getDay()+7)%7);
    return "";
  }
  // one token → [startIso, endIso] for `<date>-<date>`, else null
  function rangeOf(tok){
    const t = String(tok==null?"":tok).trim();
    let m = t.match(/^(\d{4}-\d{2}-\d{2})\s*[-–—]\s*(\d{4}-\d{2}-\d{2})$/); if(m) return [m[1], m[2]];
    m = t.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*[-–—]\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)$/);
    if(m){ const a=tokenIso(m[1]), b=tokenIso(m[2]); if(a&&b) return [a,b]; }
    m = t.match(/^([A-Za-z+0-9]+)[-–—]([A-Za-z+0-9]+)$/);
    if(m){ const a=tokenIso(m[1]), b=tokenIso(m[2]); if(a&&b) return [a,b]; }
    return null;
  }
  // strip a trailing date (or range) token off `s`
  function pullDate(s, wantRange){
    const txt = String(s==null?"":s).trim();
    const m = txt.match(/(^|\s)(\S+)$/);
    const empty = { text: txt, iso:"", start:"", end:"" };
    if(!m) return empty;
    const tok = m[2], head = txt.slice(0, txt.length - tok.length).trim();
    if(!head) return empty;                       // the token IS the whole text → it's the text
    if(wantRange){ const r = rangeOf(tok); if(r) return { text: head, iso:"", start:r[0], end:r[1] }; }
    const iso = tokenIso(tok);
    return iso ? { text: head, iso, start:"", end:"" } : empty;
  }
  // same as pullDate, but a trailing "#tag" must not hide the date in front of it
  // (SPEC §3.4 writes the inbox line as `<text> [📅 iso] [#tags kept]`, so the tags
  //  are peeled off the end, the date is read, and the caller re-appends the tags).
  function pullDateTags(s, wantRange){
    const txt = String(s==null?"":s).trim();
    const direct = pullDate(txt, wantRange);
    if(direct.iso || direct.start) return direct;
    let head = txt, tail = 0, m;
    while((m = head.match(/(?:^|\s)(#[\p{L}\p{N}_/-]+)$/u))){
      tail++; head = head.slice(0, head.length - m[1].length).trim();
      if(!head) break;
    }
    if(!tail || !head) return direct;
    const d = pullDate(head, wantRange);
    return (d.iso || d.start) ? d : direct;
  }
  // split a trailing "@something" off `s`
  function pullAt(s){
    const txt = String(s==null?"":s).trim();
    const m = txt.match(/(^|\s)@\s*([^@]+)$/);
    if(!m) return { text: txt, at:"" };
    return { text: txt.slice(0, m.index).trim(), at: m[2].trim() };
  }
  const tagsOf = s => (String(s||"").match(/#[\p{L}\p{N}_/-]+/gu) || []);

  const src = String(raw==null?"":raw).trim();
  const pm = src.match(/^(task|sub|subtask|goal|habit|note|job)\s*:\s*([\s\S]*)$/i);
  let kind = pm ? pm[1].toLowerCase() : "inbox";
  if(kind === "subtask") kind = "sub";
  const rest = (pm ? pm[2] : src).trim();
  const out = { kind, name:"", text:rest, goal:"", area:"", task:"", iso:"", start:"", end:"", tags: tagsOf(rest), raw: src };

  if(kind === "task" || kind === "goal"){
    const a = pullAt(rest);
    let body = a.text, at = a.at, start="", end="", iso="";
    if(at){ const ad = pullDate(at, true); if(ad.start || ad.iso){ at = ad.text; start = ad.start; end = ad.end; iso = ad.iso; } }
    if(!start && !iso){ const bd = pullDate(body, true); body = bd.text; start = bd.start; end = bd.end; iso = bd.iso; }
    out.name = body.trim(); out.text = out.name; out.start = start; out.end = end; out.iso = iso;
    if(kind === "task") out.goal = at; else { out.area = at; if(iso && !end) out.end = iso; }
    out.tags = tagsOf(out.name);
    return out;
  }
  if(kind === "sub"){
    const parts = rest.split(/\s*(?:->|→|—>)\s*/);
    let body = rest;
    if(parts.length >= 2){ out.task = parts[parts.length-1].trim(); body = parts.slice(0,-1).join(" -> ").trim(); }
    const bd = pullDateTags(body, false);
    out.text = bd.text; out.iso = bd.iso; out.name = bd.text; out.tags = tagsOf(body);
    return out;
  }
  if(kind === "habit" || kind === "note" || kind === "job"){
    out.text = rest; out.name = rest; out.tags = tagsOf(rest);
    return out;
  }
  const bd = pullDateTags(rest, false);
  out.kind = "inbox"; out.text = bd.text; out.iso = bd.iso; out.name = bd.text; out.tags = tagsOf(rest);
  return out;
}

/* ============================================================
   BEHAVIOUR — initHub(rootEl[, app]).  Everything the hub can do.
   ============================================================ */
function initHub(root, appRef){
  if(!root) return;
  const g = (typeof window!=="undefined")?window:globalThis;
  const A = appRef || g.app;                       // Obsidian app (tests pass it explicitly)
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  // ---- Tasks-plugin line surgery -------------------------------------------------
  // Emoji fields go at the END of the line, EXCEPT that a trailing block id (` ^abc-1`)
  // must stay terminal or Obsidian stops resolving the block reference. `stampAtEnd`
  // therefore inserts BEFORE the id; `stripDone` removes a ✅ date wherever it sits.
  const BLOCKID = /(\s+\^[A-Za-z0-9-]+)\s*$/;
  function stampAtEnd(ln, suffix){
    const m = String(ln).match(BLOCKID);
    return m ? String(ln).slice(0, m.index).replace(/\s*$/,"") + suffix + m[1]
             : String(ln).replace(/\s*$/,"") + suffix;
  }
  const isoToday = () => { const dt=new Date(); return dt.getFullYear()+"-"+_two(dt.getMonth()+1)+"-"+_two(dt.getDate()); };
  const stampDone = ln => /✅/.test(ln) ? ln : stampAtEnd(ln, " ✅ " + isoToday());
  const stripDone = ln => String(ln).replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, "").replace(/\s+$/,"");

  // ---- clock (single global interval) ----
  function tick(){
    const dt=new Date();
    root.querySelectorAll(".js-clock").forEach(e=>e.textContent=_two(dt.getHours())+":"+_two(dt.getMinutes()));
    root.querySelectorAll(".js-secs").forEach(e=>e.textContent=_two(dt.getSeconds()));
    root.querySelectorAll(".js-date").forEach(e=>e.textContent=dt.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}));
    const hh=dt.getHours();
    const gr=hh<5?"Still up":hh<12?"Good morning":hh<17?"Good afternoon":hh<22?"Good evening":"Winding down";
    root.querySelectorAll(".js-greet").forEach(e=>e.textContent=gr);
  }
  if(g.__stormClock) clearInterval(g.__stormClock);
  tick(); g.__stormClock=setInterval(tick,1000);

  // ---- pomodoro: bind to the Pomodoro Timer plugin's live store ----
  (function(){
    const els=[...root.querySelectorAll(".pomo")].map(p=>({p,ring:p.querySelector(".ring-fg"),timeEl:p.querySelector(".pomo-live"),modeEl:p.querySelector(".ph"),doneEl:p.querySelector('[data-action="pomo-done"]'),C:2*Math.PI*52}));
    if(!els.length) return;
    let lastState=null;
    els.forEach(e=>{ if(e.ring) e.ring.style.strokeDasharray=e.C; });
    function getTimer(){ try{ const pl=(A&&A.plugins&&A.plugins.plugins)?A.plugins.plugins["pomodoro-timer"]:null; return (pl&&pl.timer)?pl.timer:null; }catch(e){ return null; } }
    function paint(st){
      els.forEach(e=>{
        if(!st){ if(e.timeEl) e.timeEl.textContent="--:--"; if(e.ring) e.ring.style.strokeDashoffset=0; if(e.modeEl) e.modeEl.textContent="READY"; if(e.doneEl) e.doneEl.textContent="✓ Done"; return; }
        const count=st.count||1;
        const remMs=(st.remained&&typeof st.remained.millis==="number")?st.remained.millis:Math.max(0,count-(st.elapsed||0));
        const remS=Math.max(0,Math.round(remMs/1000));
        if(e.timeEl) e.timeEl.textContent=_two(Math.floor(remS/60))+":"+_two(remS%60);
        if(e.ring) e.ring.style.strokeDashoffset=e.C*(1-Math.max(0,Math.min(1,remMs/count)));
        const isBreak=(st.mode==="BREAK");
        if(e.modeEl) e.modeEl.textContent=isBreak?"BREAK":(st.running?"FOCUS":(remMs<count?"PAUSED":"READY"));
        if(e.doneEl) e.doneEl.textContent=isBreak?"⏭ Skip break":"✓ Done";
        e.p.classList.toggle("brk",isBreak);
      });
    }
    function bind(){
      const timer=getTimer();
      try{ if(g.__stormPomoUnsub){ g.__stormPomoUnsub(); g.__stormPomoUnsub=null; } }catch(e){}
      if(timer && typeof timer.subscribe==="function"){ g.__stormPomoUnsub=timer.subscribe(st=>{ lastState=st; paint(st); }); return true; }
      paint(null); return false;
    }
    if(!bind()){
      let n=0; if(g.__stormPomoRetry) clearInterval(g.__stormPomoRetry);
      g.__stormPomoRetry=setInterval(()=>{ if(bind()||++n>8){ clearInterval(g.__stormPomoRetry); g.__stormPomoRetry=null; } },1000);
    }
    root.querySelectorAll('[data-action="pomo-start"]').forEach(btn=>{
      btn.style.cursor="pointer";
      btn.addEventListener("click",()=>{
        const t=getTimer();
        if(t&&typeof t.toggleTimer==="function"){ t.toggleTimer(); return; }
        try{ if(A&&A.commands){ A.commands.executeCommandById("pomodoro-timer:toggle-timer"); return; } }catch(e){}
        try{ if(typeof require!=="undefined"){ const ob=require("obsidian"); new ob.Notice("Enable the Pomodoro Timer plugin to use the timer.",6000); } }catch(e){}
      });
    });
    root.querySelectorAll('[data-action="pomo-reset"]').forEach(btn=>{
      btn.style.cursor="pointer";
      btn.addEventListener("click",()=>{
        const t=getTimer();
        if(t&&typeof t.reset==="function"){ t.reset(); return; }
        try{ if(A&&A.commands) A.commands.executeCommandById("pomodoro-timer:reset-timer"); }catch(e){}
      });
    });
    // ---- Done (finish focus early + check off the task)  /  Skip break ----
    function pomoNotice(msg){ try{ if(typeof require!=="undefined"){ const ob=require("obsidian"); new ob.Notice(msg,4000); } }catch(e){} }
    async function markFocusDone(path, line, text){
      try{
        if(!A||!A.vault||!path) return;
        const f=A.vault.getAbstractFileByPath(path); if(!f) return;
        const lines=(await A.vault.read(f)).split("\n");
        const isBox=l=>/^\s*[-*]\s*\[[ xX]\]/.test(l||"");
        const norm=s=>String(s||"").replace(/\s+/g," ").trim().toLowerCase();
        let target=line;
        if(!isBox(lines[target]) || (text && norm(lines[target]).indexOf(norm(text))<0)){
          target = lines.findIndex(l=>isBox(l) && text && norm(l).indexOf(norm(text))>=0);
        }
        if(target<0||!isBox(lines[target])) return;
        let ln=lines[target];
        if(/\[[xX]\]/.test(ln)) return; // already done
        ln=stampDone(ln.replace(/\[\s\]/,"[x]"));
        lines[target]=ln;
        await A.vault.modify(f, lines.join("\n"));
      }catch(e){ console.error("markFocusDone", e); }
    }
    root.querySelectorAll('[data-action="pomo-done"]').forEach(btn=>{
      btn.style.cursor="pointer";
      btn.addEventListener("click", async ()=>{
        const t=getTimer();
        if(!t){ pomoNotice("Enable the Pomodoro Timer plugin to use the timer."); return; }
        const st=lastState||{};
        if(st.mode==="BREAK"){
          if(typeof t.toggleMode==="function"){ try{ t.toggleMode(); }catch(e){ console.error(e); } }
          else if(typeof t.reset==="function"){ t.reset(); }
          return;
        }
        const active = st.inSession || (st.elapsed>0) || st.running;
        if(!active){ pomoNotice("Start a focus session first, then hit Done to finish it early."); return; }
        if(typeof t.timeup!=="function"){ pomoNotice("This Pomodoro Timer version doesn't support finishing early."); return; }
        const pomoEl=btn.closest(".pomo");
        const fp=pomoEl?pomoEl.getAttribute("data-focus-path"):null;
        const fl=pomoEl?parseInt(pomoEl.getAttribute("data-focus-line"),10):NaN;
        const ft=pomoEl?(pomoEl.getAttribute("data-focus-text")||""):"";
        if(fp && !isNaN(fl)){ await markFocusDone(fp, fl, ft); }
        try{ const tp=root.getAttribute("data-today-path"); if(tp && A.fileManager && A.fileManager.processFrontMatter){ const tf=A.vault.getAbstractFileByPath(tp); if(tf) await A.fileManager.processFrontMatter(tf, fm=>{ delete fm.focus; }); } }catch(e){}
        try{ t.timeup(); }catch(e){ console.error("pomo done", e); pomoNotice("Couldn't finish the session: "+e.message); return; }
        setTimeout(()=>{ try{ if(A&&A.metadataCache) A.metadataCache.trigger("dataview:refresh-views"); }catch(e){} }, 1600);
      });
    });
  })();

  // ---- internal navigation (Obsidian only) ----
  root.querySelectorAll("[data-link]").forEach(el=>{
    el.style.cursor="pointer";
    el.addEventListener("click",ev=>{
      ev.preventDefault();
      const link=el.getAttribute("data-link");
      if(A&&A.workspace&&link) A.workspace.openLinkText(link,"",false);
    });
  });

  // ---- e-ink / light-dark toggle ----
  root.querySelectorAll('[data-action="toggle-theme"]').forEach(el=>{
    el.style.cursor="pointer";
    el.addEventListener("click",()=>{
      const b=(typeof document!=="undefined")?document.body:null; if(!b) return;
      const dark=b.classList.contains("theme-dark");
      b.classList.toggle("theme-dark",!dark);
      b.classList.toggle("theme-light",dark);
      try{ if(A){ A.vault.setConfig("theme", dark?"moonstone":"obsidian"); A.workspace.trigger("css-change"); } }catch(e){}
    });
  });

  /* ══ CONTRACT §B — persist the palette as a real vault snippet ═══════════
     The <style class="storm-theme-css"> above repaints this note instantly but
     dies at its edge; .obsidian/snippets/storm-theme.css is what makes every
     other Storm surface follow the theme, and survive a restart.
     `.obsidian/` is the USER's config dir: touch exactly ONE file, never
     read-modify-write anything else there (appearance.json included — Obsidian's
     own customCss.setCssEnabledStatus owns that), and skip the write when the
     content has not changed so a re-render never thrashes the file.        */
  const THEME_SNIPPET = "storm-theme";
  const THEME_DIR  = ((A && A.vault && A.vault.configDir) || ".obsidian") + "/snippets";
  const THEME_PATH = THEME_DIR + "/" + THEME_SNIPPET + ".css";
  function enableThemeSnippet(){
    // app.customCss is Obsidian INTERNAL API (obsidian-typings 1.13:
    // enabledSnippets:Set, setCssEnabledStatus(name,on), requestLoadSnippets(),
    // readSnippets(reload?)). Every call is guarded: if any of it is missing on
    // the installed build we fall back to telling the user where the switch is.
    try{
      const cc = A && A.customCss;
      if(!cc) return false;
      const has = n => (cc.enabledSnippets && typeof cc.enabledSnippets.has==="function") ? cc.enabledSnippets.has(n) : null;
      if(has(THEME_SNIPPET)===true) return true;
      if(typeof cc.setCssEnabledStatus!=="function") return false;
      // a file we have only just created is not in cc.snippets yet, and
      // setCssEnabledStatus on an unknown snippet does not stick
      if(typeof cc.readSnippets==="function"){ try{ cc.readSnippets(); }catch(e){} }
      cc.setCssEnabledStatus(THEME_SNIPPET, true);
      if(typeof cc.requestLoadSnippets==="function"){ try{ cc.requestLoadSnippets(); }catch(e){} }
      const after = has(THEME_SNIPPET);
      return after===null ? true : after;
    }catch(e){ console.error("storm theme snippet", e); return false; }
  }
  async function writeThemeFile(css){
    if(!css || !A || !A.vault || !A.vault.adapter) return false;
    const ad = A.vault.adapter;
    try{
      let cur = null;
      try{ cur = await ad.read(THEME_PATH); }catch(e){ cur = null; }
      if(cur !== css){                                                   // idempotent: skip an unchanged write
        if(cur === null && typeof ad.mkdir === "function"){
          try{ if(!(ad.exists && await ad.exists(THEME_DIR))) await ad.mkdir(THEME_DIR); }catch(e){}
        }
        await ad.write(THEME_PATH, css);
      }
      // the snippet still has to be ON, even when the file was already right
      if(!enableThemeSnippet() && !g.__stormSnippetNoticed){
        g.__stormSnippetNoticed = true;
        notice("Storm keeps the vault-wide palette in " + THEME_PATH + ". Turn on the “" + THEME_SNIPPET +
               "” snippet in Settings → Appearance → CSS snippets so the theme paints the whole vault.");
      }
      return true;
    }catch(e){ console.error("storm theme file", e); return false; }
  }
  function currentPalette(){
    const mode = root.getAttribute("data-mode");
    if(mode==="community") return {mode:"community"};
    try{ const raw = root.getAttribute("data-storm-palette"); if(raw) return JSON.parse(raw); }catch(e){}
    return null;
  }
  function syncThemeFile(pal){
    const t = pal || currentPalette(); if(!t) return;
    try{ writeThemeFile(_themeFileCss(t)); }catch(e){ console.error("storm theme file", e); }
  }
  syncThemeFile();

  // ---- MATCH mode: if the cached palette is missing/stale, compute it from the banner and cache it ----
  (function(){
    if(root.getAttribute("data-mode")!=="match") return;
    const src = root.getAttribute("data-match-src"); if(!src) return;   // a fresh cache is already applied
    const bpath = root.getAttribute("data-match-bpath")||"";
    (async ()=>{
      try{
        const pal = await _paletteFromImage(src);
        const st = root.querySelector(".storm-theme-css"); if(st) st.textContent = _themeRule(pal);
        root.setAttribute("data-matched","1");
        root.setAttribute("data-storm-palette", JSON.stringify(pal));
        await writeThemeFile(_themeFileCss(pal));   // the whole vault, not just this note
        const p = root.getAttribute("data-self-path");
        if(p && A){ const f=A.vault.getAbstractFileByPath(p);
          if(f) await A.fileManager.processFrontMatter(f, fm=>{ fm.stormTheme=JSON.stringify(pal); fm.stormThemeSrc=bpath; }); }
      }catch(e){ console.error("storm match compute", e); }
    })();
  })();

  // ---- open Obsidian's full graph view ----
  root.querySelectorAll('[data-action="open-graph"]').forEach(el=>{
    el.style.cursor="pointer";
    el.addEventListener("click",ev=>{
      ev.preventDefault(); ev.stopPropagation();
      try{ if(A&&A.commands) A.commands.executeCommandById("graph:open"); }catch(e){}
    });
  });

  // ---- open/create TODAY's daily note WITH the template (not a blank wikilink) ----
  root.querySelectorAll('[data-action="open-today"]').forEach(el=>{
    el.style.cursor="pointer";
    el.addEventListener("click",ev=>{
      ev.preventDefault(); ev.stopPropagation();
      if(!A) return;
      try{
        const cmds=(A.commands&&A.commands.commands)?A.commands.commands:{};
        const id = cmds["daily-notes"] ? "daily-notes"
          : Object.keys(cmds).find(k=>/daily-notes/i.test(k)&&/(today|open)/i.test(k))
          || Object.keys(cmds).find(k=>/daily-notes/i.test(k));
        if(id){ A.commands.executeCommandById(id); return; }
      }catch(e){}
      try{ const link=el.getAttribute("data-today")||""; if(link&&A.workspace) A.workspace.openLinkText(link,"",false); }catch(e){}
    });
  });
  // ---- open a specific existing day's note ----
  root.querySelectorAll('[data-action="open-daily"]').forEach(el=>{
    el.style.cursor="pointer";
    el.addEventListener("click",ev=>{
      ev.preventDefault(); ev.stopPropagation();
      if(!A||!A.workspace) return;
      const nm=el.getAttribute("data-name")||"";
      if(nm) A.workspace.openLinkText(nm,"",false);
    });
  });

  /* ==========================================================
     Everything below writes to notes — needs a live app.
     ========================================================== */
  if(typeof document==="undefined" || !A || !A.vault) return;

  const tPath   = root.getAttribute("data-today-path")||"";
  const tIso    = root.getAttribute("data-today-iso")||"";
  const tmrIso  = root.getAttribute("data-tomorrow-iso")||"";
  const tplPath = root.getAttribute("data-template-path")||"";
  const isBox      = l => /^\s*[-*]\s*\[[ xX]\]/.test(l||"");
  const isEmptyBox = l => /^\s*[-*]\s*\[[ xX]\]\s*$/.test(l||"");
  // the one sub-task heading shape, shared with livedata.js / goal-panel / triage
  const SUBSEC_HEAD = /^#{1,6}\s+.*sub[-\s]?tasks?\b/i;
  const norm  = s => String(s||"").replace(/\s+/g," ").trim().toLowerCase();
  const base  = p => String(p||"").split("/").pop().replace(/\.md$/,"");
  const refresh = () => { try{ A.metadataCache.trigger("dataview:refresh-views"); }catch(e){} };
  function notice(msg){ try{ if(typeof require!=="undefined"){ const ob=require("obsidian"); new ob.Notice(msg,5000); } }catch(e){} }

  async function getToday(){
    if(!tPath) return null;
    let f = A.vault.getAbstractFileByPath(tPath);
    if(f) return f;
    try{ if(A.commands) A.commands.executeCommandById("daily-notes"); }catch(e){}
    for(let i=0;i<14;i++){ await sleep(160); f=A.vault.getAbstractFileByPath(tPath); if(f) return f; }
    return A.vault.getAbstractFileByPath(tPath);
  }
  // insert `line` into the section whose heading matches sectionRe, after its last real checkbox
  function insertInSection(lines, sectionRe, line, replaceBlank){
    const h = lines.findIndex(l=>sectionRe.test(l));
    if(h<0){ lines.push("", line); return lines.length-1; }
    let last=-1, lastFull=-1, blank=-1;
    for(let j=h+1;j<lines.length;j++){
      if(/^#{1,6}\s/.test(lines[j])) break;
      if(isBox(lines[j])){ last=j; if(!isEmptyBox(lines[j])) lastFull=j; else if(blank<0) blank=j; }
    }
    if(replaceBlank && blank>=0 && lastFull<0){ lines[blank]=line; return blank; }
    const at = (lastFull>=0?lastFull:(last>=0?last:h)) + 1;
    lines.splice(at,0,line);
    return at;
  }
  // comparable form of a checkbox line: no box, no Tasks emoji/dates, no #tags
  const clean = s => String(s==null?"":s)
    .replace(/^\s*[-*]\s*\[[ xX]\]\s*/,"")
    .replace(/[📅⏳🛫✅➕⏫🔼🔽⏬🔁]\s*\d{4}-\d{2}-\d{2}/gu," ")
    .replace(/[📅⏳🛫✅➕⏫🔼🔽⏬🔁]/gu," ")
    .replace(/#[\p{L}\p{N}_/-]+/gu," ")
    .replace(/\s+/g," ").trim().toLowerCase();
  // locate a checkbox line, tolerating drift (line numbers move when notes are edited,
  // and the row's text may predate a reschedule/tag edit — so both sides are cleaned)
  // Exact match on the checkbox's own cleaned text — never a substring, so `Step 1` can never
  // land on `Step 10` when the note shifted under the dashboard. Zero or several candidates → refuse.
  function findLine(lines, line, text){
    const want = norm(clean(text));
    const own  = l => norm(clean(String(l||"").replace(/^\s*[-*]\s*\[[ xX]\]\s?/, "")));
    const at = Number(line);
    const boxAt = at>=0 && at<lines.length && isBox(lines[at]);
    if(boxAt && (!want || own(lines[at])===want)) return at;
    if(!want) return -1;
    const hits=[]; lines.forEach((l,i)=>{ if(isBox(l) && own(l)===want) hits.push(i); });
    if(hits.length===1) return hits[0];
    notice(hits.length ? "Two checkboxes have the same text — tick that one in the note itself." : "That checkbox moved — refreshing, try again.");
    return -1;
  }
  async function ensureFolder(p){ if(!A.vault.getAbstractFileByPath(p)){ try{ await A.vault.createFolder(p); }catch(e){} } }
  const safeName = s => String(s||"").replace(/[\\/:*?"<>|#^[\]]/g,"").trim();
  async function freePath(folder, name){
    let p = folder+"/"+name+".md";
    if(A.vault.getAbstractFileByPath(p)) p = folder+"/"+name+" 2.md";
    if(A.vault.getAbstractFileByPath(p)) p = folder+"/"+name+" "+Date.now()+".md";
    return p;
  }

  // ---- functional checkboxes: toggle the real checkbox on the source note's line ----
  async function toggleLine(path, line, boxEl, text){
    try{
      const file=A.vault.getAbstractFileByPath(path);
      if(!file) return;
      const content=await A.vault.read(file);
      const lines=content.split("\n");
      const target = findLine(lines, line, text);
      if(target<0) return;
      let ln=lines[target];
      const done=/\[[xX]\]/.test(ln);
      ln = done ? stripDone(ln.replace(/\[[xX]\]/,"[ ]"))
                : stampDone(ln.replace(/\[\s\]/,"[x]"));
      lines[target]=ln;
      await A.vault.modify(file, lines.join("\n"));
      if(boxEl){
        boxEl.classList.toggle("done", !done);
        const td=boxEl.closest(".task"); if(td) td.classList.toggle("done", !done);
        const nr=boxEl.closest(".nm-row"); if(nr) nr.classList.toggle("done", !done);
      }
      // §3.3 nudge — the last sub-task of a task just got checked off
      if(!done && /^Tasks\//.test(String(path))){
        const open = lines.filter((l,i)=> i!==target && isBox(l) && /\[\s\]/.test(l) && !isEmptyBox(l));
        if(!open.length) notice("All sub-tasks done — mark "+base(path)+" complete?");
      }
      refresh();
    }catch(e){ console.error("toggleLine", e); }
  }
  root.querySelectorAll("[data-toggle-path]").forEach(box=>{
    box.style.cursor="pointer";
    box.addEventListener("click",ev=>{
      ev.preventDefault(); ev.stopPropagation();
      const path=box.getAttribute("data-toggle-path"); const line=parseInt(box.getAttribute("data-toggle-line"),10);
      if(path && !isNaN(line)) toggleLine(path, line, box, box.getAttribute("data-toggle-text")||"");
    });
  });

  // ---- reschedule a row: rewrite/append its 📅 date ----
  async function reschedule(path, line, iso, text){
    try{
      const f=A.vault.getAbstractFileByPath(path); if(!f){ notice("Couldn't find that note."); return false; }
      const lines=(await A.vault.read(f)).split("\n");
      const target=findLine(lines, line, text);
      if(target<0){ notice("Couldn't find that line — it may have moved."); return false; }
      let ln=lines[target];
      ln = /📅\s*\d{4}-\d{2}-\d{2}/.test(ln)
        ? ln.replace(/📅\s*\d{4}-\d{2}-\d{2}/, "📅 "+iso)
        : stampAtEnd(ln, " 📅 " + iso);
      lines[target]=ln;
      await A.vault.modify(f, lines.join("\n"));
      refresh();
      return true;
    }catch(e){ console.error("reschedule", e); return false; }
  }
  root.querySelectorAll("[data-resched]").forEach(btn=>{
    btn.style.cursor="pointer";
    btn.addEventListener("click", async ev=>{
      ev.preventDefault(); ev.stopPropagation();
      const row=btn.closest(".nm-row"); if(!row) return;
      const when=btn.getAttribute("data-resched");
      const iso = when==="tomorrow" ? (tmrIso||tIso) : tIso;
      if(!iso) return;
      const path=row.getAttribute("data-path"); const line=parseInt(row.getAttribute("data-line"),10);
      const bx=row.querySelector(".nm-box");
      const txt=(bx&&bx.getAttribute("data-toggle-text")) || ((row.querySelector(".nm-text")||{}).textContent||"");
      if(path && !isNaN(line) && line>=0){ btn.disabled=true; await reschedule(path,line,iso,txt); btn.disabled=false; }
    });
  });

  // ---- expand a next move into every unchecked sub-task of its task ----
  root.querySelectorAll("[data-expand]").forEach(btn=>{
    btn.style.cursor="pointer";
    btn.addEventListener("click", ev=>{
      ev.preventDefault(); ev.stopPropagation();
      const row=btn.closest(".nm-row"); if(!row) return;
      const subs=row.nextElementSibling;
      if(!subs || !subs.classList.contains("nm-subs")) return;
      const open = subs.style.display !== "none";
      subs.style.display = open ? "none" : "";
      if(open) subs.removeAttribute("data-open"); else subs.setAttribute("data-open","1");
      row.classList.toggle("expanded", !open);
      btn.textContent = open ? "▾" : "▴";
    });
  });

  // ---- "✓ Mark task complete" → status: done + completed: today ----
  root.querySelectorAll(".nm-markdone").forEach(btn=>{
    btn.style.cursor="pointer";
    btn.addEventListener("click", async ev=>{
      ev.preventDefault(); ev.stopPropagation();
      const path=btn.getAttribute("data-done-path"); if(!path) return;
      const f=A.vault.getAbstractFileByPath(path); if(!f){ notice("Couldn't find that task note."); return; }
      btn.disabled=true;
      try{
        await A.fileManager.processFrontMatter(f, fm=>{ fm.status="done"; fm.completed=tIso; });
        notice("Marked “"+base(path)+"” complete.");
        refresh();
      }catch(e){ console.error("markdone", e); notice("Couldn't mark it complete: "+e.message); btn.disabled=false; }
    });
  });

  /* ---------- §3.4 universal add box ---------- */
  // the 🎯 Goals index / 📋 Tasks board live in those folders but are dashboards, not
  // goals/tasks — they declare `cssclasses` and must never be pickable destinations.
  const isIndexNote = fm => { const c = fm && fm.cssclasses; return !!c && (Array.isArray(c) ? c : [c]).some(x => /dashboard|storm-home/i.test(String(x))); };
  function goalNotes(){
    try{
      return A.vault.getMarkdownFiles().filter(f=>/^Goals\//.test(f.path)).map(f=>{
        const fm=(A.metadataCache.getFileCache(f)||{}).frontmatter||{};
        return { path:f.path, name:base(f.path), status:String(fm.status||"active").toLowerCase(), type:String(fm.type||""), idx:isIndexNote(fm) };
      }).filter(x=>!x.idx && (!x.type || x.type==="goal"));
    }catch(e){ return []; }
  }
  function taskNotes(){
    try{
      return A.vault.getMarkdownFiles().filter(f=>/^Tasks\//.test(f.path)).map(f=>{
        const fm=(A.metadataCache.getFileCache(f)||{}).frontmatter||{};
        return { path:f.path, name:base(f.path), status:String(fm.status||"").toLowerCase(), type:String(fm.type||""), idx:isIndexNote(fm) };
      }).filter(x=>!x.idx && (!x.type || x.type==="task"));
    }catch(e){ return []; }
  }
  // exact → prefix → contains; returns {hit} | {many:[…]} | {}
  function fuzzy(list, q){
    const n=norm(q); if(!n) return {};
    const tiers=[ list.filter(x=>norm(x.name)===n), list.filter(x=>norm(x.name).indexOf(n)===0), list.filter(x=>norm(x.name).indexOf(n)>=0) ];
    for(const t of tiers){ if(t.length===1) return {hit:t[0]}; if(t.length>1) return {many:t}; }
    return {};
  }

  // CONTRACT A + THEME2 §C — a panel is CALLED, not pasted, and the call says so when
  // the file is not there. The note carries THREE lines; the code lives in exactly one
  // vault file, `_scripts/<name>.js` (then `_scripts/<name>/view.js`).
  // Line 1 resolves the view exactly as Dataview does, so the guard can never disagree
  // with the call it guards. Line 2 is the call, unchanged. Line 3 replaces Dataview's
  // own "custom view not found for '…'", which names the file and then tells the user
  // nothing: this vault syncs by iCloud, and on a phone the file is usually just late.
  // Nothing here knows what the panel DOES — only its name — so changing the panel
  // never changes the call site again.
  // The fence is spelled with \u0060 escapes: a literal triple backtick would close the
  // Dashboard note's own fence (assemble_dashboard.py rejects that).
  const VIEW_FENCE = "\u0060\u0060\u0060";
  const viewBlock = name => VIEW_FENCE + "dataviewjs\n" +
    "const p = \"_scripts/" + name + "\", f = x => app.metadataCache.getFirstLinkpathDest(x, \"\");\n" +
    "if (f(p + \".js\") || f(p + \"/view.js\")) await dv.view(p);\n" +
    "else dv.el(\"div\", \"⚠️ \" + p + \".js is missing from this device, so the panel cannot load. On iPhone or iPad this usually means the vault is still syncing — leave Obsidian open for a minute, then reopen this note.\", { cls: \"panel-err storm-missing-view\" });\n" +
    VIEW_FENCE;
  // → "## 📆 Timeline\n\n<one-line block>\n\n"
  const taskGanttSection = () => "## 📆 Timeline\n\n" + viewBlock("task-gantt") + "\n\n";

  async function createTaskNote(p){
    const nm = safeName(p.name) || "Untitled task";
    let goalName="", goalPath="";
    if(p.goal){ const r=fuzzy(goalNotes(), p.goal);
      if(r.many){ notice("More than one goal matches “"+p.goal+"”: "+r.many.map(x=>x.name).join(", ")); return; }
      if(r.hit){ goalName=r.hit.name; goalPath=r.hit.path; }
      else { notice("No goal matches “"+p.goal+"” — created the task without a goal."); }
    } else {
      const act = goalNotes().filter(x=>x.status==="active");
      if(act.length===1){ goalName=act[0].name; goalPath=act[0].path; }
    }
    const start = p.start || tIso;
    const end   = p.end || p.iso || "";
    await ensureFolder("Tasks");
    const path = await freePath("Tasks", nm);
    const timeline = taskGanttSection();         // one-line dv.view block (CONTRACT A)
    const body = "---\ntype: task\ngoal: "+(goalName?JSON.stringify("[["+goalName+"]]"):"")+"\nstatus: active\nstart: "+start+"\nend: "+end+"\ncompleted: \ntags:\n  - task\n---\n\n"
      + (goalName?"[["+goalName+"|← Goal]]":"[[🎯 Goals|← Goals]]")+"　·　[[Dashboard|Dashboard]]\n\n# "+nm+"\n\n"
      + "> Sub-tasks below show on the Dashboard as your next move. Add a 📅 date to any of them.\n\n"
      + timeline
      + "## Sub-tasks\n- [ ] \n\n## 🗒️ Notes\n";
    try{ const nf=await A.vault.create(path, body); refresh(); if(A.workspace) A.workspace.openLinkText(nf.path,"",false); if(!goalName) notice("Created “"+nm+"” — set its goal in the properties."); }
    catch(e){ notice("Couldn't create the task note: "+e.message); }
  }

  async function createGoalNote(p){
    const nm = safeName(p.name) || "Untitled goal";
    const panel = viewBlock("goal-panel");       // one-line dv.view block (CONTRACT A)
    await ensureFolder("Goals");
    const path = await freePath("Goals", nm);
    // the area is free text — quote it so a `:` or `#` can never break the YAML
    const areaVal = p.area ? (/^[\w][\w ./+-]*$/.test(p.area) ? p.area : JSON.stringify(p.area)) : "";
    const body = "---\ntype: goal\nstatus: active\narea: "+areaVal+"\ntarget: "+(p.end||p.iso||"")+"\ntags:\n  - goal\n---\n\n"
      + "[[🎯 Goals|← Goals]]　·　[[Dashboard|Dashboard]]\n\n# "+nm+"\n\n## 🎯 Outcome\n\nWhat does done look like?\n\n"
      + panel + "\n\n## 🗒️ Notes\n";
    try{ const nf=await A.vault.create(path, body); refresh(); if(A.workspace) A.workspace.openLinkText(nf.path,"",false); }
    catch(e){ notice("Couldn't create the goal note: "+e.message); }
  }

  // SPEC §3.4 checkbox shape: `- [ ] <text>[ 📅 iso][ #tags kept]`.
  // parseAdd peels trailing #tags off the text so a date in front of them is still
  // read; they are re-appended here, after the date.
  function addLine(p){
    const text = String(p.text||"").trim();
    const esc = s => String(s).replace(/[.*+?^${}()|[\]\\\-\/]/g, "\\$&");
    const extra = (p.tags||[]).filter(t => !(new RegExp("(^|\\s)"+esc(t)+"(?=$|\\s)")).test(text));
    return "- [ ] " + text + (p.iso ? (" 📅 "+p.iso) : "") + (extra.length ? (" "+extra.join(" ")) : "");
  }

  async function addSubTask(p){
    if(!p.task){ notice("Add a target task: sub: Draft the intro -> Task name"); return; }
    const r = fuzzy(taskNotes(), p.task);
    if(r.many){ notice("More than one task matches “"+p.task+"”: "+r.many.map(x=>x.name).join(", ")); return; }
    if(!r.hit){ notice("No task in Tasks/ matches “"+p.task+"”."); return; }
    const f=A.vault.getAbstractFileByPath(r.hit.path); if(!f){ notice("Couldn't open that task note."); return; }
    const lines=(await A.vault.read(f)).split("\n");
    insertInSection(lines, SUBSEC_HEAD, addLine(p), true);
    await A.vault.modify(f, lines.join("\n"));
    notice("Added to “"+r.hit.name+"”.");
    refresh();
  }

  async function addInboxItem(p){
    const f = await getToday(); if(!f){ notice("Couldn't create today's note — open it once, then try again."); return; }
    const lines=(await A.vault.read(f)).split("\n");
    insertInSection(lines, /^#{1,6}\s*⚡/, addLine(p));
    await A.vault.modify(f, lines.join("\n"));
    refresh();
  }

  async function addHabit(label){
    label = String(label||"").trim(); if(!label) return;
    let slug = label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g,"-").slice(0,28) || "habit";
    const line = "- [ ] " + label + " #habit/" + slug;
    const f = await getToday();
    if(f){ const lines=(await A.vault.read(f)).split("\n"); insertInSection(lines,/^#{1,6}\s*🔥/,line); await A.vault.modify(f,lines.join("\n")); }
    if(tplPath){ const tf=A.vault.getAbstractFileByPath(tplPath);
      if(tf){ const tl=(await A.vault.read(tf)).split("\n"); insertInSection(tl,/^#{1,6}\s*🔥/,line); await A.vault.modify(tf,tl.join("\n")); } }
    notice("Added “"+label+"”. It's now in today's note and future daily notes.");
    refresh();
  }
  async function addQuickNote(title){
    let b = safeName(title);
    if(!b) b = "Note " + (tIso || "");
    await ensureFolder("Note Bank");
    const path = await freePath("Note Bank", b);
    const body = "---\ndate: "+(tIso||"")+"\ntags:\n  - note\ntype: note\nstatus: inbox\ntopic: \nsource: \n---\n\n# "+b+"\n\n";
    try{ const nf=await A.vault.create(path, body); refresh(); if(A.workspace) A.workspace.openLinkText(nf.path,"",false); }
    catch(e){ notice("Couldn't create the note: "+e.message); }
  }
  async function addJobApp(text){
    text = String(text||"").trim(); if(!text) return;
    let company = text, role = "";
    const m = text.split(/\s+[—–-]\s+/);
    if(m.length>=2){ company=m[0].trim(); role=m.slice(1).join(" — ").trim(); }
    const safe = safeName(company + (role?" — "+role:"")) || "Untitled application";
    await ensureFolder("Job Search"); await ensureFolder("Job Search/Applications");
    const path = await freePath("Job Search/Applications", safe);
    const body = "---\ntags:\n  - application\ncompany: "+JSON.stringify(company)+"\nrole: "+JSON.stringify(role)+"\nstatus: saved\napplied: \ndeadline: \nlink: \nlocation: \nremote: \nsalary: \nsource: \ncontact: \nresume: \ncoverletter: \nnext: \npriority: \n---\n\n# "+safe+"\n\n> Set **status** (saved → applied → screen → interview → final → offer) and the properties above — your [[💼 Job Search]] board updates automatically. Pull materials from [[📎 Application Materials]].\n\n## 📝 Job description\n\n\n## 🎤 Interviews & timeline\n- \n\n## 🗒️ Notes\n- \n";
    try{ const nf=await A.vault.create(path, body); refresh(); if(A.workspace) A.workspace.openLinkText(nf.path,"",false); }
    catch(e){ notice("Couldn't create the application note: "+e.message); }
  }

  async function universalAdd(raw){
    const p = parseAdd(raw, { todayIso: tIso });
    if(p.kind==="task") return createTaskNote(p);
    if(p.kind==="goal") return createGoalNote(p);
    if(p.kind==="sub")  return addSubTask(p);
    if(p.kind==="habit") return addHabit(p.text);
    if(p.kind==="note")  return addQuickNote(p.text);
    if(p.kind==="job")   return addJobApp(p.text);
    if(!p.text.trim()) return;
    return addInboxItem(p);
  }
  async function submitAdd(inp){
    const v=inp.value.trim(); if(!v) return;
    inp.disabled=true; inp.classList.add("busy");
    try{ await universalAdd(v); }
    catch(e){ console.error("storm add", e); notice("Something went wrong: "+e.message); }
    inp.value=""; inp.disabled=false; inp.classList.remove("busy");
    try{ inp.focus(); }catch(e){}
  }
  root.querySelectorAll("input[data-uadd]").forEach(inp=>{
    inp.addEventListener("click",ev=>ev.stopPropagation());
    inp.addEventListener("keydown", ev=>{
      if(ev.key==="Escape"){ inp.value=""; inp.blur(); return; }
      if(ev.key!=="Enter") return;
      ev.preventDefault(); ev.stopPropagation(); submitAdd(inp);
    });
  });
  root.querySelectorAll("[data-uaddbtn]").forEach(btn=>{
    btn.addEventListener("click", ev=>{
      ev.preventDefault(); ev.stopPropagation();
      const inp = btn.parentElement ? btn.parentElement.querySelector("input[data-uadd]") : null;
      if(inp) submitAdd(inp);
    });
  });

  /* ---------- §3.1 action-strip filters ---------- */
  const FILTERABLE = { nm:1, today:1, over:1, risk:1 };
  // `today` / `over` count individual SUB-TASKS, and a matching one can be sitting in a
  // collapsed `.nm-subs` list — reveal exactly those rows (minus the copy of the head
  // row, which is already on screen) so the tile count always equals what you can see.
  // `nm` / `risk` are per-task / per-goal filters, so their sub lists stay collapsed.
  const SUB_SEL = { today:".is-today", over:".is-over" };
  function syncSubLists(card, filter){
    const sel = SUB_SEL[filter] || "";
    card.querySelectorAll(".nm-subs").forEach(sub=>{
      const head = sub.previousElementSibling;
      const hp = head ? head.getAttribute("data-path") : null, hl = head ? head.getAttribute("data-line") : null;
      let shown = 0;
      sub.querySelectorAll(".nm-row").forEach(rw=>{
        if(!sel){ rw.style.display = ""; return; }
        const dupe = rw.getAttribute("data-path")===hp && rw.getAttribute("data-line")===hl;
        let show = false;
        try{ show = !dupe && rw.matches(sel); }catch(e){}
        rw.style.display = show ? "" : "none";
        if(show) shown++;
      });
      sub.style.display = sel ? (shown?"":"none") : (sub.hasAttribute("data-open") ? "" : "none");
    });
  }
  root.querySelectorAll(".actstrip .act").forEach(tile=>{
    const f = tile.getAttribute("data-filter")||"";
    if(!FILTERABLE[f] || tile.getAttribute("data-nofilter")) return;
    tile.style.cursor="pointer";
    tile.addEventListener("click", ev=>{
      ev.preventDefault(); ev.stopPropagation();
      const card=root.querySelector(".nowcard"); if(!card) return;
      const next = (card.getAttribute("data-filter")===f) ? "" : f;
      card.setAttribute("data-filter", next);
      root.querySelectorAll(".actstrip .act").forEach(x=>x.classList.toggle("active", !!next && x===tile));
      syncSubLists(card, next);
    });
  });

  /* ---------- §3.2 hero One Thing ---------- */
  async function saveOneThing(text){
    const f = await getToday(); if(!f){ notice("Couldn't create today's note — open it once, then try again."); return false; }
    const lines=(await A.vault.read(f)).split("\n");
    const h = lines.findIndex(l=>/^#{1,6}\s*🎯/.test(l));
    if(h<0){ lines.push("", "## 🎯 One thing", "", "→ "+text); }
    else{
      let end=h+1; while(end<lines.length && !/^#{1,6}\s/.test(lines[end])) end++;
      let at=-1; for(let j=h+1;j<end;j++){ if(/^\s*→/.test(lines[j])){ at=j; break; } }
      if(at>=0) lines[at]="→ "+text;
      else { let ins=h+1; while(ins<end && lines[ins].trim()==="") ins++; lines.splice(ins,0,"→ "+text); }
    }
    await A.vault.modify(f, lines.join("\n"));
    refresh(); return true;
  }
  root.querySelectorAll('[data-action="edit-one"]').forEach(el=>{
    el.style.cursor="pointer";
    el.addEventListener("click", ev=>{
      ev.preventDefault(); ev.stopPropagation();
      if(el.classList.contains("editing")) return;
      const v = el.querySelector(".v"); if(!v) return;
      const cur = el.classList.contains("unset") ? "" : v.textContent.trim();
      el.classList.add("editing");
      const inp = document.createElement("input");
      inp.type="text"; inp.className="one-inp"; inp.value=cur; inp.placeholder="What's the one thing?";
      v.replaceWith(inp);
      try{ inp.focus(); inp.select(); }catch(e){}
      let closed = false;
      const restore = txt => {
        if(closed) return; closed = true;
        inp.removeEventListener("blur", onBlur);
        const nv=document.createElement("span"); nv.className="v";
        nv.textContent = txt || "Set today's one thing →";
        el.classList.toggle("unset", !txt);
        inp.replaceWith(nv); el.classList.remove("editing");
      };
      const onBlur = ()=>{ if(!closed) restore(cur); };
      inp.addEventListener("click", e=>e.stopPropagation());
      inp.addEventListener("keydown", async e=>{
        if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); restore(cur); return; }
        if(e.key!=="Enter") return;
        e.preventDefault(); e.stopPropagation();
        const txt=inp.value.trim();
        inp.removeEventListener("blur", onBlur);   // saving must not be cancelled by the blur
        inp.readOnly=true;
        const ok = txt ? await saveOneThing(txt) : true;
        restore(ok?txt:cur);
      });
      inp.addEventListener("blur", onBlur);
    });
  });

  /* ---------- §3.3 shutdown fields ---------- */
  const SD = {
    win:  { re:/^\s*\*\*\s*(?:Win of the day|What got done)\s*:?\s*\*\*/i,                 label:"**Win of the day:**" },
    next: { re:/^\s*\*\*\s*(?:One next step[^*]*|Next concrete step[^*]*)\*\*/i,           label:"**One next step on anything I touched:**" }
  };
  async function saveShutdown(which, text){
    const spec = SD[which]; if(!spec) return false;
    const f = await getToday(); if(!f){ notice("Couldn't create today's note — open it once, then try again."); return false; }
    const lines=(await A.vault.read(f)).split("\n");
    let at = lines.findIndex(l=>spec.re.test(l));
    if(at>=0){ lines[at] = spec.label + (text?(" "+text):""); }
    else{
      let h = lines.findIndex(l=>/^#{1,6}\s*🌙/.test(l));
      if(h<0) h = lines.findIndex(l=>/^#{1,6}\s*📝\s*End of Day/i.test(l));
      if(h<0){ lines.push("", "## 🌙 Shutdown", "", spec.label + (text?(" "+text):"")); }
      else{ let end=h+1; while(end<lines.length && !/^#{1,6}\s/.test(lines[end])) end++;
        while(end>h+1 && lines[end-1].trim()==="") end--;
        lines.splice(end,0,"",spec.label + (text?(" "+text):"")); }
    }
    await A.vault.modify(f, lines.join("\n"));
    refresh(); return true;
  }
  root.querySelectorAll("input[data-sd]").forEach(inp=>{
    inp.addEventListener("click",ev=>ev.stopPropagation());
    inp.addEventListener("keydown", async ev=>{
      if(ev.key==="Escape"){ inp.blur(); return; }
      if(ev.key!=="Enter") return;
      ev.preventDefault(); ev.stopPropagation();
      inp.disabled=true; inp.classList.add("busy");
      try{ await saveShutdown(inp.getAttribute("data-sd"), inp.value.trim()); }
      catch(e){ console.error("shutdown", e); notice("Couldn't save that: "+e.message); }
      inp.disabled=false; inp.classList.remove("busy");
    });
  });

  /* ---------- §3.5 reference section collapse ---------- */
  (function(){
    const sec = root.querySelector(".refsec"); if(!sec) return;
    const KEY="storm.refCollapsed";
    let saved=null; try{ saved = g.localStorage ? g.localStorage.getItem(KEY) : null; }catch(e){}
    if(saved==="1") sec.classList.add("collapsed");
    root.querySelectorAll('[data-action="toggle-ref"]').forEach(el=>{
      el.style.cursor="pointer";
      el.addEventListener("click", ev=>{
        ev.preventDefault(); ev.stopPropagation();
        const now = sec.classList.toggle("collapsed");
        try{ if(g.localStorage) g.localStorage.setItem(KEY, now?"1":"0"); }catch(e){}
        el.textContent = (now?"▸":"▾") + " Reference · Calendar · Reading · Notes · Graph · Music";
      });
      if(sec.classList.contains("collapsed")) el.textContent = "▸ Reference · Calendar · Reading · Notes · Graph · Music";
    });
  })();

  // ---- pomodoro focus picker → save chosen next move / habit to today's note ----
  root.querySelectorAll("select[data-focus]").forEach(sel=>{
    sel.addEventListener("click", ev=>ev.stopPropagation());
    sel.addEventListener("change", async ()=>{
      const val = sel.value;
      const f = await getToday(); if(!f){ notice("Open today's note first to set a focus."); return; }
      try{
        if(A.fileManager && A.fileManager.processFrontMatter){
          await A.fileManager.processFrontMatter(f, fm=>{ if(val) fm.focus = val; else delete fm.focus; });
        } else {
          let c = await A.vault.read(f);
          if(/^---\r?\n[\s\S]*?\r?\n---/.test(c)){
            if(/^focus:.*$/m.test(c)) c = c.replace(/^focus:.*$/m, "focus: " + JSON.stringify(val));
            else c = c.replace(/^(---\r?\n)/, "$1focus: " + JSON.stringify(val) + "\n");
          } else { c = "---\nfocus: " + JSON.stringify(val) + "\n---\n" + c; }
          await A.vault.modify(f, c);
        }
      }catch(e){ console.error("focus", e); notice("Couldn't save the focus: " + e.message); }
      refresh();
    });
  });

  // ---- delete a line (inbox one-offs) ----
  async function deleteLine(path, line, text){
    try{
      const f=A.vault.getAbstractFileByPath(path); if(!f) return false;
      const lines=(await A.vault.read(f)).split("\n");
      const target=findLine(lines, line, text);
      if(target<0) return false;
      lines.splice(target,1);
      await A.vault.modify(f, lines.join("\n"));
      return true;
    }catch(e){ return false; }
  }
  root.querySelectorAll("[data-del-path]").forEach(x=>{
    x.style.cursor="pointer";
    x.addEventListener("click", async ev=>{
      ev.preventDefault(); ev.stopPropagation();
      const path=x.getAttribute("data-del-path"); const line=parseInt(x.getAttribute("data-del-line"),10); const text=x.getAttribute("data-del-text")||"";
      const row=x.closest(".nm-row")||x.closest(".task"); if(row){ row.style.opacity=".3"; row.style.pointerEvents="none"; }
      const ok=(path&&!isNaN(line)) ? await deleteLine(path,line,text) : false;
      if(ok){ if(row) row.remove(); refresh(); }
      else if(row){ row.style.opacity=""; row.style.pointerEvents=""; notice("Couldn't find that line to delete — it may have moved."); }
    });
  });

  // ---- log today's workout into the daily note ----
  async function logWorkout(){
    const sess = root.getAttribute("data-workout-session")||"";
    const rp = root.getAttribute("data-workout-routine")||"";
    const f = await getToday(); if(!f){ notice("Open today's note first."); return; }
    const content = await A.vault.read(f);
    if(/#workout\b/.test(content)){ if(A.workspace) A.workspace.openLinkText(f.path,"",false); return; }
    let exLines = [];
    if(rp){ const rf=A.vault.getAbstractFileByPath(rp);
      if(rf){ const txt=await A.vault.read(rf); const seg=(txt.split(/##\s*Session[^\n]*\n/i)[1]||""); const body=seg.split(/\n#{1,6}\s/)[0];
        exLines=[...body.matchAll(/^\s*[-*]\s*\[[ xX]\]\s*(.+)$/gm)].map(m=>"- [ ] "+m[1].trim()); } }
    const block = ["**"+(sess||"Workout")+"** — "+(tIso||""), "- [ ] 🏋️ "+(sess||"Workout")+" done #workout", ...exLines, ""];
    let lines = content.split("\n");
    let h = lines.findIndex(l=>/^##\s*🏋️/.test(l));
    if(h<0){ let at = lines.findIndex(l=>/^##\s*📝/.test(l)); if(at<0) at=lines.length; lines.splice(at,0,"## 🏋️ Workout","",...block,""); }
    else { let end=h+1; while(end<lines.length && !/^##\s/.test(lines[end])) end++; lines.splice(end,0,...block); }
    await A.vault.modify(f, lines.join("\n"));
    refresh();
    if(A.workspace) A.workspace.openLinkText(f.path,"",false);
  }
  root.querySelectorAll('[data-action="log-workout"]').forEach(btn=>{
    btn.style.cursor="pointer";
    btn.addEventListener("click", async ev=>{
      ev.preventDefault(); ev.stopPropagation();
      btn.disabled=true; btn.textContent="Logging…";
      try{ await logWorkout(); }catch(e){ console.error(e); notice("Couldn't log the workout: "+e.message); btn.disabled=false; }
    });
  });

  // ---- live filter for the All-Notes list ----
  root.querySelectorAll("input[data-notesearch]").forEach(inp=>{
    inp.addEventListener("click",ev=>ev.stopPropagation());
    inp.addEventListener("input",()=>{
      const q=inp.value.trim().toLowerCase();
      root.querySelectorAll(".noterow").forEach(r=>{
        const nm=(r.querySelector(".nnm")?r.querySelector(".nnm").textContent:"").toLowerCase();
        const fold=(r.querySelector(".nfold")?r.querySelector(".nfold").textContent:"").toLowerCase();
        r.style.display = (!q || nm.indexOf(q)>=0 || fold.indexOf(q)>=0) ? "" : "none";
      });
    });
  });

  // ---- Now Playing: real local-audio player, persists across hub re-renders ----
  (function(){
    if(typeof Audio==="undefined") return;
    const card = root.querySelector(".musiccard[data-tracks]");
    if(!card) return;
    let tracks=[]; try{ tracks=JSON.parse(card.getAttribute("data-tracks")||"[]")||[]; }catch(e){}
    if(!tracks.length) return;
    const ttEl=card.querySelector(".tt"), arEl=card.querySelector(".ar"), fillEl=card.querySelector(".mfill"),
          curEl=card.querySelector(".cur"), durEl=card.querySelector(".dur"),
          playBtn=card.querySelector('[data-audio="toggle"]'), seekEl=card.querySelector("[data-audio-seek]");
    const sig = tracks.map(t=>t.s).join("|");
    let AU = g.__stormAudio;
    if(!AU){ AU = g.__stormAudio = new Audio(); AU.preload="metadata"; }
    if(g.__stormAudioSig !== sig){ g.__stormAudioSig=sig; g.__stormAudioIdx=0; try{ AU.pause(); }catch(e){} try{ AU.src=tracks[0].s; }catch(e){} }
    let idx = g.__stormAudioIdx||0; if(idx>=tracks.length) idx=0;
    const fmt = s => { s=Math.max(0,Math.floor(s||0)); return Math.floor(s/60)+":"+_two(s%60); };
    function markCurrent(){ card.querySelectorAll(".uprow").forEach(r=>r.classList.toggle("cur", parseInt(r.getAttribute("data-track-idx"),10)===idx)); }
    function paintTrack(){ const t=tracks[idx]||{}; if(ttEl)ttEl.textContent=t.t||"Untitled"; if(arEl)arEl.textContent=t.a||""; markCurrent(); }
    function paintTime(){ const d2=AU.duration||0,c2=AU.currentTime||0; if(fillEl)fillEl.style.width=(d2?Math.min(100,c2/d2*100):0)+"%"; if(curEl)curEl.textContent=fmt(c2); if(durEl)durEl.textContent=d2?fmt(d2):"0:00"; }
    function paintPlay(){ if(playBtn)playBtn.textContent=AU.paused?"▶":"⏸"; card.classList.toggle("playing",!AU.paused); }
    function loadIdx(i,autoplay){ idx=((i%tracks.length)+tracks.length)%tracks.length; g.__stormAudioIdx=idx; try{ AU.src=tracks[idx].s; }catch(e){} paintTrack(); if(autoplay) AU.play().catch(()=>{}); paintPlay(); }
    paintTrack(); paintTime(); paintPlay();
    if(g.__stormAudioH){ const h2=g.__stormAudioH; AU.removeEventListener("timeupdate",h2.t); AU.removeEventListener("play",h2.p); AU.removeEventListener("pause",h2.pa); AU.removeEventListener("ended",h2.e); AU.removeEventListener("loadedmetadata",h2.m); }
    const HH={ t:paintTime, p:paintPlay, pa:paintPlay, e:()=>{ if(tracks.length>1) loadIdx(idx+1,true); else paintPlay(); }, m:paintTime };
    AU.addEventListener("timeupdate",HH.t); AU.addEventListener("play",HH.p); AU.addEventListener("pause",HH.pa); AU.addEventListener("ended",HH.e); AU.addEventListener("loadedmetadata",HH.m);
    g.__stormAudioH=HH;
    if(playBtn) playBtn.onclick=e=>{ e.preventDefault(); e.stopPropagation(); if(AU.paused){ if(!AU.src) AU.src=tracks[idx].s; AU.play().catch(()=>{}); } else AU.pause(); };
    card.querySelectorAll('[data-audio="prev"]').forEach(b=>b.onclick=e=>{ e.preventDefault(); e.stopPropagation(); loadIdx(idx-1, !AU.paused); });
    card.querySelectorAll('[data-audio="next"]').forEach(b=>b.onclick=e=>{ e.preventDefault(); e.stopPropagation(); loadIdx(idx+1, !AU.paused); });
    if(seekEl) seekEl.onclick=e=>{ e.stopPropagation(); const r=seekEl.getBoundingClientRect(); const p=(e.clientX-r.left)/Math.max(1,r.width); if(AU.duration) AU.currentTime=Math.max(0,Math.min(1,p))*AU.duration; };
    card.querySelectorAll(".uprow[data-track-idx]").forEach(row=>{ row.onclick=e=>{ e.stopPropagation(); const i=parseInt(row.getAttribute("data-track-idx"),10); if(!isNaN(i)) loadIdx(i,true); }; });
  })();
}

if(typeof module!=="undefined") module.exports={buildHub,initHub,parseAdd,_two};
