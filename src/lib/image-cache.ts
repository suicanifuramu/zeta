/** Shared Cache API bucket for plot covers. */
export const PLOT_IMAGE_CACHE = "plot-images"

const MAX_SIZE = 100
const _map = new Map<string, string>()
const _fetchPromises = new Map<string, Promise<string>>()
const _clearListeners = new Set<() => void>()

export function subscribeToCacheClear(listener: () => void): () => void {
  _clearListeners.add(listener)
  return () => _clearListeners.delete(listener)
}

function notifyListeners(): void {
  _clearListeners.forEach((fn) => fn())
}

function evictIfNeeded(): void {
  if (_map.size < MAX_SIZE) return
  const firstKey = _map.keys().next()
  if (!firstKey.done) {
    const url = firstKey.value
    URL.revokeObjectURL(_map.get(url)!)
    _map.delete(url)
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
  notifyListeners()
  return count
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

  notifyListeners()
}

export const memoryCache = {
  has(url: string): boolean {
    return _map.has(url)
  },
  get(url: string): string | undefined {
    return _map.get(url)
  },
  set(url: string, objectUrl: string): void {
    if (!_map.has(url)) evictIfNeeded()
    const previous = _map.get(url)
    if (previous && previous !== objectUrl) URL.revokeObjectURL(previous)
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
