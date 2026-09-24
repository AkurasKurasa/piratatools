import { useEffect, useMemo, useState } from 'react'
import { Plus, RotateCcw, Target, X } from 'lucide-react'
import { Segmented } from '../../components/ui.jsx'
import { load, save } from '../../lib/store.js'

const SCALES = {
  ph: {
    label: '1.00 – 5.00',
    note: 'Most PH universities (UP, PUP, UST, Mapúa…). Lower is better. 3.00 passes.',
    best: 1, worst: 5, lowerIsBetter: true, decimals: 2,
    grades: ['1.00', '1.25', '1.50', '1.75', '2.00', '2.25', '2.50', '2.75', '3.00', '4.00', '5.00'],
    honors: [
      { name: 'Summa Cum Laude', max: 1.2 },
      { name: 'Magna Cum Laude', max: 1.45 },
      { name: 'Cum Laude', max: 1.75 },
    ],
  },
  qpi: {
    label: '4.00 – 0.00',
    note: 'QPI/CGPA schools (Ateneo, DLSU, and the US 4.0 scale). Higher is better.',
    best: 4, worst: 0, lowerIsBetter: false, decimals: 2,
    grades: ['4.00', '3.50', '3.00', '2.50', '2.00', '1.50', '1.00', '0.00'],
    honors: [
      { name: 'Summa Cum Laude', min: 3.87 },
      { name: 'Magna Cum Laude', min: 3.7 },
      { name: 'Cum Laude', min: 3.5 },
    ],
  },
  pct: {
    label: 'Percent',
    note: 'Senior high, DepEd and percentage-based grading. 75 passes.',
    best: 100, worst: 0, lowerIsBetter: false, decimals: 2,
    grades: null,
    honors: [
      { name: 'With Highest Honors', min: 98 },
      { name: 'With High Honors', min: 95 },
      { name: 'With Honors', min: 90 },
    ],
  },
}

let rid = 0
const row = (subject = '', units = '3', grade = '') => ({ id: `r${Date.now()}${rid++}`, subject, units, grade })
const starter = () => [row('', '3', ''), row('', '3', ''), row('', '3', ''), row('', '3', '')]

export default function GwaCalculator() {
  const [scaleId, setScaleId] = useState(() => load('pirata-gwa-scale', 'ph'))
  const [rows, setRows] = useState(() => load('pirata-gwa-rows', null) || starter())
  const [target, setTarget] = useState('')
  const [remaining, setRemaining] = useState('')
  const scale = SCALES[scaleId]

  useEffect(() => save('pirata-gwa-rows', rows), [rows])
  useEffect(() => save('pirata-gwa-scale', scaleId), [scaleId])

  const update = (id, key, value) => setRows((r) => r.map((x) => (x.id === id ? { ...x, [key]: value } : x)))

  const result = useMemo(() => {
    let units = 0
    let points = 0
    let counted = 0
    for (const r of rows) {
      const u = parseFloat(r.units)
      const g = parseFloat(r.grade)
      if (!(u > 0) || Number.isNaN(g)) continue
      units += u
      points += u * g
      counted++
    }
    return { units, gwa: units ? points / units : null, counted }
  }, [rows])

  const honor = useMemo(() => {
    if (result.gwa == null) return null
    const failing = rows.some((r) => {
      const g = parseFloat(r.grade)
      if (Number.isNaN(g)) return false
      return scale.lowerIsBetter ? g > 3 : scaleId === 'pct' ? g < 75 : g < 1
    })
    if (failing) return { name: 'Not eligible (has a failing grade)', ok: false }
    const h = scale.honors.find((x) => (x.max != null ? result.gwa <= x.max : result.gwa >= x.min))
    return h ? { name: h.name, ok: true } : { name: 'Below honors range', ok: false }
  }, [result, rows, scale, scaleId])

  const needed = useMemo(() => {
    const t = parseFloat(target)
    const rem = parseFloat(remaining)
    if (Number.isNaN(t) || !(rem > 0) || result.gwa == null) return null
    const need = (t * (result.units + rem) - result.gwa * result.units) / rem
    const lo = Math.min(scale.best, scale.worst)
    const hi = Math.max(scale.best, scale.worst)
    const possible = need >= lo && need <= hi
    const already = scale.lowerIsBetter ? need >= scale.worst : need <= scale.worst
    return { need, possible, already }
  }, [target, remaining, result, scale])

  const fmt = (n) => n.toFixed(scale.decimals)

  return (
    <div className="stack">
      <div className="panel row" style={{ justifyContent: 'space-between' }}>
        <div className="stack" style={{ gap: 6 }}>
          <Segmented value={scaleId} onChange={setScaleId} options={Object.entries(SCALES).map(([value, s]) => ({ value, label: s.label }))} />
          <span className="caption">{scale.note}</span>
        </div>
        <button className="btn ghost sm" onClick={() => setRows(starter())}><RotateCcw size={14} /> Start over</button>
      </div>

      <div className="stats">
        <div className="stat feature"><span>{scaleId === 'qpi' ? 'QPI / GPA' : scaleId === 'pct' ? 'General average' : 'GWA'}</span><b>{result.gwa == null ? '—' : fmt(result.gwa)}</b></div>
        <div className="stat"><span>Units counted</span><b>{result.units || 0}</b></div>
        <div className="stat"><span>Subjects</span><b>{result.counted}</b></div>
        <div className="stat"><span>Honors (typical)</span><b style={{ fontSize: 16, lineHeight: 1.3, paddingTop: 6 }}>{honor ? honor.name : '—'}</b></div>
      </div>

      <div className="panel stack">
        <div className="gwa-row gwa-head">
          <span>Subject</span><span>Units</span><span>Grade</span><span />
        </div>
        {rows.map((r, i) => (
          <div className="gwa-row" key={r.id}>
            <input className="input" placeholder={`Subject ${i + 1}`} value={r.subject} onChange={(e) => update(r.id, 'subject', e.target.value)} />
            <input className="input mono" type="number" min="0" step="0.5" value={r.units} onChange={(e) => update(r.id, 'units', e.target.value)} aria-label="Units" />
            {scale.grades ? (
              <select className="select mono" value={r.grade} onChange={(e) => update(r.id, 'grade', e.target.value)} aria-label="Grade">
                <option value="">—</option>
                {scale.grades.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            ) : (
              <input className="input mono" type="number" min="0" max="100" value={r.grade} onChange={(e) => update(r.id, 'grade', e.target.value)} placeholder="—" aria-label="Grade" />
            )}
            <button className="mini-btn" aria-label="Remove subject" onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))}><X size={15} /></button>
          </div>
        ))}
        <div className="row">
          <button className="btn sm" onClick={() => setRows((x) => [...x, row()])}><Plus size={14} /> Add subject</button>
          <span className="caption">Leave INC, DRP or ungraded subjects blank and they won't be counted. Everything is saved in this browser.</span>
        </div>
      </div>

      <div className="panel stack">
        <div className="row"><Target size={18} /><b>What do I need?</b></div>
        <div className="row">
          <div className="field"><label>Target {scaleId === 'qpi' ? 'QPI' : 'GWA'}</label><input className="input mono" type="number" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={scaleId === 'ph' ? '1.75' : scaleId === 'qpi' ? '3.50' : '90'} /></div>
          <div className="field"><label>Units left to take</label><input className="input mono" type="number" min="0" value={remaining} onChange={(e) => setRemaining(e.target.value)} placeholder="e.g. 21" /></div>
        </div>
        {needed && (
          <div className="status">
            {needed.already ? (
              <>You'll hit that target whatever grades you get in the remaining units. Nice.</>
            ) : needed.possible ? (
              <>You need an average of <b className="mono" style={{ fontSize: 18 }}>{fmt(needed.need)}</b> across the remaining {remaining} units.</>
            ) : (
              <>That target isn't reachable with {remaining} units. You'd need an average of {fmt(needed.need)}, which is outside the scale.</>
            )}
          </div>
        )}
        {!needed && <span className="caption">Enter your grades above, then a target and the units you have left.</span>}
      </div>
      <p className="caption">Honors cut-offs differ by school and usually have extra rules (no failing or dropped subjects, residency). Check your student handbook.</p>
    </div>
  )
}
