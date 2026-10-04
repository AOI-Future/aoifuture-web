import { classify,project,type GeoSnapshot } from '../backside/reality';
const NS='http://www.w3.org/2000/svg';
export const READING:Record<string,string>={station:'駅 → 待合室',convenience:'コンビニ → 信号回収室',park:'公園 → 温室',shrine:'神社 → 静水の間',library:'図書館 → 書架',landmark:'名所 → 展示室',intersection:'交差点 → 吹き抜け'};
/** A source-data diagram, not OSM raster tiles or a faithful 3D replica. All labels use textContent. */
export function renderSourceMap(svg:SVGSVGElement,snapshot:GeoSnapshot) {
  svg.replaceChildren();const r=snapshot.area.radius;svg.setAttribute('viewBox',`${-r} ${-r} ${r*2} ${r*2}`);
  const nodes=new Map(snapshot.nodes.map(n=>[n.id,n]));
  function append(tag:string,attrs:Record<string,string>,label?:string){const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(label)e.textContent=label;svg.append(e);}
  for(const way of snapshot.ways.filter(w=>w.tags.highway)){
    const points=way.nodes.map(id=>nodes.get(id)).filter(n=>!!n).map(n=>project(n!.lat,n!.lon,snapshot.area)).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z));
    if(points.length>1)append('polyline',{points:points.map(p=>`${p.x},${p.z}`).join(' '),fill:'none',stroke:'#668888','stroke-width':'5'});
  }
  const places=[...snapshot.nodes];
  for(const w of snapshot.ways){
    if(!classify(w.tags))continue;
    const pts=w.nodes.map(id=>nodes.get(id)).filter(n=>!!n);
    const center=w.center??(pts.length?{lat:pts.reduce((s,n)=>s+n!.lat,0)/pts.length,lon:pts.reduce((s,n)=>s+n!.lon,0)/pts.length}:undefined);
    if(center)places.push({id:`way:${w.id}`,...center,tags:w.tags});
  }
  for(const n of places){const kind=classify(n.tags);if(!kind)continue;const p=project(n.lat,n.lon,snapshot.area);if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||Math.hypot(p.x,p.z)>r)continue;
    append('circle',{cx:String(p.x),cy:String(p.z),r:'9',fill:'#00ffff'});
    append('text',{x:String(p.x+12),y:String(p.z-10),fill:'#fff','font-size':'40'},READING[kind]?.split(' → ')[0]??kind);
  }
  append('circle',{cx:'0',cy:'0',r:String(r-3),fill:'none',stroke:'#baffff','stroke-width':'3','stroke-dasharray':'12 8'});
}
