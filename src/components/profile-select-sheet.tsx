import { useEffect, useRef, useState } from "react"
import { Camera, Check, Pencil, Plus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type {
  MyPlotChatProfileResponse,
  UserChatProfile,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { ImageCropDialog } from "@/components/image-crop-dialog"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  createUserChatProfile,
  updateUserChatProfile,
  checkUserChatProfileAbuse,
  updateMyPlotChatProfile,
  selectPlotChatProfile,
  uploadUserPlotChatProfileImage,
} from "@/lib/api"
import { toast } from "sonner"

export interface PlotProfileItem {
  id: string
  name: string
  description?: string
  summary?: string
  profileImageUrl?: string
  /**
   * "mine" is the room-scoped user plot chat profile (`/me`), selectable via
   * `PUT /:id/selected`. "preset" is a creator-defined plot chat profile,
   * which creates a new record via `POST /selected`.
   */
  kind?: "preset" | "mine"
}

interface ProfileSelectSheetProps {
  variant?: "start" | "change"
  profiles: UserChatProfile[]
  plotProfiles?: PlotProfileItem[]
  open: boolean
  onOpenChange?: (open: boolean) => void
  onSelect?: (profile: UserChatProfile) => void
  onPlotSelect?: (profile: PlotProfileItem) => void
  onCreateProfile?: (profile: UserChatProfile) => void
  onProfileUpdated?: (profile: UserChatProfile) => Promise<void>
  loading?: boolean
  initialSelectedId?: string
  /** Required to edit the room-scoped plot profile. */
  roomId?: string
  plotId?: string
  myPlotProfile?: MyPlotChatProfileResponse | null
  onMyPlotProfileSaved?: () => Promise<void> | void
}

const USER_IMAGE_MIN_DIMENSION = 224
/** Android uses 256px for user plot chat profile images. */
const PLOT_IMAGE_MIN_DIMENSION = 256
/** Japanese/Korean bounds from `getEditPlotChatProfileSchema`. */
const PLOT_NAME_MAX_LENGTH = 20
const PLOT_DESCRIPTION_MAX_LENGTH = 1000
const PLOT_NAME_REGEX =
  /^[ \x2D.0-9A-Z_a-z\u1100-\u11FF\u3000\u3002\u3005\u3040-\u30FF\u3130-\u318F\u31F0-\u32FF\u3400-\u4DBF\u4E00-\u9FFF\uA960-\uA97F\uAC00-\uD7FF\uF900-\uFAFF\uFF10-\uFF19\uFF66-\uFF9F]+$/

function validateImageDimensions(
  file: File,
  minDimension = USER_IMAGE_MIN_DIMENSION
): Promise<boolean> {
  const objectUrl = URL.createObjectURL(file)
  return new Promise<boolean>((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve(img.width >= minDimension && img.height >= minDimension)
    }
    img.onerror = () => resolve(false)
    img.src = objectUrl
  }).finally(() => URL.revokeObjectURL(objectUrl))
}

function CreateProfileSheet({
  open,
  onOpenChange,
  onProfileCreated,
  onProfileUpdated,
  editProfile,
  variant,
  plotProfile,
  plotPreset,
  roomId,
  plotId,
  onPlotProfileSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProfileCreated?: (profile: UserChatProfile) => Promise<void>
  onProfileUpdated?: (profile: UserChatProfile) => Promise<void>
  editProfile?: UserChatProfile | null
  variant: "start" | "change"
  /** When set, edits the room-scoped user plot profile (`/me`). */
  plotProfile?: MyPlotChatProfileResponse | null
  /** When set, edits a creator-defined preset before starting the chat. */
  plotPreset?: PlotProfileItem | null
  roomId?: string
  plotId?: string
  onPlotProfileSaved?: () => Promise<void> | void
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [profileImageUrl, setProfileImageUrl] = useState("")
  const [saving, setSaving] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initialImageUrlRef = useRef("")
  const isPlotPreset = !!plotPreset
  const isPlotProfile = !!plotProfile
  const isPlotMode = isPlotProfile || isPlotPreset
  const isEditing = !!editProfile || isPlotProfile
  const imageMinDimension = isPlotMode
    ? PLOT_IMAGE_MIN_DIMENSION
    : USER_IMAGE_MIN_DIMENSION
  const busy = saving

  useEffect(() => {
    if (plotProfile) {
      setName(plotProfile.name || "")
      setDescription(plotProfile.description || "")
      setProfileImageUrl(plotProfile.imageUrl || "")
      initialImageUrlRef.current = plotProfile.imageUrl || ""
      return
    }
    if (plotPreset) {
      setName(plotPreset.name || "")
      setDescription(plotPreset.description || "")
      setProfileImageUrl(plotPreset.profileImageUrl || "")
      initialImageUrlRef.current = plotPreset.profileImageUrl || ""
      return
    }
    if (editProfile) {
      setName(editProfile.name || "")
      setDescription(editProfile.description || "")
      setProfileImageUrl(editProfile.profileImageUrl || "")
      initialImageUrlRef.current = editProfile.profileImageUrl || ""
    }
  }, [plotProfile, plotPreset, editProfile])

  useEffect(() => {
    if (!open) {
      setName("")
      setDescription("")
      setProfileImageUrl("")
      setCropFile(null)
    }
  }, [open])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const valid = await validateImageDimensions(file, imageMinDimension)
    if (!valid) {
      toast.error(`画像は${imageMinDimension}px以上である必要があります`)
      return
    }

    setCropFile(file)
    setCropOpen(true)

    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleCropComplete = (imageUrl: string) => {
    setProfileImageUrl(imageUrl)
    setCropOpen(false)
  }

  const handleSave = async () => {
    const trimmedName = name.trim()

    if (isPlotMode) {
      if (!trimmedName) {
        toast.error("名前を入力してください")
        return
      }
      if (trimmedName.length > PLOT_NAME_MAX_LENGTH) {
        toast.error(
          `名前は${PLOT_NAME_MAX_LENGTH}文字以内で入力してください`
        )
        return
      }
      if (!PLOT_NAME_REGEX.test(trimmedName)) {
        toast.error("名前に使用できない文字が含まれています")
        return
      }
      if (description.length > PLOT_DESCRIPTION_MAX_LENGTH) {
        toast.error(
          `説明は${PLOT_DESCRIPTION_MAX_LENGTH}文字以内で入力してください`
        )
        return
      }

      // Preset: create `/me` from the edited preset and start the chat.
      if (isPlotPreset) {
        if (!plotPreset || !roomId || !plotId) return
        setSaving(true)
        try {
          await selectPlotChatProfile({
            roomId,
            plotChatProfileId: plotPreset.id,
            plotId,
            name: trimmedName,
            profileImageUrl: profileImageUrl || "",
            summary: plotPreset.summary || "",
            description,
          })
          toast.success("プロットプロフィールを保存しました")
          await onPlotProfileSaved?.()
          onOpenChange(false)
        } catch (e: unknown) {
          toast.error(
            `保存失敗: ${e instanceof Error ? e.message : String(e)}`
          )
        } finally {
          setSaving(false)
        }
        return
      }

      // Existing `/me` record: PATCH only the fields that changed.
      if (!plotProfile || !roomId) return
      const body: {
        name?: string
        description?: string
        imageUrl?: string
      } = {}
      if (trimmedName !== plotProfile.name) body.name = trimmedName
      if (description !== (plotProfile.description || "")) {
        body.description = description
      }
      if (profileImageUrl !== initialImageUrlRef.current) {
        body.imageUrl = profileImageUrl
      }

      setSaving(true)
      try {
        if (Object.keys(body).length > 0) {
          await updateMyPlotChatProfile(roomId, body)
        }
        toast.success("プロットプロフィールを更新しました")
        await onPlotProfileSaved?.()
        onOpenChange(false)
      } catch (e: unknown) {
        toast.error(
          `更新失敗: ${e instanceof Error ? e.message : String(e)}`
        )
      } finally {
        setSaving(false)
      }
      return
    }

    if (!trimmedName) {
      toast.error("名前を入力してください")
      return
    }
    setSaving(true)
    try {
      const data = await checkUserChatProfileAbuse({
        name: trimmedName,
        description: description.trim(),
      })
      if (data.isAbusing) {
        toast.error("不適切な内容が含まれています")
        setSaving(false)
        return
      }
      if (isEditing && editProfile) {
        // undefined = keep the current image (a stored secret-less URL is
        // rejected by the API with 403 "Invalid image url"); "" = clear.
        const imageUrl =
          profileImageUrl === initialImageUrlRef.current
            ? undefined
            : profileImageUrl
        await updateUserChatProfile(editProfile.id, {
          name: trimmedName,
          description: description.trim(),
          profileImageUrl: imageUrl,
        })
        toast.success("プロフィールを更新しました")
        await onProfileUpdated?.({
          ...editProfile,
          name: trimmedName,
          description: description.trim(),
          profileImageUrl: profileImageUrl || undefined,
        })
      } else {
        const newProfile = await createUserChatProfile({
          name: trimmedName,
          description: description.trim(),
          profileImageUrl: profileImageUrl || undefined,
        })
        await onProfileCreated?.(newProfile)
      }
    } catch (e: unknown) {
      toast.error(
        `${isEditing ? "更新" : "作成"}失敗: ${e instanceof Error ? e.message : String(e)}`
      )
      setSaving(false)
    }
  }

  const content = (
    <div className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-5 pt-4 pb-2">
        <h2 className="text-lg font-semibold">
          {isPlotMode
            ? "プロットプロフィールを編集"
            : isEditing
              ? "プロフィールを編集"
              : "新しいプロフィール"}
        </h2>
      </div>
      <div className="touch-scrollable min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-4 px-5 py-4">
          <div className="flex justify-center">
            <button
              type="button"
              className="group relative cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <Avatar className="size-20">
                <AvatarImage src={profileImageUrl || undefined} />
                <AvatarFallback className="text-2xl">
                  {name ? name[0] : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="size-6 text-white" />
              </div>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">プロフィール名</label>
              {isPlotMode && (
                <span className="text-[11px] text-muted-foreground">
                  {name.trim().length}/{PLOT_NAME_MAX_LENGTH}
                </span>
              )}
            </div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="プロフィール名を入力"
              maxLength={isPlotMode ? PLOT_NAME_MAX_LENGTH : undefined}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">説明</label>
              {isPlotMode && (
                <span className="text-[11px] text-muted-foreground">
                  {description.length}/{PLOT_DESCRIPTION_MAX_LENGTH}
                </span>
              )}
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="説明を入力（任意）"
              rows={3}
              maxLength={
                isPlotMode ? PLOT_DESCRIPTION_MAX_LENGTH : undefined
              }
              disabled={busy}
            />
          </div>
        </div>
      </div>
      <div className="shrink-0 flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">
        {isDesktop && (
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            閉じる
          </Button>
        )}
        <Button
          className="cursor-pointer"
          disabled={busy || (isPlotMode && !name.trim())}
          onClick={handleSave}
        >
          {saving && <Spinner className="mr-1.5 size-4" />}
          {isPlotMode
            ? "保存"
            : isEditing
              ? "保存"
              : variant === "change"
                ? "作成して変更"
                : "この名前で開始"}
        </Button>
      </div>

      {cropFile && (
        <ImageCropDialog
          open={cropOpen}
          onOpenChange={(v) => {
            setCropOpen(v)
            if (!v) setCropFile(null)
          }}
          file={cropFile}
          minDimension={imageMinDimension}
          uploadImage={
            isPlotMode ? uploadUserPlotChatProfileImage : undefined
          }
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  )

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        isPlotMode
          ? "プロットプロフィールを編集"
          : isEditing
            ? "プロフィールを編集"
            : "新しいプロフィール"
      }
      desktopClassName="flex max-h-[85vh] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      mobileClassName="max-h-[85vh]"
    >
      {content}
    </ResponsiveDialog>
  )
}

export function ProfileSelectSheet({
  variant = "start",
  profiles,
  plotProfiles,
  open,
  onOpenChange,
  onSelect,
  onPlotSelect,
  onCreateProfile,
  onProfileUpdated,
  loading,
  initialSelectedId,
  roomId,
  plotId,
  myPlotProfile,
  onMyPlotProfileSaved,
}: ProfileSelectSheetProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editingProfile, setEditingProfile] = useState<UserChatProfile | null>(null)
  const [editingMyProfile, setEditingMyProfile] = useState(false)
  const [editingPreset, setEditingPreset] = useState<PlotProfileItem | null>(
    null
  )

  useEffect(() => {
    if (open) {
      const id =
        initialSelectedId ||
        profiles.find((p) => p.selected)?.id ||
        profiles[0]?.id ||
        (variant !== "change" ? plotProfiles?.[0]?.id : null) ||
        null
      setSelectedId(id)
    }
  }, [open, initialSelectedId, profiles, plotProfiles, variant])

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
        await onSelect?.(selected.profile)
      } else {
        await onPlotSelect?.(selected.profile)
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

  const handleProfileUpdated = async (profile: UserChatProfile) => {
    setEditingProfile(null)
    await onProfileUpdated?.(profile)
  }

  const content = (
    <div className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-5 pt-4 pb-2">
        <h2 className="text-lg font-semibold">
          {variant === "change" ? "プロフィールを変更" : "プロフィールを選択"}
        </h2>
      </div>

      <div className="touch-scrollable min-h-0 max-h-[85vh] overflow-y-auto overscroll-contain px-5">
        <div className="flex flex-col gap-2 py-2">
          <button
            type="button"
            className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors bg-secondary/30 hover:bg-secondary/60"
            onClick={() => {
              if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
              setShowCreate(true)
            }}
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
                      <div
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                          isSelected
                            ? "bg-primary/10 ring-1 ring-primary/40"
                            : "bg-secondary/30 hover:bg-secondary/60"
                        )}
                        onClick={() => setSelectedId(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setSelectedId(p.id)
                          }
                        }}
                      >
                        <Avatar className="mt-0.5 size-10 shrink-0">
                          <AvatarImage src={p.profileImageUrl} />
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
                          {(p.description || p.summary) && (
                            <p
                              className={cn(
                                "mt-0.5 text-xs whitespace-pre-wrap text-muted-foreground",
                                !isSelected && "line-clamp-2"
                              )}
                            >
                              {p.description || p.summary}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-center gap-1 self-start mt-1">
                          {isSelected && (
                            <Check className="size-5 shrink-0 text-primary" />
                          )}
                          {roomId && plotId && (
                            <button
                              type="button"
                              aria-label="プロットプロフィールを編集"
                              className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/80"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (p.kind === "mine") {
                                  setEditingMyProfile(true)
                                } else {
                                  setEditingPreset(p)
                                }
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
              {profiles.map((p) => {
                const isSelected = p.id === selectedId
                return (
                  <div
                    key={p.id}
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
                    <div className="flex shrink-0 flex-col items-center gap-1 self-start mt-1">
                      {isSelected && (
                        <Check className="size-5 shrink-0 text-primary" />
                      )}
                      <button
                        type="button"
                        aria-label={`${p.name}を編集`}
                        className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary/80 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingProfile(p)
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                  </div>
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
          {variant === "change" ? "このプロフィールに変更" : "この名前で開始"}
        </Button>
      </div>

      <CreateProfileSheet
        variant={variant}
        open={showCreate}
        onOpenChange={setShowCreate}
        onProfileCreated={handleProfileCreated}
      />
      <CreateProfileSheet
        variant={variant}
        editProfile={editingProfile}
        open={!!editingProfile}
        onOpenChange={(v) => {
          if (!v) setEditingProfile(null)
        }}
        onProfileUpdated={handleProfileUpdated}
      />
      {roomId && plotId && myPlotProfile && (
        <CreateProfileSheet
          variant={variant}
          open={editingMyProfile}
          onOpenChange={setEditingMyProfile}
          plotProfile={myPlotProfile}
          roomId={roomId}
          plotId={plotId}
          onPlotProfileSaved={onMyPlotProfileSaved}
        />
      )}
      {roomId && plotId && editingPreset && (
        <CreateProfileSheet
          variant={variant}
          open={!!editingPreset}
          onOpenChange={(v) => {
            if (!v) setEditingPreset(null)
          }}
          plotPreset={editingPreset}
          roomId={roomId}
          plotId={plotId}
          onPlotProfileSaved={onMyPlotProfileSaved}
        />
      )}
    </div>
  )

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(v) => onOpenChange?.(v)}
      title={variant === "change" ? "プロフィールを変更" : "プロフィールを選択"}
      desktopClassName="flex max-h-[85vh] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      mobileClassName="max-h-[85vh]"
    >
      {content}
    </ResponsiveDialog>
  )
}
