import type { APIRoute } from 'astro';
import {
  buildSandboxedPayload,
  enforceRateLimit,
  getClientIp,
  getWebchatLimits,
  isAllowedOrigin,
  normalizeUserMessage,
  validateUserMessage
} from '../../lib/webchat-security';

const {
  maxMessageLength,
  maxRequestsPerWindow,
  rateLimitWindowMs
} = getWebchatLimits();

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && isAllowedOrigin(origin) ? origin : 'https://aoifuture.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
  'Access-Control-Max-Age': '600',
  Vary: 'Origin'
});

const json = (status: number, body: Record<string, unknown>, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });

async function forwardToWebhook(payload: ReturnType<typeof buildSandboxedPayload>) {
  const webhookUrl = import.meta.env.WEBCHAT_FORWARD_WEBHOOK_URL;
  const webhookToken = import.meta.env.WEBCHAT_FORWARD_WEBHOOK_TOKEN;

  if (!webhookUrl) {
    return { forwarded: false };
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Webhook forwarding failed with status ${response.status}`);
  }

  return { forwarded: true };
}

export const OPTIONS: APIRoute = async ({ request }) => {
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin)
  });
};

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin)) {
    return json(403, { error: 'origin_not_allowed' }, origin);
  }

  const ip = getClientIp(request);
  const body = await request.json().catch(() => null);
  const to = typeof body?.to === 'string' ? body.to.trim() : '';
  const message = normalizeUserMessage(body?.message);

  const validationError = validateUserMessage(message);
  if (validationError) {
    return json(400, { error: 'invalid_message', message: validationError }, origin);
  }

  const uuidLike = /^[a-z0-9-]{8,80}$/i.test(to) ? to : 'missing';
  const ipLimit = enforceRateLimit(`ip:${ip}`);
  const destinationLimit = enforceRateLimit(`to:${uuidLike}`);
  if (!ipLimit.allowed || !destinationLimit.allowed) {
    const retryAfterMs = Math.max(ipLimit.resetAt, destinationLimit.resetAt) - Date.now();
    return new Response(
      JSON.stringify({
        error: 'rate_limited',
        message: `送信回数が上限に達しました。${Math.ceil(retryAfterMs / 1000)}秒ほど待ってから再度お試しください。`
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders(origin),
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Retry-After': String(Math.max(1, Math.ceil(retryAfterMs / 1000)))
        }
      }
    );
  }

  const payload = buildSandboxedPayload(message);

  let forwardResult = { forwarded: false };

  try {
    forwardResult = await forwardToWebhook(payload);
  } catch (error) {
    console.error('[webchat-intake] webhook forwarding error', error);
    return json(
      502,
      {
        error: 'upstream_unavailable',
        message: '現在ヒアリング窓口が混み合っています。少し時間を置いて再度お試しください。'
      },
      origin
    );
  }

  return json(
    200,
    {
      ok: true,
      forwarded: forwardResult.forwarded,
      limits: {
        maxMessageLength,
        maxRequestsPerMinute: maxRequestsPerWindow,
        rateLimitWindowMs
      },
      nextPrompt:
        '受け取りました。まずは、現在の業務フロー、AIに任せたい作業、人間確認を残したい地点の3点を順に整理してください。'
    },
    origin
  );
};
