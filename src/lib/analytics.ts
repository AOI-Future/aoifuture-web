type AnalyticsFields = Record<string, string>;
type AnalyticsWindow = Window & { gtag?: (...args: unknown[]) => void };

/**
 * Emits only with accepted consent and never lets analytics/storage failures
 * escape into product behavior. `true` means this emission opportunity is
 * consumed, including a missing or throwing gtag, so callers do not retry it.
 */
export function emitAnalyticsBestEffort(name: string, fields: () => AnalyticsFields): boolean {
  try {
    if (localStorage.getItem('cookie-consent') !== 'accepted') return false;
    const gtag = (window as AnalyticsWindow).gtag;
    if (typeof gtag === 'function') gtag('event', name, fields());
    return true;
  } catch {
    return true;
  }
}