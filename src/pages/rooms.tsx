import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { getRooms } from "@/lib/api"

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "たった今"
  if (m < 60) return `${m}分前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}時間前`
  return `${Math.floor(h / 24)}日前`
}

function getPreview(lastMessage: any) {
  if (!lastMessage?.contents?.length) return ""
  const c = lastMessage.contents[0]
  const name = c.speakerName || ""
  const text = (c.text || "").slice(0, 50).replace(/\n/g, " ")
  return name ? `${name}: ${text}` : text
}

export function RoomsPage() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRooms(30)
      .then((data) => setRooms(data.rooms || []))
      .catch((e: any) => toast.error(`読み込み失敗: ${e.message}`))
      .finally(() => setLoading(false))
  }, [])

  const handleClick = (room: any) => {
    const plot = room.plot || {}
    sessionStorage.setItem("chat_plot_name", plot.name || room.title || "")
    sessionStorage.setItem("chat_plot_img", plot.imageUrl || "")
    navigate(`/chat/${room.id}`)
  }

  return (
    <div className="animate-fade-in">
      <header className="px-5 pt-[max(18px,env(safe-area-inset-top))] pb-3">
        <h1 className="text-2xl font-bold">チャット</h1>
        <p className="text-sm text-muted-foreground">会話の一覧</p>
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
          <div className="flex flex-col">
            {rooms.map((room, i) => {
              const plot = room.plot || {}
              const preview = getPreview(room.lastMessage)
              const time = room.lastMessage?.messageTime ? timeAgo(room.lastMessage.messageTime) : ""
              return (
                <div key={room.id}>
                  <button
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-secondary/50"
                    onClick={() => handleClick(room)}
                  >
                    <Avatar className="size-12 flex-shrink-0">
                      <AvatarImage src={plot.imageUrl} alt={plot.name} />
                      <AvatarFallback>{(plot.name || "?")[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-medium">{room.title || plot.name || "チャット"}</span>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">{time}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{preview}</p>
                    </div>
                    {room.unreadCount > 0 && (
                      <Badge className="ml-1 shrink-0 tabular-nums">{room.unreadCount}</Badge>
                    )}
                  </button>
                  {i < rooms.length - 1 && <Separator className="ml-17" />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
