/** Picks the world the game plays: a locally generated one when it is present and valid, otherwise the bundled sample town. Never fetches. */
import { compileTopology } from '../backside/compiler';
import { COMPILER_VERSION, POI_KINDS, validateWorld, type BacksideWorld, type QuestAnchor } from '../backside/ir';
import { PLACES } from '../afterhours/geography';
import { draftQuest, type Quest } from '../backside/quest';
import { sampleTown, sampleQuest } from '../backside/fixtures/sample-town';

export type WorldSource = { world:BacksideWorld; source:'generated'|'sample'; quest:()=>Quest };

const isObj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const hasOnly=(v:Record<string,unknown>,keys:readonly string[])=>Object.keys(v).every(k=>keys.includes(k));
const isNum=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const isText=(v:unknown):v is string=>typeof v==='string'&&v.length<=64;
const isId=(v:unknown)=>isText(v)&&v.length>0;
const isCoord=(v:unknown)=>isNum(v)&&Math.abs(v)<=1000000;
const isCell=(v:unknown)=>isNum(v)&&Number.isInteger(v)&&Math.abs(v)<=4096;
const isPoi=(v:unknown)=>isText(v)&&(POI_KINDS as readonly string[]).includes(v);
const isPlace=(v:unknown)=>isText(v)&&PLACES.some(p=>p.key===v);

/** Shape check for untrusted JSON; `validateWorld` then checks the graph. The fetch script also validates against the JSON Schema. */
export function isWorldShape(v:unknown):v is BacksideWorld {
  if(!isObj(v)||!hasOnly(v,['version','seed','sourceArea','sectors','connections','spawn','questAnchors'])
    ||v.version!==COMPILER_VERSION||!isNum(v.seed)||!Number.isInteger(v.seed)||v.seed<0||v.seed>4294967295) return false;
  if(!isObj(v.sourceArea)||!hasOnly(v.sourceArea,['id','name'])||!isId(v.sourceArea.id)||!isText(v.sourceArea.name)) return false;
  if(!isObj(v.spawn)||!hasOnly(v.spawn,['sector','x','z'])||!isId(v.spawn.sector)||!isCoord(v.spawn.x)||!isCoord(v.spawn.z)) return false;
  if(!Array.isArray(v.sectors)||!v.sectors.length||v.sectors.length>4096||!v.sectors.every(s=>
    isObj(s)&&hasOnly(s,['id','x','z','place','label','poi','variant','ja','node'])
    &&isId(s.id)&&isCell(s.x)&&isCell(s.z)&&isPlace(s.place)&&isText(s.label)&&isPoi(s.poi)
    &&isNum(s.variant)&&Number.isInteger(s.variant)&&s.variant>=0&&s.variant<=2
    &&(s.ja===undefined||isText(s.ja))&&(s.node===undefined||isId(s.node)))) return false;
  if(!Array.isArray(v.connections)||v.connections.length>16384||!v.connections.every(c=>
    isObj(c)&&hasOnly(c,['a','b'])&&isId(c.a)&&isId(c.b))) return false;
  return Array.isArray(v.questAnchors)&&v.questAnchors.length<=4096&&v.questAnchors.every(a=>
    isObj(a)&&hasOnly(a,['id','sector','role','x','z'])&&isId(a.id)&&isId(a.sector)&&isPoi(a.role)&&isCoord(a.x)&&isCoord(a.z));
}

const dist=(a:QuestAnchor,b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);

/** Fetch something from the nearest convenience store (else the nearest place that is not a junction, else any other anchor) and bring it back to spawn. */
export function questFor(world:BacksideWorld):Quest {
  const home=world.questAnchors.find(a=>a.sector===world.spawn.sector)
    ??[...world.questAnchors].sort((a,b)=>dist(a,world.spawn)-dist(b,world.spawn)||a.id.localeCompare(b.id))[0];
  if(!home) throw new Error('world has no quest anchors');
  const others=world.questAnchors.filter(a=>a.id!==home.id);
  const nearest=(xs:QuestAnchor[])=>[...xs].sort((a,b)=>dist(a,home)-dist(b,home)||a.id.localeCompare(b.id))[0];
  const target=nearest(others.filter(a=>a.role==='convenience'))??nearest(others.filter(a=>a.role!=='intersection'))??nearest(others);
  if(!target) throw new Error('world needs at least two quest anchors');
  const there=target.role==='convenience'
    ?{title:'Pick up the signal at the convenience store',ja:'コンビニで信号を拾う'}
    :{title:'Pick up the signal',ja:'信号を拾う'};
  return draftQuest('first-signal','Carry the signal','信号を運ぶ',[
    {anchor:target.id,...there},
    {anchor:home.id,title:'Bring it back to where you started',ja:'出発地点へ持ち帰る'},
  ]);
}

export function sampleSource():WorldSource {
  return { world:compileTopology(sampleTown), source:'sample', quest:sampleQuest };
}

/** Uses `candidate` only when it is a well-formed, valid world with a playable quest; anything else falls back to the sample town. */
export function pickWorld(candidate:unknown,{forceSample=false}:{forceSample?:boolean}={}):WorldSource {
  if(forceSample||candidate===undefined) return sampleSource();
  try {
    if(!isWorldShape(candidate)||validateWorld(candidate).length) return sampleSource();
    questFor(candidate);
    return { world:candidate, source:'generated', quest:()=>questFor(candidate) };
  } catch { return sampleSource(); }
}
