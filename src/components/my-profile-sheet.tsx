import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { getMyPlotChatProfile, getSelectedUserPersona } from "@/lib/api"
import type { MyPlotChatProfileResponse, SelectedUserPersonaResponse } from "@/lib/types"

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

export function MyProfileSheet({ roomId, plotId, open, onOpenChange }: MyProfileSheetProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    getMyPlotChatProfile(roomId)
      .then((data: MyPlotChatProfileResponse) => {
        if (!cancelled) {
          setProfileData({ name: data.name, summary: data.summary, description: data.description })
          setLoading(false)
        }
      })
      .catch(() => {
        if (cancelled) return
        return getSelectedUserPersona(plotId, roomId)
          .then((data: SelectedUserPersonaResponse) => {
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

    return () => { cancelled = true }
  }, [open, roomId, plotId])

  if (!open) return null

  const content = (
    <div className="mx-auto w-full max-w-lg">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-lg font-semibold">マイプロフィール</h2>
        {isDesktop && (
          <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => onOpenChange(false)} aria-label="閉じる">
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="overflow-y-auto overscroll-contain touch-scrollable px-5 pb-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : error ? (
          <p className="py-12 text-center text-sm text-muted-foreground">プロフィールの取得に失敗しました</p>
        ) : profileData ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">名前</p>
              <p className="text-base font-medium whitespace-pre-wrap">{profileData.name}</p>
            </div>
            {profileData.summary && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">概要</p>
                <p className="text-sm whitespace-pre-wrap">{profileData.summary}</p>
              </div>
            )}
            {profileData.description && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">説明</p>
                <p className="text-sm whitespace-pre-wrap">{profileData.description}</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md gap-0 p-0 sm:max-w-lg max-h-[85vh] overflow-y-auto" showCloseButton={false}>
          <DialogTitle className="sr-only">マイプロフィール</DialogTitle>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerTitle className="sr-only">マイプロフィール</DrawerTitle>
        <div className="overflow-y-auto overscroll-contain touch-scrollable max-h-[85vh]">
          {content}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
