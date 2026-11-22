import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getCreatorPlot } from "@/lib/api"
import type { CreatorPlot } from "@/lib/types"
import { PlotEditor } from "@/components/creator/plot-editor"
import { errorMessage } from "@/lib/creator-util"

export function PlotEditorPage() {
  const { plotId } = useParams<{ plotId: string }>()
  const [plot, setPlot] = useState<CreatorPlot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!plotId) return
    let cancelled = false
    getCreatorPlot(plotId)
      .then((data) => {
        if (!cancelled) {
          setPlot(data)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [plotId, attempt])

  if (!plotId) {
    return <p className="p-6 text-sm">プロットが指定されていません。</p>
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p role="alert" className="text-sm text-destructive">
          プロットを読み込めませんでした（{error}）
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 cursor-pointer"
            onClick={() => setAttempt((n) => n + 1)}
          >
            再読み込み
          </Button>
          <Button asChild className="min-h-11">
            <Link to="/create">作成一覧へ戻る</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!plot || plot.id !== plotId) {
    // Mirrors the editor: one column below lg; from lg the tab list on the left and the panel on the right.
    return (
      <div
        className="mx-auto max-w-2xl space-y-4 p-6 lg:grid lg:max-w-6xl lg:grid-cols-[14rem_minmax(0,1fr)] lg:space-y-0 lg:gap-x-8 lg:gap-y-4"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="text-sm text-muted-foreground lg:col-span-2">
          読み込み中…
        </p>
        <div aria-hidden="true" className="hidden space-y-1.5 lg:block">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="space-y-4 lg:max-w-3xl lg:min-w-0">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  return <PlotEditor key={plot.id} plot={plot} />
}
