/** Run one operation with a child signal that is cancelled by either its parent or a timeout. */
export async function withAbortTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
  parentSignal?: AbortSignal,
): Promise<T> {
  if (parentSignal?.aborted) throw new Error('Request aborted');

  const controller = new AbortController();
  const abortFromParent = () => controller.abort(new Error('Request aborted'));
  parentSignal?.addEventListener('abort', abortFromParent, { once: true });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => {
      const reason = controller.signal.reason;
      reject(reason instanceof Error ? reason : new Error('Request aborted'));
    }, { once: true });
  });

  try {
    timer = setTimeout(() => controller.abort(new Error(timeoutMessage)), timeoutMs);
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      aborted,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    parentSignal?.removeEventListener('abort', abortFromParent);
  }
}
