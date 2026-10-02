import type { Topology } from '../ir';
import { draftQuest } from '../quest';

/** Fictional station-front block. Coordinates are metres; no real address is encoded. */
export const sampleTown: Topology = {
  id:'sample-town', name:'Sample Town', seed:20261002, spawn:'station',
  nodes:[
    {id:'station',kind:'station',name:'STATION',ja:'駅',x:0,z:0},
    {id:'crossing',kind:'intersection',name:'CROSSING',ja:'交差点',x:80,z:0},
    {id:'konbini',kind:'convenience',name:'CONVENIENCE',ja:'コンビニ',x:160,z:0},
    {id:'library',kind:'library',name:'LIBRARY',ja:'図書館',x:80,z:-80},
    {id:'park',kind:'park',name:'PARK',ja:'公園',x:80,z:160},
    {id:'shrine',kind:'shrine',name:'SHRINE',ja:'神社',x:240,z:160},
    {id:'tower',kind:'landmark',name:'TOWER',ja:'塔',x:-80,z:-80},
    {id:'arcade',kind:'convenience',name:'ARCADE',ja:'商店街',x:-80,z:0},
    {id:'plaza',kind:'intersection',name:'PLAZA',ja:'広場',x:-80,z:80},
    {id:'annex',kind:'library',name:'ANNEX',ja:'分館',x:-160,z:80},
  ],
  edges:[
    {from:'station',to:'crossing'},{from:'crossing',to:'konbini'},{from:'crossing',to:'library'},
    {from:'crossing',to:'park'},{from:'park',to:'shrine'},{from:'station',to:'arcade'},
    {from:'arcade',to:'tower'},{from:'arcade',to:'plaza'},{from:'plaza',to:'annex'},
  ],
};

export const sampleQuest = () => draftQuest('first-signal','Carry the signal','信号を運ぶ',[
  {anchor:'konbini',title:'Pick up the signal at the convenience store',ja:'コンビニで信号を拾う'},
  {anchor:'station',title:'Bring it back to the station',ja:'駅へ持ち帰る'},
]);
