import { describe, expect, it } from 'vitest';
import { createRateLimitGuard, type SharedRateLimitStore } from './rateLimit';

describe('shared rate limit guard', () => {
  it('shares the request budget across two handler instances using an injected store', async () => {
    const counters = new Map<string, number>();
    const store: SharedRateLimitStore = {
      increment: async (key) => {
        const next = (counters.get(key) ?? 0) + 1;
        counters.set(key, next);
        return next;
      },
    };
    const firstInstance = createRateLimitGuard({ store, maxRequests: 2, windowMs: 60_000 });
    const secondInstance = createRateLimitGuard({ store, maxRequests: 2, windowMs: 60_000 });

    await expect(firstInstance.check('fixture-client')).resolves.toMatchObject({ allowed: true });
    await expect(secondInstance.check('fixture-client')).resolves.toMatchObject({ allowed: true });
    await expect(firstInstance.check('fixture-client')).resolves.toMatchObject({ allowed: false, retryAfterSeconds: expect.any(Number) });
  });

  it('does not implement production protection with an instance-local counter', async () => {
    const store: SharedRateLimitStore = {
      increment: async () => 3,
    };
    const guard = createRateLimitGuard({ store, maxRequests: 2, windowMs: 60_000 });

    await expect(guard.check('fixture-client')).resolves.toMatchObject({ allowed: false });
  });
});
