import type { ReactNode } from "react"

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && /[A-Za-z0-9]/.test(c)
}

function leftBoundary(text: string, i: number): boolean {
  if (i === 0) return true
  return !isWordChar(text[i - 1])
}

function rightBoundary(text: string, after: number): boolean {
  if (after >= text.length) return true
  return !isWordChar(text[after])
}

type EmNode = { type: "b" | "i" | "bi"; text: string; end: number }

function tryEmphasis(text: string, i: number): EmNode | null {
  if (!leftBoundary(text, i)) return null
  let k = 0
  while (i + k < text.length && text[i + k] === "*" && k < 3) k++
  const j = i + k
  if (j >= text.length) return null
  let search = j
  while (search < text.length) {
    const starIdx = text.indexOf("*", search)
    if (starIdx === -1) break
    let runLen = 0
    while (starIdx + runLen < text.length && text[starIdx + runLen] === "*") runLen++
    if (runLen !== k) {
      search = starIdx + runLen
      continue
    }
    const content = text.slice(j, starIdx)
    if (content.length === 0 || content.includes("*") || /^\s|\s$/.test(content)) {
      search = starIdx + runLen
      continue
    }
    if (!rightBoundary(text, starIdx + runLen)) {
      search = starIdx + runLen
      continue
    }
    const type = k === 3 ? "bi" : k === 2 ? "b" : "i"
    return { type, text: content, end: starIdx + runLen }
  }
  return null
}

export function formatMessageText(text: string) {
  if (!text) return null
  const nodes: ReactNode[] = []
  let buf = ""
  let i = 0
  let key = 0
  while (i < text.length) {
    if (text[i] === "*") {
      const em = tryEmphasis(text, i)
      if (em) {
        if (buf) {
          nodes.push(buf)
          buf = ""
        }
        if (em.type === "b") {
          nodes.push(<b key={key++}>{em.text}</b>)
        } else if (em.type === "i") {
          nodes.push(
            <i key={key++} className="opacity-80">
              {em.text}
            </i>
          )
        } else {
          nodes.push(
            <i key={key++} className="opacity-80">
              <b>{em.text}</b>
            </i>
          )
        }
        i = em.end
        continue
      }
    }
    buf += text[i++]
  }
  if (buf) nodes.push(buf)
  return nodes
}
