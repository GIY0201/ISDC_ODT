/** Presentation-only section navigation. Mounted controls and their owners stay in place. */
const sectionNames={
 'catalog-workspace':'위성 찾기','catalog-time':'실시간 및 시각별 분석','satellite-nodes':'위성군 구성',
 'stored-orbit':'저장 궤도 분석','orbit-radio':'저장 궤도 거리·도플러',
 'ground-node-network':'지상국 구성','catalog-passes':'선택 위성의 가시 시간',
 'ground-visibility':'저장 궤도 가시 구간','orbit-radio-series':'저장 궤도 구간 분석',
 'communication-planning':'시나리오 통신 계획','rf-link-budget':'RF 링크 계산'
};
const sectionOrder={satellite:['catalog-workspace','catalog-time','satellite-nodes','stored-orbit','orbit-radio']};
export function createWorkWindowLayout({screen,navigation,windowElement,host=window,onResize=()=>{}}){
 if(!screen||!navigation||!windowElement)throw TypeError('work window layout elements required');
 let dead=false,view='',items=[],signature='';const choices=new Map(),marked=new Set();
 function reconcile(){
  if(dead)return;
  items=[...screen.children].filter(el=>el.id!=='source-scenario-dock'&&!el.hidden&&(el.classList.contains('panel')||el.classList.contains('view')));
  const order=sectionOrder[view];if(order)items.sort((a,b)=>(order.includes(a.id)?order.indexOf(a.id):order.length)-(order.includes(b.id)?order.indexOf(b.id):order.length));
  for(const item of marked)if(!items.includes(item)){delete item.dataset.workSection;delete item.dataset.workSectionHidden;marked.delete(item);}
  for(const item of items){if(!item.id)item.id=`work-overview-${view}`;item.dataset.workSection='true';marked.add(item);}
  const selected=items.find(item=>item.id===choices.get(view))??items[0];if(selected)choices.set(view,selected.id);
  for(const item of items)item.dataset.workSectionHidden=String(item!==selected);
  screen.dataset.workLayout=view==='wall'?'wall':'sections';windowElement.dataset.workLayout='true';
  const labels=items.map(item=>[item.id,sectionNames[item.id]||item.querySelector('h1, header h2, .panel-title')?.textContent?.trim()||item.getAttribute?.('aria-label')||item.id]);
  const next=JSON.stringify(labels);
  if(next!==signature){signature=next;const buttons=labels.map(([id,label])=>{const button=navigation.ownerDocument.createElement('button');button.type='button';button.dataset.workSectionTarget=id;button.textContent=label;button.setAttribute('aria-controls',id);return button;});navigation.replaceChildren(...buttons);}
  for(const button of navigation.children){button.setAttribute('aria-pressed',String(button.dataset.workSectionTarget===selected?.id));}
  navigation.hidden=view==='wall'||items.length<2;
  onResize();
 }
 const click=event=>{const button=event.target.closest?.('button[data-work-section-target]')??event.target;const id=button.dataset?.workSectionTarget;if(dead||!items.some(item=>item.id===id&&item.parentElement===screen))return;choices.set(view,id);reconcile();};
 navigation.addEventListener('click',click);
 const mutations=host.MutationObserver?new host.MutationObserver(reconcile):null;mutations?.observe(screen,{childList:true});
 const sizes=host.ResizeObserver?new host.ResizeObserver(()=>{if(!dead)onResize();}):null;sizes?.observe(windowElement);
 return{setView(value){if(dead)return;view=value;reconcile();},refresh:reconcile,destroy(){if(dead)return;dead=true;mutations?.disconnect();sizes?.disconnect();navigation.removeEventListener('click',click);navigation.replaceChildren();navigation.hidden=true;for(const item of marked){delete item.dataset.workSection;delete item.dataset.workSectionHidden;}delete screen.dataset.workLayout;delete windowElement.dataset.workLayout;items=[];marked.clear();choices.clear();}};
}
