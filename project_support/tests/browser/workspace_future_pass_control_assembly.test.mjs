import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {createOrbitSelection} from '../../../user_application/web/scripts/orbit_selection.js';
import {LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';

test('actual workspace assembly injects the same future-input control owner into stored, SIM and scenario owners',async()=>{
  let storedControl,simControl,scenarioControl,client,workspace,sim;
  let begun=0,released=0;
  const utc='2020-07-12T21:16:01.000416000Z';
  let state={revision:0,input_id:'tle',input_hash:'hash',current_utc:utc,anchor_utc:utc,playing:false,play_rate:1,ground_point:{latitude_deg:33.4996,longitude_deg:126.5312,ellipsoid_height_m:0,virtual:true,ellipsoid:'WGS84'},minimum_elevation_deg:10,leap_sha256:LEAP_SHA256,eop_sha256:'eop',frame:'ITRF',profile:'WGS72_AFSPC'};
  const calls=[];
  const runtime={mode:'SIM',running:false,speed:1,elapsed_seconds:0,sequence:0,run_id:'RUN-A',scenario_id:'A',active_faults:[]};
  let bootstrapPending=null,holdBootstrap=false,simCalls=0;
  const bootstrap=()=>({runtime,scenarios:[{id:'A',name:'Existing'}],events:[],missions:[]});
  const transport={orbitInputs:async()=>({inputs:[{input_id:'tle',epoch_utc:utc}]}),orbitState:async()=>({...state}),selectOrbit:async body=>{calls.push(structuredClone(body));return state={...state,...body,revision:state.revision+1,current_utc:utc};}};
  const f=fixture(1920,1080,{
    planningBootstrap:()=>holdBootstrap?new Promise(resolve=>{bootstrapPending=()=>resolve(bootstrap());}):Promise.resolve(bootstrap()),
    runtimeControl:async action=>{assert.equal(action,'pause');simCalls++;return runtime;},
    orbitSelectionFactory:(_api,notify,requestId,now,onControl)=>{
      storedControl=onControl;
      return client=createOrbitSelection(transport,notify,()=> 'assembly-request',()=>0,onControl);
    },
    simPanelFactory:(create,...args)=>{simControl=args[3]?.control;const panel=create(...args);sim=panel.controller;return panel;},
    scenarioFactory:(create,args)=>{scenarioControl=args.onControl;return create(args);},
    nodeWorkspaceFactory:(create,args)=>{
      workspace=create(args);
      const begin=workspace.beginFuturePassControl;
      assert.equal(typeof begin,'function','instrumentation must delegate to the real future-input owner');
      return {...workspace,beginFuturePassControl:()=>{
        begun++;const release=begin();assert.equal(typeof release,'function');let done=false;
        return()=>{if(done)return;done=true;released++;release();};
      }};
    },
  });
  try{
    for(const callback of [storedControl,simControl,scenarioControl])assert.equal(typeof callback,'function','root must inject actual owner observation, not raw API finally');
    await client.load();
    await client.seek(utc);
    assert.equal(begun,1);assert.equal(released,1);
    assert.equal(calls.length,1);assert.equal(calls[0].anchor_utc,utc);
    assert.equal(client.snapshot().state.revision,1);
    await sim.load();holdBootstrap=true;
    const pending=sim.control('pause');
    for(let i=0;i<20&&!bootstrapPending;i++)await new Promise(resolve=>setImmediate(resolve));
    assert.ok(bootstrapPending);assert.equal(simCalls,1);
    assert.equal(begun,released+1,'actual SIM operation stays pending after HTTP through bootstrap adoption');
    assert.equal(sim.snapshot().busy,true);
    bootstrapPending();await pending;
    assert.equal(sim.snapshot().busy,false);assert.equal(begun,released);
    for(const callback of [simControl,scenarioControl]){const release=callback();assert.equal(begun,released+1);release();release();assert.equal(begun,released);}
  }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
