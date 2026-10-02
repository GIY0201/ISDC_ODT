/** Read-only display projection. Server commands and propagation live elsewhere. */
export function projectUtc(snapshot,receivedAtMs,nowMs,advanceUtc){
  if(!snapshot?.current_utc)return null;
  if(!snapshot.playing)return snapshot.current_utc;
  if(![receivedAtMs,nowMs,snapshot.play_rate].every(Number.isFinite)||snapshot.play_rate<.1||snapshot.play_rate>60)throw new Error('invalid playback clock');
  return advanceUtc(snapshot.current_utc,Math.max(0,nowMs-receivedAtMs)/1000*snapshot.play_rate);
}
const valid=row=>row?.status==='valid'&&Array.isArray(row.position_m)&&row.position_m.length===3&&row.position_m.every(Number.isFinite)&&Number.isFinite(row.elevation_deg);
export function createSampleBuffer(rows,secondsBetween){
  if(!Array.isArray(rows)||!rows.length)return {sampleAt:()=>null};
  const copied=structuredClone(rows),origin=copied[0].utc;
  let times;
  try{times=copied.map(row=>secondsBetween(row.utc,origin));}catch{return {sampleAt:()=>null};}
  if(times.some((time,i)=>!Number.isFinite(time)||i>0&&time<=times[i-1]))return {sampleAt:()=>null};
  return {sampleAt(utc){
    let target;try{target=secondsBetween(utc,origin);}catch{return null;}
    if(!Number.isFinite(target)||target<times[0]||target>times.at(-1))return null;
    let left=0,right=times.length-1;
    while(left<right){const mid=(left+right)>>1;if(times[mid]<target)left=mid+1;else right=mid;}
    if(times[left]===target)return valid(copied[left])?structuredClone({...copied[left],utc}):null;
    const a=copied[left-1],b=copied[left],span=times[left]-times[left-1];
    if(!valid(a)||!valid(b)||span>1.000000001)return null;
    const fraction=(target-times[left-1])/span;
    return {utc,status:'valid',error_code:null,position_m:a.position_m.map((v,i)=>v+(b.position_m[i]-v)*fraction),elevation_deg:a.elevation_deg+(b.elevation_deg-a.elevation_deg)*fraction};
  }};
}
export function interpolateSample(rows,utc,secondsBetween){return createSampleBuffer(rows,secondsBetween).sampleAt(utc);}
