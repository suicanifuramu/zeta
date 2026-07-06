import { useEffect, useState } from "react"
import { Check, Plus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { UserChatProfile } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import { createUserChatProfile, checkUserChatProfileAbuse } from "@/lib/api"
import { toast } from "sonner"

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
  onCreateProfile?: (profile: UserChatProfile) => void
  loading?: boolean
}

function CreateProfileSheet({
  open,
  onOpenChange,
  onProfileCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProfileCreated: (profile: UserChatProfile) => Promise<void>
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName("")
      setDescription("")
    }
  }, [open])

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("名前を入力してください")
      return
    }
    setSaving(true)
    try {
      const data = (await checkUserChatProfileAbuse({
        name: name.trim(),
        description: description.trim(),
      })) as Record<string, boolean>
      if (data.isAbusing) {
        toast.error("不適切な内容が含まれています")
        setSaving(false)
        return
      }
      const raw = await createUserChatProfile({
        name: name.trim(),
        description: description.trim(),
      })
      const newProfile = raw as UserChatProfile
      await onProfileCreated(newProfile)
    } catch (e: unknown) {
      toast.error(
        `作成失敗: ${e instanceof Error ? e.message : String(e)}`
      )
      setSaving(false)
    }
  }

  const content = (
    <div className="mx-auto flex w-full max-w-lg flex-col" style={{ height: '100%' }}>
      <div className="shrink-0 px-5 pt-4 pb-2">
        <h2 className="text-lg font-semibold">新しいプロフィール</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-4 px-5 py-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">プロフィール名</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="プロフィール名を入力"
            disabled={saving}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">説明</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="説明を入力（任意）"
            rows={3}
            disabled={saving}
          />
        </div>
      </div>
      </div>
      <div className="shrink-0 flex items-center justify-end gap-2 border-t border-border px-5 py-4">
        {isDesktop && (
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            閉じる
          </Button>
        )}
        <Button
          className="cursor-pointer"
          disabled={saving}
          onClick={handleCreate}
        >
          {saving && <Spinner className="mr-1.5 size-4" />}
          この名前で開始
        </Button>
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-md gap-0 overflow-y-auto p-0 sm:max-w-lg">
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} snapPoints={[0.40, 0.95]} snapToSequentialPoint handleOnly>
      <DrawerContent>
        <div className="flex max-h-[95vh] flex-col overflow-hidden">
          {content}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export function ProfileSelectSheet({
  profiles,
  plotProfiles,
  open,
  onOpenChange,
  onSelect,
  onPlotSelect,
  onCreateProfile,
  loading,
}: ProfileSelectSheetProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

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

  const handleProfileCreated = async (profile: UserChatProfile) => {
    setShowCreate(false)
    await onCreateProfile?.(profile)
  }

  const content = (
    <div className="mx-auto flex w-full max-w-lg flex-col" style={{ height: '100%' }}>
      <div className="shrink-0 px-5 pt-4 pb-2">
        <h2 className="text-lg font-semibold">プロフィールを選択</h2>
      </div>

      <div className="touch-scrollable min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
        <div className="flex flex-col gap-2 py-2">
          <button
            type="button"
            className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors bg-secondary/30 hover:bg-secondary/60"
            onClick={() => setShowCreate(true)}
          >
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary/60">
              <Plus className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">新しいプロフィール</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                新しいトークプロフィールを作成します
              </p>
            </div>
          </button>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-6" />
            </div>
          ) : profiles.length === 0 && !hasPlotProfiles ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              プロフィールがありません
            </p>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-end gap-2 border-t border-border px-5 py-4">
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

      <CreateProfileSheet
        open={showCreate}
        onOpenChange={setShowCreate}
        onProfileCreated={handleProfileCreated}
      />
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
      <Drawer open={open} onOpenChange={(v) => onOpenChange?.(v)} snapPoints={[0.48, 0.95]} snapToSequentialPoint handleOnly>
      <DrawerContent>
        <div className="flex max-h-[95vh] flex-col overflow-hidden">
          {content}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
