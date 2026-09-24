import { useEffect, useRef, useState } from 'react'
import { fileToImage, nextId } from '../../lib/files.js'

/** Shared state for tools that process a batch of images. */
export function useImageBatch() {
  const [items, setItems] = useState([])
  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items }, [items])

  useEffect(() => () => {
    itemsRef.current.forEach((it) => {
      URL.revokeObjectURL(it.thumb)
      if (it.outUrl) URL.revokeObjectURL(it.outUrl)
    })
  }, [])

  const add = async (files) => {
    const loaded = await Promise.all(files.map(async (file) => {
      try {
        const img = await fileToImage(file)
        return { id: nextId(), file, thumb: URL.createObjectURL(file), width: img.naturalWidth, height: img.naturalHeight, out: null, outUrl: '' }
      } catch {
        return null
      }
    }))
    setItems((prev) => [...prev, ...loaded.filter(Boolean)])
    return loaded.filter(Boolean)
  }

  const remove = (id) => setItems((prev) => {
    const it = prev.find((x) => x.id === id)
    if (it) { URL.revokeObjectURL(it.thumb); if (it.outUrl) URL.revokeObjectURL(it.outUrl) }
    return prev.filter((x) => x.id !== id)
  })

  const setResult = (id, out) => setItems((prev) => prev.map((x) => {
    if (x.id !== id) return x
    if (x.outUrl) URL.revokeObjectURL(x.outUrl)
    return { ...x, out, outUrl: out ? URL.createObjectURL(out) : '' }
  }))

  const clearResults = () => setItems((prev) => prev.map((x) => {
    if (x.outUrl) URL.revokeObjectURL(x.outUrl)
    return { ...x, out: null, outUrl: '' }
  }))

  const clear = () => {
    itemsRef.current.forEach((it) => { URL.revokeObjectURL(it.thumb); if (it.outUrl) URL.revokeObjectURL(it.outUrl) })
    setItems([])
  }

  return { items, add, remove, setResult, clearResults, clear }
}
