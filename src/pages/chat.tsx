/* eslint-disable react-hooks/refs */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Asterisk, ChevronLeft, ChevronRight, RefreshCw, Send, Star, Trash2, Pencil, ArrowDown } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CachedAvatarImage } from "@/components/cached-avatar-image"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ProfileSelectSheet } from "@/components/profile-select-sheet"
import { PlotDetailDialog } from "@/components/plot-detail-dialog"
import { InfoBox } from "@/components/info-box"
import { CharacterDetailSheet } from "@/components/character-detail-sheet"
import {
  createIntro, deleteMessages, deleteRoom, getCandidates, getIntroBeforeSelection,
  getMessages, getMessagesByCursor, getPlot, getRecommended,
  getRecommendQuota, getRoom, getRoomModelSetting,
  getUserChatProfiles, refreshRecommended, regenMessageStream,
  selectCandidate, selectUserChatProfile, sendMessageStream, editMessage,
} from "@/lib/api"
import { preloadImages } from "@/lib/image-preloader"
import type { Message, UserChatProfile, InfoBoxContent, Candidate, Character } from "@/lib/types"
import { cn } from "@/lib/utils"

// ── Message Formatter ──
function formatMessageText(text: string) {
  if (!text) return null
  const parts = text.split(/(\*\*?[^*]+\*\*?)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <i key={i} className="opacity-80">{part.slice(2, -2)}</i>
    } else if (part.startsWith('*') && part.endsWith('*')) {
      return <i key={i} className="opacity-80">{part.slice(1, -1)}</i>
    }
    return part
  })
}

// ── Message Bubble ──
function MessageBubble({ content, avatarUrl, onAvatarTap }: { content: any /* eslint-disable-line @typescript-eslint/no-explicit-any */; avatarUrl?: string; onAvatarTap?: () => void }) {
  const pos = content.position || "LEFT"
  if (pos === "NARRATOR") {
    return (
      <div className="mx-auto my-2 max-w-md rounded-lg bg-muted/50 px-4 py-2 text-center text-sm italic text-muted-foreground whitespace-pre-wrap">
        {formatMessageText(content.text)}
      </div>
    )
  }
  const isRight = pos === "RIGHT"
  return (
    <div className={cn("flex gap-2 my-1 animate-msg-in", isRight ? "flex-row-reverse" : "flex-row")}>
      {!isRight && (
        <Avatar className="size-8 shrink-0 cursor-pointer" onClick={onAvatarTap}>
          <CachedAvatarImage src={avatarUrl} />
          <AvatarFallback>{(content.speakerName || "?")[0]}</AvatarFallback>
        </Avatar>
      )}
      <div className={cn("max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", isRight ? "bg-primary text-primary-foreground" : "bg-secondary")}>
        {!isRight && content.speakerName && (
          <p className="mb-1 text-xs font-medium text-muted-foreground">{content.speakerName}</p>
        )}
        <div className="whitespace-pre-wrap break-words">{formatMessageText(content.text)}</div>
      </div>
    </div>
  )
}

// ── Streaming dots ──
function StreamingDots() {
  return (
    <div className="flex items-center gap-2 my-1">
      <Avatar className="size-8 shrink-0"><AvatarFallback>…</AvatarFallback></Avatar>
      <div className="flex gap-1.5 rounded-2xl bg-secondary px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block size-2 rounded-full bg-muted-foreground" style={{ animation: `dot-pulse 1.2s infinite ${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}

// ── Recommend card ──
function RecommendCard({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      className="w-full rounded-lg border border-border/50 bg-secondary/50 px-3 py-2.5 text-left text-xs leading-relaxed transition-colors hover:border-primary/30 hover:bg-secondary"
      onClick={onClick}
    >
      {text}
    </button>
  )
}

export function ChatPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const [plotName, setPlotName] = useState(() => sessionStorage.getItem("chat_plot_name") || "チャット")
  const [plotImg, setPlotImg] = useState(() => sessionStorage.getItem("chat_plot_img") || "")

  const [messages, setMessages] = useState<any[]> /* eslint-disable-line @typescript-eslint/no-explicit-any */([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [headerSub, setHeaderSub] = useState("接続中")
  const [charAvatars, setCharAvatars] = useState<Record<string, string>>({})

  // Recommend
  const [recItems, setRecItems] = useState<any[]> /* eslint-disable-line @typescript-eslint/no-explicit-any */([])
  const [recVisible, setRecVisible] = useState(false)
  const [recQuota, setRecQuota] = useState<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */(null)
  const [recPage, setRecPage] = useState(0)
  const [recLoading, setRecLoading] = useState(false)

  // Streaming (for send)
  const [streamContents, setStreamContents] = useState<any[] | null> /* eslint-disable-line @typescript-eslint/no-explicit-any */(null)

  // Regen: inline streaming at a specific message
  const [regenMsgId, setRegenMsgId] = useState<string | null>(null)
  const [regenContents, setRegenContents] = useState<any[]> /* eslint-disable-line @typescript-eslint/no-explicit-any */([])
  const prevRegenMsgIdRef = useRef<string | null>(null)

  // Candidates cache: msgId -> { candidates, currentIdx }
  const [candidatesCache, setCandidatesCache] = useState<Record<string, { candidates: any[]; currentIdx: number }>> /* eslint-disable-line @typescript-eslint/no-explicit-any */({})

  // Edit mode
  const [editingMsg, setEditingMsg] = useState<{ id: string; candidateId: string } | null>(null)

  // Delete mode
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Scroll to bottom
  const [showScrollBottom, setShowScrollBottom] = useState(false)

  // New room initialization flow
  const [needsInit, setNeedsInit] = useState(false)
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)
  const [profileList, setProfileList] = useState<any[]> /* eslint-disable-line @typescript-eslint/no-explicit-any */([])
  const [profileLoading, setProfileLoading] = useState(false)
  const [plotId, setPlotId] = useState<string>("") // for profile selection

  // Plot detail overlay
  const [plotDetailOpen, setPlotDetailOpen] = useState(false)
  const [plotDetailData, setPlotDetailData] = useState<any> /* eslint-disable-line @typescript-eslint/no-explicit-any */(null)

  // Character detail sheet
  const [characterDetailOpen, setCharacterDetailOpen] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])

  // Lock body scroll to prevent iOS Safari "black space" bouncing
  useEffect(() => {
    const originalHtmlOverflow = document.documentElement.style.overflow
    const originalBodyOverflow = document.body.style.overflow
    const originalPosition = document.body.style.position
    const originalWidth = document.body.style.width
    const originalHeight = document.body.style.height

    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
    document.body.style.position = "fixed"
    document.body.style.width = "100%"
    document.body.style.height = "100%"
    
    const preventTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      // Allow scrolling inside ScrollArea, explicitly marked touch-scrollable containers, or Vaul Drawers
      if (
        target.closest('[data-radix-scroll-area-viewport]') || 
        target.closest('.touch-scrollable') || 
        target.closest('[data-vaul-drawer]')
      ) {
        return
      }
      
      if (target.tagName === 'TEXTAREA') {
        const ta = target as HTMLTextAreaElement
        // If textarea is not scrollable (single line or fits in view)
        if (ta.scrollHeight <= ta.clientHeight) {
          if (e.cancelable) e.preventDefault()
        }
        return // Let native touch scroll happen if scrollable
      }
      
      if (e.cancelable) e.preventDefault()
    }
    document.addEventListener("touchmove", preventTouchMove, { passive: false })

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow
      document.body.style.overflow = originalBodyOverflow
      document.body.style.position = originalPosition
      document.body.style.width = originalWidth
      document.body.style.height = originalHeight
      document.removeEventListener("touchmove", preventTouchMove)
    }
  }, [])

  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const initialLoadDone = useRef(false)
  const touchStateRef = useRef<{ x: number, y: number, isScrolling: boolean, isSwiping: boolean } | null>(null)
  const [lastSwipeDirection, setLastSwipeDirection] = useState<{ id: string, direction: "prev" | "next" | "regen" | null, key: number }>({ id: "", direction: null, key: 0 })
  const swipeKeyRef = useRef(0)

  // History pagination
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)



  const prevHeightRef = useRef<number>(0)

  const getViewport = useCallback(() => {
    const el = scrollRef.current
    if (!el) return null
    return el.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null
  }, [])

  // Track scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    const viewport = getViewport()
    if (!viewport) return

    const handleScroll = () => {
      const isNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 150
      setShowScrollBottom(!isNearBottom)
    }

    viewport.addEventListener("scroll", handleScroll, { passive: true })
    const resizeObserver = new ResizeObserver(() => handleScroll())
    if (viewport.firstElementChild) {
      resizeObserver.observe(viewport.firstElementChild)
    }
    handleScroll()

    return () => {
      viewport.removeEventListener("scroll", handleScroll)
      resizeObserver.disconnect()
    }
  }, [getViewport])

  const scrollToBottom = useCallback(() => {
    const doScroll = () => {
      const viewport = getViewport()
      if (viewport) viewport.scrollTop = viewport.scrollHeight
    }
    requestAnimationFrame(() => {
      doScroll()
      setTimeout(doScroll, 100)
      setTimeout(doScroll, 300)
    })
  }, [getViewport])

  const smoothScrollToBottom = useCallback(() => {
    const viewport = getViewport()
    if (!viewport) return

    const start = viewport.scrollTop
    const end = viewport.scrollHeight - viewport.clientHeight
    const distance = end - start
    
    if (distance <= 0) return

    // Dynamic duration based on distance (min 200ms, max 500ms)
    const duration = Math.min(200 + (distance / 1000) * 100, 500)
    const startTime = performance.now()

    // easeOutExpo for a fast initial speed and smooth deceleration
    const easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t)

    const animateScroll = (currentTime: number) => {
      // Re-calculate end in case height changed during animation
      const currentEnd = viewport.scrollHeight - viewport.clientHeight
      const currentDistance = currentEnd - start
      
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      viewport.scrollTop = start + currentDistance * easeOutExpo(progress)

      if (progress < 1) {
        requestAnimationFrame(animateScroll)
      } else {
        // Ensure it strictly hits the bottom
        viewport.scrollTop = viewport.scrollHeight
      }
    }
    requestAnimationFrame(animateScroll)
  }, [getViewport])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      const newHeight = Math.min(inputRef.current.scrollHeight, 112)
      inputRef.current.style.height = `${newHeight}px`
      
      if (prevHeightRef.current > 0 && prevHeightRef.current !== newHeight) {
        scrollToBottom()
      }
      prevHeightRef.current = newHeight
    }
  }, [inputValue, scrollToBottom])

  // Visual viewport synchronization for mobile keyboard gaps/overlaps
  useEffect(() => {
    if (!window.visualViewport) return
    let prevVpHeight = window.visualViewport.height
    const updateViewportHeight = () => {
      if (containerRef.current && window.visualViewport) {
        const newHeight = window.visualViewport.height
        const offsetTop = window.visualViewport.offsetTop
        
        containerRef.current.style.height = `${newHeight}px`
        containerRef.current.style.transform = `translateY(${offsetTop}px)`
        
        // If height changed (e.g. keyboard appeared), ensure we scroll to bottom
        if (prevVpHeight !== newHeight) {
          scrollToBottom()
        }
        prevVpHeight = newHeight
      }
    }
    updateViewportHeight()
    window.visualViewport.addEventListener("resize", updateViewportHeight)
    window.visualViewport.addEventListener("scroll", updateViewportHeight)
    return () => {
      window.visualViewport?.removeEventListener("resize", updateViewportHeight)
      window.visualViewport?.removeEventListener("scroll", updateViewportHeight)
    }
  }, [scrollToBottom])

  // Load initial messages (or detect new empty room)
  useEffect(() => {
    if (!roomId) return
    initialLoadDone.current = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasMoreHistory(true)
    setNeedsInit(false)

    getMessages(roomId, 50)
      .then(async (data) => {
        const msgs = data.messages || []
        if (msgs.length === 0) {
          // New empty room — start init flow
          setNeedsInit(true)
          try {
            // 1. Get intro messages preview
            const introData = await getIntroBeforeSelection(roomId)
            const introMsgs = introData.introMessages || []
            setMessages(introMsgs) // show intro in chat area

            // 2. Get room info for plotId
            const roomData = await getRoom(roomId)
            const pid = roomData?.plot?.id || ""
            setPlotId(pid)

            // Set avatars from room data
            const chars = roomData?.plot?.characters || []
            const avatars: Record<string, string> = {}
            chars.forEach((c: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => { if (c.name && c.imageUrl) avatars[c.name] = c.imageUrl })
            setCharAvatars(avatars)

            // 3. Get user profiles
            setProfileLoading(true)
            const profData = await getUserChatProfiles(20, { plotId: pid, roomId })
            setProfileList(profData.userChatProfiles || [])
            setProfileLoading(false)
            setProfileSheetOpen(true)
          } catch (e: unknown) {
            toast.error(`初期化失敗: ${(e instanceof Error ? e.message : String(e))}`)
          }
        } else {
          setMessages(msgs)
          if (msgs.length < 50) setHasMoreHistory(false)
        }
      })
      .catch((e: unknown) => toast.error(`メッセージ読み込み失敗: ${(e instanceof Error ? e.message : String(e))}`))
      .finally(() => setLoading(false))
  }, [roomId])

  // Auto-scroll to bottom only on initial load
  useEffect(() => {
    if (!loading && messages.length > 0 && !initialLoadDone.current) {
      initialLoadDone.current = true
      scrollToBottom()
    }
  }, [loading, messages, scrollToBottom])

  // Auto-scroll to bottom when regen completes (regenMsgId transitions from non-null to null)
  useEffect(() => {
    if (prevRegenMsgIdRef.current !== null && regenMsgId === null) {
      scrollToBottom()
    }
    prevRegenMsgIdRef.current = regenMsgId
  }, [regenMsgId, scrollToBottom])

  // Load older messages (upward scroll)
  const loadOlderMessages = useCallback(async () => {
    if (!roomId || loadingHistory || !hasMoreHistory || messages.length === 0) return
    const oldestMsg = messages[0]
    if (!oldestMsg?.id) return
    setLoadingHistory(true)
    try {
      const viewport = getViewport()
      const prevScrollHeight = viewport?.scrollHeight || 0
      const data = await getMessagesByCursor(roomId, oldestMsg.id, 30)
      const olderMsgs = data.messages || []
      if (olderMsgs.length === 0) {
        setHasMoreHistory(false)
      } else {
        // Deduplicate by id
        const existingIds = new Set(messages.map((m: Message) => m.id))
        const newMsgs = olderMsgs.filter((m: Message) => !existingIds.has(m.id))
        if (newMsgs.length === 0) {
          setHasMoreHistory(false)
        } else {
          setMessages((prev) => [...newMsgs, ...prev])
          if (olderMsgs.length < 30) setHasMoreHistory(false)
          // Preserve scroll position after prepending
          requestAnimationFrame(() => {
            if (viewport) {
              const newScrollHeight = viewport.scrollHeight
              viewport.scrollTop = newScrollHeight - prevScrollHeight
            }
          })
        }
      }
    } catch (e: unknown) {
      toast.error(`過去メッセージ取得失敗: ${(e instanceof Error ? e.message : String(e))}`)
    } finally {
      setLoadingHistory(false)
    }
  }, [roomId, loadingHistory, hasMoreHistory, messages, getViewport])

  // IntersectionObserver for top sentinel (load older messages)
  useEffect(() => {
    const sentinel = topSentinelRef.current
    const viewport = getViewport()
    if (!sentinel || !viewport || loading) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadOlderMessages() },
      { root: viewport, rootMargin: "200px 0px 0px 0px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loading, loadOlderMessages, getViewport])

  // Load room info (avatars, model)
  useEffect(() => {
    if (!roomId) return
    getRoom(roomId).then((room: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => {
      const chars = room?.plot?.characters || []
      const avatars: Record<string, string> = {}
      chars.forEach((c: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => { if (c.name && c.imageUrl) avatars[c.name] = c.imageUrl })
      setCharAvatars(avatars)
      setCharacters(chars)
      setPlotId(room?.plot?.id || "")

      const charImageUrls = chars.map((c: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => c.imageUrl).filter(Boolean)
      if (charImageUrls.length > 0) {
        preloadImages(charImageUrls, { priority: "high" }).catch(() => {})
      }

      // Update header from room data to fix stale sessionStorage bug
      const roomPlotName = room?.plot?.name || room?.title
      const roomPlotImg = room?.plot?.imageUrl
      if (roomPlotName) {
        setPlotName(roomPlotName)
        sessionStorage.setItem("chat_plot_name", roomPlotName)
      }
      if (roomPlotImg) {
        setPlotImg(roomPlotImg)
        sessionStorage.setItem("chat_plot_img", roomPlotImg)
      }
    }).catch(() => {})

    getRoomModelSetting(roomId).then((model: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => {
      if (model?.model || model?.type) setHeaderSub(`Model: ${model.model || model.type}`)
      else setHeaderSub("オンライン")
    }).catch(() => setHeaderSub("オンライン"))
  }, [roomId])

  // Handle profile selection for new room
  const handleProfileSelect = async (profile: UserChatProfile) => {
    if (!roomId) return
    try {
      //  {
      // 4. Select profile
      await selectUserChatProfile(profile.id, { plotId, roomId })
      // 5. Create intro (POST)
      await createIntro(roomId)
      // 6. Reload messages
      const data = await getMessages(roomId, 50)
      setMessages(data.messages || [])
      setNeedsInit(false)
      setProfileSheetOpen(false)
      toast.success(`「${profile.name}」で開始しました`)
      scrollToBottom()
    } catch (e: unknown) {
      toast.error(`チャット開始失敗: ${(e instanceof Error ? e.message : String(e))}`)
    }
  }

  // Handle avatar tap to open character detail sheet
  const handleAvatarTap = useCallback(async (characterName: string) => {
    const character = characters.find(c => c.name === characterName)
    if (!character) return
    setSelectedCharacter(character)
    setCharacterDetailOpen(true)
  }, [characters])

  // Send message
  const sendMessage = async () => {
    const text = inputValue.trim()
    if (sending || !roomId) return
    setSending(true)

    if (editingMsg) {
      try {
        await editMessage(roomId, editingMsg.id, editingMsg.candidateId, text)
        const data = await getMessages(roomId, 50)
        setMessages(data.messages || [])
        toast.success("メッセージを編集しました")
        setEditingMsg(null)
        setInputValue("")
        setRecVisible(false)
        setRecPage(0)
        setTimeout(scrollToBottom, 50)
      } catch (e: unknown) {
        toast.error(`編集失敗: ${(e instanceof Error ? e.message : String(e))}`)
      } finally {
        setSending(false)
        inputRef.current?.focus()
      }
      return
    }

    setInputValue("")
    setRecVisible(false)
    setRecPage(0)

    // Track if this is an empty message (for not showing user message)
    const isEmptyMessage = !text

    // Optimistic user message (only for non-empty messages)
    if (!isEmptyMessage) {
      const tempUserMsg = { id: `temp-user-${Date.now()}`, sender: { type: "USER" }, contents: [{ position: "RIGHT", text }] }
      setMessages((prev) => [...prev, tempUserMsg])
    }
    setStreamContents([])
    setTimeout(scrollToBottom, 30)

    try {
      let finalMessage: Message | null = null
      let accumulated: any[] /* eslint-disable-line @typescript-eslint/no-explicit-any */ = []
      await sendMessageStream(roomId, text,
        (event: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => {
          if (event.chunkMessage?.contents) accumulated = event.chunkMessage.contents
          if (event.replyMessage) { finalMessage = event.replyMessage; accumulated = event.replyMessage.contents || accumulated }
          setStreamContents([...accumulated])
          setTimeout(scrollToBottom, 10)
        },
        async () => {
          setStreamContents(null)
          if (finalMessage) {
            setMessages((prev) => [...prev, finalMessage])
          } else {
            const data = await getMessages(roomId, 50)
            setMessages(data.messages || [])
          }
          setRecItems([])
          setRecPage(0)
          setTimeout(scrollToBottom, 50)
        },
      )
    } catch (e: unknown) {
      toast.error(`送信失敗: ${(e instanceof Error ? e.message : String(e))}`)
      setStreamContents(null)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  // Ensure candidates are cached for a message (lazy-load on first interaction)
  const ensureCandidatesCached = useCallback(async (msgId: string): Promise<{ candidates: Candidate[]; currentIdx: number } | null> => {
    // Return from cache if available
    const cached = candidatesCache[msgId]
    if (cached) return cached
    if (!roomId) return null
    try {
      const data = await getCandidates(roomId, msgId)
      const candidates = data.candidates || []
      const currentMsg = messages.find((m) => m.id === msgId)
      const currentCandidateId = currentMsg?.candidateId
      const currentIdx = candidates.findIndex((c: Candidate) => c.id === currentCandidateId)
      const entry = { candidates, currentIdx: currentIdx >= 0 ? currentIdx : candidates.length - 1 }
      setCandidatesCache((prev) => ({ ...prev, [msgId]: entry }))
      return entry
    } catch (e: unknown) {
      console.warn("ensureCandidatesCached:", (e instanceof Error ? e.message : String(e)))
      return null
    }
  }, [roomId, candidatesCache, messages])

  // Regen: generate a new candidate via SSE, shown inline at the message position
  const handleRegen = async (msgId: string) => {
    if (!roomId) return
    swipeKeyRef.current += 1
    setLastSwipeDirection({ id: msgId, direction: "regen", key: swipeKeyRef.current })
    setRegenMsgId(msgId)
    setRegenContents([])
    try {
      let accumulated: any[] /* eslint-disable-line @typescript-eslint/no-explicit-any */ = []
      await regenMessageStream(roomId, msgId,
        (event: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => {
          if (event.chunkMessage?.contents) accumulated = event.chunkMessage.contents
          if (event.replyMessage) {
            accumulated = event.replyMessage.contents || accumulated
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
              setCandidatesCache((prev) => ({ ...prev, [msgId]: { candidates, currentIdx: newestIdx } }))
              // Optimistic local update: apply newest candidate contents to the message
              const newestContents = newest.contents || newest.content
              if (newestContents) {
                setMessages((prev) => prev.map((m) =>
                  m.id === msgId ? { ...m, contents: Array.isArray(newestContents) ? newestContents : [newestContents], candidateId: newest.id } : m
                ))
              } else {
                // Fallback: use streamed content
                setMessages((prev) => prev.map((m) =>
                  m.id === msgId ? { ...m, contents: accumulated, candidateId: newest.id } : m
                ))
              }
            }
          } catch (e: unknown) {
            console.warn("selectCandidate after regen:", (e instanceof Error ? e.message : String(e)))
            // Fallback: reload all messages
            const data = await getMessages(roomId, 50)
            setMessages(data.messages || [])
          }
          setRegenMsgId(null)
          setRegenContents([])
          toast.success("再生成しました")
        },
      )
    } catch (e: unknown) {
      toast.error(`再生成失敗: ${(e instanceof Error ? e.message : String(e))}`)
      setRegenMsgId(null)
      setRegenContents([])
    }
  }

  // Switch candidate on an existing message (optimized with cache)
  const handleSwitchCandidate = async (msgId: string, direction: "prev" | "next"): Promise<boolean> => {
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
      setLastSwipeDirection({ id: msgId, direction, key: swipeKeyRef.current })

      // Update cache index immediately
      setCandidatesCache((prev) => ({ ...prev, [msgId]: { ...prev[msgId], currentIdx: targetIdx } }))

      // Optimistic local update: apply candidate contents without reloading
      const targetContents = targetCandidate.contents || targetCandidate.content
      if (targetContents) {
        setMessages((prev) => prev.map((m) =>
          m.id === msgId ? { ...m, contents: Array.isArray(targetContents) ? targetContents : [targetContents], candidateId: targetCandidate.id } : m
        ))
      }

      // Fire selectCandidate in background (no await for instant UX)
      selectCandidate(roomId, msgId, targetCandidate.id).catch((e: unknown) => {
        console.warn("selectCandidate bg:", (e instanceof Error ? e.message : String(e)))
      })

      const el = document.getElementById(`msg-swipe-${msgId}`)
      if (el) {
        el.style.transition = 'none'
        el.style.transform = 'translateX(0px)'
      }

      setTimeout(scrollToBottom, 50)
      return true
    } catch (e: unknown) {
      toast.error(`候補切り替え失敗: ${(e instanceof Error ? e.message : String(e))}`)
      return false
    }
  }

  // Recommend
  const loadRecommendations = async (refresh = false) => {
    if (!roomId) return
    setRecLoading(true)
    try {
      if (refresh) await refreshRecommended(roomId)
      const data = await getRecommended(roomId)
      const raw = data.recommendedMessages || data.messages || []
      const items: any[] /* eslint-disable-line @typescript-eslint/no-explicit-any */ = []
      for (const entry of raw) {
        if (Array.isArray(entry.replies)) items.push(...entry.replies)
        else items.push(entry)
      }
      // If no items found, auto-generate new ones
      if (items.length === 0 && !refresh) {
        await loadRecommendations(true)
        return
      }
      setRecItems((prev) => {
        const combined = [...prev, ...items]
        // deduplicate by text
        const seen = new Set<string>()
        return combined.filter((it) => {
          const t = it?.text || it?.content || it?.message || ""
          if (!t || seen.has(t)) return false
          seen.add(t)
          return true
        })
      })
      const q = await getRecommendQuota().catch(() => null)
      setRecQuota(q)
    } catch (e: unknown) {
      toast.error(`推薦取得失敗: ${(e instanceof Error ? e.message : String(e))}`)
    } finally {
      setRecLoading(false)
    }
  }

  const getRecText = (item: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => item?.text || item?.content || item?.message || ""
  const pageItems = recItems.slice(recPage * 3, recPage * 3 + 3)

  // Delete messages from selected point onward
  const handleDeleteMessages = async () => {
    if (!roomId || !selectedMsgId) return
    setDeleting(true)
    try {
      await deleteMessages(roomId, selectedMsgId)
      const data = await getMessages(roomId, 50)
      setMessages(data.messages || [])
      toast.success("メッセージを削除しました")
      setDeleteMode(false)
      setSelectedMsgId(null)
      setTimeout(scrollToBottom, 50)
    } catch (e: unknown) {
      toast.error(`削除失敗: ${(e instanceof Error ? e.message : String(e))}`)
    } finally {
      setDeleting(false)
    }
  }

  const exitDeleteMode = () => {
    setDeleteMode(false)
    setSelectedMsgId(null)
  }

  const enterDeleteMode = async () => {
    setDeleteMode(true)
    if (!roomId) return
    try {
      const data = await getMessages(roomId, 50)
      setMessages(data.messages || [])
    } catch (e: unknown) {
      toast.error(`履歴の同期に失敗しました: ${(e instanceof Error ? e.message : String(e))}`)
    }
  }

  const insertAsterisk = () => {
    const el = inputRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const val = inputValue
    const newVal = val.slice(0, start) + "*" + val.slice(end)
    setInputValue(newVal)
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + 1
      el.focus()
    }, 0)
  }

  const handleHeaderClick = async () => {
    try {
      let currentPlotId = plotId
      if (!currentPlotId) {
        if (!roomId) return
        const roomData = await getRoom(roomId)
        currentPlotId = roomData?.plot?.id
        if (currentPlotId) setPlotId(currentPlotId)
      }
      if (!currentPlotId) {
        toast.error("プロット情報が見つかりません")
        return
      }
      
      if (!plotDetailData || plotDetailData.id !== currentPlotId) {
        const data = await getPlot(currentPlotId)
        setPlotDetailData(data)
      }
      setPlotDetailOpen(true)
    } catch (e: unknown) {
      toast.error(`プロット情報取得失敗: ${(e instanceof Error ? e.message : String(e))}`)
    }
  }

  const renderedMessages = useMemo(() => {
    // Only the last BOT message supports regen/candidate-switch/edit (API limitation)
    const lastBotMsgId = [...messages].reverse().find((m) => m.sender?.type === "BOT" && !m.isIntro)?.id || null
    return messages.map((msg) => {
      const isIntro = !!msg.isIntro
      const isLastBot = msg.id === lastBotMsgId
      const isSelected = deleteMode && selectedMsgId === msg.id
      const selectedIdx = deleteMode && selectedMsgId ? messages.findIndex((m: Message) => m.id === selectedMsgId) : -1
      const msgIdx = messages.indexOf(msg)
      const isAfterSelected = deleteMode && selectedIdx !== -1 && msgIdx > selectedIdx
      const isMarked = isSelected || isAfterSelected
      const isRegening = regenMsgId === msg.id
      // Check if next message is also marked (for seamless highlight block)
      const nextMsg = messages[msgIdx + 1]
      const nextIsMarked = deleteMode && selectedIdx !== -1 && nextMsg && messages.indexOf(nextMsg) >= selectedIdx
      const prevMsg = messages[msgIdx - 1]
      const prevIsMarked = deleteMode && selectedIdx !== -1 && prevMsg && messages.indexOf(prevMsg) >= selectedIdx
      return (
        <div
          key={msg.id}
          id={`msg-swipe-${msg.id}`}
          style={{ touchAction: 'pan-y' }}
          onTouchStart={(e) => {
            if (!deleteMode && isLastBot && !isIntro) {
              const el = document.getElementById(`msg-swipe-${msg.id}`)
              if (el) el.style.transition = 'none'
              touchStateRef.current = { 
                x: e.touches[0].clientX, 
                y: e.touches[0].clientY, 
                isScrolling: false, 
                isSwiping: false 
              }
            }
          }}
          onTouchMove={(e) => {
            if (!deleteMode && isLastBot && !isIntro && touchStateRef.current) {
              const state = touchStateRef.current
              const diffX = e.touches[0].clientX - state.x
              const diffY = e.touches[0].clientY - state.y
              
              if (!state.isSwiping && !state.isScrolling) {
                if (Math.abs(diffY) > 10) {
                  state.isScrolling = true
                } else if (Math.abs(diffX) > 10) {
                  state.isSwiping = true
                }
              }

              if (state.isSwiping) {
                const el = document.getElementById(`msg-swipe-${msg.id}`)
                if (el) {
                  el.style.transform = `translateX(${diffX}px)`
                }
              }
            }
          }}
          onTouchEnd={async (e) => {
            if (!deleteMode && isLastBot && !isIntro && touchStateRef.current) {
              const state = touchStateRef.current
              const el = document.getElementById(`msg-swipe-${msg.id}`)
              if (state.isSwiping && !state.isScrolling) {
                const diffX = e.changedTouches[0].clientX - state.x
                if (Math.abs(diffX) > 50) {
                  if (el) {
                     el.style.transition = 'transform 0.3s ease-out'
                     el.style.transform = `translateX(${diffX > 0 ? 100 : -100}vw)`
                  }
                  const success = await handleSwitchCandidate(msg.id, diffX > 0 ? "prev" : "next")
                  if (!success && el) {
                     el.style.transition = 'transform 0.3s ease-out'
                     el.style.transform = 'translateX(0px)'
                  }
                } else {
                  if (el) {
                     el.style.transition = 'transform 0.2s ease-out'
                     el.style.transform = 'translateX(0px)'
                  }
                }
              } else {
                if (el) {
                   el.style.transition = 'transform 0.2s ease-out'
                   el.style.transform = 'translateX(0px)'
                }
              }
              touchStateRef.current = null
            }
          }}
          onTouchCancel={() => {
            if (touchStateRef.current) touchStateRef.current = null
            const el = document.getElementById(`msg-swipe-${msg.id}`)
            if (el) {
               el.style.transition = 'transform 0.2s ease-out'
               el.style.transform = 'translateX(0px)'
            }
          }}
          className={cn(
            deleteMode && !isIntro && "cursor-pointer px-2 py-1 -mx-2 transition-colors border-2",
            deleteMode && isIntro && "px-2 py-1 -mx-2 opacity-40 cursor-not-allowed",
            deleteMode && !isMarked && !isIntro && "border-transparent rounded-lg hover:bg-destructive/10",
            isMarked && "bg-destructive/20 border-l-destructive border-r-destructive",
            isMarked && (prevIsMarked ? "border-t-transparent" : "rounded-t-lg border-t-destructive"),
            isMarked && (nextIsMarked ? "border-b-transparent" : "rounded-b-lg border-b-destructive"),
          )}
          onClick={() => { if (deleteMode && !isIntro) setSelectedMsgId(msg.id) }}
        >
          {/* Show inline regen streaming instead of original content */}
          {isRegening && regenContents.length > 0 ? (
            regenContents.map((c: any, ci: number) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => {
              if (c.type === "INFO_BOX") {
                return <InfoBox key={`regen-${ci}`} data={c as InfoBoxContent} charAvatars={charAvatars} />
              }
              return <MessageBubble key={`regen-${ci}`} content={c} avatarUrl={charAvatars[c.speakerName]} onAvatarTap={() => handleAvatarTap(c.speakerName)} />
            })
          ) : isRegening && regenContents.length === 0 ? (
            <StreamingDots />
          ) : (
            <div 
              key={`${msg.id}-${lastSwipeDirection.id === msg.id ? lastSwipeDirection.key : (msg.candidateId || 0)}`}
              className={cn(
                "animate-in duration-300",
                lastSwipeDirection.id === msg.id && lastSwipeDirection.direction === "next" ? "slide-in-from-right-full fade-in" : "",
                lastSwipeDirection.id === msg.id && lastSwipeDirection.direction === "prev" ? "slide-in-from-left-full fade-in" : "",
                (lastSwipeDirection.id !== msg.id || lastSwipeDirection.direction === "regen") ? "zoom-in-95 fade-in" : ""
              )}
            >
              {(msg.contents || []).map((c: any, ci: number) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => {
                if (c.type === "INFO_BOX") {
                  return <InfoBox key={ci} data={c as InfoBoxContent} charAvatars={charAvatars} />
                }
                return <MessageBubble key={ci} content={c} avatarUrl={c.position !== "RIGHT" ? charAvatars[c.speakerName] : undefined} onAvatarTap={() => c.position !== "RIGHT" && handleAvatarTap(c.speakerName)} />
              })}
            </div>
          )}
          {/* BOT message controls: regen + candidate nav + edit (last BOT message only) */}
          {!deleteMode && isLastBot && !isIntro && !isRegening && (() => {
            const cache = candidatesCache[msg.id]
            const candCount = cache?.candidates?.length || 0
            const candIdx = cache?.currentIdx ?? -1
            return (
              <div className="mb-2 ml-10 flex flex-wrap items-center gap-1">
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={() => handleRegen(msg.id)} aria-label="再生成">
                  <RefreshCw className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={() => handleSwitchCandidate(msg.id, "prev")} aria-label="前の候補">
                  <ChevronLeft className="size-3.5" />
                </Button>
                {candCount > 1 && (
                  <span className="text-[10px] tabular-nums text-muted-foreground min-w-6 text-center select-none">
                    {candIdx + 1}/{candCount}
                  </span>
                )}
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={() => handleSwitchCandidate(msg.id, "next")} aria-label="次の候補">
                  <ChevronRight className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={() => {
                  const txt = msg.contents?.map((c: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => {
                    if (c.position === "NARRATOR" || c.speakerName === "ナレーター") {
                      return `@: ${c.text.trim()}`;
                    } else if (c.speakerName) {
                      return `@${c.speakerName}: ${c.text.trim()}`;
                    }
                    return `@: ${c.text.trim()}`;
                  }).join('\n\n') || ''
                  setEditingMsg({ id: msg.id, candidateId: msg.candidateId })
                  setInputValue(txt)
                  setTimeout(() => inputRef.current?.focus(), 0)
                }} aria-label="編集">
                  <Pencil className="size-3.5" />
                </Button>
              </div>
            )
          })()}
        </div>
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, deleteMode, selectedMsgId, regenMsgId, regenContents, charAvatars, candidatesCache, lastSwipeDirection])

  return (
    <div ref={containerRef} className="fixed top-0 left-0 w-full h-[100dvh] flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-20 flex items-center gap-3 border-b border-border px-3 py-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rooms")} aria-label="戻る">
          <ArrowLeft className="size-5" />
        </Button>
        <Avatar className="size-9">
          <CachedAvatarImage src={plotImg} alt={plotName} />
          <AvatarFallback>{plotName[0]}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 cursor-pointer" onClick={handleHeaderClick}>
          <p className="truncate text-sm font-semibold">{plotName}</p>
          <p className="truncate text-xs text-muted-foreground">{headerSub}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => { if (deleteMode) exitDeleteMode(); else enterDeleteMode() }} aria-label="削除モード" className={cn(deleteMode && "text-destructive")}>
          <Trash2 className="size-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">退出</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>チャットから退出</AlertDialogTitle>
              <AlertDialogDescription>このチャットから退出しますか？メッセージは削除されます。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={async () => {
                try { await deleteRoom(roomId!); toast.success("退出しました"); navigate("/rooms") }
                catch (e: unknown) { toast.error(`退出失敗: ${(e instanceof Error ? e.message : String(e))}`) }
              }}>退出</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="min-h-0 flex-1">
        {loading ? (
          <div className="flex flex-col gap-3 px-4 py-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("flex gap-2", i % 2 === 1 ? "flex-row-reverse" : "")}>
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className={cn("h-12 rounded-2xl", i % 2 === 1 ? "w-1/3" : "w-2/3")} />
              </div>
            ))}
          </div>
        ) : (
          <div aria-live="polite" className="px-4 py-3">
            {/* Top sentinel for loading older messages */}
            <div ref={topSentinelRef} className="flex justify-center py-2">
              {loadingHistory && <Spinner className="size-5" />}
              {!hasMoreHistory && messages.length > 0 && (
                <p className="text-xs text-muted-foreground">最初のメッセージです</p>
              )}
            </div>
            {renderedMessages}
            {streamContents !== null && (
              streamContents.length === 0
                ? <StreamingDots />
                : streamContents.map((c: any, ci: number) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => {
                    if (c.type === "INFO_BOX") {
                      return <InfoBox key={`stream-${ci}`} data={c as InfoBoxContent} charAvatars={charAvatars} />
                    }
                    return <MessageBubble key={`stream-${ci}`} content={c} avatarUrl={charAvatars[c.speakerName]} onAvatarTap={() => handleAvatarTap(c.speakerName)} />
                  })
            )}
          </div>
        )}
      </ScrollArea>

      {/* Scroll to bottom button */}
      <div className="relative w-full h-0 pointer-events-none">
        {showScrollBottom && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute bottom-4 right-4 z-30 rounded-full shadow-md border border-border opacity-90 hover:opacity-100 pointer-events-auto animate-in fade-in zoom-in duration-200"
            onClick={smoothScrollToBottom}
            aria-label="最下部へ"
          >
            <ArrowDown className="size-5" />
          </Button>
        )}
      </div>

      {/* Delete mode floating action sheet */}
      {deleteMode && (
        <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2 animate-slide-up">
          <div className="glass flex items-center gap-3 rounded-2xl border border-destructive/30 px-5 py-3 shadow-lg shadow-destructive/10">
            <div className="text-sm whitespace-nowrap">
              {selectedMsgId
                ? <span className="text-destructive font-medium">選択以降を削除</span>
                : <span className="text-muted-foreground">メッセージをタップ</span>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-full" onClick={exitDeleteMode}>キャンセル</Button>
              <Button variant="destructive" size="sm" className="rounded-full" disabled={!selectedMsgId || deleting} onClick={handleDeleteMessages}>
                {deleting && <Spinner className="mr-1 size-3" />}
                削除
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Recommend panel */}
      {recVisible && (
        <div className="border-t border-border bg-card/80 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium">推薦文</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {recQuota ? `${recQuota.remainCount ?? recQuota.remainingCount ?? "-"}/${recQuota.totalCount ?? "-"}` : ""}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {recLoading ? (
              <div className="flex items-center justify-center py-3">
                <Spinner className="size-4" />
                <span className="ml-2 text-xs text-muted-foreground">取得中…</span>
              </div>
            ) : pageItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">推薦文がありません</p>
            ) : (
              pageItems.map((item: any, i: number) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => (
                <RecommendCard key={`${recPage}-${i}`} text={getRecText(item)} onClick={() => { setInputValue(getRecText(item)); setRecVisible(false); inputRef.current?.focus() }} />
              ))
            )}
          </div>
          <div className="mt-2 flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={recPage <= 0}
              onClick={() => setRecPage((p) => Math.max(0, p - 1))}
              aria-label="前の推薦文"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums min-w-8 text-center">
              {recItems.length > 0 ? `${recPage + 1}/${Math.ceil(recItems.length / 3)}` : "-"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={recLoading}
              onClick={() => {
                const maxPage = Math.max(0, Math.ceil(recItems.length / 3) - 1)
                if (recPage >= maxPage) {
                  // At the last page — generate new recommendations
                  loadRecommendations(true)
                  setRecPage(maxPage + 1)
                } else {
                  setRecPage((p) => p + 1)
                }
              }}
              aria-label="次の推薦文"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Input area */}
      {needsInit ? (
        <div className="border-t border-border px-4 py-4 text-center">
          <p className="text-sm text-muted-foreground">プロフィールを選択してチャットを開始してください</p>
          {!profileSheetOpen && (
            <Button size="sm" className="mt-2" onClick={() => setProfileSheetOpen(true)}>プロフィールを選択</Button>
          )}
        </div>
      ) : (
        <div className="glass border-t border-border px-3 py-2">
          {editingMsg && (
            <div className="mb-2 flex items-center justify-between text-xs text-primary px-1">
              <span>メッセージを編集中...</span>
              <Button variant="ghost" size="sm" className="h-5 px-2 text-muted-foreground hover:text-foreground" onClick={() => {
                setEditingMsg(null)
                setInputValue("")
              }}>キャンセル</Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className={cn("shrink-0", recVisible && "text-primary")} onClick={() => {
              setRecVisible((v) => !v)
              if (!recVisible && recItems.length === 0) loadRecommendations()
            }} aria-label="推薦文">
              <Star className="size-5" />
            </Button>
            <div className="relative flex-1">
              <Textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="メッセージを入力..."
                className="min-h-10 max-h-28 resize-none border-0 bg-secondary/50 text-sm pr-9 overscroll-contain"
                rows={1}
                style={{ fontSize: "16px" }}
              />
              <Button
                variant="outline"
                size="icon"
                className="absolute right-1 top-0 bottom-0 my-auto size-8 rounded-full bg-secondary shadow-sm text-foreground hover:bg-secondary/80"
                onClick={insertAsterisk}
                aria-label="アスタリスクを挿入"
              >
                <Asterisk className="size-4" />
              </Button>
            </div>
            <Button size="icon" disabled={sending} onClick={sendMessage} aria-label="送信">
              {sending ? <Spinner className="size-4" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Profile selection bottom sheet (new room only) */}
      <ProfileSelectSheet
        profiles={profileList}
        open={profileSheetOpen}
        onSelect={handleProfileSelect}
        loading={profileLoading}
      />

      {/* Plot Detail Overlay */}
      <PlotDetailDialog 
        plot={plotDetailData} 
        open={plotDetailOpen} 
        onOpenChange={setPlotDetailOpen} 
      />

      {/* Character Detail Sheet */}
      <CharacterDetailSheet
        character={selectedCharacter}
        plotId={plotId}
        open={characterDetailOpen}
        onOpenChange={setCharacterDetailOpen}
      />
    </div>
  )
}
