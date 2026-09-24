import { InterruptableStoppingCriteria, pipeline, TextStreamer } from '@huggingface/transformers'

/** Models run entirely in this worker. They download once, then load from the browser cache. */
const MODELS = {
  detect: { task: 'text-classification', model: 'onnx-community/tmr-ai-text-detector-ONNX' },
  rephrase: { task: 'text-generation', model: 'onnx-community/Qwen2.5-0.5B-Instruct' },
}

const loading = {}
const stopper = new InterruptableStoppingCriteria()

async function hasWebGpu() {
  try { return !!(await navigator.gpu?.requestAdapter()) } catch { return false }
}

function load(kind) {
  loading[kind] ??= (async () => {
    const { task, model } = MODELS[kind]
    const gpu = kind === 'rephrase' && await hasWebGpu()
    return pipeline(task, model, {
      device: gpu ? 'webgpu' : 'wasm',
      dtype: gpu ? 'q4f16' : 'q8',
      progress_callback: (p) => {
        if (p.status === 'progress_total') self.postMessage({ type: 'progress', kind, value: p.progress / 100 })
      },
    })
  })().catch((e) => { delete loading[kind]; throw e })
  return loading[kind]
}

const handlers = {
  /** chunks: string[] → probability each chunk is AI-written, 0..1 */
  async detect({ chunks }, reply) {
    const classify = await load('detect')
    const scores = []
    for (const chunk of chunks) {
      const out = await classify(chunk, { top_k: null })
      scores.push(out.find((o) => o.label === 'ai')?.score ?? 0)
      reply({ type: 'step', value: scores.length / chunks.length })
    }
    return scores
  },

  /** Streams the rewritten text token by token. */
  async rephrase({ text, instruction }, reply) {
    const generate = await load('rephrase')
    stopper.reset()
    // A worked example and a tight length cap keep this small model from adding ideas of its own.
    const messages = [
      { role: 'system', content: 'You rewrite one passage at a time. Use different wording but keep exactly the same meaning and facts. Do not add ideas, examples or opinions. Do not remove facts. Reply with only the rewritten passage.' },
      { role: 'user', content: 'Rephrase in clear, natural wording:\nThe meeting was postponed due to the fact that the adviser was not able to attend.' },
      { role: 'assistant', content: 'The meeting was moved because the adviser couldn\'t attend.' },
      { role: 'user', content: `${instruction}\n${text}` },
    ]
    const words = text.split(/\s+/).length
    const out = await generate(messages, {
      max_new_tokens: Math.round(words * 1.8) + 8,
      do_sample: false,
      stopping_criteria: stopper,
      streamer: new TextStreamer(generate.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (token) => reply({ type: 'token', value: token }),
      }),
    })
    return out[0].generated_text.at(-1).content.trim()
  },
}

self.onmessage = async ({ data }) => {
  if (data.type === 'stop') return stopper.interrupt()
  const reply = (msg) => self.postMessage({ ...msg, id: data.id })
  try {
    reply({ type: 'done', value: await handlers[data.type](data.payload, reply) })
  } catch (e) {
    reply({ type: 'error', value: e?.message || String(e) })
  }
}
