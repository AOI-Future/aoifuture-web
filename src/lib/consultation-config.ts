export type ConsultationConfig = ReturnType<typeof getConsultationConfig>;
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
