'use strict';

/*
 * Storm Reader — reading companion plugin for the Storm dashboard vault.
 *
 *  1. Selection popup in book notes: highlight, colored/typed highlight+note, dismiss.
 *  2. Auto-bookmark: remembers your page in a PDF and writes it back to the book note
 *     (also fills the total page count and progress). Plus a "capture page" command.
 *  3. "Look up book details" command: fills author / pages / cover from Open Library.
 *
 * Saved highlight notes match what the in-note Reading companion panel creates, so the
 * panel list and the 📓 Highlights index pick them up automatically.
 */

const obsidian = require('obsidian');
const { Plugin, MarkdownView, Notice, Modal, requestUrl } = obsidian;

const HLDIR = 'Reading/Highlights';
const HTYPES = [
  { key: 'note',     dot: '🟡', label: 'Note',     cls: 'shl-note' },
  { key: 'idea',     dot: '🔵', label: 'Idea',     cls: 'shl-idea' },
  { key: 'favorite', dot: '🟢', label: 'Favorite', cls: 'shl-fav'  },
  { key: 'question', dot: '🔴', label: 'Question', cls: 'shl-q'    },
];
const sanitize = s => String(s).replace(/[\\/:*?"<>|#^\[\]]/g, '').replace(/\s+/g, ' ').trim();
const normKey = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 90);
const two = n => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`; };

module.exports = class StormReader extends Plugin {
  async onload() {
    this.popup = null;
    this.pdfWatch = null;   // { pdfPath, bookPath }

    // ---- selection popup ----
    this.registerDomEvent(document, 'mouseup', (e) => {
      if (this.popup && this.popup.contains(e.target)) return;
      window.setTimeout(() => this.maybeShow(), 0);
    });
    this.registerDomEvent(document, 'keyup', (e) => {
      if (e.key === 'Escape') { this.hide(); return; }
      window.setTimeout(() => this.maybeShow(), 0);
    });
    this.registerDomEvent(document, 'mousedown', (e) => {
      if (this.popup && !this.popup.contains(e.target)) this.hide();
    });
    this.registerDomEvent(document, 'scroll', () => this.hide(), true);

    // ---- auto-bookmark ----
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => { this.hide(); this.onLeafChange(); }));
    this.registerInterval(window.setInterval(() => this.captureWatched(false), 8000));

    // ---- commands ----
    this.addCommand({ id: 'capture-page', name: 'Capture current PDF page as bookmark', callback: () => this.captureWatched(true) });
    this.addCommand({ id: 'lookup-book', name: 'Look up book details (Open Library)', checkCallback: (checking) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      const ok = view && this.isBookNote(view.file);
      if (ok && !checking) this.lookupBook(view.file);
      return ok;
    }});

    this.onLeafChange();
  }

  onunload() { this.hide(); }

  // ---------- book detection ----------
  isBookNote(file) {
    if (!file) return false;
    const cache = this.app.metadataCache.getFileCache(file) || {};
    const fm = cache.frontmatter || {};
    const fmTags = [].concat(fm.tags || []).map(t => String(t).replace(/^#/, '').toLowerCase());
    if (fmTags.includes('book')) return true;
    const bodyTags = (cache.tags || []).map(t => String(t.tag || '').replace(/^#/, '').toLowerCase());
    return bodyTags.includes('book');
  }

  // ---------- selection popup ----------
  maybeShow() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.editor) { this.hide(); return; }
    const sel = view.editor.getSelection();
    if (!sel || !sel.trim()) { this.hide(); return; }
    if (!this.isBookNote(view.file)) { this.hide(); return; }
    this.showPopup(view.editor, view.file);
  }

  showPopup(editor, file) {
    this.hide();
    const winSel = window.getSelection();
    if (!winSel || !winSel.rangeCount) return;
    const rect = winSel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return;

    const pop = document.createElement('div');
    pop.className = 'storm-hl-pop';
    pop.style.cssText = 'position:fixed;z-index:9999;display:flex;gap:2px;align-items:center;' +
      'background:var(--background-secondary,#232529);border:1px solid var(--background-modifier-border,#3a3d44);' +
      'border-radius:9px;padding:3px;box-shadow:0 6px 22px rgba(0,0,0,.30);font-size:12.5px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;';

    const mkBtn = (label, title, extra, cb) => {
      const b = document.createElement('button');
      b.textContent = label; b.title = title;
      b.style.cssText = 'font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;border:none;background:transparent;' +
        'color:var(--text-normal,#dfe1e4);padding:5px 9px;border-radius:6px;display:inline-flex;align-items:center;' +
        'gap:5px;white-space:nowrap;line-height:1.2;' + (extra || '');
      b.addEventListener('mouseenter', () => { b.style.background = 'var(--background-modifier-hover,#2b2e33)'; });
      b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; });
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); cb(); });
      return b;
    };
    const sep = () => { const s = document.createElement('span'); s.style.cssText = 'width:1px;height:18px;background:var(--background-modifier-border,#3a3d44);margin:0 2px;'; return s; };

    pop.appendChild(mkBtn('🖊️ Highlight', 'Highlight the selection', '', () => this.doHighlight(editor)));
    pop.appendChild(mkBtn('📝 + Note', 'Highlight and save it as a linked note', 'color:var(--interactive-accent,#4c8bf5);', () => this.doHighlightNote(editor, file, '', 'note')));
    pop.appendChild(sep());
    for (const t of HTYPES) {
      pop.appendChild(mkBtn(t.dot, t.label + ' — colored highlight + note', 'padding:5px 6px;', () => this.doColorNote(editor, file, t)));
    }
    pop.appendChild(sep());
    pop.appendChild(mkBtn('✕', 'Dismiss', 'color:var(--text-muted,#9aa0a8);padding:5px 8px;', () => this.hide()));

    document.body.appendChild(pop);
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let top = rect.top - ph - 6; if (top < 8) top = rect.bottom + 6;
    let left = rect.left + rect.width / 2 - pw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    pop.style.top = top + 'px'; pop.style.left = left + 'px';
    this.popup = pop;
  }

  wrap(s) { const t = s.trim(); if (/^==[\s\S]+==$/.test(t)) return s; return '==' + s + '=='; }
  wrapMark(s, cls) { return `<mark class="shl ${cls}">` + s + '</mark>'; }

  doHighlight(editor) {
    const sel = editor.getSelection();
    if (sel) editor.replaceSelection(this.wrap(sel));
    this.hide();
  }
  async doHighlightNote(editor, file, _note, type) {
    const sel = editor.getSelection();
    if (!sel || !sel.trim()) { this.hide(); return; }
    const text = sel.trim();
    editor.replaceSelection(this.wrap(sel));
    await this.saveHl(file, text, type || 'note');
    this.hide();
  }
  async doColorNote(editor, file, t) {
    const sel = editor.getSelection();
    if (!sel || !sel.trim()) { this.hide(); return; }
    const text = sel.trim();
    editor.replaceSelection(this.wrapMark(sel, t.cls));
    await this.saveHl(file, text, t.key);
    this.hide();
  }
  async saveHl(file, text, type) {
    try { await this.createHighlight(file, text, type); new Notice('Highlight saved to its own note.'); }
    catch (e) { console.error('storm-reader', e); new Notice('Could not save the highlight: ' + e.message); }
  }

  async ensureFolder(p) {
    if (!this.app.vault.getAbstractFileByPath(p)) { try { await this.app.vault.createFolder(p); } catch (e) {} }
  }
  async createHighlight(file, text, type) {
    const bookName = file.basename;
    const fm = (this.app.metadataCache.getFileCache(file) || {}).frontmatter || {};
    const page = (fm.page != null && fm.page !== '') ? fm.page : '';
    await this.ensureFolder('Reading'); await this.ensureFolder(HLDIR);
    const snip = sanitize(text).slice(0, 52) || 'highlight';
    let path = `${HLDIR}/${sanitize(bookName)} — ${snip}.md`;
    if (this.app.vault.getAbstractFileByPath(path)) path = `${HLDIR}/${sanitize(bookName)} — ${snip} ${Date.now()}.md`;
    const quote = text.split(/\n/).map(l => '> ' + l).join('\n');
    const typeLine = (type && type !== 'note') ? `type: ${type}\n` : '';
    const body = `---\ntags:\n  - highlight\nbook: "[[${bookName}]]"\npage: ${page}\n${typeLine}created: ${todayIso()}\nkey: ${JSON.stringify(normKey(text))}\n---\n\n${quote}\n`;
    return this.app.vault.create(path, body);
  }

  // ---------- auto-bookmark ----------
  onLeafChange() {
    // capture whatever we were watching before switching
    this.captureWatched(false);
    this.pdfWatch = null;
    const leaf = this.app.workspace.activeLeaf;
    const view = leaf && leaf.view;
    if (!view) return;
    const vt = view.getViewType && view.getViewType();
    if (vt !== 'pdf') return;
    const pdfFile = view.file;
    if (!pdfFile) return;
    const book = this.findBookForPdf(pdfFile.path);
    if (book) this.pdfWatch = { pdfPath: pdfFile.path, bookPath: book.path };
  }

  findBookForPdf(pdfPath) {
    for (const f of this.app.vault.getMarkdownFiles()) {
      const fm = (this.app.metadataCache.getFileCache(f) || {}).frontmatter;
      if (!fm) continue;
      const isBook = [].concat(fm.tags || []).map(t => String(t).replace(/^#/, '').toLowerCase()).includes('book');
      if (!isBook) continue;
      const fileRef = fm.File || fm.file || fm.pdf;
      if (!fileRef) continue;
      const link = String(fileRef).replace(/^!?\[\[/, '').replace(/\]\]$/, '').replace(/\|.*$/, '').trim();
      const dest = this.app.metadataCache.getFirstLinkpathDest(link, f.path) || this.app.vault.getAbstractFileByPath(link);
      if (dest && dest.path === pdfPath) return f;
      if (link && pdfPath.endsWith(link)) return f;
    }
    return null;
  }

  readPdfState(view) {
    try { const v = (view.viewer && view.viewer.child && view.viewer.child.pdfViewer) || (view.viewer && view.viewer.pdfViewer);
      if (v && v.currentPageNumber) return { page: v.currentPageNumber, pages: v.pagesCount || 0 }; } catch (e) {}
    try { const s = view.getState && view.getState(); if (s && s.page) return { page: Number(s.page) || 0, pages: 0 }; } catch (e) {}
    return null;
  }

  async captureWatched(announce) {
    let leaf = this.app.workspace.activeLeaf;
    let view = leaf && leaf.view;
    let watch = this.pdfWatch;
    // for the manual command, also handle the currently-active pdf even if not yet tracked
    if (announce && view && view.getViewType && view.getViewType() === 'pdf' && view.file) {
      const b = this.findBookForPdf(view.file.path);
      if (b) watch = { pdfPath: view.file.path, bookPath: b.path };
    }
    if (!watch) { if (announce) new Notice('Open a PDF that a book note points to (its File property), then run this.'); return; }
    if (!view || !view.getViewType || view.getViewType() !== 'pdf' || !view.file || view.file.path !== watch.pdfPath) {
      // the watched pdf is no longer the active view; nothing reliable to read
      if (announce) new Notice('That PDF is not the active pane.');
      return;
    }
    const st = this.readPdfState(view);
    if (!st || !st.page) { if (announce) new Notice("Could not read the PDF's page number."); return; }
    const bookFile = this.app.vault.getAbstractFileByPath(watch.bookPath);
    if (!bookFile) return;
    const cur = (this.app.metadataCache.getFileCache(bookFile) || {}).frontmatter || {};
    const changed = Number(cur.page) !== st.page || (st.pages && Number(cur.pages) !== st.pages);
    if (!changed && !announce) return;
    await this.app.fileManager.processFrontMatter(bookFile, fm => {
      fm.page = st.page;
      if (st.pages) fm.pages = st.pages;
      const p = Number(fm.page) || 0, t = Number(fm.pages) || 0;
      if (t) fm.progress = Math.max(0, Math.min(100, Math.round(p / t * 100)));
      if (p > 0 && (!fm.status || ['want', 'to-read', 'want-to-read'].includes(String(fm.status).toLowerCase()))) fm.status = 'reading';
    });
    if (announce) new Notice(`Bookmarked page ${st.page}${st.pages ? ' of ' + st.pages : ''}.`);
  }

  // ---------- metadata lookup ----------
  async lookupBook(file) {
    const query = file.basename;
    new Notice('Looking up "' + query + '"…');
    let docs = [];
    try {
      const r = await requestUrl({ url: 'https://openlibrary.org/search.json?limit=5&fields=title,author_name,first_publish_year,number_of_pages_median,cover_i,key&q=' + encodeURIComponent(query) });
      docs = (r.json && r.json.docs) || [];
    } catch (e) { console.error(e); new Notice('Lookup failed (no network?).'); return; }
    if (!docs.length) { new Notice('No matches on Open Library for "' + query + '".'); return; }
    new BookPickModal(this.app, docs, (doc) => this.applyBook(file, doc)).open();
  }

  async applyBook(file, doc) {
    try {
      await this.app.fileManager.processFrontMatter(file, fm => {
        if (!fm.author && doc.author_name && doc.author_name.length) fm.author = doc.author_name[0];
        if ((fm.pages == null || fm.pages === '') && doc.number_of_pages_median) fm.pages = doc.number_of_pages_median;
        if (!fm.title) fm.title = doc.title;
        const p = Number(fm.page) || 0, t = Number(fm.pages) || 0;
        if (t && p) fm.progress = Math.max(0, Math.min(100, Math.round(p / t * 100)));
      });
      if (doc.cover_i) {
        await this.ensureFolder('Reading'); await this.ensureFolder('Reading/Covers');
        const coverPath = `Reading/Covers/${sanitize(file.basename)}.jpg`;
        if (!this.app.vault.getAbstractFileByPath(coverPath)) {
          const img = await requestUrl({ url: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` });
          if (img.arrayBuffer) await this.app.vault.createBinary(coverPath, img.arrayBuffer);
        }
      }
      new Notice('Filled in details from Open Library.');
    } catch (e) { console.error(e); new Notice('Could not apply details: ' + e.message); }
  }

  hide() { if (this.popup) { this.popup.remove(); this.popup = null; } }
};

class BookPickModal extends Modal {
  constructor(app, docs, onPick) { super(app); this.docs = docs; this.onPick = onPick; }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: 'Pick the matching book' });
    for (const d of this.docs) {
      const row = contentEl.createDiv();
      row.style.cssText = 'display:flex;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--background-modifier-border);border-radius:9px;margin-bottom:8px;cursor:pointer;';
      if (d.cover_i) { const im = row.createEl('img'); im.src = `https://covers.openlibrary.org/b/id/${d.cover_i}-S.jpg`; im.style.cssText = 'width:34px;height:auto;border-radius:3px;'; }
      const info = row.createDiv();
      info.createEl('div', { text: d.title || '(untitled)' }).style.cssText = 'font-weight:700;';
      info.createEl('div', { text: [(d.author_name && d.author_name[0]) || 'Unknown', d.first_publish_year, d.number_of_pages_median ? d.number_of_pages_median + 'p' : ''].filter(Boolean).join(' · ') }).style.cssText = 'font-size:12px;color:var(--text-muted);';
      row.addEventListener('mouseenter', () => row.style.background = 'var(--background-modifier-hover)');
      row.addEventListener('mouseleave', () => row.style.background = 'transparent');
      row.addEventListener('click', () => { this.onPick(d); this.close(); });
    }
  }
  onClose() { this.contentEl.empty(); }
}
