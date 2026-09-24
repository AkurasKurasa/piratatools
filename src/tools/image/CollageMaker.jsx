import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Shuffle, Trash2 } from 'lucide-react'
import { Dropzone, FileList, Segmented, move } from '../../components/ui.jsx'
import { canvasToBlob, downloadBlob, fileToImage, nextId } from '../../lib/files.js'

/* Layouts: cells as [x, y, w, h] fractions of the canvas */
const LAYOUTS = {
  2: [
    { id: '2v', cells: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
    { id: '2h', cells: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] },
  ],
  3: [
    { id: '3a', cells: [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.5], [0.6, 0.5, 0.4, 0.5]] },
    { id: '3b', cells: [[0, 0, 1, 0.55], [0, 0.55, 0.5, 0.45], [0.5, 0.55, 0.5, 0.45]] },
    { id: '3c', cells: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
  ],
  4: [
    { id: '4a', cells: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
    { id: '4b', cells: [[0, 0, 1, 0.6], [0, 0.6, 1 / 3, 0.4], [1 / 3, 0.6, 1 / 3, 0.4], [2 / 3, 0.6, 1 / 3, 0.4]] },
    { id: '4c', cells: [[0, 0, 0.6, 1], [0.6, 0, 0.4, 1 / 3], [0.6, 1 / 3, 0.4, 1 / 3], [0.6, 2 / 3, 0.4, 1 / 3]] },
  ],
  5: [
    { id: '5a', cells: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 1 / 3, 0.5], [1 / 3, 0.5, 1 / 3, 0.5], [2 / 3, 0.5, 1 / 3, 0.5]] },
    { id: '5b', cells: [[0, 0, 0.5, 1], [0.5, 0, 0.25, 0.5], [0.75, 0, 0.25, 0.5], [0.5, 0.5, 0.25, 0.5], [0.75, 0.5, 0.25, 0.5]] },
  ],
  6: [
    { id: '6a', cells: [0, 1, 2, 3, 4, 5].map((i) => [(i % 3) / 3, Math.floor(i / 3) / 2, 1 / 3, 1 / 2]) },
    { id: '6b', cells: [0, 1, 2, 3, 4, 5].map((i) => [(i % 2) / 2, Math.floor(i / 2) / 3, 1 / 2, 1 / 3]) },
  ],
  9: [{ id: '9a', cells: Array.from({ length: 9 }, (_, i) => [(i % 3) / 3, Math.floor(i / 3) / 3, 1 / 3, 1 / 3]) }],
}
const RATIOS = { '1:1': 1, '4:5': 4 / 5, '16:9': 16 / 9, '9:16': 9 / 16 }

function layoutsFor(n) {
  const keys = Object.keys(LAYOUTS).map(Number).sort((a, b) => a - b)
  const k = keys.find((x) => x >= n) ?? 9
  return LAYOUTS[k]
}

function draw(ctx, W, H, items, cells, { gap, radius, bg }) {
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const g = (gap / 100) * Math.min(W, H)
  cells.forEach((c, i) => {
    const x = c[0] * W + g * (c[0] === 0 ? 1 : 0.5)
    const y = c[1] * H + g * (c[1] === 0 ? 1 : 0.5)
    const w = c[2] * W - g * ((c[0] === 0 ? 1 : 0.5) + (c[0] + c[2] >= 0.999 ? 1 : 0.5))
    const h = c[3] * H - g * ((c[1] === 0 ? 1 : 0.5) + (c[1] + c[3] >= 0.999 ? 1 : 0.5))
    const it = items[i]
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, (radius / 100) * Math.min(w, h))
    ctx.clip()
    if (it) {
      const s = Math.max(w / it.img.naturalWidth, h / it.img.naturalHeight) * it.zoom
      const iw = it.img.naturalWidth * s
      const ih = it.img.naturalHeight * s
      ctx.drawImage(it.img, x + (w - iw) * it.fx, y + (h - ih) * it.fy, iw, ih)
    } else {
      ctx.fillStyle = 'rgba(128,128,128,.18)'
      ctx.fillRect(x, y, w, h)
    }
    ctx.restore()
  })
}

export default function CollageMaker() {
  const [items, setItems] = useState([])
  const [layoutId, setLayoutId] = useState(null)
  const [ratio, setRatio] = useState('1:1')
  const [gap, setGap] = useState(2)
  const [radius, setRadius] = useState(4)
  const [bg, setBg] = useState('#ffffff')
  const canvasRef = useRef(null)
  const drag = useRef(null)

  const options = useMemo(() => layoutsFor(Math.max(2, items.length)), [items.length])
  const layout = options.find((l) => l.id === layoutId) || options[0]
  const cells = layout.cells

  const add = async (files) => {
    const loaded = (await Promise.all(files.map((f) => fileToImage(f).then((img) => ({ id: nextId(), file: f, img, thumb: img.src, fx: 0.5, fy: 0.5, zoom: 1 })).catch(() => null)))).filter(Boolean)
    setItems((x) => [...x, ...loaded].slice(0, 9))
  }

  const PW = 560
  const PH = PW / RATIOS[ratio]

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = PW * dpr
    c.height = PH * dpr
    draw(c.getContext('2d'), c.width, c.height, items, cells, { gap, radius, bg })
  }, [items, cells, gap, radius, bg, PH])

  const cellAt = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    return cells.findIndex((c) => x >= c[0] && x <= c[0] + c[2] && y >= c[1] && y <= c[1] + c[3])
  }

  const onDown = (e) => {
    const i = cellAt(e)
    if (i < 0 || !items[i]) return
    canvasRef.current.setPointerCapture(e.pointerId)
    drag.current = { i, sx: e.clientX, sy: e.clientY, fx: items[i].fx, fy: items[i].fy }
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const r = canvasRef.current.getBoundingClientRect()
    const c = cells[d.i]
    const it = items[d.i]
    const cw = c[2] * r.width
    const ch = c[3] * r.height
    const s = Math.max(cw / it.img.naturalWidth, ch / it.img.naturalHeight) * it.zoom
    const exW = it.img.naturalWidth * s - cw
    const exH = it.img.naturalHeight * s - ch
    const fx = exW > 1 ? Math.min(1, Math.max(0, d.fx - (e.clientX - d.sx) / exW)) : 0.5
    const fy = exH > 1 ? Math.min(1, Math.max(0, d.fy - (e.clientY - d.sy) / exH)) : 0.5
    setItems((xs) => xs.map((x, j) => (j === d.i ? { ...x, fx, fy } : x)))
  }
  const onWheelZoom = (e) => {
    const i = cellAt(e)
    if (i < 0 || !items[i]) return
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, zoom: Math.max(1, Math.min(4, x.zoom * (e.deltaY < 0 ? 1.08 : 0.93))) } : x)))
  }
  const wheelRef = useRef(onWheelZoom)
  useEffect(() => { wheelRef.current = onWheelZoom })
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const h = (e) => { e.preventDefault(); wheelRef.current(e) }
    c.addEventListener('wheel', h, { passive: false })
    return () => c.removeEventListener('wheel', h)
  }, [items.length > 0])

  const exportPng = async () => {
    const long = 2400
    const r = RATIOS[ratio]
    const W = r >= 1 ? long : Math.round(long * r)
    const H = r >= 1 ? Math.round(long / r) : long
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    draw(c.getContext('2d'), W, H, items, cells, { gap, radius, bg })
    downloadBlob(await canvasToBlob(c, 'image/jpeg', 0.93), `collage-${ratio.replace(':', 'x')}.jpg`)
  }

  if (!items.length) return <Dropzone accept="image/*" multiple onFiles={add} hint="Choose 2 to 9 photos for org posts, event recaps or your portfolio." />

  return (
    <div className="split" style={{ alignItems: 'start' }}>
      <div className="stack">
        <div className="preview" style={{ padding: 16, background: 'var(--bg-2)' }}>
          <canvas
            ref={canvasRef}
            style={{ width: PW, maxWidth: '100%', height: 'auto', aspectRatio: `${RATIOS[ratio]}`, cursor: 'grab', borderRadius: 6, boxShadow: 'var(--hard)', border: '1.5px solid var(--ink)', touchAction: 'none' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={() => { drag.current = null }}
          />
        </div>
        <span className="caption">Drag a photo to reposition it inside its frame, and scroll over it to zoom.</span>
      </div>

      <div className="stack">
        <div className="panel stack">
          <div className="field"><label>Layout</label>
            <div className="row" style={{ gap: 8 }}>
              {options.map((l) => (
                <button key={l.id} className={`layout-btn ${layout.id === l.id ? 'on' : ''}`} onClick={() => setLayoutId(l.id)} aria-label={`Layout ${l.id}`}>
                  <svg viewBox="0 0 40 40">{l.cells.map((c, i) => <rect key={i} x={c[0] * 40 + 1.5} y={c[1] * 40 + 1.5} width={c[2] * 40 - 3} height={c[3] * 40 - 3} rx="2" />)}</svg>
                </button>
              ))}
            </div>
          </div>
          <div className="field"><label>Shape</label><Segmented value={ratio} onChange={setRatio} options={Object.keys(RATIOS).map((k) => ({ value: k, label: k }))} /></div>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <div className="field" style={{ flex: 1 }}><label>Spacing</label><input className="range" type="range" min="0" max="8" step="0.5" value={gap} onChange={(e) => setGap(+e.target.value)} /></div>
            <div className="field" style={{ flex: 1 }}><label>Corners</label><input className="range" type="range" min="0" max="25" value={radius} onChange={(e) => setRadius(+e.target.value)} /></div>
            <div className="field"><label>Background</label><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} /></div>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn sm" onClick={() => setItems((x) => x.slice().sort(() => Math.random() - 0.5))}><Shuffle size={14} /> Shuffle</button>
            <button className="btn primary" onClick={exportPng}><Download size={16} /> Download JPG</button>
          </div>
        </div>
        {items.length < 9 && <Dropzone accept="image/*" multiple onFiles={add} compact title="Add photos (up to 9)" />}
        <FileList
          items={items}
          onMove={(a, b) => setItems((x) => move(x, a, b))}
          onRemove={(id) => setItems((x) => x.filter((i) => i.id !== id))}
          renderSub={(it) => `${it.img.naturalWidth}×${it.img.naturalHeight}`}
        />
        {items.length > cells.length && <span className="caption">This layout shows the first {cells.length} photos.</span>}
        <button className="btn ghost sm danger" style={{ alignSelf: 'flex-start' }} onClick={() => setItems([])}><Trash2 size={14} /> Start over</button>
      </div>
    </div>
  )
}
