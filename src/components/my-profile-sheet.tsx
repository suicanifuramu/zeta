import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { getMyPlotChatProfile, getSelectedUserPersona } from "@/lib/api"

interface MyProfileSheetProps {
  roomId: string
  plotId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ProfileData {
  name: string
  summary?: string
  description?: string
}

export function MyProfileSheet({
  roomId,
  plotId,
  open,
  onOpenChange,
}: MyProfileSheetProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    getMyPlotChatProfile(roomId)
      .then((data) => {
        if (!cancelled) {
          setProfileData({
            name: data.name,
            summary: data.summary,
            description: data.description,
          })
          setLoading(false)
        }
      })
      .catch(() => {
        if (cancelled) return
        return getSelectedUserPersona(plotId, roomId)
          .then((data) => {
            if (!cancelled) {
              setProfileData({ name: data.name, description: data.description })
              setLoading(false)
            }
          })
          .catch(() => {
            if (!cancelled) {
              setError(true)
              setLoading(false)
            }
          })
      })

    return () => {
      cancelled = true
    }
  }, [open, roomId, plotId])

  if (!open) return null

  const content = (
    <div className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col">
      <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-lg font-semibold">マイプロフィール</h2>
        {isDesktop && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
            aria-label="閉じる"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="touch-scrollable min-h-0 max-h-[85vh] overflow-y-auto overscroll-contain px-5 pb-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : error ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            プロフィールの取得に失敗しました
          </p>
        ) : profileData ? (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-sm text-muted-foreground">名前</p>
              <p className="text-base font-medium whitespace-pre-wrap">
                {profileData.name}
              </p>
            </div>
            {profileData.summary && (
              <div>
                <p className="mb-1 text-sm text-muted-foreground">概要</p>
                <p className="text-sm whitespace-pre-wrap">
                  {profileData.summary}
                </p>
              </div>
            )}
            {profileData.description && (
              <div>
                <p className="mb-1 text-sm text-muted-foreground">説明</p>
                <p className="text-sm whitespace-pre-wrap">
                  {profileData.description}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="マイプロフィール"
      desktopClassName="max-h-[85vh] max-w-md gap-0 overflow-y-auto p-0 sm:max-w-lg"
      mobileClassName="max-h-[85vh]"
      handleOnly
      showCloseButton={false}
    >
      {content}
    </ResponsiveDialog>
  )
}
