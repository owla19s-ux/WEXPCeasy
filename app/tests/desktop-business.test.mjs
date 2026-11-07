import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {startFoundations} from '../../dist/app/src/index.js';
import {createDesktopAuthority} from '../../dist/app/src/desktop-authority.js';
import {createDesktopApi} from '../../dist/app/src/desktop-api.js';
async function fixture(t){
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
 const ai=createDesktopAi({authority,confirm}),chat=createDesktopConversations({authority,confirm,onText:v=>deltas.push(v)});
 const options={dataRoot:root,...authority.policy,api:{deriveRequest:api.derive},ai:{bindRead:ai.bindRead},conversations:true};
 const host=await startFoundations(options);api.attach(host);ai.attach(host);chat.attach(host);
 t.after(async()=>{release?.();chat.close();ai.close();api.close();await host.stop();server.closeAllConnections();server.close();await rm(root,{recursive:true,force:true});});
 return {root,host,authority,api,ai,chat,calls,deltas,endpoint:'http://127.0.0.1:'+server.address().port+'/v1',deny(){consent=false;},allow(){consent=true;},wait(){mode='wait';return new Promise(r=>arrived=r);},release(){release?.();}};
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
