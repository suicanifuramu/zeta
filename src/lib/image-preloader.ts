import { memoryCache, fetchPromises } from "@/lib/image-cache";

interface PreloadOptions {
  concurrency?: number;
  priority?: "high" | "low" | "auto";
  signal?: AbortSignal;
}

async function getPlotImageCache(): Promise<Cache> {
  return caches.open("plot-images");
}

async function preloadSingle(url: string, priority: RequestPriority): Promise<string> {
  if (fetchPromises.has(url)) {
    const existingPromise = fetchPromises.get(url);
    if (existingPromise) {
      try {
        return await existingPromise;
      } catch {
        // Ignore - already handled
      }
    }
  }

  if (memoryCache.has(url)) {
    const cached = memoryCache.get(url);
    if (cached) return cached;
  }

  const promise = (async (): Promise<string> => {
    const cache = await getPlotImageCache();
    let res = await cache.match(url);
    if (!res) {
      res = await fetch(url, { priority });
      if (res.ok) {
        cache.put(url, res.clone());
      }
    }
    if (res.ok) {
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      memoryCache.set(url, objectUrl);
      return objectUrl;
    }
    throw new Error(`Failed to load: ${res.status}`);
  })();

  fetchPromises.set(url, promise);

  try {
    return await promise;
  } finally {
    fetchPromises.delete(url);
  }
}

export async function preloadImages(
  urls: string[],
  options: PreloadOptions = {}
): Promise<{ success: string[]; failed: string[] }> {
  const { concurrency = 6, priority = "low", signal } = options;
  const success: string[] = [];
  const failed: string[] = [];

  const uncachedUrls = urls.filter(
    (url) => url && !memoryCache.has(url)
  );

  if (uncachedUrls.length === 0) {
    return { success: urls.filter(Boolean), failed: [] };
  }

  const queue = [...uncachedUrls];
  const running = new Set<Promise<void>>();

  async function processNext(): Promise<void> {
    if (queue.length === 0 || signal?.aborted) return;

    const url = queue.shift()!;

    const promise = (async () => {
      try {
        await preloadSingle(url, priority);
        success.push(url);
      } catch {
        failed.push(url);
      }
    })();

    running.add(promise);
    promise.finally(() => {
      running.delete(promise);
      processNext();
    });

    await promise;
  }

  const initialBatch = Math.min(concurrency, queue.length);
  await Promise.all(
    Array.from({ length: initialBatch }, () => processNext())
  );

  await Promise.all(running);

  const allSuccess = [...urls.filter((u) => memoryCache.has(u)), ...success];
  return { success: allSuccess, failed };
}

export function preloadImagesAsync(urls: string[], options?: PreloadOptions): void {
  preloadImages(urls, options).catch(console.warn);
}