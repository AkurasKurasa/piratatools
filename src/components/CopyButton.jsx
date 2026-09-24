import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { copyText } from '../lib/files.js'

export default function CopyButton({ text, label = 'Copy', className = 'btn', disabled }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      className={className}
      disabled={disabled}
      onClick={async () => {
        if (await copyText(typeof text === 'function' ? text() : text)) {
          setOk(true)
          setTimeout(() => setOk(false), 1400)
        }
      }}
    >
      {ok ? <Check size={16} /> : <Copy size={16} />} {ok ? 'Copied' : label}
    </button>
  )
}
