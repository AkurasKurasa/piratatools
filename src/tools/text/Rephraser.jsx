import { useRef, useState } from 'react'
import { Info, PenLine, RotateCcw, Square } from 'lucide-react'
import CopyButton from '../../components/CopyButton.jsx'
import { Progress, Segmented } from '../../components/ui.jsx'
import { MODEL_SIZE, runAi, sentences, stopAi, wordCount } from '../../lib/ai.js'

const STYLES = [
  { value: 'clear', label: 'Clearer', instruction: 'Rephrase in clear, natural wording:' },
  { value: 'simple', label: 'Simpler', instruction: 'Rewrite in simple words that are easy to read:' },
  { value: 'formal', label: 'Formal', instruction: 'Rewrite in a formal, academic tone:' },
  { value: 'short', label: 'Shorter', instruction: 'Rewrite more concisely, keeping every key point:' },
]

/** Paragraphs, each split into pieces of about 60 words. Small models stay accurate on short input. */
function pieces(text) {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((para) => {
    const out = []
    for (const s of sentences(para)) {
      const last = out.at(-1)
      if (last && wordCount(last) + wordCount(s.text) <= 60) out[out.length - 1] = last + s.text
      else out.push(s.text)
    }
    return out.map((p) => p.trim())
  })
}

const MAX_WORDS = 1500

export default function Rephraser() {
  const [text, setText] = useState('')
  const [out, setOut] = useState('')
  const [style, setStyle] = useState('clear')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('')
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const stopped = useRef(false)
  const words = wordCount(text)

  const rephrase = async () => {
    stopped.current = false
    setBusy(true)
    setError('')
    setOut('')
    setPhase('Loading the writing model…')
    setProgress(null)
    const { instruction } = STYLES.find((s) => s.value === style)
    const paras = pieces(text)
    const total = paras.flat().length
    const done = paras.map(() => [])
    const render = () => done.map((p) => p.join(' ')).filter(Boolean).join('\n\n')
    let n = 0
    try {
      outer: for (const [pi, para] of paras.entries()) {
        for (const piece of para) {
          n++
          const live = done[pi].length
          const result = await runAi('rephrase', { text: piece, instruction }, (e) => {
            if (e.type === 'progress') { setPhase(`Downloading the writing model (${MODEL_SIZE.rephrase}, first time only)…`); setProgress(e.value) }
            if (e.type === 'token') {
              setPhase(total > 1 ? `Rewriting part ${n} of ${total}…` : 'Rewriting…')
              setProgress(null)
              done[pi][live] = (done[pi][live] ?? '') + e.value
              setOut(render())
            }
          })
          done[pi][live] = result
          setOut(render())
          if (stopped.current) break outer
        }
      }
    } catch (e) {
      console.error(e)
      setError('The writing model couldn\'t run. Check your connection for the first download, then try again.')
    } finally {
      setBusy(false)
      setPhase('')
    }
  }

  const stop = () => { stopped.current = true; stopAi() }

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="field"><label>Style</label><Segmented value={style} onChange={setStyle} options={STYLES} /></div>
        {busy && <><span className="status">{phase}</span>{progress !== null && <Progress value={progress} />}</>}
        {error && <div className="error">{error}</div>}
      </div>

      <div className="split">
        <div className="field"><label>Your text</label>
          <textarea className="textarea" style={{ minHeight: 340, fontFamily: 'var(--font)', fontSize: 15 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a sentence or a few paragraphs you want to say differently." />
          <span className="caption">{words.toLocaleString()} / {MAX_WORDS.toLocaleString()} words</span>
        </div>
        <div className="field"><label>Rephrased</label>
          <textarea className="textarea" style={{ minHeight: 340, fontFamily: 'var(--font)', fontSize: 15 }} value={out} onChange={(e) => setOut(e.target.value)} placeholder="The new version appears here. You can edit it before copying." />
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={() => { setText(''); setOut('') }} disabled={busy || (!text && !out)}><RotateCcw size={16} /> Clear</button>
        {busy
          ? <button className="btn" onClick={stop}><Square size={16} /> Stop</button>
          : <button className="btn primary" onClick={rephrase} disabled={!words || words > MAX_WORDS}><PenLine size={16} /> Rephrase</button>}
        <CopyButton className="btn" text={out} disabled={!out || busy} label="Copy" />
      </div>

      <div className="ai-note">
        <Info size={16} />
        <span>
          A small writing model ({MODEL_SIZE.rephrase}) downloads once and runs on your device, so your text never leaves it.
          It's fastest in Chrome or Edge on a laptop. Always reread the result: small models sometimes change the meaning or drop details.
          If you use it for schoolwork, follow your class's rules on AI tools.
        </span>
      </div>
    </div>
  )
}
