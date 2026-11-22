import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  ACCEPTED_IMAGE_ATTR,
  prepareImageForUpload,
  type PreparedImage,
} from "@/lib/image-upload"
import type { GalleryImage } from "@/lib/types"
import { errorMessage } from "@/lib/creator-util"
import { ConfirmDialog, FieldMessage } from "@/components/creator/creator-ui"

interface ImageGalleryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  load: () => Promise<GalleryImage[]>
  upload: (image: PreparedImage) => Promise<unknown>
  remove: (sequence: number) => Promise<unknown>
  /** Optional: make an image the main one (characters open the crop dialog). */
  onMain?: (image: GalleryImage) => void
  /** Called after an upload or a delete so the caller can refresh dependent fields. */
  onChanged?: () => void
}

/**
 * Gallery of uploaded images. Sequence numbers are the 0-based index in the list
 * returned by the server (LIVE D6/D8).
 */
export function ImageGalleryDialog(props: ImageGalleryDialogProps) {
  return (
    <ResponsiveDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={props.title}
      desktopClassName="max-h-[90dvh] max-w-2xl overflow-y-auto p-0 sm:max-w-2xl"
      mobileClassName="max-h-[90dvh] overflow-y-auto p-0"
    >
      <GalleryBody {...props} />
    </ResponsiveDialog>
  )
}

function GalleryBody({ title, load, upload, remove, onMain, onChanged, onOpenChange }: ImageGalleryDialogProps) {
  const [items, setItems] = useState<GalleryImage[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [removeIndex, setRemoveIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    setError(null)
    try {
      setItems(await load())
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [load])

  useEffect(() => {
    void reload()
  }, [reload])

  async function onPick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const prepared = await prepareImageForUpload(file)
      await upload(prepared)
      await reload()
      onChanged?.()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function confirmRemove(index: number) {
    setBusy(true)
    try {
      await remove(index)
      await reload()
      onChanged?.()
    } catch (e) {
      toast.error(`削除できませんでした: ${errorMessage(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-5">
      {/* pr-12: keeps the dialog's × close button (top right) clear of the add button. */}
      <div className="flex items-center justify-between gap-3 pr-12">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div>
          <input
            ref={inputRef}
            id="gallery-file"
            type="file"
            accept={ACCEPTED_IMAGE_ATTR}
            className="sr-only"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <Button
            type="button"
            className="min-h-11 cursor-pointer"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy && <Spinner className="size-4" />}
            {busy ? "処理しています…" : "画像を追加…"}
          </Button>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        JPG・PNG・WEBP、10MB以下。長辺は2048pxまでに縮小して送ります。
      </p>

      {error && <FieldMessage>{error}</FieldMessage>}
      {items === null && !error && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" /> 読み込み中…
        </p>
      )}
      {items !== null && items.length === 0 && (
        <p className="text-sm text-muted-foreground">画像はまだありません。</p>
      )}
      {items !== null && items.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="list">
          {items.map((item, index) => (
            <li key={`${item.imageUrl}-${index}`} className="space-y-2 rounded-lg border border-border p-2">
              <img src={item.imageUrl} alt={`画像 ${index + 1}`} className="aspect-square w-full rounded-md object-cover" />
              <div className="flex flex-wrap gap-1">
                {onMain && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-9 cursor-pointer"
                    disabled={busy}
                    onClick={() => {
                      onOpenChange(false)
                      onMain(item)
                    }}
                  >
                    メインに設定
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-9 cursor-pointer text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => setRemoveIndex(index)}
                >
                  削除…
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={removeIndex !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveIndex(null)
        }}
        title="1枚のイメージを削除しますか？"
        confirmLabel="削除する"
        onConfirm={() => {
          if (removeIndex !== null) void confirmRemove(removeIndex)
          setRemoveIndex(null)
        }}
      />
    </div>
  )
}
