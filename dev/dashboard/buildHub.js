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
