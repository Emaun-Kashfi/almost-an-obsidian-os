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

