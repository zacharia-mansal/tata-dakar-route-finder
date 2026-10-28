import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublishedNetworkReader, type PublishedNetworkQuery } from './neon';

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

afterEach(() => vi.useRealTimers());

describe('Neon read timeout', () => {
  it('aborts the HTTP query after four seconds without setting session state', async () => {
    vi.useFakeTimers();
    let querySignal: AbortSignal | undefined;
    let finishQuery: (rows: unknown[]) => void = () => undefined;
    const query: PublishedNetworkQuery = async (_sql, _params, queryOptions) => {
      querySignal = queryOptions?.fetchOptions?.signal;
      return new Promise<unknown[]>((resolve) => { finishQuery = resolve; });
    };
    const reader = createPublishedNetworkReader({ connectionString: 'inert-test-value', query });
    const parentSignal = new AbortController().signal;
    const pending = reader.load({ signal: parentSignal }).then(
      () => undefined,
      (error: unknown) => error,
    );

    try {
      await flushMicrotasks();
      expect(querySignal).toBeInstanceOf(AbortSignal);
      expect(querySignal).not.toBe(parentSignal);
      await vi.advanceTimersByTimeAsync(3_999);
      expect(querySignal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(querySignal?.aborted).toBe(true);
    } finally {
      finishQuery([]);
      await pending;
    }
  });
});
