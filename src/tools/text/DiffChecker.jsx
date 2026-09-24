import { useMemo, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { Segmented } from '../../components/ui.jsx'
import { diff, tokenize } from '../../lib/diff.js'

const A = `The Philippines is an archipelago of more than 7,000 islands. It's economy relies heavily on agriculture, remittances and the business process outsourcing industry.

Tourism is also important, especially in places like Palawan and Boracay.`
const B = `The Philippines is an archipelago of 7,641 islands. Its economy relies on agriculture, remittances, and the business process outsourcing (BPO) industry.

Tourism also plays a major role, especially in Palawan, Siargao and Boracay.`

export default function DiffChecker() {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [mode, setMode] = useState('word')
  const [view, setView] = useState('inline')
  const [ignoreCase, setIgnoreCase] = useState(false)

  const result = useMemo(() => {
    if (!left && !right) return null
    const ta = tokenize[mode](left)
    const tb = tokenize[mode](right)
    if (ta.length * tb.length > 4e8 && mode === 'char') return { tooBig: true }
    const eq = ignoreCase ? (x, y) => x.toLowerCase() === y.toLowerCase() : undefined
    const ops = diff(ta, tb, eq)
    const count = (t) => ops.filter((o) => o.type === t).reduce((s, o) => s + (tokenize.word(o.value).filter((w) => w.trim()).length || (o.value.trim() ? 1 : 0)), 0)
    const same = ops.filter((o) => o.type === 'eq').reduce((s, o) => s + o.value.length, 0)
    return { ops, added: count('add'), removed: count('del'), similarity: Math.round((2 * same / Math.max(1, left.length + right.length)) * 100) }
  }, [left, right, mode, ignoreCase])

  return (
    <div className="stack">
      <div className="panel row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <Segmented value={mode} onChange={setMode} options={[{ value: 'word', label: 'Words' }, { value: 'line', label: 'Lines' }, { value: 'char', label: 'Characters' }]} />
          <Segmented value={view} onChange={setView} options={[{ value: 'inline', label: 'Inline' }, { value: 'side', label: 'Side by side' }]} />
          <label className="checkbox"><input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} /> Ignore case</label>
        </div>
        <div className="row">
          {!left && !right && <button className="btn sm ghost" onClick={() => { setLeft(A); setRight(B) }}>Try an example</button>}
          <button className="btn sm" onClick={() => { setLeft(right); setRight(left) }}><ArrowLeftRight size={14} /> Swap</button>
        </div>
      </div>

      <div className="split">
        <div className="field"><label>Original</label><textarea className="textarea" style={{ fontFamily: 'var(--font)', fontSize: 14 }} value={left} onChange={(e) => setLeft(e.target.value)} placeholder="Paste the first draft…" /></div>
        <div className="field"><label>Changed</label><textarea className="textarea" style={{ fontFamily: 'var(--font)', fontSize: 14 }} value={right} onChange={(e) => setRight(e.target.value)} placeholder="Paste the new version…" /></div>
      </div>

      {result?.tooBig && <div className="error">Too large to compare letter by letter. Switch to Words or Lines.</div>}
      {result?.ops && (
        <>
          <div className="stats">
            <div className="stat"><span>Added</span><b className="badge-ok">+{result.added}</b></div>
            <div className="stat"><span>Removed</span><b style={{ color: 'var(--danger)' }}>−{result.removed}</b></div>
            <div className="stat feature"><span>Similarity</span><b>{result.similarity}%</b></div>
          </div>
          {view === 'inline' ? (
            <div className="diff-view">
              {result.ops.map((o, i) => <span key={i} className={o.type}>{o.value}</span>)}
            </div>
          ) : (
            <div className="split">
              <div className="diff-view">{result.ops.filter((o) => o.type !== 'add').map((o, i) => <span key={i} className={o.type}>{o.value}</span>)}</div>
              <div className="diff-view">{result.ops.filter((o) => o.type !== 'del').map((o, i) => <span key={i} className={o.type}>{o.value}</span>)}</div>
            </div>
          )}
          {result.added === 0 && result.removed === 0 && <div className="status badge-ok">These two texts are identical.</div>}
        </>
      )}
    </div>
  )
}
