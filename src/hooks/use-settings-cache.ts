import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { clearAllCache } from "@/lib/cache-cleanup"
import { PLOT_IMAGE_CACHE, memoryCache } from "@/lib/image-cache"

export function useSettingsCache() {
  const [cacheCount, setCacheCount] = useState(0)
  const [memoryCount, setMemoryCount] = useState(0)
  const [cacheDeleting, setCacheDeleting] = useState(false)

  const refreshCounts = useCallback(async () => {
    setMemoryCount(memoryCache.size)

    // The Cache API is unavailable on an insecure origin (dev over LAN,
    // private mode). Reading it unguarded used to throw inside the effect.
    if (typeof caches === "undefined") {
      setCacheCount(0)
      return
    }

    try {
      const cache = await caches.open(PLOT_IMAGE_CACHE)
      const keys = await cache.keys()
      setCacheCount(keys.length)
    } catch {
      setCacheCount(0)
    }
  }, [])

  useEffect(() => {
    void refreshCounts()
  }, [refreshCounts])

  const clearCache = async () => {
    setCacheDeleting(true)
    try {
      const { deletedCount, cacheEntries } = await clearAllCache()
      await refreshCounts()
      toast.success(
        `キャッシュを削除しました（画像 ${cacheEntries} 件 / メモリ ${deletedCount} 件）`
      )
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setCacheDeleting(false)
    }
  }

  return { cacheCount, memoryCount, cacheDeleting, clearCache }
}
