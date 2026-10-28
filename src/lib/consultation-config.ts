export type ConsultationConfig = ReturnType<typeof getConsultationConfig> & {
  expectedAction?: string;
  expectedHostname?: string;
};
const truthy = (value: string | undefined) => value === 'true' || value === '1';
export function getConsultationConfig(env: Record<string, string | undefined> = process.env) {
  const origins = (env.CONSULTATION_ALLOWED_ORIGINS || 'https://aoifuture.com,https://www.aoifuture.com,https://nozaki.com,https://www.nozaki.com,https://wfhradio.tokyo,https://www.wfhradio.tokyo,https://dispatch.aoifuture.com').split(',').map(x => x.trim()).filter(Boolean);
  return {
    enabled: truthy(env.CONSULTATION_NATIVE_FORM_ENABLED),
    fallbackUrl: env.PUBLIC_CONSULTATION_FALLBACK_URL || 'https://aoifuture.notion.site/6a828f1f8371416187ab544742734fcd?pvs=105',
    allowedOrigins: origins,
    allowedHostnames: origins.map(origin => { try { return new URL(origin).hostname; } catch { return ''; } }).filter(Boolean),
    turnstileSiteKey: env.PUBLIC_TURNSTILE_SITE_KEY || '', turnstileSecretKey: env.TURNSTILE_SECRET_KEY || '',
    requireTurnstile: truthy(env.CONSULTATION_REQUIRE_TURNSTILE), notionApiKey: env.NOTION_API_KEY || '',
    notionDataSourceId: env.NOTION_CONSULTATION_DATA_SOURCE_ID || '', notionApiVersion: env.NOTION_API_VERSION || '2025-09-03',
  };
}

// Select before feature/CORS checks, independently of the write-only shared flags.
// Both nozaki hostnames are intercepted; only the canonical HTTPS apex is enabled.
export function getContactConfigForOrigin(
  origin: string | null,
  base: ConsultationConfig,
  env: Record<string, string | undefined> = process.env,
): ConsultationConfig {
  let hostname = '';
  try { hostname = new URL(origin || '').hostname; } catch { return base; }
  if (hostname !== 'nozaki.com' && hostname !== 'www.nozaki.com') return base;
  return {
    ...base,
    enabled: truthy(env.NOZAKI_CONTACT_ENABLED),
    allowedOrigins: ['https://nozaki.com'],
    allowedHostnames: ['nozaki.com'],
    turnstileSiteKey: '',
    turnstileSecretKey: env.NOZAKI_TURNSTILE_SECRET_KEY || '',
    requireTurnstile: true,
    expectedAction: 'contact_intake',
    expectedHostname: 'nozaki.com',
  };
}
