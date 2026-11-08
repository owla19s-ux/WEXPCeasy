import test from 'node:test';
import assert from 'node:assert/strict';
import {applyConfigMutation} from '../../../dist/connections/api/src/config-mutations.js';

const state=()=>({format:1,domain:'api-configurations',connections:[],models:[],intents:[]});
const create={kind:'connection.create',intent:'new',name:'primary',provider:'custom',protocol:'openai-chat',
 endpoint:'https://api.example.test/v1',endpointMode:'base',credentialRef:null,enabled:true,parameters:{}};
const model={kind:'model.create',intent:'model',name:'Example',modelId:'model-a',parameters:{}};
let serial=0;
const id=()=>`api-${++serial}`;

test('config mutation creates independently versioned connection and model records',()=>{
 serial=0;const s=state();
 const c=applyConfigMutation(s,create,id);
 const m=applyConfigMutation(s,{...model,connectionId:c.id},id);
 assert.equal(c.revision,1);assert.equal(m.connectionId,c.id);
 assert.equal(s.connections.length,1);assert.equal(s.models.length,1);
 assert.equal(s.intents.length,0);
});

test('connection copy is independent, disabled and omits credential reference',()=>{
 serial=0;const s=state();
 const c=applyConfigMutation(s,create,id);
 c.credentialRef={id:'secret-id',revision:1};
 const copy=applyConfigMutation(s,{kind:'connection.copy',intent:'copy',id:c.id,expectedRevision:1,name:'secondary'},id);
 assert.notEqual(copy.id,c.id);
 assert.equal(copy.name,'secondary');
 assert.equal(copy.enabled,false);
 assert.equal(copy.credentialRef,null);
 assert.equal(copy.revision,1);
 assert.equal(c.enabled,true);
});

test('model references and stale revisions block unsafe configuration edits',()=>{
 serial=0;const s=state();
 const c=applyConfigMutation(s,create,id);
 const m=applyConfigMutation(s,{...model,connectionId:c.id},id);
 assert.throws(()=>applyConfigMutation(s,{kind:'connection.delete',intent:'remove',id:c.id,expectedRevision:1},id),/resource_referenced/);
 assert.throws(()=>applyConfigMutation(s,{kind:'model.edit',intent:'edit',id:m.id,expectedRevision:2,name:'changed'},id),/revision_conflict/);
 assert.equal(s.models[0].name,'Example');
 assert.deepEqual(applyConfigMutation(s,{kind:'model.delete',intent:'drop-model',id:m.id,expectedRevision:1},id),{id:m.id,revision:2});
 assert.deepEqual(applyConfigMutation(s,{kind:'connection.delete',intent:'drop-connection',id:c.id,expectedRevision:1},id),{id:c.id,revision:2});
 assert.equal(s.connections.length,0);
});

test('same model id cannot be registered twice under a connection',()=>{
 serial=0;const s=state();
 const c=applyConfigMutation(s,create,id);
 applyConfigMutation(s,{...model,connectionId:c.id},id);
 assert.throws(()=>applyConfigMutation(s,{...model,intent:'model-again',connectionId:c.id},id),/duplicate_model_unsupported/);
});
