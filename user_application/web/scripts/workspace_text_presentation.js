import {presentOperatorText} from './workspace_terminology.js';
// Display text only. Never rewrite original payloads, code, field values or IDs.
const ignored=new Set(['SCRIPT','STYLE','PRE','CODE','TEXTAREA']);
const clean=value=>String(value).trim()==='\u00b7'?' / ':presentOperatorText(String(value)).replace(/\s*\u00b7\s*/g,', ');
function excluded(node){for(let e=node.nodeType===1?node:node.parentElement;e;e=e.parentElement){if(ignored.has(e.tagName)||/cesium-credit/.test(e.getAttribute?.('class')??''))return true;}return false;}
export function installTextPresentation(root,host){
 let dead=false;
 function visit(node){
  if(dead||excluded(node))return;
  if(node.nodeType===3){const next=clean(node.data);if(next!==node.data)node.data=next;return;}
  if(node.nodeType!==1)return;
  if(node.tagName==='OPTION'&&!node.hasAttribute('value')){const value=node.value??node.textContent??[...node.childNodes].map(n=>n.data??'').join('');if(clean(value)!==value)node.setAttribute('value',value);}
  for(const name of ['title','aria-label','placeholder']){const value=node.getAttribute(name);if(value!=null&&clean(value)!==value)node.setAttribute(name,clean(value));}
  for(const child of [...node.childNodes])visit(child);
 }
 visit(root);
 const observer=host.MutationObserver?new host.MutationObserver(records=>{if(dead)return;for(const r of records){if(r.type==='childList')for(const node of r.addedNodes)visit(node);else visit(r.target);}}):null;
 observer?.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});
 return()=>{dead=true;observer?.disconnect();};
}

export function isSupplementalExplanation(node){
 return ['P','DIV','SMALL'].includes(node.tagName)&&!node.id&&!node.getAttribute('role')&&!node.closest('[hidden],details,[popover],pre,code,textarea,label,[role=alert],[role=status]')&&!node.querySelector('button,input,select,textarea,a,table,dl,svg,canvas')&&node.textContent.trim().length>=40&&!/오류|실패|확인하세요|먼저|동의|저장하지|실행 전/.test(node.textContent);
}

export function installExplanationDisclosure(root,host){
 let dead=false;
 function visit(node){
  if(dead||node.nodeType!==1||node.closest('.workspace-help-content'))return;
  const candidates=node.matches?.('p,.note,small')?[node]:[];
  candidates.push(...node.querySelectorAll('p,.note,small'));
  for(const item of candidates){
   if(!isSupplementalExplanation(item)||!item.parentElement)continue;
   const section=item.closest('.panel,.view')??root;
   const heading=[...section.querySelectorAll('h1,h2,h3')].filter(h=>h.compareDocumentPosition(item)&4).at(-1);
   if(!heading)continue;
   const doc=item.ownerDocument;let row=heading.closest('.workspace-help-heading');
   if(!row){row=doc.createElement('div');row.className='workspace-help-heading';heading.before(row);row.append(heading);}
   let button=row.querySelector('.workspace-help-button'),content=row.querySelector('.workspace-help-content');
   if(!button){button=doc.createElement('button');button.type='button';button.className='workspace-help-button';button.textContent='i';button.setAttribute('aria-label',heading.textContent.trim()+' 설명 보기');button.setAttribute('aria-expanded','false');content=doc.createElement('div');content.className='workspace-help-content';content.setAttribute('popover','auto');row.append(button,content);
    button.addEventListener('click',()=>{if(content.matches(':popover-open'))content.hidePopover();else{const r=button.getBoundingClientRect();content.style.left=Math.max(12,Math.min(host.innerWidth- Math.min(420,host.innerWidth-24)-12,r.right-420))+'px';content.style.top=Math.max(12,Math.min(host.innerHeight-240,r.bottom+8))+'px';content.showPopover();}});
    content.addEventListener('toggle',event=>button.setAttribute('aria-expanded',String(event.newState==='open')));
   }
   content.append(item);
  }
 }
 visit(root);
 const observer=host.MutationObserver?new host.MutationObserver(records=>{if(!dead)for(const r of records)for(const node of r.addedNodes)visit(node);}):null;
 observer?.observe(root,{subtree:true,childList:true});
 return()=>{dead=true;observer?.disconnect();};
}

/** Keep the reader's disclosure choices when live panels replace their markup. */
export function installDisclosurePersistence(root,host){
 const choices=new Map();let dead=false;
 const key=details=>{
  if(details.id)return details.id;
  const owner=details.closest('.panel[id],.view[id]');
  return `${owner?.id??'screen'}:${clean(details.querySelector('summary')?.textContent??'')}`;
 };
 const remember=(details,open)=>{const id=key(details);if(choices.size>=200&&!choices.has(id))choices.delete(choices.keys().next().value);choices.set(id,open);};
 const click=event=>{const details=event.target.closest?.('summary')?.parentElement;if(details?.tagName==='DETAILS')remember(details,!details.open);};
 const toggle=event=>{const details=event.target;if(details?.tagName==='DETAILS'&&root.contains(details))remember(details,details.open);};
 function restore(node){
  if(dead||node.nodeType!==1)return;
  const details=node.tagName==='DETAILS'?[node]:[...node.querySelectorAll('details')];
  for(const item of details){const id=key(item);if(choices.has(id)&&item.open!==choices.get(id))item.open=choices.get(id);}
 }
 root.addEventListener('click',click,true);root.addEventListener('toggle',toggle,true);
 const observer=host.MutationObserver?new host.MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)restore(node);}):null;
 observer?.observe(root,{subtree:true,childList:true});
 return()=>{dead=true;observer?.disconnect();root.removeEventListener('click',click,true);root.removeEventListener('toggle',toggle,true);choices.clear();};
}
