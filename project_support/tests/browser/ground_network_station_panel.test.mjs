import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {createGroundNetworkPanel} from '../../../user_application/web/scripts/tabs/ground_network.js';
import {createGroundSegmentStore} from '../../../user_application/web/scripts/communication/ground_segment.js';
import * as model from '../../../digital_twin/model_library/browser/ground_stations.js';
for(const [width,height]of [[1920,1080],[2560,1440]])test(`operator station panel selection retains native inputs and explicit focus is scoped ${width}x${height}`,async()=>{
 const f=fixture(width,height,{hash:'#ground'});f.evaluate('groundNetworkPanel.destroy()');const store=createGroundSegmentStore({model});store.load();
 let clears=0,focuses=0,allowed=true;const network={networkSnapshot:()=>({status:'unavailable'}),verifyNetworkSnapshot:()=>false,clearNetwork(){clears++;},canFocusGroundNetworkStation:id=>allowed&&store.find(id)?.enabled===true,focusGroundNetworkStation(id){if(!allowed)return false;focuses++;assert.equal(id,store.selectedId);return true;}};
 const panel=createGroundNetworkPanel({store,model,network,document:f.doc,host:f.win,refreshRuntime:async()=>{}});
 try{panel.show('ground');const id=store.stations[0].id,button=f.get('ground-node-focus');assert.ok(button);assert.equal(button.disabled,true);
  const baseline=clears;store.select(id);assert.equal(clears,baseline,'selection is not a station geometry edit');assert.equal(f.get('ground-node-select').value,id);assert.equal(button.disabled,false);assert.equal(focuses,0);
  await button.dispatch('click');assert.equal(focuses,1);assert.equal(clears,baseline);store.update(id,{longitude:store.find(id).longitude+1});assert.equal(clears,baseline+1);
  allowed=false;panel.update();assert.equal(button.disabled,true);await button.dispatch('click');assert.equal(focuses,1);
  allowed=true;panel.show('satellite');await button.dispatch('click');assert.equal(focuses,1);panel.destroy();await button.dispatch('click');assert.equal(focuses,1);
 }finally{panel.destroy();store.destroy();f.dispose();}
});
