import { useState } from 'react'
import { Scaling } from 'lucide-react'
import BatchShell from './BatchShell.jsx'
import { useImageBatch } from './useImageBatch.js'
import { Segmented } from '../../components/ui.jsx'
import { baseName, canvasToBlob, drawToCanvas, fileToImage, mimeExt } from '../../lib/files.js'

export default function ImageResizer() {
  const batch = useImageBatch()
  const [mode, setMode] = useState('percent')
  const [percent, setPercent] = useState(50)
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [lock, setLock] = useState(true)

  const first = batch.items[0]

  const onWidth = (v) => {
    setWidth(v)
    if (lock && first && v) setHeight(String(Math.round((v * first.height) / first.width)))
  }
  const onHeight = (v) => {
    setHeight(v)
    if (lock && first && v) setWidth(String(Math.round((v * first.width) / first.height)))
  }

  const targetSize = (it) => {
    if (mode === 'percent') {
      const s = Math.max(1, percent) / 100
      return [Math.max(1, Math.round(it.width * s)), Math.max(1, Math.round(it.height * s))]
    }
    const w = parseInt(width, 10)
    const h = parseInt(height, 10)
    if (!w && !h) throw new Error('Enter a width or a height.')
    if (lock) {
      // Keep each image's own aspect ratio, fitting inside the box.
      const s = Math.min(w ? w / it.width : Infinity, h ? h / it.height : Infinity)
      return [Math.max(1, Math.round(it.width * s)), Math.max(1, Math.round(it.height * s))]
    }
    return [w || it.width, h || it.height]
  }

  const process = async (it) => {
    const img = await fileToImage(it.file)
    const type = mimeExt[it.file.type] ? it.file.type : 'image/png'
    const [w, h] = targetSize(it)
    const canvas = drawToCanvas(img, w, h, type)
    const blob = await canvasToBlob(canvas, type, 0.92)
    return { blob, name: `${baseName(it.file.name)}-${w}x${h}.${mimeExt[type]}` }
  }

  return (
    <BatchShell
      batch={batch}
      process={process}
      actionLabel="Resize"
      actionIcon={Scaling}
      zipName="resized-images.zip"
      options={
        <div className="stack">
          <Segmented value={mode} onChange={setMode} options={[{ value: 'percent', label: 'By percentage' }, { value: 'pixels', label: 'By pixels' }]} />
          {mode === 'percent' ? (
            <div className="field">
              <label>Scale: {percent}%{first && ` (${Math.round(first.width * percent / 100)}×${Math.round(first.height * percent / 100)} for the first image)`}</label>
              <input className="range" type="range" min="5" max="200" step="5" value={percent} onChange={(e) => setPercent(+e.target.value)} />
            </div>
          ) : (
            <div className="row">
              <div className="field"><label>Width (px)</label><input className="input" type="number" min="1" value={width} onChange={(e) => onWidth(e.target.value)} placeholder={first?.width} /></div>
              <div className="field"><label>Height (px)</label><input className="input" type="number" min="1" value={height} onChange={(e) => onHeight(e.target.value)} placeholder={first?.height} /></div>
              <label className="checkbox" style={{ marginTop: 22 }}>
                <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} /> Keep aspect ratio
              </label>
            </div>
          )}
        </div>
      }
    />
  )
}
