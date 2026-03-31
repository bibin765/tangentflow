import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

/**
 * Generate a PDF from pre-computed draw commands and trigger a download.
 *
 * @param {Array<Array>} pages   - array of arrays of draw commands (from processBlocks().pages)
 * @param {{ w: number, h: number }} pageSize - page dimensions in points
 * @param {{ text: string, color: number[], opacity: number } | null} watermark
 * @param {{ title?: string, author?: string, subject?: string }} metadata
 */
export async function generatePDF(pages, pageSize, watermark, metadata) {
  const pdfDoc = await PDFDocument.create()

  // PDF metadata
  if (metadata.title) pdfDoc.setTitle(metadata.title)
  if (metadata.author) pdfDoc.setAuthor(metadata.author)
  if (metadata.subject) pdfDoc.setSubject(metadata.subject)
  pdfDoc.setCreator('TangentFlow \u2014 tangentflow.com')
  pdfDoc.setProducer('TangentFlow (Pretext + pdf-lib)')

  // ── Unicode text support ─────────────────────────────
  // Latin text: standard PDF fonts. Non-Latin: rendered as canvas images.

  // Collect all text to detect if non-Latin is present
  let allText = ''
  for (const cmds of pages) {
    for (const cmd of cmds) {
      if (cmd.type === 'text') allText += cmd.text
    }
  }

  // Check if any character is non-Latin (outside WinAnsi range)
  const isLatinOnly = !/[^\x00-\xFF]/.test(allText)

  let fontRegular, fontBold, fontOblique

  fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // Check if text can be encoded with standard fonts
  function canEncode(text, font) {
    try { font.encodeText(text); return true } catch { return false }
  }

  // Render non-Latin text via canvas → PNG → embed in PDF
  // This supports ALL languages the browser can render
  const textImageCache = new Map()
  async function textToImage(text, fontSize, fontKey, color) {
    const key = `${text}|${fontSize}|${fontKey}|${color.join(',')}`
    if (textImageCache.has(key)) return textImageCache.get(key)

    const scale = 3 // render at 3x for sharpness
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

  // Collect and embed all unique images
  const imageCache = new Map()
  for (const cmds of pages) {
    for (const cmd of cmds) {
      if (cmd.type === 'image' && cmd.src && !imageCache.has(cmd.src)) {
        try {
          const response = await fetch(cmd.src)
          const bytes = await response.arrayBuffer()
          const uint8 = new Uint8Array(bytes)
          // Detect PNG vs JPEG
          let embedded
          if (uint8[0] === 0x89 && uint8[1] === 0x50) {
            embedded = await pdfDoc.embedPng(uint8)
          } else {
            embedded = await pdfDoc.embedJpg(uint8)
          }
          imageCache.set(cmd.src, embedded)
        } catch (e) {
          console.warn('Failed to embed image:', e)
        }
      }
    }
  }

  for (const cmds of pages) {
    const page = pdfDoc.addPage([pageSize.w, pageSize.h])

    // PDF watermark
    if (watermark) {
      const wmFontSize = Math.min(pageSize.w, pageSize.h) * 0.12
      const wmX = pageSize.w / 2
      const wmY = pageSize.h / 2
      const wmTextW = fontBold.widthOfTextAtSize(watermark.text, wmFontSize)
      const wmText = canEncode(watermark.text, fontBold) ? watermark.text : watermark.text.replace(/[^\x20-\x7E]/g, '?')
      page.drawText(wmText, {
        x: wmX - wmTextW / 2,
        y: wmY - wmFontSize / 2,
        size: wmFontSize,
        font: fontBold,
        color: rgb(watermark.color[0], watermark.color[1], watermark.color[2]),
        opacity: watermark.opacity,
        rotate: { type: 'degrees', angle: -30 },
      })
    }

    for (const cmd of cmds) {
      if (cmd.type === 'text') {
        const font = cmd.fontKey === 'bold' ? fontBold : cmd.fontKey === 'italic' ? fontOblique : fontRegular

        if (canEncode(cmd.text, font)) {
          // Latin text — draw normally with PDF font
          const options = {
            x: cmd.x,
            y: cmd.y,
            size: cmd.fontSize,
            font,
            color: rgb(cmd.color[0], cmd.color[1], cmd.color[2]),
          }

          if (cmd.align === 'center') {
            const textWidth = font.widthOfTextAtSize(cmd.text, cmd.fontSize)
            options.x = cmd.x - textWidth / 2
          } else if (cmd.align === 'right') {
            const textWidth = font.widthOfTextAtSize(cmd.text, cmd.fontSize)
            options.x = cmd.x - textWidth
          }

          page.drawText(cmd.text, options)
        } else {
          // Non-Latin text — render as high-res image
          const img = await textToImage(cmd.text, cmd.fontSize, cmd.fontKey, cmd.color)
          const embedded = await pdfDoc.embedPng(img.bytes)
          let x = cmd.x
          if (cmd.align === 'center') x = cmd.x - img.w / 2
          else if (cmd.align === 'right') x = cmd.x - img.w
          page.drawImage(embedded, { x, y: cmd.y, width: img.w, height: img.h })
        }
      } else if (cmd.type === 'image') {
        const embedded = imageCache.get(cmd.src)
        if (embedded) {
          page.drawImage(embedded, { x: cmd.x, y: cmd.y, width: cmd.w, height: cmd.h })
        }
      } else if (cmd.type === 'rect') {
        page.drawRectangle({
          x: cmd.x,
          y: cmd.y,
          width: cmd.w,
          height: cmd.h,
          color: rgb(cmd.color[0], cmd.color[1], cmd.color[2]),
          borderWidth: 0,
        })
      } else if (cmd.type === 'link') {
        page.node.set(
          pdfDoc.context.obj('Annots'),
          page.node.lookup(pdfDoc.context.obj('Annots')) || pdfDoc.context.obj([])
        )
        // Use simple link annotation via pdf-lib's lower-level API
        try {
          const annot = pdfDoc.context.obj({
            Type: 'Annot',
            Subtype: 'Link',
            Rect: [cmd.x, cmd.y, cmd.x + cmd.w, cmd.y + cmd.h],
            Border: [0, 0, 0],
            A: { Type: 'Action', S: 'URI', URI: pdfDoc.context.obj(cmd.url) },
          })
          const annotRef = pdfDoc.context.register(annot)
          const annots = page.node.lookup(pdfDoc.context.obj('Annots'))
          if (annots && annots.push) annots.push(annotRef)
        } catch (e) { /* link annotation failed silently */ }
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
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'document.pdf'
  a.click()
  URL.revokeObjectURL(url)
}
