import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileDown, Maximize, Package, Trash2, Wand2 } from 'lucide-react'
import { Dropzone, Segmented } from '../../components/ui.jsx'
import { canvasToBlob, downloadBlob, downloadZip, fileToImage, nextId } from '../../lib/files.js'
import { loadPdfLib, pdfBlob } from '../../lib/pdf.js'
import { detectCorners, enhance, warp } from '../../lib/scan.js'
import { toast } from '../../lib/toast.js'

const MODES = [
  { value: 'color', label: 'Color' },
  { value: 'gray', label: 'Grayscale' },
  { value: 'bw', label: 'Black & white' },
  { value: 'original', label: 'Original' },
]

async function process(page) {
  const warped = warp(page.img, page.corners)
  const out = enhance(warped, page.mode, page.strength)
  const blob = await canvasToBlob(out, 'image/jpeg', 0.9)
  return { blob, url: URL.createObjectURL(blob), w: out.width, h: out.height }
}

function CornerEditor({ page, onChange }) {
  const ref = useRef(null)
  const [pts, setPts] = useState(page.corners)
  const drag = useRef(null)
  useEffect(() => setPts(page.corners), [page.corners])
  const W = page.img.naturalWidth
  const H = page.img.naturalHeight

  const toImg = (e) => {
    const r = ref.current.getBoundingClientRect()
    return [Math.min(W, Math.max(0, ((e.clientX - r.left) / r.width) * W)), Math.min(H, Math.max(0, ((e.clientY - r.top) / r.height) * H))]
  }

  return (
    <div className="corner-editor" ref={ref} style={{ aspectRatio: `${W} / ${H}` }}
      onPointerMove={(e) => { if (drag.current == null) return; const p = toImg(e); setPts((q) => q.map((x, i) => (i === drag.current ? p : x))) }}
      onPointerUp={() => { if (drag.current != null) { drag.current = null; onChange(pts) } }}
    >
      <img src={page.src} alt="" draggable={false} />
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <path d={`M0 0H${W}V${H}H0Z M${pts.map((p) => p.join(' ')).join(' L')}Z`} fill="rgba(0,0,0,.45)" fillRule="evenodd" />
        <polygon points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#ffe14a" strokeWidth={Math.max(W, H) / 250} />
      </svg>
      {pts.map((p, i) => (
        <span key={i} className="corner-handle" style={{ left: `${(p[0] / W) * 100}%`, top: `${(p[1] / H) * 100}%` }}
          onPointerDown={(e) => { e.preventDefault(); drag.current = i; ref.current.setPointerCapture(e.pointerId) }} />
      ))}
    </div>
  )
}

export default function ScanCleaner() {
  const [pages, setPages] = useState([])
  const [sel, setSel] = useState(null)
  const [paper, setPaper] = useState('a4')
  const [working, setWorking] = useState(false)
  const pagesRef = useRef(pages)
  useEffect(() => { pagesRef.current = pages }, [pages])
  useEffect(() => () => pagesRef.current.forEach((p) => { URL.revokeObjectURL(p.src); p.out && URL.revokeObjectURL(p.out.url) }), [])

  const run = useCallback(async (id, patch = {}) => {
    const cur = pagesRef.current.find((p) => p.id === id)
    if (!cur) return
    const next = { ...cur, ...patch }
    setPages((ps) => ps.map((p) => (p.id === id ? { ...next, busy: true } : p)))
    await new Promise((r) => setTimeout(r, 20))
    const out = await process(next)
    setPages((ps) => ps.map((p) => {
      if (p.id !== id) return p
      if (p.out) URL.revokeObjectURL(p.out.url)
      return { ...p, ...patch, out, busy: false }
    }))
  }, [])

  const add = async (files) => {
    setWorking(true)
    for (const file of files) {
      const img = await fileToImage(file).catch(() => null)
      if (!img) continue
      const page = { id: nextId(), file, img, src: URL.createObjectURL(file), corners: detectCorners(img), mode: 'color', strength: 1, out: null, busy: true }
      setPages((ps) => [...ps, page])
      setSel((s) => s ?? page.id)
      pagesRef.current = [...pagesRef.current, page]
      await run(page.id)
    }
    setWorking(false)
  }

  const current = pages.find((p) => p.id === sel)
  const setAllMode = (m) => pages.forEach((p) => run(p.id, { mode: m }))

  const exportPdf = async () => {
    const { PDFDocument } = await loadPdfLib()
    const doc = await PDFDocument.create()
    for (const p of pages) {
      if (!p.out) continue
      const jpg = await doc.embedJpg(new Uint8Array(await p.out.blob.arrayBuffer()))
      if (paper === 'fit') {
        const s = 595.28 / p.out.w
        doc.addPage([595.28, p.out.h * s]).drawImage(jpg, { x: 0, y: 0, width: 595.28, height: p.out.h * s })
      } else {
        const [pw, ph] = paper === 'a4' ? [595.28, 841.89] : [612, 792]
        const s = Math.min(pw / p.out.w, ph / p.out.h)
        const w = p.out.w * s
        const h = p.out.h * s
        doc.addPage([pw, ph]).drawImage(jpg, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
      }
    }
    downloadBlob(pdfBlob(await doc.save()), 'scan.pdf')
  }

  if (!pages.length) {
    return (
      <div className="stack">
        <Dropzone accept="image/*" multiple onFiles={add} hint="Phone photos of worksheets, notes or forms. We straighten them, even out the lighting and make the paper white." />
        <p className="caption">For best results, shoot on a dark table with the whole page in frame.</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <Dropzone accept="image/*" multiple onFiles={add} compact title="Add more pages" />

      <div className="scan-strip">
        {pages.map((p, i) => (
          <button key={p.id} className={`scan-thumb ${p.id === sel ? 'on' : ''}`} onClick={() => setSel(p.id)}>
            {p.out ? <img src={p.out.url} alt={`Page ${i + 1}`} /> : <span className="spinner" />}
            <span className="n">{i + 1}</span>
          </button>
        ))}
      </div>

      {current && (
        <div className="split" style={{ alignItems: 'start' }}>
          <div className="stack">
            <span className="label">Adjust corners: drag the yellow dots onto the paper's edges</span>
            <CornerEditor key={current.id} page={current} onChange={(c) => run(current.id, { corners: c })} />
            <div className="row">
              <button className="btn sm" onClick={() => run(current.id, { corners: detectCorners(current.img) })}><Wand2 size={14} /> Auto-detect</button>
              <button className="btn sm" onClick={() => { const W = current.img.naturalWidth, H = current.img.naturalHeight; run(current.id, { corners: [[0, 0], [W, 0], [W, H], [0, H]] }) }}><Maximize size={14} /> Full image</button>
              <button className="btn sm ghost danger" onClick={() => { setPages((ps) => ps.filter((p) => p.id !== current.id)); setSel(pages.find((p) => p.id !== current.id)?.id ?? null) }}><Trash2 size={14} /> Remove page</button>
            </div>
          </div>
          <div className="stack">
            <span className="label">Result</span>
            <div className="preview" style={{ padding: 12, minHeight: 320 }}>
              {current.out && <img src={current.out.url} alt="Cleaned" style={{ opacity: current.busy ? 0.5 : 1, border: '1px solid var(--border)' }} />}
              {current.busy && <span className="spinner" style={{ position: 'absolute' }} />}
            </div>
            <Segmented value={current.mode} onChange={(m) => run(current.id, { mode: m })} options={MODES} />
            {current.mode !== 'original' && (
              <div className="field"><label>Cleanup strength</label>
                <input key={current.id} className="range" type="range" min="0" max="1.5" step="0.1" defaultValue={current.strength} onPointerUp={(e) => run(current.id, { strength: +e.target.value })} onKeyUp={(e) => run(current.id, { strength: +e.target.value })} />
              </div>
            )}
            <div className="row">
              <button className="btn sm ghost" onClick={() => setAllMode(current.mode)}>Use this look for all pages</button>
              <button className="btn sm" onClick={() => current.out && downloadBlob(current.out.blob, `scan-page-${pages.indexOf(current) + 1}.jpg`)}><Download size={14} /> This page</button>
            </div>
          </div>
        </div>
      )}

      <div className="panel row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <span className="label">PDF page size</span>
          <Segmented value={paper} onChange={setPaper} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }, { value: 'fit', label: 'Fit to scan' }]} />
        </div>
        <div className="row">
          {pages.length > 1 && <button className="btn" disabled={working} onClick={() => downloadZip(pages.filter((p) => p.out).map((p, i) => ({ blob: p.out.blob, name: `scan-page-${i + 1}.jpg` })), 'scans.zip')}><Package size={16} /> JPGs (.zip)</button>}
          <button className="btn primary" disabled={working || pages.some((p) => p.busy)} onClick={() => exportPdf().catch(() => toast('Export failed', 'error'))}>
            <FileDown size={16} /> Save {pages.length}-page PDF
          </button>
        </div>
      </div>
    </div>
  )
}
