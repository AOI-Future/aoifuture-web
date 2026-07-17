import { describe, expect, it } from 'vitest';
import { InMemoryAbuseLimiter, type AbuseLimitRule } from '../src/lib/consultation-abuse-limit';

const input = (now: number, overrides: Record<string, unknown> = {}) => ({ ip: '203.0.113.5', email: 'person@example.com', idempotencyKey: crypto.randomUUID(), now, ...overrides });
const limiterFor = (rule: AbuseLimitRule) => new InMemoryAbuseLimiter([rule]);

describe('process-local pre-storage abuse limiter', () => {
  it.each([
    { scope: 'ip', value: { ip: '203.0.113.5' } },
    { scope: 'email', value: { email: 'person@example.com' } },
    { scope: 'idempotency', value: { idempotencyKey: '123e4567-e89b-42d3-a456-426614174000' } },
  ] as const)('enforces $scope threshold without logging raw identifiers', ({ scope, value }) => {
    const limiter = limiterFor({ scope, limit: 2, windowMs: 1_000 });
    expect(limiter.check(input(0, value))).toEqual({ allowed: true });
    expect(limiter.check(input(1, value))).toEqual({ allowed: true });
    expect(limiter.check(input(2, value))).toEqual({ allowed: false, retryAfter: 1 });
  });

  it('enforces a global threshold across changing IP, email and payload', () => {
    const limiter = limiterFor({ scope: 'global', limit: 2, windowMs: 60_000 });
    expect(limiter.check(input(0))).toEqual({ allowed: true });
    expect(limiter.check(input(1, { ip: '198.51.100.9', email: 'other@example.com' }))).toEqual({ allowed: true });
    expect(limiter.check(input(2, { ip: '192.0.2.8', email: 'third@example.com' }))).toMatchObject({ allowed: false });
  });

  it('releases a bucket after its window', () => {
    const limiter = limiterFor({ scope: 'ip', limit: 1, windowMs: 1_000 });
    expect(limiter.check(input(0))).toEqual({ allowed: true });
    expect(limiter.check(input(999))).toMatchObject({ allowed: false });
    expect(limiter.check(input(1_001))).toEqual({ allowed: true });
  });

  it('is atomic for concurrent calls within one JavaScript process', async () => {
    const limiter = limiterFor({ scope: 'global', limit: 3, windowMs: 60_000 });
    const results = await Promise.all(Array.from({ length: 10 }, (_, index) => Promise.resolve().then(() => limiter.check(input(index)))));
    expect(results.filter(result => result.allowed)).toHaveLength(3);
    expect(results.filter(result => !result.allowed)).toHaveLength(7);
  });
});
