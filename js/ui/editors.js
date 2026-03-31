// ─── UI Editors ─────────────────────────────────────────────────────
// Inline editors for each block type, plus HTML escaping helpers.

import { buildTableEditor } from './table-modal.js'

export function escAttr(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') }

export function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;') }

/**
 * Load an image file into a block's src/img fields.
 * @param {File} file
 * @param {object} block
 * @param {number} index
 * @param {{ rebuild: Function, generatePreview: Function }} callbacks
 */
export function loadBlockImage(file, block, index, callbacks) {
  const reader = new FileReader()
  reader.onload = () => {
    block.src = reader.result
    const img = new Image()
    img.onload = () => {
      block._img = img
      block._naturalW = img.naturalWidth
      block._naturalH = img.naturalHeight
      callbacks.rebuild()
      callbacks.generatePreview()
    }
    img.src = reader.result
  }
  reader.readAsDataURL(file)
}

/**
 * Build the inline editor for any block type.
 * @param {object} block
 * @param {number} index
 * @param {HTMLElement} container  — the inline-editor element
 * @param {{ generatePreview: Function, rebuild: Function }} callbacks
 */
export function buildInlineEditor(block, index, container, callbacks) {
  if (!container) return

  switch (block.type) {
    case 'image':
      container.innerHTML = `
        <div class="image-upload-zone" id="img-zone-${index}">
          ${block.src ? `<img src="${block.src}" /><br>Click to change` : 'Click or drop an image here'}
          <input type="file" accept="image/*" hidden />
        </div>
        <div class="image-controls">
          <div class="inline-field">
            <label>Width (px)</label>
            <input type="number" value="${block.width}" min="20" max="600" data-field="width" />
          </div>
          <div class="inline-field">
            <label>Align</label>
            <select data-field="align">
              <option value="left" ${block.align === 'left' ? 'selected' : ''}>Left</option>
              <option value="center" ${block.align === 'center' ? 'selected' : ''}>Center</option>
              <option value="right" ${block.align === 'right' ? 'selected' : ''}>Right</option>
            </select>
          </div>
          <div class="inline-field">
            <label>Text wrap</label>
            <select data-field="wrap">
              <option value="none" ${block.wrap === 'none' ? 'selected' : ''}>None</option>
              <option value="left" ${block.wrap === 'left' ? 'selected' : ''}>Float left</option>
              <option value="right" ${block.wrap === 'right' ? 'selected' : ''}>Float right</option>
            </select>
          </div>
        </div>
      `
      {
        const zone = container.querySelector(`#img-zone-${index}`)
        const fileInput = zone.querySelector('input[type="file"]')
        zone.addEventListener('click', () => fileInput.click())
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--color-accent)' })
        zone.addEventListener('dragleave', () => { zone.style.borderColor = '' })
        zone.addEventListener('drop', e => {
          e.preventDefault(); zone.style.borderColor = ''
          const file = e.dataTransfer.files[0]
          if (file?.type.startsWith('image/')) loadBlockImage(file, block, index, callbacks)
        })
        fileInput.addEventListener('change', () => {
          if (fileInput.files[0]) loadBlockImage(fileInput.files[0], block, index, callbacks)
        })
        container.querySelector('[data-field="width"]').addEventListener('input', e => {
          block.width = parseInt(e.target.value) || 100
          callbacks.generatePreview()
        })
        container.querySelector('[data-field="align"]').addEventListener('change', e => {
          block.align = e.target.value
          callbacks.generatePreview()
        })
        container.querySelector('[data-field="wrap"]').addEventListener('change', e => {
          block.wrap = e.target.value
          if (block.wrap !== 'none') block.align = block.wrap // sync align with wrap direction
          callbacks.generatePreview()
        })
      }
      break

    case 'heading':
      container.innerHTML = `
        <div class="inline-field"><label>Text</label><input type="text" value="${escAttr(block.text)}" data-field="text" /></div>
        <div class="inline-row">
          <div class="inline-field">
            <label>Level</label>
            <select data-field="level">
              <option value="1" ${block.level === 1 ? 'selected' : ''}>H1 — Title (22px)</option>
              <option value="2" ${block.level === 2 ? 'selected' : ''}>H2 — Section (16px)</option>
              <option value="3" ${block.level === 3 ? 'selected' : ''}>H3 — Subsection (13px)</option>
            </select>
          </div>
        </div>
      `
      container.querySelector('[data-field="text"]').addEventListener('input', (e) => {
        block.text = e.target.value
        container.closest('.block-item').querySelector('.block-preview').textContent = block.text
        callbacks.generatePreview()
      })
      container.querySelector('[data-field="level"]').addEventListener('change', (e) => {
        block.level = parseInt(e.target.value)
        container.closest('.block-item').querySelector('.block-type').textContent = `heading ${block.level}`
        callbacks.generatePreview()
      })
      break

    case 'paragraph':
      container.innerHTML = `
        <div class="inline-field"><label>Content</label><textarea rows="4" data-field="text">${escHtml(block.text)}</textarea></div>
      `
      container.querySelector('[data-field="text"]').addEventListener('input', (e) => {
        block.text = e.target.value
        const short = block.text.slice(0, 50) + (block.text.length > 50 ? '...' : '')
        container.closest('.block-item').querySelector('.block-preview').textContent = short
        callbacks.generatePreview()
      })
      break

    case 'bullet-list':
    case 'numbered-list':
      container.innerHTML = `
        <div class="inline-field"><label>Items (one per line)</label><textarea rows="4" data-field="items">${escHtml(block.items)}</textarea></div>
      `
      container.querySelector('[data-field="items"]').addEventListener('input', (e) => {
        block.items = e.target.value
        const count = block.items.split('\n').filter(s => s.trim()).length
        container.closest('.block-item').querySelector('.block-preview').textContent = `${count} item${count !== 1 ? 's' : ''}`
        callbacks.generatePreview()
      })
      break

    case 'quote':
      container.innerHTML = `
        <div class="inline-field"><label>Quote text</label><textarea rows="3" data-field="text">${escHtml(block.text)}</textarea></div>
        <div class="inline-field" style="margin-top:6px;"><label>Attribution (optional)</label><input type="text" value="${escAttr(block.attribution || '')}" data-field="attribution" /></div>
      `
      container.querySelector('[data-field="text"]').addEventListener('input', (e) => {
        block.text = e.target.value
        const short = block.text.slice(0, 50) + (block.text.length > 50 ? '...' : '')
        container.closest('.block-item').querySelector('.block-preview').textContent = short
        callbacks.generatePreview()
      })
      container.querySelector('[data-field="attribution"]').addEventListener('input', (e) => {
        block.attribution = e.target.value
        callbacks.generatePreview()
      })
      break

    case 'key-value':
      container.innerHTML = `
        <div class="inline-field"><label>Fields (Label: Value, one per line)</label><textarea rows="4" data-field="items">${escHtml(block.items)}</textarea></div>
      `
      container.querySelector('[data-field="items"]').addEventListener('input', (e) => {
        block.items = e.target.value
        const count = block.items.split('\n').filter(s => s.trim()).length
        container.closest('.block-item').querySelector('.block-preview').textContent = `${count} field${count !== 1 ? 's' : ''}`
        callbacks.generatePreview()
      })
      break

    case 'two-column':
      container.innerHTML = `
        <div class="inline-field"><label>Left column</label><textarea rows="3" data-field="left">${escHtml(block.left)}</textarea></div>
        <div class="inline-field" style="margin-top:6px;"><label>Right column</label><textarea rows="3" data-field="right">${escHtml(block.right)}</textarea></div>
      `
      container.querySelector('[data-field="left"]').addEventListener('input', (e) => { block.left = e.target.value; callbacks.generatePreview() })
      container.querySelector('[data-field="right"]').addEventListener('input', (e) => { block.right = e.target.value; callbacks.generatePreview() })
      break

    case 'table':
      buildTableEditor(container, block, callbacks)
      break

    case 'page-break':
      container.innerHTML = '<p style="font-size:11px;color:var(--color-text-muted);padding:2px 0;">Forces content after this block onto a new page.</p>'
      break

    case 'spacer':
      container.innerHTML = `
        <div class="inline-field">
          <label>Height: <span class="spacer-val">${block.height}</span>px</label>
          <input type="range" min="4" max="80" value="${block.height}" data-field="height" />
        </div>
      `
      container.querySelector('[data-field="height"]').addEventListener('input', (e) => {
        block.height = parseInt(e.target.value)
        container.querySelector('.spacer-val').textContent = block.height
        container.closest('.block-item').querySelector('.block-preview').textContent = `${block.height}px spacing`
        callbacks.generatePreview()
      })
      break

    case 'divider':
      container.innerHTML = '<p style="font-size:11px;color:#484f58;padding:2px 0;">Renders as a horizontal line. No options needed.</p>'
      break

    case 'stat-row':
      buildStatEditor(container, block, callbacks)
      break
  }
}

/**
 * Stat row editor — editable label/value pairs.
 * @param {HTMLElement} container
 * @param {object} block
 * @param {{ generatePreview: Function }} callbacks
 */
export function buildStatEditor(container, block, callbacks) {
  const items = block.items.split(',').map(s => s.trim()).filter(Boolean)

  function sync() {
    block.items = items.join(', ')
    const count = items.length
    container.closest('.block-item').querySelector('.block-preview').textContent = `${count} metric${count !== 1 ? 's' : ''}`
    callbacks.generatePreview()
  }

  function rebuild() { buildStatEditor(container, block, callbacks) }

  let html = '<div class="stat-editor">'
  items.forEach((item, i) => {
    const parts = item.split(':')
    const label = parts[0]?.trim() || ''
    const value = parts.slice(1).join(':').trim() || ''
    html += `<div class="stat-card-row">
      <input class="stat-label" type="text" value="${escAttr(label)}" placeholder="Label" data-i="${i}" data-part="label" />
      <input class="stat-value" type="text" value="${escAttr(value)}" placeholder="Value" data-i="${i}" data-part="value" />
      <button class="btn-remove-stat" data-i="${i}">\u2715</button>
    </div>`
  })
  html += '<div class="table-actions"><button data-act="add-stat">+ Add Metric</button></div></div>'

  container.innerHTML = html

  container.querySelectorAll('.stat-label, .stat-value').forEach(inp => {
    inp.addEventListener('input', () => {
      const idx = parseInt(inp.dataset.i)
      const row = container.querySelector(`.stat-card-row:nth-child(${idx + 1})`)
      const l = row.querySelector('.stat-label').value
      const v = row.querySelector('.stat-value').value
      items[idx] = v ? `${l}: ${v}` : l
      sync()
    })
  })

  container.querySelectorAll('.btn-remove-stat').forEach(btn => {
    btn.addEventListener('click', () => {
      items.splice(parseInt(btn.dataset.i), 1)
      sync(); rebuild()
    })
  })

  container.querySelector('[data-act="add-stat"]')?.addEventListener('click', () => {
    items.push('Label: Value')
    sync(); rebuild()
  })
}
