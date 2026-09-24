import { useEffect, useRef, useState } from 'react'
import '@fontsource/dancing-script/600.css'
import { CalendarDays, Download, Eraser, PenLine, RotateCcw, Trash2, Type, Upload } from 'lucide-react'
import { Dropzone, Segmented } from '../../components/ui.jsx'
import { baseName, downloadBlob, fileToImage, formatBytes } from '../../lib/files.js'
import { loadPdfLib, openPdfjs, pdfBlob, readBytes, renderPage } from '../../lib/pdf.js'
import { toast } from '../../lib/toast.js'

/** Crop a canvas to its non-transparent pixels. */
function trim(canvas) {
  const ctx = canvas.getContext('2d')
  const { width: w, height: h } = canvas
  const d = ctx.getImageData(0, 0, w, h).data
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  if (x1 < 0) return null
  const pad = 6
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad)
  const out = document.createElement('canvas')
  out.width = x1 - x0 + 1
  out.height = y1 - y0 + 1
  out.getContext('2d').drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

function textToPng(text, font, color, px = 96) {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  ctx.font = `${px}px ${font}`
  c.width = Math.ceil(ctx.measureText(text).width + px)
  c.height = Math.ceil(px * 1.8)
  ctx.font = `${px}px ${font}`
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(text, px / 2, c.height / 2)
  const t = trim(c)
  return t && { src: t.toDataURL('image/png'), ratio: t.width / t.height }
}

function DrawPad({ color, onChange }) {
  const ref = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)

  useEffect(() => {
    const c = ref.current
    const dpr = window.devicePixelRatio || 1
    c.width = c.clientWidth * dpr
    c.height = c.clientHeight * dpr
  }, [])

  const pos = (e) => {
    const r = ref.current.getBoundingClientRect()
    const dpr = ref.current.width / r.width
    return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr, p: e.pressure || 0.5 }
  }

  const down = (e) => { drawing.current = true; ref.current.setPointerCapture(e.pointerId); last.current = pos(e) }
  const move = (e) => {
    if (!drawing.current) return
    const p = pos(e)
    const ctx = ref.current.getContext('2d')
    const dpr = ref.current.width / ref.current.clientWidth
    ctx.strokeStyle = color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = (2 + p.p * 2.5) * dpr
    ctx.beginPath()
    const mx = (last.current.x + p.x) / 2
    const my = (last.current.y + p.y) / 2
    ctx.moveTo(last.current.mx ?? last.current.x, last.current.my ?? last.current.y)
    ctx.quadraticCurveTo(last.current.x, last.current.y, mx, my)
    ctx.stroke()
    last.current = { ...p, mx, my }
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    const t = trim(ref.current)
    onChange(t ? { src: t.toDataURL('image/png'), ratio: t.width / t.height } : null)
  }
  const clear = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); onChange(null) }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <canvas ref={ref} className="sign-pad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="caption">Sign with your mouse, trackpad or finger</span>
        <button className="btn sm ghost" onClick={clear}><Eraser size={14} /> Clear</button>
      </div>
    </div>
  )
}

let iid = 0

export default function SignPdf() {
  const [file, setFile] = useState(null)
  const [bytes, setBytes] = useState(null)
  const [pages, setPages] = useState([]) // { url, w, h }
  const [mode, setMode] = useState('draw')
  const [color, setColor] = useState('#0b2a8a')
  const [typed, setTyped] = useState('')
  const [sig, setSig] = useState(null) // { src, ratio }
  const [items, setItems] = useState([]) // { id, page, x, y, w, src, ratio } in page fractions
  const [placing, setPlacing] = useState(null)
  const [armed, setArmed] = useState(false)
  useEffect(() => { setArmed(!!sig) }, [sig])
  const [busy, setBusy] = useState(false)
  const dragRef = useRef(null)

  const open = async ([f]) => {
    try {
      const b = await readBytes(f)
      const doc = await openPdfjs(b)
      setFile(f); setBytes(b); setItems([])
      const out = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const vp = page.getViewport({ scale: 1 })
        const canvas = await renderPage(page, Math.min(2, 1400 / vp.width))
        out.push({ url: canvas.toDataURL('image/jpeg', 0.85), w: vp.width, h: vp.height })
        setPages([...out])
      }
    } catch {
      toast('This PDF could not be opened.', 'error')
    }
  }

  useEffect(() => {
    if (mode !== 'type') return
    if (!typed.trim()) { setSig(null); return }
    document.fonts.load("600 64px 'Dancing Script'").then(() => setSig(textToPng(typed, "600 'Dancing Script', cursive", color)))
  }, [typed, color, mode])

  const upload = async ([f]) => {
    const img = await fileToImage(f)
    const c = document.createElement('canvas')
    const s = Math.min(1, 1200 / img.naturalWidth)
    c.width = img.naturalWidth * s
    c.height = img.naturalHeight * s
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0, c.width, c.height)
    const data = ctx.getImageData(0, 0, c.width, c.height)
    const d = data.data
    for (let i = 0; i < d.length; i += 4) {
      const lum = (d[i] + d[i + 1] + d[i + 2]) / 3
      if (lum > 200) d[i + 3] = 0
      else if (lum > 150) d[i + 3] = Math.round(((200 - lum) / 50) * d[i + 3])
    }
    ctx.putImageData(data, 0, 0)
    const t = trim(c)
    if (t) { setSig({ src: t.toDataURL('image/png'), ratio: t.width / t.height }); toast('Background removed from your signature photo', 'info') }
  }

  const addDate = () => {
    const d = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    const t = textToPng(d, "500 'Inter Variable', 'Inter', sans-serif", '#141414', 64)
    setPlacing({ ...t, kind: 'date' })
    toast('Click on a page to place the date', 'info')
  }

  const place = (e, pageIdx) => {
    const what = placing || (armed && sig && { ...sig })
    if (!what) return
    if (e.target.closest('.sig-item')) return
    const r = e.currentTarget.getBoundingClientRect()
    const w = what.kind === 'date' ? 0.22 : 0.3
    const pw = r.width
    const h = (w * pw) / what.ratio / r.height
    const x = Math.min(1 - w, Math.max(0, (e.clientX - r.left) / r.width - w / 2))
    const y = Math.min(1 - h, Math.max(0, (e.clientY - r.top) / r.height - h / 2))
    setItems((it) => [...it, { id: ++iid, page: pageIdx, x, y, w, src: what.src, ratio: what.ratio }])
    setPlacing(null)
    setArmed(false)
  }

  const startDrag = (e, item, kind) => {
    e.stopPropagation()
    e.preventDefault()
    const box = e.currentTarget.closest('.sign-page').getBoundingClientRect()
    dragRef.current = { id: item.id, kind, sx: e.clientX, sy: e.clientY, x: item.x, y: item.y, w: item.w, box }
    const moveH = (ev) => {
      const d = dragRef.current
      if (!d) return
      const dx = (ev.clientX - d.sx) / d.box.width
      const dy = (ev.clientY - d.sy) / d.box.height
      setItems((its) => its.map((it) => {
        if (it.id !== d.id) return it
        if (d.kind === 'move') return { ...it, x: Math.min(1 - it.w, Math.max(0, d.x + dx)), y: Math.max(0, Math.min(1 - (it.w * d.box.width) / it.ratio / d.box.height, d.y + dy)) }
        return { ...it, w: Math.max(0.05, Math.min(1 - it.x, d.w + dx)) }
      }))
    }
    const upH = () => { dragRef.current = null; window.removeEventListener('pointermove', moveH); window.removeEventListener('pointerup', upH) }
    window.addEventListener('pointermove', moveH)
    window.addEventListener('pointerup', upH)
  }

  const saveOut = async () => {
    setBusy(true)
    try {
      const { PDFDocument, degrees } = await loadPdfLib()
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
      const js = await openPdfjs(bytes)
      const cache = {}
      for (const it of items) {
        cache[it.src] ||= await pdf.embedPng(it.src)
        const img = cache[it.src]
        const jsPage = await js.getPage(it.page + 1)
        const vp = jsPage.getViewport({ scale: 1 })
        const wd = it.w * vp.width
        const hd = wd / it.ratio
        const [px, py] = vp.convertToPdfPoint(it.x * vp.width, it.y * vp.height + hd)
        pdf.getPage(it.page).drawImage(img, { x: px, y: py, width: wd, height: hd, rotate: degrees(jsPage.rotate || 0) })
      }
      downloadBlob(pdfBlob(await pdf.save()), `${baseName(file.name)}-signed.pdf`)
    } catch (e) {
      console.error(e)
      toast('Saving failed. The PDF may be encrypted.', 'error')
    } finally { setBusy(false) }
  }

  if (!file) return <Dropzone accept="application/pdf,.pdf" onFiles={open} hint="Sign waivers, consent forms and clearances without printing anything." />

  const ready = placing || (armed && sig)

  return (
    <div className="sign-layout">
      <div className="stack sign-side">
        <div className="panel stack">
          <b>1. Create your signature</b>
          <Segmented value={mode} onChange={(m) => { setMode(m); setSig(null) }} options={[
            { value: 'draw', label: <><PenLine size={14} style={{ verticalAlign: -2 }} /> Draw</> },
            { value: 'type', label: <><Type size={14} style={{ verticalAlign: -2 }} /> Type</> },
            { value: 'upload', label: <><Upload size={14} style={{ verticalAlign: -2 }} /> Photo</> },
          ]} />
          {mode === 'draw' && <DrawPad key={color} color={color} onChange={setSig} />}
          {mode === 'type' && (
            <>
              <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your full name" />
              <div className="sign-typed" style={{ color }}>{typed || 'Your Name'}</div>
            </>
          )}
          {mode === 'upload' && (
            <>
              <Dropzone accept="image/*" onFiles={upload} compact title="Photo of your signature on white paper" />
              {sig && <div className="preview checker" style={{ minHeight: 90 }}><img src={sig.src} alt="Signature" style={{ maxHeight: 90 }} /></div>}
            </>
          )}
          {mode !== 'upload' && (
            <div className="row">
              <span className="label">Ink</span>
              {['#0b2a8a', '#141414', '#1f6b3a'].map((c) => (
                <button key={c} aria-label={`Ink ${c}`} onClick={() => setColor(c)} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: color === c ? '3px solid var(--hl)' : '2px solid var(--surface)', boxShadow: '0 0 0 1px var(--ink)', cursor: 'pointer' }} />
              ))}
            </div>
          )}
        </div>
        <div className="panel stack">
          <b>2. Place it</b>
          <span className="caption">{ready ? 'Click anywhere on a page to drop it there.' : sig ? 'Drag a placed signature to move it, and use its corner to resize.' : 'Create a signature first.'}</span>
          <div className="row">
            <button className="btn sm primary" disabled={!sig || armed} onClick={() => setArmed(true)}><PenLine size={14} /> Place signature again</button>
            <button className="btn sm" onClick={addDate}><CalendarDays size={14} /> Add today's date</button>
          </div>
        </div>
        <div className="panel stack">
          <b>3. Save</b>
          <span className="caption">{items.length} item{items.length === 1 ? '' : 's'} placed · {file.name} ({formatBytes(file.size)})</span>
          <div className="row">
            <button className="btn primary" onClick={saveOut} disabled={busy || !items.length}>{busy ? <span className="spinner" /> : <Download size={16} />} Download signed PDF</button>
            <button className="btn ghost sm" onClick={() => { setFile(null); setPages([]); setItems([]) }}><RotateCcw size={14} /> Other file</button>
          </div>
        </div>
      </div>

      <div className="stack sign-pages">
        {pages.map((p, i) => (
          <div key={i} className={`sign-page ${ready ? 'placing' : ''}`} style={{ aspectRatio: `${p.w} / ${p.h}` }} onClick={(e) => place(e, i)}>
            <img src={p.url} alt={`Page ${i + 1}`} draggable={false} />
            <span className="sign-pno">{i + 1} / {pages.length}</span>
            {items.filter((it) => it.page === i).map((it) => (
              <div
                key={it.id}
                className="sig-item"
                style={{ left: `${it.x * 100}%`, top: `${it.y * 100}%`, width: `${it.w * 100}%`, aspectRatio: `${it.ratio}` }}
                onPointerDown={(e) => startDrag(e, it, 'move')}
              >
                <img src={it.src} alt="Signature" draggable={false} />
                <button className="sig-del" aria-label="Remove" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setItems((x) => x.filter((y) => y.id !== it.id)) }}><Trash2 size={12} /></button>
                <span className="sig-handle" onPointerDown={(e) => startDrag(e, it, 'resize')} />
              </div>
            ))}
          </div>
        ))}
        {!pages.length && <div className="panel row"><span className="spinner" /> Rendering pages…</div>}
      </div>
    </div>
  )
}
