let pdfjsPromise = null

export function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      // Legacy build: works in older browsers (Safari 15+, older Chrome/Firefox).
      import('pdfjs-dist/legacy/build/pdf.min.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })
  }
  return pdfjsPromise
}

export async function openPdfjs(bytes) {
  const pdfjs = await getPdfjs()
  // pdf.js transfers the buffer to its worker, so hand it a copy.
  return pdfjs.getDocument({ data: bytes.slice() }).promise
}

export async function renderPage(page, scale) {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, canvas, viewport }).promise
  return canvas
}

export async function loadPdfLib() {
  return import('pdf-lib')
}

export async function readBytes(file) {
  return new Uint8Array(await file.arrayBuffer())
}

export function pdfBlob(bytes) {
  return new Blob([bytes], { type: 'application/pdf' })
}

/** Parse "1-3, 5, 8-" into sorted unique zero-based page indexes. */
export function parseRanges(text, pageCount) {
  const out = new Set()
  for (const part of text.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d*)\s*-\s*(\d*)$/)
    if (m) {
      const a = m[1] ? parseInt(m[1], 10) : 1
      const b = m[2] ? parseInt(m[2], 10) : pageCount
      if (a < 1 || b < a) throw new Error(`"${part}" is not a valid range.`)
      for (let i = a; i <= Math.min(b, pageCount); i++) out.add(i - 1)
    } else if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10)
      if (n < 1 || n > pageCount) throw new Error(`Page ${n} doesn't exist (this PDF has ${pageCount} pages).`)
      out.add(n - 1)
    } else {
      throw new Error(`Couldn't read "${part}". Use numbers and ranges like 1-3, 5.`)
    }
  }
  return [...out].sort((a, b) => a - b)
}

/** Turn [0,1,2,4] into "1-3, 5". */
export function formatRanges(indexes) {
  const s = [...indexes].sort((a, b) => a - b)
  const parts = []
  for (let i = 0; i < s.length; i++) {
    let j = i
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++
    parts.push(i === j ? `${s[i] + 1}` : `${s[i] + 1}-${s[j] + 1}`)
    i = j
  }
  return parts.join(', ')
}
