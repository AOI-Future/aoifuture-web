import { describe, it, expect } from 'vitest';
import { compileTopology } from '../src/lib/backside/compiler';
import { validateWorld } from '../src/lib/backside/ir';
import { classify, extractTopology, project, REAL_AREA_NAME, type GeoSnapshot } from '../src/lib/backside/reality';
import { fromOverpass, overpassQuery, OSM_ATTRIBUTION } from '../src/lib/backside/providers/overpass';
import { gridArea, gridResponse } from '../src/lib/backside/fixtures/overpass-grid';

// Beside the triangle north of the grid, far from every grid junction.
const islandStation={lat:gridArea.lat+2.3*150/111195,lon:gridArea.lon};
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
    expect(()=>fromOverpass({...gridResponse(),remark:'runtime error: Query timed out'},gridArea)).toThrow(/remark/);
    expect(()=>fromOverpass({elements:[{type:'way',id:1,tags:{highway:'residential'}}]} as never,gridArea)).toThrow(/node refs/);
    const q=overpassQuery(gridArea);
    expect(q).toContain('around:420,35.000000,135.000000');
    expect(q).toContain('out body center;');
    expect(q).not.toContain('out tags');
    expect(q).not.toContain('nwr[');
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
    expect(topo.name).toBe(REAL_AREA_NAME);
    expect(world.sourceArea.name).toBe(REAL_AREA_NAME);
  });

  it('contracts streets to junction-to-junction edges', () => {
    const topo=extractTopology(snapshot());
    const junctionEdges=topo.edges.filter(e=>e.from.startsWith('intersection')&&e.to.startsWith('intersection'));
    // A 4x4 grid has 24 street segments; the footpath adds none.
    expect(junctionEdges).toHaveLength(24);
  });

  it('drops the detached street triangle, far places and ignored tags', () => {
    const topo=extractTopology(snapshot());
    // The triangle has three junctions joined by streets; only the grid's 16 survive.
    expect(topo.nodes.filter(n=>n.kind==='convenience')).toHaveLength(1);
    expect(topo.nodes.length).toBe(16+6);
    const r=gridArea.radius;
    for(const n of topo.nodes) expect(Math.hypot(n.x,n.z)).toBeLessThanOrEqual(r+1);
  });

  it('spawns on the main network even when the only station sits by an island', () => {
    const json=gridResponse();
    json.elements=json.elements.filter(e=>e.id!==9001);
    json.elements.push({type:'node',id:9008,...islandStation,tags:{railway:'station'}});
    const topo=extractTopology(fromOverpass(json,gridArea));
    expect(topo.spawn).toBe('station-1');
    expect(topo.nodes.filter(n=>n.kind==='intersection')).toHaveLength(16);
    const near=topo.edges.filter(e=>e.from==='station-1'||e.to==='station-1').map(e=>e.from==='station-1'?e.to:e.from);
    expect(near).toHaveLength(1);
    expect(near[0]).toMatch(/^intersection-/);
    expect(validateWorld(compileTopology(topo))).toEqual([]);
  });

  it('never fuses a separate network sitting in the same cell as a grid junction', () => {
    // Two crossing streets whose junction is 15m east of grid junction (1,1), sharing no node with the grid.
    const DLAT=150/111195, DLON=150/(111195*Math.cos(35*Math.PI/180)), m=DLON/150, n=DLAT/150;
    const lat=gridArea.lat+.5*DLAT, lon=gridArea.lon-.5*DLON+15*m;
    const json=gridResponse();
    json.elements.push({type:'node',id:7000,lat,lon:lon-8*m},{type:'node',id:7001,lat,lon},{type:'node',id:7002,lat,lon:lon+8*m},
      {type:'node',id:7003,lat:lat+8*n,lon},{type:'node',id:7004,lat:lat-8*n,lon});
    json.elements.push({type:'way',id:700,nodes:[7000,7001,7002],tags:{highway:'residential'}},{type:'way',id:701,nodes:[7003,7001,7004],tags:{highway:'residential'}});
    const topo=extractTopology(fromOverpass(json,gridArea));
    const junctions=topo.nodes.filter(n=>n.kind==='intersection');
    expect(junctions).toHaveLength(16);
    // The grid keeps its own junction; the nearer stray one never takes its place.
    expect(junctions.some(j=>j.x===-75&&j.z===-75)).toBe(true);
    expect(junctions.some(j=>j.x===-60)).toBe(false);
    expect(topo.edges.filter(e=>e.from.startsWith('intersection')&&e.to.startsWith('intersection'))).toHaveLength(24);
    expect(validateWorld(compileTopology(topo))).toEqual([]);
  });

  it('keeps provider ids that look alike apart', () => {
    // A tagged node whose id equals a junction id must stay a separate place.
    // Node and way ids live in separate OSM namespaces: a park way may share its id with a junction node.
    const json=gridResponse();
    const park=json.elements.find(e=>e.type==='way'&&e.id===600) as {id:number};
    park.id=1011;
    const topo=extractTopology(fromOverpass(json,gridArea));
    expect(topo.nodes.filter(n=>n.kind==='intersection')).toHaveLength(16);
    expect(topo.nodes.filter(n=>n.kind==='park')).toHaveLength(1);
    expect(topo).toEqual({...extractTopology(snapshot()),seed:topo.seed});
  });

  it('never carries real names or provider ids into the topology', () => {
    // The seed is a number that may happen to contain digits like a provider id; it carries no provider data.
    const text=JSON.stringify({...extractTopology(snapshot()),seed:0});
    expect(text).not.toMatch(/Fictional|GRID FIXTURE|900\d|10\d\d|osm/);
    const named=extractTopology({...snapshot(),area:{...gridArea,name:'Real Place Name'}});
    expect(JSON.stringify(compileTopology(named))).not.toContain('Real Place Name');
  });

  it('is deterministic and independent of element order', () => {
    const a=extractTopology(snapshot());
    const shuffled=gridResponse();
    shuffled.elements.reverse();
    const b=extractTopology(fromOverpass(shuffled,gridArea));
    expect(b).toEqual(a);
    expect(compileTopology(b)).toEqual(compileTopology(a));
    const moved=gridResponse();
    const shop=moved.elements.find(e=>e.type==='node'&&e.id===9002) as {lat:number};
    shop.lat+=.001;
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
