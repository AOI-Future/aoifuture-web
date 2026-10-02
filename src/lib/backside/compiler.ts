/** Deterministic World Compiler: Topology -> BacksideWorld. No randomness beyond seeded hashes. */
import { PLACES, ROOM, hash, resonancePoint, type Layout, type Room } from '../afterhours/geography';
import type { RoomSource } from '../afterhours/world';
import { COMPILER_VERSION, type BacksideWorld, type Connection, type PoiKind, type Sector, type Topology } from './ir';

/** Metres of real distance folded into one 32m backside room. */
export const METRES_PER_CELL = 80;
const PLACE_FOR: Record<PoiKind,string> = {
  station:'concourse', intersection:'atrium', park:'garden', convenience:'office',
  shrine:'pool', road:'service', landmark:'gallery', library:'archive',
};
const placeIndex=(key:string)=>PLACES.findIndex(p=>p.key===key);
const cellKey=(x:number,z:number)=>`${x},${z}`;
const pairKey=(a:string,b:string)=>a<b?`${a}|${b}`:`${b}|${a}`;

/** FNV-1a so a topology without an explicit seed still compiles identically everywhere. */
export function seedFrom(text:string) {
  let h=0x811c9dc5;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193);}
  return h>>>0;
}

function spiral(x:number,z:number,taken:Set<string>) {
  if(!taken.has(cellKey(x,z))) return {x,z};
  for(let r=1;r<64;r++) for(let dz=-r;dz<=r;dz++) for(let dx=-r;dx<=r;dx++) {
    if(Math.max(Math.abs(dx),Math.abs(dz))!==r) continue;
    if(!taken.has(cellKey(x+dx,z+dz))) return {x:x+dx,z:z+dz};
  }
  throw new Error(`no free cell near ${x},${z}`);
}

export function compileTopology(topology:Topology):BacksideWorld {
  const nodeIds=new Set(topology.nodes.map(n=>n.id));
  if(nodeIds.size!==topology.nodes.length) throw new Error('duplicate node id');
  if(!nodeIds.has(topology.spawn)) throw new Error(`spawn ${topology.spawn} is not a node`);
  for(const e of topology.edges) if(!nodeIds.has(e.from)||!nodeIds.has(e.to)) throw new Error(`edge ${e.from}-${e.to} references a missing node`);
  const seed=(topology.seed??seedFrom(topology.id))>>>0;
  const sectors:Sector[]=[], at=new Map<string,Sector>(), taken=new Set<string>();
  const add=(s:Sector)=>{sectors.push(s);at.set(cellKey(s.x,s.z),s);taken.add(cellKey(s.x,s.z));return s;};
  const byNode=new Map<string,Sector>();
  // Sorted input makes collision resolution independent of authoring order.
  for(const n of [...topology.nodes].sort((a,b)=>a.id<b.id?-1:1)) {
    const cell=spiral(Math.round(n.x/METRES_PER_CELL),Math.round(n.z/METRES_PER_CELL),taken);
    byNode.set(n.id,add({id:n.id,x:cell.x,z:cell.z,place:PLACE_FOR[n.kind],label:n.name,ja:n.ja,poi:n.kind,variant:Math.floor(hash(cell.x,cell.z,seed^310)*3),node:n.id}));
  }
  const connections:Connection[]=[], linked=new Set<string>();
  const link=(a:Sector,b:Sector)=>{const k=pairKey(a.id,b.id);if(a.id!==b.id&&!linked.has(k)){linked.add(k);connections.push(a.id<b.id?{a:a.id,b:b.id}:{a:b.id,b:a.id});}};
  const edges=topology.edges.map(e=>e.from<e.to?[e.from,e.to]:[e.to,e.from]).sort((a,b)=>(a[0]+'|'+a[1])<(b[0]+'|'+b[1])?-1:1);
  for(const [from,to] of edges) {
    // Streets become L-shaped service corridors: walk x first, then z.
    let prev=byNode.get(from)!, {x,z}=prev;
    const goal=byNode.get(to)!;
    while(x!==goal.x||z!==goal.z) {
      if(x!==goal.x) x+=Math.sign(goal.x-x); else z+=Math.sign(goal.z-z);
      const next=at.get(cellKey(x,z))??add({id:`road:${x},${z}`,x,z,place:PLACE_FOR.road,label:'BACK STREET',ja:'裏通り',poi:'road',variant:Math.floor(hash(x,z,seed^310)*3)});
      link(prev,next); prev=next;
    }
  }
  const world:BacksideWorld={version:COMPILER_VERSION,seed,sourceArea:{id:topology.id,name:topology.name},sectors,connections,spawn:{sector:topology.spawn,x:0,z:0},questAnchors:[]};
  const layout=compiledLayout(world);
  const spawn=byNode.get(topology.spawn)!, s=resonancePoint(spawn.x,spawn.z,seed,layout);
  world.spawn={sector:spawn.id,x:s.x,z:s.z};
  world.questAnchors=[...byNode.values()].filter(s=>s.poi!=='road').map(s=>{const p=resonancePoint(s.x,s.z,seed,layout);return {id:s.id,sector:s.id,role:s.poi,x:p.x,z:p.z};});
  return world;
}

/** A renderer-facing room source backed by the IR instead of coordinate hashes. */
export function compiledLayout(world:BacksideWorld):RoomSource & Layout {
  const at=new Map(world.sectors.map(s=>[cellKey(s.x,s.z),s]));
  const linked=new Set(world.connections.map(c=>pairKey(c.a,c.b)));
  const describe=(x:number,z:number):Room=>{
    const s=at.get(cellKey(x,z)), index=Math.max(0,placeIndex(s?.place??'service'));
    return {x,z,index,place:PLACES[index],variant:s?.variant??0,id:`${x<0?'W':'E'}${Math.abs(x)} / ${z<0?'N':'S'}${Math.abs(z)}`,label:s?.label,ja:s?.ja};
  };
  return {
    exists:(x,z)=>at.has(cellKey(x,z)),
    describe:(x,z)=>describe(x,z),
    passage:(x,z,_seed,dx,dz)=>{
      const a=at.get(cellKey(x,z)), b=at.get(cellKey(x+dx,z+dz));
      if(!a||!b||!linked.has(pairKey(a.id,b.id))) return {offset:0,width:0,height:0};
      return {offset:0,width:6,height:Math.min(4.6,describe(x,z).place.height-.35,describe(x+dx,z+dz).place.height-.35)};
    },
    shaft:()=>undefined,
  };
}
export const sectorCentre=(s:Sector)=>({x:s.x*ROOM,z:s.z*ROOM});
