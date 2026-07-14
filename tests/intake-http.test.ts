import { describe, expect, it, vi } from 'vitest';
import { hasJsonContentType, readBoundedBody } from '../src/lib/intake-http';

describe('bounded intake HTTP body', () => {
  it.each([
    ['application/json', true],
    ['application/json; charset=utf-8', true],
    ['Application/JSON; Charset=UTF-8', true],
    ['application/jsonp', false],
    ['application/json-patch+json', false],
    ['application/json; profile=evil', false],
    ['text/json', false],
  ])('validates media type %s', (value, expected) => expect(hasJsonContentType(value)).toBe(expected));

  it('rejects declared oversize before pulling the stream', async () => {
    const pull = vi.fn();
    const request = new Request('https://aoifuture.com/api/contact-intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '17' },
      body: new ReadableStream({ pull }, { highWaterMark: 0 }),
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    await expect(readBoundedBody(request, 16)).resolves.toEqual({ ok: false, status: 413, error: 'body_too_large' });
    expect(pull).not.toHaveBeenCalled();
  });

  it('cancels an undeclared or under-declared stream at max plus one byte', async () => {
    for (const contentLength of [undefined, '1']) {
      const cancel = vi.fn();
      const request = new Request('https://aoifuture.com/api/contact-intake', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(contentLength ? { 'content-length': contentLength } : {}) },
        body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(17)); }, cancel }),
        duplex: 'half',
      } as RequestInit & { duplex: 'half' });
      await expect(readBoundedBody(request, 16)).resolves.toEqual({ ok: false, status: 413, error: 'body_too_large' });
      expect(cancel).toHaveBeenCalledOnce();
    }
  });

  it('keeps 413 when stream cancellation fails', async () => {
    const request = new Request('https://aoifuture.com/api/contact-intake', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(17)); }, cancel() { throw new Error('cancel failed'); } }),
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    await expect(readBoundedBody(request, 16)).resolves.toEqual({ ok: false, status: 413, error: 'body_too_large' });
  });

  it('uses byte length for multibyte content', async () => {
    const request = new Request('https://aoifuture.com/api/contact-intake', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '😀😀😀😀😀',
    });
    await expect(readBoundedBody(request, 16)).resolves.toEqual({ ok: false, status: 413, error: 'body_too_large' });
  });

  it('cancels a slow or never-ending body at the total deadline', async () => {
    const cancel = vi.fn();
    const request = new Request('https://aoifuture.com/api/contact-intake', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); }, cancel }),
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    await expect(readBoundedBody(request, 16, 10)).resolves.toEqual({ ok: false, status: 408, error: 'body_timeout' });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('rejects malformed Content-Length and invalid UTF-8', async () => {
    const malformed = new Request('https://aoifuture.com/api/contact-intake', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '-1' }, body: '{}' });
    await expect(readBoundedBody(malformed)).resolves.toEqual({ ok: false, status: 400, error: 'invalid_content_length' });
    const invalidUtf8 = new Request('https://aoifuture.com/api/contact-intake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: new Uint8Array([0xc3, 0x28]) });
    await expect(readBoundedBody(invalidUtf8)).resolves.toEqual({ ok: false, status: 400, error: 'invalid_encoding' });
  });
});
