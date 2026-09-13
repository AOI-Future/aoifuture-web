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
  return {width:merged?(edge<.5?24:18):6,height:merged?a.place.height:Math.min(4.6,a.place.height-.35,b.place.height-.35)};
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
    const opening=connection.width, flank=(ROOM-opening)/2, offset=(ROOM+opening)/4;
    for(const sign of [-1,1]) {
      box('wall',axis==='x'?side*15.8:sign*offset,height/2,axis==='x'?sign*offset:side*15.8,axis==='x'?.4:flank,height,axis==='x'?flank:.4);
      box('trim',axis==='x'?side*15.55:sign*offset,.16,axis==='x'?sign*offset:side*15.55,axis==='x'?.12:flank,.32,axis==='x'?flank:.12);
    }
    const doorway=connection.height;
    if(height>doorway) box('wall',axis==='x'?side*15.8:0,(height+doorway)/2,axis==='x'?0:side*15.8,axis==='x'?.4:opening,height-doorway,axis==='x'?opening:.4,false);
    box('light',axis==='x'?side*15.5:0,doorway-.12,axis==='x'?0:side*15.5,axis==='x'?.1:opening-.2,.07,axis==='x'?opening-.2:.1,false);
  }
  const interiorStart=boxes.length;
  if (key === 'concourse') {
    for (const sx of [-1,1]) for (const sz of [-1,1]) {
      box('wall',sx*9,height/2,sz*9,1.4,height,1.4);
      box('wood',sx*7,.55,sz*10,5,.25,1.1);
      box('wood',sx*7,1.05,sz*10.45,5,.9,.18);
      for (const dx of [-1.8,1.8]) box('metal',sx*7+dx,.25,sz*10,.12,.5,.8);
      box('light',sx*8,height-.12,sz*7,.7,.08,5,false);
    }
    box('metal',-7,1.1,-13,4,2.2,1.2); box('screen',-7,1.6,-12.36,3.6,.55,.04,false);
  } else if (key === 'archive') {
    for (const sx of [-1,1]) for (const sz of [-1,1]) for (let row=0; row<3; row++) {
      const px=sx*(5+row*3.7), pz=sz*9;
      box('wood',px,1.35,pz,.65,2.7,9);
      for (let shelf=0;shelf<4;shelf++) {
        box('trim',px,.45+shelf*.58,pz,.8,.07,9,false);
        // Dense book spines are batched into one draw call per material.
        for (let book=0;book<6;book++) box(book%3===room.variant?'art':'wall',px,.65+shelf*.58,pz-3.7+book*1.4,.72,.3+(book%2)*.12,.85,false);
      }
    }
    for (const sx of [-1,1]) box('light',sx*7,height-.1,0,.45,.06,26,false);
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
  } else if (key === 'office') {
    for (const sx of [-1,1]) for (const sz of [-1,1]) {
      box('wall',sx*9,.8,sz*8,10,1.6,.2);
      for (let i=0;i<3;i++) {
        const px=sx*(5+i*3.4), pz=sz*10;
        box('wood',px,.78,pz,2.6,.15,1.8); box('metal',px,.35,pz,2,.7,.8);
        box('metal',px,1.13,pz+sz*.4,.9,.6,.15); box('screen',px,1.13,pz+sz*.49,.78,.45,.025,false);
        box('dark',px,.45,pz-sz*1.5,.8,.9,.8);
      }
      box('light',sx*8,height-.08,sz*8,2,.05,2,false);
    }
  } else if (key === 'gallery') {
    for (const sx of [-1,1]) for (const sz of [-1,1]) {
      box('wall',sx*9,2.2,sz*8,9,4.4,.45);
      box('trim',sx*9,2.35,sz*8-sz*.26,3.4,2.3,.1,false);
      box('art',sx*9,2.35,sz*8-sz*.33,3.05,1.95,.05,false);
      box('light',sx*9,3.8,sz*8-sz*.8,2,.07,.12,false);
      box('trim',sx*7,.5,sz*12,2,1,2); box('art',sx*7,1.6,sz*12,.65,1.2,.65);
    }
  } else if (key === 'service') {
    for (const sx of [-1,1]) {
      box('metal',sx*9,1.4,10,7,2.8,3);
      for (let i=0;i<4;i++) {
        box('trim',sx*9,1.3,8.45+i*.1,6,2,.035,false);
        box('screen',sx*(6+i*1.4),2.25,8.44,.2,.2,.03,false);
      }
      for (const z of [-10,10]) box('metal',sx*12,height/2,z,.5,height,.5);
      box('light',sx*5,height-.15,0,.16,.08,28,false);
    }
  } else {
    for (const sx of [-1,1]) for (const sz of [-1,1]) {
      box('trim',sx*9,.3,sz*9,7,.6,7); box('dark',sx*9,.62,sz*9,6.6,.06,6.6,false);
      box('wood',sx*6,.5,sz*4.4,4,.25,.75);
      box('light',sx*9,height-.15,sz*9,5,.08,5,false);
    }
    for (let i=-12;i<=12;i+=6) { box('metal',i,height-.35,0,.12,.4,31,false); box('metal',0,height-.35,i,31,.4,.12,false); }
  }
  if(room.variant===1) for(const b of boxes.slice(interiorStart)) {
    const previousX=b.x, previousW=b.w;b.x=-b.z;b.z=previousX;b.w=b.d;b.d=previousW;
  }
  return { ...room, boxes };
}
export function obstacles(x:number,z:number,seed:number) {
  return roomPlan(x,z,seed).boxes.filter(b=>b.solid && b.y-b.h/2<1.9 && b.y+b.h/2>.1)
    .map(b=>({...b,x:b.x+x*ROOM,z:b.z+z*ROOM}));
}
