import { createFlowEngine } from './flow.js'

export function processBlocks(blocks, pageW, pageH, margin, colors, headerFooter) {
  const c = colors
  const flow = createFlowEngine(pageW, pageH, margin, c, headerFooter)

  for (const block of blocks) {
    switch (block.type) {
      case 'image': {
        flow.addImage(block)
        flow.addSpacer(8)
        break
      }
      case 'heading': {
        const sizes = { 1: 22, 2: 16, 3: 13 }
        const fs = sizes[block.level] || 16
        flow.addSpacer(block.level === 1 ? 4 : 10)
        flow.addText(block.text, fs, 'bold', { bold: true, color: c.heading, lineHeightMult: 1.3 })
        flow.addSpacer(4)
        break
      }
      case 'paragraph': {
        const paragraphs = block.text.split('\n')
        paragraphs.forEach((p, i) => {
          if (p.trim()) {
            flow.addText(p, 11, 'regular', { color: c.body, lineHeightMult: 1.5 })
          }
          if (i < paragraphs.length - 1) flow.addSpacer(8)
        })
        flow.addSpacer(4)
        break
      }
      case 'bullet-list': {
        const items = block.items.split('\n').filter(s => s.trim())
        flow.addList(items, false)
        flow.addSpacer(4)
        break
      }
      case 'numbered-list': {
        const items = block.items.split('\n').filter(s => s.trim())
        flow.addList(items, true)
        flow.addSpacer(4)
        break
      }
      case 'quote': {
        flow.addQuote(block.text, block.attribution || '')
        flow.addSpacer(4)
        break
      }
      case 'table': {
        const headers = block.headers.split(',')
        const rows = block.rows.split('\n').filter(r => r.trim())
        flow.addTable(headers, rows)
        flow.addSpacer(8)
        break
      }
      case 'key-value': {
        const items = block.items.split('\n').filter(s => s.trim())
        flow.addKeyValue(items)
        flow.addSpacer(4)
        break
      }
      case 'two-column': {
        flow.addTwoColumn(block.left || '', block.right || '')
        flow.addSpacer(8)
        break
      }
      case 'spacer':
        flow.addSpacer(block.height)
        break
      case 'divider':
        flow.addDivider()
        break
      case 'page-break':
        flow.addPageBreak()
        break
      case 'stat-row': {
        const items = block.items.split(',').map(s => s.trim()).filter(Boolean)
        flow.addStatRow(items)
        break
      }
    }
  }

  flow.addHeadersFooters()
  return flow
}
