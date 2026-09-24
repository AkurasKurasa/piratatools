import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, FileText, GripVertical, Plus, UploadCloud, X } from 'lucide-react'
import { formatBytes } from '../lib/files.js'
import { toast } from '../lib/toast.js'

function acceptFilter(accept) {
  if (!accept) return () => true
  const rules = accept.split(',').map((s) => s.trim().toLowerCase())
  return (f) => rules.some((r) =>
    r.startsWith('.') ? f.name.toLowerCase().endsWith(r)
      : r.endsWith('/*') ? f.type.startsWith(r.slice(0, -1))
        : f.type === r,
  )
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * File picker that accepts click, drag-and-drop and Ctrl+V paste.
 * `compact` renders a slim "add more" bar once files are loaded.
 */
export function Dropzone({ accept, multiple = false, onFiles, title, hint, compact = false }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)
  const depth = useRef(0)
  const onFilesRef = useRef(onFiles)
  useEffect(() => { onFilesRef.current = onFiles }, [onFiles])

  const handle = (list, source) => {
    const all = Array.from(list || [])
    let files = all.filter(acceptFilter(accept))
    if (all.length && !files.length) {
      toast(`That file type isn't supported here.`, 'error')
      return
    }
    if (!multiple) files = files.slice(0, 1)
    if (files.length) {
      onFilesRef.current(files)
      if (source === 'paste') toast(files.length === 1 ? 'Image pasted from clipboard' : `${files.length} files pasted`, 'info')
    }
  }

  useEffect(() => {
    const onPaste = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const files = Array.from(e.clipboardData?.files || [])
      if (!files.length) return
      e.preventDefault()
      const named = files.map((f, i) =>
        f.name && f.name !== 'image.png' ? f : new File([f], `pasted-${Date.now()}${i ? `-${i}` : ''}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }),
      )
      handle(named, 'paste')
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accept, multiple])

  const canPaste = !accept || accept.includes('image')

  return (
    <div
      className={`dropzone ${over ? 'over' : ''} ${compact ? 'compact' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), inputRef.current?.click())}
      onDragEnter={(e) => { e.preventDefault(); depth.current++; setOver(true) }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false) }}
      onDrop={(e) => { e.preventDefault(); depth.current = 0; setOver(false); handle(e.dataTransfer.files, 'drop') }}
    >
      <div className="dz-icon">{compact ? <Plus size={20} /> : <UploadCloud size={30} />}</div>
      <div>
        <strong>
          {over ? 'Drop it!' : compact ? 'Add more files' : title || (multiple ? 'Drop your files here' : 'Drop your file here')}
        </strong>
        {!compact && hint && <span>{hint}</span>}
      </div>
      <div className="dz-actions">
        {!compact && <span className="btn sm primary" style={{ pointerEvents: 'none' }}>Choose {multiple ? 'files' : 'a file'}</span>}
        {canPaste && <span>or paste with <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd> <kbd>V</kbd></span>}
      </div>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => { handle(e.target.files, 'pick'); e.target.value = '' }}
      />
    </div>
  )
}

/** List of files with thumbnails, optional drag-to-reorder, arrows and remove. */
export function FileList({ items, onMove, onRemove, renderSub, renderRight, numbered = !!onMove }) {
  const [dragFrom, setDragFrom] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  return (
    <div className="file-list">
      {items.map((it, i) => (
        <div
          className={`file-item ${dragFrom === i ? 'dragging' : ''} ${dragOver === i && dragFrom !== i ? 'drop-target' : ''}`}
          key={it.id}
          draggable={!!onMove}
          onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)) }}
          onDragOver={(e) => { if (dragFrom === null) return; e.preventDefault(); e.stopPropagation(); setDragOver(i) }}
          onDrop={(e) => { if (dragFrom === null) return; e.preventDefault(); e.stopPropagation(); if (dragFrom !== i) onMove(dragFrom, i); setDragFrom(null); setDragOver(null) }}
          onDragEnd={() => { setDragFrom(null); setDragOver(null) }}
          style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
        >
          {onMove && <span className="grip" title="Drag to reorder"><GripVertical size={16} /></span>}
          {numbered && <span className="idx">{i + 1}</span>}
          {it.thumb ? <img className="thumb" src={it.thumb} alt="" /> : <div className="thumb"><FileText size={20} /></div>}
          <div className="meta">
            <div className="name" title={it.file.name}>{it.file.name}</div>
            <div className="sub">{renderSub ? renderSub(it) : formatBytes(it.file.size)}</div>
          </div>
          {renderRight?.(it)}
          {onMove && (
            <>
              <button className="mini-btn arrow" aria-label="Move up" disabled={i === 0} onClick={() => onMove(i, i - 1)}><ArrowUp size={15} /></button>
              <button className="mini-btn arrow" aria-label="Move down" disabled={i === items.length - 1} onClick={() => onMove(i, i + 1)}><ArrowDown size={15} /></button>
            </>
          )}
          {onRemove && <button className="mini-btn" aria-label="Remove" onClick={() => onRemove(it.id)}><X size={15} /></button>}
        </div>
      ))}
    </div>
  )
}

export function Progress({ value }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  )
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function move(arr, from, to) {
  const next = arr.slice()
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}
