import { useMemo, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { Segmented } from '../../components/ui.jsx'
import CopyButton from '../../components/CopyButton.jsx'
import { downloadBlob } from '../../lib/files.js'

const SAMPLE = '{"name":"Pirata","tools":["image","pdf","text","media"],"free":true,"version":1}'

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
  return v
}

function locate(text, message) {
  const m = message.match(/position (\d+)/i)
  let pos = m ? +m[1] : null
  const lc = message.match(/line (\d+) column (\d+)/i)
  if (lc) return { line: +lc[1], col: +lc[2] }
  if (pos == null) return null
  const before = text.slice(0, pos)
  const line = before.split('\n').length
  const col = pos - before.lastIndexOf('\n')
  return { line, col }
}

export default function JsonFormatter() {
  const [input, setInput] = useState('')
  const [indent, setIndent] = useState('2')
  const [mode, setMode] = useState('pretty')
  const [sorted, setSorted] = useState(false)

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: null }
    try {
      let v = JSON.parse(input)
      if (sorted) v = sortKeys(v)
      const space = mode === 'minify' ? undefined : indent === 'tab' ? '\t' : +indent
      return { output: JSON.stringify(v, null, space), error: null }
    } catch (e) {
      const where = locate(input, e.message)
      return { output: '', error: `${e.message.replace(/^JSON\.parse: /, '')}${where && !/line \d+/.test(e.message) ? ` (line ${where.line}, column ${where.col})` : ''}` }
    }
  }, [input, indent, mode, sorted])

  return (
    <div className="stack">
      <div className="panel row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <Segmented value={mode} onChange={setMode} options={[{ value: 'pretty', label: 'Prettify' }, { value: 'minify', label: 'Minify' }]} />
          {mode === 'pretty' && <Segmented value={indent} onChange={setIndent} options={[{ value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }, { value: 'tab', label: 'Tab' }]} />}
          <label className="checkbox"><input type="checkbox" checked={sorted} onChange={(e) => setSorted(e.target.checked)} /> Sort keys</label>
        </div>
        <div className="row">
          <button className="btn sm" onClick={() => setInput(SAMPLE)}>Sample</button>
          <button className="btn sm" onClick={() => setInput('')}><Trash2 size={14} /> Clear</button>
        </div>
      </div>
      <div className="split">
        <div className="field">
          <label>Input</label>
          <textarea className="textarea" style={{ minHeight: 420 }} spellCheck={false} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste JSON here…" />
        </div>
        <div className="field">
          <label>
            Output {input.trim() && (error ? <span className="error"> · invalid</span> : <span className="badge-ok"> · valid JSON</span>)}
          </label>
          <textarea className="textarea" style={{ minHeight: 420 }} readOnly spellCheck={false} value={error ? '' : output} placeholder={error ? '' : 'Formatted JSON appears here'} />
        </div>
      </div>
      {error && <div className="error mono">{error}</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <CopyButton text={output} disabled={!output} />
        <button className="btn primary" disabled={!output} onClick={() => downloadBlob(new Blob([output], { type: 'application/json' }), 'formatted.json')}><Download size={16} /> Download</button>
      </div>
    </div>
  )
}
