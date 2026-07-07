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
  }>
  onEmptyRoomDetected: () => void
  onClearRecommendations: () => void
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
  loadOlderMessagesRef: React.MutableRefObject<(() => Promise<void>) | undefined>
  sendMessage: (options: SendMessageOptions) => Promise<void>
}

export function useChatMessages(
  roomId: string | undefined,
  deps: UseChatMessagesDeps
): UseChatMessagesReturn {
  const {
    chatRefs,
    onEmptyRoomDetected,
    onClearRecommendations,
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
      const data = await getMessages(roomId, 50)
      const msgs = data.messages || []
      if (msgs.length === 0) {
        await onEmptyRoomDetected()
      } else {
        setMessages(msgs)
        if (msgs.length < 50) setHasMoreHistory(false)
      }
    } catch (e: unknown) {
      toast.error(
        `メッセージ読み込み失敗: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setLoading(false)
    }
  }, [roomId, onEmptyRoomDetected])

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

  // Update late-binding setMessages hook ref
  chatRefs.current.setMessages = setMessages

  // Auto-load initial messages on room change
  useEffect(() => {
    if (!roomId) return
    loadInitialMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  const sendMessage = useCallback(
    async (options: SendMessageOptions) => {
      const { text, editing } = options
      if (sending || !roomId) return
      setSending(true)

      if (editing) {
        try {
          await editMessage(roomId, editing.id, editing.candidateId, text)
          const data = await getMessages(roomId, 50)
          setMessages(data.messages || [])
          toast.success("メッセージを編集しました")
          onClearRecommendations()
          setTimeout(() => chatRefs.current.scrollToBottom?.(), 50)
        } catch (e: unknown) {
          toast.error(
            `編集失敗: ${e instanceof Error ? e.message : String(e)}`
          )
        } finally {
          setSending(false)
        }
        return
      }

      const isEmptyMessage = !text

      // Optimistic user message (only for non-empty messages)
      if (!isEmptyMessage) {
        const tempUserMsg: RuntimeMessage = {
          id: `temp-user-${Date.now()}`,
          roomId: roomId || "",
          senderId: "",
          text,
          sender: { type: "USER" },
          contents: [{ position: "RIGHT", text }],
        }
        setMessages((prev) => [...prev, tempUserMsg])
      }
      setStreamContents([])
      setTimeout(() => chatRefs.current.scrollToBottom?.(), 30)

      try {
        let finalMessage: RuntimeMessage | null = null
        let accumulated: ContentItem[] = []
        await sendMessageStream(
          roomId,
          text,
          (event) => {
            const e = event as {
              chunkMessage?: { contents?: ContentItem[] }
              replyMessage?: RuntimeMessage
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
            setStreamContents(null)
            if (finalMessage) {
              const msg = finalMessage
              setMessages((prev) => [...prev, msg])
            } else {
              const data = await getMessages(roomId, 50)
              setMessages(data.messages || [])
            }
            onClearRecommendations()
            setTimeout(() => chatRefs.current.scrollToBottom?.(), 50)
          }
        )
      } catch (e: unknown) {
        toast.error(
          `送信失敗: ${e instanceof Error ? e.message : String(e)}`
        )
        setStreamContents(null)
      } finally {
        setSending(false)
      }
    },
    [roomId, sending, chatRefs, onClearRecommendations]
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
    loadOlderMessagesRef,
    sendMessage,
  }
}
