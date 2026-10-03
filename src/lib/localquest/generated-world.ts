/// <reference types="vite/client" />
/** The world written by `npm run localquest:fetch`, when present. The file is gitignored, so deployed builds have none and play the sample town. */
const found = import.meta.glob('./generated/world.json', { eager:true, import:'default' });
export const generatedWorld: unknown = found['./generated/world.json'];
