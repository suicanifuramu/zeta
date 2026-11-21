import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { CachedAvatarImage } from "@/components/cached-avatar-image"
import { getNextRoomsCursor, getRooms } from "@/lib/api"
import {
  buildExportRoomJson,
  downloadRoomJson,
} from "@/lib/message-export"
import type { Room } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"

interface MessageExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ROOM_PAGE_SIZE = 100
// Upper bound so a misbehaving cursor can't loop forever.
const MAX_ROOM_PAGES = 50

/** Fetches every room page. Stops when there is no cursor, it repeats, or a page adds nothing new. */
async function fetchAllRooms(): Promise<Room[]> {
  const all: Room[] = []
  const seen = new Set<string>()
  let cursor: string | undefined
  for (let page = 0; page < MAX_ROOM_PAGES; page++) {
    const data = await getRooms(ROOM_PAGE_SIZE, cursor)
    let added = 0
    for (const room of data.rooms || []) {
      if (seen.has(room.id)) continue
      seen.add(room.id)
      all.push(room)
      added++
    }
    const next = getNextRoomsCursor(data)
    if (!next || next === cursor || added === 0) break
    cursor = next
  }
  return all
}

export function MessageExportDialog({
  open,
  onOpenChange,
}: MessageExportDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const selectAllRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetchAllRooms()
      .then((all) => {
        if (!cancelled) setRooms(all)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          toast.error(
            `ルーム一覧の取得に失敗: ${e instanceof Error ? e.message : String(e)}`
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open ])

  useEffect(() => {
    if (!open) {
      setSelected(new Set())
      setProgress({ done: 0, total: 0 })
    }
  }, [open ])

  const allChecked = rooms.length > 0 && selected.size === rooms.length
  const someChecked = selected.size > 0 && selected.size < rooms.length

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked
    }
  }, [someChecked])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(rooms.map((r) => r.id)))
  }

  const handleExport = async () => {
    if (exporting || selected.size === 0) return
    const targets = rooms.filter((r) => selected.has(r.id))
    setExporting(true)
    setProgress({ done: 0, total: targets.length })
    let failed = 0
    for (let i = 0; i < targets.length; i++) {
      const room = targets[i]
      try {
        const data = await buildExportRoomJson(room)
        downloadRoomJson(room.id, data)
      } catch (e: unknown) {
        failed++
        toast.error(
          `エクスポート失敗 (${room.title || room.id}): ${e instanceof Error ? e.message : String(e)}`
        )
      }
      setProgress({ done: i + 1, total: targets.length })
      // 複数ダウンロードのブロック回避のため少し間を空ける
      if (i < targets.length - 1) {
        await new Promise((r) => setTimeout(r, 300))
      }
    }
    setExporting(false)
    if (failed === 0) {
      toast.success(`${targets.length}件のルームをエクスポートしました`)
      onOpenChange(false)
    } else {
      toast.error(`${failed}件のエクスポートに失敗しました`)
    }
  }

  const content = (
    <div className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-5 pt-4 pb-2">
        <h2 className="text-lg font-semibold">メッセージエクスポート</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          選択したルームを {`{roomId}.json`} 形式で保存します
        </p>
      </div>

      <div className="shrink-0 border-b border-border px-5 py-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1 py-2">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            disabled={loading || rooms.length === 0}
            className="size-5 shrink-0 accent-primary"
            aria-label="すべて選択"
          />
          <span className="text-sm font-medium">
            すべて選択
            {selected.size > 0 && (
              <span className="ml-1 text-muted-foreground tabular-nums">
                ({selected.size}/{rooms.length})
              </span>
            )}
          </span>
        </label>
      </div>

      <div
        className="touch-scrollable min-h-0 max-h-[50vh] flex-1 overflow-y-auto overscroll-contain px-5"
        aria-live="polite"
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-6" />
          </div>
        ) : rooms.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            チャットルームがありません
          </p>
        ) : (
          <div className="flex flex-col gap-1 py-2">
            {rooms.map((room) => {
              const plot = room.plot
              const name =
                room.title || (plot as { name?: string } | undefined)?.name || "チャット"
              const checked = selected.has(room.id)
              return (
                <label
                  key={room.id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    checked
                      ? "bg-primary/10 ring-1 ring-primary/40"
                      : "bg-secondary/30 hover:bg-secondary/60"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(room.id)}
                    className="size-5 shrink-0 accent-primary"
                    aria-label={`${name}を選択`}
                  />
                  <Avatar className="size-10 shrink-0">
                    <CachedAvatarImage
                      src={(plot as { imageUrl?: string } | undefined)?.imageUrl}
                      alt={name}
                    />
                    <AvatarFallback>{name[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {name}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {exporting && (
        <p className="shrink-0 px-5 pt-2 text-xs text-muted-foreground tabular-nums" aria-live="polite">
          エクスポート中… {progress.done}/{progress.total}
        </p>
      )}

      <div className="shrink-0 flex items-center justify-end gap-2 border-t border-border px-5 py-4">
        {isDesktop && (
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
            disabled={exporting}
          >
            閉じる
          </Button>
        )}
        <Button
          className="cursor-pointer"
          size="sm"
          disabled={exporting || selected.size === 0}
          onClick={handleExport}
        >
          {exporting && <Spinner className="mr-1.5 size-4" />}
          エクスポート
          {selected.size > 0 && (
            <span className="tabular-nums"> ({selected.size})</span>
          )}
        </Button>
      </div>
    </div>
  )

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(v) => {
        if (!exporting) onOpenChange(v)
      }}
      title="メッセージエクスポート"
      desktopClassName="flex max-h-[85vh] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      mobileClassName="max-h-[85vh]"
    >
      {content}
    </ResponsiveDialog>
  )
}
