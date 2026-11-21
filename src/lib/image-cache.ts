/** Shared Cache API bucket for plot covers. */
export const PLOT_IMAGE_CACHE = "plot-images"

const MAX_SIZE = 100
// Map insertion order doubles as LRU order: get() re-inserts, so the first key is the coldest.
const _map = new Map<string, string>()
const _fetchPromises = new Map<string, Promise<string>>()
// Keyed by object URL: components hold object URLs, not cache keys.
const _refCounts = new Map<string, number>()
// Replaced object URLs that are still referenced; revoked once their last holder releases.
const _retired = new Set<string>()
// `url` is set when a single image changed; undefined means the whole cache was cleared.
type CacheChangeListener = (url: string | undefined) => void
const _clearListeners = new Set<CacheChangeListener>()

export function subscribeToCacheClear(
  listener: CacheChangeListener
): () => void {
  _clearListeners.add(listener)
  return () => _clearListeners.delete(listener)
}

function notifyListeners(url?: string): void {
  _clearListeners.forEach((fn) => fn(url))
}

function isReferenced(objectUrl: string): boolean {
  return (_refCounts.get(objectUrl) ?? 0) > 0
}

function evictIfNeeded(): void {
  if (_map.size < MAX_SIZE) return
  // Evict the least-recently-used entry nobody holds. If every entry is in use,
  // exceed MAX_SIZE rather than revoke a URL that is still on screen.
  for (const [url, objectUrl] of _map) {
    if (isReferenced(objectUrl)) continue
    URL.revokeObjectURL(objectUrl)
    _map.delete(url)
    return
  }
}

export function clearMemoryCache(): number {
  let count = 0
  for (const objectUrl of _map.values()) {
    URL.revokeObjectURL(objectUrl)
    count++
  }
  _map.clear()
  _fetchPromises.clear()
  _refCounts.clear()
  _retired.clear()
  notifyListeners()
  return count
}

/** Mark an object URL as in use by a mounted component. Pair with releaseObjectUrl. */
export function retainObjectUrl(objectUrl: string): void {
  _refCounts.set(objectUrl, (_refCounts.get(objectUrl) ?? 0) + 1)
}

export function releaseObjectUrl(objectUrl: string): void {
  const next = (_refCounts.get(objectUrl) ?? 0) - 1
  if (next > 0) {
    _refCounts.set(objectUrl, next)
    return
  }
  _refCounts.delete(objectUrl)
  if (_retired.delete(objectUrl)) URL.revokeObjectURL(objectUrl)
}

/**
 * Drop every trace of one URL: the object URL, the in-flight promise and the
 * Cache API entry. Without this a single bad response sticks forever — the
 * `<img>` keeps failing at opacity 0 and nothing ever asks the network again.
 */
export function forgetImage(url: string): void {
  const objectUrl = _map.get(url)
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    _map.delete(url)
  }
  _fetchPromises.delete(url)
}

/**
 * Forget a broken image and wake every mounted hook so it fetches again.
 * Safe to call when the Cache API is unavailable (insecure origin, private
 * mode): the memory cache is still cleared.
 */
export async function invalidateImage(url: string): Promise<void> {
  forgetImage(url)

  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(PLOT_IMAGE_CACHE)
      await cache.delete(url)
    } catch {
      // storage unavailable or quota errors — the memory eviction stands
    }
  }

  notifyListeners(url)
}

export const memoryCache = {
  has(url: string): boolean {
    return _map.has(url)
  },
  get(url: string): string | undefined {
    const objectUrl = _map.get(url)
    if (objectUrl !== undefined) {
      // Refresh recency: move to the most-recently-used end.
      _map.delete(url)
      _map.set(url, objectUrl)
    }
    return objectUrl
  },
  set(url: string, objectUrl: string): void {
    const previous = _map.get(url)
    if (previous !== undefined) {
      _map.delete(url)
      if (previous !== objectUrl) {
        if (isReferenced(previous)) _retired.add(previous)
        else URL.revokeObjectURL(previous)
      }
    } else {
      evictIfNeeded()
    }
    _map.set(url, objectUrl)
  },
  delete(url: string): void {
    _map.delete(url)
  },
  clear(): void {
    _map.clear()
  },
  get size(): number {
    return _map.size
  },
}

export const fetchPromises = {
  has(url: string): boolean {
    return _fetchPromises.has(url)
  },
  get(url: string): Promise<string> | undefined {
    return _fetchPromises.get(url)
  },
  set(url: string, promise: Promise<string>): void {
    _fetchPromises.set(url, promise)
  },
  delete(url: string): void {
    _fetchPromises.delete(url)
  },
  clear(): void {
    _fetchPromises.clear()
  },
}
