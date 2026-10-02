import { describe, it, expect } from 'vitest';
import { compileTopology } from '../src/lib/backside/compiler';
import { validateWorld } from '../src/lib/backside/ir';
import { classify, extractTopology, project, type GeoSnapshot } from '../src/lib/backside/reality';
import { fromOverpass, overpassQuery, OSM_ATTRIBUTION } from '../src/lib/backside/providers/overpass';
import { gridArea, gridResponse } from '../src/lib/backside/fixtures/overpass-grid';

const snapshot=()=>fromOverpass(gridResponse(),gridArea);

describe('reality extractor', () => {
  it('classifies the tags it knows and ignores the rest', () => {
    expect(classify({railway:'station'})).toBe('station');
    expect(classify({public_transport:'station'})).toBe('station');
    expect(classify({shop:'convenience'})).toBe('convenience');
    expect(classify({amenity:'place_of_worship',religion:'shinto'})).toBe('shrine');
    expect(classify({amenity:'place_of_worship',religion:'buddhist'})).toBeUndefined();
    expect(classify({leisure:'park'})).toBe('park');
    expect(classify({amenity:'library'})).toBe('library');
    expect(classify({historic:'memorial'})).toBe('landmark');
    expect(classify({amenity:'cafe'})).toBeUndefined();
    expect(classify()).toBeUndefined();
  });

  it('projects to metres east and south of the origin', () => {
    const o={lat:35,lon:135};
    expect(project(35,135,o)).toEqual({x:0,z:-0});
    const north=project(35+1/111195,135,o);
    expect(north.z).toBeCloseTo(-1,2);
    expect(project(35,135+1/(111195*Math.cos(35*Math.PI/180)),o).x).toBeCloseTo(1,2);
  });

  it('parses overpass output with attribution and without duplicate nodes', () => {
    const s=snapshot();
    expect(s.attribution).toBe(OSM_ATTRIBUTION);
    expect(s.license).toBe('ODbL-1.0');
    expect(s.fetchedAt).toBe('2026-01-01T00:00:00Z');
    expect(s.nodes.filter(n=>n.id==='9001')).toHaveLength(1);
    expect(s.nodes.find(n=>n.id==='9001')?.tags?.railway).toBe('station');
    expect(()=>fromOverpass({} as never,gridArea)).toThrow();
    const q=overpassQuery(gridArea);
    expect(q).toContain('around:420,35.000000,135.000000');
    expect(q).toContain('out tags center;');
  });

  it('extracts a connected, compilable topology spawning at the station', () => {
    const topo=extractTopology(snapshot());
    expect(topo.id).toBe('real:grid-fixture');
    expect(topo.spawn).toBe('station-1');
    const kinds=topo.nodes.map(n=>n.kind);
    expect(kinds.filter(k=>k==='intersection')).toHaveLength(16);
    for(const k of ['station','convenience','shrine','library','landmark','park'] as const) expect(kinds).toContain(k);
    const world=compileTopology(topo);
    expect(validateWorld(world)).toEqual([]);
    const ids=new Set(world.sectors.map(s=>s.id));
    for(const n of topo.nodes) expect(ids.has(n.id)).toBe(true);
    expect(world.sourceArea.name).toBe(gridArea.name);
  });

  it('contracts streets to junction-to-junction edges', () => {
    const topo=extractTopology(snapshot());
    const junctionEdges=topo.edges.filter(e=>e.from.startsWith('intersection')&&e.to.startsWith('intersection'));
    // A 4x4 grid has 24 street segments; the footpath adds none.
    expect(junctionEdges).toHaveLength(24);
  });

  it('drops the detached island, far places and ignored tags', () => {
    const topo=extractTopology(snapshot());
    expect(topo.nodes.filter(n=>n.kind==='convenience')).toHaveLength(1);
    expect(topo.nodes.length).toBe(16+6);
    const r=gridArea.radius;
    for(const n of topo.nodes) expect(Math.hypot(n.x,n.z)).toBeLessThanOrEqual(r+1);
  });

  it('never carries real names or provider ids into the topology', () => {
    const text=JSON.stringify(extractTopology(snapshot()));
    expect(text).not.toMatch(/Fictional|900\d|10\d\d|osm/);
  });

  it('is deterministic and independent of element order', () => {
    const a=extractTopology(snapshot());
    const shuffled=gridResponse();
    shuffled.elements.reverse();
    const b=extractTopology(fromOverpass(shuffled,gridArea));
    expect(b).toEqual(a);
    expect(compileTopology(b)).toEqual(compileTopology(a));
    const moved=gridResponse();
    const station=moved.elements.find(e=>e.type==='node'&&e.id===9002) as {lat:number};
    station.lat+=.001;
    expect(extractTopology(fromOverpass(moved,gridArea)).seed).not.toBe(a.seed);
  });

  it('respects caps and fails loudly without streets', () => {
    const topo=extractTopology(snapshot(),{maxJunctions:4,maxPois:2});
    expect(topo.nodes.filter(n=>n.kind==='intersection').length).toBeLessThanOrEqual(4);
    expect(topo.nodes.filter(n=>n.kind!=='intersection').length).toBeLessThanOrEqual(2);
    expect(validateWorld(compileTopology(topo))).toEqual([]);
    const empty:GeoSnapshot={...snapshot(),ways:[]};
    expect(()=>extractTopology(empty)).toThrow(/no street junctions/);
  });
});
