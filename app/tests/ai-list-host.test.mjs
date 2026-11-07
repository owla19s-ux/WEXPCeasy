import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startFoundations} from '../../dist/app/src/index.js';
async function fixture(t,{api=false}={}){
 const root=await mkdtemp(join(tmpdir(),'wex-ai-list-host-'));
 await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 const facts=new WeakMap(),scopes=new WeakMap(),approved=new WeakSet(),requests=new Map(),history={};
 let host,n=0,binder;
 const scope=(resource,action,target,context=null,patch={})=>({subject:'user',entry:'native-fixture',conversation:null,context,resource,action,target,relationship:'session',relationshipGeneration:1,...patch});
 const lookup=(resource,action,target,context=null)=>requests.get(JSON.stringify(scope(resource,action,target,context)));
 binder=(_parent,s)=>lookup(s.resource,s.action,s.target,s.context);
 const options={dataRoot:root,trust:{current:r=>facts.get(r),canManage:c=>approved.has(c),canReadHistory:r=>r===history},
  ai:{bindRead:(parent,s)=>binder(parent,s)},
  ...(api?{api:{deriveRequest:(_parent,s)=>lookup('connections/api',s.action,s.target,s.context)}}:{})};
 host=await startFoundations(options);assert.equal(host.status,'ready');
 t.after(async()=>{await host.stop();await rm(root,{recursive:true,force:true});});
 function request(resource,action,target,context=null,patch={}){
  const s=scope(resource,action,target,context,patch),key=JSON.stringify(s);if(requests.has(key))return requests.get(key);
  const r={};facts.set(r,{...s,kind:s.conversation===null?'local':'conversation',entryEnabled:true,moduleEnabled:true,globalEnabled:true,conversationEnabled:true,sourceAllowed:true});
  scopes.set(r,s);requests.set(key,r);
  const change={intent:'grant-'+(++n),expectedRevision:host.permissions.history(history).revision,scope:s};
  approved.add(change);assert.equal(host.permissions.grant(change).status,'committed');return r;
 }
 function save(id,value){
  const r=request('AI',value.kind+'.write',value.kind+':'+id);
  assert.equal(host.ai.save(r,{id,intent:'save-'+id,expectedRevision:0,value}).status,'committed');
 }
 save('a',{kind:'role',name:'Visible',prompt:'Authorized prompt'});
 save('b',{kind:'role',name:'Hidden',prompt:'Private prompt'});
 save('p',{kind:'position',name:'Position',responsibility:'Review'});
 return {request,lookup,save,get host(){return host;},
  bind(fn){binder=fn;},
  revoke(r){const change={intent:'revoke-'+(++n),expectedRevision:host.permissions.history(history).revision,scope:scopes.get(r)};
   approved.add(change);assert.equal(host.permissions.revoke(change).status,'committed');},
  async reopen(){assert.equal((await host.stop()).status,'stopped');host=await startFoundations(options);assert.equal(host.status,'ready');},
  seedAgent(){
   const connection=host.api.execute(request('connections/api','connection.create','api:connections'),{
    kind:'connection.create',intent:'api-connection',name:'Fixture',provider:'fixture',protocol:'openai-chat',
    endpoint:'https://example.test/v1/',endpointMode:'base',credentialRef:null,enabled:true,parameters:{}});
   assert.equal(connection.status,'committed');
   const model=host.api.execute(request('connections/api','model.create','connection:'+connection.id),{
    kind:'model.create',intent:'api-model',connectionId:connection.id,name:'Fixture model',modelId:'fixture-model',parameters:{}});
   assert.equal(model.status,'committed');
   request('AI','role.read','role:a');request('AI','position.read','position:p');
   request('connections/api','connection.read','connection:'+connection.id);request('connections/api','model.read','model:'+model.id);
   save('agent',{kind:'agent',name:'Agent',roleId:'a',positionId:'p',model:{connectionId:connection.id,modelId:model.id}});
   return {connectionId:connection.id,modelId:model.id};
  }};
}
test('AI host lists need exact namespace and independent row grants',async t=>{
 const h=await fixture(t),list=h.request('AI','role.list','role:*');
 assert.deepEqual(h.host.ai.list(list,'role'),{status:'ok',entries:[]});
 const read=h.request('AI','role.read','role:a');
 assert.deepEqual(h.host.ai.list(read,'role'),{status:'denied'});
 const result=h.host.ai.list(list,'role');
 assert.deepEqual(result.entries.map(x=>x.id),['a']);assert.ok(!JSON.stringify(result).includes('Private prompt'));
 assert.deepEqual(h.host.ai.list(list,'position'),{status:'denied'});
 assert.deepEqual(h.host.ai.list(h.request('AI','role.list','role:a'),'role'),{status:'denied'});
 assert.deepEqual(h.host.ai.list({},'role'),{status:'denied'});
});
test('AI host cannot substitute a separately authorized actor relationship or context',async t=>{
 const h=await fixture(t),list=h.request('AI','role.list','role:*');h.request('AI','role.read','role:a');
 for(const patch of [{subject:'other'},{entry:'other-entry'},{conversation:'other-chat'},{relationship:'other'},{relationshipGeneration:2},{context:'ctx'}]){
  const other=h.request('AI','role.read','role:b',null,patch);
  assert.equal(h.host.ai.read(other,'role','b').status,'ok');
  h.bind((_parent,s)=>s.target==='role:b'?other:h.lookup(s.resource,s.action,s.target,s.context));
  assert.deepEqual(h.host.ai.list(list,'role').entries.map(x=>x.id),['a']);
 }
});
test('AI host rechecks the initial permission decision after late row revocation and restores it durably',async t=>{
 const h=await fixture(t),list=h.request('AI','role.list','role:*'),a=h.request('AI','role.read','role:a');
 h.request('AI','role.read','role:b');let bCalls=0;
 h.bind((_parent,s)=>{
  if(s.target==='role:b'&&++bCalls===2)h.revoke(a);
  return h.lookup(s.resource,s.action,s.target,s.context);
 });
 assert.deepEqual(h.host.ai.list(list,'role'),{status:'denied'});
 assert.equal(h.host.ai.read(a,'role','a').status,'denied');
 h.bind((_parent,s)=>h.lookup(s.resource,s.action,s.target,s.context));
 const before=h.host.ai;await h.reopen();
 assert.deepEqual(before.list(list,'role'),{status:'denied'});
 assert.deepEqual(h.host.ai.list(list,'role').entries.map(x=>x.id),['b']);
});
test('AI host enumerates all configuration kinds through real API references without generating',async t=>{
 const h=await fixture(t,{api:true}),model=h.seedAgent();
 h.request('AI','agent.read','agent:agent');
 const agent=h.host.ai.list(h.request('AI','agent.list','agent:*'),'agent');
 assert.equal(agent.status,'ok');assert.equal(agent.entries.length,1);assert.deepEqual(agent.entries[0].model,model);
 assert.deepEqual(h.host.ai.list(h.request('AI','position.list','position:*'),'position').entries.map(x=>x.id),['p']);
 assert.deepEqual(h.host.ai.list(h.request('AI','role.list','role:*'),'role').entries.map(x=>x.id),['a']);
 assert.equal(h.host.connections.operations.read().operations.length,0);
 const old=agent;await h.reopen();
 assert.deepEqual(h.host.ai.list(h.request('AI','agent.list','agent:*'),'agent'),old);
});
