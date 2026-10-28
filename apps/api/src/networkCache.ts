const MAX_TTL_MS = 30_000;
const MAX_BYTES = 5 * 1024 * 1024;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
  bytes: number;
}

export function createNetworkCache(options: {
  now: () => number;
  ttlMs: number;
  maxBytes: number;
}) {
  const entries = new Map<string, CacheEntry>();
  const ttlMs = Math.max(0, Math.min(options.ttlMs, MAX_TTL_MS));
  const maxBytes = Math.max(0, Math.min(options.maxBytes, MAX_BYTES));

  const currentSize = (): number =>
    [...entries.values()].reduce((total, entry) => total + entry.bytes, 0);

  return {
    get(key: string): unknown {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (options.now() >= entry.expiresAt) {
        entries.delete(key);
        return undefined;
      }
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key: string, value: unknown): void {
      let serialized: string;
      try {
        serialized = JSON.stringify(value);
      } catch {
        entries.delete(key);
        return;
      }
      if (serialized === undefined) {
        entries.delete(key);
        return;
      }
      const bytes = new TextEncoder().encode(serialized).byteLength;
      entries.delete(key);
      if (bytes > maxBytes || ttlMs === 0) return;
      while (entries.size > 0 && currentSize() + bytes > maxBytes) {
        const oldestKey = entries.keys().next().value as string | undefined;
        if (oldestKey === undefined) break;
        entries.delete(oldestKey);
      }
      entries.set(key, { value, expiresAt: options.now() + ttlMs, bytes });
    },
    sizeBytes(): number {
      for (const [key, entry] of entries) {
        if (options.now() >= entry.expiresAt) entries.delete(key);
      }
      return currentSize();
    },
  };
}
