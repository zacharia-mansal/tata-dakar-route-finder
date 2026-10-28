import { describe, expect, it, vi } from 'vitest';
import { createRateLimitPolicy } from './rateLimitPolicy';

describe('Vercel rate limit policy configuration', () => {
  it.each([
    ['unset without explicit local opt-in', undefined, undefined, 'unavailable'],
    ['unset with explicit local opt-in', undefined, '1', 'memory'],
    ['development without explicit local opt-in', 'development', undefined, 'unavailable'],
    ['development with explicit local opt-in', 'development', '1', 'memory'],
    ['preview despite explicit local opt-in', 'preview', '1', 'unavailable'],
    ['production despite explicit local opt-in', 'production', '1', 'unavailable'],
    ['unknown deployment value despite explicit local opt-in', 'staging', '1', 'unavailable'],
  ] as const)('selects %s mode', (_name, vercelEnv, allowMemoryRateLimit, expectedMode) => {
    const policy = createRateLimitPolicy({ vercelEnv, allowMemoryRateLimit });

    expect(policy.mode).toBe(expectedMode);
    if (expectedMode === 'unavailable') expect(policy.rateLimit).toBeUndefined();
    else expect(policy.rateLimit).toBeDefined();
  });

  it('uses an injected shared store and reports shared mode regardless of deployment', async () => {
    const increment = vi.fn(async () => 1);
    const policy = createRateLimitPolicy({
      vercelEnv: 'preview',
      sharedStore: { increment },
    });

    expect(policy.mode).toBe('shared');
    await policy.rateLimit?.check('fixture-client');
    expect(increment).toHaveBeenCalledTimes(1);
  });
});
