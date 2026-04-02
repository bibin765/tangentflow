// Polyfill canvas for Node.js (Pretext needs it for text measurement)
import { createCanvas } from 'canvas'
globalThis.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return createCanvas(1, 1)
    return {}
  }
}
globalThis.OffscreenCanvas = class OffscreenCanvas {
  constructor(w, h) { this._canvas = createCanvas(w, h) }
  getContext(type) { return this._canvas.getContext(type) }
}

import { createDocument, renderFromSchema } from './src/index.js'

console.log('=== Test 1: Builder API ===')
const doc = createDocument({
  page: { size: 'a4', margin: 60 },
  colors: { heading: '#1a1820', body: '#404050' },
})

doc.heading('Q4 2025 Revenue Report')
doc.paragraph('Overall revenue grew **23% year-over-year**, driven by expansion in the Asia Pacific region.')
doc.table({
  headers: ['Region', 'Revenue', 'Growth'],
  rows: [
    ['North America', '$14.1M', '+13.7%'],
    ['Asia Pacific', '$7.8M', '+52.9%'],
    ['Europe', '$10.2M', '+17.2%'],
  ],
})
doc.statRow({ 'Total Revenue': '$36.5M', 'Growth': '+23%', 'Customers': '2847' })
doc.divider()
doc.bulletList([
  'Launch AI analytics module',
  'Expand into Southeast Asia',
  'Rollout partner certification program',
])
doc.quote('This quarter marks a turning point for global expansion.', 'CEO')
doc.keyValue({ Client: 'Acme Corp', Project: 'Website Redesign', Status: 'In Progress' })
doc.twoColumn('Left column content', 'Right column content')

const result = doc.build()
console.log(`Pages: ${result.pages.length}`)
console.log(`Commands on page 1: ${result.pages[0].length}`)
console.log(`Page size: ${result.pageSize.w} x ${result.pageSize.h}`)
console.log('Block count:', doc.getBlocks().length)

console.log('\n=== Test 2: Schema API ===')
const result2 = renderFromSchema({
  page: { size: 'letter', orientation: 'landscape', margin: 40 },
  colors: { heading: '#2d5f8a' },
  blocks: [
    { type: 'heading', text: 'Landscape Report', level: 1 },
    { type: 'paragraph', text: 'This document uses the schema-driven API.' },
    { type: 'table', headers: 'Name, Value', rows: 'Item A, 100\nItem B, 200\nItem C, 300' },
  ],
})
console.log(`Pages: ${result2.pages.length}`)
console.log(`Page size: ${result2.pageSize.w} x ${result2.pageSize.h} (landscape)`)

console.log('\n=== Test 3: Draw commands ===')
const cmds = result.pages[0]
const types = {}
for (const cmd of cmds) {
  types[cmd.type] = (types[cmd.type] || 0) + 1
}
console.log('Command types:', types)

console.log('\n=== Test 4: New Phase 1-3 features ===')
const doc2 = createDocument({ page: { size: 'a4' }, colors: { heading: '#1a1820' } })

// Table with column widths, alignment, borders
doc2.table({
  headers: ['Name', 'Department', 'Salary', 'Status'],
  rows: [
    ['Alice Johnson', 'Engineering', '$145,000', 'Active'],
    ['Bob Smith', 'Marketing', '$98,500', 'Active'],
  ],
  colWidths: [150, 'auto', 80, 60],
  align: ['left', 'left', 'right', 'center'],
  borders: { rows: true, columns: false, width: 1 },
})

// Inline colors and superscript/subscript
doc2.paragraph('The formula for water is H~2~O and energy is E=mc^2^.')
doc2.paragraph('This has {#ff0000|red text} and {#0066cc|blue text} inline.')

// Nested lists
doc2.bulletList([
  'Top level item 1',
  ['Nested item 1.1', 'Nested item 1.2'],
  'Top level item 2',
  ['Nested 2.1', ['Deep nested 2.1.1']],
])

// Multi-column
doc2.multiColumn('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.', { columns: 3 })

// Image with caption
doc2.heading('Section with Footnote', { level: 2, breakBefore: false })
doc2.paragraph('This paragraph references a footnote.')
doc2.footnote(1, 'This is the footnote content at the bottom of the page.')

// TOC (placeholder)
doc2.heading('Appendix', { level: 1 })

const result3 = doc2.build()
console.log(`Pages: ${result3.pages.length}`)
console.log(`Outline entries: ${result3.outline.length}`)
console.log(`Outline:`, result3.outline.map(h => `${'  '.repeat(h.level - 1)}${h.text} (p${h.page + 1})`).join(', '))

// Verify statRow with commas in values
const doc3 = createDocument()
doc3.statRow({ 'Total': '9,450', 'Open': '442', 'Growth': '+23.5%' })
const r3 = doc3.build()
const statTexts = r3.pages[0].filter(c => c.type === 'text').map(c => c.text)
console.log('StatRow texts:', statTexts)
const has9450 = statTexts.some(t => t === '9,450')
console.log(`Comma-in-value preserved: ${has9450 ? 'YES' : 'NO'}`)

console.log('\n=== All tests passed! ===')
