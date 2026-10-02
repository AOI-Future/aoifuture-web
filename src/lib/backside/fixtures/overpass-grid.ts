/** Fictional Overpass-shaped response: a 4x4 street grid, a detached island and a handful of tagged places. Not real data. */
import type { OverpassResponse } from '../providers/overpass';

export const gridArea = { id:'grid-fixture', name:'GRID FIXTURE', lat:35, lon:135, radius:420 };
const DLAT=150/111195, DLON=150/(111195*Math.cos(35*Math.PI/180));
const at=(r:number,c:number)=>({lat:gridArea.lat-(r-1.5)*DLAT, lon:gridArea.lon+(c-1.5)*DLON});
const nid=(r:number,c:number)=>1000+r*10+c;

export function gridResponse():OverpassResponse {
  const elements:OverpassResponse['elements']=[];
  for(let r=0;r<4;r++) for(let c=0;c<4;c++) elements.push({type:'node',id:nid(r,c),...at(r,c)});
  // Mid-block nodes are shape points, not junctions, and must be contracted away.
  for(let r=0;r<4;r++) elements.push({type:'node',id:2000+r,...at(r,.5)});
  for(let r=0;r<4;r++) elements.push({type:'way',id:100+r,nodes:[nid(r,0),2000+r,nid(r,1),nid(r,2),nid(r,3)],tags:{highway:'residential',name:'Fictional Row'}});
  for(let c=0;c<4;c++) elements.push({type:'way',id:200+c,nodes:[0,1,2,3].map(r=>nid(r,c)),tags:{highway:'tertiary',name:'Fictional Column'}});
  // Footpaths do not count as streets.
  elements.push({type:'way',id:300,nodes:[nid(0,0),nid(1,1)],tags:{highway:'footway'}});
  // A crossing inside the radius that no street joins to the grid.
  elements.push({type:'node',id:5000,...at(-0.9,3.2)},{type:'node',id:5001,...at(-0.9,2.9)},{type:'node',id:5002,...at(-1.2,3.2)});
  elements.push({type:'way',id:400,nodes:[5001,5000],tags:{highway:'residential'}},{type:'way',id:401,nodes:[5002,5000],tags:{highway:'residential'}});
  const poi=(id:number,r:number,c:number,tags:Record<string,string>)=>elements.push({type:'node',id,...at(r,c),tags:{name:`Fictional ${id}`,...tags}});
  poi(9001,1.3,1.4,{railway:'station'});
  poi(9002,2.2,0.2,{shop:'convenience'});
  poi(9003,0.2,2.8,{amenity:'place_of_worship',religion:'shinto'});
  poi(9004,2.8,2.2,{amenity:'library'});
  poi(9005,1.6,2.6,{historic:'memorial'});
  poi(9006,1.1,0.9,{amenity:'cafe'});
  poi(9007,8,8,{shop:'convenience'});
  // An area feature carries its centre from `out center`.
  elements.push({type:'way',id:600,nodes:[nid(2,2),nid(2,3),nid(3,3),nid(3,2),nid(2,2)],tags:{leisure:'park',name:'Fictional Park'},center:at(2.5,2.5)});
  // Overpass repeats tagged nodes as skeletons after `>;`.
  elements.push({type:'node',id:9001,...at(1.3,1.4)});
  return {osm3s:{timestamp_osm_base:'2026-01-01T00:00:00Z'},elements};
}
