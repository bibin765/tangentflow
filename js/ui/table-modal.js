// ─── Table Editor & Modal ───────────────────────────────────────────
// Compact inline table editor and full popup modal for table blocks.

// Local copy of escAttr to avoid circular dependency with editors.js
function escAttr(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') }

/**
 * Build the compact inline table editor.
 * @param {HTMLElement} container
 * @param {object} block
 * @param {{ generatePreview: Function }} callbacks
 */
export function buildTableEditor(container, block, callbacks) {
  const headers = block.headers.split(',').map(h => h.trim())
  const rows = block.rows.split('\n').filter(r => r.trim()).map(r => r.split(',').map(c => c.trim()))

  function sync() {
    block.headers = headers.join(', ')
    block.rows = rows.map(r => r.join(', ')).join('\n')
    const info = `${headers.length} cols \u00d7 ${rows.length} rows`
    const preview = container.closest('.block-item')?.querySelector('.block-preview')
    if (preview) preview.textContent = info
    callbacks.generatePreview()
  }

  function rebuild() { buildTableEditor(container, block, callbacks) }

  // Compact inline preview
  let html = '<div class="table-editor"><table>'
  html += '<tr>'
  headers.forEach((h, ci) => {
    html += `<th><input type="text" value="${escAttr(h)}" data-type="header" data-col="${ci}" /></th>`
  })
  html += '</tr>'
  rows.slice(0, 3).forEach((row, ri) => {
    html += '<tr>'
    headers.forEach((_, ci) => {
      const val = row[ci] || ''
      html += `<td><input type="text" value="${escAttr(val)}" data-type="cell" data-row="${ri}" data-col="${ci}" /></td>`
    })
    html += '</tr>'
  })
  if (rows.length > 3) {
    html += `<tr><td colspan="${headers.length}" style="text-align:center;padding:4px;color:var(--color-text-muted);font-size:10px;">... ${rows.length - 3} more row${rows.length - 3 > 1 ? 's' : ''}</td></tr>`
  }
  html += '</table>'
  html += '<div class="table-actions">'
  html += '<button class="btn-expand-table" data-act="expand">Expand Editor</button>'
  html += '<button data-act="add-row">+ Row</button>'
  html += '<button data-act="add-col">+ Column</button>'
  html += '</div></div>'

  container.innerHTML = html

  // Inline input events (first 3 rows)
  container.querySelectorAll('input[data-type="header"]').forEach(inp => {
    inp.addEventListener('input', () => { headers[parseInt(inp.dataset.col)] = inp.value; sync() })
  })
  container.querySelectorAll('input[data-type="cell"]').forEach(inp => {
    inp.addEventListener('input', () => {
      const ri = parseInt(inp.dataset.row), ci = parseInt(inp.dataset.col)
      while (rows[ri].length <= ci) rows[ri].push('')
      rows[ri][ci] = inp.value
      sync()
    })
  })

  container.querySelector('[data-act="add-row"]')?.addEventListener('click', () => {
    rows.push(headers.map(() => '')); sync(); rebuild()
  })
  container.querySelector('[data-act="add-col"]')?.addEventListener('click', () => {
    headers.push('New'); rows.forEach(r => r.push('')); sync(); rebuild()
  })

  // Expand button -> open modal
  container.querySelector('[data-act="expand"]')?.addEventListener('click', () => {
    openTableModal(headers, rows, sync, rebuild)
  })
}

/**
 * Open a full-page table-editing modal.
 * @param {string[]} headers  — mutable array of column headers
 * @param {string[][]} rows   — mutable array of row arrays
 * @param {Function} sync     — called after every edit to persist back to the block
 * @param {Function} rebuildInline — called when the modal closes to refresh the inline editor
 */
export function openTableModal(headers, rows, sync, rebuildInline) {
  // Remove existing modal if any
  document.querySelector('.table-modal-overlay')?.remove()

  const overlay = document.createElement('div')
  overlay.className = 'table-modal-overlay'

  function close() {
    overlay.remove()
    rebuildInline()
  }

  function renderModal() {
    let html = `
      <div class="table-modal">
        <div class="table-modal-header">
          <h3>Table Editor</h3>
          <button class="modal-close" title="Close">\u2715</button>
        </div>
        <div class="table-modal-body">
          <div style="position:relative;padding-right:32px;">
            <table>
              <thead><tr><th style="width:36px;">#</th>`

    headers.forEach((h, ci) => {
      html += `<th><input type="text" value="${escAttr(h)}" data-type="header" data-col="${ci}" placeholder="Column ${ci + 1}" /></th>`
    })
    html += '</tr></thead><tbody>'

    rows.forEach((row, ri) => {
      html += `<tr><td class="row-num">${ri + 1}</td>`
      headers.forEach((_, ci) => {
        const val = row[ci] || ''
        const isLast = ci === headers.length - 1
        html += `<td><input type="text" value="${escAttr(val)}" data-type="cell" data-row="${ri}" data-col="${ci}" placeholder="\u2014" />`
        if (isLast && rows.length > 1) {
          html += `<button class="row-delete" data-del-row="${ri}" title="Delete row">\u2715</button>`
        }
        html += '</td>'
      })
      html += '</tr>'
    })

    html += `</tbody></table>
          </div>
        </div>
        <div class="table-modal-footer">
          <span class="modal-info">${headers.length} columns \u00d7 ${rows.length} rows \u2022 Tab to navigate \u2022 Enter to add row</span>
          <div class="modal-actions">
            <button class="btn-expand-table" data-act="add-row">+ Row</button>
            <button class="btn-expand-table" data-act="add-col">+ Column</button>
            ${headers.length > 1 ? '<button class="btn-expand-table" data-act="del-col">- Column</button>' : ''}
            <button class="btn-generate" style="padding:6px 20px;font-size:13px;width:auto;" data-act="done">Done</button>
          </div>
        </div>
      </div>`

    overlay.innerHTML = html

    // Events
    overlay.querySelector('.modal-close').addEventListener('click', close)
    overlay.querySelector('[data-act="done"]').addEventListener('click', close)

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close()
    })

    // Header inputs
    overlay.querySelectorAll('input[data-type="header"]').forEach(inp => {
      inp.addEventListener('input', () => {
        headers[parseInt(inp.dataset.col)] = inp.value
        sync()
      })
    })

    // Cell inputs
    overlay.querySelectorAll('input[data-type="cell"]').forEach(inp => {
      inp.addEventListener('input', () => {
        const ri = parseInt(inp.dataset.row), ci = parseInt(inp.dataset.col)
        while (rows[ri].length <= ci) rows[ri].push('')
        rows[ri][ci] = inp.value
        sync()
      })

      // Tab from last cell in row = next row; Enter = add row at end
      inp.addEventListener('keydown', (e) => {
        const ri = parseInt(inp.dataset.row), ci = parseInt(inp.dataset.col)
        if (e.key === 'Enter') {
          e.preventDefault()
          if (ri === rows.length - 1) {
            rows.push(headers.map(() => ''))
            sync()
            renderModal()
            // Focus first cell of new row
            setTimeout(() => {
              const newInput = overlay.querySelector(`input[data-row="${rows.length - 1}"][data-col="0"]`)
              newInput?.focus()
            }, 20)
          } else {
            // Move to same column next row
            const next = overlay.querySelector(`input[data-row="${ri + 1}"][data-col="${ci}"]`)
            next?.focus()
          }
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          overlay.querySelector(`input[data-row="${ri + 1}"][data-col="${ci}"]`)?.focus()
        }
        if (e.key === 'ArrowUp' && ri > 0) {
          e.preventDefault()
          overlay.querySelector(`input[data-row="${ri - 1}"][data-col="${ci}"]`)?.focus()
        }
      })
    })

    // Row delete buttons
    overlay.querySelectorAll('.row-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const ri = parseInt(btn.dataset.delRow)
        rows.splice(ri, 1)
        sync()
        renderModal()
      })
    })

    // Action buttons
    overlay.querySelector('[data-act="add-row"]')?.addEventListener('click', () => {
      rows.push(headers.map(() => ''))
      sync()
      renderModal()
      setTimeout(() => {
        const newInput = overlay.querySelector(`input[data-row="${rows.length - 1}"][data-col="0"]`)
        newInput?.focus()
      }, 20)
    })
    overlay.querySelector('[data-act="add-col"]')?.addEventListener('click', () => {
      headers.push('New')
      rows.forEach(r => r.push(''))
      sync()
      renderModal()
    })
    overlay.querySelector('[data-act="del-col"]')?.addEventListener('click', () => {
      if (headers.length > 1) {
        headers.pop()
        rows.forEach(r => r.pop())
        sync()
        renderModal()
      }
    })

    // Escape to close
    function onEsc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc) }
    }
    document.addEventListener('keydown', onEsc)
  }

  renderModal()
  document.body.appendChild(overlay)

  // Focus first cell
  setTimeout(() => {
    overlay.querySelector('input[data-type="cell"][data-row="0"][data-col="0"]')?.focus()
  }, 50)
}
