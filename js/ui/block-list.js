// ─── Block List ─────────────────────────────────────────────────────
// Renders the sortable, draggable block list in the sidebar.

import { BLOCK_ICONS } from '../config/block-icons.js'
import { buildInlineEditor, escHtml } from './editors.js'

/**
 * Build (or rebuild) the block list UI.
 *
 * @param {{ blocks: object[], selectedBlockIndex: number, dragSrcIndex: number|null }} state
 *   Mutable state object — blocks array is mutated in place for splice operations.
 * @param {HTMLElement} blockListEl — the container element
 * @param {{
 *   setSelectedIndex: (i: number) => void,
 *   setDragSrcIndex: (i: number|null) => void,
 *   generatePreview: () => void,
 *   rebuildList: () => void
 * }} callbacks
 */
export function buildBlockList(state, blockListEl, callbacks) {
  const { blocks, selectedBlockIndex } = state

  blockListEl.innerHTML = ''
  blocks.forEach((b, i) => {
    const el = document.createElement('div')
    el.className = 'block-item' + (i === selectedBlockIndex ? ' active' : '')
    el.draggable = true
    el.dataset.index = i

    let preview = ''
    if (b.type === 'image') preview = b.src ? `Image (${b.width}px${b.wrap !== 'none' ? ', wrap ' + b.wrap : ''})` : 'No image uploaded'
    else if (b.type === 'heading') preview = b.text
    else if (b.type === 'paragraph') preview = b.text.slice(0, 50) + (b.text.length > 50 ? '...' : '')
    else if (b.type === 'bullet-list' || b.type === 'numbered-list') {
      const count = b.items.split('\n').filter(s => s.trim()).length
      preview = `${count} item${count !== 1 ? 's' : ''}`
    }
    else if (b.type === 'quote') preview = b.text.slice(0, 50) + (b.text.length > 50 ? '...' : '')
    else if (b.type === 'table') {
      const cols = b.headers.split(',').length
      const rows = b.rows.split('\n').filter(r => r.trim()).length
      preview = `${cols} cols \u00d7 ${rows} rows`
    }
    else if (b.type === 'key-value') {
      const count = b.items.split('\n').filter(s => s.trim()).length
      preview = `${count} field${count !== 1 ? 's' : ''}`
    }
    else if (b.type === 'two-column') preview = 'Two-column layout'
    else if (b.type === 'spacer') preview = `${b.height}px spacing`
    else if (b.type === 'divider') preview = 'Horizontal line'
    else if (b.type === 'page-break') preview = 'Force new page'
    else if (b.type === 'stat-row') {
      const count = b.items.split(',').filter(s => s.trim()).length
      preview = `${count} metric${count !== 1 ? 's' : ''}`
    }

    el.innerHTML = `
      <div class="block-item-header">
        <span class="block-drag-handle" title="Drag to reorder">\u2807</span>
        <span class="block-icon ${b.type}">${BLOCK_ICONS[b.type]}</span>
        <div class="block-info">
          <div class="block-type">${b.type}${b.type === 'heading' ? ' ' + b.level : ''}</div>
          <div class="block-preview">${escHtml(preview)}</div>
        </div>
        <div class="block-actions">
          <button class="btn-move-up" title="Move up">\u2191</button>
          <button class="btn-move-down" title="Move down">\u2193</button>
          <button class="btn-duplicate" title="Duplicate">\u29C9</button>
          <button class="btn-remove-block" title="Delete">\u2715</button>
        </div>
      </div>
      <div class="block-inline-editor" id="inline-editor-${i}"></div>
    `

    // Click to select / toggle
    el.querySelector('.block-item-header').addEventListener('click', (e) => {
      if (e.target.closest('.block-actions')) return
      callbacks.setSelectedIndex(selectedBlockIndex === i ? -1 : i)
      callbacks.rebuildList()
    })

    // Action buttons
    el.querySelector('.btn-move-up').addEventListener('click', (e) => {
      e.stopPropagation()
      if (i > 0) {
        [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]]
        callbacks.setSelectedIndex(i - 1)
        callbacks.rebuildList()
        callbacks.generatePreview()
      }
    })
    el.querySelector('.btn-move-down').addEventListener('click', (e) => {
      e.stopPropagation()
      if (i < blocks.length - 1) {
        [blocks[i], blocks[i + 1]] = [blocks[i + 1], blocks[i]]
        callbacks.setSelectedIndex(i + 1)
        callbacks.rebuildList()
        callbacks.generatePreview()
      }
    })
    el.querySelector('.btn-duplicate').addEventListener('click', (e) => {
      e.stopPropagation()
      blocks.splice(i + 1, 0, JSON.parse(JSON.stringify(b)))
      callbacks.setSelectedIndex(i + 1)
      callbacks.rebuildList()
      callbacks.generatePreview()
    })
    el.querySelector('.btn-remove-block').addEventListener('click', (e) => {
      e.stopPropagation()
      blocks.splice(i, 1)
      if (selectedBlockIndex === i) callbacks.setSelectedIndex(-1)
      else if (selectedBlockIndex > i) callbacks.setSelectedIndex(selectedBlockIndex - 1)
      callbacks.rebuildList()
      callbacks.generatePreview()
    })

    // Drag events
    el.addEventListener('dragstart', (e) => {
      callbacks.setDragSrcIndex(i)
      el.classList.add('dragging')
      e.dataTransfer.effectAllowed = 'move'
    })
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging')
      callbacks.setDragSrcIndex(null)
      document.querySelectorAll('.block-item').forEach(item => item.classList.remove('drag-over'))
    })
    el.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      el.classList.add('drag-over')
    })
    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-over')
    })
    el.addEventListener('drop', (e) => {
      e.preventDefault()
      el.classList.remove('drag-over')
      if (state.dragSrcIndex !== null && state.dragSrcIndex !== i) {
        const moved = blocks.splice(state.dragSrcIndex, 1)[0]
        blocks.splice(i, 0, moved)
        callbacks.setSelectedIndex(i)
        callbacks.rebuildList()
        callbacks.generatePreview()
      }
    })

    blockListEl.appendChild(el)

    // Build inline editor if active
    if (i === selectedBlockIndex) {
      const editorContainer = document.getElementById(`inline-editor-${i}`)
      buildInlineEditor(b, i, editorContainer, {
        generatePreview: callbacks.generatePreview,
        rebuild: callbacks.rebuildList,
      })
    }
  })
}
