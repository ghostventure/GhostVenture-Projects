from pathlib import Path
import pymupdf as fitz

root = Path(__file__).resolve().parent.parent
review = root / 'release-brochures-2026-09-07'
for kind, filename in [('customer', 'OverHead-Business-Office-Guide.pdf'), ('investor', 'OverHead-Investor-Brochure.pdf')]:
    doc = fitz.open(root / 'website-next' / 'public' / 'downloads' / filename)
    assert len(doc) == 3
    for index, page in enumerate(doc):
        text = page.get_text()
        assert 'OverHead' in text
        assert len(text) > 300
        assert '\ufffd' not in text
        for block in page.get_text('blocks'):
            assert block[0] >= 0 and block[1] >= 0 and block[2] <= page.rect.width + 1 and block[3] <= page.rect.height + 1, (kind, index, 'text out of bounds')
        page.get_pixmap(matrix=fitz.Matrix(1, 1)).save(review / f'{kind}-pdf-{index+1}.png')
    print(f'{kind}: 3 pages, selectable text, no text outside page bounds, {sum(len(p.get_links()) for p in doc)} clickable links')
