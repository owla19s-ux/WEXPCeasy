import test from 'node:test';
import assert from 'node:assert/strict';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
import {fixture} from './fixture.mjs';

const creation={kind:'connection.create',intent:'original',name:'A',provider:'deepseek',protocol:'openai-chat',endpoint:'https://example.org/v1',endpointMode:'base',credentialRef:null,enabled:true,parameters:{}};
test('lost API mutation acknowledgement recovers after SQLite reopen without another Connection',t=>{
 let once=true;const h=fixture(t,{openStore(path,ns){const db=openSqliteStore(path,ns);return {...db,commit(c){const result=db.commit(c);if(once&&c.intent.endsWith(':apply')&&result.status==='committed'){once=false;return {status:'unknown',intent:c.intent};}return result;}};}});
 const lost=h.execute(creation);assert.equal(lost.status,'unknown');h.reopen();const recovered=h.execute(creation);assert.equal(recovered.status,'committed');assert.equal(recovered.id,lost.id);assert.equal(h.db.read().value.connections.length,1);assert.equal(h.query('connection',recovered.id).value.name,'A');
});
test('unconfirmed API mutation remains observation-only through restart and reserves its ID',t=>{
 let once=true;const h=fixture(t,{id:()=> 'reserved',openStore(path,ns){const db=openSqliteStore(path,ns);return {...db,commit(c){if(once&&c.intent.endsWith(':apply')){once=false;return {status:'unknown',intent:c.intent};}return db.commit(c);}};}});
 const lost=h.execute(creation);assert.equal(lost.status,'unknown');h.reopen();assert.equal(h.execute(creation).status,'unknown');assert.equal(h.db.read().value.connections.length,0);assert.equal(h.execute({...creation,intent:'new'}).reason,'id_collision');
});
test('corrupt or future API records block reads and writes without being reset',t=>{
 const h=fixture(t),c=h.connection();const snap=h.db.read();snap.value.connections[0].apiKey='must-not-project';h.db.commit({intent:'tamper',expectedRevision:snap.revision,value:snap.value});const before=h.db.read();
 assert.equal(h.query('connection',c.id).status,'unavailable');assert.equal(h.connection().status,'unavailable');assert.deepEqual(h.db.read(),before);assert.throws(()=>h.reopen());
});
test('same-provider manual models remain Connection-scoped and duplicate identity is not silently merged',t=>{
 const h=fixture(t),a=h.connection(),b=h.connection(),m=h.model(a.id);assert.equal(m.status,'committed');assert.equal(h.model(b.id).status,'committed');assert.equal(h.model(a.id).reason,'duplicate_model_unsupported');
});
test('command cancellation before commit and permissions unavailable do not create Connections',t=>{
 const h=fixture(t),ac=new AbortController();ac.abort();const request=h.request('connection.create','api:connections');assert.equal(h.service.execute(request,creation,ac.signal).reason,'cancelled');assert.equal(h.db.read().value,null);
 const evaluate=h.permission.evaluate;h.permission.evaluate=()=>{throw Error('offline');};assert.equal(h.execute(creation).status,'unavailable');h.permission.evaluate=evaluate;assert.equal(h.db.read().value,null);
});

test('service stop inside the final permission recheck blocks the API business commit',t=>{
 const h=fixture(t),original=h.permission.recheck.bind(h.permission);
 h.permission.recheck=(request,prior)=>{const result=original(request,prior);if(h.db.read().value?.intents.some(intent=>intent.phase==='prepared'))h.service.stop();return result;};
 const result=h.execute(creation);assert.equal(result.status,'unavailable');assert.equal(h.db.read().value.connections.length,0);
});
test('unknown API aggregate versions are blocked without downgrade or blank reconstruction',t=>{
 const h=fixture(t);h.db.commit({intent:'future',expectedRevision:0,value:{format:99,domain:'api-configurations'}});assert.equal(h.connection().status,'unavailable');assert.throws(()=>h.reopen());assert.equal(h.db.read().value.format,99);
});

test('directional observation evidence survives SQLite reopen and still governs preparation',t=>{
 for(const output of ['supported','unsupported','unknown','unverified']){
  const modalities={text:{input:'supported',output},image:{input:'supported'},audio:{output:'unsupported'}};
  const h=fixture(t,{observer:{resolve(_r,c,m){return {
   connectionId:c.id,connectionRevision:c.revision,modelId:m.modelId,
   source:'provider',sourceRevision:'directions-1',observedAt:'2026-11-08T00:00:00Z',
   capabilities:{text:'supported',stream:'supported',tools:'unknown',image:'unknown',reasoning:'unknown'},
   parameters:{},modalities
  };}}});
  const c=h.connection(),m=h.model(c.id);
  assert.equal(h.execute({kind:'model.observe',intent:'directions',id:m.id,expectedRevision:1}).status,'committed');
  const input={requestId:'recovered',connectionId:c.id,connectionRevision:1,modelId:m.id,modelRevision:2,
   context:null,parameters:{},messages:[{role:'user',content:'hello'}],timeoutMs:1000,stream:false};
  const before=h.service.prepare(h.request('request.prepare',`model:${m.id}`),input);
  h.reopen();
  assert.deepEqual(h.query('model',m.id).value.observation.modalities,modalities);
  const after=h.service.prepare(h.request('request.prepare',`model:${m.id}`),input);
  assert.deepEqual(after,before);
  assert.equal(after.status,output==='supported'?'ok':'rejected');
  if(after.status==='ok')assert.deepEqual(after.snapshot.body.messages,input.messages);
 }
});
