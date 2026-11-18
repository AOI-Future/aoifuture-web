# Design System Adoption

- Canonical source: <https://github.com/AOI-Future/aoi-design-system>
- Adopted version: `2.1.0`
- Product: AOI Future Web
- Platform: Web
- Surface: Cyber by default; Consult only for consulting／business routes

## Boundary

- AOI Future foundations define brand roles, not page-level layouts.
- 蒼硝子 is an AOI Web brand material, not Apple-native Liquid Glass.
- Existing route-specific design and content remain product-owned.
- The original reference runtime (`support.js`, runtime Babel, dynamic evaluation) must not ship.
- Glass is limited to navigation, floating controls, and selected calls to action; content surfaces remain readable and stable.

## Verification gate

- [ ] Cyber／Consult do not mix within one route
- [ ] 390px viewport with no overlap, clipping, or off-screen panels
- [ ] keyboard navigation and focus-visible
- [ ] 200% browser zoom
- [ ] normal text contrast at least 4.5:1
- [ ] reduced motion and solid transparency fallback
- [ ] no runtime Babel／dynamic-eval design runtime

Existing tokens must be audited before replacement; this registration does not authorize a global restyle.
