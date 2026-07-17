import { isIP } from 'node:net';

export function trustedClientIp(headers: Headers, trustedVercelProxy = process.env.VERCEL === '1'): string | undefined {
  if (!trustedVercelProxy) return undefined;
  const candidate = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return candidate && isIP(candidate) ? candidate : undefined;
}
