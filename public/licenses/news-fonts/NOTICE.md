# AOIFUTURE News font notices

AOIFUTURE News self-hosts the following unmodified WOFF2 files from pinned
Fontsource `5.3.0` packages. Both font families are distributed under the SIL
Open Font License 1.1; the complete license is in `OFL-1.1.txt` beside this
notice.

| Family | Copyright holder | Package | Delivered weights | Source file SHA-256 |
| --- | --- | --- | --- | --- |
| Noto Sans JP | Google Inc. | `@fontsource/noto-sans-jp@5.3.0` | 400, 500, 700 normal | `4a7b928d4d75e7fc0bace614030664a7ea7eb7d2f754fd2b2da9c3c0ed350570` (400); `116eacf750caa59db9d404d43d2daf0f02ae01c439825716972da8dcc97ce024` (500); `a5861823629995d9abb4b16b96a1c57139d9663d7a256209cb6b40640ed5431e` (700) |
| JetBrains Mono | Copyright 2020 The JetBrains Mono Project Authors | `@fontsource/jetbrains-mono@5.3.0` | 500, 600 normal (Latin subset) | `cb182feeed4d798ff6961d3c79f7026279448fca0676438aaecb21f3fc39553a` (500); `400c6bfda18d5d14acad1c15d6dcb9f8e13c015e7286317e0b9a482539bef147` (600) |

Reproduction is package-lock driven: run `npm ci`, then `npm run build`. Vite
copies only the five WOFF2 files referenced by `src/styles/news-fonts.css` and
emits content-hashed same-origin assets. The Japanese family uses Fontsource's
complete Japanese WOFF2 per weight rather than a page-specific glyph subset so
future Japanese News text cannot silently fall back for unmeasured characters.