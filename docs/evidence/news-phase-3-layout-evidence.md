# AOIFUTURE News Phase 3 — local layout evidence

Status: **LOCAL LAYOUT EVIDENCE ONLY — NOT REPORTING / NOT PUBLISHABLE**

The harness duplicated only the two contract-validated public sample cards already present on `/news/`. It did not create a source, URL, fact, or claim, and it did not add a public route or schema field. Screenshots are temporary files outside Git at `/var/folders/96/74g8thcx2xv1bgf865bhmg1c0000gn/T/aoifuture-news-phase-3-21cf8b0`.

## Font and canonical readback

- Before: 0 local font assets and 22386 generated News HTML bytes; generated News HTML referenced Google Fonts.
- After: 5 same-origin WOFF2 assets / 3131360 build bytes and 26814 generated News HTML bytes. The pinned Fontsource packages occupy 82200234 bytes after `npm ci`; browser first load requested 4 font files / 2101020 bytes; external font requests: 0.
- Delivery: Noto Sans JP 400/500/700 complete Japanese WOFF2 and JetBrains Mono 500/600 Latin WOFF2, all `font-display: swap`, package-lock pinned at Fontsource 5.3.0.
- All four generated News routes contain exactly one `https://aoifuture.com/.../` canonical, without `www`, preserving trailing slashes.

## Density measurements

| Scenario | Page px | Viewports | X overflow | First source y | Final source y | PNG bytes | SHA-256 |
| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |
| density-2-desktop | 1952 | 1.95 | NO | 1607 | 1607 | 214858 | `0f5f93f1db60b5f7cb8330f36f8a3d1a64d21f5e3a6806b67e676d67908b355e` |
| density-2-mobile-390 | 2646 | 3.14 | NO | 1545 | 2340 | 189371 | `9c0a08414ab94d4ad98442c876b3e4695cd621bf88f000ac4dab55c6880bd732` |
| density-6-desktop | 3458 | 3.46 | NO | 1607 | 3113 | 438831 | `c97dfaa1e297f521d3f6c78db63998b5d905b36497cf5746ec1c03d6f97f2cd2` |
| density-6-mobile-390 | 5775 | 6.84 | NO | 1545 | 5470 | 426569 | `ade8862ca75511dd40b085929a23feb414048a3c0eca0a7b6fdda9720d0fcb2a` |
| density-9-desktop | 4965 | 4.97 | NO | 1607 | 4620 | 626681 | `c4075c8d46bbfbb437c85dffb71420d9fd1a8d1cf446447dcda985545c8b8c7e` |
| density-9-mobile-390 | 8110 | 9.61 | NO | 1545 | 7804 | 605518 | `4513fd4b26752498c3d01e85c0c0142577de606a7db0bf43753f9a5316667442` |
| density-12-desktop | 5718 | 5.72 | NO | 1607 | 5373 | 774521 | `769b9bc395d6ca8078ac64f5f6c5d2a059c029df87fc03d3b9fd42fe385f6f61` |
| density-12-mobile-390 | 10469 | 12.4 | NO | 1545 | 10164 | 782195 | `99362f1cd16988422570516c6c4e03055923efbb0e58171934024b2e9d066a86` |

Readback: all 2/6/9/12 compositions retained one finite Edition, one direct-source action per Signal, the Edition note, and the footer, with no pagination, collapse, or horizontal overflow. Two Signals verify the production-shaped sample. Six Signals is comfortable at both widths. Nine remains structurally clear but creates a long mobile scan. Twelve remains technically finite, but reaches 5.72 desktop and 12.4 mobile viewports; repeated two-card rhythm and distance to the final source/footer are the primary fatigue points. The footer and Edition note remain present and measurable, not sticky or hidden.

## Detour comparison

| Scenario | Page px | Viewports | X overflow | First source y | Final source y | PNG bytes | SHA-256 |
| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |
| detour-none-desktop | 4965 | 4.97 | NO | 1607 | 4620 | 626681 | `c4075c8d46bbfbb437c85dffb71420d9fd1a8d1cf446447dcda985545c8b8c7e` |
| detour-none-mobile-390 | 8110 | 9.61 | NO | 1545 | 7804 | 605518 | `4513fd4b26752498c3d01e85c0c0142577de606a7db0bf43753f9a5316667442` |
| detour-compact-desktop | 4965 | 4.97 | NO | 1607 | 4620 | 648244 | `107242e5822496c3315e172b4237659713e15976fdc0c74200358cd2bed33ea9` |
| detour-compact-mobile-390 | 8450 | 10.01 | NO | 1545 | 8144 | 624757 | `6bd4d0306b044a2bf5d1e52a8cd20beaf864fa598edcc304178b7cf647af788f` |
| detour-full-width-desktop | 4965 | 4.97 | NO | 1607 | 4620 | 648802 | `0315d22d395c005b754120d201144e5d24e83fc1f5d67aa9157cd349218c3907` |
| detour-full-width-mobile-390 | 8482 | 10.05 | NO | 1545 | 8176 | 625204 | `954f30eab475f63e1a2fab5618d6bbc17c39d20ab9f123b6763712e2a320e2f8` |
| detour-overused-desktop | 6471 | 6.47 | NO | 1607 | 6127 | 780238 | `308683d4104a5695b12e0c7fbbeb4313abefae76b3cad17db4aa6a1d209cb226` |
| detour-overused-mobile-390 | 9326 | 11.05 | NO | 1545 | 9020 | 680846 | `38fc0fe8906ba87c5783a2be1a77ffec6a10b4094214c81abcee2f99e410dd11` |

Readback: no Detour preserves the strongest source-to-source rhythm. One compact block after Signal 3 is the least disruptive candidate if future information is genuinely distinct. The full-width block creates a stronger interruption, and the deliberately overused sample visibly and numerically extends the Edition without adding source actions. Because the neutral placeholder is not distinct from Source fact, AOI note, Caveat, Edition note, or Active Context, the default recommendation is **no separate Detour**; keep the full information in ordinary Edition content unless later real content proves an orientation benefit. The sample blocks are plain semantic HTML/CSS and do not require runtime JavaScript once composed.

## Reproduction

Run `npm run build && npm run evidence:news-layout`. Override temporary output with `NEWS_EVIDENCE_ARTIFACT_DIR=/absolute/path`. The script starts and stops its own loopback-only Astro process. Machine-readable measurements and screenshot hashes are in `docs/evidence/news-phase-3-layout-metrics.json`.
