import { useState } from "react"
import { Check, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { UserChatProfile } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

interface ProfileSelectSheetProps {
  profiles: UserChatProfile[]
  open: boolean
  onSelect?: (profile: UserChatProfile) => void
  loading?: boolean
}

export function ProfileSelectSheet({ profiles, open, onSelect, loading }: ProfileSelectSheetProps) {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (profiles.length > 0) {
      const def = profiles.find((p) => p.selected || p.isDefault)
      return def?.id || profiles[0]?.id || null
    }
    return null
  })
  const [confirming, setConfirming] = useState(false)

  if (!open) return null

  const handleConfirm = async () => {
    const profile = profiles.find((p) => p.id === selectedId)
    if (!profile) return
    setConfirming(true)
    try {
      await onSelect?.(profile)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={() => {}}>
      <DrawerContent className="max-h-[85vh]">
        <div className="mx-auto w-full max-w-lg">
          <div className="flex items-start justify-between px-5 pt-4 pb-2">
            <DrawerHeader className="text-left p-0">
              <DrawerTitle>プロフィールを選択</DrawerTitle>
              <DrawerDescription>チャットで使用するプロフィールを選んでください</DrawerDescription>
            </DrawerHeader>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-foreground" aria-label="閉じる">
                <X className="size-4" />
              </Button>
            </DrawerClose>
          </div>

          {/* Native scroll — no Radix ScrollArea overhead */}
          <div className="max-h-[40vh] overflow-y-auto overscroll-contain px-5 touch-scrollable">
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
          </div>
          <DrawerFooter className="px-5 py-4 border-t border-border mt-2">
            <Button
              className="w-full"
              disabled={!selectedId || confirming}
              onClick={handleConfirm}
            >
              {confirming && <Spinner className="mr-1.5 size-4" />}
              この名前で開始
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
