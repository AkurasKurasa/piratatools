import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Copy, Globe, Newspaper, Plus, Trash2, X } from 'lucide-react'
import { Segmented } from '../../components/ui.jsx'
import { load, save } from '../../lib/store.js'
import { toast } from '../../lib/toast.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MLA_MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']

const emptyAuthor = () => ({ first: '', middle: '', last: '' })
const emptySource = (type = 'website') => ({
  type, authors: [emptyAuthor()], org: '', title: '', container: '', publisher: '', year: '', month: '', day: '',
  url: '', accessed: new Date().toISOString().slice(0, 10), volume: '', issue: '', pages: '', doi: '', edition: '', city: '',
})

const initials = (a) => [a.first, a.middle].filter(Boolean).flatMap((n) => n.trim().split(/[\s-]+/)).filter(Boolean).map((n) => `${n[0].toUpperCase()}.`).join(' ')
const clean = (a) => ({ first: a.first.trim(), middle: a.middle.trim(), last: a.last.trim() })
const end = (s, ch = '.') => (s && !/[.?!]$/.test(s) ? s + ch : s)
const doiUrl = (d) => (d ? (d.startsWith('http') ? d : `https://doi.org/${d.replace(/^doi:\s*/i, '')}`) : '')

/* A citation is a list of segments: [text, italic?] */
function apa(s) {
  const out = []
  const authors = s.authors.map(clean).filter((a) => a.last)
  const names = authors.map((a) => `${a.last}, ${initials(a)}`.replace(/, $/, ''))
  let who = ''
  if (names.length === 1) who = names[0]
  else if (names.length === 2) who = `${names[0]}, & ${names[1]}`
  else if (names.length > 2 && names.length <= 20) who = `${names.slice(0, -1).join(', ')}, & ${names.at(-1)}`
  else if (names.length > 20) who = `${names.slice(0, 19).join(', ')}, . . . ${names.at(-1)}`
  if (!who && s.org) who = s.org
  const date = s.year ? (s.type === 'website' && s.month ? `${s.year}, ${MONTHS[s.month - 1]}${s.day ? ` ${s.day}` : ''}` : s.year) : 'n.d.'
  const titleItalic = s.type !== 'journal'
  if (who) {
    out.push([`${end(who)} (${date}). `])
    out.push([end(s.title || 'Untitled'), titleItalic])
  } else {
    out.push([end(s.title || 'Untitled'), titleItalic])
    out.push([` (${date}).`])
  }
  if (s.type === 'book' && s.edition) {
    const ti = out.findIndex((x) => x[1])
    out[ti] = [out[ti][0].replace(/\.$/, ''), true]
    out.splice(ti + 1, 0, [` (${s.edition} ed.)${who ? '.' : ''}`])
  }
  if (s.type === 'website') {
    if (s.container && s.container !== who) out.push([` ${end(s.container)}`])
    if (s.url) out.push([` ${s.url}`])
  } else if (s.type === 'book') {
    if (s.publisher && s.publisher !== who) out.push([` ${end(s.publisher)}`])
    if (s.doi || s.url) out.push([` ${doiUrl(s.doi) || s.url}`])
  } else {
    if (s.container) {
      out.push([' '])
      out.push([s.container, true])
      if (s.volume) { out.push([', ']); out.push([s.volume, true]) }
      if (s.issue) out.push([`(${s.issue})`])
      if (s.pages) out.push([`, ${s.pages.replace(/-/g, '–')}`])
      out.push(['.'])
    }
    if (s.doi || s.url) out.push([` ${doiUrl(s.doi) || s.url}`])
  }
  return out
}

function mlaNames(authors) {
  const a = authors.map(clean).filter((x) => x.last)
  const full = (x) => [x.first, x.middle, x.last].filter(Boolean).join(' ')
  const inv = (x) => `${x.last}${x.first ? `, ${[x.first, x.middle].filter(Boolean).join(' ')}` : ''}`
  if (a.length === 1) return inv(a[0])
  if (a.length === 2) return `${inv(a[0])}, and ${full(a[1])}`
  if (a.length > 2) return `${inv(a[0])}, et al`
  return ''
}

function mla(s) {
  const out = []
  const who = mlaNames(s.authors) || (s.type === 'website' ? '' : s.org)
  if (who) out.push([`${end(who)} `])
  const date = [s.day, s.month ? MLA_MONTHS[s.month - 1] : '', s.year].filter(Boolean).join(' ')
  if (s.type === 'book') {
    out.push([end(s.title || 'Untitled'), true])
    if (s.edition) out.push([` ${s.edition} ed.,`])
    const tail = [s.publisher, s.year].filter(Boolean).join(', ')
    if (tail) out.push([` ${end(tail)}`])
  } else {
    out.push([`“${end(s.title || 'Untitled')}” `])
    if (s.container) { out.push([s.container, true]); out.push([', ']) }
    if (s.type === 'journal') {
      const bits = [s.volume && `vol. ${s.volume}`, s.issue && `no. ${s.issue}`, s.year, s.pages && `pp. ${s.pages.replace(/-/g, '–')}`].filter(Boolean)
      out.push([bits.join(', ')])
      const link = s.doi ? doiUrl(s.doi) : s.url
      out.push([link ? `, ${link.replace(/^https?:\/\//, '')}.` : '.'])
    } else {
      const bits = [s.publisher && s.publisher !== s.container ? s.publisher : '', date, s.url.replace(/^https?:\/\//, '')].filter(Boolean)
      out.push([`${bits.join(', ')}.`])
      if (s.accessed) {
        const [y, m, d] = s.accessed.split('-').map(Number)
        out.push([` Accessed ${d} ${MLA_MONTHS[m - 1]} ${y}.`])
      }
    }
  }
  return out.map(([t, i]) => [t.replace(/, \./g, '.').replace(/\s+/g, ' '), i])
}

function chicago(s) {
  const out = []
  const a = s.authors.map(clean).filter((x) => x.last)
  const full = (x) => [x.first, x.middle, x.last].filter(Boolean).join(' ')
  let who = ''
  if (a.length) {
    const first = `${a[0].last}${a[0].first ? `, ${[a[0].first, a[0].middle].filter(Boolean).join(' ')}` : ''}`
    const rest = a.slice(1).map(full)
    who = a.length > 10 ? `${[first, ...a.slice(1, 7).map(full)].join(', ')}, et al` : rest.length ? `${first}, ${rest.length > 1 ? `${rest.slice(0, -1).join(', ')}, ` : ''}and ${rest.at(-1)}`.replace(', , ', ', ') : first
  } else if (s.org) who = s.org
  if (who) out.push([`${end(who)} `])
  if (s.type === 'book') {
    out.push([end(s.title || 'Untitled'), true])
    if (s.edition) out.push([` ${s.edition} ed.`])
    const pub = [s.city && s.publisher ? `${s.city}: ${s.publisher}` : s.publisher, s.year].filter(Boolean).join(', ')
    if (pub) out.push([` ${end(pub)}`])
    if (s.doi || s.url) out.push([` ${doiUrl(s.doi) || s.url}.`])
  } else if (s.type === 'journal') {
    out.push([`“${end(s.title || 'Untitled')}” `])
    if (s.container) out.push([s.container, true])
    out.push([`${s.volume ? ` ${s.volume}` : ''}${s.issue ? `, no. ${s.issue}` : ''}${s.year ? ` (${s.year})` : ''}${s.pages ? `: ${s.pages.replace(/-/g, '–')}` : ''}.`])
    if (s.doi || s.url) out.push([` ${doiUrl(s.doi) || s.url}.`])
  } else {
    out.push([`“${end(s.title || 'Untitled')}” `])
    if (s.container) out.push([`${end(s.container)} `])
    if (s.year) out.push([`${s.month ? `${MONTHS[s.month - 1]} ${s.day ? `${s.day}, ` : ''}` : ''}${s.year}. `])
    else if (s.accessed) {
      const [y, m, d] = s.accessed.split('-').map(Number)
      out.push([`Accessed ${MONTHS[m - 1]} ${d}, ${y}. `])
    }
    if (s.url) out.push([`${s.url}.`])
  }
  return out.map(([t, i]) => [t.replace(/\s+/g, ' '), i])
}

const STYLES = { apa: { label: 'APA 7', fn: apa }, mla: { label: 'MLA 9', fn: mla }, chicago: { label: 'Chicago 17', fn: chicago } }

const toText = (segs) => segs.map(([t]) => t).join('').trim()
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const toHtml = (segs) => segs.map(([t, i]) => (i ? `<i>${esc(t)}</i>` : esc(t))).join('').trim()

async function copyRich(html, text) {
  try {
    if (window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([`<div style="font-family:'Times New Roman';font-size:12pt">${html}</div>`], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })])
    } else await navigator.clipboard.writeText(text)
    return true
  } catch {
    try { await navigator.clipboard.writeText(text); return true } catch { return false }
  }
}

function Cite({ segs }) {
  return <>{segs.map(([t, i], k) => (i ? <i key={k}>{t}</i> : <span key={k}>{t}</span>))}</>
}

export default function CitationGenerator() {
  const [style, setStyle] = useState(() => load('pirata-cite-style', 'apa'))
  const [src, setSrc] = useState(emptySource())
  const [list, setList] = useState(() => load('pirata-cite-list', []))

  useEffect(() => save('pirata-cite-list', list), [list])
  useEffect(() => save('pirata-cite-style', style), [style])

  const set = (k, v) => setSrc((s) => ({ ...s, [k]: v }))
  const setAuthor = (i, k, v) => setSrc((s) => ({ ...s, authors: s.authors.map((a, j) => (j === i ? { ...a, [k]: v } : a)) }))
  const segs = useMemo(() => STYLES[style].fn(src), [style, src])

  const sorted = useMemo(() => list
    .map((s) => ({ s, segs: STYLES[style].fn(s) }))
    .sort((a, b) => toText(a.segs).localeCompare(toText(b.segs), undefined, { sensitivity: 'base' })), [list, style])

  const copyOne = async (sg) => { if (await copyRich(toHtml(sg), toText(sg))) toast('Citation copied, italics included') }
  const copyAll = async () => {
    const html = sorted.map((x) => `<p style="padding-left:0.5in;text-indent:-0.5in;margin:0 0 12pt">${toHtml(x.segs)}</p>`).join('')
    if (await copyRich(html, sorted.map((x) => toText(x.segs)).join('\n\n'))) toast(`Copied ${sorted.length} references`)
  }
  const add = () => {
    if (!src.title.trim()) return toast('Add at least a title first.', 'error')
    setList((l) => [...l, { ...src, id: Date.now() }])
    setSrc(emptySource(src.type))
    toast('Added to your reference list')
  }

  const isWeb = src.type === 'website'
  const isJournal = src.type === 'journal'
  const isBook = src.type === 'book'

  return (
    <div className="stack">
      <div className="panel row" style={{ justifyContent: 'space-between' }}>
        <Segmented value={style} onChange={setStyle} options={Object.entries(STYLES).map(([value, s]) => ({ value, label: s.label }))} />
        <Segmented
          value={src.type}
          onChange={(t) => set('type', t)}
          options={[
            { value: 'website', label: <><Globe size={14} style={{ verticalAlign: -2 }} /> Website</> },
            { value: 'book', label: <><BookOpen size={14} style={{ verticalAlign: -2 }} /> Book</> },
            { value: 'journal', label: <><Newspaper size={14} style={{ verticalAlign: -2 }} /> Journal</> },
          ]}
        />
      </div>

      <div className="split">
        <div className="panel stack">
          <div className="field">
            <label>Authors</label>
            {src.authors.map((a, i) => (
              <div className="row" key={i} style={{ flexWrap: 'nowrap', gap: 6 }}>
                <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="First" value={a.first} onChange={(e) => setAuthor(i, 'first', e.target.value)} />
                <input className="input" style={{ width: 64 }} placeholder="M.I." value={a.middle} onChange={(e) => setAuthor(i, 'middle', e.target.value)} />
                <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Last" value={a.last} onChange={(e) => setAuthor(i, 'last', e.target.value)} />
                <button className="mini-btn" aria-label="Remove author" disabled={src.authors.length === 1} onClick={() => set('authors', src.authors.filter((_, j) => j !== i))}><X size={14} /></button>
              </div>
            ))}
            <div className="row">
              <button className="btn sm ghost" onClick={() => set('authors', [...src.authors, emptyAuthor()])}><Plus size={14} /> Add author</button>
              <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="…or organization (e.g. World Health Organization)" value={src.org} onChange={(e) => set('org', e.target.value)} />
            </div>
          </div>
          <div className="field"><label>{isWeb ? 'Page title' : isBook ? 'Book title' : 'Article title'}</label>
            <input className="input" value={src.title} onChange={(e) => set('title', e.target.value)} placeholder={style === 'apa' ? 'Use sentence case: Only the first word capitalized' : 'Title As It Appears'} />
          </div>
          {!isBook && <div className="field"><label>{isWeb ? 'Website name' : 'Journal name'}</label><input className="input" value={src.container} onChange={(e) => set('container', e.target.value)} /></div>}
          {isJournal && (
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <div className="field" style={{ flex: 1 }}><label>Volume</label><input className="input" value={src.volume} onChange={(e) => set('volume', e.target.value)} /></div>
              <div className="field" style={{ flex: 1 }}><label>Issue</label><input className="input" value={src.issue} onChange={(e) => set('issue', e.target.value)} /></div>
              <div className="field" style={{ flex: 1 }}><label>Pages</label><input className="input" value={src.pages} onChange={(e) => set('pages', e.target.value)} placeholder="12-30" /></div>
            </div>
          )}
          {isBook && (
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <div className="field" style={{ flex: 2 }}><label>Publisher</label><input className="input" value={src.publisher} onChange={(e) => set('publisher', e.target.value)} /></div>
              <div className="field" style={{ flex: 1 }}><label>Edition</label><input className="input" value={src.edition} onChange={(e) => set('edition', e.target.value)} placeholder="2nd" /></div>
              {style === 'chicago' && <div className="field" style={{ flex: 1 }}><label>City</label><input className="input" value={src.city} onChange={(e) => set('city', e.target.value)} /></div>}
            </div>
          )}
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <div className="field" style={{ flex: 1 }}><label>Year</label><input className="input" value={src.year} onChange={(e) => set('year', e.target.value)} placeholder="2025" /></div>
            {isWeb && (
              <>
                <div className="field" style={{ flex: 1.3 }}><label>Month</label>
                  <select className="select" value={src.month} onChange={(e) => set('month', e.target.value)}>
                    <option value="">—</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="field" style={{ flex: 0.8 }}><label>Day</label><input className="input" value={src.day} onChange={(e) => set('day', e.target.value)} /></div>
              </>
            )}
          </div>
          {!isWeb && <div className="field"><label>DOI (optional)</label><input className="input mono" value={src.doi} onChange={(e) => set('doi', e.target.value)} placeholder="10.1000/xyz123" /></div>}
          <div className="field"><label>URL {isWeb ? '' : '(optional)'}</label><input className="input mono" value={src.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" /></div>
          {isWeb && style !== 'apa' && <div className="field"><label>Date accessed</label><input className="input" type="date" value={src.accessed} onChange={(e) => set('accessed', e.target.value)} /></div>}
        </div>

        <div className="stack">
          <div className="panel stack" style={{ position: 'sticky', top: 84 }}>
            <span className="label">Preview · {STYLES[style].label}</span>
            <p className="citation">{src.title ? <Cite segs={segs} /> : <span className="caption">Start typing and your citation appears here.</span>}</p>
            <div className="row">
              <button className="btn" disabled={!src.title} onClick={() => copyOne(segs)}><Copy size={15} /> Copy</button>
              <button className="btn primary" onClick={add}><Plus size={15} /> Add to list</button>
            </div>
          </div>
        </div>
      </div>

      {list.length > 0 && (
        <div className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{style === 'apa' ? 'References' : style === 'mla' ? 'Works Cited' : 'Bibliography'} <span className="caption">({list.length})</span></b>
            <div className="row">
              <button className="btn sm ghost danger" onClick={() => setList([])}><Trash2 size={14} /> Clear</button>
              <button className="btn sm primary" onClick={copyAll}><Copy size={14} /> Copy all</button>
            </div>
          </div>
          {sorted.map(({ s, segs: sg }) => (
            <div key={s.id} className="ref-item">
              <p className="citation"><Cite segs={sg} /></p>
              <button className="mini-btn" aria-label="Copy" onClick={() => copyOne(sg)}><Copy size={14} /></button>
              <button className="mini-btn" aria-label="Remove" onClick={() => setList((l) => l.filter((x) => x.id !== s.id))}><X size={14} /></button>
            </div>
          ))}
          <span className="caption">Sorted alphabetically. "Copy all" keeps the italics and hanging indents when you paste into Word or Google Docs.</span>
        </div>
      )}
      <p className="caption">Always double-check against your instructor's guidelines, especially capitalization in APA titles.</p>
    </div>
  )
}
