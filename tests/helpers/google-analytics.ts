import type { Page } from '@playwright/test';

export type CapturedAnalyticsRequest = {
  url: string;
  postData: string;
};

/**
 * Replaces gtag.js with a deterministic provider stub and intercepts every
 * collect request. No request reaches Google. The stub intentionally applies
 * GA's implicit location/referrer fallback when config omits either field.
 */
export async function captureGoogleAnalytics(page: Page, requests: CapturedAnalyticsRequest[]) {
  await page.route('https://www.googletagmanager.com/gtag/js**', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `(() => {
      let analyticsGranted = false;
      const endpoint = 'https://www.google-analytics.com/g/collect?v=2&tid=G-44419Y68H7';
      const send = (name, fields, config) => {
        const body = new URLSearchParams();
        body.set('en', name);
        body.set('page_location', config.page_location || window.location.href);
        body.set('page_referrer', Object.prototype.hasOwnProperty.call(config, 'page_referrer') ? config.page_referrer : document.referrer);
        for (const [key, value] of Object.entries(fields || {})) body.set(key, String(value));
        fetch(endpoint, { method: 'POST', body: body.toString(), keepalive: true });
      };
      let pageConfig = {};
      const process = entry => {
        const args = Array.from(entry);
        if (args[0] === 'consent') {
          if (args[1] === 'default') analyticsGranted = args[2]?.analytics_storage === 'granted';
          if (args[1] === 'update' && args[2]?.analytics_storage) analyticsGranted = args[2].analytics_storage === 'granted';
          return;
        }
        if (args[0] === 'config') {
          pageConfig = { ...(args[2] || {}) };
          if (analyticsGranted) send('page_view', {}, pageConfig);
          return;
        }
        if (args[0] === 'event' && analyticsGranted) send(String(args[1]), args[2] || {}, pageConfig);
      };
      const layer = window.dataLayer = window.dataLayer || [];
      for (const entry of layer) process(entry);
      const originalPush = layer.push.bind(layer);
      layer.push = (...entries) => {
        const result = originalPush(...entries);
        for (const entry of entries) process(entry);
        return result;
      };
    })();`,
  }));
  await page.route('https://www.google-analytics.com/g/collect**', async route => {
    requests.push({ url: route.request().url(), postData: route.request().postData() || '' });
    await route.fulfill({ status: 204, body: '' });
  });
}

export function analyticsPayload(request: CapturedAnalyticsRequest) {
  const query = new URL(request.url).searchParams;
  const body = new URLSearchParams(request.postData);
  return { query, body, text: `${request.url}\n${request.postData}` };
}
