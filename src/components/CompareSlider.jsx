import { useRef, useState } from 'react'
import { MoveHorizontal } from 'lucide-react'

/** Drag (or use arrow keys) to reveal "after" over "before". */
export default function CompareSlider({ before, after, beforeLabel = 'Before', afterLabel = 'After', afterClassName = '', afterStyle }) {
  const [pos, setPos] = useState(50)
  const ref = useRef(null)
  const dragging = useRef(false)

  const update = (clientX) => {
    const r = ref.current.getBoundingClientRect()
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)))
  }

  return (
    <div
      ref={ref}
      className="compare"
      role="slider"
      tabIndex={0}
      aria-label="Before and after comparison"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); update(e.clientX) }}
      onPointerMove={(e) => dragging.current && update(e.clientX)}
      onPointerUp={() => { dragging.current = false }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 5))
        if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 5))
      }}
    >
      <img src={before} alt={beforeLabel} draggable={false} />
      <div className={`after ${afterClassName}`} style={{ ...afterStyle, clipPath: `inset(0 0 0 ${pos}%)` }}>
        <img src={after} alt={afterLabel} draggable={false} />
      </div>
      <div className="handle" style={{ left: `${pos}%` }}>
        <div className="knob"><MoveHorizontal size={18} /></div>
      </div>
      <span className="tag" style={{ left: 10, opacity: pos > 12 ? 1 : 0 }}>{beforeLabel}</span>
      <span className="tag" style={{ right: 10, opacity: pos < 88 ? 1 : 0 }}>{afterLabel}</span>
    </div>
  )
}
