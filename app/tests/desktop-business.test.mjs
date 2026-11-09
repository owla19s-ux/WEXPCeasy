import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {startFoundations} from '../../dist/app/src/index.js';
import {createDesktopAuthority} from '../../dist/app/src/desktop-authority.js';
import {createDesktopApi} from '../../dist/app/src/desktop-api.js';
async function fixture(t,withFiles=false){
 const {createDesktopAi}=await import('../../dist/app/src/desktop-ai.js');
 const {createDesktopConversations}=await import('../../dist/app/src/desktop-conversations.js');
 const root=await mkdtemp(join(tmpdir(),'wex-desktop-business-'));
 await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'business'}));
 let consent=true,mode='normal',release,arrived;const calls=[],deltas=[];
 const server=createServer(async(req,res)=>{
  const chunks=[];for await(const b of req)chunks.push(b);
  const value=JSON.parse(Buffer.concat(chunks).toString());calls.push(value);
  res.writeHead(200,{'content-type':'text/event-stream'});
  res.write('data: '+JSON.stringify({choices:[{index:0,delta:{content:'hello '},finish_reason:null}]})+'\n\n');
  if(mode==='wait'){arrived?.();await new Promise(r=>release=r);if(res.destroyed)return;}
  res.end('data: '+JSON.stringify({choices:[{index:0,delta:{content:'world'},finish_reason:null}]})+'\n\ndata: '+JSON.stringify({choices:[{index:0,delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const authority=createDesktopAuthority(),confirm=async()=>consent;
 const api=createDesktopApi({authority,confirm,requestCredential:async()=>undefined,cancelCredential(){}});
 const {createDesktopSpace}=await import('../../dist/app/src/desktop-space.js');
 const contextDirectory=join(root,'attachment-context');if(withFiles){await mkdir(contextDirectory);await writeFile(join(contextDirectory,'.wex-root.json'),JSON.stringify({format:1,id:'attachment-context'}));}
 const space=withFiles?createDesktopSpace({authority,rootId:'business',confirm,chooseDirectory:async()=>contextDirectory}):undefined;
 const ai=createDesktopAi({authority,confirm}),chat=createDesktopConversations({authority,confirm,onText:v=>deltas.push(v),readAttachment:space?input=>space.request({kind:'resource.read',contextId:input.contextId,id:input.addressId,mode:'file'}):undefined});
 const options={dataRoot:root,...authority.policy,api:{deriveRequest:api.derive},ai:{bindRead:ai.bindRead},conversations:true,...(withFiles?{space:{},localFiles:{coordinateWrites:true}}:{})};
 const host=await startFoundations(options);api.attach(host);ai.attach(host);chat.attach(host);space?.attach(host);
 t.after(async()=>{release?.();chat.close();space?.close();ai.close();api.close();await host.stop();server.closeAllConnections();server.close();await rm(root,{recursive:true,force:true});});
 return {root,host,authority,api,ai,chat,space,calls,deltas,endpoint:'http://127.0.0.1:'+server.address().port+'/v1',deny(){consent=false;},allow(){consent=true;},wait(){mode='wait';return new Promise(r=>arrived=r);},release(){release?.();}};
}
async function configured(f){
 const c=await f.api.request({kind:'connection.create',name:'Loopback',provider:'fixture',endpoint:f.endpoint,endpointMode:'base',enabled:true});assert.equal(c.status,'committed');
 const m=await f.api.request({kind:'model.create',connectionId:c.id,name:'Chat',modelId:'fixture'});assert.equal(m.status,'committed');
 assert.equal((await f.api.request({kind:'model.probe',id:m.id,expectedRevision:1,stream:true})).status,'committed');
 const role=await f.ai.request({kind:'save',id:'role',expectedRevision:0,value:{kind:'role',name:'Reader',prompt:'Be precise.'}});assert.equal(role.status,'committed');
 assert.equal((await f.ai.request({kind:'save',id:'position',expectedRevision:0,value:{kind:'position',name:'Engineer',responsibility:'Answer carefully.'}})).status,'committed');
 assert.equal((await f.ai.request({kind:'save',id:'agent',expectedRevision:0,value:{kind:'agent',name:'Assistant',roleId:'role',positionId:'position',model:{connectionId:c.id,modelId:m.id}}})).status,'committed');
 return {c,m};
}
test('desktop AI uses real API references, native consent, stale revisions and filtered lists',async t=>{
 const f=await fixture(t);await configured(f);
 const snapshot=await f.ai.request({kind:'snapshot'});assert.equal(snapshot.status,'ok');assert.equal(snapshot.entries.length,3);
 f.deny();assert.equal((await f.ai.request({kind:'snapshot'})).status,'cancelled');f.allow();
 assert.equal((await f.ai.request({kind:'save',id:'role',expectedRevision:0,value:{kind:'role',name:'stale',prompt:'wrong'}})).status,'revision_conflict');
 assert.equal((await f.ai.request({kind:'save',id:'bad',expectedRevision:0,value:{kind:'agent',name:'Bad',roleId:'role',positionId:'position',model:{connectionId:'missing',modelId:'missing'}}})).status,'reference_unavailable');
 assert.equal((await f.ai.request({kind:'save',id:'injected',expectedRevision:0,value:{kind:'role',name:'Role',prompt:'text',permissions:'all'}})).status,'rejected');
});
test('desktop conversation real SSE commits history, resend preserves messages and cancellation does not claim remote stop',async t=>{
 const f=await fixture(t);await configured(f);
 const created=await f.chat.request({kind:'create'});assert.equal(created.status,'committed');
 const id=created.id;
 const sent=await f.chat.request({kind:'send',id,expectedRevision:1,agentId:'agent',text:'question'});assert.equal(sent.status,'committed');
 const opened=await f.chat.request({kind:'open',id});assert.equal(opened.status,'ok');assert.equal(opened.conversation.messages.length,2);
 assert.equal(opened.conversation.messages[1].segments[0].text,'hello world');assert.ok(f.deltas.length>0);
 const rev=opened.conversation.revision,original=opened.conversation.messages[0].id;
 assert.equal((await f.chat.request({kind:'resend',id,expectedRevision:rev,agentId:'agent',text:'corrected',replaces:original})).status,'committed');
 const revised=await f.chat.request({kind:'open',id});assert.equal(revised.conversation.messages.length,4);assert.equal(revised.conversation.messages[2].replaces,original);
 assert.equal((await f.chat.request({kind:'snapshot'})).conversations.length,1);
 const waiting=f.wait(),job=f.chat.request({kind:'send',id,expectedRevision:revised.conversation.revision,agentId:'agent',text:'cancel me'});await waiting;
 assert.equal(f.chat.cancel().status,'committed');f.release();await job;
 const final=await f.chat.request({kind:'open',id});assert.equal(final.conversation.generations.at(-1).status,'cancelled');
 const before=f.calls.length;await f.chat.request({kind:'send',id,expectedRevision:1,agentId:'agent',text:'stale'});assert.equal(f.calls.length,before);
 f.deny();assert.equal((await f.chat.request({kind:'open',id})).status,'cancelled');
});
test('permissions UI projects only this session and revocation invalidates admitted requests',async t=>{
 const f=await fixture(t);await configured(f);
 const result=await f.authority.settings({kind:'snapshot'},async()=>true);assert.equal(result.status,'ok');assert.ok(result.entries.length);
 const one=result.entries[0];const op={resource:one.resource,action:one.action,target:one.target,context:one.context};
 const request=f.authority.bind(op);assert.equal(f.host.permissions.evaluate(request).status,'allow');
 assert.equal((await f.authority.settings({kind:'revoke',id:one.id,expectedRevision:result.revision},async()=>true)).status,'committed');
 assert.notEqual(f.host.permissions.evaluate(request).status,'allow');
 assert.equal((await f.authority.settings({kind:'grant',scope:{}},async()=>true)).status,'rejected');
});

test('desktop configuration and conversation history restore under a fresh window identity without replaying network work',async t=>{
 const f=await fixture(t);await configured(f);
 const created=await f.chat.request({kind:'create'});
 await f.chat.request({kind:'send',id:created.id,expectedRevision:1,agentId:'agent',text:'persist this'});
 const before=f.calls.length;
 const oldSnapshot=await f.authority.settings({kind:'snapshot'},async()=>true);
 const oldRequest=f.authority.bind({resource:oldSnapshot.entries[0].resource,action:oldSnapshot.entries[0].action,target:oldSnapshot.entries[0].target,context:oldSnapshot.entries[0].context});
 f.chat.close();f.ai.close();f.api.close();assert.equal((await f.host.stop()).status,'stopped');
 const {createDesktopAi}=await import('../../dist/app/src/desktop-ai.js');
 const {createDesktopConversations}=await import('../../dist/app/src/desktop-conversations.js');
 const authority=createDesktopAuthority(),confirm=async()=>true;
 const api=createDesktopApi({authority,confirm,requestCredential:async()=>undefined,cancelCredential(){}});
 const ai=createDesktopAi({authority,confirm}),chat=createDesktopConversations({authority,confirm});
 const host=await startFoundations({dataRoot:f.root,...authority.policy,api:{deriveRequest:api.derive},ai:{bindRead:ai.bindRead},conversations:true});api.attach(host);ai.attach(host);chat.attach(host);
 try{
  assert.notEqual(host.permissions.evaluate(oldRequest).status,'allow');
  assert.equal((await ai.request({kind:'snapshot'})).entries.length,3);
  const history=await chat.request({kind:'snapshot'});assert.equal(history.conversations.length,1);
  assert.equal(history.conversations[0].messages[1].segments[0].text,'hello world');
  assert.equal(f.calls.length,before);
 }finally{chat.close();ai.close();api.close();await host.stop();}
});
test('revoked history visibility fences streaming while the admitted cancellation remains available',async t=>{
 const f=await fixture(t);await configured(f);
 const created=await f.chat.request({kind:'create'}),waiting=f.wait();
 const job=f.chat.request({kind:'send',id:created.id,expectedRevision:1,agentId:'agent',text:'hold'});
 await waiting;
 const snapshot=await f.authority.settings({kind:'snapshot'},async()=>true);
 const row=snapshot.entries.find(e=>e.resource==='conversations'&&e.action==='read'&&e.target==='conversation:'+created.id);
 assert.equal((await f.authority.settings({kind:'revoke',id:row.id,expectedRevision:snapshot.revision},async()=>true)).status,'committed');
 assert.equal(f.chat.cancel().status,'committed');f.release();await job;
});

test('connections settings require consent and preserve global configuration revision conflicts',async t=>{
 const f=await fixture(t);
 const {createDesktopConnections}=await import('../../dist/app/src/desktop-connections.js');
 const controls=createDesktopConnections({authority:f.authority,confirm:async()=>true});controls.attach(f.host);
 assert.equal(f.host.connections.configs.put({id:'local-test',adapter:'local',endpoint:'local:files',credentialRef:null,enabled:true},0,'fixture-local').status,'ok');
 const snapshot=await controls.request({kind:'snapshot'});assert.equal(snapshot.status,'ok');assert.equal(snapshot.connections[0].id,'local-test');assert.equal('credentialRef'in snapshot.connections[0],false);
 assert.equal((await controls.request({kind:'toggle',id:'local-test',expectedRevision:snapshot.revision,enabled:false})).status,'committed');
 assert.equal((await controls.request({kind:'toggle',id:'local-test',expectedRevision:snapshot.revision,enabled:true})).status,'conflict');
 assert.equal(f.host.connections.configs.get('local-test').enabled,false);
 assert.equal((await controls.request({kind:'toggle',id:'local-test',expectedRevision:2,enabled:true,scope:'admin'})).status,'rejected');
 controls.close();assert.equal((await controls.request({kind:'snapshot'})).status,'unavailable');
});

test('desktop GitHub config, isolated credential, official SDK read/write, conflicts and unknown receipts',async t=>{
 const {createDesktopConnections}=await import('../../dist/app/src/desktop-connections.js');
 const root=await mkdtemp(join(tmpdir(),'wex-desktop-github-'));
 await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'github-desktop'}));
 const authority=createDesktopAuthority();let approved=true,secret='fixture-token',mode='ok',writes=0;
 const calls=[],sha='a'.repeat(40),next='b'.repeat(40),commit='c'.repeat(40);
 let credentialWait;
 const confirm=async()=>approved;
 const controls=createDesktopConnections({authority,confirm,requestCredential:async()=>credentialWait?await credentialWait:secret,cancelCredential(){}});
 const host=await startFoundations({dataRoot:root,...authority.policy,credentials:{cipher:{
  available:()=>true,seal:s=>'fixture:'+Buffer.from(s).toString('base64'),unseal:s=>Buffer.from(s.slice(8),'base64').toString()
 }},githubOfficial:{fetch:async(url,init)=>{
  calls.push({url:String(url),method:init?.method??'GET',authorization:new Headers(init?.headers).get('authorization')});
  if(init?.method==='PUT'){
   writes++;if(mode==='unknown')throw Error('fixture transport disconnected');
   const body=JSON.parse(init.body);assert.equal(body.sha,sha);assert.equal(Buffer.from(body.content,'base64').toString(),'edited');
   if(mode==='conflict')return new Response(JSON.stringify({message:'conflict'}),{status:409,headers:{'content-type':'application/json'}});
   return new Response(JSON.stringify({content:{path:'README.md',sha:next},commit:{sha:commit}}),{status:200,headers:{'content-type':'application/json'}});
  }
  return new Response(JSON.stringify({type:'file',path:'README.md',sha,encoding:'base64',content:Buffer.from('original').toString('base64'),size:8}),{status:200,headers:{'content-type':'application/json'}});
 }}});
 controls.attach(host);
 t.after(async()=>{controls.close();await host.stop();await rm(root,{recursive:true,force:true});});
 let snap=await controls.request({kind:'snapshot'});assert.equal(snap.status,'ok');
 const created=await controls.request({kind:'github.create',expectedRevision:snap.revision});assert.equal(created.status,'committed');
 snap=await controls.request({kind:'snapshot'});const id=snap.connections[0].id;
 assert.equal((await controls.request({kind:'credential.set',id,expectedRevision:snap.revision,secret:'injected'})).status,'rejected');
 assert.equal((await controls.request({kind:'credential.set',id,expectedRevision:snap.revision})).status,'committed');
 snap=await controls.request({kind:'snapshot'});assert.equal(snap.connections[0].hasCredential,true);assert.equal(JSON.stringify(snap).includes(secret),false);
 const file={owner:'example',repo:'project',ref:'main',path:'README.md'};
 const read=await controls.request({kind:'github.read',id,expectedRevision:snap.revision,file});assert.equal(read.status,'file');assert.equal(read.content,'original');assert.equal(read.sha,sha);
 assert.equal(calls[0].authorization,'token '+secret);
 const input={kind:'github.write',id,expectedRevision:snap.revision,file,expectedSha:sha,content:'edited',message:'Edit from desktop'};
 approved=false;assert.equal((await controls.request(input)).status,'cancelled');assert.equal(writes,0);approved=true;
 let result=await controls.request(input);assert.equal(result.status,'written');assert.equal(result.sha,next);assert.equal(result.commitSha,commit);
 mode='conflict';result=await controls.request(input);assert.equal(result.status,'rejected');assert.equal(result.reason,'github_version_or_validation_conflict');
 mode='unknown';result=await controls.request(input);assert.equal(result.status,'unknown');const before=writes;
 const history=await controls.request({kind:'snapshot'});assert.ok(history.operations.some(o=>o.id===result.operationId&&o.phase==='unknown'));assert.equal(writes,before);
 assert.equal((await controls.request({...input,file:{...file,path:'../unsafe'}})).status,'rejected');assert.equal(writes,before);
 assert.equal((await controls.request({...input,expectedRevision:0})).status,'rejected');

 // Revocation while the secure modal is open must prevent the late secret from regranting configuration access.
 let releaseSecret;credentialWait=new Promise(resolve=>releaseSecret=resolve);
 const replacing=controls.request({kind:'credential.set',id,expectedRevision:snap.revision});
 await new Promise(resolve=>setImmediate(resolve));
 const grants=await authority.settings({kind:'snapshot'},confirm);
 const grant=grants.entries.find(e=>e.resource==='connections'&&e.action==='configuration.write'&&e.target==='connection:'+id);assert.ok(grant);
 assert.equal((await authority.settings({kind:'revoke',id:grant.id,expectedRevision:grants.revision},confirm)).status,'committed');
 releaseSecret('late-fixture-token');assert.equal((await replacing).status,'rejected');credentialWait=undefined;
 assert.equal((await controls.request({kind:'credential.revoke',id,expectedRevision:snap.revision})).status,'committed');
 snap=await controls.request({kind:'snapshot'});assert.equal(snap.connections[0].enabled,false);assert.equal(snap.connections[0].hasCredential,false);
 assert.notEqual((await controls.request({kind:'github.read',id,expectedRevision:snap.revision,file})).status,'file');
});

test('desktop append saves a user message without a model or network and respects consent and revision',async t=>{
 const f=await fixture(t),created=await f.chat.request({kind:'create'}),id=created.id;
 f.deny();assert.equal((await f.chat.request({kind:'append',id,expectedRevision:1,text:'private draft'})).status,'cancelled');f.allow();
 assert.equal((await f.chat.request({kind:'append',id,expectedRevision:1,text:'saved without generation'})).status,'committed');
 let opened=await f.chat.request({kind:'open',id});assert.equal(opened.conversation.messages[0].segments[0].text,'saved without generation');assert.equal(opened.conversation.generations.length,0);assert.equal(f.calls.length,0);
 assert.equal((await f.chat.request({kind:'append',id,expectedRevision:1,text:'stale'})).status,'revision_conflict');
 assert.equal((await f.chat.request({kind:'append',id,expectedRevision:2,text:'unsafe',agentId:'admin'})).status,'rejected');
 opened=await f.chat.request({kind:'open',id});assert.equal(opened.conversation.messages.length,1);
});

test('desktop file references require a current authorized Local observation and preserve metadata without generating',async t=>{
 const f=await fixture(t,true);
 const {pathToFileURL}=await import('node:url');
 const path=join(f.root,'input.txt');await writeFile(path,'private file body');
 const context=await f.space.request({kind:'context.create',name:'Attachment source'});
 const address=await f.space.request({kind:'address.add',contextId:context.id,name:'Input',address:pathToFileURL(path).href,purpose:['reference']});
 const read=await f.space.request({kind:'resource.read',contextId:context.id,id:address.id,mode:'file'});assert.equal(read.status,'ok');
 const created=await f.chat.request({kind:'create'}),attachments=[{kind:'local-reference',contextId:context.id,addressId:address.id,version:read.version,mime:'text/plain'}];
 assert.equal((await f.chat.request({kind:'append',id:created.id,expectedRevision:1,text:'see reference',attachments})).status,'committed');
 const opened=await f.chat.request({kind:'open',id:created.id});assert.deepEqual(opened.conversation.messages[0].segments[1].source,attachments[0]);assert.equal(JSON.stringify(opened).includes('private file body'),false);assert.equal(f.calls.length,0);
 await writeFile(path,'changed externally');
 assert.equal((await f.chat.request({kind:'append',id:created.id,expectedRevision:2,text:'stale',attachments})).status,'rejected');
 assert.equal((await f.chat.request({kind:'open',id:created.id})).conversation.messages.length,1);
});

test('original Operation receipt requires explicit native consent and reads durable results without replay',async t=>{
 const f=await fixture(t);await configured(f);
 const created=await f.chat.request({kind:'create'});await f.chat.request({kind:'send',id:created.id,expectedRevision:1,agentId:'agent',text:'receipt'});
 const opened=await f.chat.request({kind:'open',id:created.id}),operationId=opened.conversation.generations[0].operationId;
 const {createDesktopConnections}=await import('../../dist/app/src/desktop-connections.js');let allowed=false;
 const controls=createDesktopConnections({authority:f.authority,confirm:async()=>allowed});controls.attach(f.host);
 try{
  const before=f.calls.length;
  assert.equal((await controls.request({kind:'operation.read',id:operationId})).status,'cancelled');allowed=true;
  const result=await controls.request({kind:'operation.read',id:operationId});assert.equal(result.status,'operation');assert.equal(result.operation.id,operationId);assert.equal(result.operation.phase,'observed');assert.ok(result.operation.observations.length>0);assert.equal(f.calls.length,before);
  assert.equal((await controls.request({kind:'operation.read',id:'missing'})).status,'unavailable');
  assert.equal((await controls.request({kind:'operation.read',id:operationId,scope:'admin'})).status,'rejected');
  const permissions=await f.authority.settings({kind:'snapshot'},async()=>true);assert.equal(permissions.source.kind,'native-local');assert.match(permissions.source.entry,/^desktop:/);
 }finally{controls.close();}
});
