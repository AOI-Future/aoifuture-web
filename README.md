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
- The raw response is cached in `.cache/localquest/`, and later runs reuse it with no network. The generated world is written to `src/lib/localquest/generated/world.json`.
- Both paths are gitignored. **Never commit raw or generated OSM data.** The repository holds only code, the schema, small synthetic fixtures and these license notes.
- Without a generated world, `/play/localquest` plays the bundled sample town. `?world=sample` forces the sample town. The page always shows the OSM attribution.
- `npm run build` inlines the generated world into the page bundle when it exists locally, so that build ships ODbL data (with the attribution). CI and clean checkouts have no generated world and build with the sample town only. Move the generated file away before building if a build must not contain OSM data.

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
