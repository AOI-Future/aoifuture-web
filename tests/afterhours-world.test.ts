import { describe, it, expect } from 'vitest';
import { hash, obstacles, roomPlan, describeRoom, PLACES, ROOM, passage } from '../src/lib/afterhours/geography';
describe('a memorable connected world', () => {
  it('keeps a connected walking route through every threshold, including negative coordinates', () => {
    for (const seed of [1,42,918273]) for(let x=-8;x<=8;x++) for(let z=-8;z<=8;z++) {
      const blocks=obstacles(x,z,seed);
      for(let t=-16;t<=16;t+=.5) for(const [px,pz] of [[x*ROOM+t,z*ROOM],[x*ROOM,z*ROOM+t]]) {
        expect(blocks.some(b=>Math.abs(px-b.x)<b.w/2+.35&&Math.abs(pz-b.z)<b.d/2+.35)).toBe(false);
      }
      for(const b of blocks){expect(Math.abs(b.x-x*ROOM)+b.w/2).toBeLessThanOrEqual(16.0001);expect(Math.abs(b.z-z*ROOM)+b.d/2).toBeLessThanOrEqual(16.0001);}
    }
  });
  it('has eight distinct structural and acoustic identities, reachable in the first neighbourhood', () => {
    const rooms=[];for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)rooms.push(roomPlan(x,z,42));
    expect(new Set(rooms.map(r=>r.place.key)).size).toBe(8);
    expect(new Set(PLACES.map(p=>p.height)).size).toBe(8);
    expect(new Set(PLACES.map(p=>p.surface)).size).toBe(4);
    expect(new Set(rooms.map(r=>JSON.stringify(r.boxes))).size).toBeGreaterThanOrEqual(8);
  });
  it('revisits exact layouts and addresses regardless of generation order or collection count', () => {
    const before=roomPlan(-15,8,42);
    for(let i=0;i<20;i++)roomPlan(i,-i,42);
    expect(roomPlan(-15,8,42)).toEqual(before);
    expect(describeRoom(-15,8,42).id).toBe('W15 / S8');
    expect(roomPlan(-15,8,42)).not.toEqual(roomPlan(-15,8,71));
    expect(hash(-15,8,42)).toBeGreaterThanOrEqual(0);expect(hash(-15,8,42)).toBeLessThan(1);
  });
  it('keeps all room centres and resonance destinations accessible', () => {
    for(const seed of [42,31337])for(let x=-12;x<=12;x++)for(let z=-12;z<=12;z++){
      expect(obstacles(x,z,seed).some(b=>Math.abs(x*ROOM-b.x)<b.w/2+.35&&Math.abs(z*ROOM-b.z)<b.d/2+.35)).toBe(false);
    }
  });
  it('matches both sides of every doorway and merges some halls into larger spaces',()=>{
    let wide=0;
    for(let x=-15;x<=15;x++)for(let z=-15;z<=15;z++)for(const[dx,dz]of [[1,0],[0,1]]){
      const a=passage(x,z,42,dx,dz),b=passage(x+dx,z+dz,42,-dx,-dz);
      expect(a).toEqual(b);expect(a.width).toBeGreaterThanOrEqual(6);if(a.width>6)wide++;
    }
    expect(wide).toBeGreaterThan(100);
  });

});
