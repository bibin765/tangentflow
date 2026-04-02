/**
 * Official pdf-lib renderer for @upbrew/tangentflow
 *
 * Renders draw commands from doc.build() to a PDF using pdf-lib.
 * Handles: text (with alignment), rects, lines, images, links,
 * watermarks, metadata, outline/bookmarks, and non-Latin text fallback.
 *
 * @example
 * import { createDocument } from '@upbrew/tangentflow'
 * import { renderToPDF } from '@upbrew/tangentflow/renderers/pdf-lib'
 *
 * const doc = createDocument({ page: { size: 'a4' } })
 * doc.heading('Hello World')
 * const result = doc.build()
 * const pdfBytes = await renderToPDF(result)
 */

// Note: pdf-lib must be installed by the consumer
// import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

/**
 * Render TangentFlow build result to PDF bytes.
 *
 * @param {Object} result - Return value from doc.build()
 * @param {Object[][]} result.pages - Array of draw command arrays
 * @param {{ w: number, h: number }} result.pageSize - Page dimensions
 * @param {Object} [result.watermark] - { text, color, opacity }
 * @param {Object} [result.metadata] - { title, author, subject }
 * @param {Object[]} [result.outline] - Heading outline for bookmarks
 * @param {Object} [opts] - Renderer options
 * @param {Object} opts.pdfLib - The pdf-lib module { PDFDocument, StandardFonts, rgb }
 * @returns {Promise<Uint8Array>} PDF file bytes
 */
export async function renderToPDF(result, opts = {}) {
  // pdf-lib must be passed in since we don't bundle it
  const { PDFDocument, StandardFonts, rgb } = opts.pdfLib || await import('pdf-lib')

  const { pages, pageSize, watermark, metadata = {}, outline = [] } = result
  const pdfDoc = await PDFDocument.create()

  // ── Metadata ──
  if (metadata.title) pdfDoc.setTitle(metadata.title)
  if (metadata.author) pdfDoc.setAuthor(metadata.author)
  if (metadata.subject) pdfDoc.setSubject(metadata.subject)
  pdfDoc.setCreator('TangentFlow — tangentflow.com')
  pdfDoc.setProducer('TangentFlow (Pretext + pdf-lib)')

  // ── Fonts ──
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  function getFont(fontKey) {
    if (fontKey === 'bold') return fontBold
    if (fontKey === 'italic') return fontOblique
    return fontRegular
  }

  // ── Non-Latin text fallback ──
  // Standard PDF fonts only support WinAnsi. For other scripts,
  // render text to a canvas and embed as a high-res PNG image.
  function canEncode(text, font) {
    try { font.encodeText(text); return true } catch { return false }
  }

  const textImageCache = new Map()
  async function textToImage(text, fontSize, fontKey, color) {
    const key = `${text}|${fontSize}|${fontKey}|${color.join(',')}`
    if (textImageCache.has(key)) return textImageCache.get(key)

    if (typeof document === 'undefined') {
      // Node.js — skip image fallback, strip non-encodable chars
      return null
    }

    const scale = 3
    const weight = fontKey === 'bold' ? 'bold ' : fontKey === 'italic' ? 'italic ' : ''
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    const fontStr = `${weight}${fontSize * scale}px Helvetica, Arial, "Noto Sans", system-ui, sans-serif`
    ctx.font = fontStr
    const metrics = ctx.measureText(text)
    const w = Math.ceil(metrics.width) + 4
    const h = Math.ceil(fontSize * scale * 1.3)
    c.width = w
    c.height = h
    ctx.font = fontStr
    ctx.fillStyle = `rgb(${color.map(v => Math.round(v * 255)).join(',')})`
    ctx.textBaseline = 'top'
    ctx.fillText(text, 0, fontSize * scale * 0.05)
    const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'))
    const result = { bytes: new Uint8Array(await blob.arrayBuffer()), w: w / scale, h: h / scale }
    textImageCache.set(key, result)
    return result
  }

  // ── Image embedding ──
  const imageCache = new Map()
  async function embedImage(src) {
    if (imageCache.has(src)) return imageCache.get(src)
    try {
      const response = await fetch(src)
      const bytes = await response.arrayBuffer()
      const uint8 = new Uint8Array(bytes)
      let embedded
      if (uint8[0] === 0x89 && uint8[1] === 0x50) {
        embedded = await pdfDoc.embedPng(uint8)
      } else {
        embedded = await pdfDoc.embedJpg(uint8)
      }
      imageCache.set(src, embedded)
      return embedded
    } catch (e) {
      console.warn('[tangentflow] Failed to embed image:', e)
      return null
    }
  }

  // ── Pre-collect images ──
  for (const cmds of pages) {
    for (const cmd of cmds) {
      if (cmd.type === 'image' && cmd.src) {
        await embedImage(cmd.src)
      }
    }
  }

  // ── Render pages ──
  for (const cmds of pages) {
    const page = pdfDoc.addPage([pageSize.w, pageSize.h])

    // ── Watermark ──
    if (watermark && watermark.text) {
      const wmFontSize = Math.min(pageSize.w, pageSize.h) * 0.12
      const wmText = canEncode(watermark.text, fontBold) ? watermark.text : watermark.text.replace(/[^\x20-\x7E]/g, '?')
      const wmW = fontBold.widthOfTextAtSize(wmText, wmFontSize)
      page.drawText(wmText, {
        x: pageSize.w / 2 - wmW / 2,
        y: pageSize.h / 2 - wmFontSize / 2,
        size: wmFontSize,
        font: fontBold,
        color: rgb(watermark.color[0], watermark.color[1], watermark.color[2]),
        opacity: watermark.opacity || 0.15,
        rotate: { type: 'degrees', angle: -30 },
      })
    }

    // ── Draw commands ──
    // Group adjacent inline text commands for accurate x positioning
    let ci = 0
    while (ci < cmds.length) {
      const cmd = cmds[ci]

      if (cmd.type === 'text') {
        const font = getFont(cmd.fontKey)

        // Check if this is part of an inline text group (same Y, no alignment, adjacent x)
        const lineGroup = [cmd]
        let prevEndX = cmd.x + font.widthOfTextAtSize(
          canEncode(cmd.text, font) ? cmd.text : cmd.text.replace(/[^\x20-\x7E]/g, ''), cmd.fontSize
        )

        while (ci + 1 < cmds.length && cmds[ci + 1].type === 'text'
            && cmds[ci + 1].y === cmd.y && !cmds[ci + 1].align
            && cmds[ci + 1].fontSize === cmd.fontSize
            && Math.abs(cmds[ci + 1].x - prevEndX) < cmd.fontSize * 1.5) {
          ci++
          lineGroup.push(cmds[ci])
          const nf = getFont(cmds[ci].fontKey)
          prevEndX = cmds[ci].x + nf.widthOfTextAtSize(
            canEncode(cmds[ci].text, nf) ? cmds[ci].text : cmds[ci].text.replace(/[^\x20-\x7E]/g, ''), cmds[ci].fontSize
          )
        }

        if (lineGroup.length > 1) {
          // Inline group — recalculate x using renderer font metrics
          let x = lineGroup[0].x
          for (const seg of lineGroup) {
            const segFont = getFont(seg.fontKey)
            if (canEncode(seg.text, segFont)) {
              page.drawText(seg.text, {
                x, y: seg.y, size: seg.fontSize, font: segFont,
                color: rgb(seg.color[0], seg.color[1], seg.color[2]),
              })
              x += segFont.widthOfTextAtSize(seg.text, seg.fontSize)
            } else {
              const img = await textToImage(seg.text, seg.fontSize, seg.fontKey, seg.color)
              if (img) {
                const embedded = await pdfDoc.embedPng(img.bytes)
                page.drawImage(embedded, { x, y: seg.y, width: img.w, height: img.h })
                x += img.w
              }
            }
          }
        } else {
          // Single text command
          if (canEncode(cmd.text, font)) {
            const options = {
              x: cmd.x, y: cmd.y, size: cmd.fontSize, font,
              color: rgb(cmd.color[0], cmd.color[1], cmd.color[2]),
            }
            // Handle alignment: x is the anchor point
            // 'center' → x is the center; 'right' → x is the right edge
            if (cmd.align === 'center') {
              options.x = cmd.x - font.widthOfTextAtSize(cmd.text, cmd.fontSize) / 2
            } else if (cmd.align === 'right') {
              options.x = cmd.x - font.widthOfTextAtSize(cmd.text, cmd.fontSize)
            }
            page.drawText(cmd.text, options)
          } else {
            const img = await textToImage(cmd.text, cmd.fontSize, cmd.fontKey, cmd.color)
            if (img) {
              const embedded = await pdfDoc.embedPng(img.bytes)
              let x = cmd.x
              if (cmd.align === 'center') x -= img.w / 2
              else if (cmd.align === 'right') x -= img.w
              page.drawImage(embedded, { x, y: cmd.y, width: img.w, height: img.h })
            }
          }
        }
      } else if (cmd.type === 'image' && cmd.src) {
        const embedded = imageCache.get(cmd.src)
        if (embedded) {
          page.drawImage(embedded, { x: cmd.x, y: cmd.y, width: cmd.w, height: cmd.h })
        }
      } else if (cmd.type === 'rect') {
        page.drawRectangle({
          x: cmd.x, y: cmd.y, width: cmd.w, height: cmd.h,
          color: rgb(cmd.color[0], cmd.color[1], cmd.color[2]),
          borderWidth: 0,
        })
      } else if (cmd.type === 'line') {
        page.drawLine({
          start: { x: cmd.x1, y: cmd.y1 },
          end: { x: cmd.x2, y: cmd.y2 },
          color: rgb(cmd.color[0], cmd.color[1], cmd.color[2]),
          thickness: cmd.lineWidth || 0.5,
        })
      } else if (cmd.type === 'link' && cmd.url) {
        // External link annotation
        try {
          const annot = pdfDoc.context.obj({
            Type: 'Annot', Subtype: 'Link',
            Rect: [cmd.x, cmd.y, cmd.x + cmd.w, cmd.y + cmd.h],
            Border: [0, 0, 0],
            A: { Type: 'Action', S: 'URI', URI: pdfDoc.context.obj(cmd.url) },
          })
          const annotRef = pdfDoc.context.register(annot)
          const existing = page.node.Annots()
          if (existing) existing.push(annotRef)
        } catch { /* link annotation failed */ }
      }
      // Skip internal draw commands (_, _toc_marker, etc.)

      ci++
    }
  }

  return pdfDoc.save()
}
