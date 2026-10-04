import {gridArea,gridResponse} from '../../src/lib/backside/fixtures/overpass-grid';
import {LIVE_AREA,areaKey,query} from '../../src/lib/localquest/live-geography';
/** Synthetic fixture shifted to the fixed trial origin, never real OSM data. */
export function liveFixture(){
  const raw=gridResponse();
  for(const e of raw.elements){
    if(e.type==='node'){e.lat+=LIVE_AREA.lat-gridArea.lat;e.lon+=LIVE_AREA.lon-gridArea.lon;}
    else if(e.center){e.center.lat+=LIVE_AREA.lat-gridArea.lat;e.center.lon+=LIVE_AREA.lon-gridArea.lon;}
  }
  return {...raw,aoiArea:areaKey,aoiQuery:query};
}
