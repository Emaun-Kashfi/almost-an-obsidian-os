#!/usr/bin/env python3
"""
Import an EPUB into the Storm vault as a single readable book note.

Usage:  python3 import_epub.py "path/to/book.epub" --out "/path/to/Vault"
Creates:  <Vault>/Reading/<Title>.md   (with the reading panel, chapters, and metadata)
          <Vault>/Reading/Covers/<Title>.jpg   (if the EPUB has a cover)

Needs:  pip install ebooklib beautifulsoup4 html2text
The reading panel is read from reader-panel.txt next to this script.
"""
import sys, os, re, argparse
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
import html2text

def slug(s): return re.sub(r'[\\/:*?"<>|#^\[\]]', '', str(s)).replace('\n',' ').strip()

def md_of(html):
    h = html2text.HTML2Text(); h.body_width = 0; h.ignore_images = True
    h.single_line_break = False
    out = h.handle(html)
    out = re.sub(r'\n{3,}', '\n\n', out).strip()
    return out

def chapter_title(soup, fallback):
    for tag in ['h1','h2','h3','title']:
        el = soup.find(tag)
        if el and el.get_text(strip=True):
            return el.get_text(strip=True)
    return fallback

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('epub')
    ap.add_argument('--out', default='.', help='vault root folder')
    args = ap.parse_args()

    book = epub.read_epub(args.epub)
    def meta(ns, name):
        m = book.get_metadata(ns, name)
        return m[0][0] if m else ''
    title = meta('DC','title') or os.path.splitext(os.path.basename(args.epub))[0]
    author = meta('DC','creator') or ''
    title_s = slug(title)

    reading = os.path.join(args.out, 'Reading')
    covers = os.path.join(reading, 'Covers')
    os.makedirs(covers, exist_ok=True)

    # cover
    cover_line = ''
    cover_item = None
    for it in book.get_items_of_type(ebooklib.ITEM_COVER):
        cover_item = it; break
    if not cover_item:
        for it in book.get_items_of_type(ebooklib.ITEM_IMAGE):
            if 'cover' in (it.get_name() or '').lower(): cover_item = it; break
    if cover_item:
        cpath = os.path.join(covers, title_s + '.jpg')
        with open(cpath, 'wb') as f: f.write(cover_item.get_content())
        cover_line = f'Cover: "[[Covers/{title_s}.jpg]]"\n'

    # chapters from the spine
    idmap = {it.get_id(): it for it in book.get_items()}
    chapters, words = [], 0
    n = 0
    for idref, _ in book.spine:
        it = idmap.get(idref)
        if not it or it.get_type() != ebooklib.ITEM_DOCUMENT: continue
        if isinstance(it, epub.EpubNav): continue
        soup = BeautifulSoup(it.get_content(), 'html.parser')
        if soup.find('nav') and not soup.get_text(strip=True): continue
        text = soup.get_text(' ', strip=True)
        if len(text) < 40: continue
        n += 1
        ctitle = chapter_title(soup, f'Chapter {n}')
        body = md_of(str(soup))
        # drop a leading heading line (we add our own ##)
        body = re.sub(r'^#{1,6}\s+.*\n+', '', body, count=1)
        words += len(text.split())
        chapters.append((ctitle, body))
    pages = max(round(words / 275), len(chapters) * 3, 1)

    panel_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reader-panel.txt')
    panel = open(panel_path, encoding='utf-8').read().strip() if os.path.exists(panel_path) else ''

    fm = (f'---\ntags:\n  - book\ntitle: {title}\nauthor: {author}\nstatus: reading\n'
          f'page: 0\npages: {pages}\nprogress: 0\n{cover_line}'
          f'cssclasses:\n  - reading-mode\n---\n')
    parts = [fm, f'\n# {title}\n', f'\n[[📚 Books|← Books]]\n', '\n' + panel + '\n']
    for ct, body in chapters:
        parts.append(f'\n## {ct}\n\n{body}\n')
    parts.append('\n## Highlights\n\n> Select text for the highlight popup, or paste quotes here and hit Pull inline.\n\n## Notes\n\n- \n')
    out_md = os.path.join(reading, title_s + '.md')
    with open(out_md, 'w', encoding='utf-8') as f: f.write(''.join(parts))
    print(f'Imported "{title}" — {len(chapters)} chapters, ~{pages} pages, {words} words')
    print(f'  note:  {out_md}')
    if cover_line: print(f'  cover: {os.path.join(covers, title_s + ".jpg")}')

if __name__ == '__main__':
    main()
