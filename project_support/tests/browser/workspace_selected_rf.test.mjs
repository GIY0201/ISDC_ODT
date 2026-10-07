import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
for(const [width,height]of[[1920,1080],[2560,1440]])test(`actual selected link root callback reaches same existing RF draft owner ${width}x${height}`,async()=>{
 let panelPorts,calls=0;const f=fixture(width,height,{hash:'#ground',rfRequest:async()=>{calls++;throw Error('prefill cannot calculate');},groundNetworkPanelFactory:(factory,args)=>{panelPorts=args;return factory(args);}});
 try{
  assert.equal(typeof panelPorts.onRfLinkDraft,'function');
  const link={id:'GS|N',kind:'ground',a:'GS',b:'N',band:'Ka',frequency_ghz:20,range_km:1234.56,eirp_dbw:33,gt_dbk:36,data_rate_mbps:400};
  const metadata={analysis_utc:'2026-10-07T00:00:00.000000000Z',display_utc:'2026-10-07T00:00:02.000000000Z',source:'native_geometry',isCurrent:()=>true};
  panelPorts.onRfLinkDraft(link,metadata);
  assert.equal(f.get('rf-link-id').value,'GS|N');assert.equal(f.get('rf-frequency-ghz').value,'20');assert.equal(f.get('rf-distance-km').value,'1235');assert.equal(f.get('rf-tx-power-w').value,'20');
  assert.equal(f.get('rf-misc-losses-db').value,'6');assert.equal(f.get('rf-system-temp-k').value,'300');assert.equal(f.get('rf-required-ebno-db').value,'9.6');
  assert.equal(calls,0);assert.equal(f.counts().commands,0);
  panelPorts.onRfLinkDraft({...link,range_km:1500},{...metadata,isCurrent:()=>false});assert.equal(f.get('rf-distance-km').value,'1235');
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
