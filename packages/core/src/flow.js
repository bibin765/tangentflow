import { prepareWithSegments, layoutWithLines, layoutNextLine } from '@chenglou/pretext'
import { hexToRgbArr } from './colors.js'

export function createFlowEngine(pageW, pageH, margin, c, hf, opts) {
  const engineOpts = opts || {}
  const customMeasure = engineOpts.measureTextWidth || null // (text, fontSize, fontKey) => number
  const headerH = (hf && (hf.headerLeft || hf.headerRight || hf.logoSrc)) ? 28 : 0
  const footerH = (hf && (hf.footerLeft || hf.footerRightMode !== 'none')) ? 24 : 0
  const contentW = pageW - margin * 2
  const contentH = pageH - margin * 2 - headerH - footerH

  const pages = [[]]
  let curPage = 0
  let curY = 0

  // ─── Heading tracking (for TOC, bookmarks, internal links) ──
  const headings = [] // { text, level, page, y, id }

  function trackHeading(text, level) {
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    headings.push({ text, level, page: curPage, y: curY, id })
  }

  function getHeadings() { return headings }

  // ─── Footnote tracking ──
  const footnotes = [] // { marker, text, page }
  const footnoteReserved = {} // pageIndex → reserved height at bottom

  function getFootnoteReserved() {
    return footnoteReserved[curPage] || 0
  }

  function remainingOnPage() {
    return contentH - curY - getFootnoteReserved()
  }

  function newPage() {
    pages.push([])
    curPage++
    curY = 0
    activeFloat = null // clear float on new page
  }

  function ensureSpace(needed) {
    if (curY + needed > contentH - getFootnoteReserved()) {
      newPage()
    }
  }

  function addDrawCmd(cmd) {
    pages[curPage].push(cmd)
  }

  // Content area starts below header
  function contentTopY() {
    return pageH - margin - headerH
  }

  // ─── Float tracking ─────────────────────────────────────
  // When an image is floated, text wraps around it
  let activeFloat = null // { side: 'left'|'right', imgW, startY (curY when placed), endY (curY where float ends), gap }

  function getLineWidth() {
    if (!activeFloat || curY >= activeFloat.endY) {
      activeFloat = null
      return contentW
    }
    return contentW - activeFloat.imgW - activeFloat.gap
  }

  function getLineX() {
    if (!activeFloat || curY >= activeFloat.endY) return margin
    if (activeFloat.side === 'left') return margin + activeFloat.imgW + activeFloat.gap
    return margin // text starts at left when image is on the right
  }

  // ─── Inline formatting parser ────────────────────────
  // Parses **bold**, *italic*, __underline__, [link](url), {#hex|colored}, ^super^, ~sub~
  function parseInline(text) {
    const segments = []
    const re = /\*\*(.+?)\*\*|__(.+?)__|(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|\[([^\]]+)\]\(([^)]+)\)|\{(#[0-9a-fA-F]{3,8})\|([^}]+)\}|\^([^^]+)\^|~([^~]+)~|([^*_\[{^~]+)/g
    let m
    while ((m = re.exec(text)) !== null) {
      if (m[1] !== undefined) segments.push({ text: m[1], style: 'bold' })
      else if (m[2] !== undefined) segments.push({ text: m[2], style: 'underline' })
      else if (m[3] !== undefined) segments.push({ text: m[3], style: 'italic' })
      else if (m[4] !== undefined) segments.push({ text: m[4], style: 'link', url: m[5] })
      else if (m[7] !== undefined) segments.push({ text: m[7], style: 'color', color: hexToRgbArr(m[6]) })
      else if (m[8] !== undefined) segments.push({ text: m[8], style: 'superscript' })
      else if (m[9] !== undefined) segments.push({ text: m[9], style: 'subscript' })
      else if (m[10] !== undefined) segments.push({ text: m[10], style: 'regular' })
    }
    if (segments.length === 0) segments.push({ text, style: 'regular' })
    return segments
  }

  // Check if text has inline formatting
  function hasInlineFormatting(text) {
    return /\*\*.+?\*\*|__.+?__|(?<!\*)\*(?!\*).+?(?<!\*)\*(?!\*)|\[.+?\]\(.+?\)|\{#[0-9a-fA-F]+\|.+?\}|\^[^^]+\^|~[^~]+~/.test(text)
  }

  // ─── Heading (tracked for TOC/bookmarks) ─────────────
  function addHeading(text, level, fontSize, color) {
    if (level === 1) addSpacer(4); else addSpacer(10)
    trackHeading(text, level)
    addText(text, fontSize, 'bold', { bold: true, color, lineHeightMult: 1.3 })
    addSpacer(4)
  }

  // ─── Text block: uses Pretext for measurement ────────
  function addText(text, fontSize, fontKey, options = {}) {
    const { bold = false, color = [0, 0, 0], lineHeightMult = 1.4, indent = 0 } = options
    const lineHeight = fontSize * lineHeightMult

    // Check for inline formatting
    if (!bold && hasInlineFormatting(text)) {
      addRichText(text, fontSize, color, lineHeightMult, indent)
      return
    }

    const fontStr = `${bold ? 'bold ' : ''}${fontSize}px ${fontKey === 'bold' ? 'Helvetica Bold' : 'Helvetica'}`

    if (activeFloat) {
      // Float-aware rendering: use layoutNextLine with variable widths
      const prepared = prepareWithSegments(text, fontStr)
      let cursor = { segmentIndex: 0, graphemeIndex: 0 }
      const totalSegments = prepared.segments.length
      let maxIter = 500

      while (maxIter-- > 0) {
        // Check if all text is consumed
        if (cursor.segmentIndex >= totalSegments) break

        ensureSpace(lineHeight)
        const lineW = getLineWidth() - indent
        const lineX = getLineX() + indent

        const line = layoutNextLine(prepared, cursor, lineW)

        if (!line) {
          // layoutNextLine returned null — either text is done or width too narrow
          if (activeFloat) {
            // Width too narrow — skip ahead past the float and retry at full width
            curY = activeFloat.endY
            activeFloat = null
            continue
          }
          break
        }

        // Guard against non-advancing cursor
        if (line.end.segmentIndex === cursor.segmentIndex && line.end.graphemeIndex === cursor.graphemeIndex) {
          if (activeFloat) {
            curY = activeFloat.endY
            activeFloat = null
            continue
          }
          break
        }

        const absY = contentTopY() - curY - fontSize
        addDrawCmd({ type: 'text', text: line.text, x: lineX, y: absY, fontSize, fontKey, color })
        curY += lineHeight
        cursor = line.end

        // Check if we've passed the float
        if (activeFloat && curY >= activeFloat.endY) activeFloat = null
      }
    } else {
      // Standard rendering: full-width layout
      const maxWidth = contentW - indent
      const prepared = prepareWithSegments(text, fontStr)
      const result = layoutWithLines(prepared, maxWidth, lineHeight)

      for (const line of result.lines) {
        ensureSpace(lineHeight)
        const absX = margin + indent
        const absY = contentTopY() - curY - fontSize
        addDrawCmd({ type: 'text', text: line.text, x: absX, y: absY, fontSize, fontKey, color })
        curY += lineHeight
      }
    }
  }

  // ─── Rich text (inline bold/italic/underline/links) ──
  // Measure run width using Pretext (works in both browser and Node.js)
  function measureRunWidth(text, fontSize, fontKey) {
    // Use custom measure function if provided (e.g., pdf-lib font metrics)
    if (customMeasure) return customMeasure(text, fontSize, fontKey)

    const weight = fontKey === 'bold' ? 'bold ' : fontKey === 'italic' ? 'italic ' : ''
    const fontStr = `${weight}${fontSize}px Helvetica`
    const prep = prepareWithSegments(text, fontStr)
    // Sum segment widths directly to include trailing whitespace
    let totalWidth = 0
    for (const w of prep.widths) {
      totalWidth += w
    }
    return totalWidth
  }

  function addRichText(text, fontSize, color, lineHeightMult, indent) {
    const lineHeight = fontSize * lineHeightMult
    const maxWidth = contentW - indent
    const segments = parseInline(text)

    // Build styled character array: each char knows its style + metadata
    const chars = []
    for (const seg of segments) {
      for (const ch of seg.text) {
        chars.push({ ch, style: seg.style, url: seg.url, color: seg.color })
      }
    }

    // Get plain text and use Pretext for line-breaking
    const plainText = chars.map(c => c.ch).join('')
    const fontStr = `${fontSize}px Helvetica`
    const prepared = prepareWithSegments(plainText, fontStr)
    const result = layoutWithLines(prepared, maxWidth, lineHeight)

    // Walk through lines, matching each line's text back to the styled chars
    let charPos = 0
    for (const line of result.lines) {
      ensureSpace(lineHeight)
      const absY = contentTopY() - curY - fontSize

      // Find which chars belong to this line by matching the line text
      const lineText = line.text
      // Skip any leading whitespace that Pretext consumed between lines
      while (charPos < chars.length && chars[charPos].ch === ' ' && lineText.length > 0 && lineText[0] !== ' ') {
        charPos++
      }

      // Build styled runs from the chars for this line length
      const runs = []
      let currentStyle = null
      let currentUrl = null
      let currentColor = null
      let runText = ''

      for (let i = 0; i < lineText.length; i++) {
        const ci = charPos + i
        const ch = ci < chars.length ? chars[ci] : { style: 'regular' }

        if (ch.style !== currentStyle || ch.url !== currentUrl || ch.color !== currentColor) {
          if (runText) runs.push({ text: runText, style: currentStyle, url: currentUrl, color: currentColor })
          currentStyle = ch.style
          currentUrl = ch.url
          currentColor = ch.color
          runText = lineText[i]
        } else {
          runText += lineText[i]
        }
      }
      if (runText) runs.push({ text: runText, style: currentStyle, url: currentUrl, color: currentColor })

      // Render each run at the correct x position
      let x = margin + indent
      for (const run of runs) {
        if (!run.text) continue
        const fk = run.style === 'bold' ? 'bold' : run.style === 'italic' ? 'italic' : 'regular'
        let runColor = color
        if (run.style === 'link') runColor = c.accent
        else if (run.style === 'color' && run.color) runColor = run.color

        // Super/subscript: smaller font, shifted Y
        const isSuperSub = run.style === 'superscript' || run.style === 'subscript'
        const runFontSize = isSuperSub ? Math.round(fontSize * 0.7) : fontSize
        const yOffset = run.style === 'superscript' ? fontSize * 0.3 : run.style === 'subscript' ? -fontSize * 0.15 : 0

        addDrawCmd({ type: 'text', text: run.text, x, y: absY + yOffset, fontSize: runFontSize, fontKey: fk, color: runColor })

        const runW = measureRunWidth(run.text, isSuperSub ? runFontSize : fontSize, fk)
        x += runW

        if (run.style === 'underline' || run.style === 'link') {
          addDrawCmd({ type: 'line', x1: x - runW, y1: absY - 1, x2: x, y2: absY - 1, color: runColor, lineWidth: 0.5 })
        }
        if (run.style === 'link' && run.url) {
          addDrawCmd({ type: 'link', x: x - runW, y: absY - 2, w: runW, h: fontSize + 4, url: run.url })
        }
      }

      charPos += lineText.length
      curY += lineHeight
    }
  }

  // ─── Image block ────────────────────────────────────────
  function addImage(block) {
    if (!block.src || !block._img) return
    const aspect = block._naturalH / block._naturalW
    const drawW = Math.min(block.width || 200, contentW)
    const drawH = drawW * aspect
    const wrap = block.wrap || 'none'

    if (wrap !== 'none' && drawW < contentW * 0.8) {
      // Floating image — text wraps around it
      ensureSpace(Math.min(drawH, 40)) // at least need space for the image top

      let x = margin
      if (wrap === 'right') x = margin + contentW - drawW
      const y = contentTopY() - curY - drawH

      addDrawCmd({ type: 'image', img: block._img, src: block.src, x, y, w: drawW, h: drawH })

      // Set up float zone — subsequent text will wrap around this
      activeFloat = {
        side: wrap,
        imgW: drawW,
        startY: curY,
        endY: curY + drawH,
        gap: 10, // gap between image and text
      }
      // Don't advance curY — text flows beside the image
    } else {
      // Non-floating image — full width placement
      ensureSpace(drawH)

      let x = margin
      if (block.align === 'center') x = margin + (contentW - drawW) / 2
      else if (block.align === 'right') x = margin + contentW - drawW
      const y = contentTopY() - curY - drawH

      addDrawCmd({ type: 'image', img: block._img, src: block.src, x, y, w: drawW, h: drawH })
      curY += drawH
    }
  }

  // ─── Table (Pretext-powered per-cell wrapping) ─────────
  function measureCellText(text, fontSize, fontKey, maxWidth) {
    const fontStr = `${fontKey === 'bold' ? 'bold ' : ''}${fontSize}px Helvetica`
    const lineHeight = fontSize * 1.4
    const prepared = prepareWithSegments(text, fontStr)
    const result = layoutWithLines(prepared, maxWidth, lineHeight)
    return { lines: result.lines, height: result.lines.length * lineHeight, lineHeight }
  }

  function calculateColumnWidths(headers, rows, fontSize, explicitWidths) {
    const colCount = headers.length
    const cellPadX = 8
    const cellPadBoth = cellPadX * 2
    const minColW = 40
    const fontStr = `${fontSize}px Helvetica`
    const boldFontStr = `bold ${fontSize}px Helvetica`

    // If explicit widths provided, resolve them
    if (explicitWidths && explicitWidths.length === colCount) {
      const fixed = []
      let fixedTotal = 0
      let autoCount = 0
      for (let i = 0; i < colCount; i++) {
        if (typeof explicitWidths[i] === 'number') {
          fixed[i] = explicitWidths[i]
          fixedTotal += explicitWidths[i]
        } else {
          fixed[i] = null
          autoCount++
        }
      }
      const autoWidth = autoCount > 0 ? (contentW - fixedTotal) / autoCount : 0
      return fixed.map(w => w !== null ? w : Math.max(minColW, autoWidth))
    }

    // Measure natural (unwrapped) width of every cell
    const naturalWidths = new Array(colCount).fill(0)

    headers.forEach((h, ci) => {
      const prepared = prepareWithSegments(h.trim(), boldFontStr)
      const result = layoutWithLines(prepared, 9999, fontSize * 1.4)
      const w = result.lines.reduce((max, l) => Math.max(max, l.width), 0)
      naturalWidths[ci] = Math.max(naturalWidths[ci], w + cellPadBoth)
    })

    rows.forEach(row => {
      const cells = row.split(',')
      cells.forEach((cell, ci) => {
        if (ci >= colCount) return
        const prepared = prepareWithSegments(cell.trim(), fontStr)
        const result = layoutWithLines(prepared, 9999, fontSize * 1.4)
        const w = result.lines.reduce((max, l) => Math.max(max, l.width), 0)
        naturalWidths[ci] = Math.max(naturalWidths[ci], w + cellPadBoth)
      })
    })

    const totalNatural = naturalWidths.reduce((s, w) => s + w, 0)

    let colWidths
    if (totalNatural <= contentW) {
      const extra = contentW - totalNatural
      colWidths = naturalWidths.map(w => w + (extra * (w / totalNatural)))
    } else {
      colWidths = naturalWidths.map(w => Math.max(minColW, (w / totalNatural) * contentW))
      const total = colWidths.reduce((s, w) => s + w, 0)
      colWidths = colWidths.map(w => (w / total) * contentW)
    }

    return colWidths
  }

  function addTable(headers, rows, tableOpts) {
    clearFloat()
    const opts = tableOpts || {}
    const fontSize = 10
    const cellPadX = 8
    const cellPadY = 6
    const colCount = headers.length
    const colAlign = opts.align || []
    const borders = Object.assign({ outer: true, header: true, rows: true, columns: true, width: 0.5, color: null }, opts.borders || {})
    const borderColor = borders.color ? (Array.isArray(borders.color) ? borders.color : hexToRgbArr(borders.color)) : c.divider

    // Smart column width calculation using Pretext
    const colWidths = calculateColumnWidths(headers, rows, fontSize, opts.colWidths)

    function getColX(ci) {
      let x = margin
      for (let i = 0; i < ci; i++) x += colWidths[i]
      return x
    }

    // Helper: render wrapped lines top-aligned inside a cell
    // In PDF coords: top of cell = rowY + rowH, we want text starting cellPadY below that
    // Each line goes further down (decreasing Y in PDF)
    function renderCellLines(m, cellX, cellW, rowY, rowH, fontKey, color, align) {
      const topY = rowY + rowH - cellPadY - fontSize
      m.lines.forEach((line, li) => {
        let x = cellX + cellPadX
        if (align === 'right') {
          x = cellX + cellW - cellPadX - (line.width || 0)
        } else if (align === 'center') {
          x = cellX + (cellW - (line.width || 0)) / 2
        }
        addDrawCmd({
          type: 'text', text: line.text, x,
          y: topY - li * m.lineHeight,
          fontSize, fontKey, color
        })
      })
    }

    // ── Render header row ──
    function renderHeaderRow() {
      const headerMeasurements = headers.map((h, ci) => {
        return measureCellText(h.trim(), fontSize, 'bold', colWidths[ci] - cellPadX * 2)
      })
      const headerRowH = Math.max(24, ...headerMeasurements.map(m => m.height + cellPadY * 2))

      ensureSpace(headerRowH)
      const rowY = contentTopY() - curY - headerRowH

      // Header background
      addDrawCmd({ type: 'rect', x: margin, y: rowY, w: contentW, h: headerRowH, color: c.tableHeader })

      // Auto-contrast: use white text if header background is dark
      const headerTextColor = (() => {
        const bg = c.tableHeader
        if (Array.isArray(bg)) {
          const lum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]
          return lum < 0.5 ? [1, 1, 1] : c.heading
        }
        return c.heading
      })()

      // Header cell text (wrapped)
      headers.forEach((h, ci) => {
        const m = headerMeasurements[ci]
        renderCellLines(m, getColX(ci), colWidths[ci], rowY, headerRowH, 'bold', headerTextColor, colAlign[ci])

        if (borders.columns && ci > 0) {
          const sepX = getColX(ci)
          addDrawCmd({ type: 'line', x1: sepX, y1: rowY, x2: sepX, y2: rowY + headerRowH, color: borderColor, lineWidth: borders.width })
        }
      })

      if (borders.header) {
        addDrawCmd({ type: 'line', x1: margin, y1: rowY, x2: margin + contentW, y2: rowY, color: borderColor, lineWidth: borders.width })
      }

      curY += headerRowH
    }

    // Render header initially
    renderHeaderRow()

    // ── Render data rows with per-cell wrapping ──
    rows.forEach((row, ri) => {
      const cells = row.split(',')

      // Measure ALL cells in this row to find tallest
      const cellMeasurements = []
      for (let ci = 0; ci < colCount; ci++) {
        const text = (cells[ci] || '').trim()
        const m = measureCellText(text, fontSize, 'regular', colWidths[ci] - cellPadX * 2)
        cellMeasurements.push(m)
      }

      const rowH = Math.max(22, ...cellMeasurements.map(m => m.height + cellPadY * 2))

      // Check if we need a new page
      if (curY + rowH > contentH) {
        newPage()
        // Re-render header on new page
        renderHeaderRow()
      }

      const rowY = contentTopY() - curY - rowH

      // Zebra stripe
      if (ri % 2 === 0) {
        addDrawCmd({ type: 'rect', x: margin, y: rowY, w: contentW, h: rowH, color: c.tableStripe })
      }

      // Cell content (wrapped text)
      for (let ci = 0; ci < colCount; ci++) {
        const m = cellMeasurements[ci]
        renderCellLines(m, getColX(ci), colWidths[ci], rowY, rowH, 'regular', c.body, colAlign[ci])

        if (borders.columns && ci > 0) {
          const sepX = getColX(ci)
          addDrawCmd({ type: 'line', x1: sepX, y1: rowY, x2: sepX, y2: rowY + rowH, color: borderColor, lineWidth: borders.width })
        }
      }

      if (borders.rows) {
        addDrawCmd({ type: 'line', x1: margin, y1: rowY, x2: margin + contentW, y2: rowY, color: borderColor, lineWidth: borders.width })
      }

      curY += rowH
    })

    // Table bottom border
    if (borders.outer) {
      const bottomY = contentTopY() - curY
      addDrawCmd({ type: 'line', x1: margin, y1: bottomY, x2: margin + contentW, y2: bottomY, color: borderColor, lineWidth: borders.width })
    }
  }

  // ─── Divider ────────────────────────────────────────────
  function addDivider() {
    ensureSpace(12)
    const y = contentTopY() - curY - 6
    addDrawCmd({ type: 'line', x1: margin, y1: y, x2: margin + contentW, y2: y, color: c.divider })
    curY += 12
  }

  // ─── Spacer ─────────────────────────────────────────────
  function addSpacer(h) {
    curY += h
    if (curY > contentH) newPage()
  }

  // ─── Stat row ───────────────────────────────────────────
  function addStatRow(items) {
    clearFloat()
    const gap = 8
    const cardPadX = 6
    const cardPadY = 8
    const labelFontSize = 8
    const labelLH = labelFontSize * 1.3
    const cardW = (contentW - (items.length - 1) * gap) / items.length
    const innerW = cardW - cardPadX * 2

    // Measure all items — auto-scale value font if too wide
    const measured = items.map(item => {
      // Accept { label, value } objects or legacy "Label: Value" strings
      let label, value
      if (typeof item === 'object' && item.label !== undefined) {
        label = item.label
        value = item.value
      } else {
        const parts = String(item).split(':')
        label = parts[0]?.trim() || ''
        value = parts.slice(1).join(':').trim() || ''
      }

      // Label measurement
      const labelPrep = prepareWithSegments(label, `${labelFontSize}px Helvetica`)
      const labelResult = layoutWithLines(labelPrep, innerW, labelLH)

      // Auto-scale value font: start at 14, shrink until it fits in one line or hits minimum
      let vSize = 14
      let vLH = vSize * 1.3
      let valueResult
      while (vSize >= 9) {
        const valuePrep = prepareWithSegments(value, `bold ${vSize}px Helvetica`)
        valueResult = layoutWithLines(valuePrep, innerW, vLH)
        if (valueResult.lines.length <= 1) break
        vSize -= 1
        vLH = vSize * 1.3
      }
      // Final measurement at chosen size
      const valuePrep = prepareWithSegments(value, `bold ${vSize}px Helvetica`)
      valueResult = layoutWithLines(valuePrep, innerW, vLH)

      return { label, value, labelLines: labelResult.lines, valueLines: valueResult.lines,
        labelH: labelResult.lines.length * labelLH, valueH: valueResult.lines.length * vLH,
        valueFontSize: vSize, valueLH: vLH }
    })

    const cardH = Math.max(50, ...measured.map(m => m.labelH + m.valueH + cardPadY * 2 + 6))
    ensureSpace(cardH + 8)
    const baseY = contentTopY() - curY - cardH

    measured.forEach((m, i) => {
      const x = margin + i * (cardW + gap)

      // Card background
      addDrawCmd({ type: 'rect', x, y: baseY, w: cardW, h: cardH, color: c.statBg, radius: 4 })

      // Vertically center label + value group
      const totalContentH = m.labelH + 6 + m.valueH
      const startFromTop = (cardH - totalContentH) / 2
      const cardTop = baseY + cardH

      // Label lines (top)
      m.labelLines.forEach((line, li) => {
        const y = cardTop - startFromTop - labelFontSize - li * labelLH
        addDrawCmd({ type: 'text', text: line.text, x: x + cardW / 2, y, fontSize: labelFontSize, fontKey: 'regular', color: c.muted, align: 'center' })
      })

      // Value lines (below label + gap)
      m.valueLines.forEach((line, li) => {
        const y = cardTop - startFromTop - m.labelH - 6 - m.valueFontSize - li * m.valueLH
        addDrawCmd({ type: 'text', text: line.text, x: x + cardW / 2, y, fontSize: m.valueFontSize, fontKey: 'bold', color: c.heading, align: 'center' })
      })
    })
    curY += cardH + 8
  }

  // ─── Clear float ─────────────────────────────────────────
  function clearFloat() {
    if (activeFloat) {
      curY = Math.max(curY, activeFloat.endY)
      activeFloat = null
    }
  }

  // ─── Bullet / Numbered list ──────────────────────────────
  function addList(items, ordered, depth) {
    if (!depth) clearFloat() // only clear float for top-level lists
    const level = depth || 0
    const fontSize = 11
    const lineHeight = fontSize * 1.5
    const baseIndent = 18
    const levelIndent = level * 14
    const indent = baseIndent + levelIndent
    const markerWidth = ordered ? 20 : 12
    const bulletChars = ['\u2022', '\u25E6', '\u25AA'] // • ◦ ▪

    let counter = 0
    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      // Nested list: array within the items array
      if (Array.isArray(item)) {
        addList(item, ordered, level + 1)
        continue
      }

      if (typeof item === 'string' && !item.trim()) continue
      counter++

      const marker = ordered ? `${counter}.` : (bulletChars[level] || bulletChars[bulletChars.length - 1])
      const fontStr = `${fontSize}px Helvetica`
      const prepared = prepareWithSegments(String(item), fontStr)
      const result = layoutWithLines(prepared, contentW - indent - markerWidth, lineHeight)

      for (let li = 0; li < result.lines.length; li++) {
        ensureSpace(lineHeight)
        const absY = contentTopY() - curY - fontSize
        if (li === 0) {
          addDrawCmd({ type: 'text', text: marker, x: margin + indent - markerWidth, y: absY, fontSize, fontKey: 'regular', color: c.muted })
        }
        addDrawCmd({ type: 'text', text: result.lines[li].text, x: margin + indent, y: absY, fontSize, fontKey: 'regular', color: c.body })
        curY += lineHeight
      }
      curY += 2
    }
  }

  // ─── Quote / Callout ────────────────────────────────────
  function addQuote(text, attribution) {
    clearFloat()
    const fontSize = 11
    const lineHeight = fontSize * 1.6
    const barWidth = 3
    const padLeft = 14
    const fontStr = `italic ${fontSize}px Helvetica`
    const prepared = prepareWithSegments(text, fontStr)
    const result = layoutWithLines(prepared, contentW - padLeft - barWidth, lineHeight)

    // Calculate total height to draw the bar
    const attrHeight = attribution ? fontSize * 1.5 + 4 : 0
    const totalH = result.lines.length * lineHeight + attrHeight + 8

    ensureSpace(Math.min(totalH, lineHeight * 3)) // at least fit 3 lines

    const startY = curY

    for (const line of result.lines) {
      ensureSpace(lineHeight)
      const absY = contentTopY() - curY - fontSize
      addDrawCmd({ type: 'text', text: line.text, x: margin + barWidth + padLeft, y: absY, fontSize, fontKey: 'regular', color: c.body })
      curY += lineHeight
    }

    if (attribution) {
      curY += 4
      ensureSpace(fontSize * 1.5)
      const absY = contentTopY() - curY - fontSize
      addDrawCmd({ type: 'text', text: `— ${attribution}`, x: margin + barWidth + padLeft, y: absY, fontSize: 10, fontKey: 'regular', color: c.muted })
      curY += fontSize * 1.5
    }

    // Draw accent bar on the left
    const barTop = pageH - margin - startY
    const barBottom = contentTopY() - curY
    addDrawCmd({ type: 'line', x1: margin + 1.5, y1: barTop, x2: margin + 1.5, y2: barBottom, color: c.quoteBar, lineWidth: barWidth })

    curY += 4
  }

  // ─── Key-Value list ─────────────────────────────────────
  function addKeyValue(items) {
    clearFloat()
    const fontSize = 10
    const lineHeight = fontSize * 1.8
    const labelWidth = 120

    items.forEach(item => {
      const parts = item.split(':')
      const label = parts[0]?.trim() || ''
      const value = parts.slice(1).join(':').trim() || ''

      ensureSpace(lineHeight)
      const absY = contentTopY() - curY - fontSize

      // Label (bold, muted)
      addDrawCmd({ type: 'text', text: label, x: margin, y: absY, fontSize, fontKey: 'bold', color: c.muted })
      // Value (regular)
      // Measure label to position value dynamically
      const labelFont = `bold ${fontSize}px Helvetica`
      const labelPrepared = prepareWithSegments(label, labelFont)
      const labelResult = layoutWithLines(labelPrepared, 9999, lineHeight)
      const labelActualW = Math.max(labelWidth, (labelResult.lines[0]?.width || 0) + 12)

      const valuePrepared = prepareWithSegments(value, `${fontSize}px Helvetica`)
      const valueResult = layoutWithLines(valuePrepared, contentW - labelActualW, lineHeight)

      for (let li = 0; li < valueResult.lines.length; li++) {
        if (li > 0) {
          curY += lineHeight
          ensureSpace(lineHeight)
        }
        const vy = contentTopY() - curY - fontSize
        addDrawCmd({ type: 'text', text: valueResult.lines[li].text, x: margin + labelActualW, y: vy, fontSize, fontKey: 'regular', color: c.body })
      }

      curY += lineHeight
      // Separator line
      const sepY = contentTopY() - curY + 2
      addDrawCmd({ type: 'line', x1: margin, y1: sepY, x2: margin + contentW, y2: sepY, color: c.divider })
      curY += 4
    })
  }

  // ─── Two Column ─────────────────────────────────────────
  function addTwoColumn(leftText, rightText) {
    clearFloat()
    const fontSize = 11
    const lineHeight = fontSize * 1.5
    const gap = 20
    const colW = (contentW - gap) / 2
    const fontStr = `${fontSize}px Helvetica`

    const leftPrepared = prepareWithSegments(leftText, fontStr)
    const leftResult = layoutWithLines(leftPrepared, colW, lineHeight)
    const rightPrepared = prepareWithSegments(rightText, fontStr)
    const rightResult = layoutWithLines(rightPrepared, colW, lineHeight)

    const maxLines = Math.max(leftResult.lines.length, rightResult.lines.length)
    const totalH = maxLines * lineHeight

    ensureSpace(Math.min(totalH, lineHeight * 3))

    for (let li = 0; li < maxLines; li++) {
      ensureSpace(lineHeight)
      const absY = contentTopY() - curY - fontSize

      if (li < leftResult.lines.length) {
        addDrawCmd({ type: 'text', text: leftResult.lines[li].text, x: margin, y: absY, fontSize, fontKey: 'regular', color: c.body })
      }
      if (li < rightResult.lines.length) {
        addDrawCmd({ type: 'text', text: rightResult.lines[li].text, x: margin + colW + gap, y: absY, fontSize, fontKey: 'regular', color: c.body })
      }
      curY += lineHeight
    }
  }

  // ─── Page break with options ─────────────────────────────
  function addPageBreak(opts) {
    newPage()
  }

  // ─── TOC (table of contents) ────────────────────────────
  function addTOC(tocOpts) {
    const opts = tocOpts || {}
    // Auto-heading unless heading: false
    if (opts.heading !== false) {
      const headingText = typeof opts.heading === 'string' ? opts.heading : 'Table of Contents'
      const headingLevel = opts.level || 1
      const sizes = { 1: 22, 2: 16, 3: 13 }
      addHeading(headingText, headingLevel, sizes[headingLevel] || 16, c.heading)
      addSpacer(8)
    }

    // Store insertion point — entries will be rendered by renderTOC() after all blocks
    const tocPage = curPage
    const tocY = curY
    addDrawCmd({ type: '_toc_marker', page: tocPage, y: tocY })
    curY += 200 // rough estimate, filled by renderTOC
  }

  function renderTOC() {
    // Find the TOC marker
    let tocPage = -1, tocCmdIdx = -1
    for (let pi = 0; pi < pages.length; pi++) {
      for (let ci = 0; ci < pages[pi].length; ci++) {
        if (pages[pi][ci].type === '_toc_marker') {
          tocPage = pi
          tocCmdIdx = ci
          break
        }
      }
      if (tocPage >= 0) break
    }
    if (tocPage < 0) return // no TOC requested

    // Remove placeholder
    const marker = pages[tocPage][tocCmdIdx]
    pages[tocPage].splice(tocCmdIdx, 1)

    // Generate TOC entries from tracked headings
    const fontSize = 11
    const lh = fontSize * 1.6
    const tocCmds = []
    let y = marker.y

    for (const h of headings) {
      // Skip the TOC heading itself
      if (h.text === 'Table of Contents') continue

      const indent = (h.level - 1) * 16
      const pageNum = `${h.page + 1}`
      const dotLeader = '.' .repeat(Math.max(1, Math.floor((contentW - indent - 40) / 4)))

      // Heading text (left)
      const textY = contentTopY() - y - fontSize
      tocCmds.push({
        type: 'text',
        text: h.text,
        x: margin + indent,
        y: textY,
        fontSize: h.level === 1 ? 11 : 10,
        fontKey: h.level === 1 ? 'bold' : 'regular',
        color: c.body,
      })

      // Page number (right-aligned)
      tocCmds.push({
        type: 'text',
        text: pageNum,
        x: margin + contentW,
        y: textY,
        fontSize: 10,
        fontKey: 'regular',
        color: c.muted,
        align: 'right',
      })

      y += lh
    }

    // Insert TOC entries into the page
    pages[tocPage].splice(tocCmdIdx, 0, ...tocCmds)
  }

  // ─── Multi-column flowing text ──────────────────────────
  function addMultiColumn(text, opts) {
    clearFloat()
    const columns = (opts && opts.columns) || 3
    const gap = (opts && opts.gap) || 16
    const fontSize = 11
    const lineHeight = fontSize * 1.5
    const colW = (contentW - (columns - 1) * gap) / columns
    const fontStr = `${fontSize}px Helvetica`

    const prepared = prepareWithSegments(text, fontStr)

    // Layout all lines at column width
    const result = layoutWithLines(prepared, colW, lineHeight)
    const lines = result.lines

    // Distribute lines across columns, balanced
    const linesPerCol = Math.ceil(lines.length / columns)
    const colStartY = curY

    for (let col = 0; col < columns; col++) {
      const startLine = col * linesPerCol
      const endLine = Math.min(startLine + linesPerCol, lines.length)
      const colX = margin + col * (colW + gap)

      let localY = colStartY
      for (let li = startLine; li < endLine; li++) {
        ensureSpace(lineHeight)
        const absY = contentTopY() - localY - fontSize
        addDrawCmd({ type: 'text', text: lines[li].text, x: colX, y: absY, fontSize, fontKey: 'regular', color: c.body })
        localY += lineHeight
      }
    }

    // Advance curY past the tallest column
    curY = colStartY + linesPerCol * lineHeight
  }

  // ─── Image with caption ─────────────────────────────────
  function addImageWithCaption(block) {
    addImage(block)
    if (block.caption) {
      const capFontSize = 9
      const capLH = capFontSize * 1.4
      const capFont = `italic ${capFontSize}px Helvetica`
      const prepared = prepareWithSegments(block.caption, capFont)
      const result = layoutWithLines(prepared, contentW, capLH)
      for (const line of result.lines) {
        ensureSpace(capLH)
        const absY = contentTopY() - curY - capFontSize
        addDrawCmd({ type: 'text', text: line.text, x: margin + (contentW - (line.width || 0)) / 2, y: absY, fontSize: capFontSize, fontKey: 'italic', color: c.muted })
        curY += capLH
      }
      curY += 4
    }
  }

  // ─── Footnote collection ────────────────────────────────
  function addFootnote(marker, text) {
    footnotes.push({ marker: String(marker), text, page: curPage })

    // Reserve space at bottom of current page for this footnote
    const fnFontSize = 8
    const fnLH = fnFontSize * 1.4
    const isFirstOnPage = !footnoteReserved[curPage]
    const separatorH = isFirstOnPage ? 12 : 0 // separator line + padding only once per page
    footnoteReserved[curPage] = (footnoteReserved[curPage] || 0) + fnLH + separatorH
  }

  function renderFootnotes() {
    // Group footnotes by page, render at bottom of content area
    const byPage = {}
    for (const fn of footnotes) {
      if (!byPage[fn.page]) byPage[fn.page] = []
      byPage[fn.page].push(fn)
    }
    for (const [pageIdx, fns] of Object.entries(byPage)) {
      const pi = parseInt(pageIdx)
      const cmds = pages[pi]
      if (!cmds) continue
      const fontSize = 8
      const lh = fontSize * 1.4

      // Position footnotes at the bottom of the content area (above footer)
      const contentBottom = margin + footerH // bottom of content area in PDF Y
      const reserved = footnoteReserved[pi] || (fns.length * lh + 12)

      // Separator line at top of footnote area
      const sepY = contentBottom + reserved
      cmds.push({ type: 'line', x1: margin, y1: sepY, x2: margin + contentW * 0.3, y2: sepY, color: c.divider })

      // Render footnotes bottom-up from separator
      fns.forEach((fn, i) => {
        const y = sepY - 8 - (i + 1) * lh + lh
        cmds.push({ type: 'text', text: `${fn.marker}. ${fn.text}`, x: margin, y, fontSize, fontKey: 'regular', color: c.muted })
      })
    }
  }

  // ─── Page numbers (legacy, now handled by addHeadersFooters) ──
  function addPageNumbers() {
    // No-op — handled by addHeadersFooters
  }

  // ─── Header & Footer on every page ──────────────────────
  // Truncate text to fit within maxWidth, adding ellipsis if needed
  function truncateToFit(text, font, maxWidth) {
    if (maxWidth <= 0) return ''
    const prep = prepareWithSegments(text, font)
    const result = layoutWithLines(prep, 99999, 20)
    const fullW = result.lines[0]?.width || 0
    if (fullW <= maxWidth) return text
    // Binary search for truncation point
    let lo = 0, hi = text.length, best = ''
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const candidate = text.slice(0, mid) + '\u2026'
      const p = prepareWithSegments(candidate, font)
      const r = layoutWithLines(p, 99999, 20)
      if ((r.lines[0]?.width || 0) <= maxWidth) {
        best = candidate
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return best || '\u2026'
  }

  function addHeadersFooters() {
    if (!hf) return
    const total = pages.length
    const hfContentW = contentW

    pages.forEach((cmds, pi) => {
      // Header
      if (headerH > 0) {
        const hTop = pageH - margin
        let leftEndX = margin // tracks where left content ends

        // Logo
        if (hf._logoImg && hf.logoSrc) {
          const logoMaxH = 20
          const aspect = hf._logoW / hf._logoH
          const logoW = logoMaxH * aspect
          cmds.push({ type: 'image', img: hf._logoImg, src: hf.logoSrc, x: margin, y: hTop - logoMaxH - 2, w: logoW, h: logoMaxH })
          leftEndX = margin + logoW + 8
          if (hf.headerLeft) {
            // Measure left text width
            const leftFont = 'bold 9px Helvetica'
            const leftPrep = prepareWithSegments(hf.headerLeft, leftFont)
            const leftW = layoutWithLines(leftPrep, 99999, 14).lines[0]?.width || 0
            cmds.push({ type: 'text', text: hf.headerLeft, x: leftEndX, y: hTop - 14, fontSize: 9, fontKey: 'bold', color: c.heading })
            leftEndX += leftW + 12
          }
        } else if (hf.headerLeft) {
          const leftFont = 'bold 9px Helvetica'
          const leftPrep = prepareWithSegments(hf.headerLeft, leftFont)
          const leftW = layoutWithLines(leftPrep, 99999, 14).lines[0]?.width || 0
          cmds.push({ type: 'text', text: hf.headerLeft, x: margin, y: hTop - 14, fontSize: 9, fontKey: 'bold', color: c.heading })
          leftEndX = margin + leftW + 12
        }

        if (hf.headerRight) {
          // Available space for right text = total width - left content used
          const rightAvail = pageW - margin - leftEndX
          const rightFont = '9px Helvetica'
          const truncated = truncateToFit(hf.headerRight, rightFont, rightAvail)
          if (truncated) {
            cmds.push({ type: 'text', text: truncated, x: pageW - margin, y: hTop - 14, fontSize: 9, fontKey: 'regular', color: c.muted, align: 'right' })
          }
        }

        cmds.push({ type: 'line', x1: margin, y1: hTop - headerH + 4, x2: pageW - margin, y2: hTop - headerH + 4, color: c.divider })
      }

      // Footer
      if (footerH > 0) {
        const fBot = margin + footerH
        cmds.push({ type: 'line', x1: margin, y1: fBot - 4, x2: pageW - margin, y2: fBot - 4, color: c.divider })

        let footerLeftEndX = margin

        if (hf.footerLeft) {
          const leftFont = '8px Helvetica'
          const leftPrep = prepareWithSegments(hf.footerLeft, leftFont)
          const leftW = layoutWithLines(leftPrep, 99999, 14).lines[0]?.width || 0
          const truncated = truncateToFit(hf.footerLeft, leftFont, hfContentW * 0.6)
          cmds.push({ type: 'text', text: truncated, x: margin, y: fBot - 18, fontSize: 8, fontKey: 'regular', color: c.muted })
          footerLeftEndX = margin + leftW + 12
        }

        let footerRight = ''
        if (hf.footerRightMode === 'page-number') footerRight = `Page ${pi + 1} of ${total}`
        else if (hf.footerRightMode === 'custom') footerRight = hf.footerCustom || ''

        if (footerRight) {
          const rightAvail = pageW - margin - footerLeftEndX
          const rightFont = '8px Helvetica'
          const truncated = truncateToFit(footerRight, rightFont, rightAvail)
          if (truncated) {
            cmds.push({ type: 'text', text: truncated, x: pageW - margin, y: fBot - 18, fontSize: 8, fontKey: 'regular', color: c.muted, align: 'right' })
          }
        }
      }
    })
  }

  return {
    addText, addHeading, addImage, addImageWithCaption, addTable, addDivider, addSpacer,
    addStatRow, addList, addQuote, addKeyValue, addTwoColumn, addMultiColumn,
    addPageBreak, addTOC, renderTOC, addFootnote, renderFootnotes, clearFloat,
    addPageNumbers, addHeadersFooters,
    pages, getHeadings, getMetrics: () => ({ pageCount: pages.length, contentW, contentH }),
  }
}
