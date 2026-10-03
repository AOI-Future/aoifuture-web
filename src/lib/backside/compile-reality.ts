/** Reality -> BacksideWorld in one call. Provider-neutral: takes any GeoSnapshot, never fetches, never sees provider ids in its output. */
import { compileTopology } from './compiler';
import { validateWorld, type BacksideWorld } from './ir';
import { extractTopology, type ExtractOptions, type GeoSnapshot } from './reality';

export function compileReality(source:GeoSnapshot,options:ExtractOptions={}):BacksideWorld {
  const world=compileTopology(extractTopology(source,options));
  const errors=validateWorld(world);
  if(errors.length) throw new Error(`compiled world is invalid: ${errors.join('; ')}`);
  return world;
}
