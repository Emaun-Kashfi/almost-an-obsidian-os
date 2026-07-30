---
cssclasses:
  - storm-home
  - max
tags:
  - dashboard
name: there
stormMode: community
---

```dataviewjs
try {
/* ============================================================
   STORM HUB — pure render + behaviour (no Dataview/app calls)
   buildHub(data) -> HTML string   |   initHub(rootEl) -> wires clock/pomodoro/nav
   Shared by the verification harness and the Obsidian dataviewjs note.
   ============================================================ */
function _two(n){ return String(n).padStart(2,"0"); }
function _esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function _mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
// deterministic force-directed layout → returns [{x,y}] in a 1000x360 box
function _layoutGraph(g){
  const N=g.nodes.length, W=1000, H=760; const rnd=_mulberry32(9973);
  const pos=g.nodes.map((n,i)=>{ const a=i/Math.max(1,N)*Math.PI*2; return { x:W/2+Math.cos(a)*W*0.28*(0.55+rnd()*0.5), y:H/2+Math.sin(a)*H*0.34*(0.55+rnd()*0.5), vx:0, vy:0 }; });
  const L=g.links, IT=260;
  for(let it=0; it<IT; it++){
    const cool=1-it/IT;
    for(let i=0;i<N;i++){ for(let j=i+1;j<N;j++){ let dx=pos[i].x-pos[j].x, dy=pos[i].y-pos[j].y, d2=dx*dx+dy*dy+0.01, d=Math.sqrt(d2), f=2600/d2, fx=dx/d*f, fy=dy/d*f; pos[i].vx+=fx; pos[i].vy+=fy; pos[j].vx-=fx; pos[j].vy-=fy; } }
    for(const l of L){ const a=pos[l.s], b=pos[l.t]; if(!a||!b) continue; let dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy)+0.01, f=(d-72)*0.02, fx=dx/d*f, fy=dy/d*f; a.vx+=fx; a.vy+=fy; b.vx-=fx; b.vy-=fy; }
    for(let i=0;i<N;i++){ pos[i].vx+=(W/2-pos[i].x)*0.0022; pos[i].vy+=(H/2-pos[i].y)*0.0022; pos[i].x+=pos[i].vx*cool*0.5; pos[i].y+=pos[i].vy*cool*0.5; pos[i].vx*=0.85; pos[i].vy*=0.85; }
  }
  let mnx=1/0,mny=1/0,mxx=-1/0,mxy=-1/0; for(const p of pos){ mnx=Math.min(mnx,p.x); mny=Math.min(mny,p.y); mxx=Math.max(mxx,p.x); mxy=Math.max(mxy,p.y); }
  const pad=26, s=Math.min((W-2*pad)/Math.max(1,mxx-mnx),(H-2*pad)/Math.max(1,mxy-mny));
  const ox=(W-(mxx-mnx)*s)/2, oy=(H-(mxy-mny)*s)/2;
  for(const p of pos){ p.x=ox+(p.x-mnx)*s; p.y=oy+(p.y-mny)*s; }
  return pos;
}

// ---- match-theme-to-banner helpers ----
function _rgb2hsl(r,g,b){ r/=255; g/=255; b/=255; const mx=Math.max(r,g,b), mn=Math.min(r,g,b); let h=0,s=0,l=(mx+mn)/2; const d=mx-mn; if(d){ s=l>0.5?d/(2-mx-mn):d/(mx+mn); if(mx===r)h=((g-b)/d+(g<b?6:0)); else if(mx===g)h=(b-r)/d+2; else h=(r-g)/d+4; h*=60; } return [h,s,l]; }
function _hsl2rgb(h,s,l){ h=((h%360)+360)%360; const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2; let r=0,g=0,b=0; if(h<60){r=c;g=x;} else if(h<120){r=x;g=c;} else if(h<180){g=c;b=x;} else if(h<240){g=x;b=c;} else if(h<300){r=x;b=c;} else {r=c;b=x;} return [Math.round((r+m)*255),Math.round((g+m)*255),Math.round((b+m)*255)]; }
function _hex(h,s,l){ return "#"+_hsl2rgb(h,s,l).map(v=>v.toString(16).padStart(2,"0")).join(""); }
function _rgba(h,s,l,a){ const c=_hsl2rgb(h,s,l); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function _hexRgb(x){ x=String(x).replace("#",""); return [parseInt(x.slice(0,2),16),parseInt(x.slice(2,4),16),parseInt(x.slice(4,6),16)]; }
function _relLum(hex){ const c=_hexRgb(hex).map(v=>{ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }
function _contrast(a,b){ const L1=_relLum(a), L2=_relLum(b); return (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05); }
function _lumaRGB(r,g,b){ const f=v=>{ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); }
function _rgbCsv(hex){ return _hexRgb(hex).join(","); }
// nudge L (dir=+1 lighten / -1 darken) until the colour clears `target` on the given bg(s)
function _fixText(h,s,l,bgA,bgB,dir,target){ let hex=_hex(h,s,l),g=0; while((_contrast(hex,bgA)<target||_contrast(hex,bgB)<target)&&l>0.02&&l<0.98&&g++<64){ l+=dir*0.02; hex=_hex(h,s,l); } return hex; }
function _fixAcc(h,s,l,surf,dir,target){ let hex=_hex(h,s,l),g=0; while(_contrast(hex,surf)<target&&l>0.05&&l<0.95&&g++<64){ l+=dir*0.02; hex=_hex(h,s,l); } return hex; }
function _btnPair(h,s){ let l=0.42,btn=_hex(h,s,l),g=0; while(_contrast("#f6fdff",btn)<4.5&&l>0.12&&g++<50){ l-=0.02; btn=_hex(h,s,l); } return { btn, onAccent:"#f6fdff" }; }
// quantize an image into swatches, pick the dominant tone + most vibrant colour
function _extract(data){
  const cells={}; let totL=0, totN=0;
  for(let i=0;i<data.length;i+=4){ if(data[i+3]<128) continue;
    const r=data[i],g=data[i+1],b=data[i+2]; totL+=_lumaRGB(r,g,b); totN++;
    const key=((r*5/256|0))+"_"+((g*5/256|0))+"_"+((b*5/256|0));
    let c=cells[key]; if(!c){ c=cells[key]={r:0,g:0,b:0,n:0}; } c.r+=r; c.g+=g; c.b+=b; c.n++; }
  const sw=[]; for(const k in cells){ const c=cells[k], r=c.r/c.n,g=c.g/c.n,b=c.b/c.n, hsl=_rgb2hsl(r,g,b); sw.push({n:c.n,h:hsl[0],s:hsl[1],l:hsl[2]}); }
  sw.sort((a,b)=>b.n-a.n);
  let vib=null,best=0;
  for(const c of sw){ if(c.s<0.25||c.l<0.12||c.l>0.9) continue; const sc=c.s*(1-Math.abs(c.l-0.5))*Math.sqrt(c.n); if(sc>best){ best=sc; vib=c; } }
  return { dominant: sw[0]||{h:210,s:0.1,l:0.2}, vibrant:vib, overallLum: totN? totL/totN : 0.1, hasColor: !!vib };
}
// build a full WCAG-AA palette that goes LIGHT or DARK to match the image
function _buildTheme(ex){
  const light = ex.overallLum > 0.45;
  const dHue = ex.dominant.h || 210;
  const aHue = ex.hasColor ? ex.vibrant.h : dHue;
  const aSat = ex.hasColor ? Math.min(0.82, Math.max(0.42, ex.vibrant.s)) : 0.20;
  const dir  = light ? -1 : 1;                        // push text/accents away from bg
  const bgSat = light ? 0.12 : 0.20, bgL = light ? 0.955 : 0.072;
  const bg=_hex(dHue,bgSat,bgL), surface=_hex(dHue,bgSat, light?bgL-0.045:bgL+0.042), surface2=_hex(dHue,bgSat, light?bgL-0.082:bgL+0.078);
  const text  = _fixText(dHue, light?0.22:0.12, light?0.20:0.93, bg, surface,  dir, 7);
  const dim   = _fixText(dHue, light?0.18:0.12, light?0.40:0.72, bg, surface2, dir, 4.5);
  const faint = _fixText(dHue, light?0.16:0.11, light?0.50:0.60, bg, surface2, dir, 4.5);
  const accent  = _fixAcc(aHue, aSat, light?0.42:0.66, surface,  dir, 4.5);
  const accent2 = _fixAcc(aHue, Math.min(0.9,aSat+0.08), light?0.34:0.80, surface2, dir, 4.5);
  const warm    = _fixAcc(35,  0.85, light?0.42:0.72, surface, dir, 4.5);
  const good    = _fixAcc(150, 0.5,  light?0.36:0.66, surface, dir, 4.5);
  const bn=_btnPair(aHue,aSat);
  const track = light ? _hex(dHue,bgSat,bgL-0.075) : _hex(dHue,bgSat,bgL+0.022);
  return {
    bg, surface, surface2, track, text, dim, faint, accent, accent2,
    accentDeep:_hex(aHue,aSat,light?0.52:0.42), btn:bn.btn, onAccent:bn.onAccent,
    glow:`rgba(${_rgbCsv(accent)},${light?0.30:0.45})`,
    border:  light? `rgba(${_rgbCsv(_hex(dHue,0.22,0.28))},.32)` : `rgba(${_rgbCsv(_hex(dHue,0.30,0.62))},.18)`,
    border2: light? `rgba(${_rgbCsv(_hex(dHue,0.24,0.24))},.5)`  : `rgba(${_rgbCsv(_hex(dHue,0.30,0.70))},.32)`,
    warm, good, accentRgb:_rgbCsv(accent), mode: light?"light":"dark",
  };
}
function _themeRule(t){
  if(!t) return "";
  const B="body:not(.theme-light) .storm-hub";
  const PAGE="body:not(.theme-light) .storm-home .view-content,body:not(.theme-light) .storm-home .markdown-reading-view,body:not(.theme-light) .storm-home .markdown-source-view,body:not(.theme-light) .storm-home .cm-editor";
  // ---- COMMUNITY mode: inherit the installed Obsidian theme's own variables ----
  if(t.mode==="community"){
    const m={
      "--bg":"var(--background-primary)","--surface":"var(--background-secondary)",
      "--surface2":"var(--background-secondary-alt,var(--background-secondary))",
      "--track":"var(--background-modifier-form-field,var(--background-modifier-border,var(--background-secondary)))",
      "--text":"var(--text-normal)","--dim":"var(--text-muted)","--faint":"var(--text-faint)",
      "--accent":"var(--interactive-accent)","--accent2":"var(--interactive-accent-hover,var(--interactive-accent))",
      "--accent-deep":"var(--interactive-accent)","--border":"var(--background-modifier-border)",
      "--border2":"var(--background-modifier-border-hover,var(--background-modifier-border))",
      "--btn":"var(--interactive-accent)","--on-accent":"var(--text-on-accent)",
      "--warm":"var(--color-orange,#d08770)","--good":"var(--color-green,#5acaa0)",
      "--glow":"transparent","--accent-rgb":"130,150,190",
    };
    const decls=Object.keys(m).map(k=>`${k}:${m[k]}`).join(";");
    let css=`${B}{${decls}}`;
    // heatmap ramp from the theme's accent (Obsidian exposes accent as H/S/L components)
    const HSL="var(--accent-h),var(--accent-s),var(--accent-l)";
    css+=` ${B} .heat .c.i1{background:hsla(${HSL},.22)} ${B} .heat .c.i2{background:hsla(${HSL},.46)} ${B} .heat .c.i3{background:hsla(${HSL},.72)}`;
    css+=` ${PAGE}{background:var(--background-primary) !important;}`;
    return css;
  }
  // ---- MATCH mode: an explicit palette derived from the banner image ----
  const map={bg:"--bg",surface:"--surface",surface2:"--surface2",track:"--track",border:"--border",border2:"--border2",text:"--text",dim:"--dim",faint:"--faint",accent:"--accent",accent2:"--accent2",accentDeep:"--accent-deep",glow:"--glow",btn:"--btn",onAccent:"--on-accent",accentRgb:"--accent-rgb",warm:"--warm",good:"--good"};
  const decls=Object.keys(map).filter(k=>t[k]).map(k=>`${map[k]}:${t[k]}`).join(";");
  if(!decls) return "";
  let css=`${B}{${decls}}`;
  // heatmap ramp: single-hue tints of the matched accent (base ramp is hardcoded blue)
  if(t.accentRgb) css+=` ${B} .heat .c.i1{background:rgba(${t.accentRgb},.22)} ${B} .heat .c.i2{background:rgba(${t.accentRgb},.46)} ${B} .heat .c.i3{background:rgba(${t.accentRgb},.72)}`;
  if(t.bg) css+=` ${PAGE}{background:${t.bg} !important;}`;
  return css;
}
function _paletteFromImage(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{ try{
      const w=80, h=Math.max(1,Math.round(80*(img.height||1)/(img.width||1)));
      const c=document.createElement("canvas"); c.width=w; c.height=h;
      const ctx=c.getContext("2d"); ctx.drawImage(img,0,0,w,h);
      resolve(_buildTheme(_extract(ctx.getImageData(0,0,w,h).data)));
    }catch(e){ reject(e); } };
    img.onerror=()=>reject(new Error("could not load the banner image"));
    img.src=src;
  });
}

function buildHub(d){
  const NAV = [
    {ic:"⚡",label:"Today",link:null,active:true},
    {ic:"🔥",label:"Habits",link:"🔥 Habit Tracker"},
    {ic:"🚀",label:"Projects",link:"📊 Projects"},
    {ic:"💼",label:"Jobs",link:"💼 Job Search"},
    {ic:"🍽️",label:"Recipes",link:"🍽️ Recipe Index"},
    {ic:"🗓️",label:"Meals",link:"🗓️ Meal Planner"},
    {ic:"🛒",label:"Shopping",link:"🛒 Shopping List"},
    {ic:"➕",label:"Add",link:"➕ Quick Add"},
    {ic:"⚙️",label:"Settings",link:"⚙️ Settings"},
  ];
  const navHtml = NAV.map(n=>`<span class="pill${n.active?" active":""}"${n.link?` data-link="${_esc(n.link)}"`:""}>${n.ic} ${n.label}</span>`).join("")
    + `<span class="pill pill-toggle" data-action="toggle-theme" title="Toggle light / e-ink reading mode">🌓 Theme</span>`;

  const s = d.stats||{};
  const statsHtml = `
    <div class="stat"><div class="n">${s.notes??"—"}</div><div class="l">Notes</div></div>
    <div class="stat"><div class="n">${s.attachments??"—"}</div><div class="l">Attachments</div></div>
    <div class="stat"><div class="n">${s.folders??"—"}</div><div class="l">Folders</div></div>
    <div class="stat"><div class="n">${s.tags??"—"}</div><div class="l">Tags</div></div>
    <div class="stat streak"><div class="n">🔥 ${s.streak??0}</div><div class="l">Day streak</div></div>`;

  // TODAY
  const oneThing = d.oneThing
    ? `<div class="one"><div class="k">🎯 One thing</div><div class="v">${_esc(d.oneThing)}</div></div>`
    : `<div class="one" data-action="open-today" data-today="${_esc(d.todayNoteName||"")}"><div class="k">🎯 One thing</div><div class="v" style="color:var(--dim)">Open today's note to set it →</div></div>`;
  const tasks = d.tasks||[];
  const tasksHtml = tasks.length ? tasks.map(t=>`
      <div class="task${t.done?" done":""}"><span class="box${t.done?" done":""}"${(t.link&&t.line!=null)?` data-toggle-path="${_esc(t.link)}" data-toggle-line="${t.line}"`:""}></span>
        <span class="t"${t.link?` data-link="${_esc(t.link)}"`:""}>${t.tag?`<span class="tag">${_esc(t.tag)}</span>`:""}${_esc(t.text)}${t.due?`<span class="due">${_esc(t.due)}</span>`:""}</span>
        ${(t.link&&t.line!=null)?`<span class="del" data-del-path="${_esc(t.link)}" data-del-line="${t.line}" data-del-text="${_esc(t.text)}" title="Delete this task">✕</span>`:""}</div>`).join("")
    : `<div class="empty">Nothing due yet — add one below or open <b>today's note</b>.</div>`;
  const todayCard = `<div class="card span-4 todaycard">
      <h3>⚡ Today <span class="sp">${tasks.filter(t=>!t.done).length} open</span></h3>
      ${oneThing}<div class="todayscroll">${tasksHtml}</div>
      <div class="addrow"><input class="addinput" type="text" data-add="task" placeholder="Add a task for today…" aria-label="Add a task for today"><button class="addbtn" data-addbtn title="Add task" aria-label="Add task">＋</button></div>
      <div class="cardnote" data-action="open-today" data-today="${_esc(d.todayNoteName||"")}" style="cursor:pointer;color:var(--accent)">📓 Open today's note →</div></div>`;

  // POMODORO — mirrors the Pomodoro Timer plugin's live status-bar timer
  const pm = d.pomodoro||{sessionsToday:0,minutesToday:0,goal:8,task:""};
  const pGoal = pm.goal||8;
  // focus picker: choose a task or habit for "Next up" (persists to today's note)
  const focusVal = pm.task || "";
  const taskOpts = (d.tasks||[]).map(t=>t.text).filter(Boolean);
  const habitOpts = (d.habits && d.habits.rows ? d.habits.rows : []).map(h=>h.label).filter(Boolean);
  const inList = taskOpts.includes(focusVal) || habitOpts.includes(focusVal);
  const optGroup = (arr,label)=> arr.length ? `<optgroup label="${label}">`+arr.map(x=>`<option value="${_esc(x)}"${x===focusVal?" selected":""}>${_esc(x)}</option>`).join("")+`</optgroup>` : "";
  const focusSelect = `<select class="focussel" data-focus aria-label="Set your focus for this session">
        <option value=""${!focusVal?" selected":""}>— pick a focus —</option>
        ${(focusVal && !inList)?`<option value="${_esc(focusVal)}" selected>${_esc(focusVal)}</option>`:""}
        ${optGroup(taskOpts,"Tasks")}${optGroup(habitOpts,"Habits")}
      </select>`;
  // resolve the focus to a source note+line so "Done" can check it off
  let focusRef = null;
  if (focusVal) {
    const mt = (d.tasks||[]).find(t => t.text === focusVal && t.link && t.line!=null);
    if (mt) focusRef = { path: mt.link, line: mt.line, text: mt.text };
    else { const mh = (d.habits && d.habits.rows ? d.habits.rows : []).find(h => h.label === focusVal && h.path && h.line!=null && !h.todayDone); if (mh) focusRef = { path: mh.path, line: mh.line, text: mh.label }; }
  }
  const focusDoneAttrs = focusRef ? ` data-focus-path="${_esc(focusRef.path)}" data-focus-line="${focusRef.line}" data-focus-text="${_esc(focusRef.text)}"` : "";
  const pomoCard = `<div class="card span-4 pomo"${focusDoneAttrs}>
      <h3 style="align-self:flex-start">🍅 Focus <span class="sp">${pm.sessionsToday||0}/${pGoal} today</span></h3>
      <div class="ptask"><span class="plabel">Next up:</span> ${focusSelect}</div>
      <div class="ringwrap">
        <svg width="150" height="150" viewBox="0 0 120 120">
          <defs><linearGradient id="storm-pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--accent-deep)"/><stop offset="1" style="stop-color:var(--accent2)"/></linearGradient></defs>
          <circle class="ring-bg" cx="60" cy="60" r="52"/><circle class="ring-fg" cx="60" cy="60" r="52"/>
        </svg>
        <div class="center"><div class="time pomo-live" style="font-size:32px">--:--</div><div class="ph">FOCUS</div></div>
      </div>
      <div class="pbtns"><button class="pbtn primary" data-action="pomo-start">▶ Start / Pause</button><button class="pbtn done" data-action="pomo-done" title="Finish this focus session early and log it">✓ Done</button><button class="pbtn" data-action="pomo-reset">Reset</button></div>
      <div class="pdots">${pm.sessionsToday||0} 🍅 · ${pm.minutesToday||0} min today · synced with the plugin</div>
    </div>`;

  // CALENDAR
  const c = d.cal||{title:"",first:0,days:30,today:0,has:[],year:null,month:null};
  const hasSet = new Set(c.has||[]);
  const DOW=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  let calCells = "";
  ["S","M","T","W","T","F","S"].forEach(x=>calCells+=`<div class="dow">${x}</div>`);
  for(let i=0;i<c.first;i++) calCells+=`<div class="d mut"></div>`;
  for(let dd=1;dd<=c.days;dd++){
    const cls = "d"+(dd===c.today?" today":"")+(hasSet.has(dd)?" has":"");
    let attr="";
    if(c.year!=null && c.month!=null){
      const mm=String(c.month+1).padStart(2,"0"), dds=String(dd).padStart(2,"0");
      const nm=`${c.year}-${mm}-${dds} ${DOW[new Date(c.year,c.month,dd).getDay()]}`;
      if(dd===c.today) attr=` data-action="open-today" data-today="${_esc(nm)}"`;
      else if(hasSet.has(dd)) attr=` data-action="open-daily" data-name="${_esc(nm)}"`;
    }
    calCells+=`<div class="${cls}"${attr}>${dd}</div>`;
  }
  const calCard = `<div class="card span-4"><h3>🗓️ ${_esc(c.title)}</h3><div class="cal">${calCells}</div></div>`;

  // HABITS
  const h = d.habits||{heat:[],rows:[],weekTodayIdx:5};
  const heatHtml = (h.heat||[]).map(v=>`<div class="c${v?(" i"+v):""}"></div>`).join("");
  const streakHtml = (h.rows||[]).map(r=>{
    const wk = (r.week||[]).map((on,i)=>`<i class="${on?"on":""}${i===h.weekTodayIdx?" today":""}"></i>`).join("");
    const box = (r.path && r.line!=null)
      ? `<span class="box${r.todayDone?" done":""}" data-toggle-path="${_esc(r.path)}" data-toggle-line="${r.line}" title="Toggle for today"></span>`
      : `<span class="box" style="opacity:.35" data-action="open-today" data-today="${_esc(d.todayNoteName||"")}" title="Open today's note to log habits"></span>`;
    return `<div class="strk">${box}<span class="nm" data-action="open-today" data-today="${_esc(d.todayNoteName||"")}">${_esc(r.label)}</span><span class="wk">${wk}</span><span class="f">${r.streak||0}🔥</span></div>`;
  }).join("");
  const habitCard = `<div class="card span-8"><h3>🔥 Habits <span class="sp" data-link="🔥 Habit Tracker">open tracker →</span></h3>
      <div class="heat">${heatHtml||'<div class="empty">Check habits in your daily note to light this up.</div>'}</div>
      <div class="streaks">${streakHtml}</div>
      <div class="addrow"><input class="addinput" type="text" data-add="habit" placeholder="Add a habit (e.g. 🧘 Meditate)…" aria-label="Add a habit"><button class="addbtn" data-addbtn title="Add habit" aria-label="Add habit">＋</button></div></div>`;

  // MUSIC — compact local-audio player card
  const m = d.music;
  const mtracks = (m && m.tracks) ? m.tracks : [];
  let musicCard;
  if (mtracks.length) {
    const first = mtracks[0];
    const tracksJson = _esc(JSON.stringify(mtracks.map(t=>({t:t.title,a:t.artist,s:t.src}))));
    const upRows = mtracks.map((t,i)=>`<div class="uprow" data-track-idx="${i}"><span class="upn">${i+1}</span><span class="upt">${_esc(t.title||"Untitled")}</span>${t.artist?`<span class="upa">${_esc(t.artist)}</span>`:""}</div>`).join("");
    musicCard = `<div class="card span-4 musiccard" data-tracks="${tracksJson}"><h3>🎧 Now playing <span class="sp">${mtracks.length} track${mtracks.length>1?"s":""}</span></h3>
      <div class="music" data-link="🎧 Now Playing"><div class="art">🎵</div><div class="meta">
        <div class="tt">${_esc(first.title||"Untitled")}</div>
        <div class="ar">${_esc(first.artist||"")}</div>
        <div class="bar mbar" data-audio-seek><span class="mfill" style="width:0%"></span></div>
        <div class="mtime"><span class="cur">0:00</span><span class="dur">0:00</span></div>
        <div class="ctrls"><span data-audio="prev" title="Previous">⏮</span><span class="play" data-audio="toggle" title="Play / pause">▶</span><span data-audio="next" title="Next">⏭</span></div>
      </div></div>
      <div class="uphead">Queue</div>
      <div class="uplist">${upRows}</div></div>`;
  } else {
    musicCard = `<div class="card span-4 musiccard"><h3>🎧 Now playing</h3>
      <div class="music" data-link="🎧 Now Playing"><div class="art">🎙️</div><div class="meta">
        <div class="tt">${m&&m.track?_esc(m.track):"Nothing playing"}</div>
        <div class="ar">${m&&m.artist?_esc(m.artist):"Add audio to get started"}</div>
        <div class="bar mbar"><span style="width:0%"></span></div>
        <div class="ctrls"><span>⏮</span><span class="play">▶</span><span>⏭</span></div>
      </div></div>
      <div class="cardnote">Drop <b>.mp3</b> / <b>.m4a</b> files into <b>Audio/</b> to play them here.</div></div>`;
  }

  // PROJECTS + GOALS
  const projs = d.projects||[];
  const projHtml = projs.length ? projs.map(p=>`
      <div class="proj"${p.link?` data-link="${_esc(p.link)}"`:""}><div class="top"><span>${_esc(p.name)}</span><span class="area">${_esc(p.area||"")}</span></div>
        <div class="bar"><span style="width:${p.pct||0}%"></span></div>
        <div class="pct"><span>${_esc(p.sub||"")}</span><span>${p.pct||0}%</span></div></div>`).join("")
    : `<div class="empty">Add projects in <b>Projects/</b> to see progress here.</div>`;
  const goals = d.goals||[];
  const goalHtml = goals.length ? `<div class="goalmeter">`+goals.map(g=>`
      <div class="proj"><div class="top">${_esc(g.name)}<span class="area">${_esc(g.area||"")}</span></div>
        <div class="bar"><span style="width:${g.pct||0}%"></span></div>
        <div class="pct"><span>${_esc(g.sub||"")}</span><span>${g.pct||0}%</span></div></div>`).join("")+`</div>` : "";
  const projCard = `<div class="card span-8"><h3>🚀 Projects <span class="sp">auto-updated from checklists</span></h3>${projHtml}${goalHtml}
      <div class="addrow"><input class="addinput" type="text" data-add="project" placeholder="New project — creates a note in Projects/…" aria-label="Add a project"><button class="addbtn" data-addbtn title="Create project" aria-label="Create project">＋</button></div></div>`;

  // READING
  const books = d.reading||[];
  const booksHtml = books.length ? books.map(b=>{
      const cov = b.coverSrc
        ? `<div class="cov has-img"><img src="${_esc(b.coverSrc)}" alt="${_esc(b.title)}" loading="lazy"></div>`
        : `<div class="cov" style="background:${b.color||"linear-gradient(160deg,#2f6f8a,#12303f)"}">${_esc(b.title)}</div>`;
      return `<div class="book"${b.link?` data-link="${_esc(b.link)}"`:""} title="${_esc(b.title)}">${cov}
        <div class="bar"><span style="width:${b.pct||0}%"></span></div><div class="bp">${b.pct||0}%</div></div>`;
    }).join("")
    : `<div class="empty">Add notes tagged <b>#book</b> with a <b>progress</b> field.</div>`;
  const readCard = `<div class="card span-4"><h3>📚 Reading <span class="sp" data-link="📚 Books">all books →</span></h3><div class="books">${booksHtml}</div></div>`;

  // WORKOUT (today's session from the weekly schedule)
  const w = d.workout || {isRest:true};
  let workoutCard;
  if (w.isRest) {
    workoutCard = `<div class="card span-4 workout rest"><h3>🏋️ Today's workout <span class="sp" data-link="🏋️ Workouts">plan →</span></h3>
      <div class="wrest"><div class="wbig">😴</div><div class="wlab">Rest day</div><div class="wsub">Recover — light mobility &amp; sleep.</div>${w.streak?`<div class="wstreak">🔥 ${w.streak}-day streak</div>`:""}</div></div>`;
  } else {
    const exPrev = (w.exercises||[]).slice(0,6).map(e=>`<div class="wex">${_esc(String(e).split("·")[0].split("—")[0].trim())}</div>`).join("");
    workoutCard = `<div class="card span-4 workout"><h3>🏋️ Today's workout <span class="sp" data-link="🏋️ Workouts">plan →</span></h3>
      <div class="wtop"><span class="wico">${_esc(w.icon||"🏋️")}</span><span class="wname"${w.session?` data-link="${_esc(w.session)}"`:""}>${_esc(w.session||"Workout")}</span>${w.done?`<span class="wdone">✓ done</span>`:""}</div>
      ${(w.focus||w.duration)?`<div class="wmeta">${_esc(w.focus||"")}${(w.focus&&w.duration)?" · ":""}${_esc(w.duration||"")}</div>`:""}
      <div class="wexlist">${exPrev||'<div class="empty">Open the routine for the full session.</div>'}</div>
      <button class="pbtn primary wlog" data-action="log-workout">${w.done?"✓ Logged — open note":"＋ Log in today's note"}</button>
      ${w.streak?`<div class="wstreak">🔥 ${w.streak}-day workout streak</div>`:""}</div>`;
  }

  // JOB SEARCH — mini pipeline widget (mirrors the 💼 Job Search board)
  const J = d.jobs;
  let jobCard;
  if (J && J.total) {
    const st = J.stages||{};
    const pipe = [["🔖",st.saved||0,"Saved"],["📤",st.applied||0,"Applied"],["📞",st.screen||0,"Screen"],["🎤",st.interview||0,"Interview"],["🏁",st.final||0,"Final"],["🎉",st.offer||0,"Offer"]]
      .map(([ic,n,lb])=>`<span class="jpip${n?"":" z"}" title="${lb}: ${n}">${ic}<b>${n}</b></span>`).join("");
    const nextHtml = J.next
      ? `<div class="jc-next"><span class="jc-ni">${_esc(J.next.icon||"⏳")}</span><span class="jc-nl">${_esc(J.next.label)}</span>${J.next.date?`<span class="jc-nd">${_esc(J.next.date)}</span>`:""}</div>`
      : `<div class="jc-next dim">No deadlines set — you're clear.</div>`;
    jobCard = `<div class="card span-4 jobcard"><h3>💼 Job Search <span class="sp" data-link="💼 Job Search">board →</span></h3>
      <div class="jc-nums"><div class="jc-num"><b>${J.active||0}</b><span>active</span></div><div class="jc-num"><b>${J.interviewing||0}</b><span>interviewing</span></div><div class="jc-num${J.offers?" hot":""}"><b>${J.offers||0}</b><span>offer${J.offers===1?"":"s"}</span></div></div>
      <div class="jc-pipe">${pipe}</div>
      ${nextHtml}
      <div class="addrow"><input class="addinput" type="text" data-add="jobapp" placeholder="Add application — “Company — Role”…" aria-label="Add application"><button class="addbtn" data-addbtn title="Add application" aria-label="Add application">＋</button></div></div>`;
  } else {
    jobCard = `<div class="card span-4 jobcard"><h3>💼 Job Search <span class="sp" data-link="💼 Job Search">board →</span></h3>
      <div class="empty">Track your search here — add your first application and it appears on the <b>board</b>.</div>
      <div class="addrow"><input class="addinput" type="text" data-add="jobapp" placeholder="Add application — “Company — Role”…" aria-label="Add application"><button class="addbtn" data-addbtn title="Add application" aria-label="Add application">＋</button></div></div>`;
  }

  // ALL NOTES (searchable linked index) + new-note creator
  const notes = d.notes||[];
  const noteRows = notes.map(n=>`<div class="noterow" data-link="${_esc(n.path)}"><span class="nnm">${_esc(n.name)}</span>${n.folder?`<span class="nfold">${_esc(n.folder)}</span>`:""}</div>`).join("");
  const notesCard = `<div class="card span-8 notescard"><h3>🗂️ Notes <span class="sp">${notes.length} total</span></h3>
      <div class="addrow"><input class="addinput" type="text" data-add="quicknote" placeholder="New note — creates from your Quick Note template…" aria-label="Create a new note"><button class="addbtn" data-addbtn title="Create note" aria-label="Create note">＋</button></div>
      <input class="addinput notesearch" type="text" data-notesearch placeholder="🔍 Filter notes…" aria-label="Filter notes">
      <div class="notescroll">${noteRows||'<div class="empty">No notes yet.</div>'}</div></div>`;

  // MINI GRAPH VIEW
  const G = d.graph || {nodes:[],links:[]};
  let graphCard;
  if (G.nodes && G.nodes.length) {
    const pos = _layoutGraph(G);
    const maxDeg = Math.max(1, ...G.nodes.map(n=>n.deg||0));
    const edges = G.links.map(l=>{ const a=pos[l.s], b=pos[l.t]; return (a&&b)?`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`:""; }).join("");
    const nodesSvg = G.nodes.map((n,i)=>{ const r=(3+(n.deg/maxDeg)*7).toFixed(1); const major=(n.deg/maxDeg>0.42)||i<6; return `<g class="gn ${major?'major':'minor'}" data-link="${_esc(n.id)}" transform="translate(${pos[i].x.toFixed(1)},${pos[i].y.toFixed(1)})"><circle r="${r}"></circle><text x="${(parseFloat(r)+3).toFixed(1)}" y="3.2">${_esc(n.label)}</text></g>`; }).join("");
    graphCard = `<div class="card span-4 graphcard"><h3>🕸️ Graph <span class="sp" data-action="open-graph">full →</span></h3>
      <div class="graphwrap"><svg viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid meet"><g class="edges">${edges}</g><g class="gnodes">${nodesSvg}</g></svg></div></div>`;
  } else {
    graphCard = `<div class="card span-4 graphcard"><h3>🕸️ Graph <span class="sp" data-action="open-graph">full →</span></h3><div class="empty">Link notes together with [[wikilinks]] to see your graph take shape.</div></div>`;
  }

  // theme: community mapping (default), or a cached match palette; a stale match computes async in initHub
  const _mode = (d.mode==="match") ? "match" : "community";
  const _themeObj = _mode==="community" ? {mode:"community"} : (d.theme||null);
  const _needsCompute = _mode==="match" && !d.theme && !!d.matchSrc;
  const _matchAttrs = _needsCompute ? ` data-match-src="${_esc(d.matchSrc)}" data-match-bpath="${_esc(d.matchBannerPath||"")}"` : "";
  const _matchedAttr = (_mode==="community" || (_mode==="match" && !!d.theme)) ? ' data-matched="1"' : '';

  return `<div class="storm-hub" data-today-path="${_esc(d.todayPath||"")}" data-today-iso="${_esc(d.todayIso||"")}" data-today-name="${_esc(d.todayNoteName||"")}" data-template-path="${_esc(d.templatePath||"")}" data-workout-session="${_esc(w.isRest?"":(w.session||""))}" data-workout-routine="${_esc(w.routinePath||"")}" data-self-path="${_esc(d.selfPath||"")}" data-mode="${_mode}"${_matchAttrs}${_matchedAttr}>
    <style class="storm-theme-css">${_themeRule(_themeObj)}</style>
    <div class="navpills">${navHtml}</div>
    <div class="stats">${statsHtml}</div>
    <div class="hub-grid">
      <div class="banner">
        ${d.bannerSrc?`<img class="banner-img" src="${d.bannerSrc}" alt="banner">`:""}
        <div class="scrim"></div>
        <div class="greet">
          <div class="g"><span class="js-greet">Good evening</span>, ${_esc(d.name||"")} ⚔️</div>
          <div class="clock"><span class="js-clock">00:00</span><span class="secs js-secs">00</span></div>
          <div class="date js-date"></div>
        </div>
      </div>
      ${pomoCard}${todayCard}${calCard}${habitCard}${workoutCard}${jobCard}${projCard}${notesCard}${readCard}${graphCard}${musicCard}
    </div>
  </div>`;
}

function initHub(root){
  if(!root) return;
  const g = (typeof window!=="undefined")?window:globalThis;

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
    function getTimer(){ try{ const pl=(g.app&&g.app.plugins&&g.app.plugins.plugins)?g.app.plugins.plugins["pomodoro-timer"]:null; return (pl&&pl.timer)?pl.timer:null; }catch(e){ return null; } }
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
        try{ if(g.app&&g.app.commands){ g.app.commands.executeCommandById("pomodoro-timer:toggle-timer"); return; } }catch(e){}
        try{ if(typeof require!=="undefined"){ const ob=require("obsidian"); new ob.Notice("Enable the Pomodoro Timer plugin to use the timer.",6000); } }catch(e){}
      });
    });
    root.querySelectorAll('[data-action="pomo-reset"]').forEach(btn=>{
      btn.style.cursor="pointer";
      btn.addEventListener("click",()=>{
        const t=getTimer();
        if(t&&typeof t.reset==="function"){ t.reset(); return; }
        try{ if(g.app&&g.app.commands) g.app.commands.executeCommandById("pomodoro-timer:reset-timer"); }catch(e){}
      });
    });
    // ---- Done (finish focus early + check off the task)  /  Skip break ----
    function pomoNotice(msg){ try{ if(typeof require!=="undefined"){ const ob=require("obsidian"); new ob.Notice(msg,4000); } }catch(e){} }
    async function markFocusDone(path, line, text){
      try{
        if(!g.app||!g.app.vault||!path) return;
        const f=g.app.vault.getAbstractFileByPath(path); if(!f) return;
        const lines=(await g.app.vault.read(f)).split("\n");
        const isBox=l=>/^\s*[-*]\s*\[[ xX]\]/.test(l||"");
        const norm=s=>String(s||"").replace(/\s+/g," ").trim().toLowerCase();
        let target=line;
        if(!isBox(lines[target]) || (text && norm(lines[target]).indexOf(norm(text))<0)){
          target = lines.findIndex(l=>isBox(l) && text && norm(l).indexOf(norm(text))>=0);
        }
        if(target<0||!isBox(lines[target])) return;
        let ln=lines[target];
        if(/\[[xX]\]/.test(ln)) return; // already done
        ln=ln.replace(/\[\s\]/,"[x]");
        if(!/✅/.test(ln)){ const dt=new Date(); ln=ln.replace(/\s*$/,"")+" ✅ "+dt.getFullYear()+"-"+_two(dt.getMonth()+1)+"-"+_two(dt.getDate()); }
        lines[target]=ln;
        await g.app.vault.modify(f, lines.join("\n"));
      }catch(e){ console.error("markFocusDone", e); }
    }
    root.querySelectorAll('[data-action="pomo-done"]').forEach(btn=>{
      btn.style.cursor="pointer";
      btn.addEventListener("click", async ()=>{
        const t=getTimer();
        if(!t){ pomoNotice("Enable the Pomodoro Timer plugin to use the timer."); return; }
        const st=lastState||{};
        // in a BREAK → skip it (switch to work, ready; nothing logged)
        if(st.mode==="BREAK"){
          if(typeof t.toggleMode==="function"){ try{ t.toggleMode(); }catch(e){ console.error(e); } }
          else if(typeof t.reset==="function"){ t.reset(); }
          return;
        }
        // in a focus session → finish it early
        const active = st.inSession || (st.elapsed>0) || st.running;
        if(!active){ pomoNotice("Start a focus session first, then hit Done to finish it early."); return; }
        if(typeof t.timeup!=="function"){ pomoNotice("This Pomodoro Timer version doesn't support finishing early."); return; }
        // check off the focus task / habit, if one was set
        const pomoEl=btn.closest(".pomo");
        const fp=pomoEl?pomoEl.getAttribute("data-focus-path"):null;
        const fl=pomoEl?parseInt(pomoEl.getAttribute("data-focus-line"),10):NaN;
        const ft=pomoEl?(pomoEl.getAttribute("data-focus-text")||""):"";
        if(fp && !isNaN(fl)){ await markFocusDone(fp, fl, ft); }
        // clear the focus so "Next up" is ready for the next cycle
        try{ const tp=root.getAttribute("data-today-path"); if(tp && g.app.fileManager && g.app.fileManager.processFrontMatter){ const tf=g.app.vault.getAbstractFileByPath(tp); if(tf) await g.app.fileManager.processFrontMatter(tf, fm=>{ delete fm.focus; }); } }catch(e){}
        // complete the pomodoro (logs it, rolls to break)
        try{ t.timeup(); }catch(e){ console.error("pomo done", e); pomoNotice("Couldn't finish the session: "+e.message); return; }
        setTimeout(()=>{ try{ if(g.app&&g.app.metadataCache) g.app.metadataCache.trigger("dataview:refresh-views"); }catch(e){} }, 1600);
      });
    });
  })();

  // ---- internal navigation (Obsidian only) ----
  root.querySelectorAll("[data-link]").forEach(el=>{
    el.style.cursor="pointer";
    el.addEventListener("click",ev=>{
      ev.preventDefault();
      const link=el.getAttribute("data-link");
      if(g.app&&g.app.workspace&&link) g.app.workspace.openLinkText(link,"",false);
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
      try{ if(g.app){ g.app.vault.setConfig("theme", dark?"moonstone":"obsidian"); g.app.workspace.trigger("css-change"); } }catch(e){}
    });
  });

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
        const p = root.getAttribute("data-self-path");
        if(p && g.app){ const f=g.app.vault.getAbstractFileByPath(p);
          if(f) await g.app.fileManager.processFrontMatter(f, fm=>{ fm.stormTheme=JSON.stringify(pal); fm.stormThemeSrc=bpath; }); }
      }catch(e){ console.error("storm match compute", e); }
    })();
  })();

  // ---- open Obsidian's full graph view ----
  root.querySelectorAll('[data-action="open-graph"]').forEach(el=>{
    el.style.cursor="pointer";
    el.addEventListener("click",ev=>{
      ev.preventDefault(); ev.stopPropagation();
      try{ if(g.app&&g.app.commands) g.app.commands.executeCommandById("graph:open"); }catch(e){}
    });
  });

  // ---- open/create TODAY's daily note WITH the template (not a blank wikilink) ----
  root.querySelectorAll('[data-action="open-today"]').forEach(el=>{
    el.style.cursor="pointer";
    el.addEventListener("click",ev=>{
      ev.preventDefault(); ev.stopPropagation();
      if(!g.app) return;
      try{
        const cmds=(g.app.commands&&g.app.commands.commands)?g.app.commands.commands:{};
        const id = cmds["daily-notes"] ? "daily-notes"
          : Object.keys(cmds).find(k=>/daily-notes/i.test(k)&&/(today|open)/i.test(k))
          || Object.keys(cmds).find(k=>/daily-notes/i.test(k));
        if(id){ g.app.commands.executeCommandById(id); return; }
      }catch(e){}
      try{ const link=el.getAttribute("data-today")||""; if(link&&g.app.workspace) g.app.workspace.openLinkText(link,"",false); }catch(e){}
    });
  });
  // ---- open a specific existing day's note ----
  root.querySelectorAll('[data-action="open-daily"]').forEach(el=>{
    el.style.cursor="pointer";
    el.addEventListener("click",ev=>{
      ev.preventDefault(); ev.stopPropagation();
      if(!g.app||!g.app.workspace) return;
      const nm=el.getAttribute("data-name")||"";
      if(nm) g.app.workspace.openLinkText(nm,"",false);
    });
  });

  // ---- functional checkboxes: toggle the real checkbox on the source note's line ----
  async function toggleLine(path, line, boxEl){
    try{
      if(!g.app||!g.app.vault) return;
      const file=g.app.vault.getAbstractFileByPath(path);
      if(!file) return;
      const content=await g.app.vault.read(file);
      const lines=content.split("\n");
      if(line<0||line>=lines.length) return;
      let ln=lines[line];
      if(!/\[[ xX]\]/.test(ln)) return;           // not a checkbox line — bail
      const done=/\[[xX]\]/.test(ln);
      if(done){
        ln=ln.replace(/\[[xX]\]/,"[ ]").replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/,"");
      } else {
        ln=ln.replace(/\[\s\]/,"[x]");
        if(!/✅/.test(ln)){ const dt=new Date(); ln=ln.replace(/\s*$/,"")+" ✅ "+dt.getFullYear()+"-"+_two(dt.getMonth()+1)+"-"+_two(dt.getDate()); }
      }
      lines[line]=ln;
      await g.app.vault.modify(file, lines.join("\n"));
      if(boxEl){ boxEl.classList.toggle("done", !done); const td=boxEl.closest(".task"); if(td) td.classList.toggle("done", !done); }
    }catch(e){}
  }
  root.querySelectorAll("[data-toggle-path]").forEach(box=>{
    box.style.cursor="pointer";
    box.addEventListener("click",ev=>{
      ev.preventDefault(); ev.stopPropagation();
      const path=box.getAttribute("data-toggle-path"); const line=parseInt(box.getAttribute("data-toggle-line"),10);
      if(path && !isNaN(line)) toggleLine(path, line, box);
    });
  });

  // ---- inline ADD (task / habit / project) & DELETE task → write straight to the notes ----
  (function(){
    if(typeof document==="undefined" || !g.app) return;
    const sleep = ms => new Promise(r=>setTimeout(r,ms));
    const tPath   = root.getAttribute("data-today-path")||"";
    const tIso    = root.getAttribute("data-today-iso")||"";
    const tplPath = root.getAttribute("data-template-path")||"";
    const isBox   = l => /^\s*[-*]\s*\[[ xX]\]/.test(l||"");
    const isEmptyBox = l => /^\s*[-*]\s*\[[ xX]\]\s*$/.test(l||"");
    const refresh = () => { try{ g.app.metadataCache.trigger("dataview:refresh-views"); }catch(e){} };

    async function getToday(){
      if(!g.app.vault||!tPath) return null;
      let f = g.app.vault.getAbstractFileByPath(tPath);
      if(f) return f;
      try{ if(g.app.commands) g.app.commands.executeCommandById("daily-notes"); }catch(e){}
      for(let i=0;i<14;i++){ await sleep(160); f=g.app.vault.getAbstractFileByPath(tPath); if(f) return f; }
      return g.app.vault.getAbstractFileByPath(tPath);
    }
    // insert `line` into the section whose heading matches sectionRe, after its last real checkbox
    function insertInSection(lines, sectionRe, line){
      const h = lines.findIndex(l=>sectionRe.test(l));
      if(h<0){ lines.push("", line); return lines.length-1; }
      let last=-1, lastFull=-1;
      for(let j=h+1;j<lines.length;j++){
        if(/^#{1,6}\s/.test(lines[j])) break;
        if(isBox(lines[j])){ last=j; if(!isEmptyBox(lines[j])) lastFull=j; }
      }
      const at = (lastFull>=0?lastFull:(last>=0?last:h)) + 1;
      lines.splice(at,0,line);
      return at;
    }

    async function addTask(text){
      const f = await getToday(); if(!f){ notice("Open today's note first, then add tasks."); return; }
      const lines = (await g.app.vault.read(f)).split("\n");
      insertInSection(lines, /^##\s*⚡/, "- [ ] " + text.trim() + (tIso?(" 📅 "+tIso):""));
      await g.app.vault.modify(f, lines.join("\n"));
      refresh();
    }
    async function addHabit(label){
      label = label.trim(); if(!label) return;
      let slug = label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g,"-").slice(0,28) || "habit";
      const line = "- [ ] " + label + " #habit/" + slug;
      const f = await getToday();
      if(f){ const lines=(await g.app.vault.read(f)).split("\n"); insertInSection(lines,/^##\s*🔥/,line); await g.app.vault.modify(f,lines.join("\n")); }
      if(tplPath){ const tf=g.app.vault.getAbstractFileByPath(tplPath);
        if(tf){ const tl=(await g.app.vault.read(tf)).split("\n"); insertInSection(tl,/^##\s*🔥/,line); await g.app.vault.modify(tf,tl.join("\n")); } }
      notice("Added “"+label+"”. It's now in today's note and future daily notes.");
      refresh();
    }
    async function addProject(name){
      name = name.trim(); if(!name) return;
      const safe = name.replace(/[\\/:*?"<>|#^\[\]]/g,"").trim() || "Untitled project";
      let path = "Projects/"+safe+".md";
      if(g.app.vault.getAbstractFileByPath(path)) path = "Projects/"+safe+" 2.md";
      const body = "---\ntype: project\nstatus: active\narea: \nannual: false\n---\n\n# "+safe+"\n\n> New project created from your dashboard. Add milestones as checkboxes — the hub tracks % done automatically.\n\n## Milestones\n- [ ] First milestone\n";
      try{ const nf=await g.app.vault.create(path, body); refresh(); if(g.app.workspace) g.app.workspace.openLinkText(nf.path,"",false); }
      catch(e){ notice("Couldn't create the project note: "+e.message); }
    }
    async function addQuickNote(title){
      title = (title||"").trim();
      let base = title.replace(/[\\/:*?"<>|#^\[\]]/g,"").trim();
      if(!base) base = "Note " + (tIso || "");
      let path = "Note Bank/"+base+".md";
      if(g.app.vault.getAbstractFileByPath(path)) path = "Note Bank/"+base+" 2.md";
      const body = "---\ndate: "+(tIso||"")+"\ntags:\n  - note\ntype: note\nstatus: inbox\ntopic: \nsource: \n---\n\n# "+base+"\n\n";
      try{ const nf=await g.app.vault.create(path, body); refresh(); if(g.app.workspace) g.app.workspace.openLinkText(nf.path,"",false); }
      catch(e){ notice("Couldn't create the note: "+e.message); }
    }
    async function ensureFolder(p){ if(!g.app.vault.getAbstractFileByPath(p)){ try{ await g.app.vault.createFolder(p); }catch(e){} } }
    async function addJobApp(text){
      text = (text||"").trim(); if(!text) return;
      let company = text, role = "";
      const m = text.split(/\s+[—–-]\s+/);
      if(m.length>=2){ company=m[0].trim(); role=m.slice(1).join(" — ").trim(); }
      const safe = (company + (role?" — "+role:"")).replace(/[\\/:*?"<>|#^\[\]]/g,"").trim() || "Untitled application";
      await ensureFolder("Job Search"); await ensureFolder("Job Search/Applications");
      let path = "Job Search/Applications/"+safe+".md";
      if(g.app.vault.getAbstractFileByPath(path)) path = "Job Search/Applications/"+safe+" "+Date.now()+".md";
      const body = "---\ntags:\n  - application\ncompany: "+JSON.stringify(company)+"\nrole: "+JSON.stringify(role)+"\nstatus: saved\napplied: \ndeadline: \nlink: \nlocation: \nremote: \nsalary: \nsource: \ncontact: \nresume: \ncoverletter: \nnext: \npriority: \n---\n\n# "+safe+"\n\n> Set **status** (saved → applied → screen → interview → final → offer) and the properties above — your [[💼 Job Search]] board updates automatically. Pull materials from [[📎 Application Materials]].\n\n## 📝 Job description\n\n\n## 🎤 Interviews & timeline\n- \n\n## 🗒️ Notes\n- \n";
      try{ const nf=await g.app.vault.create(path, body); refresh(); if(g.app.workspace) g.app.workspace.openLinkText(nf.path,"",false); }
      catch(e){ notice("Couldn't create the application note: "+e.message); }
    }
    async function logWorkout(){
      const sess = root.getAttribute("data-workout-session")||"";
      const rp = root.getAttribute("data-workout-routine")||"";
      const f = await getToday(); if(!f){ notice("Open today's note first."); return; }
      const content = await g.app.vault.read(f);
      if(/#workout\b/.test(content)){ if(g.app.workspace) g.app.workspace.openLinkText(f.path,"",false); return; }  // already logged today
      // pull the routine's Session checklist
      let exLines = [];
      if(rp){ const rf=g.app.vault.getAbstractFileByPath(rp);
        if(rf){ const txt=await g.app.vault.read(rf); const seg=(txt.split(/##\s*Session[^\n]*\n/i)[1]||""); const body=seg.split(/\n#{1,6}\s/)[0];
          exLines=[...body.matchAll(/^\s*[-*]\s*\[[ xX]\]\s*(.+)$/gm)].map(m=>"- [ ] "+m[1].trim()); } }
      const block = ["**"+(sess||"Workout")+"** — "+(tIso||""), "- [ ] 🏋️ "+(sess||"Workout")+" done #workout", ...exLines, ""];
      let lines = content.split("\n");
      let h = lines.findIndex(l=>/^##\s*🏋️/.test(l));
      if(h<0){ let at = lines.findIndex(l=>/^##\s*📝/.test(l)); if(at<0) at=lines.length; lines.splice(at,0,"## 🏋️ Workout","",...block,""); }
      else { let end=h+1; while(end<lines.length && !/^##\s/.test(lines[end])) end++; lines.splice(end,0,...block); }
      await g.app.vault.modify(f, lines.join("\n"));
      refresh();
      if(g.app.workspace) g.app.workspace.openLinkText(f.path,"",false);
    }
    function notice(msg){ try{ if(typeof require!=="undefined"){ const ob=require("obsidian"); new ob.Notice(msg,5000); } }catch(e){} }

    async function submitAdd(inp){
      const kind=inp.getAttribute("data-add"); const v=inp.value.trim(); if(!v) return;
      inp.disabled=true; inp.classList.add("busy");
      try{
        if(kind==="task") await addTask(v);
        else if(kind==="habit") await addHabit(v);
        else if(kind==="project") await addProject(v);
        else if(kind==="quicknote") await addQuickNote(v);
        else if(kind==="jobapp") await addJobApp(v);
      }catch(e){ console.error("storm add", e); notice("Something went wrong: "+e.message); }
      inp.value=""; inp.disabled=false; inp.classList.remove("busy");
      if(kind==="task"||kind==="habit"){ try{ inp.focus(); }catch(e){} }
    }
    root.querySelectorAll("input[data-add]").forEach(inp=>{
      inp.addEventListener("click",ev=>ev.stopPropagation());
      inp.addEventListener("keydown", ev=>{
        if(ev.key==="Escape"){ inp.value=""; inp.blur(); return; }
        if(ev.key!=="Enter") return;
        ev.preventDefault(); ev.stopPropagation(); submitAdd(inp);
      });
    });
    // submit buttons (so every field works by tap on phone/tablet, no keyboard needed)
    root.querySelectorAll("[data-addbtn]").forEach(btn=>{
      btn.addEventListener("click", ev=>{
        ev.preventDefault(); ev.stopPropagation();
        const inp = btn.parentElement ? btn.parentElement.querySelector("input[data-add]") : null;
        if(inp) submitAdd(inp);
      });
    });

    // pomodoro focus picker → save chosen task/habit to today's note (persists across refreshes/devices)
    root.querySelectorAll("select[data-focus]").forEach(sel=>{
      sel.addEventListener("click", ev=>ev.stopPropagation());
      sel.addEventListener("change", async ()=>{
        const val = sel.value;
        const f = await getToday(); if(!f){ notice("Open today's note first to set a focus."); return; }
        try{
          if(g.app.fileManager && g.app.fileManager.processFrontMatter){
            await g.app.fileManager.processFrontMatter(f, fm=>{ if(val) fm.focus = val; else delete fm.focus; });
          } else {
            let c = await g.app.vault.read(f);
            if(/^---\r?\n[\s\S]*?\r?\n---/.test(c)){
              if(/^focus:.*$/m.test(c)) c = c.replace(/^focus:.*$/m, "focus: " + JSON.stringify(val));
              else c = c.replace(/^(---\r?\n)/, "$1focus: " + JSON.stringify(val) + "\n");
            } else { c = "---\nfocus: " + JSON.stringify(val) + "\n---\n" + c; }
            await g.app.vault.modify(f, c);
          }
        }catch(e){ console.error("focus", e); notice("Couldn't save the focus: " + e.message); }
        refresh();
      });
    });

    async function deleteLine(path, line, text){
      try{
        const f=g.app.vault.getAbstractFileByPath(path); if(!f) return false;
        const lines=(await g.app.vault.read(f)).split("\n");
        const norm=s=>String(s||"").replace(/\s+/g," ").trim().toLowerCase();
        let target=line;
        if(!isBox(lines[target]) || (text && norm(lines[target]).indexOf(norm(text))<0)){
          target = lines.findIndex(l=>isBox(l) && text && norm(l).indexOf(norm(text))>=0);
        }
        if(target<0 || !isBox(lines[target])) return false;
        lines.splice(target,1);
        await g.app.vault.modify(f, lines.join("\n"));
        return true;
      }catch(e){ return false; }
    }
    root.querySelectorAll("[data-del-path]").forEach(x=>{
      x.style.cursor="pointer";
      x.addEventListener("click", async ev=>{
        ev.preventDefault(); ev.stopPropagation();
        const path=x.getAttribute("data-del-path"); const line=parseInt(x.getAttribute("data-del-line"),10); const text=x.getAttribute("data-del-text")||"";
        const row=x.closest(".task"); if(row){ row.style.opacity=".3"; row.style.pointerEvents="none"; }
        const ok=(path&&!isNaN(line)) ? await deleteLine(path,line,text) : false;
        if(ok){ if(row) row.remove(); refresh(); }
        else if(row){ row.style.opacity=""; row.style.pointerEvents=""; notice("Couldn't find that task line to delete — it may have moved."); }
      });
    });

    // ---- log today's workout into the daily note ----
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
  })();

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
    let A = g.__stormAudio;
    if(!A){ A = g.__stormAudio = new Audio(); A.preload="metadata"; }
    if(g.__stormAudioSig !== sig){ g.__stormAudioSig=sig; g.__stormAudioIdx=0; try{ A.pause(); }catch(e){} try{ A.src=tracks[0].s; }catch(e){} }
    let idx = g.__stormAudioIdx||0; if(idx>=tracks.length) idx=0;
    const fmt = s => { s=Math.max(0,Math.floor(s||0)); return Math.floor(s/60)+":"+_two(s%60); };
    function markCurrent(){ card.querySelectorAll(".uprow").forEach(r=>r.classList.toggle("cur", parseInt(r.getAttribute("data-track-idx"),10)===idx)); }
    function paintTrack(){ const t=tracks[idx]||{}; if(ttEl)ttEl.textContent=t.t||"Untitled"; if(arEl)arEl.textContent=t.a||""; markCurrent(); }
    function paintTime(){ const d=A.duration||0,c=A.currentTime||0; if(fillEl)fillEl.style.width=(d?Math.min(100,c/d*100):0)+"%"; if(curEl)curEl.textContent=fmt(c); if(durEl)durEl.textContent=d?fmt(d):"0:00"; }
    function paintPlay(){ if(playBtn)playBtn.textContent=A.paused?"▶":"⏸"; card.classList.toggle("playing",!A.paused); }
    function loadIdx(i,autoplay){ idx=((i%tracks.length)+tracks.length)%tracks.length; g.__stormAudioIdx=idx; try{ A.src=tracks[idx].s; }catch(e){} paintTrack(); if(autoplay) A.play().catch(()=>{}); paintPlay(); }
    paintTrack(); paintTime(); paintPlay();
    // rebind persistent-audio listeners to THIS render's DOM
    if(g.__stormAudioH){ const h=g.__stormAudioH; A.removeEventListener("timeupdate",h.t); A.removeEventListener("play",h.p); A.removeEventListener("pause",h.pa); A.removeEventListener("ended",h.e); A.removeEventListener("loadedmetadata",h.m); }
    const H={ t:paintTime, p:paintPlay, pa:paintPlay, e:()=>{ if(tracks.length>1) loadIdx(idx+1,true); else paintPlay(); }, m:paintTime };
    A.addEventListener("timeupdate",H.t); A.addEventListener("play",H.p); A.addEventListener("pause",H.pa); A.addEventListener("ended",H.e); A.addEventListener("loadedmetadata",H.m);
    g.__stormAudioH=H;
    if(playBtn) playBtn.onclick=e=>{ e.preventDefault(); e.stopPropagation(); if(A.paused){ if(!A.src) A.src=tracks[idx].s; A.play().catch(()=>{}); } else A.pause(); };
    card.querySelectorAll('[data-audio="prev"]').forEach(b=>b.onclick=e=>{ e.preventDefault(); e.stopPropagation(); loadIdx(idx-1, !A.paused); });
    card.querySelectorAll('[data-audio="next"]').forEach(b=>b.onclick=e=>{ e.preventDefault(); e.stopPropagation(); loadIdx(idx+1, !A.paused); });
    if(seekEl) seekEl.onclick=e=>{ e.stopPropagation(); const r=seekEl.getBoundingClientRect(); const p=(e.clientX-r.left)/Math.max(1,r.width); if(A.duration) A.currentTime=Math.max(0,Math.min(1,p))*A.duration; };
    card.querySelectorAll(".uprow[data-track-idx]").forEach(row=>{ row.onclick=e=>{ e.stopPropagation(); const i=parseInt(row.getAttribute("data-track-idx"),10); if(!isNaN(i)) loadIdx(i,true); }; });
  })();
}

if(typeof module!=="undefined") module.exports={buildHub,initHub,_two};


/* ===================== live data ===================== */
const now = new Date();
const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const localIso = d => `${d.getFullYear()}-${_two(d.getMonth()+1)}-${_two(d.getDate())}`;
const todayIso = localIso(now);

// this note's own frontmatter → banner choice + theme mode/cache (all set from the Settings note)
let _selfFm = {};
try { const _self = app.vault.getAbstractFileByPath(dv.current().file.path); _selfFm = (app.metadataCache.getFileCache(_self) || {}).frontmatter || {}; } catch(e){}

// banner image — chosen in Settings (stormBanner), else first in Images/Banner/, else the bundled default
let bannerSrc = "", bannerPath = "";
try {
  const IMGEXT = ["png","jpg","jpeg","webp","gif","avif","bmp"];
  let bf = null;
  if (_selfFm.stormBanner) bf = app.vault.getAbstractFileByPath(String(_selfFm.stormBanner));
  if (!bf) bf = app.vault.getFiles()
        .filter(f => f.path.startsWith("Images/Banner/") && IMGEXT.includes((f.extension||"").toLowerCase()))
        .sort((a,b) => a.name.localeCompare(b.name))[0]
    || app.vault.getAbstractFileByPath("Images/System Images/storm-banner.png")
    || app.metadataCache.getFirstLinkpathDest("storm-banner","");
  if (bf) { bannerPath = bf.path; try { bannerSrc = app.vault.adapter.getResourcePath(bf.path); } catch(e2){ bannerSrc = app.vault.getResourcePath(bf); } }
} catch(e){ console.error("banner", e); }

// theme mode — "community" (inherit the installed Obsidian theme, default) or "match" (palette from the banner).
// match caches its computed palette in stormTheme + stormThemeSrc; a banner change invalidates it and initHub recomputes.
let themeMode = "community", theme = null, matchSrc = "", matchBannerPath = "";
try {
  themeMode = (_selfFm.stormMode === "match") ? "match" : "community";
  if (themeMode === "match") {
    if (_selfFm.stormTheme && _selfFm.stormThemeSrc === bannerPath) { try { theme = JSON.parse(_selfFm.stormTheme); } catch(e){} }
    if (!theme) { matchSrc = bannerSrc; matchBannerPath = bannerPath; }
  }
} catch(e){ console.error("theme", e); }

// resolve a book's cover → resource URL (Cover frontmatter, or Reading/Covers/<name>.<ext> by convention)
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

// paths the hub writes back to (add task / habit / project)
const templatePath = "_templates/Daily Note Template.md";

// daily notes → streak + calendar dots
const daily = dv.pages('"Daily"');
const isoOf = p => { try { return p.date ? p.date.toISODate() : p.file.name.slice(0,10); } catch(e){ return p.file.name.slice(0,10); } };
const dset = new Set(daily.map(p => isoOf(p)));
let streak = 0; { const dd = new Date(now); dd.setHours(0,0,0,0); if(!dset.has(localIso(dd))) dd.setDate(dd.getDate()-1); while(dset.has(localIso(dd))){ streak++; dd.setDate(dd.getDate()-1); } }

// stats
const mdCount = app.vault.getMarkdownFiles().length;
const allCount = app.vault.getFiles().length;
let folders = 0; try { folders = app.vault.getAllLoadedFiles().filter(f => f && f.children !== undefined).length - 1; } catch(e){}
let tagCount = 0; try { tagCount = Object.keys(app.metadataCache.getTags()).length; } catch(e){}
const stats = { notes: mdCount, attachments: Math.max(0, allCount - mdCount), folders: Math.max(0, folders), tags: tagCount, streak };

// today's note (loaded once) → one thing + pomodoro session count
const todayName = todayIso + " " + days[now.getDay()];
let todayTxt = "";
try { const tpn = daily.find(p => p.file.name === todayName); if (tpn) todayTxt = await dv.io.load(tpn.file.path) || ""; } catch(e){}
let oneThing = null;
try { const seg = todayTxt.split(/##\s*🎯[^\n]*\n/)[1]; if (seg) { const body = seg.split(/\n#{2,3}\s/)[0]; const mm = body.match(/→\s*(\S.*)/); if (mm) oneThing = mm[1].trim(); } } catch(e){}
let pomSessions = 0, pomMinutes = 0;
try {
  let mm = [...todayTxt.matchAll(/WORK\s*\(\s*(\d+)\s*m\)/gi)];
  if (!mm.length) mm = [...todayTxt.matchAll(/pomodoro\s*::\s*WORK[^)]*\)\s*\(\s*duration\s*::\s*(\d+)\s*m/gi)];
  pomSessions = mm.length;
  pomMinutes = mm.reduce((a,x)=>a+(parseInt(x[1])||0),0);
} catch(e){}

// today's tasks (due / scheduled on or before today)
let tasks = [];
try {
  const when = t => t.due || t.scheduled || t.start;
  let raw = dv.pages().file.tasks.where(t => !t.completed && when(t) && dv.date(when(t)) <= dv.date(todayIso)).array();
  raw.sort((a,b) => { const wa = dv.date(when(a)), wb = dv.date(when(b)); return (wb?wb.toMillis():0) - (wa?wa.toMillis():0); });
  tasks = raw.slice(0,40).map(t => {
    let text = (t.text||"").replace(/[📅⏳🛫✅➕⏫🔼🔽⏬🔁]\s*/gu,"").replace(/\d{4}-\d{2}-\d{2}/g,"").replace(/#[\w\/\-]+/g,"").replace(/\s+/g," ").trim();
    const tag = (t.tags && t.tags.length) ? t.tags[0] : "";
    const w = when(t); const due = w ? ("due " + dv.date(w).toFormat("MMM d")) : "";
    return { tag, text, due, done:false, link: t.path || (t.link && t.link.path) || "", line: (t.line != null ? t.line : null) };
  });
} catch(e){}

// calendar (current month)
const cal = {
  title: months[now.getMonth()] + " " + now.getFullYear(),
  year: now.getFullYear(),
  month: now.getMonth(),
  first: new Date(now.getFullYear(), now.getMonth(), 1).getDay(),
  days: new Date(now.getFullYear(), now.getMonth()+1, 0).getDate(),
  today: now.getDate(),
  has: [...dset].filter(x => x.startsWith(`${now.getFullYear()}-${_two(now.getMonth()+1)}-`)).map(x => parseInt(x.slice(8,10),10))
};

// habits (heatmap + per-habit streaks) from #habit tasks in Daily notes.
// DATA-DRIVEN: the habit list is discovered from today's note (fallback: most recent
// daily note that has habits), so adding/removing #habit/* lines is reflected automatically.
function parseHabit(t){
  const tag = (t.tags||[]).map(String).find(x => x.startsWith("#habit"));
  if(!tag) return null;
  let label = String(t.text||"").replace(/#[\w\/\-]+/g,"").replace(/[📅⏳🛫✅➕⏫🔼🔽⏬🔁]\s*/gu,"").replace(/\d{4}-\d{2}-\d{2}/g,"").replace(/\s+/g," ").trim();
  if(!label) label = tag.replace("#habit/","").replace(/[-_]/g," ");
  return { tag, label };
}
let habitDefs = [];
{
  const seen = new Set();
  const addFrom = pg => { if(!pg) return; for(const t of pg.file.tasks){ const h = parseHabit(t); if(h && !seen.has(h.tag)){ seen.add(h.tag); habitDefs.push({tag:h.tag, label:h.label}); } } };
  addFrom(daily.find(p => p.file.name === todayName));
  if(!habitDefs.length){
    const sorted = daily.array().sort((a,b) => isoOf(b).localeCompare(isoOf(a)));
    for(const p of sorted){ addFrom(p); if(habitDefs.length) break; }
  }
}
const countMap = {}; const hmap = {}; habitDefs.forEach(h => hmap[h.tag] = new Set());
for (const p of daily) {
  const iso = isoOf(p); let cnt = 0;
  for (const t of p.file.tasks) {
    if (t.completed && t.tags && t.tags.some(x => String(x).startsWith("#habit"))) {
      cnt++;
      for (const h of habitDefs) { if (t.tags.some(x => x === h.tag || String(x).startsWith(h.tag + "/"))) hmap[h.tag].add(iso); }
    }
  }
  if (cnt > 0) countMap[iso] = cnt;
}
const heat = []; { const start = new Date(now); start.setHours(0,0,0,0); start.setDate(start.getDate()-125); for (let i=0;i<126;i++){ const dc = new Date(start); dc.setDate(start.getDate()+i); heat.push(Math.min(countMap[localIso(dc)]||0, 4)); } }
const monday = new Date(now); monday.setHours(0,0,0,0); const dow = (now.getDay()+6)%7; monday.setDate(monday.getDate()-dow);
function curStreak(set){ let s=0; const dd=new Date(now); dd.setHours(0,0,0,0); if(!set.has(localIso(dd))) dd.setDate(dd.getDate()-1); while(set.has(localIso(dd))){ s++; dd.setDate(dd.getDate()-1); } return s; }
const todayHabitByTag = {};
try { const tphn = daily.find(p => p.file.name === todayName); if (tphn) { for (const t of tphn.file.tasks) { for (const h of habitDefs) { if (t.tags && t.tags.some(x => x === h.tag || String(x).startsWith(h.tag + "/"))) { todayHabitByTag[h.tag] = { done: !!t.completed, path: tphn.file.path, line: (t.line != null ? t.line : null) }; } } } } } catch(e){}
const hrows = habitDefs.map(h => { const set = hmap[h.tag]; const week = []; for (let i=0;i<7;i++){ const dc = new Date(monday); dc.setDate(monday.getDate()+i); week.push(set.has(localIso(dc))); } const th = todayHabitByTag[h.tag] || {}; return { label:h.label, streak:curStreak(set), week, todayDone: !!th.done, path: th.path||"", line: (th.line!=null?th.line:null) }; });
const habits = { heat, rows: hrows, weekTodayIdx: dow };

// projects + annual goals
const order = { active:0, planning:1, "on-hold":2 };
let projects = [], goals = [];
try {
  const pAll = dv.pages('"Projects"').where(p => p.type === "project" && p.status !== "done" && p.status !== "archived");
  projects = pAll.where(p => !p.annual).sort(p => order[p.status] ?? 9, "asc").map(p => {
    const ts = p.file.tasks; const done = ts.where(t => t.completed).length; const total = ts.length; const pct = total ? Math.round(done/total*100) : 0;
    let area = p.area || ""; if (p.status && p.status !== "active") area = (area ? area + " · " : "") + p.status;
    return { name: p.file.name, area, pct, sub: total ? `${done} / ${total} milestones` : "no milestones yet", link: p.file.name };
  }).array();
  goals = dv.pages('"Projects"').where(p => p.annual === true).map(p => {
    const ts = p.file.tasks; const done = ts.where(t => t.completed).length; const total = ts.length; const pct = total ? Math.round(done/total*100) : 0;
    return { name: "📖 " + p.file.name, area: p.area || "2026", pct, sub: total ? `${done} / ${total}` : "" };
  }).array();
} catch(e){}

// reading (#book, currently reading)
let reading = [];
try { reading = dv.pages("#book").where(p => !p.status || p.status === "reading").map(p => ({ title: p.title || p.file.name, author: p.author || "", pct: Number(p.progress) || 0, color: p.color, coverSrc: resolveCover(p), link: p.file.name })).array().slice(0,4); } catch(e){}

// now playing — real local-audio player (scans Audio/, or a playlist note, or a single file)
let music = null;
try {
  const np = dv.pages().find(p => p.file.name === "🎧 Now Playing");
  const AX = ["mp3","m4a","ogg","wav","flac","opus","webm","3gp","aac"];
  const isAudio = f => f && AX.includes((f.extension||"").toLowerCase());
  const toFile = (v, src) => { if(!v) return null; if(typeof v==="object" && v.path) return app.vault.getAbstractFileByPath(v.path) || app.metadataCache.getFirstLinkpathDest(v.path, src||""); const s=String(v).replace(/^!?\[\[/,"").replace(/\]\]$/,"").replace(/\|.*$/,"").trim(); return s ? (app.vault.getAbstractFileByPath(s) || app.metadataCache.getFirstLinkpathDest(s, src||"")) : null; };
  const resPath = f => { try{ return app.vault.adapter.getResourcePath(f.path); }catch(e){ return app.vault.getResourcePath(f); } };
  const meta = f => { const base=(f.basename||f.name.replace(/\.[^.]+$/,"")); const parts=base.split(" - "); return parts.length>=2 ? {artist:parts[0].trim(), title:parts.slice(1).join(" - ").trim()} : {artist:"", title:base}; };
  let files = [];
  const npPath = np ? np.file.path : "";
  if (np && np.playlist) { const pf = toFile(np.playlist, npPath); if (pf) { const pp = dv.page(pf.path); let listed = pp && pp.tracks ? (Array.isArray(pp.tracks)?pp.tracks:[pp.tracks]) : []; for (const l of listed){ const f=toFile(l, pf.path); if(isAudio(f)) files.push(f); } if(!files.length){ const txt=await dv.io.load(pf.path)||""; for(const mm of txt.matchAll(/!?\[\[([^\]|]+?\.(?:mp3|m4a|ogg|wav|flac|opus|webm|3gp|aac))(?:\|[^\]]*)?\]\]/gi)){ const f=toFile(mm[1], pf.path); if(isAudio(f)) files.push(f); } } } }
  if (!files.length && np && np.audio) { const f=toFile(np.audio, npPath); if(isAudio(f)) files.push(f); }
  if (!files.length) { const folder = (np && np.folder) ? String(np.folder).replace(/\/$/,"") : "Audio"; files = app.vault.getFiles().filter(f => isAudio(f) && f.path.startsWith(folder + "/")).sort((a,b)=>a.path.localeCompare(b.path)); }
  const tracks = files.map(f => { const md=meta(f); return { title: md.title, artist: md.artist, src: resPath(f) }; });
  music = { track: tracks.length?tracks[0].title:(np&&np.track?np.track:""), artist: tracks.length?tracks[0].artist:(np&&np.artist?np.artist:""), pct:0, link: np?np.link:"", tracks };
} catch(e){ console.error("music", e); }

// all notes (searchable linked index)
let notesList = [];
try {
  notesList = app.vault.getMarkdownFiles().map(f => ({
    name: f.basename, path: f.path,
    folder: (f.parent && f.parent.path && f.parent.path !== "/") ? f.parent.path : "",
    mtime: (f.stat && f.stat.mtime) || 0
  })).sort((a,b) => b.mtime - a.mtime);
} catch(e){}

// mini graph: build a node-link subgraph from the vault's resolved links (top-connected notes)
let graph = { nodes: [], links: [] };
try {
  const rl = app.metadataCache.resolvedLinks || {};
  const deg = {};
  for (const src in rl) { for (const tgt in rl[src]) { const c = rl[src][tgt] || 1; deg[src] = (deg[src]||0)+c; deg[tgt] = (deg[tgt]||0)+c; } }
  let paths = Object.keys(deg).filter(p => p.endsWith(".md") && deg[p] > 0);
  paths.sort((a,b) => (deg[b]||0)-(deg[a]||0));
  const chosen = paths.slice(0, 55);
  const idx = {}; chosen.forEach((p,i) => idx[p] = i);
  const nodes = chosen.map(p => ({ id: p, label: p.split("/").pop().replace(/\.md$/,""), deg: deg[p]||0 }));
  const links = [], seen = new Set();
  for (const src of chosen) { const ts = rl[src] || {}; for (const tgt in ts) { if (idx[tgt] != null && src !== tgt) { const key = idx[src] < idx[tgt] ? idx[src]+"-"+idx[tgt] : idx[tgt]+"-"+idx[src]; if (!seen.has(key)) { seen.add(key); links.push({ s: idx[src], t: idx[tgt] }); } } } }
  graph = { nodes, links };
} catch(e){ console.error("graph", e); }

// workout: today's session from the weekly schedule in 🏋️ Workouts
let workout = { isRest: true };
try {
  const wp = dv.page("🏋️ Workouts");
  const wd = days[now.getDay()];
  let sess = "";
  if (wp && wp.schedule) { sess = wp.schedule[wd] || wp.schedule[wd.toLowerCase()] || "Rest"; }
  if (!sess || String(sess).toLowerCase() === "rest") {
    workout = { isRest: true, session: "Rest", weekday: wd };
  } else {
    const rp = dv.page(String(sess));
    let exercises = [], routinePath = "";
    if (rp) {
      routinePath = rp.file.path;
      try {
        const txt = await dv.io.load(rp.file.path) || "";
        const seg = txt.split(/##\s*Session[^\n]*\n/i)[1] || "";
        const body = seg.split(/\n#{1,6}\s/)[0];
        exercises = [...body.matchAll(/^\s*[-*]\s*\[[ xX]\]\s*(.+)$/gm)].map(m => m[1].trim());
      } catch(e){}
    }
    workout = { isRest: false, session: String(sess), icon: (rp && rp.icon) || "🏋️", focus: (rp && rp.focus) || "", duration: (rp && rp.duration) || "", routinePath, exercises: exercises.slice(0,8) };
  }
  const wset = new Set();
  for (const p of daily) { for (const t of p.file.tasks) { if (t.completed && t.tags && t.tags.some(x => String(x).startsWith("#workout"))) { wset.add(isoOf(p)); break; } } }
  workout.done = wset.has(todayIso);
  let ws = 0; { const dd = new Date(now); dd.setHours(0,0,0,0); if(!wset.has(localIso(dd))) dd.setDate(dd.getDate()-1); while(wset.has(localIso(dd))){ ws++; dd.setDate(dd.getDate()-1); } }
  workout.streak = ws;
} catch(e){ console.error("workout", e); }

// job search: pipeline snapshot from #application notes
let jobs = null;
try {
  const japps = dv.pages("#application").array()
    .filter(p => !String(p.file.path).startsWith("_templates/"))
    .map(p => ({
    company: p.company ? String(p.company) : (String(p.file.name).split(/\s+[—–-]\s+/)[0] || p.file.name),
    status: String(p.status || "saved").toLowerCase().trim(),
    deadline: p.deadline ? String(p.deadline).slice(0,10) : "",
    next: p.next ? String(p.next) : "",
  }));
  if (japps.length) {
    const cnt = k => japps.filter(a => a.status === k).length;
    const stages = { saved:cnt("saved"), applied:cnt("applied"), screen:cnt("screen"), interview:cnt("interview"), final:cnt("final"), offer:cnt("offer") };
    const activeSt = ["saved","applied","screen","interview","final"];
    const active = japps.filter(a => activeSt.includes(a.status)).length;
    const interviewing = japps.filter(a => ["screen","interview","final"].includes(a.status)).length;
    const upcoming = japps.filter(a => a.deadline && activeSt.includes(a.status))
      .map(a => ({ ...a, dl: new Date(a.deadline + "T00:00") }))
      .filter(a => !isNaN(a.dl) && a.dl >= new Date(todayIso + "T00:00"))
      .sort((x,y) => x.dl - y.dl);
    let next = null;
    if (upcoming.length) { const u = upcoming[0]; next = { icon:"⏳", label:u.company, date:u.deadline }; }
    else { const wn = japps.find(a => a.next && activeSt.includes(a.status)); if (wn) next = { icon:"➡️", label:(wn.company + " · " + wn.next), date:"" }; }
    jobs = { total: japps.length, active, interviewing, offers: stages.offer, stages, next };
  }
} catch(e){ console.error("jobs", e); }

// today's note path (for inline add/delete write-back) + pomodoro "focus" (Next up)
let todayPath = "Daily/" + todayName + ".md";
let focus = "";
try { const _tp = daily.find(p => p.file.name === todayName); if (_tp) { todayPath = _tp.file.path; if (_tp.focus != null) focus = String(_tp.focus); } } catch(e){}

const data = {
  bannerSrc, theme, mode: themeMode, matchSrc, matchBannerPath, selfPath: dv.current().file.path, name: (_selfFm.name || "there"), todayNoteName: todayName, todayIso, todayPath, templatePath,
  stats, oneThing, tasks,
  pomodoro: { sessionsToday: pomSessions, minutesToday: pomMinutes, goal: 8, task: focus },
  cal, habits, music, projects, goals, reading, notes: notesList, workout, graph, jobs
};

this.container.innerHTML = buildHub(data);
initHub(this.container.querySelector(".storm-hub"));

} catch(err) {
  this.container.innerHTML = '<div style="color:#e0736b;padding:18px;font-family:sans-serif">⚡ Storm hub error: ' + err.message + '</div>';
  console.error(err);
}
```
