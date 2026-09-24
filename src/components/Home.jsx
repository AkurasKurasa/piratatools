import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Search, SearchX, Zap } from 'lucide-react'
import { categories, categoryById, studentTasks, toolById, tools } from '../tools/registry.js'
import { matches } from './CommandPalette.jsx'
import { clearRecent, getRecent } from '../lib/recent.js'

function Highlight({ text, q }) {
  const words = q.trim().split(/\s+/).filter((w) => w.length > 1)
  if (!words.length) return text
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig')
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))
}

export function ToolCard({ tool, q = '', index = 0 }) {
  const cat = categoryById[tool.category]
  const Icon = tool.icon
  return (
    <Link to={`/tools/${tool.id}`} className="card" style={{ '--c': cat.color, '--i': index }}>
      <div className="card-top">
        <div className="card-icon"><Icon size={22} strokeWidth={2} /></div>
        <span className="card-arrow"><ArrowUpRight size={18} /></span>
      </div>
      <div>
        <h3><Highlight text={tool.name} q={q} /></h3>
        <p><Highlight text={tool.description} q={q} /></p>
      </div>
      {tool.uses && <div className="uses">{tool.uses.map((u) => <span key={u}>{u}</span>)}</div>}
    </Link>
  )
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState('all')
  const [recent, setRecent] = useState(() => getRecent().map((id) => toolById[id]).filter(Boolean))
  const inputRef = useRef(null)

  useEffect(() => {
    document.title = 'Pirata: free tools for students'
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const q = query.trim()
  const filtered = useMemo(
    () => tools.filter((t) => (active === 'all' || t.category === active) && matches(t, q)),
    [q, active],
  )

  let idx = 0

  return (
    <>
      <section className="hero">
        <div className="hero-kicker"><i /> Built for students · free forever</div>
        <h1>
          Every tool your <span className="hl">schoolwork</span> needs, <span className="serif">in one tab.</span>
        </h1>
        <div className="hero-bottom">
          <p className="lede">
            Merge readings, shrink scans for the LMS, turn notes into PDFs, make QR codes for your org.
            Everything runs in your browser, so your files never leave your device.
          </p>
          <div className="hero-proof">
            <div><b>{tools.length}</b><span>tools</span></div>
            <div><b>0</b><span>sign-ups</span></div>
            <div><b>0</b><span>uploads</span></div>
          </div>
        </div>

        <div className="search">
          <input
            ref={inputRef}
            placeholder="Search: “merge”, “essay”, “2x2 photo”…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            aria-label="Search tools"
          />
          <Search size={22} strokeWidth={2.4} />
          <kbd>/</kbd>
        </div>

        <div className="tasks">
          <span><Zap size={13} style={{ verticalAlign: -2 }} /> Quick jobs:</span>
          {studentTasks.map((t) => {
            const Icon = toolById[t.tool].icon
            return <Link key={t.label} to={`/tools/${t.tool}`} className="task"><Icon size={14} /> {t.label}</Link>
          })}
        </div>
      </section>

      {recent.length > 0 && !q && (
        <section className="recent">
          <div className="section-label">
            Jump back in
            <button onClick={() => { clearRecent(); setRecent([]) }}>clear</button>
          </div>
          <div className="recent-row">
            {recent.map((t) => {
              const Icon = t.icon
              return (
                <Link key={t.id} to={`/tools/${t.id}`} className="recent-pill" style={{ '--c': categoryById[t.category].color }}>
                  <span className="ico"><Icon size={15} /></span>{t.name}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <div className="toolbar-row" id="tools">
        <h2>{q ? `Results for “${q}”` : 'All tools'}</h2>
        <div className="chips">
          <button className={`chip ${active === 'all' ? 'active' : ''}`} onClick={() => setActive('all')}>
            All <small>{tools.filter((t) => matches(t, q)).length}</small>
          </button>
          {categories.map((c) => (
            <button key={c.id} className={`chip ${active === c.id ? 'active' : ''}`} style={{ '--c': c.color }} onClick={() => setActive(c.id)}>
              <i /> {c.name} <small>{tools.filter((t) => t.category === c.id && matches(t, q)).length}</small>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="illo"><SearchX size={32} /></div>
          <h3>Nothing matches “{q}”</h3>
          <p>Try a simpler word, like “pdf”, “photo” or “video”.</p>
          <button className="btn" onClick={() => { setQuery(''); setActive('all') }}>Show all tools</button>
        </div>
      )}

      {categories.map((cat) => {
        const list = filtered.filter((t) => t.category === cat.id)
        if (!list.length) return null
        return (
          <section key={cat.id} className="category">
            <div className="category-head">
              <h2>{cat.title[0]} <span className="serif">{cat.title[1]}</span></h2>
              <p>{cat.blurb}</p>
            </div>
            <div className="grid">
              {list.map((t) => <ToolCard key={t.id} tool={t} q={q} index={idx++} />)}
            </div>
          </section>
        )
      })}

      <section className="promise">
        <div>
          <span className="n">01</span>
          <h3>Private by default</h3>
          <p>Your thesis draft and your ID photo stay on your laptop. Nothing is uploaded to a server, ever.</p>
        </div>
        <div>
          <span className="n">02</span>
          <h3>No sign-up wall</h3>
          <p>Open a tool and use it. No trials, no watermarks, no "upgrade to download".</p>
        </div>
        <div>
          <span className="n">03</span>
          <h3>Made for deadlines</h3>
          <p>Drop, paste or drag files in, get the result in seconds, and get back to the actual work.</p>
        </div>
      </section>
    </>
  )
}
