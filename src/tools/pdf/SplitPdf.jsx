import { useEffect, useRef, useState } from 'react'
import { Download, Package, RotateCcw } from 'lucide-react'
import { Dropzone, Progress, Segmented } from '../../components/ui.jsx'
import { baseName, downloadBlob, downloadZip, formatBytes } from '../../lib/files.js'
import { formatRanges, loadPdfLib, openPdfjs, parseRanges, pdfBlob, readBytes, renderPage } from '../../lib/pdf.js'

const THUMB_LIMIT = 200

export default function SplitPdf() {
  const [file, setFile] = useState(null)
  const [bytes, setBytes] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [thumbs, setThumbs] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [rangeText, setRangeText] = useState('')
  const [mode, setMode] = useState('extract')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const cancelled = useRef(false)

  useEffect(() => () => { cancelled.current = true }, [])

  const open = async ([f]) => {
    setError('')
    try {
      const b = await readBytes(f)
      const doc = await openPdfjs(b)
      setFile(f)
      setBytes(b)
      setPageCount(doc.numPages)
      setSelected(new Set())
      setRangeText('')
      setThumbs([])
      cancelled.current = false
      const n = Math.min(doc.numPages, THUMB_LIMIT)
      for (let i = 1; i <= n; i++) {
        if (cancelled.current) break
        const page = await doc.getPage(i)
        const vp = page.getViewport({ scale: 1 })
        const canvas = await renderPage(page, 140 / vp.width)
        const url = canvas.toDataURL('image/jpeg', 0.7)
        setThumbs((t) => [...t, url])
      }
    } catch (e) {
      console.error(e)
      setError('This PDF could not be opened. It may be damaged or password-protected.')
    }
  }

  const toggle = (i) => {
    const s = new Set(selected)
    s.has(i) ? s.delete(i) : s.add(i)
    setSelected(s)
    setRangeText(formatRanges(s))
  }

  const onRangeText = (v) => {
    setRangeText(v)
    try { setSelected(new Set(parseRanges(v, pageCount))); setError('') } catch { /* wait until valid */ }
  }

  const run = async () => {
    setBusy(true)
    setError('')
    setProgress(0)
    try {
      const { PDFDocument } = await loadPdfLib()
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
      const name = baseName(file.name)
      if (mode === 'extract') {
        const idx = parseRanges(rangeText, pageCount)
        if (!idx.length) throw new Error('Pick at least one page.')
        const out = await PDFDocument.create()
        const pages = await out.copyPages(src, idx)
        pages.forEach((p) => out.addPage(p))
        downloadBlob(pdfBlob(await out.save()), `${name}-pages-${formatRanges(idx).replace(/\s/g, '')}.pdf`)
      } else {
        const files = []
        for (let i = 0; i < pageCount; i++) {
          const out = await PDFDocument.create()
          const [p] = await out.copyPages(src, [i])
          out.addPage(p)
          files.push({ blob: pdfBlob(await out.save()), name: `${name}-page-${String(i + 1).padStart(String(pageCount).length, '0')}.pdf` })
          setProgress((i + 1) / pageCount)
        }
        await downloadZip(files, `${name}-pages.zip`)
      }
    } catch (e) {
      setError(e.message || 'Splitting failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!file) return (
    <div className="stack">
      <Dropzone accept="application/pdf,.pdf" onFiles={open} hint="Choose one PDF to split." />
      {error && <div className="error">{error}</div>}
    </div>
  )

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="status"><b>{file.name}</b> · {pageCount} pages · {formatBytes(file.size)}</span>
          <button className="btn sm" onClick={() => { cancelled.current = true; setFile(null) }}><RotateCcw size={14} /> Choose another</button>
        </div>
        <Segmented value={mode} onChange={setMode} options={[{ value: 'extract', label: 'Extract pages' }, { value: 'every', label: 'Split every page' }]} />
        {mode === 'extract' ? (
          <div className="field">
            <label>Pages to extract: click thumbnails or type ranges</label>
            <input className="input mono" value={rangeText} onChange={(e) => onRangeText(e.target.value)} placeholder="e.g. 1-3, 5, 8-" />
          </div>
        ) : (
          <span className="caption">Each of the {pageCount} pages becomes its own PDF, and they all download together as a .zip.</span>
        )}
        {busy && mode === 'every' && <Progress value={progress} />}
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary" onClick={run} disabled={busy || (mode === 'extract' && !rangeText.trim())}>
            {busy ? <span className="spinner" /> : mode === 'extract' ? <Download size={16} /> : <Package size={16} />}
            {mode === 'extract' ? `Extract ${selected.size || ''} page${selected.size === 1 ? '' : 's'}` : 'Split & download .zip'}
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
        {thumbs.map((src, i) => {
          const on = mode === 'extract' && selected.has(i)
          return (
            <button
              key={i}
              onClick={() => mode === 'extract' && toggle(i)}
              style={{
                border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: 6,
                background: on ? 'color-mix(in srgb, var(--accent) 12%, var(--surface))' : 'var(--surface)',
                cursor: mode === 'extract' ? 'pointer' : 'default',
              }}
            >
              <img src={src} alt={`Page ${i + 1}`} style={{ width: '100%', display: 'block', borderRadius: 4 }} />
              <div className="caption" style={{ marginTop: 4, color: on ? 'var(--accent)' : undefined }}>{i + 1}</div>
            </button>
          )
        })}
      </div>
      {pageCount > THUMB_LIMIT && <p className="caption">Previews are shown for the first {THUMB_LIMIT} pages. Type ranges for the rest.</p>}
    </div>
  )
}
