import { useState, useRef } from "react"
import { toast } from "sonner"
import { getCandidates, getMessages, regenMessageStream, selectCandidate } from "@/lib/api"
import type { Candidate, ContentItem, RuntimeMessage } from "@/lib/types"

type SwipeDirection = "prev" | "next" | "regen" | null

export function useChatCandidates(
  roomId: string | undefined,
  messages: RuntimeMessage[],
  setMessages: React.Dispatch<React.SetStateAction<RuntimeMessage[]>>,
  scrollToBottom: () => void
) {
  const [candidatesCache, setCandidatesCache] = useState<
    Record<string, { candidates: Candidate[]; currentIdx: number }>
  >({})

  const [regenMsgId, setRegenMsgId] = useState<string | null>(null)
  const [regenContents, setRegenContents] = useState<ContentItem[]>([])

  const [lastSwipeDirection, setLastSwipeDirection] = useState<{
    id: string
    direction: SwipeDirection
    key: number
  }>({ id: "", direction: null, key: 0 })
  const swipeKeyRef = useRef(0)

  // Ensure candidates are cached for a message (lazy-load on first interaction)
  async function ensureCandidatesCached(
    msgId: string
  ): Promise<{ candidates: Candidate[]; currentIdx: number } | null> {
    const cached = candidatesCache[msgId]
    if (cached) return cached
    if (!roomId) return null
    try {
      const data = await getCandidates(roomId, msgId)
      const candidates = data.candidates || []
      const currentMsg = messages.find(
        (m) => m.id === msgId
      )
      const currentCandidateId = currentMsg?.candidateId
      const currentIdx = candidates.findIndex(
        (c: Candidate) => c.id === currentCandidateId
      )
      const entry = {
        candidates,
        currentIdx: currentIdx >= 0 ? currentIdx : candidates.length - 1,
      }
      setCandidatesCache((prev) => ({ ...prev, [msgId]: entry }))
      return entry
    } catch (e: unknown) {
      console.warn(
        "ensureCandidatesCached:",
        e instanceof Error ? e.message : String(e)
      )
      return null
    }
  }

  // Regen: generate a new candidate via SSE, shown inline at the message position
  async function handleRegen(msgId: string) {
    if (!roomId) return
    const el = document.getElementById(`msg-swipe-${msgId}`)
    if (el) {
      el.style.transition = "none"
      el.style.transform = "translateX(0px)"
    }
    swipeKeyRef.current += 1
    setLastSwipeDirection({
      id: msgId,
      direction: "regen",
      key: swipeKeyRef.current,
    })
    setRegenMsgId(msgId)
    setRegenContents([])
    try {
      let accumulated: ContentItem[] = []
      await regenMessageStream(
        roomId,
        msgId,
        (event) => {
          const e = event as {
            chunkMessage?: { contents?: ContentItem[] }
            replyMessage?: RuntimeMessage
          }
          if (e.chunkMessage?.contents) accumulated = e.chunkMessage.contents
          if (e.replyMessage) {
            accumulated = e.replyMessage.contents || accumulated
          }
          setRegenContents([...accumulated])
        },
        async () => {
          // After stream ends, fetch the candidates list and select the newest one
          try {
            const candData = await getCandidates(roomId, msgId)
            const candidates = candData.candidates || []
            const newestIdx = candidates.length - 1
            if (candidates.length > 0) {
              const newest = candidates[newestIdx]
              await selectCandidate(roomId, msgId, newest.id)
              // Update cache with fresh data
              setCandidatesCache((prev) => ({
                ...prev,
                [msgId]: { candidates, currentIdx: newestIdx },
              }))
              // Optimistic local update: apply newest candidate contents to the message
              const newestContents = newest.contents || newest.content
              if (newestContents) {
                const normalizedContents: ContentItem[] = Array.isArray(
                  newestContents
                )
                  ? newestContents
                  : [{ text: newestContents, position: "LEFT" }]
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === msgId
                      ? {
                          ...m,
                          contents: normalizedContents,
                          candidateId: newest.id,
                        }
                      : m
                  )
                )
              } else {
                // Fallback: use streamed content
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === msgId
                      ? { ...m, contents: accumulated, candidateId: newest.id }
                      : m
                  )
                )
              }
            }
          } catch (e: unknown) {
            console.warn(
              "selectCandidate after regen:",
              e instanceof Error ? e.message : String(e)
            )
            // Fallback: reload all messages
            const data = await getMessages(roomId, 50)
            setMessages(data.messages || [])
          }
          setRegenMsgId(null)
          setRegenContents([])
          toast.success("再生成しました")
        }
      )
    } catch (e: unknown) {
      toast.error(
        `再生成失敗: ${e instanceof Error ? e.message : String(e)}`
      )
      setRegenMsgId(null)
      setRegenContents([])
    }
  }

  // Switch candidate on an existing message (optimized with cache)
  async function handleSwitchCandidate(
    msgId: string,
    direction: "prev" | "next"
  ): Promise<boolean> {
    if (!roomId) return false
    try {
      const cached = await ensureCandidatesCached(msgId)
      if (!cached) return false
      const { candidates, currentIdx } = cached

      if (candidates.length <= 1) {
        if (direction === "next") {
          handleRegen(msgId)
          return true
        } else {
          toast.info("候補がありません")
          return false
        }
      }

      let targetIdx: number
      if (direction === "next") {
        if (currentIdx >= candidates.length - 1) {
          handleRegen(msgId)
          return true
        }
        targetIdx = currentIdx + 1
      } else {
        if (currentIdx <= 0) {
          toast.info("最初の候補です")
          return false
        }
        targetIdx = currentIdx - 1
      }

      const targetCandidate = candidates[targetIdx]
      swipeKeyRef.current += 1
      setLastSwipeDirection({
        id: msgId,
        direction,
        key: swipeKeyRef.current,
      })

      // Update cache index immediately
      setCandidatesCache((prev) => ({
        ...prev,
        [msgId]: { ...prev[msgId], currentIdx: targetIdx },
      }))

      // Optimistic local update: apply candidate contents without reloading
      const targetContents = targetCandidate.contents || targetCandidate.content
      if (targetContents) {
        const normalizedContents: ContentItem[] = Array.isArray(
          targetContents
        )
          ? targetContents
          : [{ text: targetContents, position: "LEFT" }]
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  contents: normalizedContents,
                  candidateId: targetCandidate.id,
                }
              : m
          )
        )
      }

      // Fire selectCandidate in background (no await for instant UX)
      selectCandidate(roomId, msgId, targetCandidate.id).catch(
        (e: unknown) => {
          console.warn(
            "selectCandidate bg:",
            e instanceof Error ? e.message : String(e)
          )
        }
      )

      const el = document.getElementById(`msg-swipe-${msgId}`)
      if (el) {
        el.style.transition = "none"
        el.style.transform = "translateX(0px)"
      }

      setTimeout(scrollToBottom, 50)
      return true
    } catch (e: unknown) {
      toast.error(
        `候補切り替え失敗: ${e instanceof Error ? e.message : String(e)}`
      )
      return false
    }
  }

  return {
    candidatesCache,
    regenMsgId,
    regenContents,
    lastSwipeDirection,
    handleRegen,
    handleSwitchCandidate,
  }
}
