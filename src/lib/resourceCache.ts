interface ResourceCacheEntry<T> {
  value: T;
  updatedAt: number;
  inFlight: Promise<T> | null;
}

const resources = new Map<string, ResourceCacheEntry<unknown>>();

/**
 * In-memory cache for read-only native resources owned by widgets. It lives
 * beyond a widget unmount and coalesces overlapping IPC reads by cache key.
 */
export function getCachedResource<T>(key: string): T | undefined {
  return resources.get(key)?.value as T | undefined;
}

export function getCachedResourceAge(key: string, now = Date.now()): number {
  const entry = resources.get(key);
  return entry ? Math.max(0, now - entry.updatedAt) : Number.POSITIVE_INFINITY;
}

export function setCachedResource<T>(key: string, value: T): T {
  resources.set(key, { value, updatedAt: Date.now(), inFlight: null });
  return value;
}

export function loadCachedResource<T>(
  key: string,
  loader: () => Promise<T>,
  maxAgeMs = 0,
): Promise<T> {
  const cached = resources.get(key) as ResourceCacheEntry<T> | undefined;
  if (cached?.inFlight) return cached.inFlight;
  if (cached && Date.now() - cached.updatedAt <= maxAgeMs) {
    return Promise.resolve(cached.value);
  }

  let request: Promise<T>;
  request = loader().then((value): T => {
    const current = resources.get(key) as ResourceCacheEntry<T> | undefined;
    if (current?.inFlight === request) {
      resources.set(key, { value, updatedAt: Date.now(), inFlight: null });
      return value;
    }
    // A user action (scan/connect) wrote a newer value while this background
    // read was running. Keep that value instead of restoring the old snapshot.
    return current?.value ?? value;
  });
  resources.set(key, {
    value: cached?.value as T,
    updatedAt: cached?.updatedAt ?? 0,
    inFlight: request,
  });
  void request.catch(() => {
    const current = resources.get(key) as ResourceCacheEntry<T> | undefined;
    if (current?.inFlight !== request) return;
    if (cached) resources.set(key, { ...cached, inFlight: null });
    else resources.delete(key);
  });
  return request;
}
