import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {createPermissions} from '../../dist/permissions/src/index.js';
import * as connections from '../../dist/connections/src/index.js';
const sample={id:'connection',adapter:'fixture',endpoint:'local:original',credentialRef:null,enabled:true};
function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'wex-configured-'));const stores=[];
 t.after(()=>{for(const s of stores)s.close();rmSync(dir,{recursive:true,force:true});});
 const open=ns=>{const s=openSqliteStore(join(dir,'state.sqlite'),ns);stores.push(s);return s;};
 const configs=connections.createConnectionConfigs(open('configs')),opStore=open('operations'),ledger=connections.createOperationLedger(opStore);
 configs.put(sample,0,'create');
 const scope={subject:'user',entry:'conversation',conversation:'c',context:null,resource:'fixture',target:'item',action:'write',relationship:'direct',relationshipGeneration:1},request={};
 const permission=createPermissions(open('permissions'),{current:r=>r===request?{...scope,kind:'conversation',moduleEnabled:true,globalEnabled:true,conversationEnabled:true,sourceAllowed:true}:undefined,canManage:()=>true,canReadHistory:()=>false});
 let calls=0,received,version='1.0';
 const adapter={id:'fixture',get version(){return version;},async execute(config,target,payload){calls++;received={config,target,payload};return {written:true};}};
 const grant=()=>permission.grant({scope,intent:'grant',expectedRevision:0});
 const boundary=()=>connections.createConfiguredDispatchBoundary(permission,ledger,configs,adapter);
 const dispatch=(b=boundary(),id='op',revision=1)=>b.dispatch(request,id,'connection',revision,'item','intent',{text:'hello'});
 return {configs,ledger,opStore,permission,request,scope,adapter,boundary,dispatch,grant,changeVersion(v){version=v;},get calls(){return calls;},get received(){return received;}};
}
test('configured dispatch binds persisted revision and adapter version',async t=>{
 const h=fixture(t);h.grant();assert.equal((await h.dispatch()).status,'observed');
 assert.equal(h.calls,1);assert.deepEqual(h.received,{config:sample,target:'item',payload:{text:'hello'}});
 assert.deepEqual(h.ledger.get('op').connection,{connectionId:'connection',configRevision:1,adapterId:'fixture',adapterVersion:'1.0',endpoint:'local:original'});
});
test('unauthorized caller cannot inspect configuration existence',async t=>{
 const h=fixture(t);let reads=0;
 const b=connections.createConfiguredDispatchBoundary(h.permission,h.ledger,{read(){reads++;throw Error('must not read');}},h.adapter);
 assert.equal((await h.dispatch(b)).reason,'authorization_deny');assert.equal(reads,0);assert.equal(h.calls,0);assert.equal(h.ledger.read().operations.length,0);
});
for(const [label,change,reason] of [
 ['disabled',c=>c.put({...sample,enabled:false},1,'disable'),'connection_disabled'],
 ['removed',c=>c.remove('connection',1,'remove'),'connection_missing'],
 ['different adapter',c=>c.put({...sample,adapter:'other'},1,'change'),'adapter_mismatch'],
])test('configured dispatch blocks '+label,async t=>{
 const h=fixture(t);h.grant();change(h.configs);
 assert.equal((await h.dispatch(h.boundary(),'op',2)).reason,reason);assert.equal(h.calls,0);assert.equal(h.ledger.read().operations.length,0);
});
test('stale configuration revision blocks before intent is recorded',async t=>{
 const h=fixture(t);h.grant();h.configs.put({...sample,endpoint:'local:new'},1,'update');
 assert.equal((await h.dispatch()).reason,'config_revision_conflict');assert.equal(h.calls,0);assert.equal(h.ledger.read().operations.length,0);
});
test('empty adapter version is not executable',async t=>{
 const h=fixture(t);h.grant();h.changeVersion('');
 assert.equal((await h.dispatch()).reason,'adapter_version_missing');assert.equal(h.calls,0);
});
for(const mode of ['disable','remove','version','revoke'])test(mode+' during dispatch reservation prevents external execution',async t=>{
 const h=fixture(t);h.grant();const commit=h.opStore.commit;
 const hooked={...h.opStore,commit(c){const result=commit(c);if(c.intent==='operation:dispatch:op'){
  if(mode==='disable')h.configs.put({...sample,enabled:false},1,'disable');
  if(mode==='remove')h.configs.remove('connection',1,'remove');
  if(mode==='version')h.changeVersion('2.0');
  if(mode==='revoke')h.permission.revoke({scope:h.scope,intent:'revoke',expectedRevision:1});
 }return result;}};
 const ledger=connections.createOperationLedger(hooked);
 const b=connections.createConfiguredDispatchBoundary(h.permission,ledger,h.configs,h.adapter);
 assert.equal((await h.dispatch(b)).status,'blocked');assert.equal(h.calls,0);
 assert.equal(ledger.get('op').attempts,1);
 assert.deepEqual(ledger.get('op').observations,[{id:'host-not-dispatched',phase:'observed',value:{reason:mode==='revoke'?'authorization_revoked':'connection_changed',externalDispatched:false}}]);
});
test('in-flight configuration stays bound while later edits block replay',async t=>{
 const h=fixture(t);h.grant();let release;const wait=new Promise(r=>release=r);let captured;
 const adapter={id:'fixture',version:'1.0',async execute(config){captured=config;await wait;return {endpoint:config.endpoint};}};
 const b=connections.createConfiguredDispatchBoundary(h.permission,h.ledger,h.configs,adapter);
 const job=h.dispatch(b);h.configs.put({...sample,endpoint:'local:new'},1,'update');release();
 assert.equal((await job).status,'observed');assert.equal(captured.endpoint,'local:original');
 assert.equal(h.ledger.get('op').connection.endpoint,'local:original');
 assert.equal((await h.dispatch(b,'op',2)).reason,'intent_conflict');
 assert.equal(h.ledger.get('op').attempts,1);
});

test('configured entry snapshots payload before consulting permission dependencies',async t=>{
 const h=fixture(t);h.grant();const payload={text:'approved'};
 const permission={evaluate(request){payload.text='changed';return h.permission.evaluate(request);},recheck:(...args)=>h.permission.recheck(...args)};
 const b=connections.createConfiguredDispatchBoundary(permission,h.ledger,h.configs,h.adapter);
 assert.equal((await b.dispatch(h.request,'snapshot','connection',1,'item','intent',payload)).status,'observed');
 assert.deepEqual(h.received.payload,{text:'approved'});
});

test('uncloneable configured payload is a rejected input, not an unknown external result',async t=>{
 const h=fixture(t);h.grant();
 const result=await h.boundary().dispatch(h.request,'invalid','connection',1,'item','intent',{f:()=>true});
 assert.equal(result.status,'blocked');assert.equal(result.reason,'invalid_payload');assert.equal(h.calls,0);assert.equal(h.ledger.read().operations.length,0);
});
test('failed not-dispatched receipt remains unknown while the adapter stays uncalled',async t=>{
 const h=fixture(t);h.grant();const commit=h.opStore.commit;
 const store={...h.opStore,commit(c){
  if(c.intent.startsWith('operation:observation-v2:'))return {status:'unknown',intent:c.intent};
  const result=commit(c);if(c.intent==='operation:dispatch:op')h.configs.put({...sample,enabled:false},1,'disable');return result;
 }};
 const ledger=connections.createOperationLedger(store),b=connections.createConfiguredDispatchBoundary(h.permission,ledger,h.configs,h.adapter);
 const result=await h.dispatch(b);
 assert.equal(result.status,'unknown');assert.equal(result.reason,'blocked_receipt_unknown');assert.equal(h.calls,0);assert.equal(ledger.get('op').phase,'dispatched');
});
