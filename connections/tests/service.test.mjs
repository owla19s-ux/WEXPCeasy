import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import * as api from '../../dist/connections/src/index.js';
function fixture(t,execute){
 const dir=mkdtempSync(join(tmpdir(),'wex-service-'));const configs=openSqliteStore(join(dir,'configs.sqlite'),'configs'),operations=openSqliteStore(join(dir,'operations.sqlite'),'operations');
 t.after(()=>{configs.close();operations.close();rmSync(dir,{recursive:true,force:true});});
 const scope={subject:'user',entry:'conversation',conversation:'c',context:null,resource:'fixture',target:'item',action:'write',relationship:'direct',relationshipGeneration:1};
 const permission={evaluate(){return {status:'allow',scope,revision:1,generation:1};},recheck(){return this.evaluate();}};
 const adapter={id:'fixture',version:'1',execute};
 const create=(adapters=[adapter])=>api.createConnectionService(permission,configs,operations,adapters,{shutdownTimeoutMs:10});
 return {create,adapter,configStore:configs,operationStore:operations};
}
const sample={id:'connection',adapter:'fixture',endpoint:'fixture:original',credentialRef:null,enabled:true};
const dispatch=service=>service.dispatch('fixture',{},'op','connection',1,'item','intent',{text:'hello'});
test('connection service composes configured dispatch without exposing ledger mutation',async t=>{
 let calls=0;const h=fixture(t,async()=>{calls++;return {ok:true};}),s=h.create();
 s.configs.put(sample,0,'create');assert.equal((await dispatch(s)).status,'observed');assert.equal(calls,1);
 assert.equal(s.operations.get('op').connection.endpoint,'fixture:original');assert.equal(s.operations.prepare,undefined);
 assert.equal((await s.stop()).status,'stopped');
 assert.equal((await dispatch(s)).reason,'connections_stopping');
 assert.equal(s.configs.put(sample,1,'after-stop').status,'unavailable');
 assert.throws(()=>s.operations.read(),/connections_stopping/);
});
test('stop timeout retains in-flight receipt and later stop confirms completion',async t=>{
 let release;const wait=new Promise(r=>release=r),h=fixture(t,async()=>{await wait;return {ok:true};}),s=h.create();
 s.configs.put(sample,0,'create');const running=dispatch(s);
 assert.equal((await s.stop()).status,'incomplete');
 assert.equal((await dispatch(s)).reason,'connections_stopping');
 release();assert.equal((await running).status,'observed');assert.equal((await s.stop()).status,'stopped');
 assert.equal(api.createOperationLedger(h.operationStore).get('op').phase,'observed');
});
test('adapter reentrant stop observes an already registered in-flight operation',async t=>{
 let s,stopped;const h=fixture(t,async()=>{stopped=await s.stop();return null;});s=h.create();s.configs.put(sample,0,'create');
 assert.equal((await dispatch(s)).status,'observed');assert.equal(stopped.status,'incomplete');assert.equal((await s.stop()).status,'stopped');
});
test('duplicate static adapters fail before any operation is created',t=>{
 const h=fixture(t,async()=>null);assert.throws(()=>h.create([h.adapter,h.adapter]),/invalid_adapters/);assert.equal(h.operationStore.read().revision,0);
});

test('unknown adapter cannot manufacture an operation and throwing adapter does not leak shutdown work',async t=>{
 const h=fixture(t,async()=>{throw Error('remote state unknown');}),s=h.create();s.configs.put(sample,0,'create');
 assert.equal((await s.dispatch('missing',{},'missing','connection',1,'item','intent',{})).reason,'adapter_unavailable');
 assert.equal(s.operations.read().operations.length,0);
 assert.equal((await dispatch(s)).status,'unknown');assert.equal(s.operations.get('op').phase,'unknown');assert.equal((await s.stop()).status,'stopped');
});
