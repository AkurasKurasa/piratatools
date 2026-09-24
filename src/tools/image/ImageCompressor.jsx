import { useState } from 'react'
import { Minimize2 } from 'lucide-react'
import BatchShell from './BatchShell.jsx'
import { useImageBatch } from './useImageBatch.js'
import { Segmented } from '../../components/ui.jsx'
import { baseName, canvasToBlob, drawToCanvas, fileToImage, mimeExt } from '../../lib/files.js'

export default function ImageCompressor() {
  const batch = useImageBatch()
  const [quality, setQuality] = useState(0.75)
  const [format, setFormat] = useState('auto')
  const [maxDim, setMaxDim] = useState('')

  const process = async (it) => {
    const img = await fileToImage(it.file)
    let type = format
    if (format === 'auto') {
      // PNG can't be lossy-compressed by the browser; WebP keeps transparency and is much smaller.
      type = it.file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp'
    }
    let w = img.naturalWidth
    let h = img.naturalHeight
    const cap = parseInt(maxDim, 10)
    if (cap > 0 && Math.max(w, h) > cap) {
      const s = cap / Math.max(w, h)
      w = Math.round(w * s)
      h = Math.round(h * s)
    }
    const canvas = drawToCanvas(img, w, h, type)
    let blob = await canvasToBlob(canvas, type, quality)
    let name = `${baseName(it.file.name)}-compressed.${mimeExt[type]}`
    // Never hand back a bigger file of the same type.
    if (blob.size >= it.file.size && it.file.type === type && w === img.naturalWidth) {
      blob = it.file
      name = it.file.name
    }
    return { blob, name }
  }

  return (
    <BatchShell
      batch={batch}
      process={process}
      actionLabel="Compress"
      actionIcon={Minimize2}
      zipName="compressed-images.zip"
      showSavings
      compare
      options={
        <div className="split">
          <div className="field">
            <label>Quality: {Math.round(quality * 100)}%</label>
            <input className="range" type="range" min="0.1" max="1" step="0.05" value={quality} onChange={(e) => setQuality(+e.target.value)} />
            <span className="caption">60–80% is usually indistinguishable from the original.</span>
          </div>
          <div className="stack">
            <div className="field">
              <label>Output format</label>
              <Segmented
                value={format}
                onChange={setFormat}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'image/jpeg', label: 'JPG' },
                  { value: 'image/webp', label: 'WebP' },
                ]}
              />
            </div>
            <div className="field">
              <label>Max width/height (optional)</label>
              <input className="input" type="number" min="1" placeholder="e.g. 1920" value={maxDim} onChange={(e) => setMaxDim(e.target.value)} />
            </div>
          </div>
        </div>
      }
    />
  )
}
