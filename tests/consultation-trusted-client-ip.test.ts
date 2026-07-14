import { describe, expect, it } from 'vitest';
import { trustedClientIp } from '../src/lib/trusted-client-ip';

describe('trusted Vercel client IP', () => {
  it('ignores spoofable forwarding headers outside the trusted proxy', () => {
    expect(trustedClientIp(new Headers({ 'x-forwarded-for': '203.0.113.9' }), false)).toBeUndefined();
  });

  it('accepts valid Vercel-overwritten IPv4 and IPv6 values', () => {
    expect(trustedClientIp(new Headers({ 'x-forwarded-for': '203.0.113.9' }), true)).toBe('203.0.113.9');
    expect(trustedClientIp(new Headers({ 'x-forwarded-for': '2001:db8::1' }), true)).toBe('2001:db8::1');
  });

  it('rejects malformed values', () => {
    expect(trustedClientIp(new Headers({ 'x-forwarded-for': 'attacker' }), true)).toBeUndefined();
    expect(trustedClientIp(new Headers(), true)).toBeUndefined();
  });
});
