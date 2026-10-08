// Browser cache and recoverable edits; server revisions are authoritative when enabled.
const keys=Object.freeze({'spacetwin-ground-stations-v1':'ground_stations','isdc-test-scenario-drafts-v1':'scenario_drafts'});
export function createWorkspaceConfigurationStorage({storage,fetchImpl,onChange=()=>{},onRestore=()=>{}}){
 let state='loading',enabled=false,error='',chain=Promise.resolve(),pending=0,dirty=false;
 const revisions=new Map();
 const snapshot=()=>({state,enabled,error,pending});
 const notify=()=>onChange(snapshot());
 async function request(kind,body){const response=await fetchImpl('/api/workspace/configurations/'+kind,{cache:'no-store',...(body?{method:'PUT',headers:{'Content-Type':'application/json','X-ISDC-Configuration':'1'},body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok)throw Error(value.detail||'서버 DB 저장 실패');return value;}
 function queue(kind,key,encoded){pending++;state='saving';notify();chain=chain.then(async()=>{if(error)throw Error(error);const receipt=await request(kind,{expected_revision:revisions.get(kind)??0,value:JSON.parse(encoded)});revisions.set(kind,receipt.revision);}).catch(e=>{error=e.message;state='error';}).finally(()=>{pending--;if(!error)state=pending?'saving':'saved';notify();});}
 async function start(){try{const response=await fetchImpl('/api/workspace/configurations/status',{cache:'no-store'});if(!response.ok){state='disabled';notify();return;}const status=await response.json();enabled=status.enabled===true;if(!enabled){state='disabled';notify();return;}
  const receipts=await Promise.all(Object.entries(keys).map(async([key,kind])=>[key,kind,await request(kind)]));
  if(dirty)throw Error('DB를 불러오는 동안 편집했습니다. 작성 내용을 백업한 뒤 새로고침하세요.');
  for(const [key,kind,receipt]of receipts){const raw=storage.getItem(key);revisions.set(kind,receipt.revision);if(raw!==null&&storage.getItem(key+'.before-postgresql')===null)storage.setItem(key+'.before-postgresql',raw);if(receipt.value!==null)storage.setItem(key,JSON.stringify(receipt.value));else if(raw!==null)queue(kind,key,raw);}
  if(!pending)state='saved';onRestore();notify();await chain;
 }catch(e){error=e.message;state='error';notify();}}
 return {getItem:key=>storage.getItem(key),setItem(key,value){if(Object.hasOwn(keys,key)){if(enabled&&error)throw Error(error);storage.setItem(key+'.pending-postgresql',value);storage.setItem(key,value);if(state==='loading')dirty=true;if(enabled)queue(keys[key],key,value);}else storage.setItem(key,value);},start,snapshot,flush:()=>chain};
}

export function configurationStatusText(s){return s.state==='loading'?'서버 DB 불러오는 중':s.state==='disabled'?'이 브라우저에 저장됨 / 서버 DB 미연결':s.state==='saving'?'서버 DB 저장 중 / 창을 닫지 마세요':s.state==='error'?'서버 DB 저장 실패: '+s.error+' / 로컬 작성 내용은 보존됨':'서버 DB 저장 완료';}
