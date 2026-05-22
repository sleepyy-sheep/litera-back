from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]

index = root / "frontend" / "index.html"
text = index.read_text(encoding="utf-8")
start = text.find("    <!-- PLACEHOLDER_REMOVE_START -->")
end = text.find("  </section>", start)
if start >= 0 and end >= 0:
    index.write_text(text[:start] + text[end:], encoding="utf-8")
    print("index.html: removed mock books")

shelves = root / "frontend" / "shelves.html"
stext = shelves.read_text(encoding="utf-8")
stext2, n = re.subn(
    r'(<section class="shelves-list" id="shelves-list"[^>]*>)\s*<!-- Полка:.*?</section>',
    r"\1\n\n  ",
    stext,
    count=1,
    flags=re.DOTALL,
)
if n:
    shelves.write_text(stext2, encoding="utf-8")
    print("shelves.html: removed mock shelves")
else:
    print("shelves.html: pattern not matched")
