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

console.log('\n=== All tests passed! ===')
