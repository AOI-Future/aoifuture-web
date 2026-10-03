/** Reality Extractor: provider-neutral geodata snapshot -> Topology. Topology over replica: no real names, no ids, coarse geometry. */
import { METRES_PER_CELL, seedFrom } from './compiler';
import type { PoiKind, Topology, TopologyNode } from './ir';

export type GeoNode = { id:string; lat:number; lon:number; tags?:Record<string,string> };
export type GeoWay = { id:string; nodes:string[]; tags:Record<string,string>; center?:{lat:number;lon:number} };
/** What a provider adapter returns. Everything downstream is pure, so one snapshot always yields one world. */
export type GeoSnapshot = {
  provider:string; license:string; attribution:string; fetchedAt?:string;
  area:{ id:string; name:string; lat:number; lon:number; radius:number };
  nodes:GeoNode[]; ways:GeoWay[];
};
/** Neutral display name for every extracted area. `area.id` is caller-chosen and must be neutral too. */
export const REAL_AREA_NAME = 'REAL AREA';
export type ExtractOptions = { maxJunctions?:number; maxPois?:number };

/** Street kinds that read as walkable corridors. Footpaths are skipped to keep the graph coarse. */
export const STREET_TYPES = ['primary','secondary','tertiary','residential','unclassified','living_street','pedestrian'] as const;
const STREETS=new Set<string>(STREET_TYPES);
const LABEL: Record<PoiKind,[string,string]> = {
  station:['STATION','駅'], intersection:['CROSSING','交差点'], park:['PARK','公園'], convenience:['CONVENIENCE','コンビニ'],
  shrine:['SHRINE','神社'], road:['BACK STREET','裏通り'], landmark:['LANDMARK','目印'], library:['LIBRARY','図書館'],
};

export function classify(tags:Record<string,string>={}):PoiKind|undefined {
  if(tags.railway==='station'||tags.railway==='halt'||tags.public_transport==='station') return 'station';
  if(tags.shop==='convenience') return 'convenience';
  if(tags.amenity==='library') return 'library';
  if(tags.amenity==='place_of_worship'&&tags.religion==='shinto') return 'shrine';
  if(tags.leisure==='park'||tags.leisure==='garden') return 'park';
  if(tags.tourism==='attraction'||tags.tourism==='museum'||tags.historic) return 'landmark';
  return undefined;
}

const EARTH=6371008.8, RAD=Math.PI/180;
/** Local equirectangular projection: metres east (x) and south (z) of the origin. Accurate enough below a few km. */
export function project(lat:number,lon:number,origin:{lat:number;lon:number}) {
  return {x:(lon-origin.lon)*RAD*EARTH*Math.cos(origin.lat*RAD), z:-(lat-origin.lat)*RAD*EARTH};
}

type Point = { key:string; x:number; z:number; d:number };
const byDistance=(a:Point,b:Point)=>a.d-b.d||(a.key<b.key?-1:a.key>b.key?1:0);
const cell=(x:number,z:number)=>`${Math.round(x/METRES_PER_CELL)},${Math.round(z/METRES_PER_CELL)}`;

export function extractTopology(snap:GeoSnapshot,opts:ExtractOptions={}):Topology {
  const {maxJunctions=40,maxPois=12}=opts, area=snap.area;
  const nodes=new Map(snap.nodes.map(n=>[n.id,n]));
  const place=(lat:number,lon:number,key:string):Point=>{const p=project(lat,lon,area);return {key,...p,d:Math.hypot(p.x,p.z)};};
  const inside=(p:Point)=>p.d<=area.radius;
  const streets=snap.ways.filter(w=>STREETS.has(w.tags.highway)).sort((a,b)=>a.id<b.id?-1:1);

  // A junction is a street node shared by two or more distinct streets. Internal keys carry a kind prefix so provider ids never collide.
  const usage=new Map<string,Set<string>>();
  for(const w of streets) for(const id of w.nodes) usage.set(id,(usage.get(id)??new Set()).add(w.id));
  const junction=new Map<string,Point>();
  for(const [id,ways] of usage) {
    const n=nodes.get(id);
    if(ways.size<2||!n) continue;
    const p=place(n.lat,n.lon,`j:${id}`);
    if(inside(p)) junction.set(id,p);
  }
  // Each street joins consecutive junctions along it. `key` maps a raw node id to the graph key it stands for.
  const walk=(key:(id:string)=>string|undefined,link:(a:string,b:string)=>void)=>{
    for(const w of streets) {
      let prev:string|undefined;
      for(const id of w.nodes) {
        if(!junction.has(id)) continue;
        const k=key(id);
        if(k===undefined){prev=undefined;continue;}
        if(prev!==undefined&&prev!==k) link(prev,k);
        prev=k;
      }
    }
  };
  // Street-connected components, so clustering never fuses two networks that merely sit close together.
  const parent=new Map<string,string>();
  const root=(k:string):string=>{let r=k;while(parent.has(r))r=parent.get(r)!;return r;};
  walk(id=>junction.get(id)!.key,(a,b)=>{const x=root(a),y=root(b);if(x!==y)parent.set(x<y?y:x,x<y?x:y);});
  // Junctions inside one backside cell and one component collapse into the one nearest the centre, so the compiler never has to scatter them.
  const cluster=new Map<string,string>(), head=new Map<string,Point>();
  for(const p of [...junction.values()].sort(byDistance)) {
    const c=`${root(p.key)}|${cell(p.x,p.z)}`, h=head.get(c);
    if(!h) head.set(c,p);
    cluster.set(p.key,(h??p).key);
  }
  const kept=new Set([...head.values()].sort(byDistance).slice(0,maxJunctions).map(p=>p.key));
  const adj=new Map<string,Set<string>>();
  const link=(a:string,b:string)=>{if(a===b)return;adj.set(a,(adj.get(a)??new Set()).add(b));adj.set(b,(adj.get(b)??new Set()).add(a));};
  // Contract each street into edges between consecutive kept junctions along it.
  walk(id=>{const k=cluster.get(junction.get(id)!.key)!;return kept.has(k)?k:undefined;},link);
  const point=new Map([...junction.values()].map(p=>[p.key,p] as const));

  // Only the largest street network survives (ties go to the one reaching nearest the centre); islands across a clipped boundary are dropped.
  let main:Point[]=[];
  const seen=new Set<string>();
  for(const p of [...kept].map(k=>point.get(k)!).filter(p=>adj.has(p.key)).sort(byDistance)) {
    if(seen.has(p.key)) continue;
    const comp=[p.key];seen.add(p.key);
    for(let i=0;i<comp.length;i++) for(const n of [...adj.get(comp[i])!].sort()) if(!seen.has(n)){seen.add(n);comp.push(n);}
    if(comp.length>main.length) main=comp.map(k=>point.get(k)!).sort(byDistance);
  }
  if(!main.length) throw new Error(`no street junctions within ${area.radius}m of ${area.id}`);

  const pois:{p:Point;kind:PoiKind}[]=[];
  for(const n of snap.nodes) {const kind=classify(n.tags);if(kind)pois.push({p:place(n.lat,n.lon,`n:${n.id}`),kind});}
  for(const w of snap.ways) {
    const kind=classify(w.tags);
    if(!kind) continue;
    const pts=w.nodes.map(id=>nodes.get(id)).filter((n):n is GeoNode=>!!n);
    const c=w.center??(pts.length?{lat:pts.reduce((s,n)=>s+n.lat,0)/pts.length,lon:pts.reduce((s,n)=>s+n.lon,0)/pts.length}:undefined);
    if(c) pois.push({p:place(c.lat,c.lon,`w:${w.id}`),kind});
  }
  const chosen=pois.filter(o=>inside(o.p)).sort((a,b)=>byDistance(a.p,b.p)).slice(0,maxPois);
  // Each landmark hangs off its nearest junction on the main network, the way a shop opens onto the street.
  for(const o of chosen) {
    const near=main.reduce((best,j)=>Math.hypot(j.x-o.p.x,j.z-o.p.z)<Math.hypot(best.x-o.p.x,best.z-o.p.z)?j:best);
    link(o.p.key,near.key);
    point.set(o.p.key,o.p);
  }
  const kindOf=new Map<string,PoiKind>([...main.map(j=>[j.key,'intersection'] as const),...chosen.map(o=>[o.p.key,o.kind] as const)]);
  const start=(chosen.find(o=>o.kind==='station')?.p??main[0]).key;
  const live=new Set(kindOf.keys());

  // Public ids are positional (kind + rank by distance), never provider ids or real names.
  const order=[...live].map(k=>point.get(k)!).sort(byDistance), rank=new Map<PoiKind,number>(), id=new Map<string,string>();
  const out:TopologyNode[]=order.map(p=>{
    const kind=kindOf.get(p.key)!, n=(rank.get(kind)??0)+1;rank.set(kind,n);id.set(p.key,`${kind}-${n}`);
    return {id:`${kind}-${n}`,kind,name:LABEL[kind][0],ja:LABEL[kind][1],x:Math.round(p.x),z:Math.round(p.z)};
  });
  const edges=[...live].flatMap(a=>[...(adj.get(a)??[])].filter(b=>a<b&&live.has(b)).map(b=>{const x=id.get(a)!,y=id.get(b)!;return x<y?{from:x,to:y}:{from:y,to:x};}))
    .sort((a,b)=>a.from<b.from?-1:a.from>b.from?1:a.to<b.to?-1:a.to>b.to?1:0);
  const topo={nodes:out,edges};
  // The area name stays out: callers may pass a real place name, and the world must not carry it.
  return {id:`real:${area.id}`,name:REAL_AREA_NAME,seed:seedFrom(`${snap.provider}:${area.id}:${JSON.stringify(topo)}`),spawn:id.get(start)!,...topo};
}
