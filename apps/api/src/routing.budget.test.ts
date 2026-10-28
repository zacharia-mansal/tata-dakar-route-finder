import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransitNetwork, WalkSegment } from '../../../packages/domain/src/journey';
import type { PlaceCandidate } from '../../../packages/domain/src/place';
import { searchRoutes } from './routing';

const origin = { lat: 14.707, lon: -17.451 };
const destinationCoordinates = { lat: 14.695, lon: -17.463 };
const destination: PlaceCandidate = {
  id: 'ism',
  displayName: 'Institut Supérieur de Management',
  areaName: 'Université',
  coordinates: destinationCoordinates,
  source: 'catalogue',
};

function makeNetwork(): TransitNetwork {
  const directions = Array.from({ length: 4 }, (_, index) => ({
    id: `direction-${index}`,
    lineNumber: String(24 + index),
    directionName: `Castor vers Université ${index}`,
    displayedDestinationLabel: 'Université',
    receiverQuestion: 'Est-ce que ça va vers l’Université ?',
    stops: [
      { id: `start-${index}`, name: 'Castor', coordinates: origin, aliases: [] },
      { id: `end-${index}`, name: 'Université', coordinates: destinationCoordinates, aliases: [] },
    ],
  }));

  return {
    directions,
    stops: directions.flatMap(({ stops }) => stops),
    servedPlaces: directions.map((direction, index) => ({
      placeId: 'ism',
      areaName: 'Université',
      directionId: direction.id,
      alightingStopId: `end-${index}`,
      verifiedAt: '2026-10-22T12:00:00.000Z',
    })),
  };
}

function walk(from: { lat: number; lon: number }, to: { lat: number; lon: number }): WalkSegment {
  return { distanceMeters: 100, instructions: ['Walk'], coordinates: [from, to] };
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
}

afterEach(() => vi.useRealTimers());

describe('walking route request budget', () => {
  it('runs candidate walking calls in parallel while keeping at most three active', async () => {
    let activeCalls = 0;
    let peakActiveCalls = 0;
    let startedCalls = 0;
    let releaseFirstWave: () => void = () => undefined;
    const firstWave = new Promise<void>((resolve) => { releaseFirstWave = resolve; });
    const walking = {
      route: vi.fn(async ({ from, to }: { from: { lat: number; lon: number }; to: { lat: number; lon: number } }) => {
        activeCalls += 1;
        startedCalls += 1;
        peakActiveCalls = Math.max(peakActiveCalls, activeCalls);
        if (startedCalls <= 3) await firstWave;
        activeCalls -= 1;
        return walk(from, to);
      }),
    };

    const pending = searchRoutes({
      network: makeNetwork(),
      origin: { kind: 'coordinates', coordinates: origin },
      destination,
      locale: 'fr',
      walking,
      limits: { maxTransfers: 0, maxOriginWalkMeters: 800, maxDestinationWalkMeters: 1_200, maxResults: 3 },
    });

    await flushMicrotasks();
    const peakBeforeRelease = peakActiveCalls;
    releaseFirstWave();
    await pending;

    expect(peakBeforeRelease).toBeGreaterThan(1);
    expect(peakBeforeRelease).toBeLessThanOrEqual(3);
    expect(peakActiveCalls).toBeLessThanOrEqual(3);
  });

  it('aborts a pedestrian provider signal at four seconds and when the parent request is cancelled', async () => {
    vi.useFakeTimers();
    const providerSignals: AbortSignal[] = [];
    const walking = {
      route: vi.fn(({ signal }: { signal?: AbortSignal }) => new Promise<WalkSegment>((_resolve, reject) => {
        if (!signal) return reject(new Error('Expected per-call AbortSignal'));
        providerSignals.push(signal);
        signal.addEventListener('abort', () => reject(new Error('Provider request aborted')), { once: true });
      })),
    };
    const timeoutPending = searchRoutes({
      network: makeNetwork(),
      origin: { kind: 'coordinates', coordinates: origin },
      destination,
      locale: 'en',
      walking,
      limits: { maxTransfers: 0, maxOriginWalkMeters: 800, maxDestinationWalkMeters: 1_200, maxResults: 3 },
    }).catch((error: unknown) => error);

    await flushMicrotasks();
    const perCallSignal = providerSignals[0];
    await vi.advanceTimersByTimeAsync(3_999);
    expect(perCallSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await timeoutPending;
    expect(perCallSignal?.aborted).toBe(true);

    providerSignals.length = 0;
    const parentController = new AbortController();
    const cancelledPending = searchRoutes({
      network: makeNetwork(),
      origin: { kind: 'coordinates', coordinates: origin },
      destination,
      locale: 'en',
      walking,
      signal: parentController.signal,
      limits: { maxTransfers: 0, maxOriginWalkMeters: 800, maxDestinationWalkMeters: 1_200, maxResults: 3 },
    }).catch((error: unknown) => error);
    await flushMicrotasks();
    const parentCallSignal = providerSignals[0];
    parentController.abort();
    await cancelledPending;
    expect(parentCallSignal?.aborted).toBe(true);
  });
});
