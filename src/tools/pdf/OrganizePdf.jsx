import { useEffect, useRef, useState } from 'react'
import { Download, FilePlus2, RotateCcw, RotateCw, Trash2, Undo2 } from 'lucide-react'
import { Dropzone, Progress } from '../../components/ui.jsx'
import { baseName, downloadBlob, formatBytes } from '../../lib/files.js'
import { loadPdfLib, openPdfjs, pdfBlob, readBytes, renderPage } from '../../lib/pdf.js'
import { toast } from '../../lib/toast.js'

let key = 0

export default function OrganizePdf() {
  const [sources, setSources] = useState([]) // { name, bytes }
  const [pages, setPages] = useState([]) // { key, src, index, rot }
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragFrom, setDragFrom] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [history, setHistory] = useState([])
  const [thumbs, setThumbs] = useState({})
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const commit = (next) => { setHistory((h) => [...h.slice(-30), pages]); setPages(next) }

  const addFiles = async (files) => {
    setLoading(true)
    let nextSrc = sources.length
    for (const file of files) {
      try {
        const bytes = await readBytes(file)
        const doc = await openPdfjs(bytes)
        const src = nextSrc++
        setSources((s) => [...s, { name: file.name, bytes, size: file.size }])
        const fresh = Array.from({ length: doc.numPages }, (_, i) => ({ key: `p${key++}`, src, index: i, rot: 0 }))
        setPages((p) => [...p, ...fresh])
        for (let i = 0; i < doc.numPages && alive.current; i++) {
          const page = await doc.getPage(i + 1)
          const canvas = await renderPage(page, 180 / page.getViewport({ scale: 1 }).width)
          const url = canvas.toDataURL('image/jpeg', 0.75)
          const k = fresh[i].key
          setThumbs((t) => ({ ...t, [k]: url }))
        }
      } catch {
        toast(`Couldn't open ${file.name}. It may be damaged or password-protected.`, 'error')
      }
    }
    setLoading(false)
  }

  const rotate = (k, d) => commit(pages.map((p) => (p.key === k ? { ...p, rot: (p.rot + d + 360) % 360 } : p)))
  const remove = (k) => commit(pages.filter((p) => p.key !== k))
  const rotateAll = (d) => commit(pages.map((p) => ({ ...p, rot: (p.rot + d + 360) % 360 })))
  const reverse = () => commit(pages.slice().reverse())
  const moveTo = (from, to) => {
    const next = pages.slice()
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    commit(next)
  }
  const undo = () => setHistory((h) => { if (!h.length) return h; setPages(h.at(-1)); return h.slice(0, -1) })

  const saveOut = async () => {
    setBusy(true)
    try {
      const { PDFDocument, degrees } = await loadPdfLib()
      const out = await PDFDocument.create()
      const docs = {}
      for (const p of pages) {
        docs[p.src] ||= await PDFDocument.load(sources[p.src].bytes, { ignoreEncryption: true })
        const [copied] = await out.copyPages(docs[p.src], [p.index])
        copied.setRotation(degrees((copied.getRotation().angle + p.rot) % 360))
        out.addPage(copied)
      }
      const name = sources.length === 1 ? `${baseName(sources[0].name)}-organized.pdf` : 'organized.pdf'
      downloadBlob(pdfBlob(await out.save()), name)
    } catch (e) {
      console.error(e)
      toast('Saving failed. One of the PDFs may be encrypted.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!sources.length) return <Dropzone accept="application/pdf,.pdf" multiple onFiles={addFiles} hint="Rotate sideways scans, delete blank pages, drag to reorder. Add more than one PDF to combine them too." />

  return (
    <div className="stack">
      <div className="panel row" style={{ justifyContent: 'space-between', position: 'sticky', top: 72, zIndex: 5 }}>
        <div className="row">
          <span className="status"><b>{pages.length}</b> pages from {sources.length} file{sources.length > 1 ? 's' : ''}</span>
          <button className="btn sm" onClick={() => rotateAll(-90)}><RotateCcw size={14} /> All</button>
          <button className="btn sm" onClick={() => rotateAll(90)}><RotateCw size={14} /> All</button>
          <button className="btn sm" onClick={reverse}>Reverse order</button>
          <button className="btn sm ghost" onClick={undo} disabled={!history.length}><Undo2 size={14} /> Undo</button>
        </div>
        <div className="row">
          <label className="btn sm" style={{ cursor: 'pointer' }}>
            <FilePlus2 size={14} /> Add PDF
            <input type="file" hidden accept="application/pdf,.pdf" multiple onChange={(e) => { addFiles(Array.from(e.target.files)); e.target.value = '' }} />
          </label>
          <button className="btn primary" onClick={saveOut} disabled={busy || !pages.length}>
            {busy ? <span className="spinner" /> : <Download size={16} />} Save PDF
          </button>
        </div>
      </div>
      {loading && <Progress value={pages.filter((p) => thumbs[p.key]).length / Math.max(1, pages.length)} />}

      <div className="page-grid">
        {pages.map((p, i) => (
          <div
            key={p.key}
            className={`page-tile ${dragFrom === i ? 'dragging' : ''} ${dragOver === i && dragFrom !== i ? 'drop-target' : ''}`}
            draggable
            onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)) }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(i) }}
            onDrop={(e) => { e.preventDefault(); if (dragFrom !== null && dragFrom !== i) moveTo(dragFrom, i); setDragFrom(null); setDragOver(null) }}
            onDragEnd={() => { setDragFrom(null); setDragOver(null) }}
          >
            <div className="page-thumb">
              {thumbs[p.key] ? <img src={thumbs[p.key]} alt={`Page ${i + 1}`} style={{ transform: `rotate(${p.rot}deg)`, maxWidth: p.rot % 180 ? '78%' : '100%' }} draggable={false} /> : <span className="spinner" />}
            </div>
            <div className="page-tools">
              <button className="mini-btn" aria-label="Rotate left" onClick={() => rotate(p.key, -90)}><RotateCcw size={13} /></button>
              <span className="mono caption">{i + 1}{sources.length > 1 ? <sup style={{ marginLeft: 2 }}>{String.fromCharCode(65 + p.src)}</sup> : ''}</span>
              <button className="mini-btn" aria-label="Rotate right" onClick={() => rotate(p.key, 90)}><RotateCw size={13} /></button>
              <button className="mini-btn" aria-label="Delete page" onClick={() => remove(p.key)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      {sources.length > 1 && (
        <p className="caption">{sources.map((s, i) => `${String.fromCharCode(65 + i)} = ${s.name} (${formatBytes(s.size)})`).join(' · ')}</p>
      )}
      <p className="caption">Drag pages to reorder. Nothing changes in your original files until you save.</p>
    </div>
  )
}
