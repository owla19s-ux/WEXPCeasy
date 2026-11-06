import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {startFoundations} from '../../dist/app/src/index.js';
// Platform cipher and native source identities are fixtures. Permissions, host lifecycle and SQLite are real.
test('host owns encrypted credentials, denies unbound callers, and closes the capability with its root',async t=>{
 const root=await mkdtemp(join(tmpdir(),'wex-vault-host-'));await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 const key=randomBytes(32),cipher={available:()=>true,seal(value){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([c.update(value,'utf8'),c.final()]);return Buffer.concat([iv,body,c.getAuthTag()]).toString('base64');},unseal(value){const b=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(-16));return Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString('utf8');}};
 const requests=new WeakMap(),approved=new WeakSet(),history={};
 const options={dataRoot:root,credentials:{cipher},trust:{current:r=>requests.get(r),canManage:c=>approved.has(c),canReadHistory:r=>r===history}};
 let host=await startFoundations(options);
 t.after(async()=>{await host.stop();await rm(root,{recursive:true,force:true});});
 assert.equal(host.status,'ready');assert.ok(host.credentials);
 const input={id:'key-a',intent:'create',expectedRevision:0,binding:{connectionId:'connection-a',endpoint:'https://example.test/v1/',provider:'fixture'},secret:'host-fixture-only-secret'};
 assert.equal(host.credentials.put({},input).status,'denied');
 const scope={subject:'user',entry:'native-fixture',conversation:null,context:null,resource:'credentials',action:'credential.write',target:'credential:key-a',relationship:'session',relationshipGeneration:1};
 const request={};requests.set(request,{...scope,kind:'local',entryEnabled:true,moduleEnabled:true,globalEnabled:true,sourceAllowed:true,conversationEnabled:false});
 let record=host.permissions.history(history);const change={intent:'grant',expectedRevision:record.revision,scope};approved.add(change);assert.equal(host.permissions.grant(change).status,'committed');
 const stored=host.credentials.put(request,input);assert.deepEqual(stored,{status:'committed',reference:{id:'key-a',revision:1}});
 assert.equal('resolve'in host.credentials,false);
 assert.equal(host.credentials.revoke(request,{id:'key-a',intent:'wrong-action',expectedRevision:1}).status,'denied');
 const facade=host.credentials;assert.equal((await host.stop()).status,'stopped');
 assert.equal(facade.put(request,{...input,intent:'late',expectedRevision:1}).status,'unavailable');
 assert.equal((await readFile(join(root,'wex-credentials.sqlite'))).includes(Buffer.from(input.secret)),false);
 host=await startFoundations(options);assert.equal(host.status,'ready');assert.ok(host.credentials);
});

test('private API credential delivery follows authoritative connection route and never exposes a resolver',async t=>{
 const root=await mkdtemp(join(tmpdir(),'wex-credential-api-'));await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 const cryptoKey=randomBytes(32),cipher={available:()=>true,seal(value){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',cryptoKey,iv),body=Buffer.concat([c.update(value,'utf8'),c.final()]);return Buffer.concat([iv,body,c.getAuthTag()]).toString('base64');},unseal(value){const b=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',cryptoKey,b.subarray(0,12));d.setAuthTag(b.subarray(-16));return Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString('utf8');}};
 const facts=new WeakMap(),approved=new WeakSet(),history={},requests=new Map();let host,n=0,fetches=0;
 const identity={subject:'user',entry:'fixture-window',conversation:null,relationship:'session',relationshipGeneration:1,kind:'local',entryEnabled:true,moduleEnabled:true,globalEnabled:true,sourceAllowed:true,conversationEnabled:false};
 const scope=(resource,action,target,context=null)=>({subject:identity.subject,entry:identity.entry,conversation:null,relationship:identity.relationship,relationshipGeneration:1,resource,action,target,context});
 const request=(resource,action,target,context=null)=>{
  const key=JSON.stringify([resource,action,target,context]);if(requests.has(key))return requests.get(key);
  const r={},s=scope(resource,action,target,context);facts.set(r,{...identity,...s});requests.set(key,r);
  const current=host.permissions.history(history),change={intent:'grant-'+(++n),expectedRevision:current.revision,scope:s};approved.add(change);assert.equal(host.permissions.grant(change).status,'committed');return r;
 };
 const apiRequest=(action,target)=>request('connections/api',action,target);
 const options={dataRoot:root,credentials:{cipher},trust:{current:r=>facts.get(r),canManage:c=>approved.has(c),canReadHistory:r=>r===history},
  api:{deriveRequest:(_parent,p)=>requests.get(JSON.stringify(['connections/api',p.action,p.target,p.context])),
   observer:{resolve(_request,connection,model){return {connectionId:connection.id,connectionRevision:connection.revision,modelId:model.modelId,source:'provider',sourceRevision:'fixture',observedAt:new Date().toISOString(),capabilities:{text:'supported',stream:'supported',tools:'unsupported',image:'unsupported',reasoning:'unknown'},parameters:{}};}}}};
 host=await startFoundations(options);
 // Only the HTTP response/OS encryption/native identity are fixtures. No external request or real Key.
 const originalFetch=globalThis.fetch,secret='fixture-token';
 globalThis.fetch=async(_url,init)=>{fetches++;assert.equal(new Headers(init.headers).get('authorization'),'Bearer '+secret);assert.equal(String(init.body).includes(secret),false);return new Response(JSON.stringify({choices:[{index:0,message:{role:'assistant',content:'fixture answer'},finish_reason:'stop'}]}),{status:200,headers:{'content-type':'application/json'}});};
 try{
  const conn=host.api.execute(apiRequest('connection.create','api:connections'),{kind:'connection.create',intent:'create-connection',name:'Fixture',provider:'fixture',protocol:'openai-chat',endpoint:'https://example.test/v1/',endpointMode:'base',credentialRef:{id:'key-a',revision:1},enabled:true,parameters:{}});assert.equal(conn.status,'committed');
  const model=host.api.execute(apiRequest('model.create','connection:'+conn.id),{kind:'model.create',intent:'create-model',connectionId:conn.id,name:'Fixture model',modelId:'fixture-model',parameters:{}});assert.equal(model.status,'committed');
  apiRequest('connection.read','connection:'+conn.id);apiRequest('model.read','model:'+model.id);
  const observe=()=>host.api.execute(apiRequest('model.observe','model:'+model.id),{kind:'model.observe',intent:'observe-'+(++n),id:model.id,expectedRevision:host.api.query(apiRequest('model.read','model:'+model.id),{kind:'model',id:model.id}).value.revision});
  assert.equal(observe().status,'committed');
  const stored=host.credentials.put(request('credentials','credential.write','credential:key-a'),{id:'key-a',intent:'save-key',expectedRevision:0,binding:{connectionId:conn.id,endpoint:'https://example.test/v1/',provider:'fixture'},secret});assert.equal(stored.status,'committed');
  apiRequest('request.prepare','model:'+model.id);const send=apiRequest('request.send','model:'+model.id);
  let input={requestId:'request-one',connectionId:conn.id,connectionRevision:1,modelId:model.id,modelRevision:2,context:null,parameters:{},messages:[{role:'user',content:'Hello'}],timeoutMs:1000,stream:false};
  assert.equal((await host.api.send(send,'operation-one',input)).status,'ok');assert.equal(fetches,1);
  assert.equal(JSON.stringify(host.connections.operations.get('operation-one')).includes(secret),false);
  const edit=host.api.execute(apiRequest('connection.edit','connection:'+conn.id),{kind:'connection.edit',intent:'new-endpoint',id:conn.id,expectedRevision:1,endpoint:'https://other.test/v1/'});assert.equal(edit.status,'committed');assert.equal(observe().status,'committed');
  input={...input,requestId:'request-two',connectionRevision:2,modelRevision:3};
  assert.equal((await host.api.send(send,'operation-two',input)).status,'blocked');assert.equal(fetches,1);
  assert.equal('resolve'in host.credentials,false);
 }finally{globalThis.fetch=originalFetch;await host.stop();await rm(root,{recursive:true,force:true});}
});
