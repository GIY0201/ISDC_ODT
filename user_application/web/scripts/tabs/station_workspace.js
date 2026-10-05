import {stationCardModel,stationOptionMarkup} from '../orbit/station_card.js';
const copy=v=>structuredClone(v);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createStationSelection(sites,onSelect=()=>{},onFocus=()=>{},notify=()=>{}){
 const owned=copy(sites);let selectedKey=null,group='all',dead=false;
 const emit=()=>{if(!dead)notify();};
 return{snapshot:()=>({selected:copy(owned[selectedKey]??null),group}),
  choose(key){if(dead||typeof key!=='string'||!Object.hasOwn(owned,key))return;selectedKey=key;onSelect(key);onFocus(key);emit();},
  group(value){if(dead||value!=='all'&&!Object.values(owned).some(s=>s.group===value))return;group=value;emit();},
  clear(){if(dead)return;selectedKey=null;onSelect(null);emit();},
  focus(){if(!dead&&selectedKey)onFocus(selectedKey);},
  destroy(){if(dead)return;selectedKey=null;onSelect(null);dead=true;},
 };
}
export function createStationPanel(sites,groups,{select=()=>{},focus=()=>{},use=()=>{},useCatalog=()=>{}}={}){
 let view=null;const controller=createStationSelection(sites,select,focus,draw);
 function draw(){
  if(!['satellite','ground'].includes(view))return;
  const screen=document.getElementById('screen');let panel=document.getElementById('station-workspace');
  if(!panel){panel=document.createElement('section');panel.id='station-workspace';panel.className='panel';screen.prepend(panel);panel.innerHTML=`<header><h2>지상국 목록과 지구 선택</h2></header><div class="body"><p>선배 프로토타입의 대표 설정입니다. 실제 시설 좌표·높이·장비 사양과 수신 상태는 미확인입니다. 선택은 지구 표시만 바꾸며 저장 궤도와 가상 계산 지점은 유지합니다.</p><label>지상국 지역 <select id="station-region"></select></label><label>표시 지상국 <select id="station-select"></select></label><button class="button" id="station-focus">선택 지상국으로 이동</button> <button class="button" id="station-clear">지상국 선택 해제</button><button class="button" id="station-use">좌표·최소각을 계산 초안에 사용</button><button class="button" id="station-catalog-use">카탈로그 관측 초안에 사용</button><p id="station-status" role="status"></p><div id="station-detail"></div></div>`;
   panel.querySelector('#station-region').addEventListener('change',e=>controller.group(e.target.value));panel.querySelector('#station-select').addEventListener('change',e=>e.target.value?controller.choose(e.target.value):controller.clear());panel.querySelector('#station-clear').addEventListener('click',()=>controller.clear());panel.querySelector('#station-focus').addEventListener('click',()=>controller.focus());panel.querySelector('#station-catalog-use').addEventListener('click',()=>{const site=controller.snapshot().selected;if(site)useCatalog(site);});panel.querySelector('#station-use').addEventListener('click',()=>{const site=controller.snapshot().selected;if(site&&use(site)===false)panel.querySelector('#station-status').textContent='저장 궤도 입력을 먼저 선택하고 적용·계산 요청이 끝난 뒤 다시 가져오세요.';});
  }
  const s=controller.snapshot(),site=s.selected,node=id=>panel.querySelector('#'+id);
  const regionOptions=`<option value="all">모든 지역</option>`+groups.map(g=>`<option value="${escape(g.key)}">${escape(g.label)}</option>`).join('');if(node('station-region').innerHTML!==regionOptions)node('station-region').innerHTML=regionOptions;node('station-region').value=s.group;
  const filtered=groups.filter(g=>s.group==='all'||g.key===s.group);const outside=site&&!filtered.some(g=>g.sites.some(x=>x.key===site.key));
  const options=`<option value="">지상국 선택</option>`+(outside?`<option value="${escape(site.key)}">현재 선택 · ${escape(site.name)}</option>`:'')+stationOptionMarkup(filtered,site?.key);
  if(node('station-select').innerHTML!==options)node('station-select').innerHTML=options;node('station-select').value=site?.key??'';
  node('station-status').textContent=`목록 ${filtered.reduce((sum,g)=>sum+g.sites.length,0)} / 전체 ${Object.keys(sites).length}개 · ${site?`선택 ${site.name} (${site.key})`:'지상국 미선택'} · 지구의 지상국 표식으로도 선택할 수 있습니다.`;
  node('station-focus').disabled=!site;node('station-use').disabled=!site;node('station-catalog-use').disabled=!site;
  const card=stationCardModel(site);node('station-detail').innerHTML=card?`<h3>${escape(card.title)} · ${escape(card.subtitle)}</h3><p>${escape(card.kicker)} · 원본 대표 설정</p><dl>${card.facts.map(([key,value])=>`<dt>${escape(key==='고도'?'대표 프리셋 높이 · 실측 미확인':key)}</dt><dd>${escape(value)}</dd>`).join('')}</dl><p>자료 출처: 선배 프로토타입 고정 지상국 목록. 안테나·대역·최소 고각은 대표 설정입니다. 지도 선택만으로 계산 지점을 적용하지 않습니다. 계산 초안 버튼은 좌표·최소각만 가져오며 높이를 확인한 뒤 적용해야 합니다. 저장 궤도와 카탈로그 표시 위성은 별개입니다. 실제 수신 미확인.</p>`:'';
 }
 return{controller,show(next){view=next;draw();},update:draw,destroy:()=>controller.destroy()};
}
