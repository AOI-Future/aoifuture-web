import { createHmac } from 'node:crypto';
import type { AbuseLimitInput } from './consultation-abuse-limit';

export type DistributedLimitConfig = { url: string; token: string; hashSecret: string; namespace: string };
export type DistributedLimitResult = { allowed: true; softDaily?: boolean } | { allowed: false; retryAfter: number; breaker?: boolean } | { allowed: false; unavailable: true };

const script = `
local limits = {}
for i = 1, #KEYS do limits[i] = tonumber(ARGV[i]) end
local windows = {}
for i = 1, #KEYS do windows[i] = tonumber(ARGV[#KEYS + i]) end
local current = {}
for i = 1, #KEYS do
  current[i] = tonumber(redis.call('GET', KEYS[i]) or '0')
  if current[i] >= limits[i] then
    local ttl = redis.call('PTTL', KEYS[i])
    return {0, ttl, i, current[2] or 0}
  end
end
for i = 1, #KEYS do
  current[i] = redis.call('INCR', KEYS[i])
  if current[i] == 1 then redis.call('PEXPIRE', KEYS[i], windows[i]) end
end
return {1, 0, 0, current[2]}
`.trim();

export class UpstashAbuseLimiter {
  constructor(private readonly config: DistributedLimitConfig, private readonly fetcher: typeof fetch = fetch) {}

  private key(scope: string, value: string) {
    return `consultation:${this.config.namespace}:${scope}:${createHmac('sha256', this.config.hashSecret).update(value).digest('hex')}`;
  }

  async check(input: AbuseLimitInput): Promise<DistributedLimitResult> {
    const entries = [
      { key: `consultation:${this.config.namespace}:global-hour`, limit: 30, windowMs: 60 * 60_000 },
      { key: `consultation:${this.config.namespace}:global-day`, limit: 100, windowMs: 24 * 60 * 60_000 },
      ...(input.ip ? [{ key: this.key('ip', input.ip), limit: 5, windowMs: 10 * 60_000 }] : []),
      { key: this.key('email', input.email.trim().toLowerCase()), limit: 3, windowMs: 24 * 60 * 60_000 },
      { key: this.key('idempotency', input.idempotencyKey), limit: 3, windowMs: 10 * 60_000 },
    ];
    const command = ['EVAL', script, String(entries.length), ...entries.map(entry => entry.key), ...entries.map(entry => String(entry.limit)), ...entries.map(entry => String(entry.windowMs))];
    try {
      const response = await this.fetcher(this.config.url.replace(/\/$/, ''), {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) return { allowed: false, unavailable: true };
      const data = await response.json() as { result?: unknown };
      if (!Array.isArray(data.result) || data.result.length !== 4 || !data.result.every(value => typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value))) {
        return { allowed: false, unavailable: true };
      }
      const [status, ttl, blockedIndex, daily] = data.result as number[];
      if (daily < 0) return { allowed: false, unavailable: true };
      if (status === 1 && ttl === 0 && blockedIndex === 0) return daily >= 60 ? { allowed: true, softDaily: true } : { allowed: true };
      if (status !== 0 || ttl < 0 || blockedIndex < 1 || blockedIndex > entries.length) {
        return { allowed: false, unavailable: true };
      }
      return { allowed: false, retryAfter: Math.max(1, Math.ceil(ttl / 1000)), ...(blockedIndex === 2 ? { breaker: true } : {}) };
    } catch {
      return { allowed: false, unavailable: true };
    }
  }
}
