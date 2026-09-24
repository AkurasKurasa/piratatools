const listeners = new Set()
let toasts = []
let id = 0

function emit() { listeners.forEach((l) => l(toasts)) }

export function toast(message, type = 'success', ms = 2600) {
  const t = { id: ++id, message, type, out: false }
  toasts = [...toasts, t].slice(-4)
  emit()
  setTimeout(() => {
    toasts = toasts.map((x) => (x.id === t.id ? { ...x, out: true } : x))
    emit()
    setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); emit() }, 220)
  }, ms)
}

export function subscribe(fn) {
  listeners.add(fn)
  fn(toasts)
  return () => listeners.delete(fn)
}
