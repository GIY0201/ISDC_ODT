/** Presentation-only section navigation. Mounted controls and their owners stay in place. */
export function createWorkWindowLayout({screen,navigation,windowElement,host=window,onResize=()=>{}}){
 if(!screen||!navigation||!windowElement)throw TypeError('work window layout elements required');
 let dead=false,view='',items=[],signature='';const choices=new Map(),marked=new Set();
 function reconcile(){
  if(dead)return;
  items=[...screen.children].filter(el=>el.id!=='source-scenario-dock'&&!el.hidden&&(el.classList.contains('panel')||el.classList.contains('view')));
  for(const item of marked)if(!items.includes(item)){delete item.dataset.workSection;delete item.dataset.workSectionHidden;marked.delete(item);}
  for(const item of items){if(!item.id)item.id=`work-overview-${view}`;item.dataset.workSection='true';marked.add(item);}
  const selected=items.find(item=>item.id===choices.get(view))??items[0];if(selected)choices.set(view,selected.id);
  for(const item of items)item.dataset.workSectionHidden=String(item!==selected);
  screen.dataset.workLayout=view==='wall'?'wall':'sections';windowElement.dataset.workLayout='true';
  const labels=items.map(item=>[item.id,item.querySelector('h1, header h2, .panel-title')?.textContent?.trim()||item.getAttribute?.('aria-label')||item.id]);
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
