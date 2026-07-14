export type TurnstileConfig = {
  secretKey?: string;
  required: boolean;
  allowedHostnames: string[];
};

export async function verifyTurnstile(
  token: string,
  remoteIp: string | undefined,
  config: TurnstileConfig,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!config.secretKey) return config.required ? { ok: false, reason: 'turnstile_not_configured' } : { ok: true };
  if (!token) return { ok: false, reason: 'turnstile_token_missing' };
  const body = new URLSearchParams({ secret: config.secretKey, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body, signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { ok: false, reason: 'turnstile_unavailable' };
    const result = await response.json() as { success?: boolean; hostname?: string };
    if (!result.success) return { ok: false, reason: 'turnstile_invalid' };
    if (config.allowedHostnames.length && (!result.hostname || !config.allowedHostnames.includes(result.hostname))) return { ok: false, reason: 'turnstile_hostname_invalid' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'turnstile_unavailable' };
  }
}
