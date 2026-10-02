/** OpenStreetMap via Overpass: query text and response parsing only. Fetching is the caller's job and needs approval of provider terms. */
import { STREET_TYPES, type GeoSnapshot } from '../reality';

export const OSM_LICENSE = 'ODbL-1.0';
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

type Area = GeoSnapshot['area'];
type Element =
  | { type:'node'; id:number; lat:number; lon:number; tags?:Record<string,string> }
  | { type:'way'; id:number; nodes:number[]; tags?:Record<string,string>; center?:{lat:number;lon:number} }
  | { type:'relation'; id:number; tags?:Record<string,string> };
export type OverpassResponse = { osm3s?:{timestamp_osm_base?:string}; elements:Element[] };

export function overpassQuery(area:Area):string {
  const around=`(around:${Math.round(area.radius)},${area.lat.toFixed(6)},${area.lon.toFixed(6)})`;
  return [
    '[out:json][timeout:25];',
    '(',
    `  way["highway"~"^(${STREET_TYPES.join('|')})$"]${around};`,
    `  nwr["railway"~"^(station|halt)$"]${around};`,
    `  nwr["public_transport"="station"]${around};`,
    `  nwr["shop"="convenience"]${around};`,
    `  nwr["amenity"="library"]${around};`,
    `  nwr["amenity"="place_of_worship"]["religion"="shinto"]${around};`,
    `  nwr["leisure"~"^(park|garden)$"]${around};`,
    `  nwr["tourism"~"^(attraction|museum)$"]${around};`,
    `  nwr["historic"]${around};`,
    ');',
    'out tags center;',
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
    } else if(e.type==='way'&&Array.isArray(e.nodes)) {
      ways.push({id:String(e.id),nodes:e.nodes.map(String),tags:e.tags??{},...(e.center?{center:e.center}:{})});
    }
  }
  return {provider:'osm-overpass',license:OSM_LICENSE,attribution:OSM_ATTRIBUTION,fetchedAt:json.osm3s?.timestamp_osm_base,
    area,nodes:[...nodes.values()],ways};
}
