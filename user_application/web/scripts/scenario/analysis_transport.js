// Routes explicit UI transport to existing clock capabilities. Owns no time/state.
export function createAnalysisTransport({follow=null,independent={}}={}){
 const source=()=>follow?.source?.()??null;
 const locked=()=>follow?.locked?.()===true||source()!==null;
 return Object.freeze({
  source,locked,
  async run(action,...args){
   if(locked()){
    if(follow?.pending?.()===true)throw Error('SIM 따라가기 검증·해제 중입니다. 완료 후 다시 실행하세요.');
    const owner=source();if(!owner)throw Error('SIM 따라가기 검증·해제 중입니다. 완료 후 다시 실행하세요.');
    const name={play:'play',pause:'pause',speed:'setSpeed',step:'step'}[action];
    if(!name)throw Error('독립 분석 UTC를 변경하려면 SIM 따라가기를 명시적으로 해제하세요.');
    if(typeof owner[name]!=='function')throw Error('명시적인 SIM 시계 소유자 제어가 없습니다.');
    return owner[name](...args);
   }
   if(typeof independent[action]!=='function')throw Error('기존 분석 시계 제어가 연결되지 않았습니다.');
   return independent[action](...args);
  },
  invalidate(reason){
   if(!locked())return false;
   if(typeof follow?.invalidate!=='function')throw Error('관측 조건 변경 전에 SIM 따라가기를 해제하세요.');
   return follow.invalidate(reason);
  },
 });
}
