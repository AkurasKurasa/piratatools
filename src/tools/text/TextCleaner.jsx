import { useMemo, useState } from 'react'
import { Eraser, RotateCcw } from 'lucide-react'
import CopyButton from '../../components/CopyButton.jsx'

const OPS = [
  { id: 'pdfBreaks', label: 'Fix PDF line breaks', desc: 'Join lines broken mid-sentence when copying from a PDF', on: true,
    fn: (s) => s.replace(/\r\n?/g, '\n').replace(/(\w)-\n(\w)/g, '$1$2').replace(/([^\n])\n(?!\n)(?=\S)/g, '$1 ') },
  { id: 'spaces', label: 'Collapse extra spaces', desc: 'Two or more spaces become one', on: true, fn: (s) => s.replace(/[ \t ]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1') },
  { id: 'blank', label: 'Remove extra blank lines', desc: 'Keep at most one empty line between paragraphs', on: true, fn: (s) => s.replace(/\n{3,}/g, '\n\n') },
  { id: 'trim', label: 'Trim each line', desc: 'Remove spaces at the start and end of lines', on: true, fn: (s) => s.split('\n').map((l) => l.trim()).join('\n').trim() },
  { id: 'quotes', label: 'Straighten quotes', desc: '“smart” quotes become "plain" quotes', on: false, fn: (s) => s.replace(/[“”„]/g, '"').replace(/[‘’‚]/g, "'") },
  { id: 'allBreaks', label: 'Remove all line breaks', desc: 'Make everything one paragraph', on: false, fn: (s) => s.replace(/\s*\n+\s*/g, ' ') },
  { id: 'bullets', label: 'Remove bullets & numbering', desc: 'Strip •, -, *, 1. and a) from line starts', on: false, fn: (s) => s.replace(/^[ \t]*(?:[•\-*–▪◦●]|\d+[.)]|[a-zA-Z][.)])[ \t]+/gm, '') },
  { id: 'dedupe', label: 'Remove duplicate lines', desc: 'Keep only the first copy of repeated lines', on: false, fn: (s) => { const seen = new Set(); return s.split('\n').filter((l) => { const k = l.trim(); if (!k) return true; if (seen.has(k)) return false; seen.add(k); return true }).join('\n') } },
  { id: 'emoji', label: 'Remove emoji', desc: 'Strip emoji and pictographs', on: false, fn: (s) => s.replace(/[\p{Extended_Pictographic}‍️]/gu, '') },
]

const CASES = {
  none: (s) => s,
  sentence: (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
  lower: (s) => s.toLowerCase(),
  upper: (s) => s.toUpperCase(),
  title: (s) => s.toLowerCase().replace(/(^|\s|[-/(“"])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\s(A|An|The|And|But|Or|For|Nor|On|At|To|By|Of|In|With)(?=\s)/g, (m) => m.toLowerCase()),
}

export default function TextCleaner() {
  const [text, setText] = useState('')
  const [on, setOn] = useState(() => Object.fromEntries(OPS.map((o) => [o.id, o.on])))
  const [caseMode, setCaseMode] = useState('none')

  const out = useMemo(() => {
    let s = text
    for (const o of OPS) if (on[o.id]) s = o.fn(s)
    return CASES[caseMode](s)
  }, [text, on, caseMode])

  const saved = text.length - out.length

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="clean-grid">
          {OPS.map((o) => (
            <label key={o.id} className={`clean-opt ${on[o.id] ? 'on' : ''}`}>
              <input type="checkbox" checked={on[o.id]} onChange={(e) => setOn({ ...on, [o.id]: e.target.checked })} />
              <span><b>{o.label}</b><small>{o.desc}</small></span>
            </label>
          ))}
        </div>
        <div className="row">
          <span className="label">Change case</span>
          <div className="seg">
            {[['none', 'Keep'], ['sentence', 'Sentence case'], ['title', 'Title Case'], ['lower', 'lowercase'], ['upper', 'UPPERCASE']].map(([v, l]) => (
              <button key={v} className={caseMode === v ? 'on' : ''} onClick={() => setCaseMode(v)}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="split">
        <div className="field"><label>Messy text</label>
          <textarea className="textarea" style={{ minHeight: 340, fontFamily: 'var(--font)', fontSize: 14 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Paste text copied from a PDF, website or chat.\n\nExample: lines that are bro-\nken in the middle of sen-\ntences get joined back together.'} />
        </div>
        <div className="field"><label>Clean text {text && saved > 0 && <span className="caption">· removed {saved.toLocaleString()} characters</span>}</label>
          <textarea className="textarea" style={{ minHeight: 340, fontFamily: 'var(--font)', fontSize: 14 }} value={out} readOnly />
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={() => setText('')} disabled={!text}><RotateCcw size={16} /> Clear</button>
        <button className="btn" onClick={() => setText(out)} disabled={!text || out === text}><Eraser size={16} /> Clean again from result</button>
        <CopyButton className="btn primary" text={out} disabled={!out} label="Copy clean text" />
      </div>
    </div>
  )
}
