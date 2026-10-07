import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './workspace_fixture.mjs';
test('settings attribution access also moves the replica expand button while keeping required credits',()=>{const f=fixture(1280,720,{hash:'#wall'});try{
 const classes=new Set(),link={disabled:false,click(){},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}},logo={visible:true};f.viewers[1].creditDisplay={container:{querySelector:q=>q==='.cesium-credit-expand-link'?link:null,logo}};
 f.evaluate('wallReplica.sync()');assert.equal(classes.has('isdc-settings-attribution'),true);assert.equal(logo.visible,true);
 f.evaluate('globalThis.removeTestAttribution=globe.bindAttributionAccess();globalThis.removeTestAttribution()');assert.equal(classes.has('isdc-settings-attribution'),false);assert.equal(logo.visible,true);
 f.evaluate('wallReplica.sync()');assert.equal(classes.has('isdc-settings-attribution'),false);
 }finally{f.dispose();}});
