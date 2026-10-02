/** BacksideWorld IR: the only contract between the compiler and any renderer. */
export const COMPILER_VERSION = 'backside-compiler/0.1.0';
export const POI_KINDS = ['station','intersection','park','convenience','shrine','road','landmark','library'] as const;
export type PoiKind = typeof POI_KINDS[number];
export type TopologyNode = { id:string; kind:PoiKind; name:string; ja?:string; x:number; z:number };
/** Real-world-ish input. x/z are metres east/south of an arbitrary origin. */
export type Topology = { id:string; name:string; seed?:number; nodes:TopologyNode[]; edges:{from:string;to:string}[]; spawn:string };
export type Sector = { id:string; x:number; z:number; place:string; label:string; ja?:string; poi:PoiKind; variant:number; node?:string };
export type Connection = { a:string; b:string };
export type QuestAnchor = { id:string; sector:string; role:PoiKind; x:number; z:number };
export type BacksideWorld = {
  version:string; seed:number;
  sourceArea:{ id:string; name:string };
  sectors:Sector[]; connections:Connection[];
  spawn:{ sector:string; x:number; z:number };
  questAnchors:QuestAnchor[];
};

export function validateWorld(world:BacksideWorld) {
  const errors:string[]=[];
  if(world.version!==COMPILER_VERSION) errors.push(`version ${world.version} is not ${COMPILER_VERSION}`);
  const byId=new Map<string,Sector>(), cells=new Set<string>();
  for(const s of world.sectors) {
    if(byId.has(s.id)) errors.push(`duplicate sector ${s.id}`);
    if(cells.has(`${s.x},${s.z}`)) errors.push(`overlapping sector at ${s.x},${s.z}`);
    byId.set(s.id,s); cells.add(`${s.x},${s.z}`);
  }
  const links=new Map<string,string[]>();
  for(const c of world.connections) {
    const a=byId.get(c.a), b=byId.get(c.b);
    if(!a||!b){errors.push(`connection ${c.a}-${c.b} references a missing sector`);continue;}
    if(Math.abs(a.x-b.x)+Math.abs(a.z-b.z)!==1) errors.push(`connection ${c.a}-${c.b} is not between neighbours`);
    links.set(c.a,[...(links.get(c.a)??[]),c.b]); links.set(c.b,[...(links.get(c.b)??[]),c.a]);
  }
  if(!byId.has(world.spawn.sector)) errors.push(`spawn sector ${world.spawn.sector} is missing`);
  for(const q of world.questAnchors) if(!byId.has(q.sector)) errors.push(`anchor ${q.id} references missing sector ${q.sector}`);
  if(byId.has(world.spawn.sector)) {
    const seen=new Set([world.spawn.sector]), queue=[world.spawn.sector];
    for(let i=0;i<queue.length;i++) for(const n of links.get(queue[i])??[]) if(!seen.has(n)){seen.add(n);queue.push(n);}
    for(const s of world.sectors) if(!seen.has(s.id)) errors.push(`sector ${s.id} is unreachable from spawn`);
  }
  return errors;
}
