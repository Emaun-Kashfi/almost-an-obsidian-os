# EPUB importer

Turn an EPUB into a readable book note in this vault.

```
pip install ebooklib beautifulsoup4 html2text
python3 import_epub.py "path/to/book.epub" --out ".."
```

Run it from this `_scripts` folder. It creates `Reading/<Title>.md` (with the reading panel, chapters, and metadata) and saves the cover to `Reading/Covers/`. `reader-panel.txt` holds the reading-companion block the importer injects; keep it next to the script. **On Attention** in Reading/ is an example of an imported book.
