import { useMemo, useState } from 'react'
import { Info, RotateCcw, ScanText } from 'lucide-react'
import { Progress } from '../../components/ui.jsx'
import { MODEL_SIZE, runAi, sentences, wordCount } from '../../lib/ai.js'
import { analyze, KINDS, topTips } from '../../lib/aiPhrases.js'

const MIN_WORDS = 50

/** Groups sentences into sections of roughly 120–350 words, the range the model reads well. */
function chunk(text) {
  const out = []
  let cur = null
  for (const s of sentences(text)) {
    const w = wordCount(s.text)
    if (cur && (cur.words + w > 350 || (cur.words >= 120 && /\n\s*\n\s*$/.test(cur.text)) || cur.words >= 220)) {
      out.push(cur)
      cur = null
    }
    cur = cur ? { ...cur, text: cur.text + s.text, words: cur.words + w } : { text: s.text, start: s.start, words: w }
  }
  if (cur) {
    const prev = out.at(-1)
    if (prev && cur.words < 40 && prev.words + cur.words <= 380) out[out.length - 1] = { ...prev, text: prev.text + cur.text, words: prev.words + cur.words }
    else out.push(cur)
  }
  return out.map((c) => ({ ...c, end: c.start + c.text.length }))
}

const band = (p) => (p >= 0.75 ? 'ai' : p <= 0.35 ? 'human' : 'mixed')

const VERDICT = {
  ai: { title: 'Likely AI-written', body: 'Most of this reads like text from an AI model.' },
  mixed: { title: 'Unclear', body: 'Some parts read like AI text and some don\'t, or the signal is weak.' },
  human: { title: 'Likely human-written', body: 'This mostly reads like something a person wrote.' },
}

const RHYTHM_TIP = 'Several sentences in a row are about the same length. Mix short and long ones.'

export default function AiDetector() {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [hidden, setHidden] = useState({})
  const words = useMemo(() => wordCount(text), [text])
  const { marks, rhythm, variety, dashes } = useMemo(() => analyze(text), [text])

  const edit = (value) => { setText(value); setResult(null) }

  const check = async () => {
    setBusy(true)
    setError('')
    setResult(null)
    setProgress(0)
    setPhase('Loading the detector…')
    const chunks = chunk(text)
    try {
      const scores = await runAi('detect', { chunks: chunks.map((c) => c.text.trim()) }, (e) => {
        if (e.type === 'progress') { setPhase(`Downloading the detector (${MODEL_SIZE.detect}, first time only)…`); setProgress(e.value) }
        if (e.type === 'step') { setPhase('Reading your text…'); setProgress(e.value) }
      })
      const sections = chunks.map((c, i) => ({ ...c, score: scores[i] }))
      const total = sections.reduce((a, s) => a + s.words, 0)
      const overall = sections.reduce((a, s) => a + s.score * s.words, 0) / total
      setResult({ sections, overall })
    } catch (e) {
      console.error(e)
      setError('The detector couldn\'t run. Check your connection for the first download, then try again.')
    } finally {
      setBusy(false)
      setPhase('')
    }
  }

  const counts = { ...Object.fromEntries(Object.keys(KINDS).map((k) => [k, marks.filter((m) => m.kind === k).length])), rhythm: rhythm.length }
  const tips = topTips(text, marks)
  const verdict = result && VERDICT[band(result.overall)]
  const flagged = result?.sections.filter((s) => band(s.score) === 'ai').length ?? 0

  // Cut the text at every highlight edge, then style each piece by what covers it:
  // the detector's section shading, a phrase highlight, and the sentence-rhythm underline.
  const shown = marks.filter((m) => !hidden[m.kind])
  const runs = hidden.rhythm ? [] : rhythm
  const sections = result?.sections ?? []
  const edges = [...shown, ...runs, ...sections].flatMap((r) => [r.start, r.end])
  const cuts = [...new Set([0, text.length, ...edges])].sort((a, b) => a - b)
  const pieces = []
  for (let i = 0; i < cuts.length - 1; i++) {
    const [a, b] = [cuts[i], cuts[i + 1]]
    const covers = (r) => r.start <= a && r.end >= b
    const m = shown.find(covers)
    const sec = sections.find(covers)
    let node = text.slice(a, b)
    if (m) node = <mark className="ai-mark" style={{ '--c': KINDS[m.kind].color }} title={m.tip}>{node}</mark>
    if (runs.some(covers)) node = <span className="ai-rhythm" title={RHYTHM_TIP}>{node}</span>
    pieces.push(<span key={a} className={sec ? `ai-sec ${band(sec.score)}` : undefined}>{node}</span>)
  }

  return (
    <div className="stack">
      <div className="split">
        <div className="field"><label>Your text</label>
          <textarea
            className="textarea"
            style={{ minHeight: 380, fontFamily: 'var(--font)', fontSize: 15 }}
            value={text}
            onChange={(e) => edit(e.target.value)}
            placeholder="Paste an essay, a reflection paper or a group mate's section. Phrases that sound AI-generated are highlighted as you type. Check for AI runs the full detector."
          />
          <span className="caption">{words.toLocaleString()} words{words > 0 && words < MIN_WORDS && ` · the detector needs ${MIN_WORDS - words} more`}</span>
        </div>
        <div className="field"><label>Highlighted</label>
          <div className="reader ai-reader" style={{ minHeight: 380, fontSize: 15, padding: 16 }}>
            {text ? pieces : <span className="caption">Highlights appear here as you type.</span>}
          </div>
        </div>
      </div>

      {busy && <div className="panel stack"><span className="status">{phase}</span><Progress value={progress} /></div>}
      {error && <div className="error">{error}</div>}

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={() => edit('')} disabled={!text || busy}><RotateCcw size={16} /> Clear</button>
        <button className="btn primary" onClick={check} disabled={busy || words < MIN_WORDS}>
          {busy ? <span className="spinner" /> : <ScanText size={16} />} Check for AI
        </button>
      </div>

      {result && (
        <div className={`panel ai-verdict ${band(result.overall)}`}>
          <h2>{verdict.title}</h2>
          <p>
            {verdict.body}
            {result.sections.length > 1 && ` ${flagged} of ${result.sections.length} sections were flagged.`}
          </p>
          <div className="ai-legend">
            <span><i className="ai" /> Reads like AI</span>
            <span><i className="mixed" /> Unclear</span>
            <span><i className="human" /> Reads like a person</span>
          </div>
        </div>
      )}

      {text && (
        <div className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>What makes it sound like AI</h3>
            <span className="caption">Hover a highlight for a tip</span>
          </div>
          <div className="chips">
            {Object.entries(KINDS).map(([k, v]) => (
              <button key={k} className={`chip ${hidden[k] ? '' : 'active'}`} style={{ '--c': v.color }} onClick={() => setHidden({ ...hidden, [k]: !hidden[k] })} aria-pressed={!hidden[k]}>
                <i /> {v.label} <small>{counts[k]}</small>
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 24 }}>
            {variety !== null && (
              <span className="status">
                Sentence variety: <b>{variety < 0.35 ? 'low' : variety < 0.55 ? 'medium' : 'high'}</b>
                {variety < 0.35 && ' · people usually mix short and long sentences more'}
              </span>
            )}
            {dashes >= 3 && <span className="status">Em dashes (—): <b>{dashes}</b> · consider commas or periods for some</span>}
          </div>
          {tips.length > 0 && (
            <table className="ai-tips">
              <tbody>
                {tips.map((t) => <tr key={t.text}><td><b>{t.text}</b>{t.n > 1 && <small> ×{t.n}</small>}</td><td>{t.tip}</td></tr>)}
              </tbody>
            </table>
          )}
          {marks.length === 0 && rhythm.length === 0 && <span className="status">No common AI phrases found. That doesn't prove who wrote it.</span>}
        </div>
      )}

      <div className="ai-note">
        <Info size={16} />
        <span>
          AI detectors make mistakes, especially on short text, very formal writing and writing by non-native English speakers.
          The highlights are common signs, not proof. People use these words too.
          Treat the result as a hint, never as the only basis for accusing someone, and use the highlights to revise in your own voice.
          The detector model ({MODEL_SIZE.detect}) downloads once and runs on your device. Your text never leaves it.
        </span>
      </div>
    </div>
  )
}
