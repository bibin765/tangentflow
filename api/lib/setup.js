// Canvas polyfill for Node.js — Pretext needs canvas for text measurement
import { createCanvas } from 'canvas'

globalThis.document = globalThis.document || {
  createElement: (tag) => {
    if (tag === 'canvas') return createCanvas(1, 1)
    return {}
  }
}

globalThis.OffscreenCanvas = globalThis.OffscreenCanvas || class OffscreenCanvas {
  constructor(w, h) { this._canvas = createCanvas(w, h) }
  getContext(type) { return this._canvas.getContext(type) }
}
