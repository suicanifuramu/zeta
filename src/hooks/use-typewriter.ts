import { useEffect, useLayoutEffect, useRef, useState } from "react"

type ContentItem = { type?: string; position?: string; speakerName?: string; text?: string }

export function useTypewriter(
  contents: ContentItem[] | null,
  speed: number = 40
): ContentItem[] | null {
  const [state, setState] = useState<{
    gen: number
    lengths: Map<number, number>
  }>({ gen: 0, lengths: new Map() })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerGenRef = useRef(0)
  const contentsRef = useRef(contents)
  const [activeGen, setActiveGen] = useState(0)

  useEffect(() => {
    contentsRef.current = contents
  }, [contents])

  useLayoutEffect(() => {
    if (contents !== null && contents.length > 0) {
      const hasTextItems = contents.some(
        (item) => item.text && item.type !== "INFO_BOX"
      )
      if (hasTextItems) {
        setActiveGen(timerGenRef.current)
      }
    }
  }, [contents])

  useEffect(() => {
    if (contents === null || contents.length === 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      timerGenRef.current += 1
      return
    }

    const hasTextItems = contents.some(
      (item) => item.text && item.type !== "INFO_BOX"
    )
    if (!hasTextItems) return

    if (!timerRef.current) {
      const myGen = timerGenRef.current
      timerRef.current = setInterval(() => {
        const currentContents = contentsRef.current
        if (!currentContents) return

        setState((prev) => {
          if (prev.gen !== myGen) {
            const lengths = new Map<number, number>()
            let lastTextIdx = -1
            currentContents.forEach((item, i) => {
              if (item.text && item.type !== "INFO_BOX") lastTextIdx = i
            })
            currentContents.forEach((item, i) => {
              if (item.type !== "INFO_BOX" && item.text) {
                lengths.set(
                  i,
                  i === lastTextIdx
                    ? Math.min(1, item.text.length)
                    : item.text.length
                )
              }
            })
            return { gen: myGen, lengths }
          }

          let lastTextIdx = -1
          currentContents.forEach((item, i) => {
            if (item.text && item.type !== "INFO_BOX") lastTextIdx = i
          })

          const lengths = new Map(prev.lengths)
          let allDone = true
          currentContents.forEach((item, i) => {
            if (item.type === "INFO_BOX" || !item.text) return
            if (i !== lastTextIdx) {
              lengths.set(i, item.text.length)
              return
            }
            const cur = lengths.get(i) ?? 0
            if (cur < item.text.length) {
              lengths.set(i, cur + 1)
              allDone = false
            }
          })
          if (allDone && timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return { gen: myGen, lengths }
        })
      }, speed)
    }
  }, [contents, speed])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  if (contents === null) return null
  if (contents.length === 0) return contents

  let lastTextIdx = -1
  contents.forEach((item, i) => {
    if (item.text && item.type !== "INFO_BOX") lastTextIdx = i
  })

  return contents.map((item, i) => {
    if (item.type === "INFO_BOX" || !item.text) return item
    if (i !== lastTextIdx) return item
    const len = state.lengths.get(i)
    const nextShowing =
      len !== undefined && activeGen !== state.gen ? 1 : len ?? 1
    return { ...item, text: item.text.slice(0, Math.min(nextShowing, item.text.length)) }
  })
}
