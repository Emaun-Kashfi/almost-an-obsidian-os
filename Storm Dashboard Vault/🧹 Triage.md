---
cssclasses:
  - dashboard
tags:
  - dashboard
---

# 🧹 Triage

[[Dashboard|← Dashboard]]

> Loose checkboxes from the last 42 days of daily notes, plus anything still sitting in Note Bank. Send each line into a task's **Sub-tasks**, into **today's inbox**, or **drop** it (dropped lines are logged to `_archive/Triage log.md`, never silently deleted). Habits, workouts, shutdown/reflection sections and already-completed items are left alone. Done triaging when the list is empty.

```dataviewjs
try {
/* ============================================================
   🧹 TRIAGE — one screen for sorting stale checkboxes into the
   goal/task system. Self-contained: no helpers from Dashboard.md.
   Every write = app.vault.read → verify the exact raw line → splice
   → app.vault.modify. Notes are never rewritten from a template.
   ============================================================ */

const ROOT = (this && this.container) ? this.container : dv.container;

/* ---------- tuning ---------- */
const DAYS_BACK = 42;      // how far back in Daily/ we look
const OLD_DAYS  = 21;      // "older than N days" bulk drop
const LOG_PATH  = "_archive/Triage log.md";
const LOG_DIR   = "_archive";

/* ---------- regexes ---------- */
const EXCLUDE_SEG = /(^|\/)(_templates|\.trash|_archive|Archive|Fitness)(\/|$)/i;
const SKIP_HEAD   = /habit|workout|shutdown|reflection|pomodoro|completed/i;
const UNCHECKED   = /^\s*[-*+]\s+\[ \]\s*(.*)$/;      // "- [ ] text" / "* [ ] text"
const ISBOX       = /^\s*[-*+]\s+\[[^\]]\]/;          // any checkbox line
const HEADING     = /^(#{1,6})\s+(.*)$/;
const FENCE       = /^\s*(?:```|~~~)/;
const EMO         = "📅|⏳|🛫|✅|➕|⏫|🔼|🔽|⏬|🔁";
/* the one #habit rule, shared with the Dashboard / goal panel / daily tables */
const HABIT_RE    = /(^|\s)#habit(\/[\p{L}\p{N}_/-]+)*(?=$|\s)/u;

/* ---------- tiny helpers (local equivalents of the hub's) ---------- */
const _two  = n => String(n).padStart(2, "0");
const _esc  = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const _norm = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const localIso = d => d.getFullYear() + "-" + _two(d.getMonth() + 1) + "-" + _two(d.getDate());
const NOW      = new Date();
const TODAY    = localIso(NOW);
const TODAY_PATH = "Daily/" + TODAY + " " + DOW[NOW.getDay()] + ".md";

function isoToDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function ageDays(iso) {
  const d = isoToDate(iso), t = isoToDate(TODAY);
  return (d && t) ? Math.round((t.getTime() - d.getTime()) / 86400000) : null;
}
function fmtShort(iso) {
  const d = isoToDate(iso);
  return d ? (MON[d.getMonth()] + " " + d.getDate()) : "";
}
function notice(msg) {
  try { if (typeof require !== "undefined") { const ob = require("obsidian"); new ob.Notice(String(msg), 5000); } } catch (e) {}
}
function refresh() {
  try { app.metadataCache.trigger("dataview:refresh-views"); } catch (e) {}
}

/* strip Tasks-plugin emoji (+ their dates) and #tags for display / for re-writing */
function cleanText(raw) {
  return String(raw == null ? "" : raw)
    .replace(new RegExp("\\s*(?:" + EMO + ")\\s*\\d{4}-\\d{2}-\\d{2}", "g"), " ")
    .replace(new RegExp("\\s*(?:" + EMO + ")\\s*", "g"), " ")
    .replace(/(^|\s)#[\p{L}\p{N}_\/-]+/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
function dueOf(raw) {
  const m = /📅\s*(\d{4}-\d{2}-\d{2})/.exec(String(raw || ""));
  return m ? m[1] : "";
}

/* ---------- which notes do we scan? ---------- */
function pagesIn(folder) {
  try { return dv.pages('"' + folder + '"').array(); } catch (e) { return []; }
}
function noteIso(p) {
  const v = p ? p.date : null;
  if (v) {
    if (typeof v === "string") { const s = v.slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; }
    else if (typeof v.toISODate === "function") { const s = v.toISODate(); if (s) return s; }
    else if (v instanceof Date) return localIso(v);
    else { const s = String(v).slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; }
  }
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(p && p.file ? p.file.name : "");
  return m ? m[1] : "";
}

const scan = [];
pagesIn("Daily").forEach(p => {
  if (!p || !p.file || EXCLUDE_SEG.test(p.file.path)) return;
  const iso = noteIso(p);
  const age = ageDays(iso);
  if (age == null || age < 0 || age > DAYS_BACK) return;   // outside the window (or undatable)
  scan.push({ page: p, iso: iso, age: age });
});
pagesIn("Note Bank").forEach(p => {
  if (!p || !p.file || EXCLUDE_SEG.test(p.file.path)) return;
  const iso = noteIso(p);
  scan.push({ page: p, iso: iso, age: ageDays(iso) });
});

/* ---------- collect candidate lines (read the text, track headings) ---------- */
async function readText(path) {
  const f = app.vault.getAbstractFileByPath(path);
  if (!f) return null;
  try { return await (app.vault.cachedRead ? app.vault.cachedRead(f) : app.vault.read(f)); }
  catch (e) { return null; }
}

const cands = [];
for (const s of scan) {
  const path = s.page.file.path;
  const text = await readText(path);
  if (text == null) continue;
  const lines = text.split("\n");
  let head = "", fence = false;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (FENCE.test(L)) { fence = !fence; continue; }
    if (fence) continue;
    const hm = HEADING.exec(L);
    if (hm) { head = hm[2].trim(); continue; }
    const bm = UNCHECKED.exec(L);
    if (!bm) continue;
    const rest = bm[1];
    if (!rest.trim()) continue;                 // blank box "- [ ] "
    if (HABIT_RE.test(rest)) continue;          // habit line (#habit or #habit/x — not #habitat)
    if (/✅/.test(rest)) continue;              // already completed
    if (head && SKIP_HEAD.test(head)) continue; // habit / workout / shutdown / reflection / pomodoro / completed section
    const clean = cleanText(rest);
    if (!clean) continue;                       // nothing but emoji/tags
    cands.push({
      path: path, name: s.page.file.name, line: i, raw: L,
      clean: clean, due: dueOf(rest), iso: s.iso, age: s.age, head: head, gone: false
    });
  }
}
cands.sort((a, b) => {
  const ka = a.iso || "9999-99-99", kb = b.iso || "9999-99-99";
  if (ka !== kb) return ka < kb ? -1 : 1;         // oldest first, undated last
  if (a.path !== b.path) return a.path < b.path ? -1 : 1;
  return a.line - b.line;
});

/* ---------- destination tasks for the select ---------- */
function goalName(v) {
  if (!v) return "";
  if (typeof v === "string") return v.replace(/^\[\[|\]\]$/g, "").replace(/\|.*$/, "").split("/").pop().replace(/\.md$/, "");
  if (v.display) return String(v.display).split("/").pop().replace(/\.md$/, "");
  if (v.path) return String(v.path).split("/").pop().replace(/\.md$/, "");
  return String(v).replace(/^\[\[|\]\]$/g, "");
}
/* PAUSE §3 — a paused goal's tasks are not somewhere to send new work either.
   The cascade is computed here (never written): own status, or the goal's. */
const pausedGoals = new Set();
pagesIn("Goals").forEach(g => {
  if (!g || !g.file || EXCLUDE_SEG.test(g.file.path) || g.type !== "goal") return;
  if (String(g.status == null ? "" : g.status).toLowerCase().trim() !== "paused") return;
  pausedGoals.add(String(g.file.path).toLowerCase());
  pausedGoals.add(String(g.file.name).toLowerCase());
});
function underPausedGoal(p) {
  const n = goalName(p && p.goal);
  if (!n) return false;
  const k = String(n).toLowerCase();
  return pausedGoals.has(k) || pausedGoals.has(k + ".md") || pausedGoals.has("goals/" + k + ".md");
}
const tasks = pagesIn("Tasks")
  .filter(p => p && p.file && !EXCLUDE_SEG.test(p.file.path) && p.type === "task" &&
               (p.status === "active" || p.status === "backlog") && !underPausedGoal(p))
  .map(p => ({ name: p.file.name, path: p.file.path, status: p.status, goal: goalName(p.goal) }))
  .sort((a, b) => (a.status === b.status)
    ? (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1)
    : (a.status === "active" ? -1 : 1));

/* ---------- render ---------- */
const selHtml = tasks.length
  ? '<select class="tr-sel">' + tasks.map(t =>
      '<option value="' + _esc(t.path) + '">' + _esc(t.goal ? (t.name + " — " + t.goal) : t.name) + "</option>"
    ).join("") + "</select>"
  : '<select class="tr-sel" disabled><option value="">no task notes yet</option></select>';

function rowHtml(c, i) {
  const badge = c.due
    ? '<span class="tr-due nm-date' + (c.due < TODAY ? " over" : (c.due === TODAY ? " today" : "")) + '">📅 ' + _esc(fmtShort(c.due)) + "</span>"
    : "";
  const when = c.iso
    ? (fmtShort(c.iso) + " · " + (c.age === 0 ? "today" : (c.age === 1 ? "1 day ago" : c.age + " days ago")))
    : "no date";
  return '<div class="tr-row" data-idx="' + i + '" data-path="' + _esc(c.path) + '" data-line="' + c.line +
         '" data-age="' + (c.age == null ? "" : c.age) + '" data-find="' + _esc((c.clean + " " + c.name).toLowerCase()) + '">' +
           '<div class="tr-body">' +
             '<div class="tr-line"><span class="tr-text">' + _esc(c.clean) + "</span>" + badge + "</div>" +
             '<div class="tr-src"><a class="internal-link" data-link="' + _esc(c.path) + '">' + _esc(c.name) + "</a>" +
               '<span class="tr-when">' + _esc(when) + "</span></div>" +
           "</div>" +
           '<div class="tr-acts">' + selHtml +
             '<button class="tr-btn pill" data-act="sub" title="Append to the chosen task\'s Sub-tasks and remove it here">→ Sub-task</button>' +
             '<button class="tr-btn pill" data-act="inbox" title="Move into today\'s ⚡ Tasks">→ Inbox</button>' +
             '<button class="tr-btn pill" data-act="drop" title="Remove it and log it to _archive/Triage log.md">Drop</button>' +
           "</div>" +
         "</div>";
}

const host = document.createElement("div");
host.className = "storm-hub";
host.innerHTML =
  '<div class="card triage">' +
    "<h3>🧹 Triage <span class=\"sp tr-count\">" + cands.length + " items from " +
      (new Set(cands.map(c => c.path))).size + " notes</span></h3>" +
    '<div class="tr-tools">' +
      '<input class="addinput tr-filter" type="text" placeholder="Filter…">' +
      '<button class="tr-btn pill tr-bulk" title="Drops every listed line from a note older than ' + OLD_DAYS + ' days. Two clicks.">Drop everything older than ' + OLD_DAYS + " days</button>" +
    "</div>" +
    '<div class="tr-hint">Oldest first. Sub-task = real work. Inbox = do it today. Drop = it is logged, not lost.</div>' +
    '<div class="tr-list">' + cands.map(rowHtml).join("") + "</div>" +
    '<div class="empty tr-empty">Nothing left to triage — the backlog of loose checkboxes is clear. 🎉</div>' +
  "</div>";
ROOT.appendChild(host);

const listEl  = host.querySelector(".tr-list");
const countEl = host.querySelector(".tr-count");
const emptyEl = host.querySelector(".tr-empty");
const bulkBtn = host.querySelector(".tr-bulk");
const filtEl  = host.querySelector(".tr-filter");
const BULK_LABEL = "Drop everything older than " + OLD_DAYS + " days";

function updateCount() {
  const rows = Array.prototype.slice.call(listEl.querySelectorAll(".tr-row"));
  const notes = new Set(rows.map(r => r.getAttribute("data-path")));
  countEl.textContent = rows.length + " items from " + notes.size + " notes";
  emptyEl.style.display = rows.length ? "none" : "";
}
updateCount();

/* ---------- exact-line writing helpers ---------- */
async function locate(c) {
  const f = app.vault.getAbstractFileByPath(c.path);
  if (!f) return { f: null, lines: null, idx: -1 };
  const lines = (await app.vault.read(f)).split("\n");
  let idx = (c.line >= 0 && c.line < lines.length && lines[c.line] === c.raw) ? c.line : -1;
  if (idx < 0) idx = lines.indexOf(c.raw);
  if (idx < 0) { const n = _norm(c.raw); idx = lines.findIndex(l => ISBOX.test(l) && _norm(l) === n); }
  return { f: f, lines: lines, idx: idx };
}
async function removeLine(c) {
  const at = await locate(c);
  if (!at.f || at.idx < 0) return false;
  at.lines.splice(at.idx, 1);
  await app.vault.modify(at.f, at.lines.join("\n"));
  return true;
}
/* append `line` at the END of the section opened by headRe (before the next heading / EOF);
   create the section at EOF when it is missing. Only splices — never rewrites the note. */
function insertInSection(lines, headRe, headText, line) {
  let h = -1;
  for (let i = 0; i < lines.length; i++) { if (headRe.test(lines[i])) { h = i; break; } }
  if (h < 0) {
    if (lines.length && lines[lines.length - 1].trim() !== "") lines.push("");
    lines.push(headText);
    h = lines.length - 1;
  }
  let end = h + 1;
  while (end < lines.length && !/^#{1,6}\s/.test(lines[end])) end++;
  let at = end;
  while (at - 1 > h && lines[at - 1].trim() === "") at--;
  lines.splice(at, 0, line);
  return at;
}
async function ensureFolder(p) {
  try { if (!app.vault.getAbstractFileByPath(p)) await app.vault.createFolder(p); } catch (e) {}
}
async function getToday() {
  let f = app.vault.getAbstractFileByPath(TODAY_PATH);
  if (f) return f;
  try { if (app.commands) app.commands.executeCommandById("daily-notes"); } catch (e) {}
  for (let i = 0; i < 16; i++) {                  // ~2.5 s, same as the dashboard
    await sleep(160);
    f = app.vault.getAbstractFileByPath(TODAY_PATH);
    if (f) return f;
  }
  return app.vault.getAbstractFileByPath(TODAY_PATH);
}

/* ---------- the three actions ---------- */
async function toSubtask(c, row) {
  const sel = row.querySelector(".tr-sel");
  const tp  = sel ? sel.value : "";
  if (!tp) { notice("Create a task note first — then triage into it."); return false; }
  const tf = app.vault.getAbstractFileByPath(tp);
  if (!tf) { notice("Couldn't find that task note."); return false; }
  const at = await locate(c);
  if (!at.f || at.idx < 0) { notice("That line isn't in " + c.name + " any more — refresh the page."); return false; }
  const label = tp.split("/").pop().replace(/\.md$/, "");
  const line  = "- [ ] " + c.clean + (c.due ? " 📅 " + c.due : "");
  const tl = (await app.vault.read(tf)).split("\n");
  insertInSection(tl, /^#{1,6}\s+.*sub[-\s]?tasks?\b/i, "## Sub-tasks", line);
  await app.vault.modify(tf, tl.join("\n"));
  const removed = await removeLine(c);
  notice(removed ? ("Moved to " + label) : ("Added to " + label + " — the original line had moved, remove it by hand."));
  return true;
}

async function toInbox(c) {
  const f = await getToday();
  if (!f) { notice("Couldn't open today's daily note."); return false; }
  const sameNote = (f.path === c.path);
  if (sameNote && /⚡/.test(c.head || "")) { notice("Already in today's ⚡ inbox."); return false; }
  if (!sameNote) {
    const at = await locate(c);
    if (!at.f || at.idx < 0) { notice("That line isn't in " + c.name + " any more — refresh the page."); return false; }
  }
  const lines = (await app.vault.read(f)).split("\n");
  insertInSection(lines, /^#{1,6}\s*⚡/, "## ⚡ Tasks", c.raw.replace(/^\s+/, ""));
  await app.vault.modify(f, lines.join("\n"));
  if (!sameNote) await removeLine(c);
  notice(sameNote ? "Added under ⚡ in today's note." : "Moved to today's inbox");
  return true;
}

async function logDrop(c) {
  await ensureFolder(LOG_DIR);
  const entry = "- " + TODAY + " · " + c.clean + " · (from [[" + c.name + "]])";
  let f = app.vault.getAbstractFileByPath(LOG_PATH);
  if (!f) {
    try { await app.vault.create(LOG_PATH, "# Triage log\n\n" + entry + "\n"); return; }
    catch (e) { f = app.vault.getAbstractFileByPath(LOG_PATH); if (!f) throw e; }
  }
  let txt = await app.vault.read(f);
  if (txt.length && !/\n$/.test(txt)) txt += "\n";
  await app.vault.modify(f, txt + entry + "\n");
}
async function toDrop(c, quiet) {
  const removed = await removeLine(c);
  if (!removed) { if (!quiet) notice("That line isn't in " + c.name + " any more — refresh the page."); return false; }
  await logDrop(c);
  if (!quiet) notice("Dropped — logged to " + LOG_PATH);
  return true;
}

/* ---------- wiring ---------- */
let busy = false;
async function doAction(act, row, c) {
  if (busy) return;
  busy = true;
  row.classList.add("busy");
  let ok = false;
  try {
    if (act === "sub") ok = await toSubtask(c, row);
    else if (act === "inbox") ok = await toInbox(c);
    else if (act === "drop") ok = await toDrop(c, false);
  } catch (e) {
    notice("Triage couldn't write that: " + (e && e.message ? e.message : e));
    console.error("triage action", e);
  }
  row.classList.remove("busy");
  if (ok) { c.gone = true; row.remove(); updateCount(); refresh(); }
  busy = false;
}

listEl.addEventListener("click", async ev => {
  const link = ev.target.closest ? ev.target.closest("a[data-link]") : null;
  if (link) {
    ev.preventDefault(); ev.stopPropagation();
    try { app.workspace.openLinkText(link.getAttribute("data-link"), "", false); } catch (e) {}
    return;
  }
  const btn = ev.target.closest ? ev.target.closest("button[data-act]") : null;
  if (!btn) return;
  ev.preventDefault(); ev.stopPropagation();
  const row = btn.closest(".tr-row"); if (!row) return;
  const c = cands[+row.getAttribute("data-idx")];
  if (!c || c.gone) { row.remove(); updateCount(); return; }
  await doAction(btn.getAttribute("data-act"), row, c);
});

filtEl.addEventListener("input", () => {
  const q = filtEl.value.trim().toLowerCase();
  Array.prototype.slice.call(listEl.querySelectorAll(".tr-row")).forEach(r => {
    r.style.display = (!q || (r.getAttribute("data-find") || "").indexOf(q) >= 0) ? "" : "none";
  });
});

/* bulk drop — two clicks, applied sequentially, oldest rows only */
let armed = false, armTimer = null;
function oldRows() {
  return Array.prototype.slice.call(listEl.querySelectorAll(".tr-row")).filter(r => {
    const a = r.getAttribute("data-age");
    return a !== "" && a != null && Number(a) > OLD_DAYS;
  });
}
function disarm() {
  armed = false;
  bulkBtn.classList.remove("armed");
  bulkBtn.textContent = BULK_LABEL;
  if (armTimer) { clearTimeout(armTimer); armTimer = null; }
}
bulkBtn.addEventListener("click", async ev => {
  ev.preventDefault();
  if (busy) return;
  const rows = oldRows();
  if (!rows.length) { disarm(); notice("Nothing older than " + OLD_DAYS + " days."); return; }
  if (!armed) {
    armed = true;
    bulkBtn.classList.add("armed");
    bulkBtn.textContent = "Click again to drop " + rows.length + " item" + (rows.length === 1 ? "" : "s");
    armTimer = setTimeout(disarm, 6000);
    return;
  }
  disarm();
  busy = true; bulkBtn.disabled = true;
  let n = 0;
  for (const r of rows) {
    const c = cands[+r.getAttribute("data-idx")];
    if (!c || c.gone) { r.remove(); continue; }
    let ok = false;
    try { ok = await toDrop(c, true); } catch (e) { console.error("triage bulk", e); }
    if (ok) { c.gone = true; n++; r.remove(); }
  }
  bulkBtn.disabled = false; busy = false;
  updateCount(); refresh();
  notice("Dropped " + n + " item" + (n === 1 ? "" : "s") + " older than " + OLD_DAYS + " days → " + LOG_PATH);
});

} catch (err) {
  const d = document.createElement("div");
  d.className = "triage-error";
  d.setAttribute("style", "color:#e0736b;padding:18px;font-family:sans-serif");
  d.textContent = "🧹 Triage error: " + (err && err.message ? err.message : err);
  ((this && this.container) ? this.container : dv.container).appendChild(d);
  console.error(err);
}
```
