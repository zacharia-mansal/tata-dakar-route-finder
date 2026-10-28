import { describe, expect, it, vi } from 'vitest';
import type { PublishedTransitNetworkSnapshot } from '../src/neon';
import { createRuntimeResolver } from './resolve-places';
import { createRuntimeDependencies } from './search-routes';

const servedPlace = {
  id: 'ism',
  placeId: 'ism',
  displayName: 'Institut Supérieur de Management',
  areaName: 'Université',
  coordinates: { lat: 14.696, lon: -17.463 },
  aliases: ['ISM'],
  directionId: 'direction-24-out',
  alightingStopId: 'university',
  verifiedAt: '2026-10-22T12:00:00.000Z',
  source: 'catalogue' as const,
};

const network: PublishedTransitNetworkSnapshot = {
  directions: [],
  stops: [],
  servedPlaces: [servedPlace],
};

const testEnvironment = {
  DATABASE_URL_PUBLIC_API: 'inert-test-value',
  STADIA_API_KEY: 'fixture-only-key',
};

describe('runtime published-network cache composition', () => {
  it('caches resolve-places snapshots for at most 30 seconds and preserves the miss signal', async () => {
    let now = 0;
    const load = vi.fn(async (_options?: { signal?: AbortSignal }) => network);
    const reader = { load };
    const createReader = vi.fn(() => reader);
    const resolvePlaces = createRuntimeResolver(testEnvironment, {
      createReader,
      now: () => now,
    });
    const firstSignal = new AbortController().signal;
    const cacheHitSignal = new AbortController().signal;
    const expiredSignal = new AbortController().signal;

    await expect(resolvePlaces('ISM', 'fr', firstSignal)).resolves.toMatchObject({ kind: 'matches' });
    now = 29_999;
    await expect(resolvePlaces('ISM', 'fr', cacheHitSignal)).resolves.toMatchObject({ kind: 'matches' });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenNthCalledWith(1, { signal: firstSignal });

    now = 30_001;
    await expect(resolvePlaces('ISM', 'fr', expiredSignal)).resolves.toMatchObject({ kind: 'matches' });
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenNthCalledWith(2, { signal: expiredSignal });
  });

  it('caches search-routes snapshots and reloads after 30 seconds with the new request signal', async () => {
    let now = 0;
    const load = vi.fn(async (_options?: { signal?: AbortSignal }) => network);
    const reader = { load };
    const createReader = vi.fn(() => reader);
    const dependencies = createRuntimeDependencies(testEnvironment, {
      createReader,
      now: () => now,
    });
    const firstSignal = new AbortController().signal;
    const cacheHitSignal = new AbortController().signal;
    const expiredSignal = new AbortController().signal;

    await expect(dependencies.loadPublishedSnapshot(firstSignal)).resolves.toBe(network);
    now = 29_999;
    await expect(dependencies.loadPublishedSnapshot(cacheHitSignal)).resolves.toBe(network);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenNthCalledWith(1, { signal: firstSignal });

    now = 30_001;
    await expect(dependencies.loadPublishedSnapshot(expiredSignal)).resolves.toBe(network);
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenNthCalledWith(2, { signal: expiredSignal });
  });

  it('does not cache snapshots larger than 5 MiB in either runtime composition', async () => {
    const oversizedNetwork = {
      ...network,
      payload: 'x'.repeat(5 * 1024 * 1024),
    };

    const resolveLoad = vi.fn(async (_options?: { signal?: AbortSignal }) => oversizedNetwork);
    const resolvePlaces = createRuntimeResolver(testEnvironment, {
      createReader: vi.fn(() => ({ load: resolveLoad })),
      now: () => 0,
    });
    await resolvePlaces('ISM', 'fr');
    await resolvePlaces('ISM', 'fr');
    expect(resolveLoad).toHaveBeenCalledTimes(2);

    const searchLoad = vi.fn(async (_options?: { signal?: AbortSignal }) => oversizedNetwork);
    const dependencies = createRuntimeDependencies(testEnvironment, {
      createReader: vi.fn(() => ({ load: searchLoad })),
      now: () => 0,
    });
    await dependencies.loadPublishedSnapshot();
    await dependencies.loadPublishedSnapshot();
    expect(searchLoad).toHaveBeenCalledTimes(2);
  });

  it('does not share an in-flight load tied to a different request signal', async () => {
    const firstNetwork = deferred<PublishedTransitNetworkSnapshot>();
    const secondNetwork = deferred<PublishedTransitNetworkSnapshot>();
    const signals: (AbortSignal | undefined)[] = [];
    const load = vi.fn(({ signal }: { signal?: AbortSignal }) => {
      signals.push(signal);
      return signals.length === 1 ? firstNetwork.promise : secondNetwork.promise;
    });
    const dependencies = createRuntimeDependencies(testEnvironment, {
      createReader: vi.fn(() => ({ load })),
      now: () => 0,
    });
    const firstSignal = new AbortController().signal;
    const secondSignal = new AbortController().signal;

    const firstLoad = dependencies.loadPublishedSnapshot(firstSignal);
    const secondLoad = dependencies.loadPublishedSnapshot(secondSignal);
    expect(load).toHaveBeenCalledTimes(2);
    expect(signals).toEqual([firstSignal, secondSignal]);

    firstNetwork.resolve(network);
    secondNetwork.resolve(network);
    await expect(firstLoad).resolves.toBe(network);
    await expect(secondLoad).resolves.toBe(network);
  });
});

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
