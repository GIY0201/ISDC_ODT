// Derived from the frozen IERS leap snapshot used by Python; refuse different provenance.
export const LEAP_SHA256='6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7';
export const LEAP_OFFSETS=[[1972,1,10],[1972,7,11],[1973,1,12],[1974,1,13],[1975,1,14],[1976,1,15],[1977,1,16],[1978,1,17],[1979,1,18],[1980,1,19],[1981,7,20],[1982,7,21],[1983,7,22],[1985,7,23],[1988,1,24],[1990,1,25],[1991,1,26],[1992,7,27],[1993,7,28],[1994,7,29],[1996,1,30],[1997,7,31],[1999,1,32],[2006,1,33],[2009,1,34],[2012,7,35],[2015,7,36],[2017,1,37]];
const SECOND=1000000000n;
const offsets=LEAP_OFFSETS.map(([year,month,offset])=>({at:BigInt(Date.UTC(year,month-1,1))*1000000n,offset:BigInt(offset)}));
function parse(utc){
  const match=typeof utc==='string'&&utc.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,9}))?Z$/);
  if(!match)throw new Error('explicit UTC required');
  const [year,month,day,hour,minute,second]=match.slice(1,7).map(Number);
  const ms=Date.UTC(year,month-1,day,hour,minute,Math.min(second,59));
  const date=new Date(ms);
  if(second>60||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day||date.getUTCHours()!==hour||date.getUTCMinutes()!==minute)throw new Error('invalid UTC date');
  let nominal=BigInt(ms)*1000000n+BigInt((match[7]||'').padEnd(9,'0'));
  const previous=offsets.findLast(item=>item.at<=nominal);
  if(!previous)throw new Error('UTC before supported leap table');
  if(second===60){
    const boundary=BigInt(ms+1000)*1000000n;
    const next=offsets.find(item=>item.at===boundary&&item.offset===previous.offset+1n);
    if(hour!==23||minute!==59||!next)throw new Error('invalid UTC leap second');
    nominal+=SECOND;
  }
  return nominal+previous.offset*SECOND;
}
function format(tai){
  for(let i=1;i<offsets.length;i++){
    const next=offsets[i],old=offsets[i-1];const start=next.at+old.offset*SECOND;
    if(tai>=start&&tai<next.at+next.offset*SECOND)return new Date(Number(next.at/1000000n)-1000).toISOString().slice(0,17)+'60.'+(tai-start).toString().padStart(9,'0')+'Z';
  }
  const entry=offsets.findLast(item=>tai>=item.at+item.offset*SECOND);
  if(!entry)throw new Error('UTC before supported leap table');
  const nominal=tai-entry.offset*SECOND,whole=nominal/SECOND,fraction=nominal%SECOND;
  return new Date(Number(whole)*1000).toISOString().slice(0,19)+'.'+fraction.toString().padStart(9,'0')+'Z';
}
export function createUtcCodec(hash){
  if(hash!==LEAP_SHA256)throw new Error('UTC leap hash mismatch');
  // Exact immutable strings/BigInts only, bounded within this provenance-bound codec.
  // Invalid inputs never enter the cache; no rounded UTC or mutable caller object
  // can stand in for a validated instant.
  const instants=new Map(),limit=128;
  function remember(utc,tai,canonical){
    const value={tai,canonical};instants.set(utc,value);
    if(instants.size>limit)instants.delete(instants.keys().next().value);
    return value;
  }
  function instant(utc){
    if(typeof utc==='string'&&instants.has(utc))return instants.get(utc);
    const tai=parse(utc);return remember(utc,tai,format(tai));
  }
  return {advance(utc,seconds){
    if(!Number.isFinite(seconds))throw new Error('finite elapsed seconds required');
    const value=instant(utc),delta=BigInt(Math.round(seconds*1e9));
    if(delta===0n)return value.canonical;
    // Formatting may cross the supported four-digit input-year boundary.
    // Only parse-validated inputs can enter the cache, including our own output.
    return format(value.tai+delta);
  },difference:(a,b)=>Number(instant(a).tai-instant(b).tai)/1e9};
}
