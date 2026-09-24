import { sentences, wordCount } from './ai.js'

/** Words AI models use far more often than people do, with plainer swaps. */
const WORDS = {
  delve: 'look at, explore', delves: 'looks at', delving: 'looking into', tapestry: 'mix, range', testament: 'proof, sign',
  intricate: 'detailed, complex', meticulous: 'careful', meticulously: 'carefully', pivotal: 'key, important',
  underscore: 'show, stress', underscores: 'shows', showcase: 'show', showcases: 'shows', foster: 'build, encourage',
  fosters: 'builds', realm: 'area, field', embark: 'start', leverage: 'use', leveraging: 'using', utilize: 'use',
  utilizing: 'using', seamless: 'smooth', seamlessly: 'smoothly', robust: 'strong', multifaceted: 'complex',
  holistic: 'whole, overall', paramount: 'most important', nuanced: 'subtle', vibrant: 'lively', bustling: 'busy',
  crucial: 'key, important', elevate: 'improve, raise', unlock: 'open up, allow', harness: 'use', resonate: 'connect with',
  resonates: 'connects with', invaluable: 'very useful', commendable: 'good', noteworthy: 'notable', myriad: 'many',
  plethora: 'many, a lot', encompasses: 'includes', endeavor: 'effort, project', navigate: 'handle, deal with',
  navigating: 'handling', landscape: 'field, situation', transformative: 'big, major', enhance: 'improve',
  enhancing: 'improving', streamline: 'simplify', empower: 'help, let', empowering: 'helping',
  delved: 'looked at', empowers: 'helps, lets', enhances: 'improves', navigates: 'handles', fostering: 'building',
  showcasing: 'showing', underscoring: 'showing', leverages: 'uses', utilizes: 'uses', elevates: 'improves',
}

const TRANSITIONS = ['furthermore', 'moreover', 'additionally', 'in addition', 'notably', 'ultimately', 'consequently', 'overall', 'in conclusion', 'in summary', 'to summarize', 'thus', 'hence']

/** Stock phrases, each with a short tip. */
const PHRASES = [
  ['it is important to note', 'Just say the point.'], ["it's important to note", 'Just say the point.'],
  ['it is worth noting', 'Just say the point.'], ["it's worth noting", 'Just say the point.'],
  ['plays a crucial role', 'Say what it actually does.'], ['plays a vital role', 'Say what it actually does.'], ['plays a pivotal role', 'Say what it actually does.'],
  ["in today's fast-paced world", 'Cut it, or name the specific change.'], ["in today's digital age", 'Cut it, or name the specific change.'], ['in today\'s world', 'Cut it, or be specific.'],
  ['a testament to', 'Say what it shows.'], ['rich tapestry', 'Name the actual things.'], ['ever-evolving', 'Say how it changes.'], ['ever-changing', 'Say how it changes.'],
  ['in the realm of', 'Use "in".'], ['a myriad of', 'Use "many".'], ['a plethora of', 'Use "many".'], ['a wide range of', 'Name a few examples instead.'],
  ['serves as a', 'Use "is a".'], ['stands as a', 'Use "is a".'], ['shed light on', 'Use "explain" or "show".'], ['sheds light on', 'Use "explains" or "shows".'],
  ['pave the way', 'Say what it makes possible.'], ['paves the way', 'Say what it makes possible.'], ['dive into', 'Use "look at".'], ['dive deeper', 'Use "look closer".'], ['deep dive', 'Use "close look".'],
  ["let's explore", 'Just start explaining.'], ['embark on a journey', 'Use "start".'], ['navigate the complexities', 'Say what is hard and why.'],
  ['when it comes to', 'Use "for" or "with".'], ['at the end of the day', 'Cut it.'], ["it's not just about", 'State the point directly.'], ['not only', 'Check you really need "not only … but also".'],
  ['the power of', 'Say what it does.'], ['in conclusion', 'Your last paragraph already signals the end.'], ['as an ai', 'Remove it.'], ['i hope this helps', 'Remove it.'],
  ['whether you are', 'Speak to your actual reader.'], ["whether you're", 'Speak to your actual reader.'], ['key takeaways', 'Just state them.'], ['game-changer', 'Say what changed.'], ['game changer', 'Say what changed.'],
]

export const KINDS = {
  word: { label: 'AI-favored words', color: 'var(--hl)' },
  phrase: { label: 'Stock phrases', color: 'var(--cat-pdf)' },
  transition: { label: 'Stacked transitions', color: 'var(--cat-text)' },
  rhythm: { label: 'Same-length sentences', color: 'var(--cat-media)' },
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]")

/** Finds the words, phrases and sentence patterns that make writing read as AI-generated. */
export function analyze(text) {
  const marks = []
  const add = (start, end, kind, tip) => {
    if (marks.some((m) => start < m.end && end > m.start)) return
    marks.push({ start, end, kind, tip })
  }
  const scan = (re, kind, tipFor) => {
    for (const m of text.matchAll(re)) add(m.index, m.index + m[0].length, kind, tipFor(m[0]))
  }

  // Longest first so a phrase wins over the single word inside it.
  scan(new RegExp(`\\b(?:${PHRASES.map(([p]) => esc(p)).join('|')})\\b`, 'gi'), 'phrase',
    (s) => PHRASES.find(([p]) => p === s.toLowerCase().replace(/’/g, "'"))?.[1] ?? '')
  scan(new RegExp(`\\b(?:${Object.keys(WORDS).join('|')})\\b`, 'gi'), 'word', (s) => `Try: ${WORDS[s.toLowerCase()]}`)

  // Transition words at the start of a sentence, when there are several of them.
  const sents = sentences(text)
  const openers = sents.map((s) => {
    const lead = s.text.match(/^\s*/)[0].length
    const t = TRANSITIONS.find((w) => s.text.slice(lead).toLowerCase().startsWith(w) && /^[\s,]/.test(s.text.slice(lead + w.length)))
    return t && { start: s.start + lead, end: s.start + lead + t.length }
  }).filter(Boolean)
  if (openers.length >= 3) openers.forEach((o) => add(o.start, o.end, 'transition', 'Many sentences start with a linking word. Cut some; the order already connects them.'))

  // Runs of 4+ sentences within ~20% of the same length read machine-like. Kept as a separate
  // layer (underlined) so the word highlights inside those sentences still show.
  const rhythm = []
  const lens = sents.map((s) => wordCount(s.text))
  let runStart = 0
  const flushRun = (end) => {
    if (end - runStart >= 4) for (let i = runStart; i < end; i++) {
      const s = sents[i]
      const lead = s.text.match(/^\s*/)[0].length
      const body = s.text.trim()
      rhythm.push({ start: s.start + lead, end: s.start + lead + body.length })
    }
  }
  for (let i = 1; i <= lens.length; i++) {
    const avg = lens.slice(runStart, i).reduce((a, b) => a + b, 0) / (i - runStart)
    if (i === lens.length || lens[i] < 6 || Math.abs(lens[i] - avg) > avg * 0.2) { flushRun(i); runStart = i }
  }

  marks.sort((a, b) => a.start - b.start)

  const mean = lens.reduce((a, b) => a + b, 0) / (lens.length || 1)
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / (lens.length || 1))
  return { marks, rhythm, variety: lens.length >= 5 ? sd / mean : null, dashes: (text.match(/—/g) || []).length }
}

/** The most frequent flagged words and phrases, with their tips. */
export function topTips(text, marks, n = 8) {
  const acc = {}
  for (const m of marks) {
    if (m.kind !== 'word' && m.kind !== 'phrase') continue
    const key = text.slice(m.start, m.end).toLowerCase()
    acc[key] ??= { text: key, tip: m.tip, n: 0 }
    acc[key].n++
  }
  return Object.values(acc).sort((a, b) => b.n - a.n).slice(0, n)
}
