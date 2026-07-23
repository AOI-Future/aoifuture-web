# AOIFUTURE News Phase 3 — local layout evidence

Status: **LOCAL LAYOUT EVIDENCE ONLY — NOT REPORTING / NOT PUBLISHABLE**

The harness duplicated only the two contract-validated public sample cards already present on `/news/`. It did not create a source, URL, fact, or claim, and it did not add a public route or schema field. Screenshots are temporary files outside Git at `/var/folders/96/74g8thcx2xv1bgf865bhmg1c0000gn/T/aoifuture-news-phase-3-21cf8b0`.

## Font and canonical readback

- Before: 0 local font assets and 22386 generated News HTML bytes; generated News HTML referenced Google Fonts.
- After: 5 same-origin WOFF2 assets / 3131360 build bytes and 21282 generated News HTML bytes. The pinned Fontsource packages occupy 82200234 bytes after `npm ci`; browser first load requested 4 font files / 2101020 bytes; external font requests: 0.
- Delivery: Noto Sans JP 400/500/700 complete Japanese WOFF2 and JetBrains Mono 500/600 Latin WOFF2, all `font-display: swap`, package-lock pinned at Fontsource 5.3.0.
- All four generated News routes contain exactly one `https://aoifuture.com/.../` canonical, without `www`, preserving trailing slashes.

## Density measurements

| Scenario | Page px | Viewports | X overflow | First source y | Final source y | PNG bytes | SHA-256 |
| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |
| density-6-desktop | 6485 | 6.49 | NO | 1808 | 6092 | 578139 | `6418c8dcc5b89092f68689d89500dad4ee7ad17be274dfe35c81c7b94603e7fd` |
| density-6-mobile-390 | 7041 | 8.34 | NO | 1921 | 6687 | 458801 | `988d6de3a1891a33b2b2322b4459eef7afae6f8d910e99f8f37503e5b8fec2b7` |
| density-9-desktop | 9103 | 9.1 | NO | 1808 | 8711 | 817198 | `bf6bb8e017022decfa85f1fc4365cc65f42b2425217460ae80a5624e64e0d4b1` |
| density-9-mobile-390 | 9923 | 11.76 | NO | 1921 | 9570 | 650829 | `b08e71c459ea4e1a31a4f908e2907d15d82f311bb3c8a9dc0c2d6332b7f0706d` |
| density-12-desktop | 11662 | 11.66 | NO | 1808 | 11269 | 1053426 | `9c17cf1183ffb1a5ec17ff86c58fad3712b0ce965f0810bef90d45ec99b0c0bd` |
| density-12-mobile-390 | 12777 | 15.14 | NO | 1921 | 12424 | 840948 | `5275690890eb995d5d0788c5cc4f5fadf1b412f619874691ab1d96844ba4e972` |

Readback: all 6/9/12 compositions retained one finite Edition, one direct-source action per Signal, the Edition note, and the footer, with no pagination, collapse, or horizontal overflow. Six Signals is comfortable at both widths. Nine remains structurally clear but creates a long mobile scan. Twelve remains technically finite, but reaches 11.66 desktop and 15.14 mobile viewports; repeated two-card rhythm and distance to the final source/footer are the primary fatigue points. The footer and Edition note remain present and measurable, not sticky or hidden.

## Detour comparison

| Scenario | Page px | Viewports | X overflow | First source y | Final source y | PNG bytes | SHA-256 |
| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |
| detour-none-desktop | 9103 | 9.1 | NO | 1808 | 8711 | 817198 | `bf6bb8e017022decfa85f1fc4365cc65f42b2425217460ae80a5624e64e0d4b1` |
| detour-none-mobile-390 | 9923 | 11.76 | NO | 1921 | 9570 | 650678 | `4c845f950d96c80a5904bb1d722099be2d29c8782ab7c75b22d4af5f14a806df` |
| detour-compact-desktop | 9370 | 9.37 | NO | 1808 | 8977 | 838892 | `2e47f1184d008b0ac8e6ba29c947cad12ac643f8107f3cf1834122e39c1213a9` |
| detour-compact-mobile-390 | 10271 | 12.17 | NO | 1921 | 9917 | 670961 | `6854fb3dbf0c75f1bf72e3d22925b9c880ef7b621bcec57ca6dd01aef4294d0a` |
| detour-full-width-desktop | 9374 | 9.37 | NO | 1808 | 8981 | 838199 | `3be0c807939ecc0ebededd4c3eb6f6371cee899fa0ce0de15f2e40cf7fa63428` |
| detour-full-width-mobile-390 | 10303 | 12.21 | NO | 1921 | 9949 | 671607 | `111955c512e7befde87feaacfe07edb67dac4373e9e4f9419c7ee570b4bbe7be` |
| detour-overused-desktop | 10027 | 10.03 | NO | 1808 | 9634 | 897905 | `542b167f8c206c55a11cc7db397d8071038f0d9fbe484fce1b7922ec3e1f7941` |
| detour-overused-mobile-390 | 11169 | 13.23 | NO | 1921 | 10816 | 729971 | `08521895491e9de6e5a228b963bd8db5ab3fa2739c45a9abf6b27399036fe6e7` |

Readback: no Detour preserves the strongest source-to-source rhythm. One compact block after Signal 3 is the least disruptive candidate if future information is genuinely distinct. The full-width block creates a stronger interruption, and the deliberately overused sample visibly and numerically extends the Edition without adding source actions. Because the neutral placeholder is not distinct from Source fact, AOI note, Caveat, Edition note, or Active Context, the default recommendation is **no separate Detour**; keep the full information in ordinary Edition content unless later real content proves an orientation benefit. The sample blocks are plain semantic HTML/CSS and do not require runtime JavaScript once composed.

## Reproduction

Run `npm run build && npm run evidence:news-layout`. Override temporary output with `NEWS_EVIDENCE_ARTIFACT_DIR=/absolute/path`. The script starts and stops its own loopback-only Astro process. Machine-readable measurements and screenshot hashes are in `docs/evidence/news-phase-3-layout-metrics.json`.
