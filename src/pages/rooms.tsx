import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CachedAvatarImage } from "@/components/cached-avatar-image"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { getNextRoomsCursor, getRooms } from "@/lib/api"
import { formatMessageText } from "@/lib/format-message"
import type { Room, Message } from "@/lib/types"

const PAGE_SIZE = 30

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "たった今"
  if (m < 60) return `${m}分前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}時間前`
  return `${Math.floor(h / 24)}日前`
}

function getPreview(lastMessage: Message | undefined) {
  const contents = lastMessage?.contents
  if (!contents?.length) return ""
  const c = contents[0]
  const name = c.speakerName || ""
  const text = (c.text || "").replace(/\n/g, " ")
  return name ? `${name}: ${text}` : text
}

function appendUniqueRooms(prev: Room[], incoming: Room[]): Room[] {
  const seen = new Set(prev.map((r) => r.id))
  const fresh: Room[] = []
  for (const room of incoming) {
    if (seen.has(room.id)) continue
    seen.add(room.id)
    fresh.push(room)
  }
  return [...prev, ...fresh]
}

export function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    getRooms(PAGE_SIZE)
      .then((data) => {
        if (cancelled) return
        setRooms(data.rooms || [])
        setNextCursor(getNextRoomsCursor(data))
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          toast.error(
            `読み込み失敗: ${e instanceof Error ? e.message : String(e)}`
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await getRooms(PAGE_SIZE, nextCursor)
      const merged = appendUniqueRooms(rooms, data.rooms || [])
      setRooms(merged)
      const cursor = getNextRoomsCursor(data)
      // Stop on a repeated cursor or a page with no new rooms; otherwise the
      // sentinel keeps firing when the API ignores `cursor`.
      const addedNew = merged.length > rooms.length
      setNextCursor(cursor === nextCursor || !addedNew ? null : cursor)
    } catch (e: unknown) {
      toast.error(`読み込み失敗: ${e instanceof Error ? e.message : String(e)}`)
      setNextCursor(null)
    } finally {
      setLoadingMore(false)
    }
  }, [rooms, nextCursor, loading, loadingMore])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !nextCursor) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore()
      },
      { rootMargin: "300px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // `loading` gates the sentinel's mount, so re-attach once the list shows.
  }, [nextCursor, loading, loadMore])

  const rememberRoom = (room: Room) => {
    const plot = room.plot
    sessionStorage.setItem("chat_plot_name", plot?.name || room.title || "")
    sessionStorage.setItem("chat_plot_img", plot?.imageUrl || "")
  }

  return (
    <div className="animate-fade-in">
      <header className="px-5 pt-[max(18px,env(safe-area-inset-top))] pb-3">
        <h1 className="text-2xl font-bold">チャット</h1>
      </header>

      <div className="px-5">
        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <p>チャットルームがありません</p>
          </div>
        ) : (
          <div className="flex flex-col overflow-x-hidden">
            {rooms.map((room, i) => {
              const plot = room.plot
              const lastMessage = room.lastMessage
              const preview = getPreview(lastMessage)
              const time = lastMessage?.createdAt
                ? timeAgo(lastMessage.createdAt)
                : ""
              return (
                <div key={room.id}>
                  <Link
                    to={`/chat/${room.id}`}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-secondary/50"
                    onClick={() => rememberRoom(room)}
                  >
                    <Avatar className="size-12 flex-shrink-0">
                      <CachedAvatarImage src={plot?.imageUrl} alt={plot?.name} />
                      <AvatarFallback>{(plot?.name || "?")[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-medium">
                          {room.title || plot?.name || "チャット"}
                        </span>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                          {time}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {formatMessageText(preview)}
                      </p>
                    </div>
                    {(room.unreadCount || 0) > 0 && (
                      <Badge className="ml-1 shrink-0 tabular-nums">
                        {room.unreadCount}
                      </Badge>
                    )}
                  </Link>
                  {i < rooms.length - 1 && (
                    <Separator className="ml-17 w-[calc(100%-68px)]" />
                  )}
                </div>
              )
            })}
            {nextCursor && (
              <div
                ref={sentinelRef}
                className="flex justify-center py-4 text-xs text-muted-foreground"
                aria-live="polite"
              >
                {loadingMore ? "読み込み中…" : ""}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
