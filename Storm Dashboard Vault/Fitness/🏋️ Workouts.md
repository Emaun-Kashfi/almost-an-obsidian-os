---
cssclasses:
  - workouts-moc
tags:
  - moc
  - workout
schedule:
  Monday: Calisthenics Strength
  Tuesday: Muay Thai
  Wednesday: Cardio & Conditioning
  Thursday: Calisthenics Strength
  Friday: Muay Thai
  Saturday: Mobility & Recovery
  Sunday: Rest
---

```dataviewjs
try {
const box = this.container;
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
const two = n => String(n).padStart(2,"0");
const localIso = d => `${d.getFullYear()}-${two(d.getMonth()+1)}-${two(d.getDate())}`;

const sched = dv.current().schedule || {};
const order = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const now = new Date();
const todayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][now.getDay()];
const icons = {"Calisthenics Strength":"🏋️","Muay Thai":"🥊","Cardio & Conditioning":"🏃","Mobility & Recovery":"🧘","Rest":"😴"};

// history from completed #workout tasks in Daily notes
const daily = dv.pages('"Daily"');
const isoOf = p => { try { return p.date ? p.date.toISODate() : p.file.name.slice(0,10); } catch(e){ return p.file.name.slice(0,10); } };
const wset = new Set(); const doneDays = [];
for (const p of daily) { for (const t of p.file.tasks) { if (t.completed && t.tags && t.tags.some(x => String(x).startsWith("#workout"))) { const iso = isoOf(p); if(!wset.has(iso)){ wset.add(iso); doneDays.push({ iso, name: p.file.name, path: p.file.path }); } break; } } }
let streak = 0; { const dd = new Date(now); dd.setHours(0,0,0,0); if(!wset.has(localIso(dd))) dd.setDate(dd.getDate()-1); while(wset.has(localIso(dd))){ streak++; dd.setDate(dd.getDate()-1); } }
doneDays.sort((a,b) => b.iso.localeCompare(a.iso));
// this-week count
const monday = new Date(now); monday.setHours(0,0,0,0); monday.setDate(monday.getDate() - ((now.getDay()+6)%7));
let weekCount = 0; for (let i=0;i<7;i++){ const d = new Date(monday); d.setDate(monday.getDate()+i); if (wset.has(localIso(d))) weekCount++; }

const dayCards = order.map(day => {
  const sess = sched[day] || "Rest";
  const rest = String(sess).toLowerCase() === "rest";
  const ic = icons[sess] || "🏋️";
  const isToday = day === todayName;
  return `<div class="wday${isToday?' today':''}${rest?' rest':''}"${!rest?` data-link="${esc(sess)}"`:''}>
    <div class="wd">${day.slice(0,3)}</div><div class="wic">${ic}</div><div class="ws">${esc(sess)}</div>${isToday?'<div class="wtag">TODAY</div>':''}</div>`;
}).join("");

const routines = ["Calisthenics Strength","Muay Thai","Cardio & Conditioning","Mobility & Recovery"];
const routineChips = routines.map(r => `<span class="wchip" data-link="${esc(r)}">${icons[r]} ${esc(r)}</span>`).join("");
const recent = doneDays.slice(0,12).map(d => `<div class="wlogrow" data-link="${esc(d.path)}">✅ ${esc(d.name)}</div>`).join("") || '<div class="empty">No workouts logged yet — hit “＋ Log in today\'s note” on your dashboard.</div>';

box.innerHTML = `<div class="wm">
  <div class="wm-head"><span class="h">🏋️ Workouts</span><span class="n">🔥 ${streak}-day streak · ${weekCount}/6 this week · ${wset.size} logged all-time</span></div>
  <div class="wm-sub">Your fixed weekly schedule — click a day to open its routine. Rearrange by editing the <code>schedule</code> in this note's properties.</div>
  <div class="wgrid">${dayCards}</div>
  <div class="wm-h2">Routines</div>
  <div class="wroutines">${routineChips}</div>
  <div class="wm-h2">Recent sessions</div>
  <div class="wlog">${recent}</div>
</div>`;

const root = box.querySelector(".wm");
root.querySelectorAll("[data-link]").forEach(el => { el.style.cursor="pointer"; el.addEventListener("click", () => { const l = el.getAttribute("data-link"); if (l) app.workspace.openLinkText(l, "", false); }); });

} catch(err){ this.container.innerHTML = '<div style="color:#e0736b;padding:16px;font-family:sans-serif">🏋️ Workouts error: ' + err.message + '</div>'; console.error(err); }
```
