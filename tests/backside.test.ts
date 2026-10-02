import { describe, it, expect } from 'vitest';
import { roomPlan, resonancePoint } from '../src/lib/afterhours/geography';
import { compileTopology, compiledLayout, seedFrom } from '../src/lib/backside/compiler';
import { COMPILER_VERSION, validateWorld, type Topology } from '../src/lib/backside/ir';
import { questReducer, currentStep } from '../src/lib/backside/quest';
import { sampleTown, sampleQuest } from '../src/lib/backside/fixtures/sample-town';

function walkable(x:number,z:number,seed:number,layout=compiledLayout(compileTopology(sampleTown))) {
  const plan=roomPlan(x,z,seed,layout);
  const blocks=plan.boxes.filter(b=>b.solid&&b.y-b.h/2<1.9&&b.y+b.h/2>.1);
  const blocked=(px:number,pz:number)=>blocks.some(b=>Math.abs(px-b.x)<b.w/2+.35&&Math.abs(pz-b.z)<b.d/2+.35);
  const source=resonancePoint(x,z,seed,layout),sx=Math.round((source.x-x*32+16)*2),sz=Math.round((source.z-z*32+16)*2);
  const visited=new Uint8Array(65*65),queue=[sz*65+sx];visited[queue[0]]=1;
  for(let i=0;i<queue.length;i++){
    const id=queue[i],cx=id%65,cz=Math.floor(id/65);
    for(const [nx,nz] of [[cx-1,cz],[cx+1,cz],[cx,cz-1],[cx,cz+1]]){
      const n=nz*65+nx;if(nx<0||nx>64||nz<0||nz>64||visited[n]||blocked(nx/2-16,nz/2-16))continue;
      visited[n]=1;queue.push(n);
    }
  }
  return {plan,at:(px:number,pz:number)=>visited[Math.round((pz+16)*2)*65+Math.round((px+16)*2)]===1};
}

describe('deterministic world compiler', () => {
  it('compiles the same topology to the same world regardless of authoring order', () => {
    const a=compileTopology(sampleTown);
    const shuffled:Topology={...sampleTown,nodes:[...sampleTown.nodes].reverse(),edges:[...sampleTown.edges].reverse().map(e=>({from:e.to,to:e.from}))};
    expect(compileTopology(sampleTown)).toEqual(a);
    expect(compileTopology(shuffled)).toEqual(a);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(a.version).toBe(COMPILER_VERSION);
    expect(compileTopology({...sampleTown,seed:undefined}).seed).toBe(seedFrom('sample-town'));
    expect(compileTopology({...sampleTown,seed:7})).not.toEqual(a);
  });
  it('produces a valid, fully connected world with an anchor per landmark', () => {
    const w=compileTopology(sampleTown);
    expect(validateWorld(w)).toEqual([]);
    expect(w.questAnchors.map(q=>q.id).sort()).toEqual(sampleTown.nodes.map(n=>n.id).sort());
    expect(w.sectors.some(s=>s.poi==='road')).toBe(true);
  });
  it('resolves colliding nodes deterministically and rejects broken input', () => {
    const crowded:Topology={id:'c',name:'c',spawn:'a',nodes:[{id:'a',kind:'park',name:'A',x:0,z:0},{id:'b',kind:'shrine',name:'B',x:10,z:10}],edges:[{from:'a',to:'b'}]};
    const w=compileTopology(crowded);
    expect(validateWorld(w)).toEqual([]);
    expect(new Set(w.sectors.map(s=>`${s.x},${s.z}`)).size).toBe(w.sectors.length);
    expect(()=>compileTopology({...crowded,spawn:'zz'})).toThrow();
    expect(()=>compileTopology({...crowded,edges:[{from:'a',to:'zz'}]})).toThrow();
    expect(validateWorld({...w,connections:[...w.connections,{a:'a',b:'missing'}]}).length).toBeGreaterThan(0);
    expect(validateWorld({...w,version:'other'}).length).toBeGreaterThan(0);
  });
  it('opens exactly the connected walls and keeps every open doorway walkable from the anchor', () => {
    const w=compileTopology(sampleTown), layout=compiledLayout(w);
    const linked=new Set(w.connections.flatMap(c=>[`${c.a}|${c.b}`,`${c.b}|${c.a}`]));
    const at=new Map(w.sectors.map(s=>[`${s.x},${s.z}`,s]));
    for(const s of w.sectors) {
      const {plan,at:reachable}=walkable(s.x,s.z,w.seed,layout);
      expect(plan.label).toBe(s.label);
      expect(plan.shaft).toBeUndefined();
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const door=layout.passage(s.x,s.z,w.seed,dx,dz), next=at.get(`${s.x+dx},${s.z+dz}`);
        expect(door.width>0,`${s.id} ${dx},${dz}`).toBe(!!next&&linked.has(`${s.id}|${next.id}`));
        expect(layout.passage(s.x+dx,s.z+dz,w.seed,-dx,-dz)).toEqual(door);
        if(door.width>0) expect(reachable(dx?dx*16:door.offset,dz?dz*16:door.offset),`${s.id} door ${dx},${dz}`).toBe(true);
      }
    }
    expect(layout.exists!(99,99)).toBe(false);
  });
});

describe('quest lifecycle', () => {
  it('walks DRAFT -> ACCEPTED -> ACTIVE -> COMPLETED in step order', () => {
    let q=sampleQuest();
    expect(questReducer(q,{type:'start'})).toBe(q);
    q=questReducer(q,{type:'accept'});expect(q.status).toBe('ACCEPTED');
    q=questReducer(q,{type:'start'});expect(currentStep(q)?.anchor).toBe('konbini');
    expect(questReducer(q,{type:'reach',anchor:'station'})).toBe(q);
    q=questReducer(q,{type:'reach',anchor:'konbini'});expect(currentStep(q)?.anchor).toBe('station');
    q=questReducer(q,{type:'reach',anchor:'station'});expect(q.status).toBe('COMPLETED');
    expect(questReducer(q,{type:'abandon'})).toBe(q);
  });
  it('abandons and expires only when allowed', () => {
    const q=questReducer(questReducer(sampleQuest(),{type:'accept'}),{type:'start'});
    expect(questReducer(q,{type:'abandon'}).status).toBe('ABANDONED');
    expect(questReducer(q,{type:'expire',now:1})).toBe(q);
    const timed={...q,expiresAt:100};
    expect(questReducer(timed,{type:'expire',now:99})).toBe(timed);
    expect(questReducer(timed,{type:'expire',now:100}).status).toBe('EXPIRED');
  });
});
