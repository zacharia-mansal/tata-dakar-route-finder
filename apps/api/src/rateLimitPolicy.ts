import { createRateLimitGuard, type SharedRateLimitStore } from './rateLimit';

export type RateLimitPolicyMode = 'shared' | 'memory' | 'unavailable';

export interface RateLimitPolicyOptions {
  vercelEnv?: string;
  allowMemoryRateLimit?: string;
  sharedStore?: SharedRateLimitStore;
  /** A distinct namespace prevents one API operation from consuming another operation's quota. */
  namespace?: string;
  /** An environment override. It must be a positive safe integer when supplied. */
  configuredMaxRequests?: string;
  defaultMaxRequests?: number;
}

export interface PolicyRateLimit {
  check(key: string, options?: { signal?: AbortSignal }): Promise<{
    allowed: boolean;
    retryAfterSeconds?: number;
    unavailable?: true;
  }>;
}

export interface RateLimitPolicy {
  mode: RateLimitPolicyMode;
  rateLimit?: PolicyRateLimit;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS_PER_WINDOW = 60;

function parseMaxRequests(value: string | undefined, defaultValue: number): number | undefined {
  if (value === undefined) {
    return Number.isSafeInteger(defaultValue) && defaultValue > 0 ? defaultValue : undefined;
  }
  if (!/^\s*[1-9]\d*\s*$/.test(value)) return undefined;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function scopedStore(store: SharedRateLimitStore, namespace: string): SharedRateLimitStore {
  return { increment: (key, options) => store.increment(`${namespace}:${key}`, options) };
}

function safeRateLimit(store: SharedRateLimitStore, maxRequests: number): PolicyRateLimit {
  const guard = createRateLimitGuard({
    maxRequests,
    windowMs: RATE_LIMIT_WINDOW_MS,
    store,
  });
  return {
    async check(key, options) {
      try {
        return await guard.check(key, options);
      } catch {
        return { allowed: false, unavailable: true };
      }
    },
  };
}

// This process-local store is for explicit local development only. It does not protect
// a distributed deployment because each serverless instance has its own independent memory.
function createDevelopmentOnlyProcessMemoryRateLimitStore(): SharedRateLimitStore {
  const counters = new Map<string, number>();
  return {
    async increment(key: string): Promise<number> {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    },
  };
}

export function createRateLimitPolicy(options: RateLimitPolicyOptions): RateLimitPolicy {
  const maxRequests = parseMaxRequests(
    options.configuredMaxRequests,
    options.defaultMaxRequests ?? DEFAULT_MAX_REQUESTS_PER_WINDOW,
  );
  if (maxRequests === undefined) return { mode: 'unavailable' };

  const store = options.sharedStore
    ? scopedStore(options.sharedStore, options.namespace ?? 'api')
    : undefined;
  if (store) {
    return {
      mode: 'shared',
      rateLimit: safeRateLimit(store, maxRequests),
    };
  }

  const isLocalDevelopment = options.vercelEnv === undefined || options.vercelEnv === 'development';
  if (isLocalDevelopment && options.allowMemoryRateLimit === '1') {
    return {
      mode: 'memory',
      rateLimit: safeRateLimit(
        scopedStore(createDevelopmentOnlyProcessMemoryRateLimitStore(), options.namespace ?? 'api'),
        maxRequests,
      ),
    };
  }

  return { mode: 'unavailable' };
}
