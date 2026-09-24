import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Pencil, Plus, RotateCcw, Shuffle, Trash2, X } from 'lucide-react'
import { Segmented } from '../../components/ui.jsx'
import { load, save } from '../../lib/store.js'
import { toast } from '../../lib/toast.js'

const SAMPLE = `Mitochondria - Powerhouse of the cell; makes ATP through cellular respiration
Photosynthesis - Process plants use to turn light, water and CO2 into glucose and oxygen
Osmosis - Movement of water across a semipermeable membrane toward higher solute concentration
Enzyme - A protein that speeds up a chemical reaction without being used up`

function parse(text, sep) {
  const cards = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let i = -1
    let len = 0
    if (sep === 'auto') {
      for (const s of ['\t', ' - ', ' – ', ' — ', ': ', ' = ', ',']) {
        i = line.indexOf(s)
        if (i > 0) { len = s.length; break }
      }
    } else {
      const s = { tab: '\t', dash: ' - ', colon: ':', comma: ',' }[sep]
      i = line.indexOf(s)
      len = s.length
    }
    if (i <= 0) continue
    cards.push({ front: line.slice(0, i).trim(), back: line.slice(i + len).trim() })
  }
  return cards
}

const shuffleArr = (a) => {
  const b = a.slice()
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

export default function Flashcards() {
  const [decks, setDecks] = useState(() => load('pirata-decks', []))
  const [deckId, setDeckId] = useState(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [sep, setSep] = useState('auto')

  useEffect(() => save('pirata-decks', decks), [decks])

  const deck = decks.find((d) => d.id === deckId)
  const preview = useMemo(() => parse(text, sep), [text, sep])

  const startNew = () => { setDeckId(null); setName(''); setText(''); setEditing(true) }
  const edit = (d) => {
    setDeckId(d.id)
    setName(d.name)
    setText(d.cards.map((c) => `${c.front}\t${c.back}`).join('\n'))
    setSep('tab')
    setEditing(true)
  }
  const saveDeck = () => {
    if (!preview.length) return toast('Add at least one card (term, separator, definition).', 'error')
    const cards = preview.map((c, i) => ({ ...c, id: i, known: deck?.cards.find((o) => o.front === c.front)?.known || false }))
    if (deck) setDecks((ds) => ds.map((d) => (d.id === deck.id ? { ...d, name: name || d.name, cards } : d)))
    else {
      const id = Date.now()
      setDecks((ds) => [{ id, name: name || `Deck ${ds.length + 1}`, cards }, ...ds])
      setDeckId(id)
    }
    setEditing(false)
    toast(`Saved ${cards.length} cards`)
  }

  if (editing) {
    return (
      <div className="stack">
        <div className="panel stack">
          <div className="field"><label>Deck name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bio 101 · Cell structure" /></div>
          <div className="field">
            <label>Cards: one per line, <b>term</b> then separator then <b>definition</b></label>
            <textarea className="textarea" style={{ minHeight: 260, fontFamily: 'var(--font)' }} value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE} />
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row">
              <span className="label">Separator</span>
              <Segmented value={sep} onChange={setSep} options={[{ value: 'auto', label: 'Auto' }, { value: 'tab', label: 'Tab' }, { value: 'dash', label: ' - ' }, { value: 'colon', label: ':' }, { value: 'comma', label: ',' }]} />
            </div>
            <div className="row">
              {!text && <button className="btn sm ghost" onClick={() => setText(SAMPLE)}>Use sample</button>}
              <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn primary" onClick={saveDeck} disabled={!preview.length}><Check size={16} /> Save {preview.length} card{preview.length === 1 ? '' : 's'}</button>
            </div>
          </div>
          <span className="caption">Tip: copy two columns from Excel or Google Sheets and paste them here. They're tab-separated.</span>
        </div>
      </div>
    )
  }

  if (deck) return <Study deck={deck} onBack={() => setDeckId(null)} onEdit={() => edit(deck)} onUpdate={(cards) => setDecks((ds) => ds.map((d) => (d.id === deck.id ? { ...d, cards } : d)))} />

  return (
    <div className="stack">
      <div className="grid">
        <button className="deck-card new" onClick={startNew}>
          <Plus size={28} />
          <b>New deck</b>
          <span className="caption">Paste your notes and study in seconds</span>
        </button>
        {decks.map((d) => {
          const known = d.cards.filter((c) => c.known).length
          return (
            <div className="deck-card" key={d.id} onClick={() => setDeckId(d.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setDeckId(d.id)}>
              <b>{d.name}</b>
              <span className="caption">{d.cards.length} cards · {known} known</span>
              <div className="progress" style={{ height: 8 }}><div style={{ width: `${(known / d.cards.length) * 100}%`, animation: 'none' }} /></div>
              <div className="row" style={{ gap: 6 }} onClick={(e) => e.stopPropagation()}>
                <button className="btn sm" onClick={() => edit(d)}><Pencil size={13} /> Edit</button>
                <button className="btn sm ghost danger" onClick={() => setDecks((ds) => ds.filter((x) => x.id !== d.id))}><Trash2 size={13} /></button>
              </div>
            </div>
          )
        })}
      </div>
      {!decks.length && <p className="caption">Your decks are saved in this browser, so they'll be here next time.</p>}
    </div>
  )
}

function Study({ deck, onBack, onEdit, onUpdate }) {
  const [onlyUnknown, setOnlyUnknown] = useState(false)
  const [reverse, setReverse] = useState(false)
  const [order, setOrder] = useState(() => deck.cards.map((c) => c.id))
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const queue = useMemo(() => order.map((id) => deck.cards.find((c) => c.id === id)).filter((c) => c && (!onlyUnknown || !c.known)), [order, deck, onlyUnknown])
  const card = queue[Math.min(i, queue.length - 1)]
  const known = deck.cards.filter((c) => c.known).length

  const go = useCallback((d) => { setFlipped(false); setI((x) => Math.max(0, Math.min(queue.length - 1, x + d))) }, [queue.length])
  const mark = useCallback((k) => {
    if (!card) return
    onUpdate(deck.cards.map((c) => (c.id === card.id ? { ...c, known: k } : c)))
    setFlipped(false)
    if (!(onlyUnknown && k)) setI((x) => Math.min(queue.length - 1, x + 1))
  }, [card, deck, onUpdate, onlyUnknown, queue.length])

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
      if (e.code === 'Space') { e.preventDefault(); setFlipped((f) => !f) }
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === '1') mark(false)
      if (e.key === '2') mark(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, mark])

  return (
    <div className="stack">
      <div className="panel row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <button className="btn sm ghost" onClick={onBack}><ArrowLeft size={14} /> Decks</button>
          <b>{deck.name}</b>
          <span className="caption">{known}/{deck.cards.length} known</span>
        </div>
        <div className="row">
          <label className="checkbox"><input type="checkbox" checked={onlyUnknown} onChange={(e) => { setOnlyUnknown(e.target.checked); setI(0); setFlipped(false) }} /> Only still learning</label>
          <label className="checkbox"><input type="checkbox" checked={reverse} onChange={(e) => { setReverse(e.target.checked); setFlipped(false) }} /> Definition first</label>
          <button className="btn sm" onClick={() => { setOrder(shuffleArr(order)); setI(0); setFlipped(false) }}><Shuffle size={14} /> Shuffle</button>
          <button className="btn sm" onClick={onEdit}><Pencil size={14} /> Edit</button>
        </div>
      </div>

      {card ? (
        <>
          <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0} aria-label="Flip card">
            <div className="fc-inner">
              <div className="fc-face front">
                <span className="fc-tag">{reverse ? 'Definition' : 'Term'}</span>
                <div className="fc-text big">{reverse ? card.back : card.front}</div>
                <span className="caption">Click or press Space to flip</span>
              </div>
              <div className="fc-face back">
                <span className="fc-tag">{reverse ? 'Term' : 'Definition'}</span>
                <div className="fc-text">{reverse ? card.front : card.back}</div>
                {card.known && <span className="caption"><Check size={12} /> You marked this as known</span>}
              </div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="icon-btn" aria-label="Previous" onClick={() => go(-1)} disabled={i === 0}><ArrowLeft size={18} /></button>
            <div className="row">
              <button className="btn" onClick={() => mark(false)}><X size={16} /> Still learning <kbd>1</kbd></button>
              <button className="btn primary" onClick={() => mark(true)}><Check size={16} /> Got it <kbd>2</kbd></button>
            </div>
            <button className="icon-btn" aria-label="Next" onClick={() => go(1)} disabled={i >= queue.length - 1}><ArrowRight size={18} /></button>
          </div>
          <div className="caption" style={{ textAlign: 'center' }}>Card {Math.min(i, queue.length - 1) + 1} of {queue.length}</div>
        </>
      ) : (
        <div className="empty-state">
          <div className="illo"><Check size={32} /></div>
          <h3>You know them all!</h3>
          <p>Every card in this deck is marked as known.</p>
          <button className="btn" onClick={() => { onUpdate(deck.cards.map((c) => ({ ...c, known: false }))); setI(0) }}><RotateCcw size={16} /> Reset progress</button>
        </div>
      )}
    </div>
  )
}
