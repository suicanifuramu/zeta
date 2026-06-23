// In-memory object URL cache
export const memoryCache = new Map<string, string>()

// Deduplicate concurrent fetch requests for the same image
export const fetchPromises = new Map<string, Promise<string>>()

export function clearMemoryCache(): void {
  memoryCache.clear()
  fetchPromises.clear()
}