import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Info } from 'lucide-react'
import { subscribe } from '../lib/toast.js'

const ICONS = { success: Check, error: AlertTriangle, info: Info }

export default function Toaster() {
  const [items, setItems] = useState([])
  useEffect(() => subscribe(setItems), [])
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => {
        const Icon = ICONS[t.type] || Info
        return (
          <div key={t.id} className={`toast ${t.type} ${t.out ? 'out' : ''}`}>
            <span className="t-ico"><Icon size={14} strokeWidth={2.6} /></span>
            <span className="msg">{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}
