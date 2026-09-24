import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search } from 'lucide-react'
import { categories, categoryById, toolById, tools } from '../tools/registry.js'
import { getRecent } from '../lib/recent.js'

export function matches(tool, q) {
  if (!q) return true
  const hay = `${tool.name} ${tool.description} ${tool.keywords} ${(tool.uses || []).join(' ')}`.toLowerCase()
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))
}

export default function CommandPalette({ open, onClose }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) { setQ(''); setActive(0) }
  }, [open])

  const groups = useMemo(() => {
    if (!q.trim()) {
      const recent = getRecent().map((id) => toolById[id]).filter(Boolean)
      const out = []
      if (recent.length) out.push({ label: 'Recent', items: recent })
      categories.forEach((c) => out.push({ label: c.name, items: tools.filter((t) => t.category === c.id) }))
      return out
    }
    const hits = tools.filter((t) => matches(t, q.trim()))
    return hits.length ? [{ label: `${hits.length} result${hits.length === 1 ? '' : 's'}`, items: hits }] : []
  }, [q])

  const flat = groups.flatMap((g) => g.items)

  const go = (tool) => { onClose(); navigate(`/tools/${tool.id}`) }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); go(flat[active]) }
    else if (e.key === 'Escape') onClose()
  }

  useEffect(() => {
    listRef.current?.querySelector('.cmdk-item.active')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null
  let i = -1

  return (
    <div className="cmdk-backdrop" onMouseDown={onClose}>
      <div className="cmdk" role="dialog" aria-label="Find a tool" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-input">
          <Search size={19} />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0) }}
            onKeyDown={onKey}
            placeholder="What do you need to do?"
            aria-label="Search tools"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="cmdk-list" ref={listRef}>
          {flat.length === 0 && <div className="cmdk-empty">No tool for “{q}” yet.</div>}
          {groups.map((g) => (
            <div key={g.label}>
              <div className="cmdk-group">{g.label}</div>
              {g.items.map((t) => {
                i++
                const idx = i
                const Icon = t.icon
                return (
                  <div
                    key={`${g.label}-${t.id}`}
                    className={`cmdk-item ${idx === active ? 'active' : ''}`}
                    style={{ '--c': categoryById[t.category].color }}
                    onMouseMove={() => setActive(idx)}
                    onClick={() => go(t)}
                  >
                    <div className="card-icon"><Icon size={16} /></div>
                    <div className="t"><b>{t.name}</b><small>{t.description}</small></div>
                    <CornerDownLeft size={15} className="enter" />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
