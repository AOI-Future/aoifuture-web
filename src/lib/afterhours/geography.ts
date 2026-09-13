/** Spatial identity is a function of coordinates and seed, never collection count. */
export const ROOM = 32;
export type Surface = 'carpet' | 'tile' | 'stone' | 'concrete';
export const PLACES = [
  { key: 'concourse', name: 'ARRIVAL HALL', ja: '帰らない待合室', height: 5.6, wall: 0xafa078, floor: 0x8b8060, fog: 0x8d8469, light: 0xffedbb, surface: 'stone', echo: .35, clue: '止まった時計と、誰も座らないベンチ。' },
  { key: 'archive', name: 'THE STACKS', ja: '忘却の書架', height: 3.7, wall: 0x88785e, floor: 0x584e40, fog: 0x706551, light: 0xffdfa1, surface: 'carpet', echo: .12, clue: '背表紙のない棚の向こうに、細い通路が続く。' },
  { key: 'pool', name: 'STILLWATER', ja: '静水の間', height: 7.2, wall: 0xb4d4d1, floor: 0x83aca8, fog: 0x8fb1b1, light: 0xd1ffff, surface: 'tile', echo: .85, clue: '水面は動いている。泳ぐ人は、いない。' },
  { key: 'atrium', name: 'THE OCULUS', ja: '光の吹き抜け', height: 12, wall: 0xd0c8b5, floor: 0xa6a194, fog: 0xb7b5a5, light: 0xffffe9, surface: 'stone', echo: .9, clue: '高い天井に浮かぶ、もうひとつの太陽。' },
  { key: 'office', name: 'OVERTIME', ja: '終業後の事務室', height: 3.15, wall: 0xb6b490, floor: 0x6a7367, fog: 0x8a907c, light: 0xe9ffd3, surface: 'carpet', echo: .08, clue: '低い天井。ついたままの画面。帰ったはずの気配。' },
  { key: 'gallery', name: 'SOFT EXHIBIT', ja: '空白の展示室', height: 6.2, wall: 0xc7abb9, floor: 0x9a8997, fog: 0xa68e9e, light: 0xffdbee, surface: 'stone', echo: .65, clue: '額縁の中には、ここではない色だけがある。' },
  { key: 'service', name: 'UNDERWORKS', ja: '地下の配管廊', height: 4.4, wall: 0x718382, floor: 0x616d70, fog: 0x697c7c, light: 0xbdf8f1, surface: 'concrete', echo: .5, clue: '太い配管が、知らない場所へ熱を運ぶ。' },
  { key: 'garden', name: 'WINTER GARDEN', ja: '夜の温室', height: 8.5, wall: 0x9caca0, floor: 0x78867a, fog: 0x879e90, light: 0xe1ffd9, surface: 'tile', echo: .7, clue: '窓の向こうも、室内かもしれない。' },
] as const;
export type Place = typeof PLACES[number];
export function hash(x: number, z: number, seed: number) {
  let n = Math.imul(x ^ seed, 374761393) ^ Math.imul(z, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function describeRoom(x: number, z: number, seed: number) {
  // A legible first neighbourhood; beyond it, related rooms form loose districts.
  const arrivals: Record<string, number> = { '0,0': 0, '0,-1': 1, '-1,0': 2, '1,0': 3, '0,1': 4, '-1,-1': 5, '1,-1': 6, '1,1': 7 };
  const districtX = Math.floor(x / 3), districtZ = Math.floor(z / 3);
  const district = Math.floor(hash(districtX, districtZ, seed ^ 817) * PLACES.length);
  const index = arrivals[`${x},${z}`] ?? (hash(x,z,seed ^ 91) < .62 ? district : Math.floor(hash(x,z,seed ^ 411) * PLACES.length));
  return { x, z, index, place: PLACES[index], variant: Math.floor(hash(x,z,seed ^ 310) * 3), id: `${x < 0 ? 'W' : 'E'}${Math.abs(x)} / ${z < 0 ? 'N' : 'S'}${Math.abs(z)}` };
}
export function passage(x:number,z:number,seed:number,dx:number,dz:number) {
  const a=describeRoom(x,z,seed),b=describeRoom(x+dx,z+dz,seed);
  const merged=a.index===b.index && ['concourse','pool','atrium','garden'].includes(a.place.key);
  const edge=hash(Math.min(x,x+dx)*2+(dx===0?1:0),Math.min(z,z+dz),seed^551);
  const tutorial=(x===0&&z===0)||(x+dx===0&&z+dz===0);
  const offset=merged||tutorial?0:([-9,0,9][Math.floor(edge*3)]);
  return {offset,width:merged?(edge<.5?24:18):6,height:merged?a.place.height:Math.min(4.6,a.place.height-.35,b.place.height-.35)};
}
export type MaterialKey = 'wall' | 'floor' | 'ceiling' | 'light' | 'trim' | 'wood' | 'metal' | 'water' | 'leaf' | 'screen' | 'dark' | 'art';
export type BoxSpec = { x: number; y: number; z: number; w: number; h: number; d: number; material: MaterialKey; solid: boolean };
export function roomPlan(x: number, z: number, seed: number) {
  const room = describeRoom(x,z,seed), {height, key} = room.place;
  const boxes: BoxSpec[] = [];
  const box = (material: MaterialKey, px: number, y: number, pz: number, w: number, h: number, d: number, solid = true) => boxes.push({material,x:px,y,z:pz,w,h,d,solid});
  // Matching large spaces merge into wider halls. Both sides derive the same opening.
  for (const axis of ['x','z'] as const) for (const side of [-1,1]) {
    const connection=passage(x,z,seed,axis==='x'?side:0,axis==='z'?side:0);
    const opening=connection.width, centre=connection.offset;
    for(const [lo,hi] of [[-16,centre-opening/2],[centre+opening/2,16]]) {
      const length=hi-lo, offset=(hi+lo)/2;
      box('wall',axis==='x'?side*15.8:offset,height/2,axis==='x'?offset:side*15.8,axis==='x'?.4:length,height,axis==='x'?length:.4);
      box('trim',axis==='x'?side*15.55:offset,.16,axis==='x'?offset:side*15.55,axis==='x'?.12:length,.32,axis==='x'?length:.12);
    }
    const doorway=connection.height;
    if(height>doorway) box('wall',axis==='x'?side*15.8:centre,(height+doorway)/2,axis==='x'?centre:side*15.8,axis==='x'?.4:opening,height-doorway,axis==='x'?opening:.4,false);
    box('light',axis==='x'?side*15.5:centre,doorway-.12,axis==='x'?centre:side*15.5,axis==='x'?.1:opening-.2,.07,axis==='x'?opening-.2:.1,false);
  }
  const interiorStart=boxes.length;
  const maze = ['archive','office','gallery','service'].includes(key);
  if (maze) {
    // A spanning tree joins all sixteen suites; a few extra doors introduce loops.
    // Seven-metre cells leave generous touch-friendly passages and no pixel-perfect turns.
    const edges = suiteDoors(x,z,seed);
    const partition = (axis:'x'|'z', at:number, along:number, open:boolean) => {
      const pieces = open ? [[-3.5,-1.35],[1.35,3.5]] : [[-3.5,3.5]];
      for(const [lo,hi] of pieces) box('wall',axis==='x'?at:along+(lo+hi)/2,height/2,axis==='x'?along+(lo+hi)/2:at,axis==='x'?.24:hi-lo,height,axis==='x'?hi-lo:.24);
      if(open && height>2.65)box('wall',axis==='x'?at:along,(height+2.65)/2,axis==='x'?along:at,axis==='x'?.24:2.7,height-2.65,axis==='x'?2.7:.24,false);
      if(open) box('light',axis==='x'?at:along,2.55,axis==='x'?along:at,axis==='x'?.27:2.6,.06,axis==='x'?2.6:.27,false);
    };
    for(let row=0;row<4;row++) for(let col=0;col<4;col++) {
      const id=row*4+col, px=-10.5+col*7, pz=-10.5+row*7;
      if(col<3) partition('x',px+3.5,pz,edges.has(edgeKey(id,id+1)));
      if(row<3) partition('z',pz+3.5,px,edges.has(edgeKey(id,id+4)));
      box('light',px,height-.1,pz,1.8,.06,.6,false);
      // Objects stay in the corner; all cell centres and door approaches remain clear.
      if(key==='archive') {
        box('wood',px-1.9,1.3,pz-2.85,2.5,2.6,.5);
        for(let shelf=0;shelf<4;shelf++)for(let book=0;book<5;book++)
          box(book%3===room.variant?'art':'trim',px-2.9+book*.45,.4+shelf*.57,pz-2.55,.28,.4,.12,false);
      } else if(key==='office') {
        box('wood',px-1.9,.8,pz-2.6,2.5,.15,1.2);
        box('metal',px-1.9,.4,pz-2.6,1.8,.8,.6);
        box('screen',px-1.9,1.25,pz-2.9,.9,.6,.08,false);
      } else {
        box('trim',px-2.25,.7,pz-2.25,1.1,1.4,1.1);
        box(key==='service'?'screen':'art',px-2.25,1.65,pz-2.25,.65,.45,.65,false);
      }
    }
    for(const side of [-1,1]) for(let i=0;i<4;i++) {
      partition('x',side*14,-10.5+i*7,i===(side===-1?1:2));
      partition('z',side*14,-10.5+i*7,i===(side===-1?2:1));
    }
  } else if (key === 'concourse') {
    for (const sx of [-1,1]) for (const sz of [-1,1]) {
      box('wall',sx*9,height/2,sz*9,1.4,height,1.4);
      box('wood',sx*7,.55,sz*10,5,.25,1.1);
      box('wood',sx*7,1.05,sz*10.45,5,.9,.18);
      for (const dx of [-1.8,1.8]) box('metal',sx*7+dx,.25,sz*10,.12,.5,.8);
      box('light',sx*8,height-.12,sz*7,.7,.08,5,false);
    }
    box('metal',-7,1.1,-13,4,2.2,1.2); box('screen',-7,1.6,-12.36,3.6,.55,.04,false);
  } else if (key === 'pool') {
    for (const sx of [-1,1]) for (const sz of [-1,1]) {
      const px=sx*8.8,pz=sz*8.8;
      box('trim',px,.15,pz,10,.3,10); box('water',px,.32,pz,9.4,.03,9.4,false);
      for (const off of [-5,5]) { box('wall',px+off,.24,pz,.22,.48,10); box('wall',px,.24,pz+off,10,.48,.22); }
      box('wall',sx*14.4,height/2,sz*9,.75,height,.75);
      box('light',sx*9,height-.1,sz*9,5,.08,5,false);
    }
  } else if (key === 'atrium') {
    for (const sx of [-1,1]) for (const sz of [-1,1]) {
      box('wall',sx*11.5,height/2,sz*11.5,1.1,height,1.1);
      box('trim',sx*8,.35,sz*8,3,.7,3);
      box('art',sx*8,2.5,sz*8,.7,3.6,.7);
      box('light',sx*8,height-.15,sz*8,6,.08,6,false);
    }
    for (const side of [-1,1]) box('trim',0,7,side*12.5,26,.5,2,false);
    box('light',0,height-.15,0,8,.1,8,false);
  } else {
    for (const sx of [-1,1]) for (const sz of [-1,1]) {
      box('trim',sx*9,.3,sz*9,7,.6,7); box('dark',sx*9,.62,sz*9,6.6,.06,6.6,false);
      box('wood',sx*6,.5,sz*4.4,4,.25,.75);
      box('light',sx*9,height-.15,sz*9,5,.08,5,false);
    }
    for (let i=-12;i<=12;i+=6) { box('metal',i,height-.35,0,.12,.4,31,false); box('metal',0,height-.35,i,31,.4,.12,false); }
  }
  if(!maze && room.variant===1) for(const b of boxes.slice(interiorStart)) {
    const previousX=b.x, previousW=b.w;b.x=-b.z;b.z=previousX;b.w=b.d;b.d=previousW;
  }
  // The outer promenade links offset thresholds without furniture blocking a doorway.
  if(!maze) for(let i=boxes.length-1;i>=interiorStart;i--) {
    const b=boxes[i];
    if(b.solid && (Math.abs(b.x)+b.w/2>13.5 || Math.abs(b.z)+b.d/2>13.5)) boxes.splice(i,1);
  }
  const shaft=shaftAt(x,z);
  if(shaft) {
    // Keep the shaft, lift, and their approach free of decorative furniture.
    for(let i=boxes.length-1;i>=interiorStart;i--) {
      const b=boxes[i];
      if(!maze && Math.abs(b.x-shaft.x)<b.w/2+2.9 && Math.abs(b.z-shaft.z)<b.d/2+2.2) boxes.splice(i,1);
    }
  }
  return { ...room, boxes, maze, shaft };
}
export function obstacles(x:number,z:number,seed:number) {
  return roomPlan(x,z,seed).boxes.filter(b=>b.solid && b.y-b.h/2<1.9 && b.y+b.h/2>.1)
    .map(b=>({...b,x:b.x+x*ROOM,z:b.z+z*ROOM}));
}

const edgeKey=(a:number,b:number)=>`${Math.min(a,b)},${Math.max(a,b)}`;
export function suiteDoors(x:number,z:number,seed:number) {
  const doors=new Set<string>(), visited=new Set([0]), stack=[0];
  while(stack.length) {
    const a=stack[stack.length-1],col=a%4,row=Math.floor(a/4);
    const neighbours=[col>0?a-1:-1,col<3?a+1:-1,row>0?a-4:-1,row<3?a+4:-1].filter(b=>b>=0&&!visited.has(b));
    if(!neighbours.length){stack.pop();continue;}
    const b=neighbours[Math.floor(hash(a+31*x,stack.length+31*z,seed^713)*neighbours.length)];
    doors.add(edgeKey(a,b));visited.add(b);stack.push(b);
  }
  for(let a=0;a<16;a++)for(const b of [a%4<3?a+1:-1,a<12?a+4:-1])
    if(b>=0&&hash(x*16+a,z*16+b,seed^829)<.13)doors.add(edgeKey(a,b));
  return doors;
}
// Shafts line up on every floor so the return lift always reaches the same address.
export function shaftAt(x:number,z:number) {
  return (x===0&&z===0)||hash(x,z,71429)<.16 ? {x:9.3,z:10.5,liftX:12.4,liftZ:10.5} : undefined;
}
export function floorSeed(seed:number,level:number) {return level===0?seed:(seed^Math.imul(level,104729))>>>0;}
export function floorLabel(level:number) {return level===0?'L0':`B${level}`;}
export function resonancePoint(x:number,z:number,seed:number) {
  const plan=roomPlan(x,z,seed);
  if(plan.maze) {
    const cell=Math.floor(hash(x,z,seed^1907)*15); // Last suite belongs to the shaft.
    return {x:x*ROOM-10.5+(cell%4)*7,z:z*ROOM-10.5+Math.floor(cell/4)*7};
  }
  return {x:x*ROOM,z:z*ROOM};
}
export function nextResonance(x:number,z:number,seed:number,count:number) {
  const direction=Math.floor(hash(count,Math.round(x+z),seed^923)*4);
  const span=3+Math.floor(hash(count,17,seed)*3),side=Math.floor(hash(count,19,seed)*3)-1;
  const [dx,dz]=[[side,-span],[span,side],[side,span],[-span,side]][direction];
  return resonancePoint(Math.round(x/ROOM)+dx,Math.round(z/ROOM)+dz,seed);
}
