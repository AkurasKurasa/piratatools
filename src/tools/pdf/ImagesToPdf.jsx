import { useEffect, useRef, useState } from 'react'
import { FileImage, Trash2 } from 'lucide-react'
import { Dropzone, FileList, Segmented, move } from '../../components/ui.jsx'
import { canvasToBlob, downloadBlob, drawToCanvas, fileToImage, formatBytes, nextId } from '../../lib/files.js'
import { loadPdfLib, pdfBlob } from '../../lib/pdf.js'

const SIZES = { fit: null, a4: [595.28, 841.89], letter: [612, 792] }
const MARGINS = { none: 0, small: 18, large: 42 }

export default function ImagesToPdf() {
  const [items, setItems] = useState([])
  const [size, setSize] = useState('fit')
  const [orientation, setOrientation] = useState('auto')
  const [margin, setMargin] = useState('none')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(items)
  useEffect(() => { ref.current = items }, [items])
  useEffect(() => () => ref.current.forEach((i) => URL.revokeObjectURL(i.thumb)), [])

  const add = async (files) => {
    const loaded = await Promise.all(files.map(async (file) => {
      try {
        const img = await fileToImage(file)
        return { id: nextId(), file, thumb: URL.createObjectURL(file), width: img.naturalWidth, height: img.naturalHeight }
      } catch { return null }
    }))
    setItems((p) => [...p, ...loaded.filter(Boolean)])
  }

  const build = async () => {
    setBusy(true)
    setError('')
    try {
      const { PDFDocument } = await loadPdfLib()
      const doc = await PDFDocument.create()
      for (const it of items) {
        let img
        const bytes = new Uint8Array(await it.file.arrayBuffer())
        if (it.file.type === 'image/jpeg') img = await doc.embedJpg(bytes)
        else if (it.file.type === 'image/png') img = await doc.embedPng(bytes)
        else {
          const el = await fileToImage(it.file)
          const blob = await canvasToBlob(drawToCanvas(el, el.naturalWidth, el.naturalHeight, 'image/jpeg'), 'image/jpeg', 0.92)
          img = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()))
        }
        const m = MARGINS[margin]
        let pw, ph
        if (!SIZES[size]) {
          pw = img.width * 0.75 + m * 2 // px → pt at 96 dpi
          ph = img.height * 0.75 + m * 2
        } else {
          ;[pw, ph] = SIZES[size]
          const landscape = orientation === 'landscape' || (orientation === 'auto' && img.width > img.height)
          if (landscape) [pw, ph] = [ph, pw]
        }
        const page = doc.addPage([pw, ph])
        const s = Math.min((pw - m * 2) / img.width, (ph - m * 2) / img.height)
        const w = img.width * s
        const h = img.height * s
        page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
      }
      downloadBlob(pdfBlob(await doc.save()), 'images.pdf')
    } catch (e) {
      console.error(e)
      setError('Could not build the PDF. One of the images may be unsupported.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <Dropzone accept="image/*" multiple onFiles={add} compact={items.length > 0} hint="Snap photos of your handwritten work. Each one becomes a page, and you can drag to reorder." />
      {items.length > 0 && (
        <>
          <div className="panel stack">
            <div className="row" style={{ gap: 24 }}>
              <div className="field"><label>Page size</label>
                <Segmented value={size} onChange={setSize} options={[{ value: 'fit', label: 'Fit image' }, { value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }]} />
              </div>
              {size !== 'fit' && (
                <div className="field"><label>Orientation</label>
                  <Segmented value={orientation} onChange={setOrientation} options={[{ value: 'auto', label: 'Auto' }, { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} />
                </div>
              )}
              <div className="field"><label>Margin</label>
                <Segmented value={margin} onChange={setMargin} options={[{ value: 'none', label: 'None' }, { value: 'small', label: 'Small' }, { value: 'large', label: 'Large' }]} />
              </div>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => { items.forEach((i) => URL.revokeObjectURL(i.thumb)); setItems([]) }}><Trash2 size={16} /> Clear</button>
              <button className="btn primary" onClick={build} disabled={busy}>
                {busy ? <span className="spinner" /> : <FileImage size={16} />} Create PDF ({items.length} page{items.length === 1 ? '' : 's'})
              </button>
            </div>
          </div>
          <FileList
            items={items}
            onMove={(a, b) => setItems((x) => move(x, a, b))}
            onRemove={(id) => setItems((x) => { const it = x.find((i) => i.id === id); it && URL.revokeObjectURL(it.thumb); return x.filter((i) => i.id !== id) })}
            renderSub={(it) => `${it.width}×${it.height} · ${formatBytes(it.file.size)}`}
          />
        </>
      )}
    </div>
  )
}
