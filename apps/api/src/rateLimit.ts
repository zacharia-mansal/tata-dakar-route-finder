export interface SharedRateLimitStore {
  increment(key: string): Promise<number>;
}

export function createRateLimitGuard(options: {
  store: SharedRateLimitStore;
  maxRequests: number;
  windowMs: number;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  return {
    async check(key: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
      const windowStart = Math.floor(now() / options.windowMs);
      const count = await options.store.increment(key + ':' + windowStart);
      if (count <= options.maxRequests) return { allowed: true };
      const nextWindowAt = (windowStart + 1) * options.windowMs;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((nextWindowAt - now()) / 1000)),
      };
    },
  };
}
