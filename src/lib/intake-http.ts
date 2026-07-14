export const MAX_INTAKE_BODY_BYTES = 16 * 1024;

export type BoundedBodyResult =
  | { ok: true; text: string }
  | { ok: false; status: 400 | 408 | 413 | 415; error: string };

export function hasJsonContentType(value: string | null): boolean {
  if (!value) return false;
  const [mediaType, ...parameters] = value.split(';').map(part => part.trim().toLowerCase());
  if (mediaType !== 'application/json') return false;
  return parameters.every(parameter => parameter === '' || parameter === 'charset=utf-8');
}

export async function readBoundedBody(request: Request, maxBytes = MAX_INTAKE_BODY_BYTES, timeoutMs = 2_000): Promise<BoundedBodyResult> {
  if (!hasJsonContentType(request.headers.get('content-type'))) return { ok: false, status: 415, error: 'json_required' };

  const declaredHeader = request.headers.get('content-length');
  if (declaredHeader !== null) {
    if (!/^\d+$/.test(declaredHeader.trim())) return { ok: false, status: 400, error: 'invalid_content_length' };
    if (Number(declaredHeader) > maxBytes) return { ok: false, status: 413, error: 'body_too_large' };
  }

  if (!request.body) return { ok: false, status: 400, error: 'invalid_json' };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const deadline = Date.now() + timeoutMs;
  try {
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('body_timeout');
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('body_timeout')), remaining); });
      const { done, value } = await Promise.race([reader.read(), timeout]).finally(() => { if (timer) clearTimeout(timer); });
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel('body_too_large').catch(() => undefined);
        return { ok: false, status: 413, error: 'body_too_large' };
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'body_timeout') {
      void reader.cancel('body_timeout').catch(() => undefined);
      return { ok: false, status: 408, error: 'body_timeout' };
    }
    return { ok: false, status: 400, error: 'invalid_body' };
  }

  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(body) };
  } catch {
    return { ok: false, status: 400, error: 'invalid_encoding' };
  }
}
