import { useEffect, useState } from 'react'
import { Download, RotateCcw, Wand2 } from 'lucide-react'
import { Dropzone, Progress, Segmented } from '../../components/ui.jsx'
import CompareSlider from '../../components/CompareSlider.jsx'
import { toast } from '../../lib/toast.js'
import { baseName, canvasToBlob, downloadBlob, loadImage } from '../../lib/files.js'

const PRESETS = [
  { label: 'White', hex: '#ffffff' },
  { label: 'ID photo blue', hex: '#1f5fbf' },
  { label: 'ID photo red', hex: '#c62828' },
  { label: 'Light gray', hex: '#e6e6e6' },
]

const MODELS = [
  { value: 'isnet_quint8', label: 'Fast' },
  { value: 'isnet_fp16', label: 'Balanced' },
  { value: 'isnet', label: 'Best' },
]

export default function BackgroundRemover() {
  const [file, setFile] = useState(null)
  const [srcUrl, setSrcUrl] = useState('')
  const [cutout, setCutout] = useState(null) // Blob (transparent PNG)
  const [cutoutUrl, setCutoutUrl] = useState('')
  const [model, setModel] = useState('isnet_fp16')
  const [bg, setBg] = useState('transparent')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => () => { srcUrl && URL.revokeObjectURL(srcUrl) }, [srcUrl])
  useEffect(() => () => { cutoutUrl && URL.revokeObjectURL(cutoutUrl) }, [cutoutUrl])

  const pick = ([f]) => {
    setFile(f)
    setSrcUrl(URL.createObjectURL(f))
    setCutout(null)
    setCutoutUrl('')
    setError('')
  }

  const run = async () => {
    setBusy(true)
    setError('')
    setProgress(0)
    setStage('Loading AI model (first run downloads ~40–80 MB, then it is cached)…')
    try {
      const { removeBackground } = await import('@imgly/background-removal')
      const blob = await removeBackground(file, {
        model,
        output: { format: 'image/png' },
        progress: (key, current, total) => {
          if (total) setProgress(current / total)
          if (key.startsWith('compute')) setStage('Removing background…')
          else if (key.startsWith('fetch')) setStage('Downloading AI model… (only the first time)')
        },
      })
      setCutout(blob)
      setCutoutUrl(URL.createObjectURL(blob))
      toast('Background removed')
    } catch (e) {
      console.error(e)
      setError('Background removal failed. Try a different model, or a smaller image.')
    } finally {
      setBusy(false)
      setStage('')
    }
  }

  const download = async () => {
    const name = baseName(file.name)
    if (bg === 'transparent') return downloadBlob(cutout, `${name}-no-bg.png`)
    const img = await loadImage(cutoutUrl)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    downloadBlob(await canvasToBlob(canvas, 'image/jpeg', 0.95), `${name}-bg.jpg`)
  }

  const reset = () => { setFile(null); setSrcUrl(''); setCutout(null); setCutoutUrl('') }

  if (!file) {
    return <Dropzone accept="image/*" onFiles={pick} hint="Works best with a clear subject: you, a product, a pet. Great for 2x2 and ID photos." />
  }

  return (
    <div className="stack">
      <div className="panel row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <span className="label">Quality</span>
          <Segmented options={MODELS} value={model} onChange={setModel} />
        </div>
        <div className="row">
          <button className="btn" onClick={reset}><RotateCcw size={16} /> New image</button>
          <button className="btn primary" onClick={run} disabled={busy}>
            {busy ? <span className="spinner" /> : <Wand2 size={16} />} {cutout ? 'Run again' : 'Remove background'}
          </button>
        </div>
      </div>

      {busy && (
        <div className="panel stack">
          <div className="status">{stage}</div>
          <Progress value={progress} />
        </div>
      )}
      {error && <div className="error">{error}</div>}

      {cutoutUrl ? (
        <CompareSlider
          before={srcUrl}
          after={cutoutUrl}
          beforeLabel="Original"
          afterLabel="Background removed"
          afterClassName={bg === 'transparent' ? 'checker' : ''}
          afterStyle={bg === 'color' ? { background: bgColor } : undefined}
        />
      ) : (
        <div className="preview" style={{ opacity: busy ? 0.6 : 1, transition: 'opacity .3s' }}>
          <img src={srcUrl} alt="Original" />
        </div>
      )}

      {cutout && (
        <div className="panel row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <span className="label">Background</span>
            <Segmented
              options={[{ value: 'transparent', label: 'Transparent' }, { value: 'color', label: 'Solid color' }]}
              value={bg}
              onChange={setBg}
            />
            {bg === 'color' && (
              <>
                {PRESETS.map((p) => (
                  <button
                    key={p.hex}
                    className="mini-btn"
                    title={p.label}
                    aria-label={p.label}
                    onClick={() => setBgColor(p.hex)}
                    style={{ background: p.hex, width: 30, borderColor: bgColor === p.hex ? 'var(--ink)' : undefined, borderWidth: bgColor === p.hex ? 2 : 1 }}
                  />
                ))}
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} aria-label="Custom background color" />
              </>
            )}
          </div>
          <button className="btn primary" onClick={download}><Download size={16} /> Download {bg === 'transparent' ? 'PNG' : 'JPG'}</button>
        </div>
      )}
      <p className="caption">
        The AI model runs on your device. The first run downloads the model files, then later runs are much faster.
      </p>
    </div>
  )
}
