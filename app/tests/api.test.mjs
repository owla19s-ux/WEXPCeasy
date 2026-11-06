import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {startFoundations} from '../../dist/app/src/index.js';
import {openSqliteStore} from '../../dist/shared/src/index.js';
async function fixture(t,extra={}){const dir=await mkdtemp(join(tmpdir(),'wex-api-host-')),root=join(dir,'data');await mkdir(root);await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'api-root'}));const source={},identity={subject:'user',entry:'window',relationship:'session',relationshipGeneration:1,moduleEnabled:true,globalEnabled:true,entryEnabled:true,sourceAllowed:true};const options={dataRoot:root,trust:{current:()=>undefined,canManage:()=>true,canReadHistory:()=>true},local:{current:r=>r===source?identity:undefined},api:{observer:{resolve(r,c,m){return {connectionId:c.id,connectionRevision:c.revision,modelId:m.modelId,source:'probe',sourceRevision:'fixture',observedAt:'2026-11-05T00:00:00Z',capabilities:{text:'supported',stream:'supported',tools:'unknown',image:'unknown',reasoning:'unknown'},parameters:{}};}}},...extra};let host=await startFoundations(options),revision=0,seq=0;const hosts=[host];t.after(async()=>{for(const h of hosts)await h.stop();await rm(dir,{recursive:true,force:true});});function request(action,target,resource='connections/api'){const op={resource,action,target,context:null};const scope={subject:identity.subject,entry:identity.entry,relationship:identity.relationship,relationshipGeneration:1,conversation:null,...op};const result=host.permissions.grant({intent:`grant-${++seq}`,expectedRevision:revision,scope});assert.equal(result.status,'committed');revision=result.revision;return host.local.bind(source,op);}return {root,options,hosts,source,request,get host(){return host;},async restart(){assert.equal((await host.stop()).status,'stopped');host=await startFoundations(options);hosts.push(host);return host;}};}
async function configure(h,url){assert.equal(h.host.status,'ready');assert.ok(h.host.api);const c=h.host.api.execute(h.request('connection.create','api:connections'),{kind:'connection.create',intent:'c',name:'Local',provider:'fixture',protocol:'openai-chat',endpoint:url,endpointMode:'base',credentialRef:null,enabled:true,parameters:{}});assert.equal(c.status,'committed');const m=h.host.api.execute(h.request('model.create',`connection:${c.id}`),{kind:'model.create',intent:'m',connectionId:c.id,name:'Chat',modelId:'fixture-chat',parameters:{}});assert.equal(m.status,'committed');assert.equal(h.host.api.execute(h.request('model.observe',`model:${m.id}`),{kind:'model.observe',intent:'observe',id:m.id,expectedRevision:1}).status,'committed');h.request('connection.read',`connection:${c.id}`);h.request('model.read',`model:${m.id}`);h.request('request.prepare',`model:${m.id}`);const send=h.request('request.send',`model:${m.id}`);return {c,m,send,input:{requestId:'request',connectionId:c.id,connectionRevision:1,modelId:m.id,modelRevision:2,context:null,parameters:{},messages:[{role:'user',content:'hello'}],timeoutMs:1000,stream:false}};}
test('host assembles real API with one Connections ledger and suppresses replay after restart',async t=>{let calls=0;const server=createServer((req,res)=>{calls++;res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({choices:[{index:0,message:{role:'assistant',content:'ok'},finish_reason:'stop'}]}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});const h=await fixture(t),f=await configure(h,`http://127.0.0.1:${server.address().port}/v1`);const r=await h.host.api.send(f.send,'host-api-operation',f.input);assert.equal(r.status,'ok');assert.equal(h.host.connections.operations.get('host-api-operation').phase,'observed');assert.equal(h.host.api.stop,undefined,'client cannot stop host-owned service');await h.restart();assert.equal(h.host.status,'ready');assert.equal(h.host.connections.operations.get('host-api-operation').phase,'observed');const again=h.host.local.bind(h.source,{resource:'connections/api',action:'request.send',target:`model:${f.m.id}`,context:null});assert.equal((await h.host.api.send(again,'host-api-operation',f.input)).status,'blocked');assert.equal(calls,1);});
test('API is absent by default and corrupt API data degrades only that optional module',async t=>{const h=await fixture(t,{api:undefined});assert.equal(h.host.api,undefined);assert.equal(h.host.connections,undefined);await h.host.stop();const db=openSqliteStore(join(h.root,'api-configurations.sqlite'),'api-configurations');db.commit({intent:'corrupt',expectedRevision:0,value:{format:99}});db.close();const host=await startFoundations({...h.options,api:{}});h.hosts.push(host);assert.equal(host.status,'degraded');assert.equal(host.api,undefined);assert.ok(host.connections);assert.ok(host.permissions);assert.ok(host.diagnostics.some(x=>x.module==='api'));});
test('API store close uncertainty retains root lock and retries shutdown',async t=>{let fail=true;const h=await fixture(t,{openStore(path,ns){const db=openSqliteStore(path,ns);return ns!=='api-configurations'?db:{...db,close(){if(fail){fail=false;throw Error('close uncertain');}db.close();}};}});assert.ok(h.host.api);assert.equal((await h.host.stop()).status,'incomplete');const rival=await startFoundations({dataRoot:h.root,trust:h.options.trust});h.hosts.push(rival);assert.equal(rival.status,'failed');assert.equal((await h.host.stop()).status,'stopped');});
test('host stop interrupts active API request and persists unknown before closing Operations',async t=>{let started;const ready=new Promise(r=>started=r);const server=createServer(()=>started());await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});let phaseAtClose;const h=await fixture(t,{openStore(path,ns){const db=openSqliteStore(path,ns);return ns!=='connection-operations'?db:{...db,close(){phaseAtClose=db.read().value.operations[0]?.phase;db.close();}};}}),f=await configure(h,`http://127.0.0.1:${server.address().port}`);const pending=h.host.api.send(f.send,'pending',f.input);await ready;const stop=h.host.stop();assert.equal(h.host.local.bind(h.source,{resource:'connections/api',action:'request.send',target:`model:${f.m.id}`,context:null}),undefined);assert.equal((await stop).status,'stopped');assert.equal((await pending).status,'unknown');assert.equal(phaseAtClose,'unknown');assert.equal((await h.host.api.send(f.send,'late',f.input)).status,'blocked');});
test('generic connectors and API share operation ID reservations without duplicate dispatch',async t=>{let genericCalls=0;const h=await fixture(t,{connections:{adapters:[{id:'fixture',version:'1',async execute(){genericCalls++;return {ok:true};}}]}}),f=await configure(h,'http://127.0.0.1:1');const config=h.host.connections.configs.put({id:'generic',adapter:'fixture',endpoint:'local:fixture',credentialRef:null,enabled:true},0,'generic-config');assert.equal(config.status,'ok',JSON.stringify(config));const request=h.request('write','target','fixture');assert.equal((await h.host.connections.dispatch('fixture',request,'collision','generic',1,'target','payload',{})).status,'observed');assert.equal((await h.host.api.send(f.send,'collision',f.input)).status,'blocked');assert.equal(genericCalls,1);});
test('failed API initialization retains unclosed partial store for shutdown retry',async t=>{let attempts=0;const h=await fixture(t,{api:{maxSnapshotBytes:0},openStore(path,ns){const db=openSqliteStore(path,ns);return ns!=='api-configurations'?db:{...db,close(){if(++attempts<=2)throw Error('partial-close');db.close();}};}});assert.equal(h.host.status,'degraded');assert.equal(h.host.api,undefined);assert.equal((await h.host.stop()).status,'incomplete');const busy=await startFoundations({dataRoot:h.root,trust:h.options.trust});h.hosts.push(busy);assert.equal(busy.status,'failed');assert.equal((await h.host.stop()).status,'stopped');assert.equal(attempts,3);});
test('unavailable Connections storage blocks API assembly without damaging permissions',async t=>{const h=await fixture(t,{openStore(path,ns){if(ns==='connection-operations')throw Error('offline');return openSqliteStore(path,ns);}});assert.equal(h.host.status,'degraded');assert.equal(h.host.api,undefined);assert.equal(h.host.connections,undefined);assert.ok(h.host.permissions);assert.ok(h.host.diagnostics.some(x=>x.module==='api'&&x.reason==='dependency_unavailable'));assert.equal((await h.host.stop()).status,'stopped');});
test('saved API client cannot mutate configurations after host shutdown',async t=>{const h=await fixture(t),f=await configure(h,'http://127.0.0.1:1'),client=h.host.api;const read=h.request('model.read',`model:${f.m.id}`);assert.equal(client.query(read,{kind:'model',id:f.m.id}).status,'ok');await h.host.stop();assert.equal(client.query(read,{kind:'model',id:f.m.id}).status,'unavailable');assert.equal(client.execute(f.send,{kind:'connection.edit',intent:'late',id:f.c.id,expectedRevision:1,enabled:false}).status,'unavailable');});

test('AI host binds model and configuration reads to independently granted scopes', async t => {
 let h;
 h = await fixture(t, {ai: {bindRead(_parent, scope) {
  return h.host.local.bind(h.source, scope);
 }}});
 const {c, m} = await configure(h, 'http://127.0.0.1:1');
 const ai = h.host.ai;
 function save(id, value, request = h.request(value.kind+'.write', value.kind+':'+id, 'AI')) {
  return ai.save(request, {id, value, intent:id, expectedRevision:0});
 }
 assert.equal(save('role', {kind:'role',name:'Reviewer',prompt:'Review'}).status,'committed');
 assert.equal(save('position', {kind:'position',name:'Review',responsibility:'Check'}).status,'committed');
 const agent = {kind:'agent',name:'Worker',roleId:'role',positionId:'position',
  model:{connectionId:c.id,modelId:m.id}};
 const write = h.request('agent.write','agent:agent','AI');
 assert.equal(save('agent',agent,write).status,'reference_unavailable');
 h.request('role.read','role:role','AI');
 h.request('position.read','position:position','AI');
 assert.equal(save('agent',agent,write).status,'committed');
 const read = h.request('agent.read','agent:agent','AI');
 assert.equal(ai.read(read,'agent','agent').status,'ok');
 await h.restart();
 assert.equal(ai.read(read,'agent','agent').status,'denied');
 const fresh = h.host.local.bind(h.source,{resource:'AI',action:'agent.read',target:'agent:agent',context:null});
 assert.deepEqual(h.host.ai.read(fresh,'agent','agent').entry.model,agent.model);
});

test('host conversation storage restores messages under fresh entry bindings', async t => {
 const h = await fixture(t, {conversations:true});
 const {service} = h.host.conversations;
 const create = h.request('create','conversation:chat','conversations');
 const read = h.request('read','conversation:chat','conversations');
 const input = {conversationId:'chat',intent:'create',expectedRevision:0,change:{kind:'create'}};
 assert.equal(service.change(read,input).status,'denied');
 assert.equal(service.change(create,input).status,'committed');
 const append = h.request('append','conversation:chat','conversations');
 assert.equal(service.change(append,{conversationId:'chat',intent:'append',expectedRevision:1,
  change:{kind:'append',messageId:'input',segments:[{id:'p',text:'hello'}]}}).status,'committed');
 await h.restart();
 assert.equal(h.host.conversations.service.read(read,'chat').status,'denied');
 const fresh = h.host.local.bind(h.source,{resource:'conversations',action:'read',target:'conversation:chat',context:null});
 assert.equal(h.host.conversations.service.read(fresh,'chat').conversation.messages[0].segments[0].text,'hello');
});
