# Astro Starter Kit: Minimal

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## Local Quest map data (OpenStreetMap, ODbL)

Map data © OpenStreetMap contributors, available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/). See <https://www.openstreetmap.org/copyright>.

- `npm run localquest:fetch` is a dev-only script. It fetches one small fixed area from the public Overpass instance **once**, then compiles it and validates it against `src/lib/backside/backside-world.schema.json`. The game never fetches map data at runtime.
- The raw response is cached in `.cache/localquest/`, and later runs reuse it with no network. The generated world is written to `src/lib/localquest/generated/world.json`. Fetches have a 35-second transport deadline; responses with an Overpass runtime-error remark or missing way node refs are rejected before caching.
- Both paths are gitignored. **Never commit raw or generated OSM data.** The repository holds only code, the schema, small synthetic fixtures and these license notes.
- Without a generated world, `/play/localquest` plays the bundled sample town. `?world=sample` forces the sample town. The page always shows the OSM attribution.
- `npm run build` inlines the generated world into the page bundle when it exists locally, so that build ships ODbL data (with the attribution). CI and clean checkouts have no generated world and build with the sample town only. Move the generated file away before building if a build must not contain OSM data.

## LLM-free real-time public trial

`/play/localquest` offers one fixed 400m area around Gakugei-daigaku. Click **地図から裏世界を生成** to load the published OSM source snapshot and run extraction + deterministic compilation **in the browser**, without any LLM, API key or GPS. Source geography is a road/POI diagram with an OSM link and explicit room correspondences; the world preserves topology rather than replicating distance/appearance. Junctions/POIs are capped at 24/8; one completed quest ends the trial. The original sample town remains explicitly available when geography cannot load.

- `scripts/localquest-prepare-source.mjs` runs before the build. It reuses the local source asset/cache, then the already-published licensed Vercel snapshot. It acquires one bounded OSM response only when no valid published snapshot is available (initial bootstrap/recovery). Every source is validated before writing; invalid local files are refused rather than replaced. Normal redeployments need only Vercel/CDN, not a fresh Overpass acquisition. Snapshot updates are not automatic. The deployed `/localquest/source-area.json` contains the complete licensed input with source/license metadata and is downloadable from the map dialog. **Do not commit this asset.**
- Visitors request the same-origin deployed snapshot, **never Overpass**. Browser snapshot cache is 24h; a previous snapshot can restore saved progress without fetching. Snapshot time is displayed. This is live *compilation*, not continuously refreshed geography.
- Overpass public-instance policy counts website traffic in aggregate. Published-snapshot reuse avoids per-player and routine redeployment queries; limit bootstrap/recovery acquisitions. See <https://wiki.openstreetmap.org/wiki/Overpass_API>. Public geodata refresh/large-scale production requires a suitable provider/cache arrangement.
- Missing/rate-limited/oversized/partial data causes explicit failure, not fake real-world success. No private location data is collected. OSM attribution and ODbL source access remain visible.
- Replacing a world disposes the prior renderer, audio, animation and event handlers. Completion and reload preserve the ended-trial state; a new game or regeneration is explicit.
- This does **not** claim the full Notion MVP complete. The original regression HOLD was closed for this release by executing the unchanged AFTERHOURS suite on project-local Node24 with native AMD OpenGL: 25 PASS / 2 deliberate lifecycle skips. SwiftShader-only timing/performance and real-device guarantees remain unproven. Permanent publication target is `/play/localquest/`; the existing `/play/afterhours/` and authentication settings are unchanged.

## Local Quest regression checks

- `npm run check:afterhours`
- `npx vitest run tests/reality.test.ts tests/backside.test.ts tests/backside-schema.test.ts tests/localquest-world-source.test.ts tests/localquest-navigation.test.ts tests/localquest-live.test.ts --exclude '.cache/**'`
- `npm run test:localquest` checks the clean-checkout sample fallback (desktop/phone/tablet).
- `npm run test:localquest:generated` temporarily compiles the **synthetic** Overpass grid into a generated world, validates the schema and deterministic output, and runs the same browser suite without fetching geography. It refuses to overwrite an existing generated world and launches a fresh test server. Cleanup compares fixture bytes before deleting, but is not atomic: **do not edit, fetch, build, or run another world-writing command concurrently**. Detectable edits are preserved. Interrupted runs may leave the fixture behind; inspect it before retrying.
- Generated-world tests cover first-person movement, actual save identity, both quest anchors, and completion after reload. Quest positions are controlled in the test; this is not a physical walkthrough of the complete route or a real-device performance measurement.
- Playwright artifacts for Local Quest live under `.cache/`, not shared `test-results/`.

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
