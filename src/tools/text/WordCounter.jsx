import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton.jsx'

const STOP = new Set('the a an and or but of to in on at for with is are was were be been it this that as by from i you he she we they not have has had do does did so if then than my your our their its his her them me us'.split(' '))

const cases = {
  UPPER: (s) => s.toUpperCase(),
  lower: (s) => s.toLowerCase(),
  'Title Case': (s) => s.toLowerCase().replace(/\b(\p{L})/gu, (m) => m.toUpperCase()),
  'Sentence case': (s) => s.toLowerCase().replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, (m) => m.toUpperCase()),
  'Trim spaces': (s) => s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim(),
}

const fmtTime = (min) => (min < 1 ? `${Math.max(1, Math.round(min * 60))} sec` : `${Math.round(min)} min`)

export default function WordCounter() {
  const [text, setText] = useState('')

  const s = useMemo(() => {
    const words = text.match(/[\p{L}\p{N}'’-]+/gu) || []
    const sentences = text.split(/[.!?]+(?:\s|$)/).filter((x) => x.trim()).length
    const paragraphs = text.split(/\n\s*\n/).filter((x) => x.trim()).length
    const freq = {}
    for (const w of words) {
      const k = w.toLowerCase()
      if (k.length > 2 && !STOP.has(k)) freq[k] = (freq[k] || 0) + 1
    }
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8)
    return {
      words: words.length,
      chars: [...text].length,
      noSpace: [...text.replace(/\s/g, '')].length,
      sentences,
      paragraphs,
      lines: text ? text.split('\n').length : 0,
      read: fmtTime(words.length / 238),
      speak: fmtTime(words.length / 150),
      top,
    }
  }, [text])

  return (
    <div className="stack">
      <div className="stats">
        <div className="stat"><span>Words</span><b>{s.words.toLocaleString()}</b></div>
        <div className="stat"><span>Characters</span><b>{s.chars.toLocaleString()}</b></div>
        <div className="stat"><span>No spaces</span><b>{s.noSpace.toLocaleString()}</b></div>
        <div className="stat"><span>Sentences</span><b>{s.sentences}</b></div>
        <div className="stat"><span>Paragraphs</span><b>{s.paragraphs}</b></div>
        <div className="stat"><span>Reading</span><b>{s.words ? s.read : '—'}</b></div>
        <div className="stat"><span>Speaking</span><b>{s.words ? s.speak : '—'}</b></div>
      </div>
      <textarea
        className="textarea"
        style={{ minHeight: 320, fontFamily: 'var(--font)', fontSize: 15 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Start typing or paste your text…"
      />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          {Object.entries(cases).map(([label, fn]) => (
            <button key={label} className="btn sm" disabled={!text} onClick={() => setText(fn(text))}>{label}</button>
          ))}
        </div>
        <div className="row">
          <button className="btn sm" disabled={!text} onClick={() => setText('')}>Clear</button>
          <CopyButton className="btn sm" text={text} disabled={!text} />
        </div>
      </div>
      {s.top.length > 0 && (
        <div className="panel stack">
          <span className="label">Most used words</span>
          <div className="row">
            {s.top.map(([w, n]) => <span key={w} className="chip" style={{ cursor: 'default' }}>{w} <b style={{ marginLeft: 4 }}>{n}</b></span>)}
          </div>
        </div>
      )}
    </div>
  )
}
