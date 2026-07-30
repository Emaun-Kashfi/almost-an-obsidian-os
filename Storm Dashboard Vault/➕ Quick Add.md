---
cssclasses:
  - quickadd
tags:
  - moc
---

```dataviewjs
try {
const box = this.container;
const g = (typeof window !== "undefined") ? window : globalThis;
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const two = n => String(n).padStart(2,"0");
const todayIso = (()=>{ const d=new Date(); return `${d.getFullYear()}-${two(d.getMonth()+1)}-${two(d.getDate())}`; })();
const sanitize = s => String(s||"").replace(/[\\/:*?"<>|#^\[\]]/g,"").replace(/\s+/g," ").trim().replace(/\.+$/,"").trim().slice(0,120);
const y = v => (v===""||v==null) ? "" : JSON.stringify(String(v));
const tagLines = (base, extra) => {
  const t = [...base];
  String(extra||"").split(",").map(x=>x.trim()).filter(Boolean).forEach(x=>{ if(!t.includes(x)) t.push(x); });
  return ["tags:", ...t.map(x=>"  - "+x)];
};
const bullets = txt => String(txt||"").split("\n").map(x=>x.trim()).filter(Boolean);

const F = (key,label,type,opts={}) => ({key,label,type,...opts});
const REMOTE = ["","Remote","Hybrid","On-site"];

const TYPES = {
  job: { icon:"💼", label:"Job", folder:"Job Search/Applications",
    fields:[
      F("company","Company","text",{req:true}), F("role","Role","text",{ph:"Digital Content Manager"}),
      F("status","Status","select",{options:["saved","applied","screen","interview","final","offer","rejected","archived"],def:"saved"}),
      F("applied","Date applied","date"), F("deadline","Deadline","date"),
      F("location","Location","text",{ph:"Washington, DC"}),
      F("remote","Remote?","select",{options:REMOTE}),
      F("link","Posting link","url"), F("salary","Salary","text"),
      F("source","Source","text",{ph:"LinkedIn"}),
      F("priority","Priority","select",{options:["","high","normal"]}),
    ],
    name:d => d.company + (d.role ? " — "+d.role : ""),
    fm:d => ["tags:","  - application", `company: ${y(d.company)}`, `role: ${y(d.role)}`,
      `status: ${d.status||"saved"}`, `applied: ${d.applied||""}`, `deadline: ${d.deadline||""}`,
      `link: ${y(d.link)}`, `location: ${y(d.location)}`, `remote: ${y(d.remote)}`, `salary: ${y(d.salary)}`,
      `source: ${y(d.source)}`, "contact: ", `priority: ${d.priority||""}`, "next: "],
    body:d => `# ${d.__name}\n\n> Set **status** (saved → applied → screen → interview → final → offer) and the properties above — your [[💼 Job Search]] board updates automatically.\n\n## 📝 Job description\n\n\n## 🎤 Interviews & timeline\n- \n\n## 🗒️ Notes\n- \n` },

  recipe: { icon:"🍳", label:"Recipe", folder:"Recipes",
    fields:[
      F("name","Name","text",{req:true,ph:"Lentil soup"}),
      F("meal","Meal type","select",{options:["breakfast","lunch","dinner","dessert","snack"],def:"dinner"}),
      F("cuisine","Cuisine","text",{ph:"Persian"}),
      F("servings","Servings","number"), F("time","Time (min)","number"),
      F("calories","Calories","number"), F("protein","Protein (g)","number"),
      F("carbs","Carbs (g)","number"), F("fats","Fats (g)","number"),
      F("source","Source / link","url"),
      F("ingredients","Ingredients (one per line)","textarea",{ph:"1 cup red lentils\n1 onion, diced"}),
      F("steps","Instructions (one per line)","textarea",{ph:"Sauté the onion\nAdd lentils and broth"}),
    ],
    name:d => d.name,
    fm:d => ["tags:","  - recipe", `type: ${d.meal||"dinner"}`, `cuisine: ${y(d.cuisine)}`,
      `calories: ${d.calories||""}`, `protein: ${d.protein||""}`, `carbs: ${d.carbs||""}`, `fats: ${d.fats||""}`,
      `servings: ${d.servings||""}`, `time: ${d.time||""}`, `source: ${y(d.source)}`],
    body:d => {
      const ing = bullets(d.ingredients).map(x=>"- "+x).join("\n") || "- ";
      const steps = bullets(d.steps).map((x,i)=>(i+1)+". "+x).join("\n") || "1. ";
      return `# ${d.__name}\n\n[[🍽️ Recipe Index|← Recipes]]\n\n## Ingredients\n${ing}\n\n## Instructions\n${steps}\n\n## Notes\n\n`; } },

  project: { icon:"🚀", label:"Project", folder:"Projects",
    fields:[
      F("name","Name","text",{req:true}), F("area","Area","text",{ph:"Career · Health · Business"}),
      F("status","Status","select",{options:["active","someday","done"],def:"active"}),
      F("annual","Annual goal?","select",{options:["false","true"],def:"false"}),
    ],
    name:d => d.name,
    fm:d => ["type: project", `status: ${d.status||"active"}`, `area: ${y(d.area)}`, `annual: ${d.annual||"false"}`],
    body:d => `# ${d.__name}\n\n> New project. Add milestones as checkboxes — your dashboard tracks % done automatically.\n\n## Milestones\n- [ ] First milestone\n` },

  book: { icon:"📚", label:"Book", folder:"Reading",
    fields:[
      F("title","Title","text",{req:true}), F("author","Author","text"),
      F("status","Status","select",{options:["want","reading","done"],def:"want"}),
      F("progress","Progress (0–100)","number"),
    ],
    name:d => d.title,
    fm:d => ["tags:","  - book", `title: ${y(d.title)}`, `author: ${y(d.author)}`,
      `status: ${d.status||"want"}`, `progress: ${d.progress||0}`, "color: ", "Cover: ", "File: "],
    body:d => `# ${d.__name}\n\n${d.author?"by "+esc(d.author)+"\n\n":""}> Set **progress** (0–100) and **status** in the properties. To read a PDF inside Obsidian, see [[📖 How to add book files]].\n\n## Notes\n- \n` },

  note: { icon:"🗒️", label:"Note", folder:"Note Bank",
    fields:[
      F("title","Title","text",{req:true}), F("topic","Topic","text"),
      F("source","Source","text"), F("tags","Tags (comma-sep)","text"),
    ],
    name:d => d.title,
    fm:d => [`date: ${todayIso}`, ...tagLines(["note"], d.tags), "type: note", "status: inbox",
      `topic: ${y(d.topic)}`, `source: ${y(d.source)}`],
    body:d => `# ${d.__name}\n\n` },

  org: { icon:"🏢", label:"Org", folder:"Job Search/Organizations",
    fields:[
      F("name","Name","text",{req:true}),
      F("category","Category","select",{options:["conservation","rockville-gaithersburg","other"],def:"other"}),
      F("otype","Type","select",{options:["employer","recruiter"],def:"employer"}),
      F("location","Location","text"), F("careers","Careers URL","url"), F("website","Website","url"),
    ],
    name:d => d.name,
    fm:d => ["tags:","  - org", `name: ${y(d.name)}`, `category: ${d.category||"other"}`, `type: ${d.otype||"employer"}`,
      `location: ${y(d.location)}`, `careers: ${y(d.careers)}`, `website: ${y(d.website)}`],
    body:d => `# ${d.__name}\n\n> **Following for jobs.** Matching jobs are grouped on [[🏢 Organizations]].\n` },
};

let cur = "job";

function fieldHtml(f){
  const id = "qa_"+f.key;
  let input;
  if (f.type === "select")
    input = `<select id="${id}" data-k="${f.key}">${f.options.map(o=>`<option value="${esc(o)}"${o===(f.def||"")?" selected":""}>${o===""?"—":esc(o)}</option>`).join("")}</select>`;
  else if (f.type === "textarea")
    input = `<textarea id="${id}" data-k="${f.key}" rows="4" placeholder="${esc(f.ph||"")}"></textarea>`;
  else {
    const t = f.type==="date"?"date":(f.type==="number"?"number":(f.type==="url"?"url":"text"));
    input = `<input id="${id}" data-k="${f.key}" type="${t}" placeholder="${esc(f.ph||"")}"${f.def?` value="${esc(f.def)}"`:""} autocomplete="off">`;
  }
  return `<div class="qa-field${f.type==="textarea"?" wide":""}"><label for="${id}">${esc(f.label)}${f.req?' <span class="qreq">*</span>':''}</label>${input}</div>`;
}

function render(){
  const t = TYPES[cur];
  box.innerHTML = `<div class="qa">
    <div class="qa-head"><span class="h">➕ Quick Add</span><span class="n">Pick a type, fill it in, press <b>Create</b> — it drops a ready-made note in the right folder.</span></div>
    <div class="qa-tabs">${Object.entries(TYPES).map(([k,v])=>`<button class="qa-pill${k===cur?" on":""}" data-t="${k}">${v.icon} ${esc(v.label)}</button>`).join("")}</div>
    <div class="qa-form">${t.fields.map(fieldHtml).join("")}</div>
    <div class="qa-actions"><button class="qa-create" data-create>Create ${t.icon}</button><span class="qa-msg" data-msg></span></div>
  </div>`;
  wire();
}

function msg(text, bad){ const m = box.querySelector("[data-msg]"); if(!m) return; m.textContent = text; m.className = "qa-msg" + (bad?" bad":" ok"); }

async function ensureFolder(p){ if(!g.app.vault.getAbstractFileByPath(p)){ try{ await g.app.vault.createFolder(p); }catch(e){} } }

async function create(openIt){
  const t = TYPES[cur]; const d = {};
  box.querySelectorAll("[data-k]").forEach(el => d[el.getAttribute("data-k")] = (el.value||"").trim());
  const miss = t.fields.filter(f => f.req && !d[f.key]);
  if (miss.length){ msg("Fill in: " + miss.map(f=>f.label).join(", "), true); return; }
  const nm = sanitize(t.name(d)) || (t.label + " " + todayIso);
  d.__name = nm;
  const btn = box.querySelector("[data-create]"); if(btn){ btn.disabled = true; }
  try {
    await ensureFolder(t.folder);
    let path = t.folder + "/" + nm + ".md";
    if (g.app.vault.getAbstractFileByPath(path)) path = t.folder + "/" + nm + " " + Date.now() + ".md";
    const fm = t.fm(d).filter(x => x != null).join("\n");
    const content = `---\n${fm}\n---\n\n` + t.body(d);
    const nf = await g.app.vault.create(path, content);
    msg("Created “" + nm + "” ✓");
    render();
    try { g.app.metadataCache.trigger("dataview:refresh-views"); } catch(e){}
    if (openIt && g.app.workspace) g.app.workspace.openLinkText(nf.path, "", false);
  } catch(e){ msg("Couldn't create: " + e.message, true); if(btn) btn.disabled = false; }
}

function wire(){
  box.querySelectorAll(".qa-pill").forEach(p => p.addEventListener("click", () => { cur = p.getAttribute("data-t"); render(); }));
  box.querySelectorAll("[data-create]").forEach(b => b.addEventListener("click", () => create(true)));
  box.querySelectorAll(".qa-form input, .qa-form select").forEach(inp => {
    inp.addEventListener("keydown", ev => { if(ev.key==="Enter"){ ev.preventDefault(); create(true); } });
  });
}

render();

} catch(err){ this.container.innerHTML = '<div style="color:#e0736b;padding:16px;font-family:sans-serif">➕ Quick Add error: ' + err.message + '</div>'; console.error(err); }
```
