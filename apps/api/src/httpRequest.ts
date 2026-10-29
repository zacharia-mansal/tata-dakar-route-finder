export type ApiLocale = 'fr' | 'en';

export function localeFromAcceptLanguage(request: Request): ApiLocale {
  const acceptLanguage = request.headers.get('accept-language')?.toLowerCase() ?? '';
  const firstLanguage = acceptLanguage.split(',')[0]?.trim() ?? '';
  return firstLanguage === 'en' || firstLanguage.startsWith('en-') ? 'en' : 'fr';
}

export function jsonResponse(
  body: unknown,
  status = 200,
  additionalHeaders?: Record<string, string>,
): Response {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
  for (const [name, value] of Object.entries(additionalHeaders ?? {})) headers.set(name, value);
  return new Response(JSON.stringify(body), { status, headers });
}

/** Reads a request body only up to the configured byte limit. */
export async function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string | undefined> {
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader && /^\d+$/.test(contentLengthHeader.trim())) {
    if (Number(contentLengthHeader) > maxBytes) return undefined;
  }
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const cancelOnAbort = () => {
    void reader.cancel(new Error('Request aborted')).catch(() => undefined);
  };
  signal.addEventListener('abort', cancelOnAbort, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new Error('Request aborted');
      const { done, value } = await reader.read();
      if (signal.aborted) throw new Error('Request aborted');
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener('abort', cancelOnAbort);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
