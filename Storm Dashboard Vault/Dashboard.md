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
// CONTRACT §C F9 — a token does not only land on --bg / --surface / --surface2.
// Half the product paints a translucent overlay ON TOP of --surface2 (card
// inners, the Gantt `.tg-window` band, a projected `.st-plan` bar, the tinted
// health chips), so the real worst ground is one step further from the page than
// --surface2 is. Floor every text/semantic colour against THAT, or the palette
// is AA on paper and fails on screen.
function _worstGround(hex,light){ const c=_hexRgb(hex),h=_rgb2hsl(c[0],c[1],c[2]); return _hex(h[0],h[1], light? Math.max(0.02,h[2]-0.05) : Math.min(0.98,h[2]+0.05)); }
// CONTRACT §C F13 — a health badge / status chip tints its OWN ground with
// 12–20% of its ink (`color-mix(in srgb, var(--warm) 16%, transparent)`), which
// pulls the ground towards the ink and costs ~0.3 of a ratio. Floor the ink
// against the tinted ground, not the bare one.
function _tintBg(ink,bg,p){ const a=_hexRgb(ink),b=_hexRgb(bg); return "#"+[0,1,2].map(i=>Math.round(a[i]*p+b[i]*(1-p)).toString(16).padStart(2,"0")).join(""); }
function _floorTinted(hex,bg,dir,target,p){ const h=_rgb2hsl.apply(null,_hexRgb(hex)); let l=h[2],out=hex,g=0; while(_contrast(out,_tintBg(out,bg,p))<target&&l>0.02&&l<0.98&&g++<64){ l+=dir*0.02; out=_hex(h[0],h[1],l); } return out; }
// CONTRACT §C F6 — the label on an accent-filled control. `#f6fdff` is the house
// ink, but a hue that stays light even at L=.12 (a yellow, say) cannot carry it;
// such a button gets dark ink rather than a 2.6:1 label.
function _btnPair(h,s){
  let l=0.42,btn=_hex(h,s,l),g=0; while(_contrast("#f6fdff",btn)<4.5&&l>0.12&&g++<50){ l-=0.02; btn=_hex(h,s,l); }
  const onAccent = _contrast("#f6fdff",btn)>=4.5 ? "#f6fdff" : (_contrast("#04202b",btn)>=_contrast("#f6fdff",btn) ? "#04202b" : "#f6fdff");
  return { btn, onAccent };
}
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
  // CONTRACT §C — every one of these is floored against the WORST ground it can
  // land on (see _worstGround), not just --bg/--surface, so the palette is AA for
  // any banner image and not only for the sampled ones.
  const gnd   = _worstGround(surface2, light);
  const text  = _fixText(dHue, light?0.22:0.12, light?0.20:0.93, bg, gnd, dir, 7);
  const dim   = _fixText(dHue, light?0.18:0.12, light?0.40:0.72, bg, gnd, dir, 4.5);
  const faint = _fixText(dHue, light?0.16:0.11, light?0.50:0.60, bg, gnd, dir, 4.5);
  const accent  = _fixAcc(aHue, aSat, light?0.42:0.66, gnd, dir, 4.5);
  const accent2 = _fixAcc(aHue, Math.min(0.9,aSat+0.08), light?0.34:0.80, gnd, dir, 4.5);
  // the three semantic colours are the ones that sit on a chip tinted with
  // themselves, so they get the tint-aware floor (F13). Only in DARK mode: the
  // e-ink light block repaints every one of those chips #000/#fff, so tinting a
  // light palette's semantic colours would darken them for no legibility gain.
  const chipTint = light ? 0 : 0.18;
  const warm    = _floorTinted(_fixAcc(35,  0.85, light?0.42:0.72, gnd, dir, 4.5), gnd, dir, 4.5, chipTint);
  const good    = _floorTinted(_fixAcc(150, 0.5,  light?0.36:0.66, gnd, dir, 4.5), gnd, dir, 4.5, chipTint);
  // F13 — --behind ("overdue") used to be color-mix(--warm 60%, #e0736b), a light
  // red picked for dark mode, so it collapsed to ~3.7:1 on a light palette. Emit
  // it explicitly with the same floor as every other semantic colour instead.
  const behind  = _floorTinted(_fixAcc(8,   0.68, light?0.42:0.66, gnd, dir, 4.5), gnd, dir, 4.5, chipTint);
  const bn=_btnPair(aHue,aSat);
  const track = light ? _hex(dHue,bgSat,bgL-0.075) : _hex(dHue,bgSat,bgL+0.022);
  return {
    bg, surface, surface2, track, text, dim, faint, accent, accent2, behind,
    // F11 — --accent-deep fills the un-started Timeline bar, a meaningful graphic
    // boundary (WCAG 1.4.11, 3:1). It was the one accent that never saw a
    // contrast pass, so a dark banner produced 2.37:1 bars.
    accentDeep:_fixAcc(aHue,aSat,light?0.52:0.42, gnd, dir, 3), btn:bn.btn, onAccent:bn.onAccent,
    glow:`rgba(${_rgbCsv(accent)},${light?0.30:0.45})`,
    border:  light? `rgba(${_rgbCsv(_hex(dHue,0.22,0.28))},.32)` : `rgba(${_rgbCsv(_hex(dHue,0.30,0.62))},.18)`,
    border2: light? `rgba(${_rgbCsv(_hex(dHue,0.24,0.24))},.5)`  : `rgba(${_rgbCsv(_hex(dHue,0.30,0.70))},.32)`,
    warm, good, accentRgb:_rgbCsv(accent), mode: light?"light":"dark",
    // this palette came out of the generator with every §C floor applied, so
    // _normalizeTheme leaves it exactly as it is (see there).
    aa:1,
  };
}
// ---- COMMUNITY mode: inherit the installed Obsidian theme's own variables ----
// One copy of the mapping, read by BOTH the in-note rule (_themeRule) and the
// vault-wide snippet (_themeFileCss). Two copies is how the audit and the
// product drifted apart the first time round (CONTRACT §C F12).
function _communityMap(){
  return {
    "--bg":"var(--background-primary)","--surface":"var(--background-secondary)",
    "--surface2":"var(--background-secondary-alt,var(--background-secondary))",
    "--track":"var(--background-modifier-form-field,var(--background-modifier-border,var(--background-secondary)))",
    // CONTRACT §C F12 — Storm uses --dim and --faint for LOAD-BEARING text
    // (card headings, axis labels, every due date), so they must map to
    // load-bearing Obsidian tokens. --text-faint is documented as decorative
    // and is 2.85–3.66:1 in Obsidian's own default themes; shipping a rule
    // that depends on it being legible is our bug, not Obsidian's.
    "--text":"var(--text-normal)",
    "--dim":"color-mix(in srgb, var(--text-normal) 60%, var(--text-muted))",
    "--faint":"var(--text-muted)",
    // --accent2 is the BRIGHT sibling of the accent in Storm, but Obsidian's
    // --interactive-accent-hover is the DARKER one in its dark theme, so every
    // accent-tinted chip read at 2.62:1. Move it towards the text instead,
    // which is brighter in dark themes and darker in light ones.
    // THEME2 §A/§B — these three are accent-coloured TEXT and a meaningful
    // boundary, so they read Obsidian's accent TEXT variable, not the accent
    // FILL. It was --interactive-accent, which is only 4.36:1 on Obsidian's own
    // dark background and, once storm-theme.css sets it to the contrast-checked
    // BUTTON fill (dark, so a light label can ride on it), collapses to 2.54:1
    // as text. --text-accent is the variable Obsidian gives this job.
    "--accent":"var(--text-accent,var(--interactive-accent))",
    "--accent2":"color-mix(in srgb, var(--text-accent,var(--interactive-accent)) 62%, var(--text-normal))",
    "--accent-deep":"var(--text-accent,var(--interactive-accent))","--border":"var(--background-modifier-border)",
    "--border2":"var(--background-modifier-border-hover,var(--background-modifier-border))",
    // F15/F6 — white-on-accent is 3.83:1 with Obsidian's stock accent. Darken
    // the fill we put the label on rather than fight the installed theme.
    "--btn":"color-mix(in srgb, var(--interactive-accent) 70%, #000)","--on-accent":"var(--text-on-accent)",
    // F13 — a semantic colour has to move TOWARDS the text in whichever theme
    // is installed; mixing with --text-normal does that in light and dark
    // alike, where a fixed hex could only ever be right in one of them.
    "--warm":"color-mix(in srgb, var(--color-orange,#d08770) 55%, var(--text-normal))",
    "--good":"color-mix(in srgb, var(--color-green,#5acaa0) 55%, var(--text-normal))",
    "--behind":"color-mix(in srgb, var(--color-red,#e0736b) 70%, var(--text-normal))",
    "--glow":"transparent","--accent-rgb":"130,150,190",
  };
}
// the four containers Obsidian paints the Dashboard page background on
function _pageSel(g){ return [".view-content",".markdown-reading-view",".markdown-source-view",".cm-editor"].map(x=>g+" .storm-home "+x).join(","); }
// the palette-object key → CSS custom property name, for MATCH and BRAND modes
const _THEME_MAP={bg:"--bg",surface:"--surface",surface2:"--surface2",track:"--track",border:"--border",border2:"--border2",text:"--text",dim:"--dim",faint:"--faint",accent:"--accent",accent2:"--accent2",accentDeep:"--accent-deep",glow:"--glow",btn:"--btn",onAccent:"--on-accent",accentRgb:"--accent-rgb",warm:"--warm",good:"--good",behind:"--behind"};
function _themeRule(t){
  if(!t) return "";
  const B="body:not(.theme-light) .storm-hub";
  const PAGE=_pageSel("body:not(.theme-light)");
  if(t.mode==="community"){
    const m=_communityMap();
    const decls=Object.keys(m).map(k=>`${k}:${m[k]}`).join(";");
    // Every declaration above reads an Obsidian variable, so the SAME block is
    // correct in light mode too — the values follow the installed theme. Emit it
    // for `.theme-light` as well, or community mode silently falls back to the
    // e-ink palette on a light Obsidian theme.
    let css=`${B}{${decls}} body.theme-light .storm-hub{${decls}}`;
    // heatmap ramp from the theme's accent (Obsidian exposes accent as H/S/L components)
    const HSL="var(--accent-h),var(--accent-s),var(--accent-l)";
    css+=` ${B} .heat .c.i1{background:hsla(${HSL},.22)} ${B} .heat .c.i2{background:hsla(${HSL},.46)} ${B} .heat .c.i3{background:hsla(${HSL},.72)}`;
    css+=` ${PAGE}{background:var(--background-primary) !important;}`;
    return css;
  }
  // ---- MATCH mode: an explicit palette derived from the banner image ----
  // normalised first, so the in-note <style> and the vault-wide snippet paint the
  // SAME colours even when the palette came from an older cache (see below).
  t=_normalizeTheme(t);
  const map=_THEME_MAP;
  const decls=Object.keys(map).filter(k=>t[k]).map(k=>`${map[k]}:${t[k]}`).join(";");
  if(!decls) return "";
  let css=`${B}{${decls}}`;
  // heatmap ramp: single-hue tints of the matched accent (base ramp is hardcoded blue)
  if(t.accentRgb) css+=` ${B} .heat .c.i1{background:rgba(${t.accentRgb},.22)} ${B} .heat .c.i2{background:rgba(${t.accentRgb},.46)} ${B} .heat .c.i3{background:rgba(${t.accentRgb},.72)}`;
  if(t.bg) css+=` ${PAGE}{background:${t.bg} !important;}`;
  return css;
}

/* ══ CONTRACT §B — the theme as a REAL vault snippet ═══════════════════════
   _themeRule scopes everything to `.storm-hub` inside the Dashboard's own
   output, so the palette died at the edge of that note. Every palette block in
   storm.css now reads `var(--storm-<name>, <the literal it used to hold>)`, so
   ONE set of `--storm-*` on `body` repaints the whole vault — and with no theme
   file the literals still win, so nothing changes for a vault without it.
   _themeFileCss renders that file; initHub writes it to
   .obsidian/snippets/storm-theme.css when its content actually changes.
   A DARK palette is emitted under `body:not(.theme-light)` only, so light mode
   keeps the e-ink palette. A LIGHT one (light banner / brand light) also gets a
   `body.theme-light` block, or the e-ink override would throw it away. The
   community mapping reads Obsidian's own variables and is correct in both. */
/* §B + §C — `stormTheme:` is a CACHE: written by an older build (this vault
   ships one that predates the §C floors) or edited by hand. Before §B a stale
   cache only mis-painted the Dashboard; now it paints the whole vault, so it is
   re-floored at apply time. A palette straight from _buildTheme / _brandTheme
   carries `aa:1` and passes through untouched — those generators make choices
   this must not second-guess (BUILD §6 pins --accent to the brand's primary).
   tests/T pins the no-op, so a good palette can never be quietly restyled. */
function _hslOf(x){ return _rgb2hsl.apply(null,_hexRgb(x)); }
function _isHex(v){ return typeof v==="string" && /^#[0-9a-f]{6}$/i.test(v); }
function _normalizeTheme(t){
  if(!t || t.mode==="community" || t.aa) return t;   // `aa` = straight from the generator
  const base = _isHex(t.surface2)? t.surface2 : (_isHex(t.surface)? t.surface : t.bg);
  if(!_isHex(base)) return t;                       // not a palette we can reason about
  const light = t.mode==="light", dir = light ? -1 : 1;
  const gnd = _worstGround(base, light);
  const floor=(v,target)=>{ if(!_isHex(v)||_contrast(v,gnd)>=target) return v; const h=_hslOf(v); return _fixAcc(h[0],h[1],h[2],gnd,dir,target); };
  const out = Object.assign({}, t);
  for(const k of ["text","dim","faint","accent","accent2","warm","good","behind"]) out[k]=floor(out[k],4.5);
  // F11 — --accent-deep fills the un-started Timeline bar: a meaningful graphic
  // boundary (WCAG 1.4.11), so 3:1, not 4.5:1.
  out.accentDeep = floor(out.accentDeep, 3);
  // F6 — the label on the accent-filled button. (A gradient --btn is left alone.)
  if(_isHex(out.btn) && _isHex(out.onAccent) && _contrast(out.onAccent,out.btn)<4.5){
    const b=_hslOf(out.btn), d=_relLum(out.onAccent)>0.5?-1:1;
    out.btn=_fixAcc(b[0],b[1],b[2],out.onAccent,d,4.5);
  }
  if(out.accent!==t.accent && t.accentRgb) out.accentRgb=_rgbCsv(out.accent);   // the heatmap ramp follows
  return out;
}
const _THEME_SNIPPET="storm-theme";
const _THEME_HEAD="/* storm-theme.css — GENERATED by the Storm Dashboard (⚙️ Settings → Theme).\n"
  +"   Block 1 (--storm-*) is what storm.css reads; block 2, in match and brand mode\n"
  +"   only, hands the same palette to Obsidian's own variables so the rest of the\n"
  +"   vault agrees with the Dashboard (community mode never writes it — it READS\n"
  +"   them). Turn this snippet off, delete it, or set Theme to Community, and the\n"
  +"   vault goes straight back to the installed theme with nothing of ours on it. */\n";
/* ══ CONTRACT §A/§B — the palette also drives OBSIDIAN'S OWN variables ═══════
   --storm-* only reaches surfaces storm.css paints. Obsidian's own
   --background-primary / --text-normal / --link-color are what a PLAIN note, the
   sidebars, the modals and the settings pane read, so until they follow the
   palette too the vault and the Dashboard disagree — which is the bug.

   `_OBS` is that mapping: one `<obsidian variable>:<key>` pair per declaration,
   read through the table `V` in _obsidianVars. It is one string rather than 28
   lines of concatenation because this whole file is embedded in the Dashboard
   note, which BUILD §11 caps at 140 KB.

   Colours: everything here the generator already floored, or is floored again
   against `gnd` = --surface2. That is the worst of the three grounds Obsidian's
   variables put text on (--background-primary / -secondary / -secondary-alt):
   every generator walks bg → surface → surface2 away from the page, so surface2
   is the one closest to the ink. It is the base _normalizeTheme picks, for the
   same reason. A link never lands on a Storm card — storm.css gives
   `.dt-wrap a.internal-link` its own --accent2 — so those three are the whole set.

   --interactive-accent is a FILL and --text-on-accent is the label on it
   (Obsidian's .mod-cta; here `.storm-settings .segbtn.on`, which darkens it
   further with color-mix(…,#000) first), so it takes the pair the generator
   contrast-checked as a fill (--btn / --on-accent, §C F6) and never --accent: a
   colour bright enough to read as TEXT on a dark page cannot also carry a light
   label. Accent-coloured TEXT has its own variables, below.

   Links: Obsidian derives link colour from the user's accentColor, and this
   vault's is #000000, so with any dark theme every internal link renders black.
   --color-accent* is what the modern names derive FROM, --link-* are the modern
   names, --text-accent* the legacy pair Minimal and other 1.0-era themes still
   read: set all three or one of them stays black. opacity/filter are pinned
   because Obsidian's own unresolved link is the accent at .4 opacity, which
   measures 1.75:1 on its own dark background. */
const _OBS="~primary:b;~primary-alt:s;~secondary:s;~secondary-alt:2;~modifier-hover:2;"
  +"~modifier-form-field:k;~modifier-border:e;~modifier-border-hover:E;~modifier-border-focus:a;"
  +"divider-color:e;^normal:t;^muted:d;^faint:f;@:n;@-hover:N;^on-accent:o;"
  +"#:a;#-1:h;$color:a;$color-hover:h;$external-color:a;$external-color-hover:h;"
  +"$unresolved-color:g;$unresolved-opacity:1;$unresolved-filter:0;^accent:a;^accent-hover:h";
const _OBSX={"~":"background-","^":"text-","@":"interactive-accent","#":"color-accent","$":"link-"};
/* An UNRESOLVED link must stay distinct from a live one AND clear 4.5:1: the same
   hue at a third of the saturation, stepped toward the page as far as the floor
   allows and no further. */
function _linkGhost(v,g,d){
  const q=_hslOf(v), s=q[1]*0.34; let l=q[2], o=_fixAcc(q[0],s,l,g,d,4.5);
  for(let i=0;i<32&&_contrast(v,o)<1.3;i++){ const x=_hex(q[0],s,l-d*0.03);
    if(_contrast(x,g)<4.5||l-d*0.03<=0.04) break; l-=d*0.03; o=x; }
  return o;
}
function _obsidianVars(t){
  // COMMUNITY mode maps --storm-* ONTO these variables; writing them back would
  // be circular and would fight the installed theme. CONTRACT §A.
  if(!t||t.mode==="community"||!_isHex(t.accent)||!_isHex(t.text)) return "";
  const g=_isHex(t.surface2)?t.surface2:t.bg; if(!_isHex(g)) return "";
  const d=t.mode==="light"?-1:1, fx=c=>{ const q=_hslOf(c); return _fixAcc(q[0],q[1],q[2],g,d,4.5); };
  const a=fx(t.accent), h=fx(_isHex(t.accent2)?t.accent2:t.accent);
  const n=_isHex(t.btn)?t.btn:a, o=_isHex(t.onAccent)?t.onAccent:"#ffffff", F=_hslOf(n);
  const V={b:t.bg,s:t.surface,2:t.surface2,k:t.track||t.surface2,e:t.border,E:t.border2,
    t:t.text,d:t.dim,f:t.faint,a:a,h:h,g:_linkGhost(a,g,d),n:n,o:o,1:"1",0:"none",
    // the hover fill moves AWAY from the ink, so the label can only gain contrast
    N:_hex(F[0],F[1],Math.max(0.04,Math.min(0.96,F[2]-(_relLum(o)>0.5?0.06:-0.06))))};
  return "--"+_OBS.replace(/[~^@#$]/g,c=>_OBSX[c])
    .replace(/:(\w+)(?=;|$)/g,(m,k)=>":"+V[k]+" !important").split(";").join(";--");
}
// palette object (or the community mapping) → `--storm-*: value` declarations
function _stormVars(t){
  if(!t) return "";
  if(t.mode==="community"){
    const m=_communityMap();
    return Object.keys(m).map(k=>`--storm-${k.slice(2)}:${m[k]}`).join(";");
  }
  return Object.keys(_THEME_MAP).filter(k=>t[k]).map(k=>`--storm-${_THEME_MAP[k].slice(2)}:${t[k]}`).join(";");
}
function _themeBlock(guard,t){
  const decls=_stormVars(t); if(!decls) return "";
  const PAGE=_pageSel(guard);
  let css=`${guard}{${decls}}\n`;
  /* …and the same palette on Obsidian's own variables, so the vault outside the
     Storm surfaces agrees with them. `html ` is not decoration: storm.css's e-ink
     block declares --background-primary / --link-color on `body.theme-light` with
     !important, and a light palette has to outrank it whatever order Obsidian
     loads the two snippets in. */
  const obs=_obsidianVars(t);
  if(obs) css+=`html ${guard}{${obs}}\n`;
  // the habit heatmap ramp is a single-hue tint of the accent, not a token
  const ramp = t.mode==="community"
    ? a=>`hsla(var(--accent-h),var(--accent-s),var(--accent-l),${a})`
    : (t.accentRgb ? a=>`rgba(${t.accentRgb},${a})` : null);
  if(ramp) css+=`${guard} .storm-hub .heat .c.i1{background:${ramp(".22")}}\n${guard} .storm-hub .heat .c.i2{background:${ramp(".46")}}\n${guard} .storm-hub .heat .c.i3{background:${ramp(".72")}}\n`;
  const page = t.mode==="community" ? "var(--background-primary)" : t.bg;
  if(page) css+=`${PAGE}{background:${page} !important;}\n`;
  // BRAND mode extras — the hero gradient, kept where _brandRule puts them
  if(t.brandPrimary) css+=`${guard} .storm-hub{--brand-primary:${t.brandPrimary};--brand-secondary:${t.brandSecondary};--brand-deep:${t.brandDeep}}\n${guard} .storm-hub .banner.brand-grad{background:linear-gradient(135deg,${t.brandDeep},${t.brandPrimary})}\n`;
  return css;
}
/* t = the dark-mode palette (always emitted); lightT = an optional DIFFERENT
   palette for body.theme-light (brand mode derives one per mode and passes
   both). Omit it and `t` is reused for light when it is light or community. */
function _themeFileCss(t,lightT){
  if(!t) return "";
  t=_normalizeTheme(t); if(lightT) lightT=_normalizeTheme(lightT);
  const dark=_themeBlock("body:not(.theme-light)",t);
  if(!dark) return "";
  const lt = lightT || ((t.mode==="light"||t.mode==="community") ? t : null);
  return _THEME_HEAD + dark + (lt ? _themeBlock("body.theme-light",lt) : "");
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

/* ============================================================
   RENDER — buildHub(d) -> HTML string.  Pure: no dv/app calls.
   Data contract: SPEC §3.7.
   ============================================================ */
const _MON3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const _HBL = { ok:"On track", risk:"At risk", behind:"Behind", done:"Done", unscheduled:"Unscheduled", paused:"Paused" };
const _HORDER = { behind:0, risk:1, ok:2, unscheduled:3, done:4, paused:5 };
function _dayLbl(iso){ const m=String(iso||"").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? (_MON3[+m[2]-1]+" "+(+m[3])) : ""; }
function _hbSpan(h){ const k=_HBL[h]?h:"unscheduled"; return `<span class="hb ${k}">${_HBL[k]}</span>`; }
function _pct(n){ return Math.max(0, Math.min(100, Math.round((n||0)*100))); }

function buildHub(d){
  d = d || {};
  const TODAY = d.todayIso || "";
  const NAV = [
    {ic:"⚡",label:"Today",link:null,active:true},
    {ic:"🔥",label:"Habits",link:"🔥 Habit Tracker"},
    {ic:"🎯",label:"Goals",link:"🎯 Goals"},
    {ic:"💼",label:"Jobs",link:"💼 Job Search"},
    {ic:"🍽️",label:"Recipes",link:"🍽️ Recipe Index"},
    {ic:"🗓️",label:"Meals",link:"🗓️ Meal Planner"},
    {ic:"🛒",label:"Shopping",link:"🛒 Shopping List"},
    {ic:"➕",label:"Add",link:"➕ Quick Add"},
    {ic:"⚙️",label:"Settings",link:"⚙️ Settings"},
  ];
  const navHtml = NAV.map(n=>`<span class="pill${n.active?" active":""}"${n.link?` data-link="${_esc(n.link)}"`:""}>${n.ic} ${n.label}</span>`).join("")
    + `<span class="pill pill-toggle" data-action="toggle-theme" title="Toggle light / e-ink reading mode">🌓 Theme</span>`;

  /* ---------- §3.1 ACTION STRIP (replaces the vault-stats strip) ---------- */
  const S = d.strip || {};
  const act = (f,n,l,hot,live) => `<div class="act${hot?" hot":""}" data-filter="${f}"${live?"":' data-nofilter="1"'}><div class="n">${_esc(n)}</div><div class="l">${_esc(l)}</div></div>`;
  const stripHtml = `<div class="actstrip">`
    + act("nm",    S.nm||0,    "Next moves",    false,               true)
    + act("today", S.today||0, "Due today",     false,               true)
    + act("over",  S.over||0,  "Overdue",       (S.over||0)>0,       true)
    + act("risk",  S.risk||0,  "Goals at risk", (S.risk||0)>0,       true)
    + act("focus", (S.focus||0)+"/"+(S.goal||8), "Focus",  false, false)
    + act("streak","🔥 "+(S.streak||0),          "Streak", false, false)
    + `</div>`;

  /* ---------- §3.3 NOW CARD ---------- */
  const rowHtml = (r, kind) => {
    const due = r.due || "";
    const dated = kind !== "inbox" && !!due;
    const isOver  = dated && due < TODAY;
    const isToday = dated && due === TODAY;
    const cls = ["nm-row"];
    if(kind === "sub") cls.push("nm-sub");
    if(kind === "inbox") cls.push("nm-inbox");
    if(isOver) cls.push("is-over");
    if(isToday) cls.push("is-today");
    if(r.risk) cls.push("is-risk");
    if(r.done) cls.push("done");
    const dcls = "nm-date" + (isOver?" over":(isToday?" today":""));
    const src = r.raw || r.text || "";
    const del = kind === "inbox"
      ? `<span class="del" data-del-path="${_esc(r.path||"")}" data-del-line="${r.line}" data-del-text="${_esc(src)}" title="Delete this item">✕</span>` : "";
    const exp = kind === "next" ? `<button class="nm-act" data-expand title="Show every sub-task">▾</button>` : "";
    return `<div class="${cls.join(" ")}" data-path="${_esc(r.path||"")}" data-line="${r.line}" data-due="${_esc(due)}" data-kind="${kind}">`
      + `<span class="nm-box${r.done?" done":""}" data-toggle-path="${_esc(r.path||"")}" data-toggle-line="${r.line}" data-toggle-text="${_esc(src)}" title="Check this off"></span>`
      + `<span class="nm-text">${_esc(r.text||"")}</span>`
      + `<span class="${dcls}">${_esc(_dayLbl(due))}</span>`
      + (r.taskName?`<span class="nm-task" data-link="${_esc(r.taskPath||"")}">${_esc(r.taskName)}</span>`:`<span class="nm-task"></span>`)
      + `<span class="nm-acts"><button class="nm-act" data-resched="today">→ today</button><button class="nm-act" data-resched="tomorrow">→ tmrw</button>${exp}${del}</span>`
      + `</div>`;
  };
  const allDoneRow = t => `<div class="nm-row nm-alldone" data-path="${_esc(t.path)}" data-line="-1" data-due="" data-kind="alldone">`
      + `<span class="nm-box done"></span><span class="nm-text">All sub-tasks done</span><span class="nm-date"></span>`
      + `<span class="nm-task" data-link="${_esc(t.path)}">${_esc(t.name)}</span>`
      + `<span class="nm-acts"><button class="nm-markdone" data-done-path="${_esc(t.path)}" data-done-name="${_esc(t.name)}">✓ Mark task complete</button></span></div>`;

  // group active tasks under their goal, worst health first (§3.3.4)
  const goals = (d.goals||[]).slice();
  const tasksAll = (d.tasks||[]);
  // PAUSE §3 — a paused goal (and any effective-paused task) leaves the ⚡ Now card entirely.
  const groupsSrc = goals
    .filter(gl => !gl.paused)
    .map(gl => ({ name: gl.name, path: gl.path, health: gl.health, risk: (gl.health==="risk"||gl.health==="behind"),
                  tasks: (gl.tasks||[]).filter(t => t.status==="active" && !t.paused && (t.nextMove || t.allDone)) }))
    .filter(gr => gr.tasks.length);
  const orphan = tasksAll.filter(t => t.status==="active" && !t.paused && !t.goalName && (t.nextMove || t.allDone));
  if(orphan.length) groupsSrc.push({ name:"No goal yet", path:"", health:"unscheduled", risk:false, tasks:orphan });
  groupsSrc.sort((a,b)=> ((_HORDER[a.health]==null?9:_HORDER[a.health]) - (_HORDER[b.health]==null?9:_HORDER[b.health])) || String(a.name).localeCompare(String(b.name)));
  const nextKeys = new Set();
  const groupsHtml = groupsSrc.map(gr => {
    const ts = gr.tasks.slice().sort((a,b)=>{
      const ka=(a.nextMove&&a.nextMove.due)||"9999-12-31", kb=(b.nextMove&&b.nextMove.due)||"9999-12-31";
      if(ka!==kb) return ka<kb?-1:1;
      const na=a.nextMove?0:1, nb=b.nextMove?0:1;
      if(na!==nb) return na-nb;
      return String(a.name).localeCompare(String(b.name));
    });
    const rows = ts.map(t => {
      if(!t.nextMove) return allDoneRow(t);
      const nm = t.nextMove;
      nextKeys.add(t.path + ":" + nm.line);
      const head = rowHtml({ text:nm.text, raw:nm.raw, path:t.path, line:nm.line, due:nm.due, done:false, taskName:t.name, taskPath:t.path, risk:gr.risk }, "next");
      const subs = (t.subs||[]).filter(s => !s.done)
        .map(s => rowHtml({ text:s.text, raw:s.raw, path:t.path, line:s.line, due:s.due, done:false, taskName:t.name, taskPath:t.path, risk:gr.risk }, "sub")).join("");
      return head + `<div class="nm-subs" data-subs-for="${_esc(t.path)}" style="display:none">${subs}</div>`;
    }).join("");
    return `<div class="nm-group"><div class="nm-ghead"${gr.path?` data-link="${_esc(gr.path)}"`:""}>🎯 ${_esc(gr.name)} ${_hbSpan(gr.health)}</div>${rows}</div>`;
  }).join("");
  const nmCount = (d.nextMoves||[]).length;
  const emptyNow = (d.goals||[]).length
    ? `<div class="nm-empty">Nothing queued. Add a sub-task with <b>sub: Draft the intro -&gt; Task name</b>.</div>`
    : `<div class="nm-empty">No goals yet. Type <b>goal: Learn guitar</b> below, then <b>task: Book a first lesson @Learn guitar</b>.</div>`;

  const overRows = (d.overdue||[]).filter(r => !nextKeys.has(r.path + ":" + r.line));
  const overHtml = overRows.length
    ? `<div class="nm-sec">Overdue <span>${overRows.length}</span></div>` + overRows.map(r => rowHtml(r,"over")).join("")
    : "";
  const inbox = d.inbox||[];
  const inboxHtml = `<div class="nm-sec">Inbox <span>${inbox.length}</span></div>`
    + (inbox.length ? inbox.map(r => rowHtml(r,"inbox")).join("") : `<div class="nm-empty">Inbox clear.</div>`);

  const UHELP = "task: Name @Goal 9/15-10/10  ·  sub: Text 9/18 -> Task  ·  goal: Name @Area 2026-12-31  ·  habit: 🧘 Meditate  ·  note: Title  ·  job: Company — Role  ·  anything else lands in today's inbox";
  const uaddHtml = `<div class="uadd"><input class="addinput" type="text" data-uadd placeholder="Add… (task: · sub: · goal: · habit: · note: · job: · or just type an inbox item)" aria-label="Add anything"><button class="addbtn" data-uaddbtn title="Add" aria-label="Add">＋</button><span class="help" title="${_esc(UHELP)}">?</span></div>`;

  const sd = d.shutdown || {};
  const shutdownHtml = `<div class="shutdown">
      <div class="sd-row"><label>🏆 Win</label><input class="sd-inp" type="text" data-sd="win" value="${_esc(sd.win||"")}" placeholder="Win of the day…"></div>
      <div class="sd-row"><label>⏭ Next step</label><input class="sd-inp" type="text" data-sd="next" value="${_esc(sd.next||"")}" placeholder="One next step on anything I touched…"></div>
    </div>`;

  const nowCard = `<div class="card span-4 nowcard" data-filter="">
      <h3>⚡ Now <span class="sp">${nmCount} next move${nmCount===1?"":"s"}</span></h3>
      ${d.todayExists?"":`<button class="starttoday" data-action="open-today" data-today="${_esc(d.todayNoteName||"")}">▶ Start today</button>`}
      ${uaddHtml}
      ${groupsHtml||emptyNow}
      ${overHtml}
      ${inboxHtml}
      ${shutdownHtml}
      <div class="cardnote" data-action="open-today" data-today="${_esc(d.todayNoteName||"")}" style="cursor:pointer;color:var(--accent)">📓 Open today's note →</div>
    </div>`;

  /* ---------- POMODORO (plugin-bound) ---------- */
  const pm = d.pomodoro||{sessionsToday:0,minutesToday:0,goal:8,task:""};
  const pGoal = pm.goal||8;
  const focusVal = pm.task || "";
  const moveOpts = (d.nextMoves||[]).map(t=>t.text).filter(Boolean);
  const habitOpts = (d.habits && d.habits.rows ? d.habits.rows : []).map(h=>h.label).filter(Boolean);
  const inList = moveOpts.includes(focusVal) || habitOpts.includes(focusVal);
  const optGroup = (arr,label)=> arr.length ? `<optgroup label="${label}">`+arr.map(x=>`<option value="${_esc(x)}"${x===focusVal?" selected":""}>${_esc(x)}</option>`).join("")+`</optgroup>` : "";
  const focusSelect = `<select class="focussel" data-focus aria-label="Set your focus for this session">
        <option value=""${!focusVal?" selected":""}>— pick a focus —</option>
        ${(focusVal && !inList)?`<option value="${_esc(focusVal)}" selected>${_esc(focusVal)}</option>`:""}
        ${optGroup(moveOpts,"Next moves")}${optGroup(habitOpts,"Habits")}
      </select>`;
  let focusRef = null;
  if (focusVal) {
    const mt = (d.nextMoves||[]).find(t => t.text === focusVal && t.path && t.line!=null);
    if (mt) focusRef = { path: mt.path, line: mt.line, text: mt.text };
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

  /* ---------- CALENDAR ---------- */
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

  /* ---------- HABITS ---------- */
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
      <div class="streaks">${streakHtml}</div></div>`;

  /* ---------- MUSIC ---------- */
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

  /* ---------- §3.5 GOALS CARD (replaces Projects) ---------- */
  const gcRows = goals.slice()
    .filter(gl => gl.status !== "done" && !gl.paused)   // PAUSE §3 — paused goals live on 🎯 Goals
    .sort((a,b)=> ((_HORDER[a.health]==null?9:_HORDER[a.health]) - (_HORDER[b.health]==null?9:_HORDER[b.health])) || String(a.name).localeCompare(String(b.name)))
    .map(gl => `<div class="gc-row"><div class="gc-top"><span class="gc-name" data-link="${_esc(gl.path)}">${_esc(gl.name)}</span><span class="area gc-area">${_esc(gl.area||"")}</span>${_hbSpan(gl.health)}</div>
        <div class="gc-bar"><span style="width:${_pct(gl.progress)}%"></span></div>
        <div class="pct gc-meta"><span>${gl.nTasks||0} task${gl.nTasks===1?"":"s"} · ${gl.nActive||0} active</span><span class="gc-gantt" data-link="${_esc(gl.path)}">gantt →</span><span>${_pct(gl.progress)}%</span></div></div>`).join("");
  const goalCard = `<div class="card span-8 goalcard"><h3>🎯 Goals <span class="sp" data-link="🎯 Goals">all goals →</span></h3>
      ${gcRows||`<div class="empty">No goals yet — type <b>goal: Learn guitar</b> in the ⚡ Now add box and this fills in.</div>`}
      <div class="cardnote"><span data-link="🎯 Goals">🎯 Goals index →</span>　·　<span data-link="📋 Tasks">📋 Tasks board →</span></div></div>`;

  /* ---------- §3.5 PULSE CARD ---------- */
  const P = d.pulse||{doneThisWeek:0,activeTasks:0,stale:0,streak:0};
  const pulseCard = `<div class="card span-4 pulse"><h3>📈 This week</h3>
      <div class="pulserow">
        <div class="pstat"><div class="pn">${P.doneThisWeek||0}</div><div class="pl">sub-tasks done</div></div>
        <div class="pstat"><div class="pn">${P.activeTasks||0}</div><div class="pl">active tasks</div></div>
        <div class="pstat"><div class="pn">🔥 ${P.streak||0}</div><div class="pl">day streak</div></div>
      </div>
      <div class="cardnote" data-link="🧹 Triage">${P.stale||0} stale · Triage →</div></div>`;

  /* ---------- READING ---------- */
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

  /* ---------- WORKOUT ---------- */
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

  /* ---------- JOBS ---------- */
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
      ${nextHtml}</div>`;
  } else {
    jobCard = `<div class="card span-4 jobcard"><h3>💼 Job Search <span class="sp" data-link="💼 Job Search">board →</span></h3>
      <div class="empty">Track your search here — add one with <b>job: Company — Role</b> and it appears on the <b>board</b>.</div></div>`;
  }

  /* ---------- NOTES ---------- */
  const notes = d.notes||[];
  const noteRows = notes.map(n=>`<div class="noterow" data-link="${_esc(n.path)}"><span class="nnm">${_esc(n.name)}</span>${n.folder?`<span class="nfold">${_esc(n.folder)}</span>`:""}</div>`).join("");
  const notesCard = `<div class="card span-8 notescard"><h3>🗂️ Notes <span class="sp">${notes.length} total</span></h3>
      <input class="addinput notesearch" type="text" data-notesearch placeholder="🔍 Filter notes…" aria-label="Filter notes">
      <div class="notescroll">${noteRows||'<div class="empty">No notes yet.</div>'}</div></div>`;

  /* ---------- GRAPH ---------- */
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

  /* ---------- §3.5 REFERENCE SECTION (collapsible) ---------- */
  const refSec = `<div class="refsec" data-ref>
      <div class="reftoggle" data-action="toggle-ref">▾ Reference · Calendar · Reading · Notes · Graph · Music</div>
      ${calCard}${readCard}${notesCard}${graphCard}${musicCard}
    </div>`;

  /* ---------- theme plumbing (unchanged) ---------- */
  const _mode = (d.mode==="match") ? "match" : "community";
  const _themeObj = _mode==="community" ? {mode:"community"} : (d.theme||null);
  const _needsCompute = _mode==="match" && !d.theme && !!d.matchSrc;
  const _matchAttrs = _needsCompute ? ` data-match-src="${_esc(d.matchSrc)}" data-match-bpath="${_esc(d.matchBannerPath||"")}"` : "";
  const _matchedAttr = (_mode==="community" || (_mode==="match" && !!d.theme)) ? ' data-matched="1"' : '';
  // CONTRACT §B — initHub persists the palette to .obsidian/snippets/storm-theme.css
  // so it paints the whole vault. A cached match palette is only known here, so it
  // travels to initHub on the root element (the way brand mode already passes
  // data-brand-colors); community mode needs no data at all.
  const _palAttr = (_mode==="match" && d.theme) ? ` data-storm-palette="${_esc(JSON.stringify(d.theme))}"` : "";

  // baseline behaviour CSS (row filtering + reference collapse). The full styling lives in storm.css.
  const baseCss = `.nowcard[data-filter="nm"] .nm-row:not([data-kind="next"]){display:none}`
    + `.nowcard[data-filter="today"] .nm-row:not(.is-today){display:none}`
    + `.nowcard[data-filter="over"] .nm-row:not(.is-over){display:none}`
    + `.nowcard[data-filter="risk"] .nm-row:not(.is-risk){display:none}`
    + `.refsec.collapsed .card{display:none}`;

  const oneVal = d.oneThing ? _esc(d.oneThing) : `Set today's one thing →`;
  return `<div class="storm-hub" data-today-path="${_esc(d.todayPath||"")}" data-today-iso="${_esc(d.todayIso||"")}" data-tomorrow-iso="${_esc(d.tomorrowIso||"")}" data-today-name="${_esc(d.todayNoteName||"")}" data-template-path="${_esc(d.templatePath||"")}" data-workout-session="${_esc(w.isRest?"":(w.session||""))}" data-workout-routine="${_esc(w.routinePath||"")}" data-self-path="${_esc(d.selfPath||"")}" data-mode="${_mode}"${_matchAttrs}${_matchedAttr}${_palAttr}>
    <style class="storm-theme-css">${_themeRule(_themeObj)}</style>
    <style class="storm-base-css">${baseCss}</style>
    <div class="navpills">${navHtml}</div>
    ${stripHtml}
    <div class="hub-grid">
      <div class="banner">
        ${d.bannerSrc?`<img class="banner-img" src="${d.bannerSrc}" alt="banner">`:""}
        <div class="scrim"></div>
        <div class="greet">
          <div class="g"><span class="js-greet">Good evening</span>, ${_esc(d.name||"")} ⚔️</div>
          <div class="clock"><span class="js-clock">00:00</span><span class="secs js-secs">00</span></div>
          <div class="date js-date"></div>
          <div class="hero-one${d.oneThing?"":" unset"}" data-action="edit-one"><span class="k">🎯 One thing</span><span class="v">${oneVal}</span></div>
        </div>
      </div>
      ${nowCard}${pomoCard}${habitCard}${workoutCard}${goalCard}${jobCard}${pulseCard}${refSec}
    </div>
  </div>`;
}

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

/* ===================== live data ===================== */
const now = new Date();
const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const localIso = d => `${d.getFullYear()}-${_two(d.getMonth()+1)}-${_two(d.getDate())}`;
const todayIso = localIso(now);
const shiftIso = (iso, n) => { const d = new Date(+iso.slice(0,4), +iso.slice(5,7)-1, +iso.slice(8,10)); d.setDate(d.getDate()+n); return localIso(d); };
const tomorrowIso = shiftIso(todayIso, 1);

// this note's own frontmatter → banner choice + theme mode/cache (all set from the Settings note)
let _selfFm = {};
try { const _self = app.vault.getAbstractFileByPath(dv.current().file.path); _selfFm = (app.metadataCache.getFileCache(_self) || {}).frontmatter || {}; } catch(e){}

/* vault variant: template */
const NAME = (_selfFm.name || "there");
const BANNER_FALLBACK_PATH = "Images/System Images/storm-banner.png";
const BANNER_FALLBACK_NAME = "storm-banner";

// banner image — chosen in Settings (stormBanner), else first in Images/Banner/, else the bundled default
let bannerSrc = "", bannerPath = "";
try {
  const IMGEXT = ["png","jpg","jpeg","webp","gif","avif","bmp"];
  let bf = null;
  if (_selfFm.stormBanner) bf = app.vault.getAbstractFileByPath(String(_selfFm.stormBanner));
  if (!bf) bf = app.vault.getFiles()
        .filter(f => f.path.startsWith("Images/Banner/") && IMGEXT.includes((f.extension||"").toLowerCase()))
        .sort((a,b) => a.name.localeCompare(b.name))[0]
    || app.vault.getAbstractFileByPath(BANNER_FALLBACK_PATH)
    || app.metadataCache.getFirstLinkpathDest(BANNER_FALLBACK_NAME,"");
  if (bf) { bannerPath = bf.path; try { bannerSrc = app.vault.adapter.getResourcePath(bf.path); } catch(e2){ bannerSrc = app.vault.getResourcePath(bf); } }
} catch(e){ console.error("banner", e); }

// theme mode — "community" (inherit the installed Obsidian theme, default) or "match" (palette from the banner).
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

// paths the hub writes back to
const templatePath = "_templates/Daily Note Template.md";

// daily notes → streak + calendar dots
const daily = dv.pages('"Daily"');
const isoOf = p => { try { return p.date ? p.date.toISODate() : p.file.name.slice(0,10); } catch(e){ return p.file.name.slice(0,10); } };
const dset = new Set(daily.map(p => isoOf(p)));
let streak = 0; { const dd = new Date(now); dd.setHours(0,0,0,0); if(!dset.has(localIso(dd))) dd.setDate(dd.getDate()-1); while(dset.has(localIso(dd))){ streak++; dd.setDate(dd.getDate()-1); } }

// stats (no longer rendered on the hub — kept for ⚙️ Settings / back-compat)
const mdCount = app.vault.getMarkdownFiles().length;
const allCount = app.vault.getFiles().length;
let folders = 0; try { folders = app.vault.getAllLoadedFiles().filter(f => f && f.children !== undefined).length - 1; } catch(e){}
let tagCount = 0; try { tagCount = Object.keys(app.metadataCache.getTags()).length; } catch(e){}
const stats = { notes: mdCount, attachments: Math.max(0, allCount - mdCount), folders: Math.max(0, folders), tags: tagCount, streak };

// today's note (loaded once) → one thing + shutdown + pomodoro session count
const todayName = todayIso + " " + days[now.getDay()];
const todayPage = daily.find(p => p.file.name === todayName) || null;
const todayExists = !!todayPage;
let todayTxt = "";
try { if (todayPage) todayTxt = await dv.io.load(todayPage.file.path) || ""; } catch(e){}
let oneThing = null;
try { const seg = todayTxt.split(/##\s*🎯[^\n]*\n/)[1]; if (seg) { const body = seg.split(/\n#{2,3}\s/)[0]; const mm = body.match(/→\s*(\S.*)/); if (mm) oneThing = mm[1].trim(); } } catch(e){}
const shutdown = { win: "", next: "" };
try {
  const L = todayTxt.split("\n");
  const afterLabel = s => String(s).replace(/^\s*\*\*[^*]*\*\*\s*/,"").trim();
  const w = L.find(l => /^\s*\*\*\s*(?:Win of the day|What got done)\s*:?\s*\*\*/i.test(l));
  if (w) shutdown.win = afterLabel(w);
  const n2 = L.find(l => /^\s*\*\*\s*(?:One next step[^*]*|Next concrete step[^*]*)\*\*/i.test(l));
  if (n2) shutdown.next = afterLabel(n2);
} catch(e){}
let pomSessions = 0, pomMinutes = 0;
try {
  let mm = [...todayTxt.matchAll(/WORK\s*\(\s*(\d+)\s*m\)/gi)];
  if (!mm.length) mm = [...todayTxt.matchAll(/pomodoro\s*::\s*WORK[^)]*\)\s*\(\s*duration\s*::\s*(\d+)\s*m/gi)];
  pomSessions = mm.length;
  pomMinutes = mm.reduce((a,x)=>a+(parseInt(x[1])||0),0);
} catch(e){}

/* ---------- GOAL SYSTEM (SPEC §1 / §2 / §3.7) ---------- */
// SPEC §2 exclusions + §3.7 text cleaning. These four constants are the shared
// contract with _scripts/goal-panel.txt, 🎯 Goals.md, 📋 Tasks.md and the daily
// tables — keep them byte-identical there.
const EXCL_RE = /(^|\/)(Fitness|_templates|_archive|Archive|\.trash)(\/|$)/i;
const SUBSEC = /sub[-\s]?tasks?/i;
const HABIT_RE = /(^|\s)#habit(\/[\p{L}\p{N}_/-]+)*(?=$|\s)/u;
const clean = t => String(t==null?"":t)
  .replace(/(?:📅|⏳|🛫|✅|➕|🔁)\s*\d{4}-\d{2}-\d{2}/g, " ")
  .replace(/[📅⏳🛫✅➕🔁]/gu, " ")
  .replace(/(?:⏫|🔼|🔽|⏬|🔺)/g, " ")
  .replace(/\s+\^[A-Za-z0-9-]+$/, " ")
  .replace(/(^|\s)#(?=[^\s]*[\p{L}_])[\p{L}\p{N}_\/-]+/gu, "$1")
  .replace(/\s+/g, " ").trim();
const secOf = t => { const s = t && (t.section || t.header); return s ? String(s.subpath || s.display || "") : ""; };
/* SPEC §1 — a checkbox is a sub-task when ANY heading in the hierarchy above it matches
   SUBSEC: walk the note's headings keeping a stack by level (a level-L heading pops every
   heading of level >= L), so `## Sub-tasks` › `### Phase 1` still counts while a following
   `## 🗒️ Notes` closes the section. No Sub-tasks heading anywhere → every checkbox counts.
   Blank boxes and #habit lines never count. Identical in Dashboard.md / goal-panel.txt /
   🎯 Goals.md / 📋 Tasks.md / daily-tables.txt — keep it that way. */
function subMarks(path){
  let hs = [];
  try { const f = app.vault.getAbstractFileByPath(path); hs = (f && (app.metadataCache.getFileCache(f)||{}).headings) || []; } catch(e){ hs = []; }
  const marks = [], stack = [];
  for(const h of hs){
    const lvl = h.level || 1;
    const ln = (h.position && h.position.start) ? h.position.start.line : 0;
    while(stack.length && stack[stack.length-1].lvl >= lvl) stack.pop();
    stack.push({ lvl: lvl, sub: SUBSEC.test(String(h.heading||"")) });
    marks.push({ line: ln, under: stack.some(x => x.sub) });
  }
  return marks;
}
function subsOf(p){
  let all = [];
  try { all = Array.from(p.file.tasks || []); } catch(e){ all = []; }
  const marks = subMarks(p.file.path);
  const underAt = ln => { let u = false; for(const m of marks){ if(m.line < ln) u = m.under; else break; } return u; };
  let list = all;
  if(marks.some(m => m.under)) list = all.filter(t => underAt(t.line != null ? t.line : -1));
  else if(all.some(t => SUBSEC.test(secOf(t)))) list = all.filter(t => SUBSEC.test(secOf(t)));
  return list.filter(t => !HABIT_RE.test(String(t.text||"")) && clean(t.text)!=="");
}
const isHabitTask = t => { try { return HABIT_RE.test(String(t.text||"")) || (t.tags||[]).some(x => /^#habit(\/|$)/.test(String(x))); } catch(e){ return false; } };
const dIso = v => { try {
    if (v == null || v === "") return "";
    if (typeof v === "object") { if (typeof v.toISODate === "function") return v.toISODate(); if (v.path) return ""; }
    const m = String(v).match(/\d{4}-\d{2}-\d{2}/); return m ? m[0] : "";
  } catch(e){ return ""; } };
// `goal:` may be a Dataview Link {path}, "[[Name]]", "[[Name|alias]]", a bare name,
// a full "Goals/Name.md" path, or an ARRAY of any of those (SPEC §5). Same rules as
// goal-panel.txt / 🎯 Goals.md / 📋 Tasks.md.
const baseOf = s => String(s==null?"":s).split("/").pop().replace(/\.md$/i,"");
function linkNames(v, out){
  out = out || [];
  if(v==null) return out;
  if(Array.isArray(v) || v.__isDA===true){ Array.from(v).forEach(x=>linkNames(x,out)); return out; }
  let raw = "";
  if(typeof v==="object") raw = String(v.path || v.display || (typeof v.toString==="function" ? v.toString() : ""));
  else raw = String(v);
  raw = raw.trim().replace(/^!?\[\[/,"").replace(/\]\]$/,"");
  raw = raw.split("|")[0].split("#")[0].trim();
  if(raw) out.push(raw);
  return out;
}
// every comparable key a `goal:` value yields, lower-cased (links resolve case-insensitively)
const linkKeys = v => { try {
    const out = [];
    linkNames(v).forEach(r => { out.push(String(r).toLowerCase()); out.push(baseOf(r).toLowerCase()); });
    return out;
  } catch(e){ return []; } };
// SPEC §2 — health is shared with the goal panel; keep the formula identical.
// HEALTH contract: `opts` = { overdue, dated, remaining } — overdue = unchecked
// sub-tasks whose 📅 is strictly BEFORE today (due today is not overdue, it is the
// chart's st-today state), dated = any sub-task carries a 📅 at all, remaining =
// unchecked count. This is the older ISO-string shape of the rule the four
// standalone notes carry byte-identically; the behaviour must match them exactly.
function healthOf(status, progress, startIso, endIso, opts){
  if (status === "done") return "done";
  if(String(status||"").toLowerCase()==="paused") return "paused";
  if (!startIso || !endIso) return "unscheduled";
  const s = Date.parse(startIso+"T00:00:00"), e = Date.parse(endIso+"T00:00:00"), t = Date.parse(todayIso+"T00:00:00");
  if (isNaN(s) || isNaN(e)) return "unscheduled";
  const o = opts || {};
  if (o.dated) {
    const over = Number(o.overdue) || 0, left = Number(o.remaining) || 0;
    if (endIso < todayIso && left > 0) return "behind";
    return over === 0 ? "ok" : over === 1 ? "risk" : "behind";
  }
  // No sub-task carries a date, so there is no deadline to measure: fall back to the
  // pacing rule unchanged (projected bars already assume even pacing across the window).
  const span = e - s;
  let el = span > 0 ? (t - s)/span : (t >= e ? 1 : 0);
  el = Math.max(0, Math.min(1, el));
  const gap = (progress||0) - el;
  return gap >= -0.10 ? "ok" : gap >= -0.30 ? "risk" : "behind";
}

let TASKS = [], GOALS = [];
try {
  const tPages = dv.pages('"Tasks"').where(p => p && p.type === "task" && !EXCL_RE.test(String(p.file.path))).array();
  TASKS = tPages.map(p => {
    const src = subsOf(p);
    const subs = src.map(t => ({
      text: clean(t.text),
      raw: String(t.text||""),
      line: (t.line != null ? t.line : -1),
      due: t.due ? t.due.toISODate() : "",
      done: !!t.completed,
      completion: t.completion ? t.completion.toISODate() : ""
    })).filter(s => s.text !== "");
    const done = subs.filter(s => s.done).length, total = subs.length;
    const progress = total ? done/total : 0;
    const open = subs.filter(s => !s.done);
    const dated = open.filter(s => s.due).slice().sort((a,b) => a.due < b.due ? -1 : a.due > b.due ? 1 : a.line - b.line);
    const status = String(p.status || "active").toLowerCase().trim();
    const start = dIso(p.start), end = dIso(p.end);
    // HEALTH contract — counted here, where the sub-tasks are already walked. These
    // three travel with the task so the goal roll-up below can total them.
    const hOpts = { overdue: open.filter(s => s.due && s.due < todayIso).length,
                    dated: subs.some(s => !!s.due), remaining: open.length };
    return {
      name: p.file.name, path: p.file.path, goalKeys: linkKeys(p.goal), goalName: "", goalPath: "", goalHealth: "unscheduled",
      status, start, end, completed: dIso(p.completed), subs, done, total, progress,
      // PAUSE §1 — a task with no goal is paused only by its own status; the goal
      // loop below ORs in its goal's. Never written back to the note.
      paused: status === "paused",
      hOpts,
      health: healthOf(status, progress, start, end, hOpts),
      nextMove: dated[0] || open[0] || null,
      allDone: total > 0 && open.length === 0
    };
  });

  const gPages = dv.pages('"Goals"').where(p => p && p.type === "goal" && !EXCL_RE.test(String(p.file.path))).array();
  GOALS = gPages.map(p => {
    const key = String(p.file.name).toLowerCase(), keyPath = String(p.file.path).toLowerCase();
    const mine = TASKS.filter(t => t.goalKeys.some(k => k === key || k === keyPath));
    const sDone = mine.reduce((a,t) => a + t.done, 0), sTot = mine.reduce((a,t) => a + t.total, 0);
    const progress = sTot ? sDone/sTot : (mine.length ? mine.filter(t => t.status === "done").length / mine.length : 0);
    const starts = mine.map(t => t.start).filter(Boolean).sort();
    const ends = mine.map(t => t.end).filter(Boolean).sort();
    const target = dIso(p.target);
    const gStart = starts[0] || "";
    const gEnd = target || (ends.length ? ends[ends.length-1] : "");
    const status = String(p.status || "active").toLowerCase().trim();
    // HEALTH contract — a goal's overdue is the total across its non-paused tasks, run
    // through the same thresholds. PAUSE §3: paused work is not late, so it is excluded
    // from the total and from the "is there a deadline anywhere" fork.
    const liveT = mine.filter(t => t.status !== "paused" && t.status !== "done");
    const gOpts = { overdue: liveT.reduce((a,t) => a + t.hOpts.overdue, 0),
                    dated: liveT.some(t => t.hOpts.dated),
                    remaining: liveT.reduce((a,t) => a + t.hOpts.remaining, 0) };
    const health = healthOf(status, progress, gStart, gEnd, gOpts);
    // PAUSE §1 — the cascade is COMPUTED here, alongside goalName/goalPath/goalHealth:
    // a task's effective paused = own status paused OR its goal's. Nothing is written.
    mine.forEach(t => { t.goalName = p.file.name; t.goalPath = p.file.path; t.goalHealth = health;
                        t.paused = t.paused || status === "paused";
                        if (t.paused) t.health = healthOf("paused", t.progress, t.start, t.end, t.hOpts); });
    return { name: p.file.name, path: p.file.path, area: p.area ? String(p.area) : "", status, target,
             start: gStart, end: gEnd, health, progress, tasks: mine, nTasks: mine.length,
             paused: status === "paused",
             nActive: mine.filter(t => t.status === "active").length };
  });
} catch(e){ console.error("goals/tasks", e); TASKS = TASKS||[]; GOALS = GOALS||[]; }

// PAUSE §3 — the single chokepoint: nextMoves / overdue / dueToday / pulse all read
// this list, so an effective-paused task goes quiet everywhere at once.
const activeTasks = TASKS.filter(t => t.status === "active" && !t.paused);
const rowOf = (t, s) => ({ text: s.text, raw: s.raw, path: t.path, line: s.line, due: s.due, done: s.done,
                           taskName: t.name, taskPath: t.path, goalName: t.goalName, goalPath: t.goalPath,
                           risk: (t.goalHealth === "risk" || t.goalHealth === "behind") });
const nextMoves = [], overdue = [], dueToday = [];
activeTasks.forEach(t => {
  if (t.nextMove) nextMoves.push(rowOf(t, t.nextMove));
  (t.subs||[]).forEach(s => {
    if (s.done || !s.due) return;
    if (s.due < todayIso) overdue.push(rowOf(t, s));
    else if (s.due === todayIso) dueToday.push(rowOf(t, s));
  });
});
const byDue = (a,b) => (a.due||"") < (b.due||"") ? -1 : (a.due||"") > (b.due||"") ? 1 : 0;
overdue.sort(byDue); dueToday.sort(byDue);

// SPEC §2 — inbox: unchecked, non-blank, non-#habit boxes under `## ⚡` in the last 7 daily notes
let inbox = [];
try {
  const cutoff = shiftIso(todayIso, -6);
  const recent = daily.array().filter(p => { const iso = isoOf(p); return iso && iso >= cutoff && iso <= todayIso; })
                             .sort((a,b) => isoOf(b).localeCompare(isoOf(a)));
  for (const p of recent) {
    for (const t of p.file.tasks) {
      if (t.completed) continue;
      if (!/⚡/.test(String((t.section && t.section.subpath) || ""))) continue;
      if (isHabitTask(t)) continue;
      const txt = clean(t.text);
      if (!txt) continue;
      inbox.push({ text: txt, raw: String(t.text||""), path: p.file.path, line: (t.line != null ? t.line : -1),
                   due: t.due ? t.due.toISODate() : "", done: false,
                   taskName: (isoOf(p) === todayIso ? "" : isoOf(p)), taskPath: p.file.path });
    }
  }
} catch(e){ console.error("inbox", e); }

// SPEC §3.5 — this week's pulse
const mondayIso = shiftIso(todayIso, -((now.getDay()+6)%7));
const iso14 = shiftIso(todayIso, -14);
const doneThisWeek = TASKS.reduce((a,t) => a + t.subs.filter(s => s.done && s.completion && s.completion >= mondayIso && s.completion <= todayIso).length, 0);
const stale = activeTasks.filter(t => {
  if (t.nextMove && t.nextMove.due && t.nextMove.due < iso14) return true;
  const last = t.subs.filter(s => s.completion).map(s => s.completion).sort().pop();
  return !last || last < iso14;
}).length;
const pulse = { doneThisWeek, activeTasks: activeTasks.length, stale, streak };
const strip = {
  nm: nextMoves.length, today: dueToday.length, over: overdue.length,
  risk: GOALS.filter(g => g.status !== "done" && !g.paused && (g.health === "risk" || g.health === "behind")).length,
  focus: pomSessions, goal: 8, streak
};

// calendar (current month)
const cal = {
  title: months[now.getMonth()] + " " + now.getFullYear(),
  year: now.getFullYear(),
  month: now.getMonth(),
  first: new Date(now.getFullYear(), now.getMonth(), 1).getDay(),
  days: new Date(now.getFullYear(), now.getMonth()+1, 0).getDate(),
  today: now.getDate(),
  has: [...dset].filter(x => x && x.startsWith(`${now.getFullYear()}-${_two(now.getMonth()+1)}-`)).map(x => parseInt(x.slice(8,10),10))
};

// habits (heatmap + per-habit streaks) from #habit tasks in Daily notes — unchanged.
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
  addFrom(todayPage);
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
try { if (todayPage) { for (const t of todayPage.file.tasks) { for (const h of habitDefs) { if (t.tags && t.tags.some(x => x === h.tag || String(x).startsWith(h.tag + "/"))) { todayHabitByTag[h.tag] = { done: !!t.completed, path: todayPage.file.path, line: (t.line != null ? t.line : null) }; } } } } } catch(e){}
const hrows = habitDefs.map(h => { const set = hmap[h.tag]; const week = []; for (let i=0;i<7;i++){ const dc = new Date(monday); dc.setDate(monday.getDate()+i); week.push(set.has(localIso(dc))); } const th = todayHabitByTag[h.tag] || {}; return { label:h.label, streak:curStreak(set), week, todayDone: !!th.done, path: th.path||"", line: (th.line!=null?th.line:null) }; });
const habits = { heat, rows: hrows, weekTodayIdx: dow };

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
  const meta = f => { const b=(f.basename||f.name.replace(/\.[^.]+$/,"")); const parts=b.split(" - "); return parts.length>=2 ? {artist:parts[0].trim(), title:parts.slice(1).join(" - ").trim()} : {artist:"", title:b}; };
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

// today's note path (for write-back) + pomodoro "focus" (Next up)
let todayPath = "Daily/" + todayName + ".md";
let focus = "";
try { if (todayPage) { todayPath = todayPage.file.path; if (todayPage.focus != null) focus = String(todayPage.focus); } } catch(e){}

const data = {
  bannerSrc, theme, mode: themeMode, matchSrc, matchBannerPath, selfPath: dv.current().file.path,
  name: NAME, todayNoteName: todayName, todayIso, tomorrowIso, todayPath, templatePath, todayExists,
  stats, oneThing, shutdown,
  goals: GOALS, tasks: TASKS, nextMoves, overdue, dueToday, inbox, pulse, strip,
  pomodoro: { sessionsToday: pomSessions, minutesToday: pomMinutes, goal: 8, task: focus },
  cal, habits, music, reading, notes: notesList, workout, graph, jobs
};

this.container.innerHTML = buildHub(data);
initHub(this.container.querySelector(".storm-hub"), app);

} catch(err) {
  this.container.innerHTML = '<div style="color:#e0736b;padding:18px;font-family:sans-serif">⚡ Storm hub error: ' + err.message + '</div>';
  console.error(err);
}
```
