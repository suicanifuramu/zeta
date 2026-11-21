import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

interface DeleteModeOverlayProps {
  deleteMode: boolean
  selectedMsgId: string | null
  deleting: boolean
  onDelete: () => void
  onCancel: () => void
  /** Opens the room reset confirmation; the long-press on the trash button is the only other path. */
  onReset: () => void
}

export function DeleteModeOverlay({
  deleteMode,
  selectedMsgId,
  deleting,
  onDelete,
  onCancel,
  onReset,
}: DeleteModeOverlayProps) {
  if (!deleteMode) return null

  return (
    <div className="animate-slide-up pointer-events-none absolute inset-x-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center">
      <div className="glass pointer-events-auto flex w-full max-w-md flex-col items-center gap-2 rounded-2xl border border-destructive/30 px-4 py-3 shadow-lg shadow-destructive/10">
        <div className="text-center text-sm">
          {selectedMsgId ? (
            <span className="font-medium text-destructive">
              選択以降を削除
            </span>
          ) : (
            <span className="text-muted-foreground">
              メッセージをタップ
            </span>
          )}
        </div>
        <div className="flex w-full flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={onReset}
            disabled={deleting}
          >
            ルームをリセット
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={onCancel}
          >
            キャンセル
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="rounded-full"
            disabled={!selectedMsgId || deleting}
            onClick={onDelete}
          >
            {deleting && <Spinner className="mr-1 size-3" />}
            削除
          </Button>
        </div>
      </div>
    </div>
  )
}
