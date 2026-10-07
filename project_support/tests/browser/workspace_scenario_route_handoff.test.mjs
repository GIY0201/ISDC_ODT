import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';

for(const [w,h] of [[1920,1080],[2560,1440]])test(`actual root hands scenario route draft to existing ground owner ${w}x${h}`,async()=>{
 let routePort;const calls=[];
 const f=fixture(w,h,{hash:'#satellite',scenarioFactory:(factory,args)=>{routePort=args.onRouteSpec;return factory(args);},groundNetworkPanelFactory:(factory,args)=>{const owner=factory(args);return {...owner,adoptRouteDraft:spec=>{calls.push(spec);return owner.adoptRouteDraft(spec);}};}});
 try{
  assert.equal(typeof routePort,'function','actual scenario draft callback must be injected');
  const before=f.evaluate('groundNetworkPanel.routeRequest()');
  const draft=Object.freeze({source:'FOREIGN_SOURCE',target:'FOREIGN_TARGET',objective:'balanced'});
  assert.equal(routePort(draft),false,'same existing panel refuses foreign choices');
  assert.equal(calls.length,1);assert.equal(calls[0],draft);
  assert.deepEqual(f.evaluate('groundNetworkPanel.routeRequest()'),before);
  assert.equal(f.counts().commands,0);
  await f.win.dispatch('pagehide',{persisted:false});
  assert.equal(routePort(draft),false,'destroyed ground owner cannot adopt late draft');
  assert.deepEqual(f.evaluate('groundNetworkPanel.routeRequest()'),before);
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
