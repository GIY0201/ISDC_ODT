// Browser display preferences only; map theme, clocks and native owners are untouched.
const KEY='spacetwin-theme';
export function createShellPreferences({document,storage,onChange=()=>{}}={}){
 let dead=false,busy=false,theme='dark',error='';
 const apply=()=>{const root=document?.documentElement;if(root?.dataset)root.dataset.theme=theme;if(root?.style)root.style.colorScheme=theme;};
 try{const saved=storage?.getItem?.(KEY);if(['light','dark'].includes(saved))theme=saved;}catch{error='화면 테마 저장값을 읽지 못했습니다. 기본 어두운 화면을 사용합니다.';}
 apply();
 const notify=()=>{if(!dead)onChange();};
 const changed=()=>notify();document?.addEventListener?.('fullscreenchange',changed);
 return Object.freeze({
  snapshot:()=>({theme,error,busy,fullscreen:!!document?.fullscreenElement,supported:typeof document?.documentElement?.requestFullscreen==='function'&&typeof document?.exitFullscreen==='function'}),
  setTheme(value){if(dead||!['light','dark'].includes(value))return;theme=value;apply();error='';try{if(typeof storage?.setItem!=='function')throw Error('저장소 없음');storage.setItem(KEY,value);}catch{error='화면 테마를 저장하지 못했습니다. 현재 창에만 적용합니다.';}notify();},
  async toggleFullscreen(){if(dead||busy)return;error='';const action=document?.fullscreenElement?document?.exitFullscreen:document?.documentElement?.requestFullscreen;if(typeof action!=='function'){error='이 브라우저는 전체화면 전환을 지원하지 않습니다.';notify();return;}busy=true;notify();if(dead)return;try{await action.call(document.fullscreenElement?document:document.documentElement);}catch(exc){if(!dead)error='전체화면 전환 실패: '+String(exc?.message||exc);}finally{if(!dead){busy=false;notify();}}},
  destroy(){if(dead)return;dead=true;document?.removeEventListener?.('fullscreenchange',changed);},
 });
}
