/** Picks the world the game plays: a locally generated one when it is present and valid, otherwise the bundled sample town. Never fetches. */
import { compileTopology } from '../backside/compiler';
import { COMPILER_VERSION, validateWorld, type BacksideWorld, type QuestAnchor } from '../backside/ir';
import { draftQuest, type Quest } from '../backside/quest';
import { sampleTown, sampleQuest } from '../backside/fixtures/sample-town';

export type WorldSource = { world:BacksideWorld; source:'generated'|'sample'; quest:()=>Quest };

const isObj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const isNum=(v:unknown)=>Number.isFinite(v);
const isText=(v:unknown)=>typeof v==='string';

/** Shape check for untrusted JSON; `validateWorld` then checks the graph. The fetch script also validates against the JSON Schema. */
export function isWorldShape(v:unknown):v is BacksideWorld {
  if(!isObj(v)||v.version!==COMPILER_VERSION||!Number.isInteger(v.seed)||(v.seed as number)<0) return false;
  if(!isObj(v.sourceArea)||!isText(v.sourceArea.id)||!isText(v.sourceArea.name)) return false;
  if(!isObj(v.spawn)||!isText(v.spawn.sector)||!isNum(v.spawn.x)||!isNum(v.spawn.z)) return false;
  if(!Array.isArray(v.sectors)||!v.sectors.length||!v.sectors.every(s=>isObj(s)&&isText(s.id)&&Number.isInteger(s.x)&&Number.isInteger(s.z)&&isText(s.place)&&isText(s.label)&&isText(s.poi)&&Number.isInteger(s.variant))) return false;
  if(!Array.isArray(v.connections)||!v.connections.every(c=>isObj(c)&&isText(c.a)&&isText(c.b))) return false;
  return Array.isArray(v.questAnchors)&&v.questAnchors.every(a=>isObj(a)&&isText(a.id)&&isText(a.sector)&&isText(a.role)&&isNum(a.x)&&isNum(a.z));
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
