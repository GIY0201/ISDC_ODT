// Offline source execution only. No reference imports are used by the product.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const SOURCES={
  'digital_twin/simulation/browser/satellite_dynamics.js':'5580263519e45f6b3e1f7d2a5dbceae097d99d6949f8190ce8c87fe2145f6eb5',
  'digital_twin/simulation/browser/oisl.js':'7f781056f135f9a0660040ed0091ee5e4f53e2dd45b89351f7848d99a97ee536',
  'project_support/tests/browser/oisl.test.mjs':'43d42dac22ac4aa59e9d4a0305e9c4f4658936b77b9fb9e7be8b5a8027dd728e',
};
export const T0=Date.UTC(2026,8,7);
export const terminal={max_range_km:5000,min_range_km:30,slew_rate_deg_s:2,acquisition_time_s:20,jitter_deg:0.002,field_of_regard:{azimuth_half_angle:180,elevation:[-20,90]}};

export function trace(oisl,states){
  const rows=[];
  const roles=['fore','aft','left','right','auto','nadir','unknown','toString'];
  for(const [ownerKey,owner] of Object.entries(states))for(const [targetKey,target] of Object.entries(states))for(const role of roles){
    rows.push({operation:'geometry',ownerKey,targetKey,role,result:oisl.linkGeometry(owner,target,terminal,role)});
  }
  const candidates=Object.entries(states).map(([id,state])=>({id,state}));
  for(const role of roles)for(const excluded of [[],['20/0','-20/0'],Object.keys(states)]){
    rows.push({operation:'selection',role,excluded,result:oisl.chooseTarget(states['0/0'],candidates,terminal,role,new Set(excluded))});
  }
  for(const range of [0,1,30,500,5000,10000,-1])rows.push({operation:'margin',range,result:oisl.linkMargin(range,terminal)});
  for(const a of [null,...oisl.OISL_PHASES])for(const b of [null,...oisl.OISL_PHASES])rows.push({operation:'pair',a,b,result:oisl.pairState(a,b)});
  for(const angle of [-1080,-540,-181,-180,-179,0,179,180,181,540,1080])rows.push({operation:'wrap',angle,result:oisl.wrap180(angle)});
  const geometry={feasible:true,blockedBy:null,gimbal:{azimuth:20,elevation:-10,reachable:true}};
  let state=oisl.createTerminalState();
  const steps=[
    [0,'B',geometry],[5000,'B',geometry],[12000,'B',geometry],[40000,'B',geometry],
    [41000,'C',{...geometry,gimbal:{azimuth:-60,elevation:0,reachable:true}}],
    [42000,'C',{...geometry,feasible:false,blockedBy:'earth'}],
    [43000,'C',geometry],[100000,'C',geometry],[1000,'C',geometry],[2000,null,null],
  ];
  for(const [offset,target,g] of steps){
    state=oisl.advanceTerminal(state,terminal,target?{targetId:target}:null,g,new Date(T0+offset));
    rows.push({operation:'advance',offset,state:structuredClone(state),progress:oisl.acquisitionProgress(state,terminal,T0+offset)});
  }
  for(const phase of [null,...oisl.OISL_PHASES,'locked','one_way','none','custom'])rows.push({operation:'phaseLabel',phase,result:oisl.phaseLabel(phase)});
  for(const reason of [null,'earth','range','field_of_regard','unknown'])rows.push({operation:'blockedLabel',reason,result:oisl.blockedLabel(reason)});
  return rows;
}

async function main(root,output){
  const raw={};
  for(const [name,sha] of Object.entries(SOURCES)){
    raw[name]=await readFile(path.join(root,name));
    if(createHash('sha256').update(raw[name]).digest('hex')!==sha)throw new Error(`source hash mismatch: ${name}`);
  }
  const dynamics=await import(`data:text/javascript;base64,${raw['digital_twin/simulation/browser/satellite_dynamics.js'].toString('base64')}`);
  const oisl=await import(`data:text/javascript;base64,${raw['digital_twin/simulation/browser/oisl.js'].toString('base64')}`);
  const states={};
  for(const [mean,raan] of [[0,0],[30,0],[-30,0],[20,0],[35,0],[-20,0],[180,0],[60,0],[0,20],[0,-20],[0,15]]){
    states[`${mean}/${raan}`]=dynamics.nodeStateAt({altitude_km:550,inclination:53,raan,mean_anomaly:mean,epoch:T0},T0);
  }
  const receipt={source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',source_hashes:SOURCES,
    evidence:'Original optical equations executed on captured original epoch states; engineering model component evidence, no live native/browser/actual optical link claim',states,rows:trace(oisl,states)};
  const bytes=Buffer.from(JSON.stringify(receipt,null,2)+'\n');await writeFile(output,bytes);
  process.stdout.write(JSON.stringify({bytes:bytes.length,rows:receipt.rows.length,sha256:createHash('sha256').update(bytes).digest('hex')})+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main(...process.argv.slice(2));
