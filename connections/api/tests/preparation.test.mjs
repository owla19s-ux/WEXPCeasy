import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
const observed=(connection,model,patch={})=>({connectionId:connection.id,connectionRevision:connection.revision,modelId:model.modelId,source:'probe',sourceRevision:'fixture-1',observedAt:'2026-11-05T00:00:00Z',capabilities:{text:'supported',stream:'supported',tools:'unknown',image:'unsupported',reasoning:'unknown'},parameters:{temperature:{type:'number',minimum:0,maximum:2},top_p:{type:'number',minimum:0,maximum:1},thinking:{type:'boolean'},custom:{type:'object'},nullable:{type:'null'}},...patch});
export function setup(t,extra={}){
 const h=fixture(t,{observer:{resolve(_request,c,m){return observed(c,m);}},...extra}),c=h.connection();assert.equal(c.status,'committed');const m=h.model(c.id);assert.equal(m.status,'committed');
 const observe=()=>h.execute({kind:'model.observe',intent:'observe',id:m.id,expectedRevision:1});
 const input=(patch={})=>({requestId:'request-1',connectionId:c.id,connectionRevision:1,modelId:m.id,modelRevision:2,context:null,parameters:{},messages:[{role:'user',content:'hello'}],timeoutMs:10000,stream:true,...patch});
 const prepare=(patch={})=>h.service.prepare(h.request('request.prepare',`model:${m.id}`),input(patch));
 return {...h,h,c,m,observe,input,prepare};
}

test('manual models keep unknown capabilities and cannot become prepared requests without verified observations',t=>{
 const f=setup(t);assert.equal(f.h.query('model',f.m.id).value.observation,null);assert.equal(f.prepare({modelRevision:1}).reason,'capability_unverified');
 assert.equal(f.observe().status,'committed');assert.equal(f.prepare().status,'ok');
});
test('request snapshots preserve zero, false and structured values and remain immutable after configuration edits',t=>{
 const f=setup(t);f.observe();const params={temperature:{mode:'value',value:0},thinking:{mode:'value',value:false},custom:{mode:'value',value:{format:['a','b']}},nullable:{mode:'value',value:null}};
 const r=f.prepare({parameters:params});assert.equal(r.status,'ok');const s=r.snapshot;assert.equal(s.url,'https://api.example.org/v1/chat/completions');assert.equal(s.body.model,'chat-model');assert.equal(s.body.temperature,0);assert.equal(s.body.thinking,false);assert.equal(s.body.nullable,null);assert.deepEqual(s.body.custom,{format:['a','b']});
 params.custom.value.format.push('changed');assert.deepEqual(s.body.custom,{format:['a','b']});assert.throws(()=>{s.body.messages[0].content='changed';},TypeError);assert.throws(()=>{s.connection.credentialRef.revision=9;},TypeError);
 f.h.execute({kind:'connection.edit',intent:'edit',id:f.c.id,expectedRevision:1,endpoint:'https://other.example.org/v1',credentialRef:{id:'credential-2',revision:2}});
 assert.equal(s.connection.revision,1);assert.equal(s.connection.credentialRef.id,'credential-1');assert.equal(s.url,'https://api.example.org/v1/chat/completions');assert.equal(f.prepare().reason,'revision_conflict');assert.equal(f.prepare({connectionRevision:2}).reason,'capability_observation_stale');
});
test('explicit default and disabled settings remain distinct even though both omit the wire parameter',t=>{
 const f=setup(t);f.observe();const a=f.prepare({parameters:{temperature:{mode:'provider-default'}}}),b=f.prepare({parameters:{temperature:{mode:'disabled'}}});assert.equal(a.status,'ok');assert.equal(b.status,'ok');assert.equal('temperature'in a.snapshot.body,false);assert.equal('temperature'in b.snapshot.body,false);
 assert.notEqual(a.snapshot.fingerprint,b.snapshot.fingerprint);assert.equal(a.snapshot.parameterSettings.temperature.mode,'provider-default');assert.equal(b.snapshot.parameterSettings.temperature.mode,'disabled');
});
test('unsupported, invalid and conflicting explicit parameter sources are rejected without inventing precedence',t=>{
 const f=setup(t);f.observe();assert.equal(f.prepare({parameters:{unknown:{mode:'value',value:1}}}).reason,'parameter_unsupported');assert.equal(f.prepare({parameters:{temperature:{mode:'value',value:3}}}).reason,'parameter_invalid');
 f.h.execute({kind:'model.edit',intent:'parameter-model',id:f.m.id,expectedRevision:2,parameters:{temperature:{mode:'value',value:1}}});
 assert.equal(f.prepare({modelRevision:3,parameters:{temperature:{mode:'value',value:0}}}).reason,'parameter_conflict');
 const same=f.prepare({modelRevision:3,parameters:{temperature:{mode:'value',value:1}}});assert.equal(same.status,'ok');assert.deepEqual(same.snapshot.parameterSources.temperature,['model','request']);
});
test('model observations cannot claim another Connection, model identity or non-provider evidence',t=>{
 for(const patch of [{connectionId:'different'},{connectionRevision:8},{modelId:'different'},{source:'manual'}]){
  const f=setup(t,{observer:{resolve(_r,c,m){return observed(c,m,patch);}}});assert.equal(f.observe().status,'unavailable');assert.equal(f.h.query('model',f.m.id).value.revision,1);
 }
});
test('unknown capabilities, unsupported protocols and cross-Connection selections do not silently prepare',t=>{
 const f=setup(t,{observer:{resolve(_r,c,m){return observed(c,m,{capabilities:{text:'supported',stream:'unknown',tools:'unknown',image:'unsupported',reasoning:'unknown'}});}}});f.observe();assert.equal(f.prepare().reason,'capability_unsupported_or_unknown');assert.equal(f.prepare({stream:false}).status,'ok');
 const other=f.h.connection();assert.equal(f.prepare({connectionId:other.id,stream:false}).reason,'model_connection_mismatch');
 f.h.execute({kind:'connection.edit',intent:'protocol',id:f.c.id,expectedRevision:1,protocol:'unsupported-protocol'});assert.equal(f.prepare({connectionRevision:2,stream:false}).reason,'unsupported_protocol');
});
test('media, tool messages and reserved native-field overrides are rejected instead of dropped',t=>{
 const f=setup(t);f.observe();for(const patch of [{messages:[{role:'user',content:{image:'data'}}]},{messages:[{role:'tool',content:'result'}]},{parameters:{messages:{mode:'value',value:[]}}}])assert.equal(f.prepare(patch).status,'rejected');
 assert.equal(f.prepare({tools:[]}).snapshot.fingerprint,f.prepare().snapshot.fingerprint);
});
test('missing or different-principal reference grants block snapshots before metadata disclosure',t=>{
 const absent=setup(t,{deriveRequest:undefined});absent.observe();assert.equal(absent.prepare().reason,'reference_unavailable');
 let foreign;foreign=setup(t,{deriveRequest(_r,s){return foreign.h.request(s.action,s.target,s.context,{subject:'different'});}});foreign.observe();assert.equal(foreign.prepare().reason,'reference_unavailable');
});
test('model observation revocation recheck prevents configuration writes',t=>{
 let h;h=fixture(t,{observer:{resolve(_r,c,m){h.revoke();return observed(c,m);}}});const c=h.connection(),m=h.model(c.id);assert.equal(h.execute({kind:'model.observe',intent:'observe',id:m.id,expectedRevision:1}).status,'rejected');h.allow();assert.equal(h.query('model',m.id).value.observation,null);
});
test('snapshot size bounds, service stop and unavailable observation dependencies fail closed',t=>{
 const f=setup(t,{maxSnapshotBytes:32});f.observe();assert.equal(f.prepare().reason,'snapshot_too_large');f.h.service.stop();assert.equal(f.prepare().status,'unavailable');
 const absent=setup(t,{observer:undefined});assert.equal(absent.observe().reason,'observer_unavailable');
});
test('registered API and Model identity projections require per-target permission and do not claim a live Provider test',t=>{
 const f=setup(t);const parent=f.h.request('context.read','context:c', 'c',{resource:'space'});
 const target={owner:'connections/api',targetType:'model',targetId:f.m.id};const o=f.h.service.resolve(parent,target);assert.equal(o.status,'available');assert.equal(o.targetId,f.m.id);assert.equal(o.sourceRevision,'1');assert.equal('credentialRef'in o,false);assert.equal(f.h.query('model',f.m.id).value.observation,null);
 f.h.revoke();assert.equal(f.h.service.resolve(parent,target).status,'denied');
});
