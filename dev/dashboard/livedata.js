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

/* @@VARIANT@@ */
/* PLACEHOLDER — assemble_dashboard.py replaces everything between the two
   @@VARIANT@@ sentinels with the three constants from the variant's own
   dev/<variant>/variant.json. Nothing here reaches a built vault, so no vault's
   name or banner may be written here: edit variant.json instead.
   The values below only exist so this file parses on its own. */
const NAME = (_selfFm.name || "there");
const BANNER_FALLBACK_PATH = "Images/System Images/storm-banner.png";
const BANNER_FALLBACK_NAME = "storm-banner";
/* @@/VARIANT@@ */

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
