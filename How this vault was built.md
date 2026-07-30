# How I built my Almost OS for Obsidian

Reads and writes are separated. Every MOC and the dashboard only read. The daily note is the single write target for logging. Nothing that renders a view can corrupt the data, because rendering never mutates anything. When I do need to mutate from the UI (a status dropdown, a form), it goes through the vault API against a specific note, never against the view.

That split is the reason the thing has survived months of me hacking on it live.

## Stack and roles

Seven community plugins:

- **Dataview** renders every MOC and the dashboard. DataviewJS for anything with buttons, plain DQL where a table is enough.
- **Tasks** supplies the dated-task layer. The dashboard queries `file.tasks` and filters on `t.due`.
- **Templater** scaffolds daily notes and the per-type templates.
- **Homepage** boots the dashboard note on launch and on the mobile "home" button.
- **Calendar** drives daily-note creation and the dot markers.
- **Heatmap Calendar** is the habit grid renderer.
- **Pomodoro Timer** owns the actual timer; the dashboard mirrors its state.

Theme is Minimal. One CSS snippet, `storm.css`, holds every custom style. One custom plugin, `storm-winddown`, covered below.

## Folder and tag schema

```text
Personal Productivity/
├── Daily/                 # write target: tasks, #habit/*, #workout, focus
├── _MOCs/                 # 💼 Job Search, 🏢 Organizations, 📚 Books
├── Job Search/
│   ├── Applications/      # tag: application
│   └── Organizations/     # tag: org
├── Recipes/               # tag: recipe + Recipe Index, Meal Planner, Shopping List
├── Reading/{Files,Covers} # tag: book, PDFs, cover images
├── Projects/              # type: project
├── Habits/                # 🔥 Habit Tracker
├── Fitness/{Routines,demos}
├── Note Bank/
└── _templates/
```

Tag-to-schema map, so a query can find any slice in one line:

| Tag / key | Lives in | Key properties |
|---|---|---|
| `application` | Job Search/Applications | company, role, status, applied, remote, link, priority |
| `recipe` | Recipes | type, cuisine, calories, protein, servings, time |
| `book` | Reading | title, author, status, progress, Cover, File |
| `org` | Job Search/Organizations | name, category, type, careers |
| `type: project` | Projects | status, area, annual |
| `#habit/<slug>` | on tasks in Daily | (derived from checkbox state) |
| `#workout` | on tasks in Daily | (derived) |

## The dashboard: one DataviewJS block, authored as `buildHub` / `initHub`

The whole home page is a single DataviewJS block. It gathers, builds an HTML string, injects it, then wires events:

```js
const data = gather(dv);                       // read the vault
this.container.innerHTML = buildHub(data);     // pure: data -> HTML string
initHub(this.container.querySelector(".storm-hub")); // attach listeners
```

`buildHub(data)` has no side effects. That is deliberate. I keep `buildHub` and `initHub` in a standalone `hub.js` and run it against a mock `app` object under Playwright, so I can screenshot the dashboard and unit-test the render before it touches Obsidian. The note itself carries a `/*__HUBJS__*/` placeholder, and a one-line build step injects the current `hub.js` into it. Editing 700 lines of dashboard JS inside a Markdown code block is a bad time; this keeps it in a real file with a real test harness.

Gathering is ordinary DataviewJS. Tasks due today, across every note:

```js
const when = t => t.due || t.scheduled || t.start;
const tasks = dv.pages().file.tasks
  .where(t => !t.completed && when(t) && dv.date(when(t)) <= dv.date(todayIso))
  .array()
  .sort((a,b) => (dv.date(when(b))?.ts||0) - (dv.date(when(a))?.ts||0));
```

Widgets read from where the data actually lives: Today from `file.tasks` with due dates, Habits from completed `#habit/*` tasks, Jobs from `#application`, Projects from milestone checkbox ratios, Reading from `#book`, Workout from the day's scheduled routine. After any write I repaint with `app.metadataCache.trigger("dataview:refresh-views")`.

## Write-back: three APIs do everything interactive

Every button in the system uses one of these.

Edit a property (job status dropdown):

```js
await app.fileManager.processFrontMatter(file, fm => { fm.status = newStatus; });
```

Append to a note body (star a job, which drops a follow-up task):

```js
await app.vault.process(file, txt =>
  txt.replace(/(## ✅ To do\n)/, `$1- [ ] ⭐ Follow up on ${co} 📅 ${todayIso} #job\n`));
```

Create a note (Quick Add form, below):

```js
await app.vault.create(`${folder}/${name}.md`, `---\n${frontmatter}\n---\n\n${body}`);
```

`processFrontMatter` over hand-rolled YAML regex, always. It parses and rewrites the block for you and does not trip on quoting.

## Job board

`_MOCs/💼 Job Search.md` is a DataviewJS MOC. It maps `dv.pages("#application")` into row objects, groups by `status`, and renders a list per stage. Each row is interactive:

- Status `<select>` → `processFrontMatter` writes the new stage.
- Star → `vault.process` appends a `#job` follow-up task, so it surfaces on the dashboard's Today list.
- Note / expiry / delete buttons, with delete going through `app.fileManager.trashFile`.

`🏢 Organizations.md` reads the same `#application` pages but groups them by a normalized company key, so every role at one org sits together. Same data, second lens, zero duplication.

## Recipes into planner into shopping list

One source, three views. A recipe is a `#recipe` note with macros in frontmatter and ingredients as a bullet list under `## Ingredients`.

Recipe Index is straight DQL:

```text
TABLE WITHOUT ID file.link AS Recipe, servings AS Serves, cuisine AS Cuisine
FROM #recipe
WHERE protein >= 30
```

Meal Planner is a DataviewJS note that assigns recipes to weekdays and stores that assignment in its own frontmatter. Shopping List then reads the planned recipes, parses the bullets out of each one's `## Ingredients` section, and groups them by recipe. Edit a recipe once and both downstream views follow.

## Reading: cover wall plus in-note PDF

`📚 Books.md` renders `dv.pages("#book")` as cover cards, pulling `Cover`, `progress`, and `status`. Each book note also embeds its own file. A small block reads the `File` property, resolves the link, and drops the PDF inline:

```js
const dest = app.metadataCache.getFirstLinkpathDest(link, dv.current().file.path);
if (dest) dv.paragraph(`![[${dest.path}]]`);
```

Drop a PDF in `Reading/Files/`, point `File` at it, and you read it inside the note with the progress bar above it.

## Fitness: schedule in frontmatter, logging copies the checklist

`🏋️ Workouts.md` keeps the week as a map in its own properties:

```yaml
schedule:
  Monday: Calisthenics Strength
  Tuesday: Muay Thai
  Wednesday: Cardio & Conditioning
```

The block turns that into a seven-day grid, marks today, and computes a streak by scanning daily notes for completed `#workout` tasks. Each routine note holds a `## Session` checklist. The dashboard log action reads that checklist and splices it into today's note as `#workout` tasks, so I tick them off live and the streak recomputes.

The demos are the non-stock part. Each exercise has a looping GIF next to it. I generated 13 of them, checked the form against references, and dropped them in `Fitness/demos/`, embedded with `![[Fitness/demos/pushup.gif|320]]`.

## Habits and Pomodoro are derived, not stored

Habits are `#habit/<slug>` tasks in the daily notes (`#habit/move`, `#habit/water`, `#habit/read`, `#habit/language`, `#habit/sleep`). The tracker scans `file.tasks` across `Daily/`, counts completions per slug, and builds the heatmap and per-habit streaks from that. No habit database. The checkbox is the record.

Pomodoro Timer runs the sessions. The dashboard mirrors its state into a progress ring and adds a focus picker; selecting a task writes a `focus` property to today's note so the choice survives a refresh and syncs across devices.

## The wind-down plugin

DataviewJS only runs while a note is open. I wanted a wind-down banner at 9:30pm regardless of what is on screen. That needs background code, so it is a real plugin: a `manifest.json` and a `main.js` in `.obsidian/plugins/`. The core is a timer that toggles body classes; the CSS snippet paints the banner off those classes.

```js
module.exports = class extends require('obsidian').Plugin {
  async onload() {
    const tick = () => {
      const m = new Date().getHours() * 60 + new Date().getMinutes();
      document.body.classList.toggle('winddown', m >= 1290 && m < 1350);
      document.body.classList.toggle('obnoxious', m >= 1350 || m < 120);
    };
    tick();
    this.registerInterval(window.setInterval(tick, 15000));
  }
};
```

Add the folder name to `.obsidian/community-plugins.json` and reload to enable a local plugin. The rule of thumb: stay in DataviewJS until you need something to run without an open note, then write a plugin for exactly that slice.

## Quick Add: a schema-driven form

Editing YAML by hand on mobile is the worst part of any Obsidian system. So new entries go through a DataviewJS form. A `TYPES` object defines each entry type as fields plus a frontmatter builder:

```js
const TYPES = {
  job: {
    folder: "Job Search/Applications",
    fields: [F("company","Company","text",{req:true}), F("status","Status","select",{options:STAGES}) /* ... */],
    name: d => d.company + (d.role ? " — " + d.role : ""),
    fm:   d => ["tags:", "  - application", `company: ${y(d.company)}`, `status: ${d.status}` /* ... */],
  },
  // recipe, book, project, note, org ...
};
```

The renderer walks `fields` to draw inputs (text, `<select>`, date, number, textarea), validates required ones, sanitizes the filename, dedupes against existing paths, then calls `vault.create`. Adding a type is a schema entry, not new UI code.

## Styling: `cssclasses` plus per-component variables

Each MOC sets `cssclasses` in its frontmatter, and `storm.css` scopes styles under that class. The job board declares `cssclasses: [jobsearch-moc]` and the snippet targets `.jsm`. Every component block redefines its own CSS variables, so one snippet themes each page independently without collisions:

```css
.jsm { --accent:#5ec8e8; --surface:#141b23; --border:rgba(126,158,186,.16); }
.qa  { --accent:#5ec8e8; --surface:#141b23; /* Quick Add form owns its own vars */ }
```

A light, e-ink-style mode is a `theme-light` class the dashboard toggles, with each component carrying a flattened override set.

## Gotchas worth knowing

- DataviewJS renders on note open. Force a repaint after a write with `app.metadataCache.trigger("dataview:refresh-views")`.
- Keep dashboard JS pure and injected, not hand-edited in the note. You want version control and a test harness on anything over a hundred lines.
- Strip Tasks-plugin emoji from task text with a `u`-flagged regex. Without the flag you split a surrogate pair, and a lone surrogate inside a native `<select>` option gets base64-encoded on macOS. That one cost me an hour.
- `vault.create` will happily collide. Dedupe the path (append a timestamp) before you write.
- Heavy dashboards lag on phones. Gather less and render a lighter tree on mobile if you feel it.

The read/write split is the load-bearing decision. Views stay disposable and rebuildable; the daily note is the only thing holding state you cannot regenerate. That is why I can tear down and rewrite any dashboard on a whim without fear.