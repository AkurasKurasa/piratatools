import { useEffect, useMemo, useRef, useState } from 'react'
import { FileUp, Pause, Play, Square } from 'lucide-react'
import { openPdfjs, readBytes } from '../../lib/pdf.js'
import { load, save } from '../../lib/store.js'
import { toast } from '../../lib/toast.js'

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

function sentences(text) {
  const parts = text.match(/[^.!?\n]+[.!?]*[\s\n]*|\n+/g) || []
  let pos = 0
  return parts.map((p) => { const s = { text: p, start: pos }; pos += p.length; return s }).filter((s) => s.text.trim())
}

export default function ReadAloud() {
  const [text, setText] = useState(() => load('pirata-tts-text', ''))
  const [voices, setVoices] = useState([])
  const [voice, setVoice] = useState(() => load('pirata-tts-voice', ''))
  const [rate, setRate] = useState(() => load('pirata-tts-rate', 1))
  const [state, setState] = useState('idle') // idle | playing | paused
  const [cur, setCur] = useState(-1)
  const queue = useRef({ list: [], i: 0, stopped: true })

  useEffect(() => save('pirata-tts-text', text.slice(0, 50000)), [text])
  useEffect(() => { save('pirata-tts-voice', voice); save('pirata-tts-rate', rate) }, [voice, rate])

  useEffect(() => {
    if (!supported) return
    const load = () => {
      const v = speechSynthesis.getVoices()
      setVoices(v)
    }
    load()
    speechSynthesis.addEventListener('voiceschanged', load)
    return () => { speechSynthesis.removeEventListener('voiceschanged', load); speechSynthesis.cancel() }
  }, [])

  const sents = useMemo(() => sentences(text), [text])
  const sorted = useMemo(() => voices.slice().sort((a, b) => (a.lang.startsWith('en') ? -1 : 1) - (b.lang.startsWith('en') ? -1 : 1) || a.name.localeCompare(b.name)), [voices])

  const speakFrom = (i) => {
    speechSynthesis.cancel()
    queue.current = { list: sents, i, stopped: false }
    const next = () => {
      const q = queue.current
      if (q.stopped || q.i >= q.list.length) { setState('idle'); setCur(-1); return }
      const u = new SpeechSynthesisUtterance(q.list[q.i].text)
      const v = voices.find((x) => x.voiceURI === voice)
      if (v) { u.voice = v; u.lang = v.lang }
      u.rate = rate
      setCur(q.i)
      u.onend = () => { if (!q.stopped) { q.i++; next() } }
      u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') { toast('Speech stopped unexpectedly', 'error'); setState('idle') } }
      speechSynthesis.speak(u)
    }
    setState('playing')
    next()
  }

  const toggle = () => {
    if (state === 'idle') speakFrom(Math.max(0, cur))
    else if (state === 'playing') { speechSynthesis.pause(); setState('paused') }
    else { speechSynthesis.resume(); setState('playing') }
  }
  const stop = () => { queue.current.stopped = true; speechSynthesis.cancel(); setState('idle'); setCur(-1) }

  const importPdf = async (f) => {
    try {
      const doc = await openPdfjs(await readBytes(f))
      let out = ''
      for (let i = 1; i <= doc.numPages; i++) {
        const tc = await (await doc.getPage(i)).getTextContent()
        out += tc.items.map((it) => it.str + (it.hasEOL ? '\n' : '')).join('').replace(/-\n(\w)/g, '$1').replace(/([^\n.!?:])\n(?=[a-z])/g, '$1 ') + '\n\n'
      }
      if (!out.trim()) return toast("This PDF has no selectable text. It's probably a scan.", 'error')
      stop()
      setText(out.trim())
      toast(`Loaded ${doc.numPages} pages of text`)
    } catch {
      toast('Could not read that file.', 'error')
    }
  }

  if (!supported) return <div className="panel status">Your browser doesn't support text-to-speech. Try Chrome, Edge or Safari.</div>

  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const mins = words / (160 * rate)

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <button className="btn primary" style={{ height: 46, padding: '0 22px' }} onClick={toggle} disabled={!sents.length}>
              {state === 'playing' ? <Pause size={18} /> : <Play size={18} />} {state === 'playing' ? 'Pause' : state === 'paused' ? 'Resume' : cur > 0 ? 'Continue' : 'Read aloud'}
            </button>
            <button className="icon-btn" aria-label="Stop" onClick={stop} disabled={state === 'idle'}><Square size={16} /></button>
            <span className="caption">{words.toLocaleString()} words · ~{mins < 1 ? '<1' : Math.round(mins)} min</span>
          </div>
          <label className="btn sm" style={{ cursor: 'pointer' }}>
            <FileUp size={14} /> Load text from PDF or .txt
            <input type="file" hidden accept=".pdf,.txt,.md,application/pdf,text/plain" onChange={async (e) => {
              const f = e.target.files[0]
              e.target.value = ''
              if (!f) return
              if (f.name.toLowerCase().endsWith('.pdf')) importPdf(f)
              else { stop(); setText(await f.text()) }
            }} />
          </label>
        </div>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <div className="field" style={{ flex: 2, minWidth: 0 }}><label>Voice</label>
            <select className="select" value={voice} onChange={(e) => { setVoice(e.target.value); if (state !== 'idle') stop() }}>
              <option value="">Default</option>
              {sorted.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}><label>Speed <b>{rate.toFixed(2)}×</b></label>
            <input className="range" type="range" min="0.5" max="2" step="0.05" value={rate} onChange={(e) => setRate(+e.target.value)} onPointerUp={() => state === 'playing' && speakFrom(cur)} />
          </div>
        </div>
      </div>

      {state === 'idle' ? (
        <textarea className="textarea" style={{ minHeight: 360, fontFamily: 'var(--font)', fontSize: 16, lineHeight: 1.7 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your essay, a reading or your speech. Listening to your own writing is the fastest way to catch awkward sentences." />
      ) : (
        <div className="reader">
          {sents.map((s, i) => (
            <span key={s.start} className={i === cur ? 'on' : i < cur ? 'done' : ''} onClick={() => speakFrom(i)}>{s.text}</span>
          ))}
        </div>
      )}
      <span className="caption">While it's reading, click any sentence to jump to it. Voices come from your device, so more are available on Windows, macOS and Android.</span>
    </div>
  )
}
