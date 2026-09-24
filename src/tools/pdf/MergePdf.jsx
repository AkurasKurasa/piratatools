import { useState } from 'react'
import { Combine, Download, Trash2 } from 'lucide-react'
import { Dropzone, FileList, move } from '../../components/ui.jsx'
import { downloadBlob, formatBytes, nextId } from '../../lib/files.js'
import { toast } from '../../lib/toast.js'
import { loadPdfLib, pdfBlob, readBytes } from '../../lib/pdf.js'

export default function MergePdf() {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const add = async (files) => {
    setResult(null)
    setError('')
    const { PDFDocument } = await loadPdfLib()
    const loaded = []
    for (const file of files) {
      try {
        const bytes = await readBytes(file)
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
        loaded.push({ id: nextId(), file, bytes, pages: doc.getPageCount() })
      } catch {
        setError(`"${file.name}" couldn't be opened. It may be damaged or password-protected.`)
      }
    }
    setItems((prev) => [...prev, ...loaded])
  }

  const merge = async () => {
    setBusy(true)
    setError('')
    try {
      const { PDFDocument } = await loadPdfLib()
      const out = await PDFDocument.create()
      for (const it of items) {
        const src = await PDFDocument.load(it.bytes, { ignoreEncryption: true })
        const pages = await out.copyPages(src, src.getPageIndices())
        pages.forEach((p) => out.addPage(p))
      }
      const bytes = await out.save()
      setResult(pdfBlob(bytes))
      toast(`Merged ${items.length} files into one PDF`)
    } catch (e) {
      console.error(e)
      setError('Merging failed. One of the files may be encrypted or damaged.')
    } finally {
      setBusy(false)
    }
  }

  const totalPages = items.reduce((s, it) => s + it.pages, 0)

  return (
    <div className="stack">
      <Dropzone accept="application/pdf,.pdf" multiple onFiles={add} compact={items.length > 0} hint="Add two or more PDFs, then drag them into the order you want." />
      {error && <div className="error">{error}</div>}
      {items.length > 0 && (
        <>
          <FileList
            items={items}
            onMove={(a, b) => { setItems((x) => move(x, a, b)); setResult(null) }}
            onRemove={(id) => { setItems((x) => x.filter((i) => i.id !== id)); setResult(null) }}
            renderSub={(it) => `${it.pages} page${it.pages === 1 ? '' : 's'} · ${formatBytes(it.file.size)}`}
          />
          <div className="panel row" style={{ justifyContent: 'space-between' }}>
            <span className="status">{items.length} files · {totalPages} pages total</span>
            <div className="row">
              <button className="btn" onClick={() => { setItems([]); setResult(null) }}><Trash2 size={16} /> Clear</button>
              {result ? (
                <button className="btn primary" onClick={() => downloadBlob(result, 'merged.pdf')}>
                  <Download size={16} /> Download merged PDF ({formatBytes(result.size)})
                </button>
              ) : (
                <button className="btn primary" onClick={merge} disabled={busy || items.length < 2}>
                  {busy ? <span className="spinner" /> : <Combine size={16} />} Merge PDFs
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
