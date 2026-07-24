# AOIFUTURE News desktop two-pane evidence

Baseline: `a0e3109bef6797a030b5bc6105645ec69a360507`

Route: `/news/`. The 2-Signal captures use exactly the validated `NON-PRODUCTION SAMPLE` Edition. The 6/9/12-Signal captures use the local-only density harness to duplicate only those same two validated cards. They are layout evidence, not reporting, and are not publishable.

## Production-shaped 2-Signal readback

| Viewport | Before | After | Change | Before columns | After columns | After copy / heading |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1100 × 1000 | 1604 px | 1604 px | unchanged | 2 | 2 | 14 / 24 px |
| 1101 × 1000 | 2892 px | 1841 px | 36.3% shorter | 1 | 2 | 16 / 28 px |
| 1280 × 1000 | 2943 px | 1861 px | 36.8% shorter | 1 | 2 | 16 / 28 px |
| 1440 × 1000 | 2943 px | 1861 px | 36.8% shorter | 1 | 2 | 16 / 28 px |
| 1728 × 1000 | 2943 px | 1861 px | 36.8% shorter | 1 | 2 | 16 / 28 px |

The 1100/1101 edge no longer changes from two columns back to one. Desktop keeps the 16 px Japanese body/copy size rather than inheriting the tablet's 14 px card copy. Signal headings are 28 px, with 515–540 px card widths. Source actions remain bottom-aligned within each row without changing source-first DOM or tab order.

## Local density harness

| Width | 2 Signals | 6 Signals | 9 Signals | 12 Signals |
| --- | ---: | ---: | ---: | ---: |
| 1280 | 1861 px | 3368 px | 4874 px | 5628 px |
| 1440 | 1861 px | 3368 px | 4874 px | 5628 px |
| 1728 | 1861 px | 3368 px | 4874 px | 5628 px |

All 2/6/9/12 scenarios retained two columns, one direct-source action per Signal, source-first order, the finite Edition, and no pagination/collapse. All measured zero horizontal overflow and a 44 px minimum primary navigation/direct-source target.

## Unchanged phone and tablet captures

Current 390/768/1024 screenshots are byte-identical to the prior `a0e3109` captures:

- 390: `7f96051c333a847bd4308800773237c6fb8b7a6905d759d6a00ff690c32de938`
- 768: `501ecc6c71f6e0582e4251da084f0198b1263c7790c53154baea923f5481dcdd`
- 1024: `0144154d142bb5e329d2e1e59bbe6f2d4b7e7b5feb4c3604a619958c4a12066f`

## Local artifacts

- Before screenshots and raw metrics: `/tmp/aoifuture-news-desktop-before-a0e3109/`
- After screenshots and raw metrics: `/tmp/aoifuture-news-desktop-after/`
- Unchanged-width captures: `/tmp/aoifuture-news-desktop-unchanged/`
- Tracked machine-readable comparison: `docs/evidence/news-desktop-two-pane-metrics.json`

Screenshot SHA-256 values for breakpoint and desktop density captures are recorded in the tracked JSON.
