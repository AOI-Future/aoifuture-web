/** Bearing relative to the player's view: zero ahead, positive right (CSS rotation and stereo pan).
 * Three.js camera forward is (-sin(yaw), -cos(yaw)) on the x/z plane. */
export function relativeBearing(yaw:number,from:{x:number;z:number},to:{x:number;z:number}):number {
  const dx=to.x-from.x,dz=to.z-from.z;
  if(dx===0&&dz===0) return 0;
  const angle=yaw+Math.atan2(dx,-dz);
  return Math.atan2(Math.sin(angle),Math.cos(angle));
}
