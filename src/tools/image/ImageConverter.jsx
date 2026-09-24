import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import BatchShell from './BatchShell.jsx'
import { useImageBatch } from './useImageBatch.js'
import { Segmented } from '../../components/ui.jsx'
import { baseName, canvasToBlob, drawToCanvas, fileToImage, mimeExt } from '../../lib/files.js'

const LABELS = { 'image/png': 'PNG', 'image/jpeg': 'JPG', 'image/webp': 'WebP' }

/** `to` fixes the output format and hides the format picker. */
export default function ImageConverter({ to }) {
  const batch = useImageBatch()
  const [picked, setType] = useState('image/png')
  const type = to || picked
  const [quality, setQuality] = useState(0.9)

  const process = async (it) => {
    const img = await fileToImage(it.file)
    const canvas = drawToCanvas(img, img.naturalWidth, img.naturalHeight, type)
    const blob = await canvasToBlob(canvas, type, quality)
    return { blob, name: `${baseName(it.file.name)}.${mimeExt[type]}` }
  }

  return (
    <BatchShell
      batch={batch}
      process={process}
      actionLabel={to ? `Convert to ${LABELS[to]}` : 'Convert'}
      actionIcon={RefreshCw}
      zipName="converted-images.zip"
      compare
      options={
        <div className="split">
          <div className="field">
            {!to && (
              <>
                <label>Convert to</label>
                <Segmented
                  value={type}
                  onChange={setType}
                  options={Object.entries(LABELS).map(([value, label]) => ({ value, label }))}
                />
              </>
            )}
            {type === 'image/jpeg' && <span className="caption">JPG has no transparency. Transparent areas become white.</span>}
          </div>
          {type !== 'image/png' && (
            <div className="field">
              <label>Quality: {Math.round(quality * 100)}%</label>
              <input className="range" type="range" min="0.1" max="1" step="0.05" value={quality} onChange={(e) => setQuality(+e.target.value)} />
            </div>
          )}
        </div>
      }
    />
  )
}
