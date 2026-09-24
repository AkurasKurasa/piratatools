import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

const ImageConverter = lazy(() => import('./ImageConverter.jsx'))
const ImagesToPdf = lazy(() => import('../pdf/ImagesToPdf.jsx'))
const PdfToImages = lazy(() => import('../pdf/PdfToImages.jsx'))
const VideoToGif = lazy(() => import('../media/VideoToGif.jsx'))

const FROM = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WebP' },
  { value: 'pdf', label: 'PDF' },
  { value: 'video', label: 'Video (MP4, WebM, MOV)' },
]

const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }

const imageTargets = (from) => [
  ...['png', 'jpg', 'webp'].filter((t) => t !== from).map((t) => ({
    value: t,
    label: t === 'webp' ? 'WebP' : t.toUpperCase(),
    render: () => <ImageConverter to={MIME[t]} />,
  })),
  { value: 'pdf', label: 'PDF', render: () => <ImagesToPdf /> },
]

/** Every supported From → To pair, and the tool that handles it. */
const TARGETS = {
  png: imageTargets('png'),
  jpg: imageTargets('jpg'),
  webp: imageTargets('webp'),
  pdf: [
    { value: 'png', label: 'PNG', render: () => <PdfToImages to="image/png" /> },
    { value: 'jpg', label: 'JPG', render: () => <PdfToImages to="image/jpeg" /> },
  ],
  video: [
    { value: 'gif', label: 'GIF', render: () => <VideoToGif /> },
  ],
}

export default function FileConverter() {
  const [params, setParams] = useSearchParams()
  const from = TARGETS[params.get('from')] ? params.get('from') : 'jpg'
  const targets = TARGETS[from]
  const target = targets.find((t) => t.value === params.get('to')) || targets[0]

  const set = (f, t) => setParams({ from: f, to: t }, { replace: true })

  return (
    <div className="stack">
      <div className="panel">
        <div className="row" style={{ gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field">
            <label htmlFor="convert-from">Convert</label>
            <select id="convert-from" className="select" value={from} onChange={(e) => set(e.target.value, TARGETS[e.target.value][0].value)}>
              {FROM.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <ArrowRight size={18} style={{ marginBottom: 12 }} aria-hidden="true" />
          <div className="field">
            <label htmlFor="convert-to">To</label>
            <select id="convert-to" className="select" value={target.value} onChange={(e) => set(from, e.target.value)}>
              {targets.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <Suspense fallback={<div className="panel row"><span className="spinner" /> Loading…</div>}>
        <div key={`${from}-${target.value}`}>{target.render()}</div>
      </Suspense>
    </div>
  )
}
