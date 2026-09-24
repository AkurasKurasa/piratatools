import { useState } from 'react'
import { Download, FileDown, RotateCcw } from 'lucide-react'
import { Dropzone, Progress, Segmented } from '../../components/ui.jsx'
import { baseName, canvasToBlob, downloadBlob, formatBytes } from '../../lib/files.js'
import { loadPdfLib, openPdfjs, pdfBlob, readBytes, renderPage } from '../../lib/pdf.js'

const PRESETS = {
  strong: { label: 'Smallest', dpi: 72, quality: 0.5 },
  medium: { label: 'Balanced', dpi: 110, quality: 0.65 },
  light: { label: 'Best quality', dpi: 150, quality: 0.8 },
}

export default function CompressPdf() {
  const [file, setFile] = useState(null)
  const [preset, setPreset] = useState('medium')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const run = async () => {
    setBusy(true)
    setError('')
    setResult(null)
    setProgress(0)
    try {
      const { dpi, quality } = PRESETS[preset]
      const bytes = await readBytes(file)
      const src = await openPdfjs(bytes)
      const { PDFDocument } = await loadPdfLib()
      const out = await PDFDocument.create()
      for (let i = 1; i <= src.numPages; i++) {
        const page = await src.getPage(i)
        const base = page.getViewport({ scale: 1 }) // 72 dpi, in PDF points
        const canvas = await renderPage(page, dpi / 72)
        const jpg = await canvasToBlob(canvas, 'image/jpeg', quality)
        const img = await out.embedJpg(new Uint8Array(await jpg.arrayBuffer()))
        const p = out.addPage([base.width, base.height])
        p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height })
        page.cleanup()
        setProgress(i / src.numPages)
      }
      const blob = pdfBlob(await out.save())
      setResult(blob)
    } catch (e) {
      console.error(e)
      setError('Compression failed. The PDF may be damaged or password-protected.')
    } finally {
      setBusy(false)
    }
  }

  if (!file) return <Dropzone accept="application/pdf,.pdf" onFiles={([f]) => { setFile(f); setResult(null) }} hint="Works best on scanned documents and PDFs full of photos." />

  const smaller = result && result.size < file.size

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="status"><b>{file.name}</b> · {formatBytes(file.size)}</span>
          <button className="btn sm" onClick={() => setFile(null)}><RotateCcw size={14} /> Choose another</button>
        </div>
        <div className="field">
          <label>Compression level</label>
          <Segmented value={preset} onChange={(v) => { setPreset(v); setResult(null) }} options={Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label }))} />
        </div>
        <p className="caption" style={{ margin: 0 }}>
          Pages are re-rendered as images, so text in the compressed file can no longer be selected or searched.
        </p>
        {busy && <Progress value={progress} />}
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary" onClick={run} disabled={busy}>
            {busy ? <span className="spinner" /> : <FileDown size={16} />} Compress PDF
          </button>
        </div>
      </div>

      {result && (
        <div className="panel stack">
          <div className="stats">
            <div className="stat"><span>Before</span><b>{formatBytes(file.size)}</b></div>
            <div className="stat"><span>After</span><b className={smaller ? 'badge-ok' : ''}>{formatBytes(result.size)}</b></div>
            <div className="stat"><span>Change</span><b>{smaller ? '−' : '+'}{Math.abs(Math.round((1 - result.size / file.size) * 100))}%</b></div>
          </div>
          {!smaller && <div className="status">This PDF is already well compressed. The result came out larger, so keep your original, or try "Smallest".</div>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary" onClick={() => downloadBlob(result, `${baseName(file.name)}-compressed.pdf`)}><Download size={16} /> Download</button>
          </div>
        </div>
      )}
    </div>
  )
}
