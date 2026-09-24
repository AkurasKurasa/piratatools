let worker = null
let seq = 0
const pending = new Map()
const progressListeners = new Set()

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') return progressListeners.forEach((fn) => fn(data))
    const job = pending.get(data.id)
    if (!job) return
    if (data.type === 'done') { pending.delete(data.id); job.resolve(data.value) }
    else if (data.type === 'error') { pending.delete(data.id); job.reject(new Error(data.value)) }
    else job.on?.(data)
  }
  return worker
}

/**
 * Runs an on-device AI job in the worker.
 * onEvent receives { type: 'progress', kind, value } while a model downloads,
 * plus job events such as { type: 'token', value } or { type: 'step', value }.
 */
export function runAi(type, payload, onEvent) {
  const id = ++seq
  const w = getWorker()
  const onProgress = (e) => e.kind === type && onEvent?.(e)
  progressListeners.add(onProgress)
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, on: onEvent })
    w.postMessage({ id, type, payload })
  }).finally(() => progressListeners.delete(onProgress))
}

/** Ends the current generation early; the job resolves with what it has so far. */
export function stopAi() {
  worker?.postMessage({ type: 'stop' })
}

/** Download sizes shown before first use. */
export const MODEL_SIZE = { detect: '126 MB', rephrase: 'about 500 MB' }

/** Splits text into sentences, keeping the original spacing so it can be rebuilt exactly. */
export function sentences(text) {
  const seg = new Intl.Segmenter('en', { granularity: 'sentence' })
  return [...seg.segment(text)].map((s) => ({ text: s.segment, start: s.index }))
}

export const wordCount = (s) => (s.match(/\S+/g) || []).length
