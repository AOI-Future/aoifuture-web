import { describe, expect, it, vi } from 'vitest';
import { verifyTurnstile } from '../src/lib/consultation-turnstile';

describe('turnstile', () => {
  it('is disabled without a key and fails closed when required', async () => {
    await expect(verifyTurnstile('', undefined, { required: false, allowedHostnames: [] })).resolves.toEqual({ ok: true });
    await expect(verifyTurnstile('', undefined, { required: true, allowedHostnames: [] })).resolves.toEqual({ ok: false, reason: 'turnstile_not_configured' });
  });

  it('allows an empty token in optional-observe mode even when a secret exists', async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    await expect(verifyTurnstile('', undefined, { secretKey: 'secret', required: false, allowedHostnames: [] }, fetcher)).resolves.toEqual({ ok: true });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('validates response, hostname and action and sends an idempotency key', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;
      expect(body.get('idempotency_key')).toBe('123e4567-e89b-42d3-a456-426614174000');
      return new Response(JSON.stringify({ success: true, hostname: 'aoifuture.com', action: 'contact_intake' }), { status: 200 });
    }) as unknown as typeof fetch;
    await expect(verifyTurnstile('token', '203.0.113.5', {
      secretKey: 'secret', required: true, allowedHostnames: ['aoifuture.com'], expectedAction: 'contact_intake', idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
    }, fetcher)).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('rejects invalid hostname, action and network failure', async () => {
    const badHost = vi.fn(async () => new Response(JSON.stringify({ success: true, hostname: 'evil.test', action: 'contact_intake' }))) as unknown as typeof fetch;
    await expect(verifyTurnstile('x', undefined, { secretKey: 's', required: true, allowedHostnames: ['aoifuture.com'], expectedAction: 'contact_intake' }, badHost)).resolves.toEqual({ ok: false, reason: 'turnstile_hostname_invalid' });
    const badAction = vi.fn(async () => new Response(JSON.stringify({ success: true, hostname: 'aoifuture.com', action: 'other' }))) as unknown as typeof fetch;
    await expect(verifyTurnstile('x', undefined, { secretKey: 's', required: true, allowedHostnames: ['aoifuture.com'], expectedAction: 'contact_intake' }, badAction)).resolves.toEqual({ ok: false, reason: 'turnstile_action_invalid' });
    const down = vi.fn(async () => { throw new Error('down'); }) as unknown as typeof fetch;
    await expect(verifyTurnstile('x', undefined, { secretKey: 's', required: true, allowedHostnames: [] }, down)).resolves.toEqual({ ok: false, reason: 'turnstile_unavailable' });
  });
});
