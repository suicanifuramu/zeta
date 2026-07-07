import { useEffect, useState, useCallback } from "react"
import Cropper, { type Area } from "react-easy-crop"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { uploadUserChatProfileImage } from "@/lib/api"
import { toast } from "sonner"
import "react-easy-crop/react-easy-crop.css"

interface ImageCropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: File
  onCropComplete: (imageUrl: string) => void
}

function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"))
    img.src = src
  })
}

export function ImageCropDialog({
  open,
  onOpenChange,
  file,
  onCropComplete,
}: ImageCropDialogProps) {
  const [imageSrc, setImageSrc] = useState<string>("")
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImageSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

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
      const { width: imgW, height: imgH } = await getImageDimensions(imageSrc)
      if (imgW < 224 || imgH < 224) {
        throw new Error("画像サイズが小さすぎます（224px以上必要）")
      }

      const w = Math.round(croppedAreaPixels.width)
      const h = Math.round(croppedAreaPixels.height)
      if (w < 224 || h < 224) {
        throw new Error("切り取った画像が小さすぎます（224px以上必要）")
      }

      const cropCoordinates = JSON.stringify({
        minX: Math.round(croppedAreaPixels.x),
        minY: Math.round(croppedAreaPixels.y),
        maxX: Math.round(croppedAreaPixels.x + croppedAreaPixels.width),
        maxY: Math.round(croppedAreaPixels.y + croppedAreaPixels.height),
      })

      const result = await uploadUserChatProfileImage(file, cropCoordinates)
      onCropComplete(result.imageUrl)
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error(
        `画像アップロード失敗: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">画像をトリミング</DialogTitle>

        <div className="relative h-80 w-full bg-black/90">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropAreaComplete}
            />
          )}
        </div>

        <div className="flex items-center gap-3 px-4 pb-2">
          <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full cursor-pointer accent-primary"
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
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
            disabled={saving || !croppedAreaPixels}
            onClick={handleConfirm}
          >
            {saving ? "アップロード中..." : "適用"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
