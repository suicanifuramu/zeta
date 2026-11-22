import { useEffect, useState, useCallback } from "react"
import Cropper, { type Area } from "react-easy-crop"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { uploadUserChatProfileImage } from "@/lib/api"
import type { CropCoordinates, ImageUploadResponse } from "@/lib/types"
import { toast } from "sonner"
import "react-easy-crop/react-easy-crop.css"

interface ImageCropDialogCommonProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Legacy file path: called with the uploaded image URL. */
  onCropComplete?: (imageUrl: string) => void
  /** Upload endpoint override (e.g. user plot chat profiles use 256px). Legacy file path only. */
  uploadImage?: (
    file: File | Blob,
    cropCoordinates?: string
  ) => Promise<ImageUploadResponse>
  /** Minimum width/height of the cropped result. Defaults to 224px. */
  minDimension?: number
  /** Visual guide only; the crop itself is always the bounding box. */
  cropShape?: "round" | "rect"
  title?: string
  confirmLabel?: string
  /** Optional secondary action that keeps the image without cropping. */
  onSkipCrop?: () => void | Promise<void>
  skipLabel?: string
}

interface FileSource {
  file: File
  imageUrl?: undefined
  onCropConfirm?: undefined
}

/** Server-side crop: the image is already on the server and the coordinates are sent as-is. */
interface UrlSource {
  imageUrl: string
  file?: undefined
  onCropConfirm: (cropCoordinates: CropCoordinates) => Promise<void>
}

export type ImageCropDialogProps = ImageCropDialogCommonProps & (FileSource | UrlSource)

export function ImageCropDialog(props: ImageCropDialogProps) {
  const {
    open,
    onOpenChange,
    onCropComplete,
    uploadImage = uploadUserChatProfileImage,
    minDimension = 224,
    cropShape = "round",
    title = "画像をトリミング",
    confirmLabel = "適用",
    onSkipCrop,
    skipLabel = "トリミングせずに使う",
  } = props
  const file = props.file
  const imageUrl = props.imageUrl
  const onCropConfirm = props.onCropConfirm

  const [imageSrc, setImageSrc] = useState<string>("")
  const [loadError, setLoadError] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setImageSrc(url)
      setLoadError(false)
      return () => URL.revokeObjectURL(url)
    }
    if (imageUrl) {
      setImageSrc(imageUrl)
      setLoadError(false)
      // Preload only to detect a failed load; the Cropper itself reports nothing.
      const probe = new Image()
      probe.onerror = () => setLoadError(true)
      probe.src = imageUrl
      return () => {
        probe.onerror = null
      }
    }
    setImageSrc("")
  }, [file, imageUrl])

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location)
  }, [])

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom)
  }, [])

  const onCropAreaComplete = useCallback(
    (_: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels)
    },
    []
  )

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    setSaving(true)
    try {
      const w = Math.round(croppedAreaPixels.width)
      const h = Math.round(croppedAreaPixels.height)
      if (w < minDimension || h < minDimension) {
        throw new Error(
          `切り取った画像が小さすぎます（${minDimension}px以上必要）`
        )
      }

      const coords: CropCoordinates = {
        minX: Math.round(croppedAreaPixels.x),
        minY: Math.round(croppedAreaPixels.y),
        maxX: Math.round(croppedAreaPixels.x + croppedAreaPixels.width),
        maxY: Math.round(croppedAreaPixels.y + croppedAreaPixels.height),
      }

      if (onCropConfirm) {
        await onCropConfirm(coords)
        onOpenChange(false)
        return
      }
      if (!file) return
      const result = await uploadImage(file, JSON.stringify(coords))
      onCropComplete?.(result.imageUrl)
      onOpenChange(false)
    } catch (e: unknown) {
      const prefix = onCropConfirm ? "トリミングに失敗しました" : "画像アップロード失敗"
      toast.error(`${prefix}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    if (!onSkipCrop) return
    setSaving(true)
    try {
      await onSkipCrop()
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error(`設定に失敗しました: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">{title}</DialogTitle>

        <div className="relative h-80 w-full bg-black/90">
          {imageSrc && !loadError && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape={cropShape}
              showGrid={false}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropAreaComplete}
            />
          )}
          {loadError && (
            <p role="alert" className="flex h-full items-center justify-center px-6 text-center text-sm text-white">
              画像を読み込めませんでした。時間をおいて再度お試しください。
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 px-4 pb-2">
          <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            aria-label="拡大率"
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full cursor-pointer accent-primary"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          {onSkipCrop && (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto cursor-pointer"
              onClick={handleSkip}
              disabled={saving || loadError}
            >
              {skipLabel}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            キャンセル
          </Button>
          <Button
            size="sm"
            className="cursor-pointer"
            disabled={saving || !croppedAreaPixels || loadError}
            onClick={handleConfirm}
          >
            {saving ? (onCropConfirm ? "保存中…" : "アップロード中…") : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
