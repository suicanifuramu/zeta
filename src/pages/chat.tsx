import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Asterisk, ChevronLeft, ChevronRight, RefreshCw, Send, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import {
  createIntro, deleteMessages, deleteRoom, getCandidates, getIntroBeforeSelection,
  getMessages, getMessagesByCursor, getPlot, getRecommended,
  getRecommendQuota, getRoom, getRoomModelSetting,
  getUserChatProfiles, refreshRecommended, regenMessageStream,
  selectCandidate, selectUserChatProfile, sendMessageStream,
} from "@/lib/api"
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
function MessageBubble({ content, avatarUrl }: { content: any; avatarUrl?: string }) {
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
        <Avatar className="size-8 shrink-0">
          <AvatarImage src={avatarUrl} />
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
  const plotName = sessionStorage.getItem("chat_plot_name") || "チャット"
  const plotImg = sessionStorage.getItem("chat_plot_img") || ""

  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [headerSub, setHeaderSub] = useState("接続中")
  const [charAvatars, setCharAvatars] = useState<Record<string, string>>({})

  // Recommend
  const [recItems, setRecItems] = useState<any[]>([])
  const [recVisible, setRecVisible] = useState(false)
  const [recQuota, setRecQuota] = useState<any>(null)
  const [recPage, setRecPage] = useState(0)
  const [recLoading, setRecLoading] = useState(false)

  // Streaming (for send)
  const [streamContents, setStreamContents] = useState<any[] | null>(null)

  // Regen: inline streaming at a specific message
  const [regenMsgId, setRegenMsgId] = useState<string | null>(null)
  const [regenContents, setRegenContents] = useState<any[]>([])

  // Delete mode
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // New room initialization flow
  const [needsInit, setNeedsInit] = useState(false)
  const [initIntroMsgs, setInitIntroMsgs] = useState<any[]>([])
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)
  const [profileList, setProfileList] = useState<any[]>([])
  const [profileLoading, setProfileLoading] = useState(false)
  const [plotId, setPlotId] = useState<string>("") // for profile selection

  // Plot detail overlay
  const [plotDetailOpen, setPlotDetailOpen] = useState(false)
  const [plotDetailData, setPlotDetailData] = useState<any>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const initialLoadDone = useRef(false)

  // History pagination
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const getViewport = useCallback(() => {
    const el = scrollRef.current
    if (!el) return null
    return el.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null
  }, [])

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

  // Load initial messages (or detect new empty room)
  useEffect(() => {
    if (!roomId) return
    initialLoadDone.current = false
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
            setInitIntroMsgs(introMsgs)
            setMessages(introMsgs) // show intro in chat area

            // 2. Get room info for plotId
            const roomData = await getRoom(roomId)
            const pid = roomData?.plot?.id || ""
            setPlotId(pid)

            // Set avatars from room data
            const chars = roomData?.plot?.characters || []
            const avatars: Record<string, string> = {}
            chars.forEach((c: any) => { if (c.name && c.imageUrl) avatars[c.name] = c.imageUrl })
            setCharAvatars(avatars)

            // 3. Get user profiles
            setProfileLoading(true)
            const profData = await getUserChatProfiles(20, { plotId: pid, roomId })
            setProfileList(profData.userChatProfiles || [])
            setProfileLoading(false)
            setProfileSheetOpen(true)
          } catch (e: any) {
            toast.error(`初期化失敗: ${e.message}`)
          }
        } else {
          setMessages(msgs)
          if (msgs.length < 50) setHasMoreHistory(false)
        }
      })
      .catch((e: any) => toast.error(`メッセージ読み込み失敗: ${e.message}`))
      .finally(() => setLoading(false))
  }, [roomId])

  // Auto-scroll to bottom only on initial load
  useEffect(() => {
    if (!loading && messages.length > 0 && !initialLoadDone.current) {
      initialLoadDone.current = true
      scrollToBottom()
    }
  }, [loading, messages, scrollToBottom])

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
        const existingIds = new Set(messages.map((m: any) => m.id))
        const newMsgs = olderMsgs.filter((m: any) => !existingIds.has(m.id))
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
    } catch (e: any) {
      toast.error(`過去メッセージ取得失敗: ${e.message}`)
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
    getRoom(roomId).then((room: any) => {
      const chars = room?.plot?.characters || []
      const avatars: Record<string, string> = {}
      chars.forEach((c: any) => { if (c.name && c.imageUrl) avatars[c.name] = c.imageUrl })
      setCharAvatars(avatars)
    }).catch(() => {})

    getRoomModelSetting(roomId).then((model: any) => {
      if (model?.model || model?.type) setHeaderSub(`Model: ${model.model || model.type}`)
      else setHeaderSub("オンライン")
    }).catch(() => setHeaderSub("オンライン"))
  }, [roomId])

  // Handle profile selection for new room
  const handleProfileSelect = async (profile: any) => {
    if (!roomId) return
    try {
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
    } catch (e: any) {
      toast.error(`チャット開始失敗: ${e.message}`)
    }
  }

  // Send message
  const sendMessage = async () => {
    const text = inputValue.trim()
    if (!text || sending || !roomId) return
    setSending(true)
    setInputValue("")

    // Optimistic user message
    const tempUserMsg = { id: `temp-user-${Date.now()}`, sender: { type: "USER" }, contents: [{ position: "RIGHT", text }] }
    setMessages((prev) => [...prev, tempUserMsg])
    setStreamContents([])
    setTimeout(scrollToBottom, 30)

    try {
      let finalMessage: any = null
      let accumulated: any[] = []
      await sendMessageStream(roomId, text,
        (event: any) => {
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
          setTimeout(scrollToBottom, 50)
        },
      )
    } catch (e: any) {
      toast.error(`送信失敗: ${e.message}`)
      setStreamContents(null)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  // Regen: generate a new candidate via SSE, shown inline at the message position
  const handleRegen = async (msgId: string) => {
    if (!roomId) return
    setRegenMsgId(msgId)
    setRegenContents([])
    try {
      let accumulated: any[] = []
      await regenMessageStream(roomId, msgId,
        (event: any) => {
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
            if (candidates.length > 0) {
              const newest = candidates[candidates.length - 1]
              await selectCandidate(roomId, msgId, newest.id)
            }
          } catch (e: any) {
            console.warn("selectCandidate after regen:", e.message)
          }
          // Reload messages to reflect the new selection
          const data = await getMessages(roomId, 50)
          setMessages(data.messages || [])
          setRegenMsgId(null)
          setRegenContents([])
          toast.success("再生成しました")
        },
      )
    } catch (e: any) {
      toast.error(`再生成失敗: ${e.message}`)
      setRegenMsgId(null)
      setRegenContents([])
    }
  }

  // Switch candidate on an existing message
  const handleSwitchCandidate = async (msgId: string, direction: "prev" | "next") => {
    if (!roomId) return
    try {
      const data = await getCandidates(roomId, msgId)
      const candidates = data.candidates || []
      if (candidates.length <= 1) {
        if (direction === "next") {
          handleRegen(msgId)
        } else {
          toast.info("候補がありません")
        }
        return
      }
      // Find current candidate index
      const currentMsg = messages.find((m: any) => m.id === msgId)
      const currentCandidateId = currentMsg?.candidateId
      const currentIdx = candidates.findIndex((c: any) => c.id === currentCandidateId)
      let targetIdx: number
      if (direction === "next") {
        if (currentIdx >= candidates.length - 1) {
          // At the last candidate, regen a new one
          handleRegen(msgId)
          return
        }
        targetIdx = currentIdx + 1
      } else {
        if (currentIdx <= 0) {
          toast.info("最初の候補です")
          return
        }
        targetIdx = currentIdx - 1
      }
      await selectCandidate(roomId, msgId, candidates[targetIdx].id)
      const msgs = await getMessages(roomId, 50)
      setMessages(msgs.messages || [])
    } catch (e: any) {
      toast.error(`候補切り替え失敗: ${e.message}`)
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
      const items: any[] = []
      for (const entry of raw) {
        if (Array.isArray(entry.replies)) items.push(...entry.replies)
        else items.push(entry)
      }
      // If no items found, auto-generate new ones
      if (items.length === 0 && !refresh) {
        return loadRecommendations(true)
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
    } catch (e: any) {
      toast.error(`推薦取得失敗: ${e.message}`)
    } finally {
      setRecLoading(false)
    }
  }

  const getRecText = (item: any) => item?.text || item?.content || item?.message || ""
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
    } catch (e: any) {
      toast.error(`削除失敗: ${e.message}`)
    } finally {
      setDeleting(false)
    }
  }

  const exitDeleteMode = () => {
    setDeleteMode(false)
    setSelectedMsgId(null)
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
    } catch (e: any) {
      toast.error(`プロット情報取得失敗: ${e.message}`)
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-20 flex items-center gap-3 border-b border-border px-3 py-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rooms")} aria-label="戻る">
          <ArrowLeft className="size-5" />
        </Button>
        {plotImg && (
          <Avatar className="size-9">
            <AvatarImage src={plotImg} />
            <AvatarFallback>{plotName[0]}</AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0 flex-1 cursor-pointer" onClick={handleHeaderClick}>
          <p className="truncate text-sm font-semibold">{plotName}</p>
          <p className="truncate text-xs text-muted-foreground">{headerSub}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => { deleteMode ? exitDeleteMode() : setDeleteMode(true) }} aria-label="削除モード" className={cn(deleteMode && "text-destructive")}>
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
                catch (e: any) { toast.error(`退出失敗: ${e.message}`) }
              }}>退出</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="min-h-0 flex-1 px-4 py-3">
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("flex gap-2", i % 2 === 1 ? "flex-row-reverse" : "")}>
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className={cn("h-12 rounded-2xl", i % 2 === 1 ? "w-1/3" : "w-2/3")} />
              </div>
            ))}
          </div>
        ) : (
          <div aria-live="polite">
            {/* Top sentinel for loading older messages */}
            <div ref={topSentinelRef} className="flex justify-center py-2">
              {loadingHistory && <Spinner className="size-5" />}
              {!hasMoreHistory && messages.length > 0 && (
                <p className="text-xs text-muted-foreground">最初のメッセージです</p>
              )}
            </div>
             {messages.map((msg) => {
              const isIntro = !!msg.isIntro
              const isBot = msg.sender?.type === "BOT"
              const isSelected = deleteMode && selectedMsgId === msg.id
              const selectedIdx = deleteMode && selectedMsgId ? messages.findIndex((m: any) => m.id === selectedMsgId) : -1
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
                  className={cn(
                    deleteMode && !isIntro && "cursor-pointer px-2 py-1 -mx-2 transition-colors",
                    deleteMode && isIntro && "px-2 py-1 -mx-2 opacity-40 cursor-not-allowed",
                    isMarked && "bg-destructive/20",
                    isMarked && !prevIsMarked && "rounded-t-lg",
                    isMarked && !nextIsMarked && "rounded-b-lg",
                    deleteMode && !isMarked && !isIntro && "rounded-lg hover:bg-destructive/10",
                  )}
                  onClick={() => { if (deleteMode && !isIntro) setSelectedMsgId(msg.id) }}
                >
                  {/* Show inline regen streaming instead of original content */}
                  {isRegening && regenContents.length > 0 ? (
                    regenContents.map((c: any, ci: number) => (
                      <MessageBubble key={`regen-${ci}`} content={c} avatarUrl={charAvatars[c.speakerName]} />
                    ))
                  ) : isRegening && regenContents.length === 0 ? (
                    <StreamingDots />
                  ) : (
                    (msg.contents || []).map((c: any, ci: number) => (
                      <MessageBubble key={ci} content={c} avatarUrl={c.position !== "RIGHT" ? charAvatars[c.speakerName] : undefined} />
                    ))
                  )}
                  {/* BOT message controls: regen + candidate nav */}
                  {!deleteMode && isBot && !isIntro && !isRegening && (
                    <div className="mb-2 ml-10 flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => handleRegen(msg.id)}>
                        <RefreshCw className="mr-1 size-3" /> 再生成
                      </Button>
                      <Button variant="ghost" size="icon" className="size-6 text-muted-foreground" onClick={() => handleSwitchCandidate(msg.id, "prev")} aria-label="前の候補">
                        <ChevronLeft className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-6 text-muted-foreground" onClick={() => handleSwitchCandidate(msg.id, "next")} aria-label="次の候補">
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
            {streamContents !== null && (
              streamContents.length === 0
                ? <StreamingDots />
                : streamContents.map((c: any, ci: number) => (
                    <MessageBubble key={`stream-${ci}`} content={c} avatarUrl={charAvatars[c.speakerName]} />
                  ))
            )}
          </div>
        )}
      </ScrollArea>

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
              pageItems.map((item: any, i: number) => (
                <RecommendCard key={`${recPage}-${i}`} text={getRecText(item)} onClick={() => { setInputValue(getRecText(item)); inputRef.current?.focus() }} />
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
                className="min-h-10 max-h-28 resize-none border-0 bg-secondary/50 text-sm pr-9"
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
            <Button size="icon" disabled={!inputValue.trim() || sending} onClick={sendMessage} aria-label="送信">
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
    </div>
  )
}
