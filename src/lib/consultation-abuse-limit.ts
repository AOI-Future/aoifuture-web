import { createHash } from 'node:crypto';

export type AbuseLimitInput = { ip?: string; email: string; idempotencyKey: string; now: number };
export type AbuseLimitResult = { allowed: true } | { allowed: false; retryAfter: number };
export type AbuseLimitRule = { scope: 'global' | 'ip' | 'email' | 'idempotency'; limit: number; windowMs: number };

const defaultRules: AbuseLimitRule[] = [
  { scope: 'global', limit: 20, windowMs: 60_000 },
  { scope: 'ip', limit: 5, windowMs: 10 * 60_000 },
  { scope: 'email', limit: 3, windowMs: 24 * 60 * 60_000 },
  { scope: 'idempotency', limit: 3, windowMs: 10 * 60_000 },
];

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export class InMemoryAbuseLimiter {
  private readonly events = new Map<string, number[]>();
  constructor(private readonly rules: AbuseLimitRule[] = defaultRules) {}

  check(input: AbuseLimitInput): AbuseLimitResult {
    const keys: Partial<Record<AbuseLimitRule['scope'], string>> = {
      global: 'global',
      ...(input.ip ? { ip: digest(input.ip) } : {}),
      email: digest(input.email.trim().toLowerCase()),
      idempotency: digest(input.idempotencyKey),
    };

    const pending: Array<{ bucket: string; events: number[]; rule: AbuseLimitRule }> = [];
    for (const rule of this.rules) {
      const key = keys[rule.scope];
      if (!key) continue;
      const bucket = `${rule.scope}:${key}`;
      const cutoff = input.now - rule.windowMs;
      const events = (this.events.get(bucket) || []).filter(timestamp => timestamp > cutoff);
      if (events.length >= rule.limit) {
        const retryAfter = Math.max(1, Math.ceil((events[0] + rule.windowMs - input.now) / 1000));
        return { allowed: false, retryAfter };
      }
      pending.push({ bucket, events, rule });
    }

    for (const { bucket, events } of pending) this.events.set(bucket, [...events, input.now]);
    if (this.events.size > 10_000) this.prune(input.now);
    return { allowed: true };
  }

  private prune(now: number) {
    const longestWindow = Math.max(...this.rules.map(rule => rule.windowMs));
    for (const [key, events] of this.events) {
      const live = events.filter(timestamp => timestamp > now - longestWindow);
      if (live.length) this.events.set(key, live); else this.events.delete(key);
    }
  }
}

export const consultationAbuseLimiter = new InMemoryAbuseLimiter();
export const consultationPreTurnstileLimiter = new InMemoryAbuseLimiter([
  { scope: 'ip', limit: 20, windowMs: 60_000 },
]);
