import type { APIRoute } from 'astro';

const DEFAULT_BRIDGE_URL = 'https://aoifuture.com/api/v1/messages-bridge';

const json = (body: Record<string, string>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

export const POST: APIRoute = async ({ request }) => {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const { to, message } =
    payload && typeof payload === 'object'
      ? (payload as { to?: unknown; message?: unknown })
      : {};

  if (typeof to !== 'string' || to.trim() === '') {
    return json({ error: '"to" must be a non-empty string.' }, 400);
  }

  if (typeof message !== 'string' || message.trim() === '') {
    return json({ error: '"message" must be a non-empty string.' }, 400);
  }

  const bridgeUrl = import.meta.env.WEBCHAT_BRIDGE_URL || DEFAULT_BRIDGE_URL;

  try {
    const upstreamResponse = await fetch(bridgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: to.trim(),
        message: message.trim(),
      }),
    });

    let upstreamJson: unknown;

    try {
      upstreamJson = await upstreamResponse.json();
    } catch {
      return json({ error: 'Upstream service returned invalid JSON.' }, 502);
    }

    return new Response(JSON.stringify(upstreamJson), {
      status: upstreamResponse.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Failed to forward message request.', error);
    return json({ error: 'Failed to reach upstream service.' }, 502);
  }
};

export const ALL: APIRoute = async () => json({ error: 'Method not allowed.' }, 405);
