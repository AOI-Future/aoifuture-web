# aoifuture-web — AGENTS.md

Astro + React + Tailwind v4 site for AOI Future. This repo is a Web consumer and
reference implementation of **AOI Future Design System v2.1**. The canonical
source is `AOI-Future/aoi-design-system`; product-specific adoption is recorded
in `DESIGN_SYSTEM.md`. Other repos must not derive rules directly from this site.

## Design System v2 — 蒼硝子 (Liquid Glass)

Use the canonical `docs/FOUNDATIONS.md`, `docs/WEB.md`, and versioned token file.
This repository's CSS is a product implementation, not the canonical source.
Key invariants:

1. **Reflectivity is AOI Web token-owned.** `--g-specular` readability ceiling = **0.32**
   (glow ON). Default 0.20. Reduce = 0.06. Never exceed.
2. **Glass = floating/controls only.** Never lay glass under wide body surfaces.
   No glass-on-glass.
3. **Clear variant needs a dimming layer; no body text on Clear.** Body ground is
   Regular (α ≥ 0.42).
4. **Concentric radius:** inner-radius = outer-radius − padding.
5. **3 typography zones:** no <12px text in the specular band (top ~28%); ≥12px
   from each edge (dark-edge margin).
6. **Contrast ≥ 4.5:1 / min 12px chrome, 14px JP body / tap 44px.**
7. **AOI custom motion is 200–500ms, linear / ease-in-out.** Do not override native system interaction rules.
8. **Reduce Transparency / Motion follow OS settings.** Never disable.
9. **No emoji.** Use bracketed ASCII (`[ON]` `[×]`) + monospace glyphs (`>` `<` `·` `|`).
10. **Pure black `#000000` ground.** Brand = cyan, layered by alpha.

### Two surfaces
- **Cyber** (default, brand): ground `#000000`, tint cyan `#00ffff`, scanline.
  landing / nictia / sound-umwelt / about / legal. Driven by `src/styles/global.css`.
- **Consult** (business): off-white `#fafafa`, navy `#1a1a2e` / warm-red `#e94560`,
  **no glow / no scanline**. `/consulting` only. Driven by `src/styles/consulting.css`.

Both surfaces share the same 蒼硝子 structure (geometry, type roles, motion,
concentric radius); only the tint/palette differs.

## Web implementation map (this repo)

| Concern | Location |
|---|---|
| v2 tokens (Cyber) — `--g-*`, `--r2-*`, `--fs-*`+roles, spacing, `--dur`/`--ease` | `src/styles/global.css` `:root` |
| v1 `cyber-*` tokens (compat/alias, default surface) | `src/styles/global.css` `@theme` (unchanged) |
| `.aoi-glass` material (5 layers) + `--capsule` / `--clear` / `--consult` | `src/styles/global.css` |
| Legacy `.glass` (privacy/legal) | `src/styles/global.css` — **preserved, do not remove** |
| Floating controls CSS (`.aoi-tabbar` / `.aoi-search-island` / `.aoi-toolbar`) | `src/styles/global.css` |
| Scroll behaviour + `applyTint()` (reusable, opt-in) | `src/scripts/floating-controls.ts` |
| a11y `@media` (reduced-transparency / reduced-motion) | `src/styles/global.css` + `src/styles/consulting.css` |
| Consult v2 tokens + Consult glass variant | `src/styles/consulting.css` |

### Material — `.aoi-glass` (5 layers, strict order)
1 tint `rgba(var(--g-glass-fill), --g-alpha)` → 2 `backdrop-filter: blur() saturate()`
→ 3 dark edge `inset 0 0 0 1px rgba(0,0,0,--g-edge)` → 4 specular
`inset 0 1.5px 1px rgba(255,255,255,--g-specular)` → 5 cyan bloom
`0 0 30px rgba(0,255,255,--g-bloom)` + outer float `--g-lift`.

### Tint / floating controls (opt-in)
```ts
import { initFloatingControls, applyTint } from '../scripts/floating-controls';
initFloatingControls();          // toolbar fades in / tabbar shrinks on scroll
applyTint(0.42, { glow: true }); // one setting drives α/blur/edge/specular/bloom
```
Markup contract: `[data-aoi-toolbar]` (top, `.aoi-toolbar .aoi-glass`),
`[data-aoi-tabbar]` (bottom, `.aoi-tabbar .aoi-glass .aoi-glass--capsule`),
`.aoi-search-island` (56×56, right). Not wired into any layout by default —
these are reusable building blocks; existing pages are untouched.

### Type roles
32 HERO / 24 H2 / 20 MODULE / 16 LEAD / 14 BODY (JP min, lh 1.75) / 12 LABEL /
10 EYEBROW (EN, letter-spacing 0.3em, no body). Tokens: `--fs-hero`…`--fs-eyebrow`.

## Constraints
- **Non-destructive first.** `npm run build` must pass; if not, shrink the change.
  v1 `cyber-*` and `.glass` are the alias/compat layer — keep them.
- Runtime: project-local Node only. No global installs.
- Use the canonical token file and licensed product assets. Do not copy the
  unlicensed source-bundle font or the dynamic-eval reference runtime.
