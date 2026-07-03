/**
 * AOI Future Design System v2 — 蒼硝子 (Liquid Glass)
 * Floating controls scroll behaviour + tint driver.
 * Reference implementation. Spec: root ./AGENTS.md
 *
 * Not wired into any layout by default. Import and call from a page:
 *
 *   import { initFloatingControls, applyTint } from '../scripts/floating-controls';
 *   initFloatingControls();
 *
 * Pair with the .aoi-toolbar / .aoi-tabbar / .aoi-search-island classes
 * (see global.css). Markup contract:
 *   <header class="aoi-toolbar aoi-glass" data-aoi-toolbar> ... </header>
 *   <nav class="aoi-tabbar aoi-glass aoi-glass--capsule" data-aoi-tabbar> ... </nav>
 */

export interface FloatingControlsOptions {
  /** Scroll container. Defaults to window/document scrolling. */
  container?: HTMLElement | Window;
  /** Top toolbar element (fades in on scroll). */
  toolbar?: HTMLElement | null;
  /** Bottom capsule tab bar (shrinks on scroll). */
  tabbar?: HTMLElement | null;
}

function resolveScrollTop(container: HTMLElement | Window): number {
  if (container instanceof Window) {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }
  return container.scrollTop;
}

/**
 * Wire the ★2026 floating-bar scroll behaviour:
 *  - uniform top toolbar fades in:  opacity = min(1, scrollTop / 50)
 *  - tab bar shrinks:               scale(0.92) when scrollTop > 30
 */
export function initFloatingControls(options: FloatingControlsOptions = {}): () => void {
  const container: HTMLElement | Window = options.container ?? window;
  const toolbar =
    options.toolbar ?? document.querySelector<HTMLElement>('[data-aoi-toolbar]');
  const tabbar =
    options.tabbar ?? document.querySelector<HTMLElement>('[data-aoi-tabbar]');

  const onScroll = () => {
    const y = resolveScrollTop(container);
    if (toolbar) toolbar.style.opacity = String(Math.min(1, y / 50));
    if (tabbar) tabbar.style.transform = y > 30 ? 'scale(0.92)' : 'scale(1)';
  };

  const target: EventTarget = container;
  target.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // initial sync

  return () => target.removeEventListener('scroll', onScroll);
}

/**
 * Drive every glass surface from a single user setting t = 0..1 (--g-tint).
 * tint band: t < 0.25 CLEAR / t < 0.60 REGULAR (default) / else TINTED.
 * `glow` toggles the AOI cyan bloom; specular ceiling is 0.32 (glow ON).
 */
export function applyTint(t: number, { glow = true }: { glow?: boolean } = {}): void {
  const r = document.documentElement.style;
  const clamped = Math.max(0, Math.min(1, t));
  r.setProperty('--g-tint', clamped.toFixed(3));
  r.setProperty('--g-alpha', (0.1 + clamped * 0.6).toFixed(3));
  r.setProperty('--g-blur', (8 + clamped * 16).toFixed(1) + 'px');
  r.setProperty('--g-edge', (0.35 + clamped * 0.35).toFixed(3));
  r.setProperty('--g-specular', glow ? '0.32' : '0.20'); // 0.32 is the ceiling
  r.setProperty('--g-bloom', glow ? (0.1 + clamped * 0.08).toFixed(3) : '0');
}
