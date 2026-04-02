/**
 * @tangentflow/core
 *
 * PDF document generation with pixel-perfect text wrapping.
 * Powered by Pretext.
 *
 * @example
 * import { createDocument, renderToCommands } from '@tangentflow/core'
 *
 * const doc = createDocument({ page: { size: 'a4' } })
 * doc.heading('Quarterly Report')
 * doc.paragraph('Revenue grew **23%** year-over-year.')
 * doc.table({
 *   headers: ['Region', 'Revenue', 'Growth'],
 *   rows: [['North America', '$14.1M', '+13.7%']]
 * })
 *
 * const { pages, pageSize } = doc.build()
 * // pages = array of draw commands for each page
 * // Feed to your renderer (canvas, pdf-lib, etc.)
 */

import { createFlowEngine } from './flow.js'
import { processBlocks } from './blocks.js'
import { hexToRgbArr } from './colors.js'
import { PAGE_SIZES } from './page-sizes.js'

// Default colors
const DEFAULT_COLORS = {
  heading: [0.1, 0.09, 0.12],
  body: [0.25, 0.25, 0.31],
  accent: [0.36, 0.48, 0.39],
  tableHeader: [0.92, 0.92, 0.94],
  tableStripe: [0.97, 0.97, 0.98],
  divider: [0.8, 0.8, 0.82],
  quoteBar: [0.36, 0.48, 0.39],
  statBg: [0.94, 0.94, 0.96],
  muted: [0.4, 0.4, 0.44],
}

/**
 * Parse a color config — accepts hex strings or [r,g,b] arrays
 */
function parseColor(c, key) {
  if (Array.isArray(c)) {
    if (c.length !== 3 || c.some(v => typeof v !== 'number' || v < 0 || v > 1)) {
      console.warn(`[tangentflow] Invalid color array for "${key}": expected [r,g,b] with values 0-1`)
    }
    return c
  }
  if (typeof c === 'string' && c.startsWith('#')) {
    if (!/^#[0-9a-fA-F]{3,8}$/.test(c)) {
      console.warn(`[tangentflow] Invalid hex color for "${key}": "${c}"`)
      return DEFAULT_COLORS[key] || [0, 0, 0]
    }
    return hexToRgbArr(c)
  }
  console.warn(`[tangentflow] Unknown color format for "${key}": ${c}`)
  return DEFAULT_COLORS[key] || [0, 0, 0]
}

function parseColors(colors) {
  if (!colors) return { ...DEFAULT_COLORS }
  const result = { ...DEFAULT_COLORS }
  for (const key of Object.keys(result)) {
    if (colors[key] !== undefined) result[key] = parseColor(colors[key], key)
  }
  // Add header/footer specific colors with fallbacks
  if (colors.headerText) result.headerText = parseColor(colors.headerText, 'headerText')
  else result.headerText = result.heading
  if (colors.footerText) result.footerText = parseColor(colors.footerText, 'footerText')
  else result.footerText = result.muted
  return result
}

/**
 * Create a document builder with a fluent API.
 *
 * @param {Object} options
 * @param {Object} [options.page] - Page configuration
 * @param {string} [options.page.size='a4'] - 'a4', 'letter', or 'legal'
 * @param {string} [options.page.orientation='portrait'] - 'portrait' or 'landscape'
 * @param {number} [options.page.margin=60] - Margin in points
 * @param {Object} [options.colors] - Document colors (hex strings or [r,g,b] arrays)
 * @param {Object} [options.headerFooter] - Header/footer configuration
 * @param {Object} [options.watermark] - Watermark configuration
 * @returns {DocumentBuilder}
 */
export function createDocument(options = {}) {
  const pageConfig = options.page || {}
  const sizeName = pageConfig.size || 'a4'
  const orientation = pageConfig.orientation || 'portrait'
  const margin = pageConfig.margin || 60
  const colors = parseColors(options.colors)
  const headerFooter = options.headerFooter || null
  const watermark = options.watermark ? {
    ...options.watermark,
    color: options.watermark.color ? parseColor(options.watermark.color, 'watermark') : [0.8, 0.8, 0.8],
  } : null
  const blocks = []

  const builder = {
    /**
     * Add an image block
     * @param {string} src - Image source (data URL or path)
     * @param {Object} [opts] - { width, align, wrap, _img, _naturalW, _naturalH }
     */
    image(src, opts = {}) {
      blocks.push({
        type: 'image',
        src,
        width: opts.width || 200,
        align: opts.align || 'left',
        wrap: opts.wrap || 'none',
        caption: opts.caption || null,
        _img: opts._img || null,
        _naturalW: opts._naturalW || 0,
        _naturalH: opts._naturalH || 0,
      })
      return builder
    },

    /**
     * Add a heading
     * @param {string} text
     * @param {Object} [opts] - { level: 1|2|3 }
     */
    heading(text, opts = {}) {
      blocks.push({ type: 'heading', text, level: opts.level || 1, breakBefore: opts.breakBefore })
      return builder
    },

    /**
     * Add a paragraph. Supports **bold**, *italic*, __underline__, [link](url).
     * @param {string} text
     */
    paragraph(text) {
      blocks.push({ type: 'paragraph', text })
      return builder
    },

    /**
     * Add a bullet list. Supports nesting via nested arrays.
     * @param {(string|string[])[]} items
     * @param {Object} [opts] - { breakBefore }
     */
    bulletList(items, opts) {
      blocks.push({ type: 'bullet-list', items, ...opts })
      return builder
    },

    /**
     * Add a numbered list. Supports nesting via nested arrays.
     * @param {(string|string[])[]} items
     * @param {Object} [opts] - { breakBefore }
     */
    numberedList(items, opts) {
      blocks.push({ type: 'numbered-list', items, ...opts })
      return builder
    },

    /**
     * Add a quote/callout block
     * @param {string} text
     * @param {string} [attribution]
     */
    quote(text, attribution = '') {
      blocks.push({ type: 'quote', text, attribution })
      return builder
    },

    /**
     * Add a table with auto-sized columns and per-cell wrapping
     * @param {Object} opts
     * @param {string[]} opts.headers - Column header labels
     * @param {string[][]} opts.rows - Array of rows
     * @param {(number|'auto')[]} [opts.colWidths] - Column widths (number=fixed pt, 'auto'=proportional)
     * @param {('left'|'center'|'right')[]} [opts.align] - Per-column text alignment
     * @param {Object} [opts.borders] - { outer, header, rows, columns, width, color }
     */
    table(opts) {
      blocks.push({
        type: 'table',
        headers: opts.headers.join(', '),
        rows: opts.rows.map(r => r.join(', ')).join('\n'),
        colWidths: opts.colWidths,
        align: opts.align,
        borders: opts.borders,
      })
      return builder
    },

    /**
     * Add key-value pairs
     * @param {Object} data - { label: value, ... }
     */
    keyValue(data) {
      const items = Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n')
      blocks.push({ type: 'key-value', items })
      return builder
    },

    /**
     * Add a two-column layout
     * @param {string} left
     * @param {string} right
     */
    twoColumn(left, right) {
      blocks.push({ type: 'two-column', left, right })
      return builder
    },

    /**
     * Add stat cards
     * @param {Object} data - { label: value, ... }
     */
    statRow(data) {
      const items = Object.entries(data).map(([k, v]) => ({ label: String(k), value: String(v) }))
      blocks.push({ type: 'stat-row', items })
      return builder
    },

    /** Add a horizontal divider */
    divider() {
      blocks.push({ type: 'divider' })
      return builder
    },

    /**
     * Add vertical spacing
     * @param {number} [height=20]
     */
    spacer(height = 20) {
      blocks.push({ type: 'spacer', height })
      return builder
    },

    /** Force a page break */
    pageBreak() {
      blocks.push({ type: 'page-break' })
      return builder
    },

    /**
     * Add a table of contents (auto-generated from headings)
     * @param {Object} [opts]
     * @param {boolean|string} [opts.heading=true] - false to suppress auto-heading, or a custom heading string
     * @param {number} [opts.level=1] - heading level (1-3) when auto-heading is enabled
     */
    tableOfContents(opts) {
      blocks.push({ type: 'toc', ...opts })
      return builder
    },

    /**
     * Add multi-column flowing text
     * @param {string} text
     * @param {Object} [opts] - { columns: number, gap: number }
     */
    multiColumn(text, opts = {}) {
      blocks.push({ type: 'multi-column', text, columns: opts.columns || 3, gap: opts.gap || 16 })
      return builder
    },

    /**
     * Add a footnote (renders at page bottom)
     * @param {number|string} marker
     * @param {string} text
     */
    footnote(marker, text) {
      blocks.push({ type: 'footnote', marker: String(marker), text })
      return builder
    },

    /**
     * Add a raw block object (for advanced use or custom block types)
     * @param {Object} block
     */
    addBlock(block) {
      blocks.push(block)
      return builder
    },

    /**
     * Get the blocks array (for serialization/inspection)
     * @returns {Object[]}
     */
    getBlocks() {
      return blocks
    },

    /**
     * Build the document — runs Pretext layout and returns draw commands.
     * @returns {BuildResult}
     */
    build() {
      const base = PAGE_SIZES[sizeName] || PAGE_SIZES.a4
      const pageSize = orientation === 'landscape'
        ? { w: base.h, h: base.w }
        : { w: base.w, h: base.h }

      const engineOpts = {}
      if (options.measureTextWidth) engineOpts.measureTextWidth = options.measureTextWidth
      const flow = processBlocks(blocks, pageSize.w, pageSize.h, margin, colors, headerFooter, engineOpts)

      // Build outline tree from tracked headings
      const headings = flow.getHeadings()
      const outline = headings.map(h => ({
        text: h.text,
        level: h.level,
        page: h.page,
        y: h.y,
        id: h.id,
      }))

      return {
        pages: flow.pages,
        pageSize,
        watermark,
        metadata: options.metadata || {},
        outline,
      }
    },
  }

  return builder
}

/**
 * Render a JSON document schema directly to draw commands.
 * This is the template/data-driven API.
 *
 * @param {Object} schema - { page, colors, headerFooter, watermark, metadata, blocks }
 * @returns {{ pages: Object[][], pageSize: { w: number, h: number }, watermark: Object|null }}
 *
 * @example
 * const result = renderFromSchema({
 *   page: { size: 'a4', margin: 60 },
 *   blocks: [
 *     { type: 'heading', text: 'Hello', level: 1 },
 *     { type: 'paragraph', text: 'World' }
 *   ]
 * })
 */
export function renderFromSchema(schema) {
  const doc = createDocument({
    page: schema.page,
    colors: schema.colors,
    headerFooter: schema.headerFooter,
    watermark: schema.watermark,
    metadata: schema.metadata,
  })

  for (const block of (schema.blocks || [])) {
    doc.addBlock(block)
  }

  return doc.build()
}

// Re-export internals for advanced use
export { createFlowEngine } from './flow.js'
export { processBlocks } from './blocks.js'
export { hexToRgbArr } from './colors.js'
export { PAGE_SIZES } from './page-sizes.js'
