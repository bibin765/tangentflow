// TangentFlow — App Entry Point
// Core engine imported from @upbrew/tangentflow (single source of truth)
import { PAGE_SIZES, hexToRgbArr, processBlocks } from '@upbrew/tangentflow'
import { TEMPLATES } from './config/templates.js'
import { renderPreview } from './renderers/canvas.js'
import { generatePDF as renderPDF } from './renderers/pdf.js'
import { buildBlockList } from './ui/block-list.js'
import { headerFooter, initHeaderFooter } from './ui/header-footer.js'

// ─── State ───────────────────────────────────────────────────────────
let blocks = []
let selectedBlockIndex = -1
let dragSrcIndex = null

// ─── DOM ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id)
const blockListEl = $('block-list')
const previewScrollEl = $('preview-scroll')
const statsEl = $('stats')

// ─── Settings readers ────────────────────────────────────────────────
function getStyleColors() {
  return {
    heading: hexToRgbArr($('style-heading').value),
    body: hexToRgbArr($('style-body').value),
    accent: hexToRgbArr($('style-accent').value),
    tableHeader: hexToRgbArr($('style-table-header').value),
    tableStripe: hexToRgbArr($('style-table-stripe').value),
    divider: hexToRgbArr($('style-divider').value),
    quoteBar: hexToRgbArr($('style-quote-bar').value),
    statBg: hexToRgbArr($('style-stat-bg').value),
    muted: hexToRgbArr($('style-muted').value),
  }
}

function getPageDims() {
  const base = PAGE_SIZES[$('page-size').value]
  const landscape = $('page-orientation').value === 'landscape'
  return landscape ? { w: base.h, h: base.w } : { w: base.w, h: base.h }
}

function getWatermark() {
  const text = $('wm-text').value.trim()
  if (!text) return null
  return { text, color: hexToRgbArr($('wm-color').value), opacity: parseInt($('wm-opacity').value) / 100 }
}

function getMetadata() {
  return {
    title: $('meta-title').value.trim(),
    author: $('meta-author').value.trim(),
    subject: $('meta-subject').value.trim(),
  }
}

// ─── Core: generate preview ──────────────────────────────────────────
function generatePreview() {
  const pageSize = getPageDims()
  const margin = parseInt($('page-margin').value)
  const colors = getStyleColors()
  const wm = getWatermark()

  const t0 = performance.now()
  const flow = processBlocks(blocks, pageSize.w, pageSize.h, margin, colors, headerFooter)
  const layoutMs = (performance.now() - t0).toFixed(1)

  renderPreview(flow.pages, pageSize, wm, previewScrollEl, statsEl, layoutMs)
}

// ─── Block list callbacks ────────────────────────────────────────────
function rebuildList() {
  buildBlockList(
    { blocks, selectedBlockIndex, dragSrcIndex },
    blockListEl,
    listCallbacks
  )
}

const listCallbacks = {
  setSelectedIndex(i) { selectedBlockIndex = i },
  setDragSrcIndex(i) { dragSrcIndex = i },
  generatePreview,
  rebuildList,
}

// ─── Template loading ────────────────────────────────────────────────
function loadTemplate(name) {
  blocks = JSON.parse(JSON.stringify(TEMPLATES[name]))
  selectedBlockIndex = -1
  rebuildList()
  generatePreview()
}

// ─── Event listeners ─────────────────────────────────────────────────
// Template buttons
$('tpl-report').addEventListener('click', () => loadTemplate('report'))
$('tpl-invoice').addEventListener('click', () => loadTemplate('invoice'))
$('tpl-catalog').addEventListener('click', () => loadTemplate('catalog'))
$('tpl-resume').addEventListener('click', () => loadTemplate('resume'))
$('tpl-proposal').addEventListener('click', () => loadTemplate('proposal'))
$('tpl-meeting').addEventListener('click', () => loadTemplate('meeting'))
$('tpl-receipt').addEventListener('click', () => loadTemplate('receipt'))
$('tpl-nda').addEventListener('click', () => loadTemplate('nda'))
$('tpl-multilang').addEventListener('click', () => loadTemplate('multilang'))

// Add block buttons
document.querySelectorAll('.add-block-bar button').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type
    let block
    switch (type) {
      case 'image': block = { type: 'image', src: '', width: 200, align: 'left', wrap: 'none', _img: null }; break
      case 'heading': block = { type: 'heading', text: 'New Heading', level: 1 }; break
      case 'paragraph': block = { type: 'paragraph', text: 'Enter your text here...' }; break
      case 'bullet-list': block = { type: 'bullet-list', items: 'First item\nSecond item\nThird item' }; break
      case 'numbered-list': block = { type: 'numbered-list', items: 'First step\nSecond step\nThird step' }; break
      case 'quote': block = { type: 'quote', text: 'Enter a quote or callout text here...', attribution: '' }; break
      case 'table': block = { type: 'table', headers: 'Name, Description, Status', rows: 'Item One, A short description of the first item, Active\nItem Two, This item has a longer description that should wrap nicely within the cell boundaries, Pending' }; break
      case 'key-value': block = { type: 'key-value', items: 'Client: Acme Corp\nProject: Website Redesign\nDeadline: April 30 2026\nStatus: In Progress' }; break
      case 'two-column': block = { type: 'two-column', left: 'Left column content goes here. It will wrap independently.', right: 'Right column content goes here. Each column is measured separately.' }; break
      case 'stat-row': block = { type: 'stat-row', items: 'Label: Value, Label: Value' }; break
      case 'divider': block = { type: 'divider' }; break
      case 'spacer': block = { type: 'spacer', height: 20 }; break
      case 'page-break': block = { type: 'page-break' }; break
    }
    if (block) {
      blocks.push(block)
      selectedBlockIndex = blocks.length - 1
      rebuildList()
      generatePreview()
    }
  })
})

// Preview + Download
$('btn-preview').addEventListener('click', generatePreview)
$('btn-download').addEventListener('click', async () => {
  const pageSize = getPageDims()
  const margin = parseInt($('page-margin').value)
  const colors = getStyleColors()
  const wm = getWatermark()
  const meta = getMetadata()

  const flow = processBlocks(blocks, pageSize.w, pageSize.h, margin, colors, headerFooter)
  await renderPDF(flow.pages, pageSize, wm, meta)
})

// Page settings
$('page-size').addEventListener('change', generatePreview)
$('page-orientation').addEventListener('change', generatePreview)
$('page-margin').addEventListener('change', generatePreview)

// Watermark
$('wm-text').addEventListener('input', generatePreview)
$('wm-color').addEventListener('input', generatePreview)
$('wm-opacity').addEventListener('input', e => {
  $('wm-opacity-val').textContent = e.target.value + '%'
  generatePreview()
})

// Style color inputs
;['style-heading','style-body','style-accent','style-table-header','style-table-stripe','style-divider','style-quote-bar','style-stat-bg','style-muted'].forEach(id => {
  $(id).addEventListener('input', generatePreview)
})

// Header/footer
initHeaderFooter($, generatePreview)

// ─── Init ────────────────────────────────────────────────────────────
loadTemplate('report')
