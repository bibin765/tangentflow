# @upbrew/tangentflow

PDF document generation with pixel-perfect text wrapping. Powered by [Pretext](https://github.com/chenglou/pretext).

**[Live Demo](https://tangentflow.com/app)** | **[Documentation](https://tangentflow.com/docs)** | **[GitHub](https://github.com/bibin765/tangentflow)** | **[Changelog](./CHANGELOG.md)**

TangentFlow is the missing layout layer for PDF generation in JavaScript. It solves the hardest problem — **accurate text measurement and line-breaking** — so your documents look exactly right, in every language, without a headless browser.

---

## What's New in v0.3.0

v0.3.0 is a major feature release that brings TangentFlow closer to full document authoring:

- **Table enhancements** — explicit column widths, per-column alignment, and full border customization
- **Inline color spans** — `{#ff0000|colored text}` syntax for inline colored text
- **Superscript / Subscript** — `^superscript^` and `~subscript~` markup
- **Nested lists** — sub-items via nested arrays with distinct bullet characters per level
- **Table of Contents** — auto-generated from headings with `doc.tableOfContents()`
- **Outline / Bookmarks** — `build()` now returns an `outline` array for PDF bookmarks
- **Multi-column text** — `doc.multiColumn()` for newspaper-style column layouts
- **Footnotes** — `doc.footnote()` renders numbered notes at the page bottom
- **Image captions** — `caption` option on `doc.image()` for figure labels
- **Page break control** — `breakBefore: true` option on headings and other blocks

## Why TangentFlow?

Every PDF library has the same problem: text wrapping is broken.

- **jsPDF** — no built-in wrapping, `splitTextToSize()` breaks on Unicode
- **pdfmake** — CJK wrapping broken for years, 2MB bundle
- **Puppeteer** — accurate but needs Chrome (150MB, 2-5 seconds per document)
- **pdf-lib** — no wrapping at all, you position every glyph manually

TangentFlow fixes this by using [Pretext](https://github.com/chenglou/pretext) — a library that measures text with mathematical precision using the browser's font engine. The result: accurate wrapping for Latin, CJK, Arabic, Hindi, emoji, and mixed-direction text, in pure JavaScript, with no headless browser.

## Install

```bash
npm install @upbrew/tangentflow @chenglou/pretext
```

`@chenglou/pretext` is a peer dependency — you install it alongside TangentFlow.

**For Node.js** (server-side), you also need a canvas implementation since Pretext uses canvas for text measurement:

```bash
npm install canvas
```

Then add this polyfill before importing TangentFlow:

```js
import { createCanvas } from 'canvas'
globalThis.document = {
  createElement: (tag) => tag === 'canvas' ? createCanvas(1, 1) : {}
}
```

**In the browser**, no polyfill is needed — canvas is built in.

## Quick Start

```js
import { createDocument } from '@upbrew/tangentflow'

const doc = createDocument({ page: { size: 'a4' } })

doc.heading('Q4 2025 Revenue Report')
doc.paragraph('Overall revenue grew **23% year-over-year**.')
doc.table({
  headers: ['Region', 'Revenue', 'Growth'],
  rows: [
    ['North America', '$14.1M', '+13.7%'],
    ['Asia Pacific', '$7.8M', '+52.9%'],
  ],
})

const { pages, pageSize } = doc.build()
// pages = array of draw commands for each page
// Feed to pdf-lib, canvas, or any renderer
```

## APIs

TangentFlow provides two APIs:

### Builder API (fluent, chainable)

Best for programmatic document generation — invoices, reports, receipts.

```js
import { createDocument } from '@upbrew/tangentflow'

const doc = createDocument(options)
doc.heading('Title')
doc.paragraph('Content')
const result = doc.build()
```

### Schema API (JSON-driven)

Best for templates and data-driven documents. Pass a JSON schema, get draw commands back.

```js
import { renderFromSchema } from '@upbrew/tangentflow'

const result = renderFromSchema({
  page: { size: 'a4', margin: 60 },
  blocks: [
    { type: 'heading', text: 'Invoice', level: 1 },
    { type: 'paragraph', text: 'Thanks for your purchase.' },
  ]
})
```

---

## `createDocument(options)`

Creates a document builder instance.

### Options

```js
const doc = createDocument({
  // Page configuration
  page: {
    size: 'a4',            // 'a4' | 'letter' | 'legal'
    orientation: 'portrait', // 'portrait' | 'landscape'
    margin: 60,            // margin in points (1 point = 1/72 inch)
  },

  // Document colors — hex strings or [r, g, b] arrays (0-1 range)
  colors: {
    heading: '#1a1820',     // heading text
    body: '#404050',        // paragraph, list, table cell text
    accent: '#5c7a64',      // links, quote bar
    tableHeader: '#ebebf0', // table header row background
    tableStripe: '#f8f8fa', // alternating table row background
    divider: '#cccccc',     // horizontal rules, table borders
    quoteBar: '#5c7a64',    // left bar on quote blocks
    statBg: '#f0f0f5',     // stat card background
    muted: '#666670',      // bullet markers, labels, page numbers
  },

  // Header and footer (repeated on every page)
  headerFooter: {
    logoSrc: 'data:image/png;base64,...',  // logo image (data URL)
    headerLeft: 'Company Name',
    headerRight: 'Document Title',
    footerLeft: 'Confidential',
    footerRightMode: 'page-number',  // 'page-number' | 'custom' | 'none'
    footerCustom: 'Custom text',     // used when footerRightMode is 'custom'
  },

  // Watermark (rendered behind content on every page)
  watermark: {
    text: 'DRAFT',
    color: '#cccccc',     // hex string
    opacity: 0.15,        // 0-1
  },

  // PDF metadata (embedded in the file)
  metadata: {
    title: 'Quarterly Report',
    author: 'Finance Team',
    subject: 'Q4 2025 Performance',
  },
})
```

All options are optional. Defaults: A4 portrait, 60pt margins, dark color scheme.

### Color Format

Colors in document options accept hex strings (`'#1a1820'`) or `[r, g, b]` arrays (0-1 range).
Draw commands always emit `[r, g, b]` arrays. Your renderer must handle this format.

### Page Sizes

| Size | Width | Height |
|------|-------|--------|
| `a4` | 595.28pt | 841.89pt |
| `letter` | 612pt | 792pt |
| `legal` | 612pt | 1008pt |

In landscape orientation, width and height are swapped.

---

## Block Methods

All methods return the builder instance for chaining:

```js
doc.heading('Title').paragraph('Body').divider().paragraph('More')
```

### `doc.heading(text, options?)`

Add a heading.

```js
doc.heading('Main Title')                    // H1 (22pt)
doc.heading('Section', { level: 2 })         // H2 (16pt)
doc.heading('Subsection', { level: 3 })      // H3 (13pt)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | `1 \| 2 \| 3` | `1` | Heading level |
| `breakBefore` | `boolean` | `false` | Force a page break before this heading (v0.3.0) |

### `doc.paragraph(text)`

Add a paragraph with automatic text wrapping. Supports inline formatting:

```js
doc.paragraph('Plain text wraps automatically at page margins.')
doc.paragraph('Text with **bold**, *italic*, and __underlined__ words.')
doc.paragraph('Visit [our website](https://example.com) for details.')
doc.paragraph('Line one.\nLine two after a hard break.')
doc.paragraph('Energy is defined as E=mc^2^ in physics.')
doc.paragraph('Water is H~2~O.')
doc.paragraph('This word is {#ff0000|highlighted in red}.')
```

**Inline formatting syntax:**

| Syntax | Renders as |
|--------|-----------|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `__underline__` | underlined text |
| `[text](url)` | clickable link |
| `{#ff0000\|colored text}` | colored text (any hex color) |
| `^superscript^` | superscript (e.g. E=mc^2^) |
| `~subscript~` | subscript (e.g. H~2~O) |

Formatting can be mixed within a single paragraph. Pretext handles the line-breaking on the combined text, then formatting is applied per character range.

### `doc.table(options)`

Add a table with automatic column sizing and per-cell text wrapping. This is TangentFlow's flagship feature.

```js
doc.table({
  headers: ['Product', 'Description', 'Price'],
  rows: [
    ['Widget Pro', 'A professional-grade widget with advanced features', '$299'],
    ['Widget Lite', 'Lightweight version for personal use', '$99'],
  ],
})
```

**With explicit column widths, alignment, and border customization (v0.3.0):**

```js
doc.table({
  headers: ['Product', 'Description', 'Price'],
  rows: [
    ['Widget Pro', 'A professional-grade widget with advanced features', '$299'],
    ['Widget Lite', 'Lightweight version for personal use', '$99'],
  ],
  colWidths: [100, 'auto', 80],       // fixed or 'auto' per column
  align: ['left', 'left', 'right'],   // per-column text alignment
  borders: {
    outer: true,       // border around the entire table
    header: true,      // line below the header row
    rows: true,        // horizontal lines between rows
    columns: true,     // vertical lines between columns
    width: 0.5,        // border line width in points
    color: '#cccccc',  // border color (hex string)
  },
})
```

| Option | Type | Description |
|--------|------|-------------|
| `headers` | `string[]` | Column header labels |
| `rows` | `string[][]` | Array of rows, each row is an array of cell strings |
| `colWidths` | `(number \| 'auto')[]` | Explicit column widths in points; `'auto'` distributes remaining space (v0.3.0) |
| `align` | `('left' \| 'right' \| 'center')[]` | Per-column text alignment (v0.3.0) |
| `borders` | `object` | Border customization (v0.3.0) |

**`borders` options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `outer` | `boolean` | `false` | Draw a border around the entire table |
| `header` | `boolean` | `true` | Draw a line below the header row |
| `rows` | `boolean` | `false` | Draw horizontal lines between body rows |
| `columns` | `boolean` | `false` | Draw vertical lines between columns |
| `width` | `number` | `0.5` | Line width in points |
| `color` | `string` | `'#cccccc'` | Line color as hex string |

**How table layout works:**

1. Pretext measures the natural (unwrapped) width of every cell
2. Column widths are distributed proportionally with a minimum of 40pt (unless overridden by `colWidths`)
3. Each cell's text is wrapped within its column using Pretext
4. Row height adjusts to fit the tallest wrapped cell
5. When a table spans multiple pages, headers repeat automatically
6. Alternating row backgrounds (zebra striping) for readability

### `doc.bulletList(items)`

Add an unordered list. Each item wraps independently.

```js
doc.bulletList([
  'First item with short text',
  'Second item with a much longer description that will wrap to multiple lines within the list',
  'Third item',
])
```

### `doc.numberedList(items)`

Add an ordered list with auto-incrementing numbers.

```js
doc.numberedList([
  'Gather requirements from stakeholders',
  'Design the system architecture',
  'Implement and test each component',
])
```

### Nested Lists (v0.3.0)

Both `bulletList` and `numberedList` support nested sub-items via nested arrays. Each nesting level uses a different bullet character:

- Level 1: **\u2022** (bullet)
- Level 2: **\u25e6** (open bullet)
- Level 3: **\u25aa** (small square)

```js
doc.bulletList([
  'Top-level item',
  ['Sub-item one', 'Sub-item two'],
  'Another top-level item',
  ['Nested under the second', ['Deeply nested']],
])
```

This renders as:

```
 \u2022  Top-level item
    \u25e6  Sub-item one
    \u25e6  Sub-item two
 \u2022  Another top-level item
    \u25e6  Nested under the second
       \u25aa  Deeply nested
```

Numbered lists nest the same way, with indented sub-lists using bullet characters.

### `doc.quote(text, attribution?)`

Add a callout/blockquote with a colored left bar.

```js
doc.quote('Innovation distinguishes between a leader and a follower.')
doc.quote(
  'The best way to predict the future is to invent it.',
  'Alan Kay'
)
```

The bar color is controlled by the `quoteBar` color setting.

### `doc.keyValue(data)`

Add key-value pairs with labels and values. Great for metadata, contact info, document properties.

```js
doc.keyValue({
  'Client': 'Acme Corporation',
  'Project': 'Website Redesign',
  'Deadline': 'April 30, 2026',
  'Status': 'In Progress',
})
```

Labels render in bold muted text, values wrap in the remaining space. Separator lines between rows.

### `doc.twoColumn(left, right)`

Add a two-column layout. Each column wraps independently at half width.

```js
doc.twoColumn(
  'Left column content.\nCan have multiple lines.',
  'Right column content.\nIndependently wrapped.'
)
```

### `doc.statRow(data)`

Add a row of metric cards with labels and values.

```js
doc.statRow({
  'Total Revenue': '$36.5M',
  'Growth': '+23%',
  'Customers': '2,847',
  'NPS': '72',
})
```

Cards auto-size to fill the row. Both labels and values wrap within their cards using Pretext.

### `doc.image(src, options?)`

Add an image.

```js
doc.image('data:image/png;base64,...', {
  width: 200,       // width in points
  align: 'center',  // 'left' | 'center' | 'right'
  wrap: 'none',     // 'none' | 'left' | 'right'
  caption: 'Figure 1: Revenue by quarter',  // v0.3.0
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | `number` | `200` | Display width in points |
| `align` | `string` | `'left'` | Horizontal alignment |
| `wrap` | `string` | `'none'` | Text wrap mode |
| `caption` | `string` | — | Caption text rendered below the image (v0.3.0) |

When `wrap` is `'left'` or `'right'`, the image floats to one side and subsequent paragraph text wraps around it using Pretext's `layoutNextLine()` API. This produces magazine-style text flow:

```
┌──────────────────────────┐
│ ┌────────┐ Text wraps    │
│ │  IMG   │ around the    │
│ │        │ floating      │
│ └────────┘ image using   │
│ variable-width lines.    │
│ Full width resumes here. │
└──────────────────────────┘
```

**Note:** In the browser, pass an `Image` object as `_img` and natural dimensions as `_naturalW`/`_naturalH`. In Node.js, image rendering in the draw commands requires a renderer that handles the `image` command type.

### `doc.tableOfContents(options?)` (v0.3.0)

Generate a table of contents automatically from all headings in the document. The TOC lists each heading with its page number, indented by level.

```js
doc.heading('Annual Report')
doc.tableOfContents()

doc.heading('Revenue', { level: 2 })
doc.paragraph('Revenue grew 23%...')
doc.heading('Expenses', { level: 2 })
doc.paragraph('Expenses decreased 5%...')
```

The TOC is generated during `build()`, so headings added after `tableOfContents()` are included. Page numbers are calculated from the final paginated layout.

**Options:**

```js
doc.tableOfContents()                                    // default: adds "Table of Contents" H1
doc.tableOfContents({ heading: false })                  // no auto-heading
doc.tableOfContents({ heading: 'Contents', level: 2 })   // custom heading
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `heading` | `string \| false` | `'Table of Contents'` | The heading text to insert before the TOC. Set to `false` to suppress the auto-heading entirely. |
| `level` | `1 \| 2 \| 3` | `1` | Heading level when `heading` is a string. |

**Note:** `tableOfContents()` auto-inserts an H1 heading by default. If you want to provide your own heading or use the TOC without one, pass `{ heading: false }`.

### `doc.multiColumn(text, options?)` (v0.3.0)

Render text in a multi-column newspaper-style layout. Text flows from one column to the next.

```js
doc.multiColumn(
  'A long body of text that will be distributed across columns...',
  {
    columns: 3,   // number of columns (default: 2)
    gap: 20,      // gap between columns in points (default: 20)
  }
)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `columns` | `number` | `2` | Number of columns |
| `gap` | `number` | `20` | Space between columns in points |

Each column is laid out independently using Pretext, so wrapping is accurate within each column width.

### `doc.footnote(number, text)` (v0.3.0)

Add a footnote that renders at the bottom of the current page.

```js
doc.paragraph('TangentFlow uses Pretext for text measurement.[1]')
doc.footnote(1, 'Pretext provides sub-pixel accurate text measurement via canvas.')

doc.paragraph('The algorithm is based on Unicode UAX #14.[2]')
doc.footnote(2, 'Unicode Line Breaking Algorithm, https://unicode.org/reports/tr14/')
```

Footnotes are collected during layout and rendered at the bottom of the page where they are referenced, separated from the body by a short divider line. If a footnote does not fit on the current page, it flows to the next page.

### `doc.divider()`

Add a horizontal line.

### `doc.spacer(height?)`

Add vertical spacing. Default height is 20 points.

```js
doc.spacer()      // 20pt
doc.spacer(40)    // 40pt
```

### `doc.pageBreak()`

Force subsequent content onto a new page.

### Page Break Control (v0.3.0)

In addition to `doc.pageBreak()`, you can use the `breakBefore: true` option on headings and other block methods to force a page break before a specific block. This is useful for ensuring chapters or major sections always start on a new page.

```js
doc.heading('Chapter 1: Introduction')
doc.paragraph('...')

// Chapter 2 will always start on a new page
doc.heading('Chapter 2: Methodology', { level: 1, breakBefore: true })
doc.paragraph('...')
```

The `breakBefore` option is supported on `heading`, `paragraph`, `table`, `bulletList`, `numberedList`, and `multiColumn`.

### `doc.addBlock(block)`

Add a raw block object. For advanced use or custom block types.

```js
doc.addBlock({ type: 'heading', text: 'Custom', level: 2 })
```

### `doc.getBlocks()`

Returns the current blocks array. Useful for serialization or inspection.

```js
const blocks = doc.getBlocks()
console.log(JSON.stringify(blocks, null, 2))
```

---

## `doc.build()`

Runs Pretext layout on all blocks and returns draw commands.

```js
const result = doc.build()
```

### Return value

```js
{
  pages: [
    [                          // Page 1
      { type: 'text', text: 'Hello', x: 60, y: 780, fontSize: 22, fontKey: 'bold', color: [0.1, 0.09, 0.12] },
      { type: 'rect', x: 60, y: 700, w: 475, h: 24, color: [0.92, 0.92, 0.94] },
      { type: 'line', x1: 60, y1: 700, x2: 535, y2: 700, color: [0.8, 0.8, 0.82] },
      { type: 'image', img: Image, src: 'data:...', x: 60, y: 500, w: 200, h: 150 },
      { type: 'link', x: 60, y: 400, w: 80, h: 14, url: 'https://...' },
      // ... more commands
    ],
    [ /* Page 2 */ ],
  ],
  pageSize: { w: 595.28, h: 841.89 },
  watermark: { text: 'DRAFT', color: [0.8, 0.8, 0.8], opacity: 0.15 },
  metadata: { title: 'Report', author: 'Team' },

  // v0.3.0: Outline / Bookmarks
  outline: [
    { text: 'Main Title', level: 1, page: 0, y: 780, id: 'heading-0' },
    { text: 'Section One', level: 2, page: 0, y: 520, id: 'heading-1' },
    { text: 'Section Two', level: 2, page: 1, y: 780, id: 'heading-2' },
  ],
}
```

#### Outline / Bookmarks (v0.3.0)

The `outline` array is automatically populated from all headings in the document. Each entry contains the heading text, its level, the page index it appears on, its Y coordinate, and a unique `id`. You can use this to create PDF bookmarks (outlines) with pdf-lib or other renderers:

```js
const { pages, outline } = doc.build()

// With pdf-lib, create a bookmark tree from the outline:
for (const entry of outline) {
  pdfDoc.addBookmark(entry.text, pdfDoc.getPages()[entry.page], entry.y)
}
```

### Draw command types

| Type | Fields | Description |
|------|--------|-------------|
| `text` | `text, x, y, fontSize, fontKey, color, align?` | Draw text. `fontKey`: `'regular'`, `'bold'`, or `'italic'`. `align`: `'left'` (default), `'center'`, `'right'`. Coordinates are in PDF space (Y goes up from bottom). |
| `rect` | `x, y, w, h, color, radius?` | Fill a rectangle. Optional `radius` for rounded corners. |
| `line` | `x1, y1, x2, y2, color, lineWidth?` | Draw a line. Default `lineWidth` is 0.5. |
| `image` | `img, src, x, y, w, h` | Draw an image. `img` is the Image object (browser), `src` is the data URL. |
| `link` | `x, y, w, h, url` | Invisible link annotation area. |

### Coordinate system

All coordinates are in **PDF points** (1 point = 1/72 inch). The origin is at the **bottom-left** of the page, with Y increasing upward. This matches PDF and pdf-lib conventions.

To convert for canvas rendering (where Y goes down), use:
```js
canvasY = pageHeight - pdfY - elementHeight
```

### Draw Command Reference

Each draw command is a plain object with a `type` field. Below is the full field reference for every command type.

#### `text`

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'text'` | Command type identifier |
| `text` | `string` | The text content to draw |
| `x` | `number` | X coordinate in PDF points |
| `y` | `number` | Y coordinate in PDF points (baseline position, Y-up) |
| `fontSize` | `number` | Font size in points |
| `fontKey` | `'regular' \| 'bold' \| 'italic'` | Which font variant to use |
| `color` | `[number, number, number]` | RGB color array, each value 0-1 |
| `align` | `'left' \| 'center' \| 'right'` | Text alignment (default: `'left'`) |

**Alignment and coordinates:** When `align` is `'left'` (default), `x` is the left edge of the text. When `align` is `'center'`, `x` is the **center point** of the text -- the renderer must offset by half the measured text width to the left. When `align` is `'right'`, `x` is the **right edge** of the text -- the renderer must offset by the full measured text width to the left. The official pdf-lib renderer handles this automatically.

#### `rect`

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'rect'` | Command type identifier |
| `x` | `number` | X coordinate of the bottom-left corner |
| `y` | `number` | Y coordinate of the bottom-left corner |
| `w` | `number` | Width in points |
| `h` | `number` | Height in points |
| `color` | `[number, number, number]` | RGB fill color array, each value 0-1 |
| `radius` | `number` | Optional corner radius for rounded rectangles |

#### `line`

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'line'` | Command type identifier |
| `x1` | `number` | Start X coordinate |
| `y1` | `number` | Start Y coordinate |
| `x2` | `number` | End X coordinate |
| `y2` | `number` | End Y coordinate |
| `color` | `[number, number, number]` | RGB stroke color array, each value 0-1 |
| `lineWidth` | `number` | Line thickness in points (default: `0.5`) |

#### `image`

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'image'` | Command type identifier |
| `img` | `Image \| null` | The Image object (browser). May be `null` in Node.js. |
| `src` | `string` | Data URL of the image (use this for embedding in pdf-lib) |
| `x` | `number` | X coordinate of the bottom-left corner |
| `y` | `number` | Y coordinate of the bottom-left corner |
| `w` | `number` | Display width in points |
| `h` | `number` | Display height in points |

#### `link`

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'link'` | Command type identifier |
| `x` | `number` | X coordinate of the link area |
| `y` | `number` | Y coordinate of the link area |
| `w` | `number` | Width of the clickable area |
| `h` | `number` | Height of the clickable area |
| `url` | `string` | Target URL |

**Note on colors:** All colors in draw commands are `[r, g, b]` arrays with values in the 0-1 range, even though the document configuration accepts hex strings. Your renderer must handle this format (e.g., `rgb(cmd.color[0], cmd.color[1], cmd.color[2])` in pdf-lib).

---

## `renderFromSchema(schema)`

Render a JSON document directly to draw commands. This is the template/data-driven API — useful when you store document definitions in a database or receive them from an API.

```js
import { renderFromSchema } from '@upbrew/tangentflow'

const result = renderFromSchema({
  page: { size: 'a4', orientation: 'portrait', margin: 60 },
  colors: { heading: '#2d5f8a', accent: '#e74c3c' },
  metadata: { title: 'Invoice #1047' },
  watermark: { text: 'PAID', color: '#00aa00', opacity: 0.1 },
  headerFooter: {
    headerLeft: 'Acme Corp',
    footerRightMode: 'page-number',
  },
  blocks: [
    { type: 'heading', text: 'INVOICE', level: 1 },
    { type: 'key-value', items: 'Invoice #: 1047\nDate: March 31, 2026\nDue: April 30, 2026' },
    { type: 'divider' },
    { type: 'table', headers: 'Item, Qty, Price, Total',
      rows: 'Widget Pro, 2, $149.00, $298.00\nSupport Plan, 1, $49.00, $49.00' },
    { type: 'stat-row', items: 'Subtotal: $347.00, Tax: $29.50, Total: $376.50' },
  ],
})

console.log(result.pages.length) // number of pages
```

### Schema block format

When using `renderFromSchema`, blocks use string-based formats (matching the internal storage):

| Block type | Required fields |
|-----------|----------------|
| `heading` | `text`, `level` (1/2/3) |
| `paragraph` | `text` |
| `bullet-list` | `items` (newline-separated) |
| `numbered-list` | `items` (newline-separated) |
| `quote` | `text`, `attribution?` |
| `table` | `headers` (comma-separated), `rows` (comma-separated, newline per row) |
| `key-value` | `items` (newline-separated, `Label: Value` format) |
| `two-column` | `left`, `right` |
| `stat-row` | `items` (comma-separated, `Label: Value` format) |
| `image` | `src`, `width?`, `align?`, `wrap?` |
| `divider` | *(no fields)* |
| `spacer` | `height` |
| `page-break` | *(no fields)* |

---

## Advanced: Direct engine access

For maximum control, you can use the flow engine directly:

```js
import { createFlowEngine } from '@upbrew/tangentflow/flow'

const colors = { heading: [0.1, 0.1, 0.1], body: [0.2, 0.2, 0.2], /* ... */ }
const flow = createFlowEngine(595.28, 841.89, 60, colors, null)

flow.addText('Custom positioned text', 14, 'bold', {
  bold: true,
  color: [0, 0, 0],
  lineHeightMult: 1.3,
})

flow.addTable(['Col A', 'Col B'], ['Row 1A, Row 1B', 'Row 2A, Row 2B'])
flow.addDivider()
flow.addHeadersFooters()

const pages = flow.pages // array of draw command arrays
```

### Flow engine methods

| Method | Description |
|--------|-------------|
| `addText(text, fontSize, fontKey, options)` | Add wrapped text. Options: `{ bold, color, lineHeightMult, indent }` |
| `addImage(block)` | Add image with optional float wrapping |
| `addTable(headers, rows)` | Add table with auto-sized columns |
| `addList(items, ordered)` | Add bullet or numbered list |
| `addQuote(text, attribution)` | Add blockquote with accent bar |
| `addKeyValue(items)` | Add label-value pairs |
| `addTwoColumn(left, right)` | Add two-column layout |
| `addStatRow(items)` | Add metric card row |
| `addDivider()` | Add horizontal rule |
| `addSpacer(height)` | Add vertical spacing |
| `addPageBreak()` | Force new page |
| `clearFloat()` | Clear active image float |
| `addHeadersFooters()` | Render headers/footers on all pages (call last) |

---

## Rendering draw commands

TangentFlow produces draw commands — it doesn't generate PDFs directly. You feed the commands to a renderer. Here are examples:

### Official pdf-lib Renderer

TangentFlow ships an official pdf-lib renderer that handles all draw command types:

```js
import { createDocument } from '@upbrew/tangentflow'
import { renderToPDF } from '@upbrew/tangentflow/renderers/pdf-lib'
import * as pdfLib from 'pdf-lib'

const doc = createDocument({ page: { size: 'a4' }, metadata: { title: 'Report' } })
doc.heading('Hello World')
doc.paragraph('Generated with **TangentFlow**.')

const result = doc.build()
const pdfBytes = await renderToPDF(result, { pdfLib })
// pdfBytes is a Uint8Array — write to file, send to client, etc.
```

The renderer handles: text alignment (center/right), bold/italic fonts, image embedding from data URLs, watermarks, non-Latin text fallback (canvas-rendered PNG), and inline text grouping for accurate positioning.

### With pdf-lib (manual / custom renderer)

If you need full control, you can write your own renderer loop. Here is a minimal example:

```js
import { createDocument } from '@upbrew/tangentflow'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const doc = createDocument({ page: { size: 'a4' } })
doc.heading('Hello World')
doc.paragraph('Generated with TangentFlow.')
const { pages, pageSize } = doc.build()

const pdfDoc = await PDFDocument.create()
const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

for (const cmds of pages) {
  const page = pdfDoc.addPage([pageSize.w, pageSize.h])
  for (const cmd of cmds) {
    if (cmd.type === 'text') {
      const f = cmd.fontKey === 'bold' ? fontBold : font
      page.drawText(cmd.text, {
        x: cmd.x, y: cmd.y,
        size: cmd.fontSize,
        font: f,
        color: rgb(cmd.color[0], cmd.color[1], cmd.color[2]),
      })
    } else if (cmd.type === 'rect') {
      page.drawRectangle({
        x: cmd.x, y: cmd.y, width: cmd.w, height: cmd.h,
        color: rgb(cmd.color[0], cmd.color[1], cmd.color[2]),
      })
    } else if (cmd.type === 'line') {
      page.drawLine({
        start: { x: cmd.x1, y: cmd.y1 },
        end: { x: cmd.x2, y: cmd.y2 },
        color: rgb(cmd.color[0], cmd.color[1], cmd.color[2]),
        thickness: cmd.lineWidth || 0.5,
      })
    }
  }
}

const pdfBytes = await pdfDoc.save()
// Write to file, send to client, etc.
```

### With HTML Canvas (browser preview)

```js
const { pages, pageSize } = doc.build()

pages.forEach(cmds => {
  const canvas = document.createElement('canvas')
  canvas.width = pageSize.w * 2
  canvas.height = pageSize.h * 2
  const ctx = canvas.getContext('2d')
  ctx.scale(2, 2)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, pageSize.w, pageSize.h)

  for (const cmd of cmds) {
    if (cmd.type === 'text') {
      const weight = cmd.fontKey === 'bold' ? 'bold ' : ''
      ctx.font = `${weight}${cmd.fontSize}px Helvetica, sans-serif`
      ctx.fillStyle = `rgb(${cmd.color.map(c => Math.round(c * 255))})`
      ctx.textBaseline = 'top'
      ctx.fillText(cmd.text, cmd.x, pageSize.h - cmd.y - cmd.fontSize)
    }
    // ... handle rect, line, image
  }

  document.body.appendChild(canvas)
})
```

---

## How it works

TangentFlow uses a three-layer architecture:

```
Your content (blocks)
       |
  Pretext (measures text, calculates line breaks)
       |
  Flow Engine (paginates, places elements, handles page breaks)
       |
  Draw Commands (text, rect, line, image)
       |
  Your Renderer (pdf-lib, canvas, SVG, etc.)
```

### Pretext integration

TangentFlow uses three Pretext functions:

- **`prepareWithSegments(text, font)`** — Measures text using the browser's font engine. Segments text into breakable units following Unicode line-breaking rules (UAX #14). One-time cost per text block.

- **`layoutWithLines(prepared, maxWidth, lineHeight)`** — Calculates optimal line breaks for a given width. Returns lines with exact text content and pixel widths. Pure arithmetic — ~0.09ms per call.

- **`layoutNextLine(prepared, cursor, maxWidth)`** — Lays out one line at a time with a different width per call. Used for text wrapping around floating images (magazine-style layout).

### What makes this different

| Feature | TangentFlow | pdfmake | jsPDF | Puppeteer |
|---------|------------|---------|-------|-----------|
| Text wrapping accuracy | Pixel-perfect | Approximate | Manual | Pixel-perfect |
| CJK / Arabic / Emoji | Yes | Broken | No | Yes |
| Table cell wrapping | Auto-sized | Basic | Plugin | CSS |
| Table column widths / alignment | Yes (v0.3.0) | Yes | No | CSS |
| Table border customization | Yes (v0.3.0) | Yes | No | CSS |
| Text around images | Yes (`layoutNextLine`) | No | No | CSS float |
| Inline color spans | Yes (v0.3.0) | No | No | CSS |
| Superscript / Subscript | Yes (v0.3.0) | Yes | No | HTML |
| Nested lists | Yes (v0.3.0) | Yes | No | HTML |
| Table of Contents | Yes (v0.3.0) | Yes | No | Plugin |
| PDF Bookmarks / Outline | Yes (v0.3.0) | Yes | No | No |
| Multi-column layout | Yes (v0.3.0) | Yes | No | CSS |
| Footnotes | Yes (v0.3.0) | Yes | No | CSS |
| Image captions | Yes (v0.3.0) | No | No | HTML |
| Page break control | Yes (v0.3.0) | Yes | No | CSS |
| Runs in browser | Yes | Yes | Yes | No (server) |
| Bundle size | ~10KB + Pretext | ~2MB | ~300KB | ~150MB |
| Speed | ~2ms | ~5ms | ~3ms | ~2-5 seconds |

---

## Known Issues & Limitations

- **Inline bold/italic positioning drift in pdf-lib** — Inline bold or italic text within a paragraph may have slight positioning drift when rendered with pdf-lib, because canvas-based font metrics (used by Pretext for measurement) do not perfectly match pdf-lib's embedded font metrics. Use the `measureTextWidth` callback or the official renderer's inline grouping logic to correct this.

- **Multi-column text does not support inline formatting** — Text passed to `doc.multiColumn()` is rendered as plain text. Inline formatting syntax (`**bold**`, `*italic*`, `{#ff0000|color}`, etc.) is not parsed within multi-column blocks.

- **`tableOfContents()` auto-inserts an H1 heading** — By default, calling `doc.tableOfContents()` adds a "Table of Contents" H1 heading before the TOC entries. Use `{ heading: false }` to suppress this if you want to provide your own heading or omit it entirely.

- **Footnotes on content-heavy pages** — Footnotes on pages with a large amount of body content may not have enough space at the bottom of the page. In these cases, use `doc.pageBreak()` before the footnote-heavy section to ensure adequate space for footnote rendering.

---

## License

MIT
