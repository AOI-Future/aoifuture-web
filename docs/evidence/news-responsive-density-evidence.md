# AOIFUTURE News responsive density evidence

Baseline: `b232c11120f502e8c30527a9e7140ba6013b728a`

Route: `/news/` with exactly the two validated `NON-PRODUCTION SAMPLE` Signals. No cards, facts, sources, or claims were invented for this evidence.

## Page-height readback

| Viewport | Before | After | Change | Before viewports | After viewports | After composition |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 390 × 844 | 3027 px | 2456 px | 18.9% shorter | 3.59 | 2.91 | one column |
| 768 × 1024 | 2592 px | 1675 px | 35.4% shorter | 2.53 | 1.64 | two-column Signal grid |
| 1024 × 1366 | 2891 px | 1604 px | 44.5% shorter | 2.12 | 1.17 | two-column Signal grid |
| 1440 × 1000 | 2943 px | 2943 px | unchanged | 2.94 | 2.94 | original desktop balance |

All four after captures measured zero horizontal overflow and a 44 px minimum across the primary navigation and direct-source actions. At 390 px, body text is 15 px / 25.5 px, the Edition heading is 28 px / 35 px, and Signal headings are 21 px / 29.4 px. At tablet widths, body text remains 16 px; Signal reading copy is 14 px / 23.8 px.

## Local screenshots

Before captures: `/tmp/aoifuture-news-density-before-b232c11/`

After captures: `/tmp/aoifuture-news-density-after/`

The machine-readable file `docs/evidence/news-responsive-density-metrics.json` records screenshot SHA-256 values so the local captures can be matched to this readback. The 1440 px before/after hashes are identical, confirming that the desktop composition was not changed by the phone/tablet media rules.
