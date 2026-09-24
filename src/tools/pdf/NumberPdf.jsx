import { useEffect, useRef, useState } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { Dropzone, Segmented } from '../../components/ui.jsx'
import { baseName, downloadBlob, formatBytes } from '../../lib/files.js'
import { loadPdfLib, openPdfjs, pdfBlob, readBytes, renderPage } from '../../lib/pdf.js'
import { toast } from '../../lib/toast.js'

const POSITIONS = [
  { value: 'tl', label: '↖' }, { value: 'tc', label: '↑' }, { value: 'tr', label: '↗' },
  { value: 'bl', label: '↙' }, { value: 'bc', label: '↓' }, { value: 'br', label: '↘' },
]
const FORMATS = {
  n: { label: '1', fn: (n) => `${n}` },
  page: { label: 'Page 1', fn: (n) => `Page ${n}` },
  of: { label: 'Page 1 of 9', fn: (n, t) => `Page ${n} of ${t}` },
  slash: { label: '1 / 9', fn: (n, t) => `${n} / ${t}` },
  dash: { label: '– 1 –', fn: (n) => `– ${n} –` },
}

function hexToRgb(hex, rgb) {
  const n = parseInt(hex.slice(1), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

async function apply(bytes, o, onlyFirst = false) {
  const { PDFDocument, StandardFonts, degrees, rgb } = await loadPdfLib()
  let doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  if (onlyFirst && doc.getPageCount() > 1) {
    const one = await PDFDocument.create()
    const [p] = await one.copyPages(doc, [0])
    one.addPage(p)
    doc = one
  }
  const font = await doc.embedFont(o.bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica)
  const pages = doc.getPages()
  const total = o.totalOverride || pages.length
  pages.forEach((page, idx) => {
    const { width, height } = page.getSize()
    if (o.numbers && !(o.skipFirst && idx === 0)) {
      const n = idx + Number(o.start) - (o.skipFirst ? 1 : 0)
      const text = FORMATS[o.format].fn(n, total - (o.skipFirst ? 1 : 0) + Number(o.start) - 1)
      const size = Number(o.size)
      const tw = font.widthOfTextAtSize(text, size)
      const m = Number(o.margin)
      const x = o.pos[1] === 'l' ? m : o.pos[1] === 'r' ? width - m - tw : (width - tw) / 2
      const y = o.pos[0] === 't' ? height - m - size : m
      page.drawText(text, { x, y, size, font, color: hexToRgb(o.color, rgb) })
    }
    if (o.watermark && o.wmText.trim()) {
      const size = Math.min(width, height) * (Number(o.wmSize) / 100)
      const tw = font.widthOfTextAtSize(o.wmText, size)
      const angle = o.wmDiagonal ? Math.atan2(height, width) : 0
      const cx = width / 2
      const cy = height / 2
      const x = cx - (Math.cos(angle) * tw) / 2 + (Math.sin(angle) * size) / 3
      const y = cy - (Math.sin(angle) * tw) / 2 - (Math.cos(angle) * size) / 3
      page.drawText(o.wmText, { x, y, size, font, color: hexToRgb(o.wmColor, rgb), opacity: Number(o.wmOpacity), rotate: degrees((angle * 180) / Math.PI) })
    }
  })
  return doc.save()
}

export default function NumberPdf() {
  const [file, setFile] = useState(null)
  const [bytes, setBytes] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [o, setO] = useState({
    numbers: true, format: 'of', pos: 'bc', start: 1, skipFirst: false, size: 11, margin: 28, color: '#333333', bold: false,
    watermark: false, wmText: 'DRAFT', wmSize: 18, wmOpacity: 0.15, wmColor: '#d6402b', wmDiagonal: true,
  })
  const set = (k, v) => setO((x) => ({ ...x, [k]: v }))
  const token = useRef(0)

  const open = async ([f]) => {
    try {
      const b = await readBytes(f)
      const d = await openPdfjs(b)
      setFile(f); setBytes(b); setPageCount(d.numPages)
    } catch {
      toast('This PDF could not be opened.', 'error')
    }
  }

  useEffect(() => {
    if (!bytes) return
    const my = ++token.current
    const t = setTimeout(async () => {
      try {
        const out = await apply(bytes, { ...o, totalOverride: pageCount }, true)
        const doc = await openPdfjs(out)
        const page = await doc.getPage(1)
        const canvas = await renderPage(page, 520 / page.getViewport({ scale: 1 }).width)
        if (my === token.current) setPreview(canvas.toDataURL('image/png'))
      } catch (e) { console.error(e) }
    }, 250)
    return () => clearTimeout(t)
  }, [bytes, o, pageCount])

  const run = async () => {
    setBusy(true)
    try {
      downloadBlob(pdfBlob(await apply(bytes, o)), `${baseName(file.name)}-${o.numbers ? 'numbered' : 'stamped'}.pdf`)
    } catch (e) {
      console.error(e)
      toast('Something went wrong. The PDF may be encrypted.', 'error')
    } finally { setBusy(false) }
  }

  if (!file) return <Dropzone accept="application/pdf,.pdf" onFiles={open} hint="Add page numbers to your thesis or report, or stamp DRAFT or CONFIDENTIAL across every page." />

  return (
    <div className="split" style={{ alignItems: 'start' }}>
      <div className="stack">
        <div className="panel row" style={{ justifyContent: 'space-between' }}>
          <span className="status"><b>{file.name}</b> · {pageCount} pages · {formatBytes(file.size)}</span>
          <button className="btn sm" onClick={() => { setFile(null); setBytes(null); setPreview('') }}><RotateCcw size={14} /> Change</button>
        </div>

        <div className="panel stack">
          <label className="checkbox" style={{ fontWeight: 700 }}><input type="checkbox" checked={o.numbers} onChange={(e) => set('numbers', e.target.checked)} /> Page numbers</label>
          {o.numbers && (
            <>
              <div className="field"><label>Format</label>
                <Segmented value={o.format} onChange={(v) => set('format', v)} options={Object.entries(FORMATS).map(([value, f]) => ({ value, label: f.label }))} />
              </div>
              <div className="row" style={{ alignItems: 'flex-end', gap: 20 }}>
                <div className="field"><label>Position</label>
                  <div className="pos-grid">
                    {POSITIONS.map((p) => <button key={p.value} className={o.pos === p.value ? 'on' : ''} onClick={() => set('pos', p.value)} aria-label={`Position ${p.value}`}>{p.label}</button>)}
                  </div>
                </div>
                <div className="field"><label>Start at</label><input className="input mono" style={{ width: 80 }} type="number" min="0" value={o.start} onChange={(e) => set('start', e.target.value)} /></div>
                <div className="field"><label>Size</label><input className="input mono" style={{ width: 80 }} type="number" min="6" max="48" value={o.size} onChange={(e) => set('size', e.target.value)} /></div>
                <div className="field"><label>Color</label><input type="color" value={o.color} onChange={(e) => set('color', e.target.value)} /></div>
              </div>
              <div className="row" style={{ gap: 20 }}>
                <label className="checkbox"><input type="checkbox" checked={o.skipFirst} onChange={(e) => set('skipFirst', e.target.checked)} /> Skip the cover page</label>
                <label className="checkbox"><input type="checkbox" checked={o.bold} onChange={(e) => set('bold', e.target.checked)} /> Bold</label>
              </div>
            </>
          )}
        </div>

        <div className="panel stack">
          <label className="checkbox" style={{ fontWeight: 700 }}><input type="checkbox" checked={o.watermark} onChange={(e) => set('watermark', e.target.checked)} /> Watermark</label>
          {o.watermark && (
            <>
              <div className="row">
                <input className="input" style={{ flex: 1 }} value={o.wmText} onChange={(e) => set('wmText', e.target.value)} />
                {['DRAFT', 'CONFIDENTIAL', 'SAMPLE', 'COPY'].map((w) => <button key={w} className="chip" onClick={() => set('wmText', w)}>{w}</button>)}
              </div>
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: 1 }}><label>Size</label><input className="range" type="range" min="6" max="30" value={o.wmSize} onChange={(e) => set('wmSize', e.target.value)} /></div>
                <div className="field" style={{ flex: 1 }}><label>Opacity</label><input className="range" type="range" min="0.05" max="0.6" step="0.05" value={o.wmOpacity} onChange={(e) => set('wmOpacity', e.target.value)} /></div>
                <div className="field"><label>Color</label><input type="color" value={o.wmColor} onChange={(e) => set('wmColor', e.target.value)} /></div>
              </div>
              <label className="checkbox"><input type="checkbox" checked={o.wmDiagonal} onChange={(e) => set('wmDiagonal', e.target.checked)} /> Diagonal</label>
            </>
          )}
        </div>
        <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={run} disabled={busy || (!o.numbers && !o.watermark)}>
          {busy ? <span className="spinner" /> : <Download size={16} />} Apply to all {pageCount} pages
        </button>
      </div>

      <div className="stack" style={{ position: 'sticky', top: 84 }}>
        <span className="label">Preview · page 1</span>
        <div className="preview" style={{ padding: 16 }}>
          {preview ? <img src={preview} alt="Preview" style={{ boxShadow: 'var(--hard)', border: '1.5px solid var(--ink)' }} /> : <span className="spinner" />}
        </div>
        {o.skipFirst && o.numbers && <span className="caption">The cover page stays unnumbered. Numbering starts on page 2.</span>}
      </div>
    </div>
  )
}
