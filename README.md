# TangentFlow

PDF document generation with pixel-perfect text wrapping. Powered by [Pretext](https://github.com/chenglou/pretext).

**[Live Demo](https://tangentflow.dev)** | **[npm Package](https://www.npmjs.com/package/@upbrew/tangentflow)** | **[Documentation](https://tangentflow.dev/docs.html)**

---

## What is TangentFlow?

TangentFlow is a browser-based document builder and JavaScript library for generating professional PDFs with mathematically precise text layout. It solves the hardest problem in PDF generation — **accurate text wrapping** — using [Pretext](https://github.com/chenglou/pretext) for glyph-level measurement.

Unlike Puppeteer (which needs a headless browser) or pdfmake (which approximates text widths), TangentFlow produces pixel-perfect line breaks for every language — Latin, CJK, Arabic, Hindi, emoji — in pure JavaScript, client-side.

## npm Package

```bash
npm install @upbrew/tangentflow @chenglou/pretext
```

```js
import { createDocument } from '@upbrew/tangentflow'

const doc = createDocument({ page: { size: 'a4' } })

doc.heading('Q4 Revenue Report')
doc.paragraph('Revenue grew **23%** year-over-year.')
doc.table({
  headers: ['Region', 'Revenue', 'Growth'],
  rows: [
    ['North America', '$14.1M', '+13.7%'],
    ['Asia Pacific', '$7.8M', '+52.9%'],
  ],
})
doc.statRow({ 'Total Revenue': '$36.5M', 'Growth': '+23%' })

const { pages, pageSize } = doc.build()
// → pages = array of draw commands for each page
// Feed to pdf-lib, canvas, or any renderer
```

Full API documentation: **[packages/core/README.md](./packages/core/README.md)**

## Features

### 13 Block Types
- **Image** — with text-wrap-around via Pretext's `layoutNextLine()`
- **Heading** — H1/H2/H3
- **Paragraph** — with inline **bold**, *italic*, __underline__, [links](url)
- **Bullet List** / **Numbered List** — each item wrapped independently
- **Quote / Callout** — accent bar with optional attribution
- **Table** — auto-sized columns, per-cell Pretext wrapping, header repeat on page breaks
- **Key-Value** — label: value pairs with separators
- **Two Column** — side-by-side independently wrapped text
- **Stat Row** — metric cards with auto-sizing
- **Divider** / **Spacer** / **Page Break**

### Document Features
- **Header & Footer** — logo, left/right text, auto page numbers, repeats on every page
- **Watermark** — configurable text, color, opacity
- **9 Customizable Colors** — heading, body, accent, table header/stripe, divider, quote bar, stat bg, muted
- **PDF Metadata** — title, author, subject
- **Page Setup** — A4/Letter/Legal, portrait/landscape, narrow/normal/wide margins
- **Inline Formatting** — `**bold**`, `*italic*`, `__underline__`, `[link](url)` within paragraphs
- **Text Around Images** — magazine-style float wrapping using `layoutNextLine()`
- **Non-Latin PDF Export** — canvas-rendered fallback for Malayalam, Hindi, Arabic, CJK, etc.

### 9 Built-in Templates
Report, Invoice, Catalog, Resume, Project Proposal, Meeting Notes, Receipt, NDA, Multilingual Demo

## Project Structure

```
tangentflow/
├── packages/core/           ← @upbrew/tangentflow npm package
│   ├── src/
│   │   ├── index.js         ← Public API (createDocument, renderFromSchema)
│   │   ├── flow.js          ← Core Pretext-powered layout engine (750 lines)
│   │   ├── blocks.js        ← Block type dispatcher
│   │   ├── colors.js        ← Color utilities
│   │   └── page-sizes.js    ← A4/Letter/Legal dimensions
│   ├── README.md            ← Full API documentation
│   └── package.json
│
├── js/                      ← Website app modules
│   ├── app.js               ← Entry point (imports from @upbrew/tangentflow)
│   ├── config/              ← Templates, block icons
│   ├── renderers/           ← Canvas preview + PDF export
│   └── ui/                  ← Block list, editors, table modal, header/footer
│
├── css/tangentflow.css      ← Design system
├── index.html               ← Landing page
├── app.html                 ← Document builder
├── docs.html                ← Documentation
├── pricing.html             ← Pricing page
├── about.html               ← About page
└── blog/                    ← Blog posts
```

### Single Source of Truth

The website imports directly from `packages/core/src/` via an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap). Any change to the core engine automatically applies to both the website and the npm package — no duplication, no drift.

## How It Works

```
Your content (blocks)
       │
  Pretext (measures text, calculates line breaks)
       │
  Flow Engine (paginates, places elements, handles page breaks)
       │
  Draw Commands (text, rect, line, image, link)
       │
  Your Renderer (pdf-lib, canvas, SVG, etc.)
```

TangentFlow uses three Pretext functions:
- **`prepareWithSegments()`** — measures text using the browser's font engine
- **`layoutWithLines()`** — calculates optimal line breaks for a given width
- **`layoutNextLine()`** — lays out one line at a time with variable widths (for text-around-image)

## Comparison

| Feature | TangentFlow | pdfmake | jsPDF | Puppeteer |
|---------|------------|---------|-------|-----------|
| Text wrapping accuracy | Pixel-perfect | Approximate | Manual | Pixel-perfect |
| CJK / Arabic / Emoji | Yes | Broken | No | Yes |
| Table cell wrapping | Auto-sized | Basic | Plugin | CSS |
| Text around images | Yes | No | No | CSS float |
| Runs in browser | Yes | Yes | Yes | No (server) |
| Bundle size | ~10KB | ~2MB | ~300KB | ~150MB |
| Speed | ~2ms | ~5ms | ~3ms | ~2-5 seconds |

## Development

```bash
# Install dependencies
npm install

# Start local server
npx serve . -p 3333

# Run core library tests
cd packages/core && npm test
```

## License

MIT
