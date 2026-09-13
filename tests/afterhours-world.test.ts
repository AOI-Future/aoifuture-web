import { describe, it, expect } from 'vitest';
import { hash, obstacles, roomPlan, describeRoom, PLACES, ROOM, passage, resonancePoint, nextResonance, floorSeed, shaftAt } from '../src/lib/afterhours/geography';
describe('a memorable connected world', () => {
  it('connects every threshold, suite, source and shaft through walkable passages', () => {
    for(const level of [0,1,4])for(const seed of [42,31337])for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++) {
      const actualSeed=floorSeed(seed,level), plan=roomPlan(x,z,actualSeed);
      const blocks=plan.boxes.filter(b=>b.solid&&b.y-b.h/2<1.9&&b.y+b.h/2>.1);
      const blocked=(px:number,pz:number)=>blocks.some(b=>Math.abs(px-b.x)<b.w/2+.35&&Math.abs(pz-b.z)<b.d/2+.35);
      const source=resonancePoint(x,z,actualSeed),sx=Math.round((source.x-x*32+16)*2),sz=Math.round((source.z-z*32+16)*2);
      const visited=new Uint8Array(65*65),queue=[sz*65+sx];visited[queue[0]]=1;
      for(let i=0;i<queue.length;i++){
        const id=queue[i],cx=id%65,cz=Math.floor(id/65);
        for(const [nx,nz] of [[cx-1,cz],[cx+1,cz],[cx,cz-1],[cx,cz+1]]){
          const n=nz*65+nx;if(nx<0||nx>64||nz<0||nz>64||visited[n]||blocked(nx/2-16,nz/2-16))continue;
          visited[n]=1;queue.push(n);
        }
      }
      const reachable=(px:number,pz:number)=>expect(visited[Math.round((pz+16)*2)*65+Math.round((px+16)*2)],`seed ${seed} floor ${level} room ${x},${z} point ${px},${pz}`).toBe(1);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const door=passage(x,z,actualSeed,dx,dz);reachable(dx?dx*16:door.offset,dz?dz*16:door.offset);
      }
      if(plan.maze)for(let col=0;col<4;col++)for(let row=0;row<4;row++)reachable(-10.5+col*7,-10.5+row*7);
      if(plan.shaft){reachable(plan.shaft.x,plan.shaft.z);reachable(plan.shaft.liftX,plan.shaft.liftZ);}
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
  it('places successive signals farther away and inside reachable suites',()=>{
    for(const level of [0,1,5])for(let count=1;count<=30;count++) {
      const seed=floorSeed(42,level),point=nextResonance(-73,47,seed,count);
      const distance=Math.hypot(point.x+73,point.z-47);
      expect(distance).toBeGreaterThan(70);expect(distance).toBeLessThan(200);
      expect(obstacles(Math.round(point.x/32),Math.round(point.z/32),seed).some(b=>Math.abs(point.x-b.x)<b.w/2+.35&&Math.abs(point.z-b.z)<b.d/2+.35)).toBe(false);
    }
    expect(shaftAt(0,0)).toBeDefined();
    expect(roomPlan(2,3,floorSeed(42,1))).not.toEqual(roomPlan(2,3,floorSeed(42,0)));
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
