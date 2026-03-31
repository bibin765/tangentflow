// ─── Canvas preview renderer ────────────────────────────────────────

export function renderPreview(pages, pageSize, watermark, container, statsEl, layoutMs) {
  // pages: array of arrays of draw commands
  // pageSize: { w, h }
  // watermark: { text, color, opacity } or null
  // container: DOM element to append canvases to
  // statsEl: DOM element for stats text
  // layoutMs: string of layout time

  const scale = 0.85
  container.innerHTML = ''

  pages.forEach((cmds, pi) => {
    const canvas = document.createElement('canvas')
    canvas.className = 'page-canvas'
    canvas.width = pageSize.w * 2
    canvas.height = pageSize.h * 2
    canvas.style.width = `${pageSize.w * scale}px`
    canvas.style.height = `${pageSize.h * scale}px`

    const ctx = canvas.getContext('2d')
    ctx.scale(2, 2)

    // White page
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, pageSize.w, pageSize.h)

    // Watermark
    if (watermark) {
      ctx.save()
      ctx.translate(pageSize.w / 2, pageSize.h / 2)
      ctx.rotate(-Math.PI / 6)
      ctx.font = `bold ${Math.min(pageSize.w, pageSize.h) * 0.12}px Helvetica, Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = `rgba(${watermark.color.map(c => Math.round(c * 255)).join(',')}, ${watermark.opacity})`
      ctx.fillText(watermark.text, 0, 0)
      ctx.restore()
    }

    // Render commands
    for (const cmd of cmds) {
      if (cmd.type === 'text') {
        const weight = cmd.fontKey === 'bold' ? 'bold ' : cmd.fontKey === 'italic' ? 'italic ' : ''
        ctx.font = `${weight}${cmd.fontSize}px Helvetica, Arial, sans-serif`
        ctx.fillStyle = `rgb(${cmd.color.map(c => Math.round(c * 255)).join(',')})`
        ctx.textBaseline = 'top'
        if (cmd.align === 'center') {
          ctx.textAlign = 'center'
        } else if (cmd.align === 'right') {
          ctx.textAlign = 'right'
        } else {
          ctx.textAlign = 'left'
        }
        // PDF y is bottom-up, canvas is top-down
        const canvasY = pageSize.h - cmd.y - cmd.fontSize
        ctx.fillText(cmd.text, cmd.x, canvasY)
        ctx.textAlign = 'left'
      } else if (cmd.type === 'rect') {
        ctx.fillStyle = `rgb(${cmd.color.map(c => Math.round(c * 255)).join(',')})`
        const canvasY = pageSize.h - cmd.y - cmd.h
        if (cmd.radius) {
          roundRect(ctx, cmd.x, canvasY, cmd.w, cmd.h, cmd.radius)
          ctx.fill()
        } else {
          ctx.fillRect(cmd.x, canvasY, cmd.w, cmd.h)
        }
      } else if (cmd.type === 'image' && cmd.img) {
        const canvasY = pageSize.h - cmd.y - cmd.h
        ctx.drawImage(cmd.img, cmd.x, canvasY, cmd.w, cmd.h)
      } else if (cmd.type === 'line') {
        ctx.strokeStyle = `rgb(${cmd.color.map(c => Math.round(c * 255)).join(',')})`
        ctx.lineWidth = cmd.lineWidth || 0.5
        ctx.beginPath()
        ctx.moveTo(cmd.x1, pageSize.h - cmd.y1)
        ctx.lineTo(cmd.x2, pageSize.h - cmd.y2)
        ctx.stroke()
      }
    }

    container.appendChild(canvas)
  })

  statsEl.textContent = `${pages.length} page${pages.length > 1 ? 's' : ''} — layout: ${layoutMs}ms — powered by Pretext + pdf-lib`
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
