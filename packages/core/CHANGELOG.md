# Changelog

## 0.3.4
- **Fix**: `tableOfContents()` now accepts options: `heading: false` to suppress auto-heading, `heading: 'Custom'` for custom text, `level` for heading level
- **New**: Official pdf-lib renderer at `@upbrew/tangentflow/renderers/pdf-lib` — handles alignment, images, watermarks, non-Latin text, inline text grouping
- **Docs**: Known issues section, draw command field details, font metrics warning, color format docs, complete rendering guide

## 0.3.3
- **Fix**: Footnotes now reserve space in content area — body text no longer overlaps footnotes
- Per-page footnote height tracking in `ensureSpace()`

## 0.3.2
- **Fix**: Table header text auto-contrast (white text on dark backgrounds)
- **Fix**: TOC renders heading entries with page numbers (was empty before)
- **Fix**: Nested list sub-items render correctly (clearFloat only on top-level)
- **New**: `measureTextWidth` callback option — renderers can inject their own font metrics to fix inline text spacing

## 0.3.1
- Docs and README updated for v0.3.0 features
- Website UI: Multi Column and Footnote block buttons added

## 0.3.0
- **New**: Table column width control (`colWidths: [100, 'auto', 80]`)
- **New**: Table column alignment (`align: ['left', 'right', 'center']`)
- **New**: Table border customization (`borders: { rows, columns, outer, header, width, color }`)
- **New**: Inline color spans (`{#ff0000|colored text}`)
- **New**: Superscript/subscript (`^super^`, `~sub~`)
- **New**: TypeScript declarations (index.d.ts)
- **New**: Heading tracking — `build()` returns `outline` array for PDF bookmarks
- **New**: `breakBefore` option on headings and blocks
- **New**: Nested lists via nested arrays with `• ◦ ▪` per level
- **New**: Table of Contents (`tableOfContents()`)
- **New**: Multi-column flowing text (`multiColumn()`)
- **New**: Footnotes (`footnote()`) at page bottom
- **New**: Image captions (`image(src, { caption: '...' })`)
- **New**: Color validation with console warnings

## 0.2.3
- **Fix**: Inline rich text spacing — use `prep.widths` directly instead of `layoutWithLines` to preserve trailing whitespace

## 0.2.2
- **Fix**: `statRow` comma-in-values bug — values like `9,450` no longer split incorrectly
- Accepts both `{ label, value }` objects and legacy comma-separated strings

## 0.2.1
- **Fix**: Stat card text overflow — auto-scale value font size from 14px down to 9px
- **Fix**: Header/footer text truncation with ellipsis when left/right text overlap

## 0.2.0
- Initial feature-complete release
- 13 block types, 9 templates, inline formatting, text-around-image wrapping
- Header/footer, watermark, PDF metadata, landscape orientation

## 0.1.0
- Initial release — createDocument() builder API, renderFromSchema()
