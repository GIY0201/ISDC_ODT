import {performance} from 'node:perf_hooks';
import {createOrbitSelection} from '../../user_application/web/scripts/orbit_selection.js';
const result={};
for(const playing of [false,true]){
 const state={revision:1,input_id:'benchmark',input_hash:'hash',playing,play_rate:1,current_utc:'2026-10-07T00:00:00Z'};
 let observed=0,notifications=0,rowsCopied=0;
 const rows=Array.from({length:601},(_,i)=>({utc:new Date(Date.parse(state.current_utc)+i*1000).toISOString(),status:'valid',position_m:[7000000,i*100,1000],elevation_deg:10,velocity_m_s:[0,7000,0]}));
 const api={orbitInputs:async()=>({inputs:[{input_id:state.input_id}]}),orbitState:async()=>({...state,observed_monotonic_s:++observed}),orbitSamples:async p=>({...p,revision:1,input_hash:'hash',status:'complete',rows})};
 const client=createOrbitSelection(api,s=>{notifications++;rowsCopied+=s.result?.rows?.length??0;},()=> 'benchmark',()=>observed);
 await client.load();await client.samples();notifications=0;rowsCopied=0;
 const start=performance.now();for(let i=0;i<240;i++)await client.refresh();
 result[playing?'playing':'paused']={polls:240,notifications,rowsCopied,durationMs:performance.now()-start};client.destroy();
}
console.log(JSON.stringify(result,null,2));
