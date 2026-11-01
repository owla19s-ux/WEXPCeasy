import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadBoundary} from '../../dist/connections/src/index.js';
const scope={resource:'fixture',target:'item',action:'read'};
function setup(){
 let active=true,reads=0;
 const permissions={
  evaluate(){return active?{status:'allow',scope,revision:1,generation:1}:{status:'deny',reason:'revoked'};},
  recheck(){return this.evaluate();}
 };
 const boundary=createReadBoundary(permissions,{id:'fixture',async read(){reads++;return 'data';}});
 return {boundary,revoke(){active=false;},reads(){return reads;}};
}
test('authorized read',async()=>{const h=setup();assert.deepEqual(await h.boundary.read({},'item'),{status:'ok',value:'data'});assert.equal(h.reads(),1);});
test('wrong target blocked',async()=>{const h=setup();assert.equal((await h.boundary.read({},'other')).status,'denied');assert.equal(h.reads(),0);});
test('revoked before call blocked',async()=>{const h=setup();h.revoke();assert.equal((await h.boundary.read({},'item')).status,'denied');assert.equal(h.reads(),0);});
test('cancel before call blocked',async()=>{const h=setup(),c=new AbortController();c.abort();assert.equal((await h.boundary.read({},'item',c.signal)).status,'cancelled');assert.equal(h.reads(),0);});
test('revoke while reading prevents disclosure',async()=>{
 let release;const wait=new Promise(r=>release=r);let active=true;
 const p={evaluate(){return active?{status:'allow',scope,revision:1,generation:1}:{status:'deny',reason:'revoked'};},recheck(){return this.evaluate();}};
 const b=createReadBoundary(p,{id:'fixture',async read(){await wait;return 'secret';}});
 const job=b.read({},'item');active=false;release();
 assert.equal((await job).status,'denied');
});
