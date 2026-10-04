import { describe,it,expect } from 'vitest';
import { relativeBearing } from '../src/lib/localquest/navigation';
describe('relative quest bearing',()=>{
  const origin={x:0,z:0};
  it.each([
    [0,0,-10,0], [0,10,0,Math.PI/2], [0,-10,0,-Math.PI/2],
    [Math.PI/2,-10,0,0], [-Math.PI/2,10,0,0],
    [Math.PI,0,10,0], [Math.PI*4,0,-10,0],
  ])('yaw %s target (%s,%s) -> %s',(yaw,x,z,expected)=>{
    expect(relativeBearing(yaw,origin,{x,z})).toBeCloseTo(expected);
  });
  it('is independent of world translation and has no direction for a coincident target',()=>{
    expect(relativeBearing(0,{x:25,z:30},{x:35,z:30})).toBeCloseTo(Math.PI/2);
    expect(relativeBearing(1,origin,origin)).toBe(0);
  });
});
