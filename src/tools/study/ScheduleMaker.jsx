import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Download, Plus, Trash2, X } from 'lucide-react'
import { Segmented } from '../../components/ui.jsx'
import { canvasToBlob, downloadBlob } from '../../lib/files.js'
import { load, save } from '../../lib/store.js'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const COLORS = ['#ffc9bd', '#bcd8ff', '#dccbff', '#baf0d6', '#ffe14a', '#ffd9a8', '#f5c2e7', '#c7ecee']
const SIZES = {
  phone: { label: 'Phone wallpaper', w: 1170, h: 2532 },
  desktop: { label: 'Desktop', w: 1920, h: 1080 },
  print: { label: 'Printable (A4)', w: 2480, h: 3508 },
}

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fmtTime = (m) => {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${((h + 11) % 12) + 1}${mm ? `:${String(mm).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`
}

const SAMPLE = [
  { id: 1, subject: 'Calculus 1', room: 'SEC-A 204', days: [0, 2], start: '08:30', end: '10:00', color: COLORS[1] },
  { id: 2, subject: 'Purposive Comm', room: 'AS 101', days: [1, 3], start: '10:00', end: '11:30', color: COLORS[0] },
  { id: 3, subject: 'Programming 1', room: 'Comp Lab 3', days: [0, 2], start: '13:00', end: '16:00', color: COLORS[2] },
  { id: 4, subject: 'PE 1', room: 'Gym', days: [4], start: '07:30', end: '09:30', color: COLORS[3] },
]

function draw(ctx, W, H, classes, { title, dark, showSat, showSun }) {
  const days = DAYS.map((d, i) => ({ d, i })).filter(({ i }) => i < 5 || (i === 5 && showSat) || (i === 6 && showSun))
  const ink = dark ? '#f3f1ea' : '#141414'
  const bg = dark ? '#111110' : '#f7f6f1'
  const line = dark ? '#2f2f2b' : '#e2dfd4'
  const muted = dark ? '#7f7c73' : '#8a877d'
  const u = Math.min(W, H) / 100
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const portrait = H > W
  const pad = u * (portrait ? 6 : 4)
  const top = portrait ? H * 0.2 : pad + u * 12
  ctx.fillStyle = ink
  ctx.font = `800 ${u * (portrait ? 8 : 6)}px 'Inter Tight Variable', 'Inter', sans-serif`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(title || 'My schedule', pad, top - u * (portrait ? 5 : 4))

  const starts = classes.map((c) => toMin(c.start))
  const ends = classes.map((c) => toMin(c.end))
  const t0 = Math.floor(Math.min(420, ...starts) / 60) * 60
  const t1 = Math.ceil(Math.max(1080, ...ends) / 60) * 60
  const timeCol = u * (portrait ? 11 : 7)
  const headH = u * (portrait ? 6 : 5)
  const gx = pad + timeCol
  const gy = top + headH
  const gw = W - pad - gx
  const gh = H - pad - gy - (portrait ? H * 0.08 : 0)
  const colW = gw / days.length
  const perMin = gh / (t1 - t0)

  ctx.font = `600 ${u * (portrait ? 3.2 : 2.2)}px 'Inter Variable', 'Inter', sans-serif`
  ctx.textAlign = 'center'
  days.forEach(({ d }, k) => { ctx.fillStyle = ink; ctx.fillText(d.toUpperCase(), gx + colW * k + colW / 2, top + headH * 0.62) })
  ctx.textAlign = 'right'
  ctx.lineWidth = Math.max(1, u * 0.12)
  for (let t = t0; t <= t1; t += 60) {
    const y = gy + (t - t0) * perMin
    ctx.strokeStyle = line
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke()
    ctx.fillStyle = muted
    ctx.font = `500 ${u * (portrait ? 2.6 : 1.7)}px 'Inter Variable', 'Inter', sans-serif`
    ctx.fillText(fmtTime(t), gx - u * 1.2, y + u * 0.9)
  }
  for (let k = 0; k <= days.length; k++) {
    ctx.strokeStyle = line
    ctx.beginPath(); ctx.moveTo(gx + colW * k, gy); ctx.lineTo(gx + colW * k, gy + gh); ctx.stroke()
  }
  ctx.textAlign = 'left'
  const r = u * 1
  for (const c of classes) {
    for (const di of c.days) {
      const k = days.findIndex((x) => x.i === di)
      if (k < 0) continue
      const x = gx + colW * k + u * 0.5
      const y = gy + (toMin(c.start) - t0) * perMin + u * 0.3
      const w = colW - u * 1
      const h = Math.max(u * 2, (toMin(c.end) - toMin(c.start)) * perMin - u * 0.6)
      ctx.fillStyle = dark ? '#000' : ink
      ctx.beginPath(); ctx.roundRect(x + u * 0.4, y + u * 0.4, w, h, r); ctx.fill()
      ctx.fillStyle = c.color
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill()
      ctx.strokeStyle = '#141414'; ctx.lineWidth = u * 0.22; ctx.stroke()
      ctx.save()
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
      ctx.fillStyle = '#141414'
      const fs = u * (portrait ? 2.6 : 1.8)
      ctx.font = `700 ${fs}px 'Inter Tight Variable', 'Inter', sans-serif`
      wrap(ctx, c.subject, x + u * 0.9, y + fs * 1.3, w - u * 1.8, fs * 1.15, 2)
      ctx.font = `500 ${fs * 0.82}px 'Inter Variable', 'Inter', sans-serif`
      ctx.globalAlpha = 0.75
      const lines = [c.room, `${fmtTime(toMin(c.start))}–${fmtTime(toMin(c.end))}`].filter(Boolean)
      lines.forEach((l, n) => ctx.fillText(l, x + u * 0.9, y + fs * 1.3 + fs * 2.4 + n * fs * 1.05, w - u * 1.8))
      ctx.restore()
    }
  }
}

function wrap(ctx, text, x, y, maxW, lh, maxLines) {
  const words = text.split(' ')
  let line = ''
  let n = 0
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(n === maxLines - 1 ? `${line}…` : line, x, y + n * lh)
      n++
      line = words[i]
      if (n >= maxLines) return
    } else line = test
  }
  ctx.fillText(line, x, y + n * lh, maxW)
}

export default function ScheduleMaker() {
  const [classes, setClasses] = useState(() => load('pirata-sched', SAMPLE))
  const [title, setTitle] = useState(() => load('pirata-sched-title', '1st Semester'))
  const [size, setSize] = useState('phone')
  const [dark, setDark] = useState(false)
  const [form, setForm] = useState({ subject: '', room: '', days: [], start: '08:00', end: '09:30', color: COLORS[4] })
  const canvasRef = useRef(null)

  useEffect(() => save('pirata-sched', classes), [classes])
  useEffect(() => save('pirata-sched-title', title), [title])

  const showSat = classes.some((c) => c.days.includes(5))
  const showSun = classes.some((c) => c.days.includes(6))

  const conflicts = useMemo(() => {
    const out = []
    for (let a = 0; a < classes.length; a++) for (let b = a + 1; b < classes.length; b++) {
      const A = classes[a]; const B = classes[b]
      const shared = A.days.filter((d) => B.days.includes(d))
      if (shared.length && toMin(A.start) < toMin(B.end) && toMin(B.start) < toMin(A.end)) out.push(`${A.subject} and ${B.subject} overlap on ${shared.map((d) => DAYS[d]).join(', ')}`)
    }
    return out
  }, [classes])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const { w, h } = SIZES[size]
    const scale = size === 'desktop' ? 0.6 : 0.4
    c.width = w * scale
    c.height = h * scale
    document.fonts?.ready.then(() => draw(c.getContext('2d'), c.width, c.height, classes, { title, dark, showSat, showSun }))
  }, [classes, title, size, dark, showSat, showSun])

  const add = () => {
    if (!form.subject.trim() || !form.days.length || toMin(form.end) <= toMin(form.start)) return
    setClasses((c) => [...c, { ...form, id: Date.now() }])
    setForm((f) => ({ ...f, subject: '', room: '', days: [], color: COLORS[(COLORS.indexOf(f.color) + 1) % COLORS.length] }))
  }

  const exportPng = async () => {
    const { w, h } = SIZES[size]
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    await document.fonts?.ready
    draw(c.getContext('2d'), w, h, classes, { title, dark, showSat, showSun })
    downloadBlob(await canvasToBlob(c, 'image/png'), `schedule-${size}.png`)
  }

  const invalid = form.subject.trim() && form.days.length && toMin(form.end) <= toMin(form.start)

  return (
    <div className="split" style={{ alignItems: 'start' }}>
      <div className="stack">
        <div className="panel stack">
          <b>Add a class</b>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <div className="field" style={{ flex: 1.4 }}><label>Subject</label><input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Chemistry" onKeyDown={(e) => e.key === 'Enter' && add()} /></div>
            <div className="field" style={{ flex: 1 }}><label>Room</label><input className="input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="optional" /></div>
          </div>
          <div className="field"><label>Days</label>
            <div className="row" style={{ gap: 6 }}>
              {DAYS.map((d, i) => (
                <button key={d} className={`chip ${form.days.includes(i) ? 'active' : ''}`} onClick={() => setForm({ ...form, days: form.days.includes(i) ? form.days.filter((x) => x !== i) : [...form.days, i].sort() })}>{d}</button>
              ))}
            </div>
          </div>
          <div className="row">
            <div className="field"><label>Start</label><input className="input" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></div>
            <div className="field"><label>End</label><input className="input" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></div>
            <div className="field"><label>Color</label>
              <div className="row" style={{ gap: 5 }}>
                {COLORS.map((c) => <button key={c} aria-label={`Color ${c}`} onClick={() => setForm({ ...form, color: c })} style={{ width: 24, height: 24, borderRadius: 7, background: c, border: form.color === c ? '2px solid var(--ink)' : '1px solid var(--border)', cursor: 'pointer' }} />)}
              </div>
            </div>
          </div>
          {invalid && <div className="error">The end time must be after the start time.</div>}
          <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={add} disabled={!form.subject.trim() || !form.days.length || invalid}><Plus size={16} /> Add class</button>
        </div>

        {conflicts.length > 0 && (
          <div className="error" style={{ flexDirection: 'column' }}>
            {conflicts.map((c) => <span key={c}><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> {c}</span>)}
          </div>
        )}

        <div className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>Classes ({classes.length})</b>
            {classes.length > 0 && <button className="btn sm ghost danger" onClick={() => setClasses([])}><Trash2 size={14} /> Clear</button>}
          </div>
          {classes.map((c) => (
            <div className="file-item" key={c.id} style={{ animation: 'none' }}>
              <span style={{ width: 14, height: 36, borderRadius: 5, background: c.color, border: '1px solid var(--ink)' }} />
              <div className="meta">
                <div className="name">{c.subject}</div>
                <div className="sub">{c.days.map((d) => DAYS[d]).join(' / ')} · {fmtTime(toMin(c.start))}–{fmtTime(toMin(c.end))}{c.room ? ` · ${c.room}` : ''}</div>
              </div>
              <button className="mini-btn" aria-label="Remove" onClick={() => setClasses((x) => x.filter((y) => y.id !== c.id))}><X size={14} /></button>
            </div>
          ))}
          {!classes.length && <span className="caption">No classes yet.</span>}
        </div>
      </div>

      <div className="stack" style={{ position: 'sticky', top: 84 }}>
        <div className="panel stack">
          <div className="field"><label>Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Segmented value={size} onChange={setSize} options={Object.entries(SIZES).map(([value, s]) => ({ value, label: s.label }))} />
            <label className="checkbox"><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> Dark</label>
          </div>
        </div>
        <div className="preview" style={{ padding: 16, background: 'var(--bg-2)' }}>
          <canvas ref={canvasRef} style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: 620, borderRadius: 10, boxShadow: 'var(--hard)', border: '1.5px solid var(--ink)' }} />
        </div>
        <button className="btn primary" onClick={exportPng}><Download size={16} /> Download PNG ({SIZES[size].w}×{SIZES[size].h})</button>
      </div>
    </div>
  )
}
