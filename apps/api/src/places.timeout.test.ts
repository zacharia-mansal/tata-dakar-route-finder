import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStadiaGeocoder } from './places';

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

afterEach(() => vi.useRealTimers());

describe('Stadia geocoder request timeout', () => {
  it('aborts a geocoder call after four seconds and rejects its pending result', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    let finishFetch: (response: Response) => void = () => undefined;
    const fakeFetch: typeof fetch = async (_input, init) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>((resolve) => { finishFetch = resolve; });
    };
    const geocoder = createStadiaGeocoder({ apiKey: 'fixture-only-key', fetch: fakeFetch });
    const parentSignal = new AbortController().signal;
    const pending = geocoder.search('Castor', 'fr', parentSignal).then(
      () => undefined,
      (error: unknown) => error,
    );

    try {
      await flushMicrotasks();
      expect(requestSignal).toBeInstanceOf(AbortSignal);
      expect(requestSignal).not.toBe(parentSignal);
      await vi.advanceTimersByTimeAsync(3_999);
      expect(requestSignal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(requestSignal?.aborted).toBe(true);
      expect(await pending).toBeInstanceOf(Error);
    } finally {
      finishFetch(new Response(JSON.stringify({ features: [] }), { status: 200 }));
      await pending;
    }
  });
});
