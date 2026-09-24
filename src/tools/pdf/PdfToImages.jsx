import { useEffect, useRef, useState } from 'react'
import { Download, ImageDown, Package, RotateCcw } from 'lucide-react'
import { Dropzone, Progress, Segmented } from '../../components/ui.jsx'
import { baseName, canvasToBlob, downloadBlob, downloadZip, formatBytes } from '../../lib/files.js'
import { openPdfjs, readBytes, renderPage } from '../../lib/pdf.js'
import { toast } from '../../lib/toast.js'

const DPI = [
  { value: 72, label: 'Screen (72 dpi)' },
  { value: 150, label: 'Standard (150)' },
  { value: 300, label: 'Print (300)' },
]

/** `to` fixes the output format and hides the format picker. */
export default function PdfToImages({ to }) {
  const [file, setFile] = useState(null)
  const [bytes, setBytes] = useState(null)
  const [count, setCount] = useState(0)
  const [dpi, setDpi] = useState(150)
  const [picked, setType] = useState('image/png')
  const type = to || picked
  const [range, setRange] = useState('all')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const urls = useRef([])
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), [])

  const open = async ([f]) => {
    try {
      const b = await readBytes(f)
      const d = await openPdfjs(b)
      setFile(f); setBytes(b); setCount(d.numPages); setResults([])
    } catch {
      toast('This PDF could not be opened.', 'error')
    }
  }

  const convert = async () => {
    setBusy(true)
    setProgress(0)
    urls.current.forEach(URL.revokeObjectURL)
    urls.current = []
    setResults([])
    try {
      const doc = await openPdfjs(bytes)
      const n = range === 'first' ? 1 : doc.numPages
      const out = []
      const ext = type === 'image/png' ? 'png' : 'jpg'
      const pad = String(doc.numPages).length
      for (let i = 1; i <= n; i++) {
        const page = await doc.getPage(i)
        const canvas = await renderPage(page, dpi / 72)
        const blob = await canvasToBlob(canvas, type, 0.92)
        const url = URL.createObjectURL(blob)
        urls.current.push(url)
        out.push({ blob, url, name: `${baseName(file.name)}-page-${String(i).padStart(pad, '0')}.${ext}`, w: canvas.width, h: canvas.height })
        canvas.width = 0
        page.cleanup()
        setResults([...out])
        setProgress(i / n)
      }
      toast(`${out.length} image${out.length > 1 ? 's' : ''} ready`)
    } catch (e) {
      console.error(e)
      toast('Conversion failed.', 'error')
    } finally { setBusy(false) }
  }

  if (!file) return <Dropzone accept="application/pdf,.pdf" onFiles={open} hint="Turn slides or pages into images for posts, presentations or your notes app." />

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="status"><b>{file.name}</b> · {count} pages · {formatBytes(file.size)}</span>
          <button className="btn sm" onClick={() => { setFile(null); setResults([]) }}><RotateCcw size={14} /> Change</button>
        </div>
        <div className="row" style={{ gap: 20 }}>
          <div className="field"><label>Quality</label><Segmented value={dpi} onChange={setDpi} options={DPI} /></div>
          {!to && <div className="field"><label>Format</label><Segmented value={type} onChange={setType} options={[{ value: 'image/png', label: 'PNG' }, { value: 'image/jpeg', label: 'JPG' }]} /></div>}
          <div className="field"><label>Pages</label><Segmented value={range} onChange={setRange} options={[{ value: 'all', label: `All ${count}` }, { value: 'first', label: 'First only' }]} /></div>
        </div>
        {busy && <Progress value={progress} />}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {results.length > 1 && !busy && (
            <button className="btn" onClick={() => downloadZip(results.map((r) => ({ blob: r.blob, name: r.name })), `${baseName(file.name)}-images.zip`)}>
              <Package size={16} /> Download all (.zip)
            </button>
          )}
          <button className="btn primary" onClick={convert} disabled={busy}>
            {busy ? <span className="spinner" /> : <ImageDown size={16} />} Convert to {type === 'image/png' ? 'PNG' : 'JPG'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="page-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
          {results.map((r, i) => (
            <div className="page-tile" key={r.url}>
              <div className="page-thumb"><img src={r.url} alt={`Page ${i + 1}`} /></div>
              <div className="page-tools">
                <span className="caption mono">{i + 1} · {r.w}×{r.h}</span>
                <button className="mini-btn" aria-label="Download" onClick={() => downloadBlob(r.blob, r.name)}><Download size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
