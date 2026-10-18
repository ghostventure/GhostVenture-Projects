from pathlib import Path
import json
import pymupdf as fitz
root = Path(__file__).resolve().parent.parent
review = root / 'release-user-guide'
doc = fitz.open(root / 'website-next/public/downloads/OverHead-User-Guide.pdf')
report = []
for i, page in enumerate(doc):
    text = page.get_text()
    assert len(text.strip()) > 150, f'Blank or nearly blank page {i+1}'
    assert '\ufffd' not in text
    for block in page.get_text('blocks'):
        assert block[0] >= -1 and block[1] >= -1 and block[2] <= page.rect.width+1 and block[3] <= page.rect.height+1, (i+1, 'out of bounds')
    for link in page.get_links():
        assert not link.get('uri', '').startswith('file:'), (i+1, 'local file link')
    page.get_pixmap(matrix=fitz.Matrix(.85,.85)).save(review / f'pdf-{i+1:02}.png')
    report.append({'page':i+1,'characters':len(text),'images':len(page.get_images()),'links':len(page.get_links())})
assert sum(r['images'] for r in report) >= 4
assert doc.get_toc(), 'Missing PDF outline'
(review / 'pdf-inspection.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'pages':len(doc),'images':sum(r['images'] for r in report),'links':sum(r['links'] for r in report),'outlineEntries':len(doc.get_toc())}))
