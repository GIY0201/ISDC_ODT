// Presentation state only; original topology/catalog and original storage key are reused.
import {LINKS,MODES,TRANSPORTS,STORAGE_KEY,loadSettings,saveSettings,resolveLink,evaluateLinks,probeTargets} from './topology.js';
const copy=v=>JSON.parse(JSON.stringify(v));
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function createSourceSettingsController({storage,probe,onChange=()=>{}}={}){
 if(typeof probe!=='function')throw TypeError('explicit integration probe port required');
 let settings={mode:MODES[0].id,links:{}},probes={},checkedAt=null,error='',external=false,dirty=false,generation=0,busy=false,dead=false,valid=true;
 const invalidate=()=>{generation++;probes={};checkedAt=null;};
 const changed=()=>onChange(snapshot());
 const snapshot=()=>copy({settings,probes,checkedAt,error,external,dirty,busy});
 const requireCurrent=()=>{if(dead)throw Error('설정 창이 종료되었습니다.');if(external)throw Error('다른 창의 변경을 명시적으로 다시 불러오세요.');if(!valid)throw Error(error);};
 function validLink(value){
  if(!object(value)||!TRANSPORTS.includes(value.transport)||typeof value.host!=='string'||value.host.length>253||/[\s/@?#\\]/.test(value.host))throw Error('전송 방식과 호스트를 확인하세요.');
  const integer=v=>typeof v==='number'?Number.isInteger(v):/^\d+$/.test(String(v));
  if(!integer(value.port)||Number(value.port)<0||Number(value.port)>65535)throw Error('포트는 0~65535 정수여야 합니다.');
  const positive=v=>String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>0;
  if(!positive(value.heartbeat)||!positive(value.timeout))throw Error('하트비트와 제한 시간은 양의 초 단위 숫자여야 합니다.');
  if(typeof value.enabled!=='boolean'||typeof value.reconnect!=='boolean')throw Error('연결 옵션을 확인하세요.');
  return {...value,port:Number(value.port),heartbeat:Number(value.heartbeat),timeout:Number(value.timeout)};
 }
 function load(){
  invalidate();external=false;dirty=false;error='';valid=true;
  try{const raw=storage?.getItem(STORAGE_KEY);if(raw){const parsed=JSON.parse(raw);if(!object(parsed)||!MODES.some(m=>m.id===parsed.mode)||!object(parsed.links))throw Error('저장 설정의 형식을 확인하세요.');for(const link of LINKS)if(Object.hasOwn(parsed.links,link.id))validLink(resolveLink(link,parsed.links));}settings=loadSettings(storage);}
  catch(e){valid=false;error=String(e.message);}changed();return valid;
 }
 function setMode(mode){requireCurrent();if(!MODES.some(m=>m.id===mode))throw Error('운용 모드를 확인하세요.');settings.mode=mode;dirty=true;invalidate();changed();}
 function editLink(id,value){requireCurrent();if(!LINKS.some(l=>l.id===id))throw Error('등록되지 않은 연결입니다.');settings.links[id]=validLink(value);dirty=true;invalidate();changed();}
 function resetLink(id){requireCurrent();if(!LINKS.some(l=>l.id===id))throw Error('등록되지 않은 연결입니다.');delete settings.links[id];dirty=true;invalidate();changed();}
 function save(){requireCurrent();if(!storage?.setItem||!saveSettings(storage,settings))throw Error('설정 저장에 실패했습니다.');dirty=false;invalidate();changed();}
 async function runProbe({only=null,signal}={}){
  requireCurrent();if(dirty)throw Error('편집 설정을 먼저 저장하세요.');if(busy)throw Error('연결 확인이 진행 중입니다.');
  const targets=probeTargets(evaluateLinks({mode:settings.mode,overrides:settings.links,health:{probes:{}}})).filter(t=>!only||t.id===only);
  if(only&&!targets.length)throw Error('선택 링크는 현재 모드의 직접 진단 대상이 아닙니다. 콘솔 소켓이나 경유 링크 상태를 확인하세요.');
  const token=generation;busy=true;error='';changed();
  try{
   const response=await probe({links:copy(targets)},{signal});if(dead||generation!==token)return null;
   if(!object(response)||!object(response.results)||typeof response.checked_at!=='string'||!Number.isFinite(Date.parse(response.checked_at))||Object.keys(response.results).length!==targets.length||targets.some(t=>!object(response.results[t.id])||!['up','down','unverified'].includes(response.results[t.id].state)||!['in-process','tcp-connect','udp-resolve','not-configured'].includes(response.results[t.id].method)||typeof response.results[t.id].detail!=='string'))throw Error('연결 확인 응답의 ID·시각·근거를 확인할 수 없습니다.');
   probes={...probes,...copy(response.results)};checkedAt=response.checked_at;return copy(response);
  }catch(e){if(!dead&&generation===token){probes={};checkedAt=null;error=String(e.message);}throw e;}
  finally{busy=false;if(!dead)changed();}
 }
 function storageChanged(){external=true;invalidate();changed();}
 return Object.freeze({load,snapshot,setMode,editLink,resetLink,save,probe:runProbe,storageChanged,evaluations:(socket=null)=>evaluateLinks({mode:settings.mode,overrides:settings.links,health:{probes,socket}}),destroy(){dead=true;invalidate();}});
}
