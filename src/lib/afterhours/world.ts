import * as THREE from 'three';
import { ROOM, PLACES, describeRoom, hash, roomPlan, passage, floorSeed, floorLabel, type MaterialKey, type Surface, type BoxSpec } from './geography';
export { ROOM, PLACES, describeRoom, hash, obstacles, roomPlan } from './geography';

type Materials = Record<MaterialKey, THREE.Material>;
export class World {
  chunks = new Map<string, THREE.Group>();
  private palettes: Materials[];
  private textures: THREE.CanvasTexture[] = [];
  private box = new THREE.BoxGeometry(1,1,1);
  private plane = new THREE.PlaneGeometry(1,1);
  private ring = new THREE.TorusGeometry(1,.08,8,40);
  private sphere = new THREE.IcosahedronGeometry(1,1);
  private pipe = new THREE.CylinderGeometry(1,1,1,8);
  private lastArea = '';
  private water: THREE.CanvasTexture;
  seed:number;
  constructor(public scene: THREE.Scene, private baseSeed: number, public level=0) {
    this.seed=floorSeed(baseSeed,level);
    const surfaces = Object.fromEntries(['carpet','tile','stone','concrete'].map(s=>[s,this.texture(s as Surface)]));
    this.water = this.texture('water');
    this.palettes = PLACES.map((p,i) => ({
      wall: new THREE.MeshStandardMaterial({color:p.wall,roughness:.9}),
      floor: new THREE.MeshStandardMaterial({color:p.floor,map:surfaces[p.surface],roughness:p.surface==='tile'?.3:.95}),
      ceiling: new THREE.MeshStandardMaterial({color:p.wall,map:surfaces.tile,roughness:1,emissive:p.wall,emissiveIntensity:.065}),
      light: new THREE.MeshBasicMaterial({color:p.light}),
      trim: new THREE.MeshStandardMaterial({color:p.wall,roughness:.6,metalness:.15}),
      wood: new THREE.MeshStandardMaterial({color:i===1?0x4e3c28:0x71634a,roughness:.95}),
      metal: new THREE.MeshStandardMaterial({color:0x465754,roughness:.5,metalness:.45}),
      water: new THREE.MeshStandardMaterial({color:0x287e83,map:this.water,emissive:0x166367,emissiveIntensity:.35,roughness:.18,metalness:.35}),
      leaf: new THREE.MeshStandardMaterial({color:0x587e64,roughness:1}),
      screen: new THREE.MeshBasicMaterial({color:i===4?0x9ee4ce:0xa9eaea}),
      dark: new THREE.MeshStandardMaterial({color:0x2e3735,roughness:1}),
      art: new THREE.MeshStandardMaterial({color:[0x95c2bc,0xc1a574,0x86c6c9,0xb99262,0x93ba99,0x8f6eac,0xca8650,0x719b7a][i],roughness:.3,metalness:.25}),
    }));
    const p=PLACES[0]; scene.background=new THREE.Color(p.fog); scene.fog=new THREE.FogExp2(p.fog,.024);
  }
  private texture(surface: Surface | 'water') {
    const c=document.createElement('canvas'); c.width=c.height=128;
    const ctx=c.getContext('2d')!; ctx.fillStyle=surface==='water'?'#528f9a':'#bbbcb1'; ctx.fillRect(0,0,128,128);
    for(let i=0;i<2200;i++) {
      const v=100+hash(i,2,this.seed)*120;
      ctx.fillStyle=`rgba(${v},${v},${v},${surface==='carpet'?.3:.12})`;
      ctx.fillRect(hash(i,3,this.seed)*128,hash(i,4,this.seed)*128,surface==='stone'?3:1,2);
    }
    if(surface==='tile'||surface==='stone') {ctx.strokeStyle=surface==='tile'?'#686e66':'#92958a'; ctx.lineWidth=surface==='tile'?2:.6; ctx.strokeRect(0,0,128,128);}
    if(surface==='water') {
      ctx.strokeStyle='#9be4df';ctx.lineWidth=1;
      for(let i=0;i<8;i++){ctx.beginPath();for(let x=0;x<=128;x++) {const y=i*18+Math.sin(x*.049+i)*7; if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
    }
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(surface==='tile'?24:12,surface==='tile'?24:12);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
    this.textures.push(t);return t;
  }
  private boxes(group: THREE.Group, boxes: BoxSpec[], materials: Materials) {
    const matrix=new THREE.Matrix4(), position=new THREE.Vector3(), scale=new THREE.Vector3(), rotation=new THREE.Quaternion();
    for(const name of Object.keys(materials) as MaterialKey[]) {
      const batch=boxes.filter(b=>b.material===name);if(!batch.length)continue;
      const mesh=new THREE.InstancedMesh(this.box,materials[name],batch.length);
      batch.forEach((b,i)=>{position.set(b.x,b.y,b.z);scale.set(b.w,b.h,b.d);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix);});
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);
    }
  }
  private shape(group:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number) {
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);group.add(mesh);return mesh;
  }
  private sign(group:THREE.Group,text:string,sub:string,x:number,y:number,z:number,width:number,turn=0) {
    const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;
    ctx.fillStyle='#142827';ctx.fillRect(0,0,512,128);ctx.fillStyle='#c8eddb';ctx.font='24px monospace';ctx.fillText(sub,20,35);ctx.font='bold 36px monospace';ctx.fillText(text,20,90,472);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshBasicMaterial({map:texture});
    const mesh=this.shape(group,this.plane,material,x,y,z,width,width/4,1);mesh.rotation.y=turn;
    (group.userData.disposables as (THREE.Texture|THREE.Material)[]).push(texture,material);
  }
  private create(x:number,z:number) {
    const plan=roomPlan(x,z,this.seed), g=new THREE.Group(), m=this.palettes[plan.index], h=plan.place.height;
    g.position.set(x*ROOM,0,z*ROOM);g.userData.disposables=[];
    g.userData.colliders=plan.boxes.filter(b=>b.solid&&b.y-b.h/2<1.9&&b.y+b.h/2>.1);
    const boxes:BoxSpec[]=[...plan.boxes,

      {x:0,y:h+.1,z:0,w:32,h:.2,d:32,material:'ceiling',solid:false},
    ];
    if(plan.shaft) {
      const {x:sx,z:sz,liftX,liftZ}=plan.shaft,half=1.25;
      for(const [px,pz,w,d] of [[(-16+sx-half)/2,0,sx-half+16,32],[(sx+half+16)/2,0,16-sx-half,32],[sx,(-16+sz-half)/2,half*2,sz-half+16],[sx,(sz+half+16)/2,half*2,16-sz-half]])
        boxes.push({x:px,y:-.15,z:pz,w,h:.3,d,material:'floor',solid:false});
      // A visible shaft with repeated landings suggests the floors below, without streaming them.
      for(let floor=1;floor<=3;floor++) {
        const y=-floor*3.4;
        for(const side of [-1,1]) {
          boxes.push({x:sx+side*1.45,y:y+1.5,z:sz,w:.3,h:3.4,d:2.8,material:'wall',solid:false});
          boxes.push({x:sx,y:y+1.5,z:sz+side*1.45,w:2.8,h:3.4,d:.3,material:'wall',solid:false});
          boxes.push({x:sx,y:y+.25,z:sz+side*1.24,w:2.4,h:.1,d:.14,material:'light',solid:false});
          boxes.push({x:sx,y:y+1.3,z:sz+side*1.28,w:.85,h:2.2,d:.04,material:'dark',solid:false});
        }
      }
      boxes.push({x:sx,y:-10.8,z:sz,w:2.5,h:.1,d:2.5,material:'dark',solid:false});
      for(const side of [-1,1]) {
        boxes.push({x:sx+side*1.3,y:.015,z:sz,w:.1,h:.03,d:2.7,material:'trim',solid:false});
        boxes.push({x:sx,y:.015,z:sz+side*1.3,w:2.7,h:.03,d:.1,material:'trim',solid:false});
      }
      boxes.push({x:liftX,y:.02,z:liftZ,w:1.25,h:.04,d:1.8,material:this.level>0?'light':'trim',solid:false});
      this.sign(g,`DOWN / ${floorLabel(this.level+1)}`,this.level>0?`LIFT TO ${floorLabel(this.level-1)} / E`:'OPEN SHAFT',liftX,2.4,sz+1.7,2.2);
    } else boxes.push({x:0,y:-.15,z:0,w:32,h:.3,d:32,material:'floor',solid:false});
    // A fixed address and a directional destination at each threshold make revisiting legible.
    this.sign(g,plan.place.name,`${floorLabel(this.level)} / ${plan.id}`,7,2.3,-15.56,5.2);
    const north=describeRoom(x,z-1,this.seed), east=describeRoom(x+1,z,this.seed);
    this.sign(g,north.place.name,'NORTH / NEXT SPACE',passage(x,z,this.seed,0,-1).offset,Math.min(h-.6,3.5),-15.52,3.8);
    this.sign(g,east.place.name,'EAST / NEXT SPACE',15.52,Math.min(h-.6,3.5),passage(x,z,this.seed,1,0).offset,3.8,-Math.PI/2);
    if(plan.place.key==='concourse') {
      const clock=this.shape(g,this.ring,m.light,-7,3.4,-15.5,.9,.9,.9);
      this.shape(g,this.box,m.dark,-7,3.7,-15.46,.06,.6,.06);
      this.shape(g,this.box,m.dark,-6.8,3.4,-15.46,.4,.06,.06);clock.rotation.z=plan.variant*.2;
    }
    if(plan.place.key==='atrium') {
      for(let level=1;level<=3;level++)for(const side of [-1,1])for(let door=-10;door<=10;door+=5){
        boxes.push({x:door,y:level*3-.2,z:side*14,w:4.9,h:.2,d:2,material:'trim',solid:false});
        boxes.push({x:door,y:level*3+1,z:side*15.55,w:1.2,h:2.2,d:.06,material:'dark',solid:false});
        boxes.push({x:door,y:level*3+.7,z:side*13,w:4.9,h:.08,d:.06,material:'metal',solid:false});
      }
      const halo=this.shape(g,this.ring,m.light,0,9.4,0,5,5,5);halo.rotation.x=Math.PI/2;
      for(const sx of [-1,1])for(const sz of [-1,1]){
        const sculpture=this.shape(g,this.ring,m.art,sx*8,3.1,sz*8,1.4,1.4,1.4);sculpture.rotation.y=plan.variant*Math.PI/3;
      }
    }
    if(plan.place.key==='pool') {
      for(const sx of [-1,1]) {
        const arc=this.shape(g,this.ring,m.wall,sx*10,3.3,-15.45,2.8,2.8,.6);
        arc.scale.y=3.3;
      }
    }
    if(plan.place.key==='service') {
      for(let i=0;i<4;i++) {
        const pipe=this.shape(g,this.pipe,i===plan.variant?m.art:m.metal,-6+i*4,3.55,0,.24,31,.24);pipe.rotation.x=Math.PI/2;
      }
    }
    if(plan.place.key==='garden') {
      for(const sx of [-1,1])for(const sz of [-1,1]){
        this.shape(g,this.pipe,m.wood,sx*9,2.1,sz*9,.16,3,.16);
        for(let i=0;i<3;i++)this.shape(g,this.sphere,m.leaf,sx*9+(i-1)*1.2,3.5+i*.65,sz*9+Math.sin(i)*.6,1.8,1.2,1.6);
      }
      for(let i=-12;i<=12;i+=6) boxes.push({x:i,y:5,z:-15.53,w:4.8,h:3.5,d:.06,material:'screen',solid:false});
    }
    // Stable secondary landmarks: the same room type can have a different ceiling rhythm.
    if(plan.variant===1) for(const side of [-1,1]) boxes.push({x:side*4,y:h-.35,z:0,w:.18,h:.3,d:30,material:'trim',solid:false});
    if(plan.variant===2) for(const side of [-1,1]) boxes.push({x:0,y:h-.35,z:side*4,w:30,h:.3,d:.18,material:'trim',solid:false});
    this.boxes(g,boxes,m);return g;
  }
  setFloor(level:number) {
    if(level===this.level)return;
    for(const g of this.chunks.values())this.release(g);
    this.chunks.clear();this.lastArea='';this.level=level;this.seed=floorSeed(this.baseSeed,level);
  }
  update(px:number,pz:number,radius:number) {
    const cx=Math.round(px/ROOM),cz=Math.round(pz/ROOM),area=`${cx},${cz},${radius}`;
    if(area===this.lastArea)return;this.lastArea=area;
    for(const[key,g]of this.chunks){const[x,z]=key.split(',').map(Number);if(Math.abs(x-cx)>radius||Math.abs(z-cz)>radius){this.release(g);this.chunks.delete(key);}}
    for(let x=cx-radius;x<=cx+radius;x++)for(let z=cz-radius;z<=cz+radius;z++){const key=`${x},${z}`;if(this.chunks.has(key))continue;const g=this.create(x,z);this.chunks.set(key,g);this.scene.add(g);}
  }
  ambience(px:number,pz:number,dt:number,motion:boolean) {
    const p=describeRoom(Math.round(px/ROOM),Math.round(pz/ROOM),this.seed).place;
    const color=new THREE.Color(p.fog),blend=1-Math.exp(-dt*1.5);
    (this.scene.background as THREE.Color).lerp(color,blend);(this.scene.fog as THREE.FogExp2).color.lerp(color,blend);
    (this.scene.fog as THREE.FogExp2).density=THREE.MathUtils.lerp((this.scene.fog as THREE.FogExp2).density,p.height>7?.016:.026,blend);
    if(motion){this.water.offset.x+=dt*.004;this.water.offset.y+=dt*.002;}
  }
  blocked(x:number,z:number) {
    const cx=Math.round(x/ROOM),cz=Math.round(z/ROOM);
    const colliders:BoxSpec[]=this.chunks.get(`${cx},${cz}`)?.userData.colliders??roomPlan(cx,cz,this.seed).boxes.filter(b=>b.solid&&b.y-b.h/2<1.9&&b.y+b.h/2>.1);
    return colliders.some(b=>Math.abs(x-cx*ROOM-b.x)<b.w/2+.35&&Math.abs(z-cz*ROOM-b.z)<b.d/2+.35);
  }
  private release(g:THREE.Group){this.scene.remove(g);g.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});for(const resource of g.userData.disposables)resource.dispose();}
  dispose(){for(const g of this.chunks.values())this.release(g);this.chunks.clear();for(const m of this.palettes)for(const material of Object.values(m))material.dispose();for(const t of this.textures)t.dispose();this.box.dispose();this.plane.dispose();this.ring.dispose();this.sphere.dispose();this.pipe.dispose();}
}
