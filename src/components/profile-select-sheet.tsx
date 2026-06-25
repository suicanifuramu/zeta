import { useState } from "react"
import { Check } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { UserChatProfile } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"

export interface PlotProfileItem {
  id: string
  name: string
  description?: string
  summary?: string
  profileImageUrl?: string
}

interface ProfileSelectSheetProps {
  profiles: UserChatProfile[]
  plotProfiles?: PlotProfileItem[]
  open: boolean
  onOpenChange?: (open: boolean) => void
  onSelect?: (profile: UserChatProfile) => void
  onPlotSelect?: (profile: PlotProfileItem) => void
  loading?: boolean
}

export function ProfileSelectSheet({
  profiles,
  plotProfiles,
  open,
  onOpenChange,
  onSelect,
  onPlotSelect,
  loading,
}: ProfileSelectSheetProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Initialize selectedId when sheet opens (React 19 render-time setState is safe)
  if (open && selectedId === null) {
    const def = profiles.find((p) => p.selected || p.isDefault)
    const id = def?.id || profiles[0]?.id || plotProfiles?.[0]?.id || null
    if (id) setSelectedId(id)
  }

  const findSelected = () => {
    const userProfile = profiles.find((p) => p.id === selectedId)
    if (userProfile) return { type: "user" as const, profile: userProfile }
    const plotProfile = plotProfiles?.find((p) => p.id === selectedId)
    if (plotProfile) return { type: "plot" as const, profile: plotProfile }
    return null
  }

  const handleConfirm = async () => {
    const selected = findSelected()
    if (!selected) return
    setConfirming(true)
    try {
      if (selected.type === "user") {
        await onSelect?.(selected.profile as UserChatProfile)
      } else {
        await onPlotSelect?.(selected.profile as PlotProfileItem)
      }
    } finally {
      setConfirming(false)
    }
  }

  const hasPlotProfiles = plotProfiles && plotProfiles.length > 0

  const content = (
    <div className="mx-auto w-full max-w-lg">
      <div className="px-5 pt-4 pb-2">
        <h2 className="text-lg font-semibold">プロフィールを選択</h2>
      </div>

      <div className="touch-scrollable max-h-[40vh] overflow-y-auto overscroll-contain px-5">
        <div className="flex flex-col gap-2 py-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-6" />
            </div>
          ) : profiles.length === 0 && !hasPlotProfiles ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              プロフィールがありません
            </p>
          ) : (
            <>
              {profiles.map((p) => {
                const isSelected = p.id === selectedId
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                      isSelected
                        ? "bg-primary/10 ring-1 ring-primary/40"
                        : "bg-secondary/30 hover:bg-secondary/60"
                    )}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <Avatar className="mt-0.5 size-10 shrink-0">
                      <AvatarImage src={p.profileImageUrl} />
                      <AvatarFallback className="text-sm">
                        {(p.name || "?")[0]}
                      </AvatarFallback>
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
                        <p
                          className={cn(
                            "mt-0.5 text-xs whitespace-pre-wrap text-muted-foreground",
                            !isSelected && "line-clamp-2"
                          )}
                        >
                          {p.description}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="mt-1 size-5 shrink-0 text-primary" />
                    )}
                  </button>
                )
              })}
              {hasPlotProfiles && (
                <>
                  <div className="relative my-1">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-background px-2 text-[11px] text-muted-foreground">
                        このプロットのプロフィール
                      </span>
                    </div>
                  </div>
                  {plotProfiles.map((p) => {
                    const isSelected = p.id === selectedId
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                          isSelected
                            ? "bg-primary/10 ring-1 ring-primary/40"
                            : "bg-secondary/30 hover:bg-secondary/60"
                        )}
                        onClick={() => setSelectedId(p.id)}
                      >
                        <Avatar className="mt-0.5 size-10 shrink-0">
                          <AvatarFallback className="text-sm">
                            {(p.name || "?")[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">
                              {p.name}
                            </p>
                            <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                              プロット
                            </span>
                          </div>
                          {p.description && (
                            <p
                              className={cn(
                                "mt-0.5 text-xs whitespace-pre-wrap text-muted-foreground",
                                !isSelected && "line-clamp-2"
                              )}
                            >
                              {p.description}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="mt-1 size-5 shrink-0 text-primary" />
                        )}
                      </button>
                    )
                  })}
                </>
              )}
            </>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2 border-t border-border px-5 py-4">
        {isDesktop && (
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => onOpenChange?.(false)}
          >
            閉じる
          </Button>
        )}
        <Button
          className="cursor-pointer"
          disabled={!selectedId || confirming}
          onClick={handleConfirm}
        >
          {confirming && <Spinner className="mr-1.5 size-4" />}
          この名前で開始
        </Button>
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(v) => onOpenChange?.(v)}>
        <DialogContent className="max-h-[85vh] max-w-md gap-0 overflow-y-auto p-0 sm:max-w-lg">
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={(v) => onOpenChange?.(v)}>
      <DrawerContent className="max-h-[85vh]">
        <div className="touch-scrollable max-h-[85vh] overflow-y-auto overscroll-contain">
          {content}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
