/** OpenStreetMap via Overpass: query text and response parsing only. Fetching is the caller's job and needs approval of provider terms.
 * Places are asked for as nodes and ways only; relations (multipolygon parks etc.) are not queried, so the parser never has to drop them. */
import { STREET_TYPES, type GeoSnapshot } from '../reality';

export const OSM_LICENSE = 'ODbL-1.0';
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

type Area = GeoSnapshot['area'];
type Element =
  | { type:'node'; id:number; lat:number; lon:number; tags?:Record<string,string> }
  | { type:'way'; id:number; nodes:number[]; tags?:Record<string,string>; center?:{lat:number;lon:number} };
export type OverpassResponse = { osm3s?:{timestamp_osm_base?:string}; elements:Element[] };

export function overpassQuery(area:Area):string {
  const around=`(around:${Math.round(area.radius)},${area.lat.toFixed(6)},${area.lon.toFixed(6)})`;
  return [
    '[out:json][timeout:25];',
    '(',
    `  way["highway"~"^(${STREET_TYPES.join('|')})$"]${around};`,
    `  nw["railway"~"^(station|halt)$"]${around};`,
    `  nw["public_transport"="station"]${around};`,
    `  nw["shop"="convenience"]${around};`,
    `  nw["amenity"="library"]${around};`,
    `  nw["amenity"="place_of_worship"]["religion"="shinto"]${around};`,
    `  nw["leisure"~"^(park|garden)$"]${around};`,
    `  nw["tourism"~"^(attraction|museum)$"]${around};`,
    `  nw["historic"]${around};`,
    ');',
    // `body` keeps each way's node refs (street connectivity); `tags` alone would drop them.
    'out body center;',
    '>;',
    'out skel qt;',
  ].join('\n');
}

export function fromOverpass(json:OverpassResponse,area:Area):GeoSnapshot {
  if(!json||!Array.isArray(json.elements)) throw new Error('overpass response has no elements');
  // Overpass can return one node twice (tagged and skeleton); keep the tagged copy.
  const nodes=new Map<string,GeoSnapshot['nodes'][number]>(), ways:GeoSnapshot['ways']=[];
  for(const e of json.elements) {
    if(e.type==='node'&&Number.isFinite(e.lat)&&Number.isFinite(e.lon)) {
      const id=String(e.id), prev=nodes.get(id);
      if(!prev||(!prev.tags&&e.tags)) nodes.set(id,{id,lat:e.lat,lon:e.lon,...(e.tags?{tags:e.tags}:{})});
    } else if(e.type==='way') {
      if(!Array.isArray(e.nodes)) throw new Error(`overpass way ${e.id} has no node refs; query with "out body"`);
      ways.push({id:String(e.id),nodes:e.nodes.map(String),tags:e.tags??{},...(e.center?{center:e.center}:{})});
    }
  }
  return {provider:'osm-overpass',license:OSM_LICENSE,attribution:OSM_ATTRIBUTION,fetchedAt:json.osm3s?.timestamp_osm_base,
    area,nodes:[...nodes.values()],ways};
}
