import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Eraser, FileDown, RotateCcw, ZoomIn } from 'lucide-react'
import { Dropzone, Segmented } from '../../components/ui.jsx'
import { baseName, canvasToBlob, downloadBlob, fileToImage } from '../../lib/files.js'
import { loadPdfLib, pdfBlob } from '../../lib/pdf.js'

const DPI = 300
const MM = DPI / 25.4
const PRESETS = {
  '2x2': { label: '2×2 in', w: 50.8, h: 50.8, note: 'School IDs, PH visa, US passport' },
  '1x1': { label: '1×1 in', w: 25.4, h: 25.4, note: 'School forms, requirements' },
  passport: { label: 'Passport 35×45', w: 35, h: 45, note: 'PH passport (DFA), most countries' },
  '1.5x1.5': { label: '1.5×1.5 in', w: 38.1, h: 38.1, note: 'Some school and org IDs' },
}
const SHEETS = {
  '4r': { label: '4R (4×6 in)', w: 101.6, h: 152.4 },
  a4: { label: 'A4', w: 210, h: 297 },
  letter: { label: 'Letter', w: 215.9, h: 279.4 },
}

function layoutSheet(sheet, photo, gap = 3, margin = 5) {
  const cols = Math.floor((sheet.w - margin * 2 + gap) / (photo.w + gap))
  const rows = Math.floor((sheet.h - margin * 2 + gap) / (photo.h + gap))
  const usedW = cols * photo.w + (cols - 1) * gap
  const usedH = rows * photo.h + (rows - 1) * gap
  return { cols, rows, ox: (sheet.w - usedW) / 2, oy: (sheet.h - usedH) / 2, gap }
}

export default function IdPhoto() {
  const [file, setFile] = useState(null)
  const [img, setImg] = useState(null)
  const [presetId, setPresetId] = useState('2x2')
  const [sheetId, setSheetId] = useState('4r')
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const [guides, setGuides] = useState(true)
  const [border, setBorder] = useState(false)
  const frameRef = useRef(null)
  const drag = useRef(null)
  const [frameW, setFrameW] = useState(360)

  const preset = PRESETS[presetId]
  const aspect = preset.w / preset.h
  const frameH = frameW / aspect

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setFrameW(Math.min(420, el.parentElement.clientWidth - 2)))
    ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [img])

  const base = img ? Math.max(frameW / img.naturalWidth, frameH / img.naturalHeight) : 1
  const s = base * zoom
  const clamp = (o) => img ? ({
    x: Math.min(0, Math.max(frameW - img.naturalWidth * s, o.x)),
    y: Math.min(0, Math.max(frameH - img.naturalHeight * s, o.y)),
  }) : o

  useEffect(() => {
    if (!img) return
    setOff({ x: (frameW - img.naturalWidth * base) / 2, y: (frameH - img.naturalHeight * base) / 2 })
    setZoom(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, presetId])

  useEffect(() => { setOff((o) => clamp(o)) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, frameW])

  const zoomAround = (nz, cx = frameW / 2, cy = frameH / 2) => {
    nz = Math.max(1, Math.min(5, nz))
    const ns = base * nz
    setOff(clamp({ x: cx - ((cx - off.x) / s) * ns, y: cy - ((cy - off.y) / s) * ns }))
    setZoom(nz)
  }

  const wheelRef = useRef(null)
  wheelRef.current = (e) => {
    e.preventDefault()
    const r = frameRef.current.getBoundingClientRect()
    zoomAround(zoom * (e.deltaY < 0 ? 1.08 : 0.93), e.clientX - r.left, e.clientY - r.top)
  }
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const h = (e) => wheelRef.current(e)
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [img])

  const open = async ([f]) => { setFile(f); setImg(await fileToImage(f)) }

  const renderPhoto = () => {
    const W = Math.round(preset.w * MM)
    const H = Math.round(preset.h * MM)
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, W, H)
    ctx.imageSmoothingQuality = 'high'
    const k = W / frameW
    ctx.drawImage(img, off.x * k, off.y * k, img.naturalWidth * s * k, img.naturalHeight * s * k)
    if (border) { ctx.strokeStyle = '#fff'; ctx.lineWidth = W * 0.02; ctx.strokeRect(0, 0, W, H) }
    return c
  }

  const renderSheet = () => {
    const sheet = SHEETS[sheetId]
    const L = layoutSheet(sheet, preset)
    const c = document.createElement('canvas')
    c.width = Math.round(sheet.w * MM)
    c.height = Math.round(sheet.h * MM)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    const photo = renderPhoto()
    for (let r = 0; r < L.rows; r++) for (let q = 0; q < L.cols; q++) {
      const x = (L.ox + q * (preset.w + L.gap)) * MM
      const y = (L.oy + r * (preset.h + L.gap)) * MM
      ctx.drawImage(photo, x, y, preset.w * MM, preset.h * MM)
      ctx.strokeStyle = '#c8c8c8'
      ctx.lineWidth = 1
      ctx.strokeRect(x - 0.5, y - 0.5, preset.w * MM + 1, preset.h * MM + 1)
    }
    return { c, count: L.rows * L.cols }
  }

  const dlPhoto = async () => downloadBlob(await canvasToBlob(renderPhoto(), 'image/jpeg', 0.95), `${baseName(file.name)}-${presetId}.jpg`)
  const dlSheet = async () => downloadBlob(await canvasToBlob(renderSheet().c, 'image/jpeg', 0.95), `${baseName(file.name)}-${presetId}-${sheetId}-sheet.jpg`)
  const dlSheetPdf = async () => {
    const { PDFDocument } = await loadPdfLib()
    const sheet = SHEETS[sheetId]
    const doc = await PDFDocument.create()
    const jpg = await doc.embedJpg(new Uint8Array(await (await canvasToBlob(renderSheet().c, 'image/jpeg', 0.95)).arrayBuffer()))
    const pw = (sheet.w / 25.4) * 72
    const ph = (sheet.h / 25.4) * 72
    doc.addPage([pw, ph]).drawImage(jpg, { x: 0, y: 0, width: pw, height: ph })
    downloadBlob(pdfBlob(await doc.save()), `${baseName(file.name)}-${presetId}-${sheetId}-sheet.pdf`)
  }

  if (!img) {
    return (
      <div className="stack">
        <Dropzone accept="image/*" onFiles={open} hint="Use a well-lit photo facing the camera. Need a plain background? Run it through the Background Remover first." />
        <p className="caption">Tip: <Link to="/tools/remove-background" style={{ textDecoration: 'underline' }}>Background Remover</Link> has one-click white, blue and red backgrounds for ID photos.</p>
      </div>
    )
  }

  const L = layoutSheet(SHEETS[sheetId], preset)

  return (
    <div className="split" style={{ alignItems: 'start' }}>
      <div className="stack">
        <div className="panel stack">
          <div className="field"><label>Size</label>
            <Segmented value={presetId} onChange={setPresetId} options={Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label }))} />
            <span className="caption">{preset.note} · exports at {Math.round(preset.w * MM)}×{Math.round(preset.h * MM)} px (300 dpi)</span>
          </div>
        </div>

        <div className="stack" style={{ alignItems: 'center' }}>
          <div
            ref={frameRef}
            className="crop-frame"
            style={{ width: frameW, height: frameH }}
            onPointerDown={(e) => { drag.current = { sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y }; e.currentTarget.setPointerCapture(e.pointerId) }}
            onPointerMove={(e) => { const d = drag.current; if (d) setOff(clamp({ x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy })) }}
            onPointerUp={() => { drag.current = null }}
          >
            <img src={img.src} alt="" draggable={false} style={{ transform: `translate(${off.x}px, ${off.y}px)`, width: img.naturalWidth * s, height: img.naturalHeight * s }} />
            {guides && (
              <svg className="crop-guides" viewBox="0 0 100 100" preserveAspectRatio="none">
                <ellipse cx="50" cy={aspect < 1 ? 42 : 44} rx={aspect < 1 ? 27 : 23} ry={aspect < 1 ? 26 : 28} />
                <line x1="0" y1={aspect < 1 ? 12 : 10} x2="100" y2={aspect < 1 ? 12 : 10} />
                <line x1="0" y1="72" x2="100" y2="72" />
                <line x1="50" y1="0" x2="50" y2="100" strokeDasharray="2 2" />
              </svg>
            )}
          </div>
          <div className="row" style={{ width: frameW, flexWrap: 'nowrap' }}>
            <ZoomIn size={16} />
            <input className="range" type="range" min="1" max="5" step="0.01" value={zoom} onChange={(e) => zoomAround(+e.target.value)} aria-label="Zoom" />
          </div>
          <div className="row">
            <label className="checkbox"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> Face guide</label>
            <label className="checkbox"><input type="checkbox" checked={border} onChange={(e) => setBorder(e.target.checked)} /> Thin white border</label>
          </div>
          <span className="caption" style={{ textAlign: 'center' }}>Drag to position and scroll to zoom. Fit your face inside the oval, with the top of your hair near the top line and your chin near the bottom line.</span>
        </div>
      </div>

      <div className="stack">
        <div className="panel stack">
          <b>Single photo</b>
          <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={dlPhoto}><Download size={16} /> Download {preset.label} JPG</button>
        </div>
        <div className="panel stack">
          <b>Print sheet</b>
          <Segmented value={sheetId} onChange={setSheetId} options={Object.entries(SHEETS).map(([value, sh]) => ({ value, label: sh.label }))} />
          <div className="sheet-preview" style={{ aspectRatio: `${SHEETS[sheetId].w} / ${SHEETS[sheetId].h}` }}>
            {Array.from({ length: L.rows * L.cols }, (_, i) => {
              const r = Math.floor(i / L.cols)
              const q = i % L.cols
              const sh = SHEETS[sheetId]
              return <div key={i} style={{ left: `${((L.ox + q * (preset.w + L.gap)) / sh.w) * 100}%`, top: `${((L.oy + r * (preset.h + L.gap)) / sh.h) * 100}%`, width: `${(preset.w / sh.w) * 100}%`, height: `${(preset.h / sh.h) * 100}%` }} />
            })}
          </div>
          <span className="caption">{L.rows * L.cols} photos per sheet. Print at 100% / "actual size" (not "fit to page") so the sizes stay exact.</span>
          <div className="row">
            <button className="btn primary" onClick={dlSheetPdf}><FileDown size={16} /> Sheet PDF</button>
            <button className="btn" onClick={dlSheet}><Download size={16} /> Sheet JPG</button>
          </div>
        </div>
        <div className="row">
          <button className="btn ghost sm" onClick={() => { setImg(null); setFile(null) }}><RotateCcw size={14} /> Other photo</button>
          <Link to="/tools/remove-background" className="btn ghost sm"><Eraser size={14} /> Change background first</Link>
        </div>
      </div>
    </div>
  )
}
