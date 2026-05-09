import { useState } from "react"
import { Check } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface ProfileSelectSheetProps {
  profiles: any[]
  open: boolean
  onSelect: (profile: any) => void
  loading?: boolean
}

export function ProfileSelectSheet({ profiles, open, onSelect, loading }: ProfileSelectSheetProps) {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const def = profiles.find((p) => p.selected || p.isDefault)
    return def?.id || profiles[0]?.id || null
  })
  const [confirming, setConfirming] = useState(false)

  if (!open) return null

  const handleConfirm = async () => {
    const profile = profiles.find((p) => p.id === selectedId)
    if (!profile) return
    setConfirming(true)
    try {
      await onSelect(profile)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 animate-in fade-in-0" />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom">
        <div className="mx-auto max-w-lg rounded-t-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-center py-3">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="px-5 pb-2">
            <h3 className="text-base font-bold">プロフィールを選択</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">チャットで使用するプロフィールを選んでください</p>
          </div>

          <ScrollArea className="max-h-[40vh] px-5">
            <div className="flex flex-col gap-2 py-2">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Spinner className="size-6" />
                </div>
              ) : profiles.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">プロフィールがありません</p>
              ) : (
                profiles.map((p) => {
                  const isSelected = p.id === selectedId
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={cn(
                        "flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                        isSelected
                          ? "bg-primary/10 ring-1 ring-primary/40"
                          : "bg-secondary/30 hover:bg-secondary/60",
                      )}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <Avatar className="size-10 shrink-0 mt-0.5">
                        <AvatarImage src={p.profileImageUrl} />
                        <AvatarFallback className="text-sm">{(p.name || "?")[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          {p.isDefault && (
                            <span className="shrink-0 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              デフォルト
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground whitespace-pre-wrap">
                            {p.description}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="mt-1 size-5 shrink-0 text-primary" />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2 border-t border-border px-5 py-4">
            <Button
              className="flex-1"
              disabled={!selectedId || confirming}
              onClick={handleConfirm}
            >
              {confirming && <Spinner className="mr-1.5 size-4" />}
              この名前で開始
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
