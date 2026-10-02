/** Cross-document hints only; server snapshots remain the selection authority. */
export function createWorkspaceRevisionSync(client,host=window){
  const channel=host.BroadcastChannel?new host.BroadcastChannel('isdc-odt-orbit-revision'):null;
  let disposed=false,published=-1,pending=0,refreshing=false;
  function observe(snapshot=client.snapshot()){
    if(disposed)return;
    const revision=snapshot.state?.revision;
    if(Number.isSafeInteger(revision)&&revision>published){published=revision;channel?.postMessage({type:'revision',revision});}
    if(!snapshot.state||snapshot.status==='pending'||snapshot.fetching||refreshing||pending<=revision)return;
    pending=0;refreshing=true;
    Promise.resolve(client.refresh({force:true})).finally(()=>{refreshing=false;if(!disposed)observe();});
  }
  const receive=event=>{const data=event.data;if(disposed||data?.type!=='revision'||!Number.isSafeInteger(data.revision)||data.revision<0)return;pending=Math.max(pending,data.revision);observe();};
  const focus=()=>{if(disposed)return;pending=Math.max(pending,(client.snapshot().state?.revision??0)+1);observe();};
  channel?.addEventListener('message',receive);host.addEventListener('focus',focus);
  return {observe,destroy(){if(disposed)return;disposed=true;channel?.removeEventListener('message',receive);channel?.close();host.removeEventListener('focus',focus);}};
}
