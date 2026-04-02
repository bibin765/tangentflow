import { createFlowEngine } from './flow.js'

export function processBlocks(blocks, pageW, pageH, margin, colors, headerFooter, engineOpts) {
  const c = colors
  const flow = createFlowEngine(pageW, pageH, margin, c, headerFooter, engineOpts)

  for (const block of blocks) {
    // Page break control options
    if (block.breakBefore) flow.addPageBreak()

    switch (block.type) {
      case 'image': {
        if (block.caption) {
          flow.addImageWithCaption(block)
        } else {
          flow.addImage(block)
          flow.addSpacer(8)
        }
        break
      }
      case 'heading': {
        const sizes = { 1: 22, 2: 16, 3: 13 }
        const fs = sizes[block.level] || 16
        flow.addHeading(block.text, block.level, fs, c.heading)
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
        const items = Array.isArray(block.items) ? block.items : block.items.split('\n').filter(s => s.trim())
        flow.addList(items, false)
        flow.addSpacer(4)
        break
      }
      case 'numbered-list': {
        const items = Array.isArray(block.items) ? block.items : block.items.split('\n').filter(s => s.trim())
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
        const headers = Array.isArray(block.headers) ? block.headers : block.headers.split(',')
        const rows = Array.isArray(block.rows) ? block.rows : block.rows.split('\n').filter(r => r.trim())
        flow.addTable(headers, rows, { colWidths: block.colWidths, align: block.align, borders: block.borders })
        flow.addSpacer(8)
        break
      }
      case 'key-value': {
        const items = Array.isArray(block.items) ? block.items : block.items.split('\n').filter(s => s.trim())
        flow.addKeyValue(items)
        flow.addSpacer(4)
        break
      }
      case 'two-column': {
        flow.addTwoColumn(block.left || '', block.right || '')
        flow.addSpacer(8)
        break
      }
      case 'multi-column': {
        flow.addMultiColumn(block.text || '', { columns: block.columns, gap: block.gap })
        flow.addSpacer(8)
        break
      }
      case 'toc': {
        flow.addTOC(block)
        break
      }
      case 'footnote': {
        flow.addFootnote(block.marker, block.text)
        break
      }
      case 'spacer':
        flow.addSpacer(block.height)
        break
      case 'divider':
        flow.addDivider()
        break
      case 'page-break':
        flow.addPageBreak(block)
        break
      case 'stat-row': {
        let items
        if (Array.isArray(block.items)) {
          items = block.items
        } else {
          items = block.items.split(/,\s+(?=[^,]*:)/).map(s => {
            const parts = s.split(':')
            return { label: parts[0]?.trim() || '', value: parts.slice(1).join(':').trim() || '' }
          }).filter(i => i.label || i.value)
        }
        flow.addStatRow(items)
        break
      }
    }
  }

  flow.renderTOC()
  flow.renderFootnotes()
  flow.addHeadersFooters()
  return flow
}
