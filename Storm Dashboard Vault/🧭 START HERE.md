---
tags:
  - dashboard
cssclasses:
  - dashboard
---

# 🧭 START HERE

Welcome. This is a working Obsidian vault built around one DataviewJS dashboard: a job tracker, a recipe box, a reading shelf, a six-day training plan, a habit system, and a focus timer, all rendered from tagged Markdown. It ships with sample data so every widget is alive on first open. Follow the steps below (about 10 minutes) and it comes to life on your machine.

> [!tip]
> The dashboard is a DataviewJS note. Until you install the plugins below and turn on JavaScript queries, it will show a code block instead of the dashboard. That is normal — finish setup and it renders.

## 1. Install the community plugins

Open **Settings → Community plugins**. If you see "Turn on community plugins", click it (this is a local, offline setting). Then **Browse**, and for each of these: search it, **Install**, then **Enable**.

Required — nothing renders without these:

- **Dataview** — powers the dashboard and every board.
- **Tasks** — dated tasks that feed the Today card and streaks.
- **Templater** — auto-fills new daily, weekly, project, and recipe notes.
- **Calendar** — the month calendar; click a day to open its note.
- **Heatmap Calendar** — the habit heatmap.
- **Homepage** — opens the dashboard on startup.
- **Pomodoro Timer** — the focus timer the dashboard mirrors.

A custom plugin, **Storm Wind-Down**, is already bundled in this vault (`.obsidian/plugins/storm-winddown`). Just enable it in the Community plugins list.

## 2. Turn on two critical settings

These are the usual reason a vault "shows code instead of a dashboard."

1. **Dataview → Settings → Enable JavaScript Queries → ON** (also turn on Inline JavaScript Queries). The dashboard, heatmap, and boards are JavaScript queries and stay blank without this.
2. **Templater → Settings:** set **Template folder location** to `_templates`, and turn on **Trigger Templater on new file creation**. This is what fills a new daily note instead of leaving raw code.

## 3. Enable the look

**Settings → Appearance → CSS snippets** → click the refresh icon → toggle **storm** and **dashboard** on. The `storm` snippet styles the whole dashboard; `dashboard` styles the simpler board notes and hides the `#habit` plumbing tags.

## 4. Point Homepage at the dashboard

**Settings → Homepage** → set Homepage to `Dashboard`, and turn on "Open on startup." Now every launch lands you here.

## 5. Make it yours

- **Your name:** open `Dashboard`, and in its properties (top of the note) set **name** to your own. The greeting uses it.
- **Theme:** the dashboard's ⚙️ **Settings** pill (top nav) has two theme modes. **Community theme** (the default) makes the dashboard follow whatever Obsidian theme you have installed. **Match image** builds the dashboard's colors from your banner image instead. Pick either.
- **Banner:** in ⚙️ Settings, choose a banner or **Upload an image** to drop your own into `Images/Banner/`.
- **Clear the sample data** when you're ready: the notes in `Daily/`, `Job Search/Applications/`, `Recipes/`, `Reading/`, `Projects/`, and `Job Search/Organizations/` are examples. Delete them and add your own; the dashboard updates itself.

## 6. Your daily flow

1. Launch Obsidian → you land on the **Dashboard**.
2. Click **Today's note** (or a Calendar day) → a fresh daily note is created and auto-filled.
3. Set your **🎯 One thing**, add tasks, tick habits as you go.
4. Add a task from the dashboard's Today card, or in the daily note with a 📅 due date so it surfaces on the day.
5. Star a job, log a workout, run a focus session — all from the dashboard.

## 7. Add your own data

- **A job:** type "Company — Role" into the Job Search card, or use **➕ Quick Add**.
- **A project:** Cmd-P → *Templater: Create new note from template* → **Project Template**. It joins the Projects board automatically.
- **A recipe:** **Recipe Template** into `Recipes/`. Keep ingredients as a bullet list; the Shopping List reads them.
- **Anything:** the **➕ Quick Add** note has a form for jobs, recipes, books, projects, notes, and organizations.

## Troubleshooting

- **The dashboard shows raw code or a blank box** → Dataview isn't enabled, or "Enable JavaScript Queries" is off (Step 2). Try Reading view (Cmd-E).
- **A new daily note is full of `<% %>`** → Templater's "Trigger on new file creation" is off, or the template folder isn't `_templates` (Step 2).
- **The heatmap says to install the plugin** → install **Heatmap Calendar**, then tick a few habits in daily notes so there's data.
- **Nav buttons look like plain text / cards look unstyled** → enable the **storm** and **dashboard** CSS snippets (Step 3).

## How it was built

A full technical write-up of the architecture — the render model, the write-back APIs, the query behind each board, and the one custom plugin — is in **How this vault was built.md** at the root of this vault.
