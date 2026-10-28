import { describe, expect, it } from 'vitest';
import { createNetworkCache } from './networkCache';

describe('published network cache', () => {
  it('expires an entry after the configured 30 second maximum', () => {
    let now = 0;
    const cache = createNetworkCache({ now: () => now, ttlMs: 30_000, maxBytes: 5 * 1024 * 1024 });
    const network = { directions: [{ id: '24-out' }], servedPlaces: [], stops: [] };

    cache.set('published-network', network);
    expect(cache.get('published-network')).toEqual(network);
    now = 30_001;
    expect(cache.get('published-network')).toBeUndefined();
  });

  it('does not retain a serialized network larger than the 5 MiB per-instance cap', () => {
    const cache = createNetworkCache({ now: () => 0, ttlMs: 30_000, maxBytes: 5 * 1024 * 1024 });
    const oversized = { payload: 'x'.repeat(5 * 1024 * 1024) };

    cache.set('published-network', oversized);

    expect(cache.get('published-network')).toBeUndefined();
    expect(cache.sizeBytes()).toBe(0);
  });

  it('evicts older entries when adding a fixture would exceed the byte budget', () => {
    const cache = createNetworkCache({ now: () => 0, ttlMs: 30_000, maxBytes: 100 });
    cache.set('older', { value: 'a'.repeat(40) });
    cache.set('newer', { value: 'b'.repeat(40) });

    expect(cache.get('older')).toBeUndefined();
    expect(cache.get('newer')).toBeDefined();
    expect(cache.sizeBytes()).toBeLessThanOrEqual(100);
  });
});
