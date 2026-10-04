import { describe, it, expect } from 'vitest';
import { compileReality } from '../src/lib/backside/compile-reality';
import { compileTopology } from '../src/lib/backside/compiler';
import { isQuest } from '../src/lib/backside/quest';
import { sampleTown } from '../src/lib/backside/fixtures/sample-town';
import { fromOverpass } from '../src/lib/backside/providers/overpass';
import { gridArea, gridResponse } from '../src/lib/backside/fixtures/overpass-grid';
import { isWorldShape, pickWorld, questFor } from '../src/lib/localquest/world-source';

const real=()=>compileReality(fromOverpass(gridResponse(),gridArea));
const anchorsOf=(w:{questAnchors:{id:string}[]})=>new Set(w.questAnchors.map(a=>a.id));

describe('local quest world source', () => {
  it('plays a valid generated world with a quest on its own anchors', () => {
    // A JSON round trip, as the fetch script writes it (-0 becomes 0).
    const w=JSON.parse(JSON.stringify(real()));
    const picked=pickWorld(w);
    expect(picked.source).toBe('generated');
    expect(picked.world).toEqual(w);
    const q=picked.quest();
    expect(isQuest(q,anchorsOf(w))).toBe(true);
    expect(q.steps.map(s=>w.questAnchors.find(a=>a.id===s.anchor)?.role)).toEqual(['convenience','station']);
    expect(q.steps[1].anchor).toBe(w.questAnchors.find(a=>a.sector===w.spawn.sector)?.id);
    expect(picked.quest()).toEqual(q);
  });

  it('falls back to the sample town when absent, forced or broken', () => {
    const sample=compileTopology(sampleTown);
    const w=real();
    const broken:unknown[]=[
      undefined, null, 'world', [], {},
      {...w,version:'backside-compiler/9.9.9'},
      {...w,seed:1.5},
      {...w,sectors:[]},
      {...w,sectors:[{...w.sectors[0],x:'0'},...w.sectors.slice(1)]},
      {...w,connections:'none'},
      {...w,spawn:{...w.spawn,sector:'nowhere'}},
      {...w,connections:[]},
      {...w,questAnchors:[]},
      {...w,questAnchors:w.questAnchors.slice(0,1)},
    ];
    for(const b of broken) {
      const picked=pickWorld(b);
      expect(picked.source).toBe('sample');
      expect(picked.world).toEqual(sample);
      expect(picked.quest().id).toBe('first-signal');
    }
    expect(pickWorld(w,{forceSample:true}).source).toBe('sample');
  });

  it('rejects invalid generated-world fields and ambiguous anchor ids', () => {
    const w=real();
    const broken:unknown[]=[
      {...w,seed:4294967296},
      {...w,osmId:'unknown'},
      {...w,sourceArea:{...w.sourceArea,provider:'unknown'}},
      {...w,spawn:{...w.spawn,y:1}},
      {...w,sectors:[{...w.sectors[0],osmId:'unknown'},...w.sectors.slice(1)]},
      {...w,connections:[{...w.connections[0],kind:'unknown'},...w.connections.slice(1)]},
      {...w,questAnchors:[{...w.questAnchors[0],providerId:'unknown'},...w.questAnchors.slice(1)]},
      {...w,sectors:[{...w.sectors[0],place:'unknown'},...w.sectors.slice(1)]},
      {...w,sectors:[{...w.sectors[0],poi:'unknown'},...w.sectors.slice(1)]},
      {...w,sectors:[{...w.sectors[0],variant:3},...w.sectors.slice(1)]},
      {...w,sectors:[{...w.sectors[0],ja:{}},...w.sectors.slice(1)]},
      {...w,sectors:[{...w.sectors[0],x:4097},...w.sectors.slice(1)]},
      {...w,questAnchors:[{...w.questAnchors[0],role:'unknown'},...w.questAnchors.slice(1)]},
      {...w,questAnchors:[{...w.questAnchors[0],x:1000001},...w.questAnchors.slice(1)]},
      {...w,questAnchors:[w.questAnchors[0],...w.questAnchors]},
    ];
    for(const b of broken) expect(pickWorld(b).source).toBe('sample');
  });

  it('checks shape before trusting the graph', () => {
    expect(isWorldShape(real())).toBe(true);
    expect(isWorldShape(compileTopology(sampleTown))).toBe(true);
    const {sectors:_,...missing}=real();
    expect(isWorldShape(missing)).toBe(false);
  });

  it('falls back from a convenience store to another place, then to any anchor', () => {
    const w=real();
    const noShop={...w,questAnchors:w.questAnchors.filter(a=>a.role!=='convenience')};
    const q=questFor(noShop);
    const role=noShop.questAnchors.find(a=>a.id===q.steps[0].anchor)?.role;
    expect(role).not.toBe('intersection');
    expect(role).not.toBe('station');
    const junctionsOnly={...w,questAnchors:w.questAnchors.filter(a=>a.role==='intersection'||a.sector===w.spawn.sector)};
    expect(noShop.questAnchors.find(a=>a.id===questFor(junctionsOnly).steps[0].anchor)?.role).toBe('intersection');
  });
});
