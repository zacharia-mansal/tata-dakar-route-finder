import { describe, expect, it, vi } from 'vitest';
import { createCachedNetworkLoader } from './networkCache';

describe('published network loader cache contract', () => {
  it('reuses one source read within 30 seconds and reloads after expiration', async () => {
    let now = 0;
    const snapshot = { directions: [], stops: [], servedPlaces: [] };
    const source = vi.fn(async () => snapshot);
    const load = createCachedNetworkLoader({ load: source, now: () => now });

    await expect(load()).resolves.toBe(snapshot);
    now = 29_999;
    await expect(load()).resolves.toBe(snapshot);
    expect(source).toHaveBeenCalledTimes(1);

    now = 30_001;
    await expect(load()).resolves.toBe(snapshot);
    expect(source).toHaveBeenCalledTimes(2);
  });

  it('does not retain a snapshot larger than 5 MiB', async () => {
    const oversized = { payload: 'x'.repeat(5 * 1024 * 1024) };
    const source = vi.fn(async () => oversized);
    const load = createCachedNetworkLoader({ load: source, now: () => 0 });

    await load();
    await load();

    expect(source).toHaveBeenCalledTimes(2);
  });
});
