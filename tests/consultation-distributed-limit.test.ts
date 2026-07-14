import { describe, expect, it, vi } from 'vitest';
import { UpstashAbuseLimiter } from '../src/lib/consultation-distributed-limit';

const input = { ip: '203.0.113.5', email: 'private@example.com', idempotencyKey: '123e4567-e89b-42d3-a456-426614174000', now: 0 };
const config = { url: 'https://redis.example.test', token: 'token', hashSecret: '0123456789abcdef0123456789abcdef', namespace: 'preview' };

describe('atomic distributed abuse limiter', () => {
  it('sends one EVAL command with only HMAC identifiers', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const serialized = String(init?.body);
      const command = JSON.parse(serialized) as unknown[];
      const lua = String(command[1]);
      expect(serialized).toContain('EVAL');
      expect(lua.indexOf("redis.call('GET'")).toBeLessThan(lua.indexOf("redis.call('INCR'"));
      expect(serialized).not.toContain(input.ip);
      expect(serialized).not.toContain(input.email);
      expect(serialized).not.toContain(input.idempotencyKey);
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token');
      expect(serialized).toContain('consultation:preview:global-day');
      return new Response(JSON.stringify({ result: [1, 0, 0, 1] }));
    }) as unknown as typeof fetch;
    await expect(new UpstashAbuseLimiter(config, fetcher).check(input)).resolves.toEqual({ allowed: true });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('returns a bounded Retry-After when Redis blocks the request', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ result: [0, 42_001, 1, 0] }))) as unknown as typeof fetch;
    await expect(new UpstashAbuseLimiter(config, fetcher).check(input)).resolves.toEqual({ allowed: false, retryAfter: 43 });
  });

  it('reports the daily soft threshold and hard breaker separately', async () => {
    const soft = vi.fn(async () => new Response(JSON.stringify({ result: [1, 0, 0, 60] }))) as unknown as typeof fetch;
    await expect(new UpstashAbuseLimiter(config, soft).check(input)).resolves.toEqual({ allowed: true, softDaily: true });
    const hard = vi.fn(async () => new Response(JSON.stringify({ result: [0, 86_400_000, 2, 0] }))) as unknown as typeof fetch;
    await expect(new UpstashAbuseLimiter(config, hard).check(input)).resolves.toEqual({ allowed: false, retryAfter: 86400, breaker: true });
  });

  it('fails closed on network, HTTP and malformed response errors', async () => {
    const network = vi.fn(async () => { throw new Error('down'); }) as unknown as typeof fetch;
    const http = vi.fn(async () => new Response('down', { status: 500 })) as unknown as typeof fetch;
    const malformed = vi.fn(async () => new Response(JSON.stringify({ result: 'bad' }))) as unknown as typeof fetch;
    const badStatus = vi.fn(async () => new Response(JSON.stringify({ result: [2, 0, 0, 0] }))) as unknown as typeof fetch;
    const badTtl = vi.fn(async () => new Response(JSON.stringify({ result: [0, 'oops', 1, 0] }))) as unknown as typeof fetch;
    const nullTtl = vi.fn(async () => new Response(JSON.stringify({ result: [0, null, 1, 0] }))) as unknown as typeof fetch;
    const extraElement = vi.fn(async () => new Response(JSON.stringify({ result: [1, 0, 0, 1, 99] }))) as unknown as typeof fetch;
    const fractionalTtl = vi.fn(async () => new Response(JSON.stringify({ result: [0, 1.5, 1, 0] }))) as unknown as typeof fetch;
    const negativeDaily = vi.fn(async () => new Response(JSON.stringify({ result: [1, 0, 0, -1] }))) as unknown as typeof fetch;
    for (const fetcher of [network, http, malformed, badStatus, badTtl, nullTtl, extraElement, fractionalTtl, negativeDaily]) {
      await expect(new UpstashAbuseLimiter(config, fetcher).check(input)).resolves.toEqual({ allowed: false, unavailable: true });
    }
  });
});
