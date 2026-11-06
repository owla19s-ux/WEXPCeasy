import test from 'node:test';
import assert from 'node:assert/strict';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
import {fixture} from './fixture.mjs';
function setup(t){
 let afterRead=()=>{};
 const h=fixture(t,{openStore(path,ns){const db=openSqliteStore(path,ns);return {...db,read(){const result=db.read();afterRead();return result;}};}});
 const creation={kind:'connection.create',intent:'original',name:'A',provider:'custom',protocol:'openai-chat',endpoint:'https://example.org/v1',endpointMode:'base',credentialRef:null,enabled:true,parameters:{}};
 const c=h.execute(creation),m=h.model(c.id);h.reopen();
 return {h,c,m,creation,afterRead(fn){afterRead=fn;}};
}
for(const label of ['conflicting receipt','missing mutation target','missing query target','preparation','model probe','directory refresh']){
 test('API '+label+' does not disclose storage facts after authorization is revoked during SQLite read',t=>{
  const f=setup(t),{h,c,m}=f,before=h.db.read();f.afterRead(()=>h.revoke());
  if(label==='conflicting receipt')assert.equal(h.execute({...f.creation,name:'changed'}).reason,'denied');
  if(label==='missing mutation target')assert.equal(h.execute({kind:'connection.edit',intent:'edit',id:'missing',expectedRevision:1,name:'changed'}).reason,'denied');
  if(label==='missing query target')assert.equal(h.query('connection','missing').reason,'denied');
  if(label==='preparation')assert.equal(h.service.prepare(h.request('request.prepare','model:missing'),{
   requestId:'request',connectionId:c.id,connectionRevision:1,modelId:'missing',modelRevision:1,
   context:null,parameters:{},messages:[{role:'user',content:'hello'}],timeoutMs:1000,stream:false,
  }).reason,'denied');
  if(label==='model probe')assert.throws(()=>h.service.probeModel(h.request('model.probe','model:missing'),'missing'),e=>e.reason==='denied');
  if(label==='directory refresh')assert.throws(()=>h.service.directoryConnection(h.request('directory.refresh','connection:missing'),'missing'),e=>e.reason==='denied');
  assert.deepEqual(h.db.read(),before);
 });
}
for(const label of ['preparation','model probe','directory refresh']){
 test('API '+label+' rechecks independently revoked metadata reads before disclosing missing target state',t=>{
  const f=setup(t),{h,c}=f,before=h.db.read();let restricted=false;
  const evaluate=h.permission.evaluate.bind(h.permission);
  h.permission.evaluate=request=>{const d=evaluate(request);return restricted&&d.status==='allow'&&['connection.read','model.read'].includes(d.scope.action)?{status:'deny',reason:'metadata_revoked'}:d;};
  f.afterRead(()=>{restricted=true;});
  if(label==='preparation')assert.equal(h.service.prepare(h.request('request.prepare','model:missing'),{
   requestId:'request',connectionId:c.id,connectionRevision:1,modelId:'missing',modelRevision:1,
   context:null,parameters:{},messages:[{role:'user',content:'hello'}],timeoutMs:1000,stream:false,
  }).reason,'metadata_revoked');
  if(label==='model probe')assert.throws(()=>h.service.probeModel(h.request('model.probe','model:missing'),'missing'),e=>e.reason==='metadata_revoked');
  if(label==='directory refresh')assert.throws(()=>h.service.directoryConnection(h.request('directory.refresh','connection:missing'),'missing'),e=>e.reason==='metadata_revoked');
  assert.deepEqual(h.db.read(),before);
 });
}
