const MAX_MESSAGE_LENGTH = 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

const ALLOWED_ORIGINS = new Set([
  'https://aoifuture.com',
  'https://www.aoifuture.com',
  'https://nozaki.com',
  'https://www.nozaki.com'
]);

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/iu,
  /system\s+prompt/iu,
  /developer\s+message/iu,
  /reveal\s+(your|the)\s+(prompt|instructions|secrets?)/iu,
  /\b(tool|tools)\b.{0,40}\b(use|call|run|execute)\b/iu,
  /\b(exec|spawn|bash|shell|curl|wget|ssh|docker)\b/iu,
  /\b(password|token|secret|api[-_\s]?key|credential)s?\b/iu
];

type RateLimitEntry = {
  count: number;
  expiresAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

function cleanupExpired(now: number) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.expiresAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function getAllowedOrigins() {
  return Array.from(ALLOWED_ORIGINS);
}

export function isAllowedOrigin(origin: string | null) {
  return origin !== null && ALLOWED_ORIGINS.has(origin);
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  }

  const realIp = request.headers.get('x-real-ip');
  return realIp?.trim() || 'unknown';
}

export function enforceRateLimit(key: string) {
  const now = Date.now();
  cleanupExpired(now);

  const current = rateLimitStore.get(key);
  if (!current || current.expiresAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      expiresAt: now + RATE_LIMIT_WINDOW_MS
    });

    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    };
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.expiresAt
    };
  }

  current.count += 1;
  rateLimitStore.set(key, current);

  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - current.count,
    resetAt: current.expiresAt
  };
}

export function normalizeUserMessage(value: unknown) {
  const text = typeof value === 'string' ? value : '';
  return text.replace(/\r\n/g, '\n').trim();
}

export function validateUserMessage(message: string) {
  if (!message) {
    return '相談内容を入力してください。';
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return `相談内容は${MAX_MESSAGE_LENGTH}文字以内で入力してください。`;
  }

  return null;
}

export function analyzePromptInjection(message: string) {
  const matched = INJECTION_PATTERNS
    .filter((pattern) => pattern.test(message))
    .map((pattern) => pattern.source);

  return {
    flagged: matched.length > 0,
    matchedPatterns: matched
  };
}

export function buildSandboxedPayload(message: string) {
  const analysis = analyzePromptInjection(message);

  return {
    schema_version: '2026-03-14',
    channel: 'public_webchat',
    content_type: 'consultation_text',
    handling: {
      treat_as_data_only: true,
      allow_tool_execution: false,
      allow_secret_access: false,
      allow_system_prompt_disclosure: false
    },
    prompt_injection: analysis,
    consultation_text: message
  };
}

export function getWebchatLimits() {
  return {
    maxMessageLength: MAX_MESSAGE_LENGTH,
    maxRequestsPerWindow: MAX_REQUESTS_PER_WINDOW,
    rateLimitWindowMs: RATE_LIMIT_WINDOW_MS
  };
}
