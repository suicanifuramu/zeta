import { useState, useCallback, useRef, useEffect } from "react"
import { toast } from "sonner"
import {
  getMessages,
  getMessagesByCursor,
  sendMessageStream,
  editMessage,
} from "@/lib/api"
import type { ContentItem, RuntimeMessage } from "@/lib/types"

export interface SendMessageOptions {
  text: string
  editing?: { id: string; candidateId: string }
}

export interface UseChatMessagesDeps {
  chatRefs: React.MutableRefObject<{
    scrollToBottom?: () => void
    getViewport?: () => HTMLElement | null
    setMessages?: React.Dispatch<React.SetStateAction<RuntimeMessage[]>>
    invalidateCandidates?: (msgId?: string) => void
    reloadLatestMessages?: () => Promise<void>
  }>
  onEmptyRoomDetected: () => void
  onClearRecommendations: () => void
  getStreamSignal: () => AbortSignal | undefined
}

export interface UseChatMessagesReturn {
  messages: RuntimeMessage[]
  loading: boolean
  sending: boolean
  loadingHistory: boolean
  hasMoreHistory: boolean
  streamContents: ContentItem[] | null
  setMessages: React.Dispatch<React.SetStateAction<RuntimeMessage[]>>
  loadInitialMessages: () => Promise<void>
  reloadLatestMessages: () => Promise<void>
  loadOlderMessagesRef: React.MutableRefObject<(() => Promise<void>) | undefined>
  sendMessage: (options: SendMessageOptions) => Promise<boolean>
}

const PAGE_SIZE = 50

export function useChatMessages(
  roomId: string | undefined,
  deps: UseChatMessagesDeps
): UseChatMessagesReturn {
  const {
    chatRefs,
    onEmptyRoomDetected,
    onClearRecommendations,
    getStreamSignal,
  } = deps

  const [messages, setMessages] = useState<RuntimeMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const [streamContents, setStreamContents] = useState<ContentItem[] | null>(
    null
  )

  const loadInitialMessages = useCallback(async () => {
    if (!roomId) return
    setLoading(true)
    setHasMoreHistory(true)
    setMessages([])
    setStreamContents(null)

    try {
      const data = await getMessages(roomId, PAGE_SIZE)
      const msgs = data.messages || []
      if (msgs.length === 0) {
        await onEmptyRoomDetected()
      } else {
        setMessages(msgs)
        if (msgs.length < PAGE_SIZE) setHasMoreHistory(false)
      }
    } catch (e: unknown) {
      toast.error(
        `メッセージ読み込み失敗: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setLoading(false)
    }
  }, [roomId, onEmptyRoomDetected])

  // Replaces the list with the latest page. Keeps hasMoreHistory consistent with
  // the new window; a stale `false` would hide older history after an edit/delete.
  const reloadLatestMessages = useCallback(async () => {
    if (!roomId) return
    const data = await getMessages(roomId, PAGE_SIZE)
    const msgs = data.messages || []
    setMessages(msgs)
    setHasMoreHistory(msgs.length >= PAGE_SIZE)
    chatRefs.current.invalidateCandidates?.()
  }, [roomId, chatRefs])

  const loadOlderMessagesRef = useRef<(() => Promise<void>) | undefined>(undefined)

  const loadOlderMessages = useCallback(async () => {
    if (!roomId || loadingHistory || !hasMoreHistory || messages.length === 0)
      return
    const oldestMsg = messages[0]
    if (!oldestMsg?.id) return
    setLoadingHistory(true)
    try {
      const viewport = chatRefs.current.getViewport?.()
      const prevScrollHeight = viewport?.scrollHeight || 0
      const data = await getMessagesByCursor(roomId, oldestMsg.id, 30)
      const olderMsgs = data.messages || []
      if (olderMsgs.length === 0) {
        setHasMoreHistory(false)
      } else {
        const existingIds = new Set(messages.map((m) => m.id))
        const newMsgs = olderMsgs.filter((m) => !existingIds.has(m.id))
        if (newMsgs.length === 0) {
          setHasMoreHistory(false)
        } else {
          setMessages((prev) => [...newMsgs, ...prev])
          if (olderMsgs.length < 30) setHasMoreHistory(false)
          requestAnimationFrame(() => {
            const vp = chatRefs.current.getViewport?.()
            if (vp) {
              vp.scrollTop = vp.scrollHeight - prevScrollHeight
            }
          })
        }
      }
    } catch (e: unknown) {
      toast.error(
        `過去メッセージ取得失敗: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setLoadingHistory(false)
    }
  }, [roomId, loadingHistory, hasMoreHistory, messages, chatRefs])

  loadOlderMessagesRef.current = loadOlderMessages

  // Update late-binding hook refs
  chatRefs.current.setMessages = setMessages
  chatRefs.current.reloadLatestMessages = reloadLatestMessages

  // Auto-load initial messages on room change
  useEffect(() => {
    if (!roomId) return
    loadInitialMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  const sendMessage = useCallback(
    async (options: SendMessageOptions) => {
      const { text, editing } = options
      if (sending || !roomId) return false
      setSending(true)

      if (editing) {
        let editFailed = false
        try {
          await editMessage(roomId, editing.id, editing.candidateId, text)
        } catch (e: unknown) {
          toast.error(
            `編集失敗: ${e instanceof Error ? e.message : String(e)}`
          )
          editFailed = true
        }
        if (!editFailed) {
          chatRefs.current.invalidateCandidates?.(editing.id)
          try {
            await reloadLatestMessages()
            toast.success("メッセージを編集しました")
          } catch (e: unknown) {
            toast.error(
              `履歴の更新に失敗しました: ${e instanceof Error ? e.message : String(e)}`
            )
          }
          onClearRecommendations()
          setTimeout(() => chatRefs.current.scrollToBottom?.(), 50)
        }
        setSending(false)
        return !editFailed
      }

      const isEmptyMessage = !text

      // Optimistic user message (only for non-empty messages)
      let tempMsgId: string | null = null
      if (!isEmptyMessage) {
        const tempUserMsg: RuntimeMessage = {
          id: `temp-user-${Date.now()}`,
          roomId: roomId || "",
          senderId: "",
          text,
          sender: { type: "USER" },
          contents: [{ position: "RIGHT", text }],
        }
        tempMsgId = tempUserMsg.id
        setMessages((prev) => [...prev, tempUserMsg])
      }
      setStreamContents([])
      setTimeout(() => chatRefs.current.scrollToBottom?.(), 30)

      try {
        let finalMessage: RuntimeMessage | null = null
        let accumulated: ContentItem[] = []
        let streamErrored = false
        let failed = false
        await sendMessageStream(
          roomId,
          text,
          (event) => {
            const e = event as {
              event?: string
              type?: string
              chunkMessage?: { contents?: ContentItem[] }
              replyMessage?: RuntimeMessage
            }
            if (e.event === "ERROR" || e.type === "CHAT_ERROR") {
              streamErrored = true
              return
            }
            if (e.chunkMessage?.contents)
              accumulated = e.chunkMessage.contents
            if (e.replyMessage) {
              finalMessage = e.replyMessage
              accumulated = e.replyMessage.contents || accumulated
            }
            setStreamContents([...accumulated])
            setTimeout(() => chatRefs.current.scrollToBottom?.(), 10)
          },
          async () => {
            // The send itself succeeded once the stream ends. A failed follow-up
            // fetch must not look like a send failure or drop the user's message.
            try {
              if (streamErrored) {
                toast.error("送信に失敗しました")
                failed = true
                if (tempMsgId) {
                  setMessages((prev) => prev.filter((m) => m.id !== tempMsgId))
                }
                return
              }
              if (finalMessage) {
                const msg = finalMessage
                setMessages((prev) => [...prev, msg])
              } else {
                await reloadLatestMessages()
              }
              onClearRecommendations()
              setTimeout(() => chatRefs.current.scrollToBottom?.(), 50)
            } catch (e: unknown) {
              toast.error(
                `メッセージの更新に失敗しました: ${e instanceof Error ? e.message : String(e)}`
              )
            } finally {
              setStreamContents(null)
            }
          },
          getStreamSignal()
        )
        return !failed
      } catch (e: unknown) {
        setStreamContents(null)
        if (tempMsgId) {
          setMessages((prev) => prev.filter((m) => m.id !== tempMsgId))
        }
        // Leaving the room aborts the stream; that is not a failure.
        if (getStreamSignal()?.aborted) return false
        toast.error(
          `送信失敗: ${e instanceof Error ? e.message : String(e)}`
        )
        return false
      } finally {
        setSending(false)
      }
    },
    [
      roomId,
      sending,
      chatRefs,
      onClearRecommendations,
      reloadLatestMessages,
      getStreamSignal,
    ]
  )

  return {
    messages,
    loading,
    sending,
    loadingHistory,
    hasMoreHistory,
    streamContents,
    setMessages,
    loadInitialMessages,
    reloadLatestMessages,
    loadOlderMessagesRef,
    sendMessage,
  }
}
