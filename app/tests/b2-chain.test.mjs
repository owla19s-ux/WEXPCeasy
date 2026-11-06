import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {startFoundations} from '../../dist/app/src/index.js';
import {localFileTarget} from '../../dist/connections/local/src/index.js';
import {openSqliteStore} from '../../dist/shared/src/index.js';
// B2 uses real product modules, Permissions, files, HTTP/SSE and SQLite.
// Only platform source identity and the local test Provider are fixtures. No paid calls or UI.
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'wex-b2-')),root=join(dir,'public'),a=join(dir,'context-a'),b=join(dir,'context-b'),file=join(dir,'reference.txt');
 for(const [path,id] of [[root,'public-root'],[a,'context-a-root'],[b,'context-b-root']]){await mkdir(path);await writeFile(join(path,'.wex-root.json'),JSON.stringify({format:1,id}));}
 await writeFile(file,'selected reference');
 const calls=[];let mode='normal',arrive;
 const frame=(text,terminal=null)=>'data: '+JSON.stringify({choices:[{index:0,delta:text===undefined?{}:{content:text},finish_reason:terminal}]})+'\n\n';
 const server=createServer(async(req,res)=>{
  try{
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const input=JSON.parse(Buffer.concat(chunks).toString());calls.push(input);
   if(mode==='error'){res.writeHead(503);res.end('private-provider-error');return;}
   const last=input.messages.findLast(m=>m.role==='user').content,answer='answer: '+last;
   if(input.stream){res.writeHead(200,{'content-type':'text/event-stream'});res.write(frame(answer.slice(0,8)));if(mode==='wait'){arrive?.();return;}res.end(frame(answer.slice(8))+frame(undefined,'stop')+'data: [DONE]\n\n');}
   else{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({choices:[{index:0,message:{role:'assistant',content:answer},finish_reason:'stop'}]}));}
  }catch{res.destroy();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let identity={subject:'user',entry:'window',relationship:'session',relationshipGeneration:1,moduleEnabled:true,globalEnabled:true,entryEnabled:true,sourceAllowed:true},source={},host,sequence=0;
 const sources=new WeakMap(),approved=new WeakSet(),historyRequest={},granted=new Set(),hosts=[];sources.set(source,identity);
 const op=(resource,action,target,context=null)=>({resource,action,target,context});
 const bind=operation=>host.local.bind(source,operation);
 const scopeOf=operation=>({subject:identity.subject,entry:identity.entry,conversation:null,relationship:identity.relationship,relationshipGeneration:identity.relationshipGeneration,...operation});
 function manage(kind,operation){
  const history=host.permissions.history(historyRequest);assert.equal(history.status,'ok');
  const scope=scopeOf(operation),key=JSON.stringify(scope);
  if(kind==='grant'&&granted.has(key))return;
  const change={intent:'manage-'+(++sequence),expectedRevision:history.revision,scope};approved.add(change);
  assert.equal(host.permissions[kind](change).status,'committed');
  if(kind==='grant')granted.add(key);else granted.delete(key);
 }
 const request=operation=>{manage('grant',operation);return bind(operation);};
 const owner={async resolve(parent,target){
  const before=host.permissions.evaluate(parent);if(before.status!=='allow')return {status:'denied'};
  const kind=target.owner==='AI'?target.targetType:target.targetType==='model'?'model':'connection';
  const resource=target.owner==='AI'?'AI':'connections/api',r=bind(op(resource,kind+'.read',kind+':'+target.targetId));
  const decision=host.permissions.evaluate(r);
  if(decision.status!=='allow'||['subject','entry','conversation','relationship','relationshipGeneration'].some(k=>decision.scope[k]!==before.scope[k]))return {status:'denied'};
  const value=target.owner==='AI'?host.ai?.read(r,kind,target.targetId):host.api?.query(r,{kind,id:target.targetId});
  if(value?.status!=='ok'||host.permissions.recheck(parent,before).status!=='allow')return {status:'unavailable'};
  const revision=target.owner==='AI'?value.entry.revision:value.value.revision;
  return {status:'available',...target,sourceRevision:String(revision),observedAt:new Date().toISOString()};
 }};
 const options={dataRoot:root,trust:{current:()=>undefined,canManage:c=>approved.has(c),canReadHistory:r=>r===historyRequest},
  local:{current:r=>sources.get(r)},space:{owner},api:{},ai:{bindRead(_parent,scope){return bind(scope);}},conversations:true,localFiles:{},technicalDiagnostics:{}};
 host=await startFoundations(options);hosts.push(host);
 t.after(async()=>{for(const h of hosts)await h.stop();server.closeAllConnections();server.close();await rm(dir,{recursive:true,force:true});});
 const space=async command=>{
  const ctx=command.contextId??(command.kind==='context.edit'?command.id:null);
  const target=command.kind==='context.create'?resolve(command.location):ctx?'context:'+ctx:command.kind==='group.create'?'space:'+command.spaceId:command.id?command.kind.split('.')[0]+':'+command.id:'root:public-root';
  return host.space.execute(request(op('space',command.kind,target,ctx)),command);
 };
 const view=id=>host.space.query(request(op('space','context.read','context:'+id,id)),{kind:'context',id});
 const apiRequest=(action,target,context=null)=>request(op('connections/api',action,target,context));
 const chatRequest=(action,ctx,chat='chat')=>request(op('conversations',action,'conversation:'+chat,ctx));
 const chat=(ctx,chatId='chat')=>host.conversations.service.read(chatRequest('read',ctx,chatId),chatId);
 function change(ctx,intent,command,chatId='chat'){
  const current=chat(ctx,chatId),expectedRevision=current.status==='not_found'?0:current.conversation.revision;
  return host.conversations.service.change(chatRequest(command.kind,ctx,chatId),{conversationId:chatId,intent,expectedRevision,change:command});
 }
 function sendInput(state,{generationId='gen',operationId='generation',replyId='reply',requestId='request',chatId='chat'}={}){
  const target='model:'+state.model.id,ctx=state.context.id;
  apiRequest('connection.read','connection:'+state.connection.id);apiRequest('model.read',target);apiRequest('request.prepare',target,ctx);
  const requests={read:chatRequest('read',ctx,chatId),dispatch:chatRequest('dispatch',ctx,chatId),api:apiRequest('request.send',target,ctx),
   finish:chatRequest('finish',ctx,chatId),fail:chatRequest('fail',ctx,chatId),unknown:chatRequest('unknown',ctx,chatId)};
  return {conversationId:chatId,generationId,operationId,replyId,intent:'send-'+generationId,expectedRevision:chat(ctx,chatId).conversation.revision,requests,
   systemPrompt:state.role.prompt,preparation:{requestId,connectionId:state.connection.id,connectionRevision:1,modelId:state.model.id,modelRevision:2,context:ctx,parameters:{},timeoutMs:2000,stream:true}};
 }
 async function setup(){
  assert.equal(host.status,'ready');
  const connection=host.api.execute(apiRequest('connection.create','api:connections'),{kind:'connection.create',intent:'connection',name:'Local Provider',provider:'fixture',protocol:'openai-chat',endpoint:'http://127.0.0.1:'+server.address().port+'/v1',endpointMode:'base',credentialRef:null,enabled:true,parameters:{}});assert.equal(connection.status,'committed');
  const model=host.api.execute(apiRequest('model.create','connection:'+connection.id),{kind:'model.create',intent:'model',connectionId:connection.id,name:'Chat',modelId:'fixture-chat',parameters:{}});assert.equal(model.status,'committed');
  apiRequest('connection.read','connection:'+connection.id);apiRequest('model.read','model:'+model.id);
  assert.equal((await host.api.probeGeneration(apiRequest('model.probe','model:'+model.id),'probe',model.id,1,1,2000,undefined,true)).status,'ok');
  assert.equal(host.api.execute(apiRequest('model.observe','model:'+model.id),{kind:'model.observe',intent:'observation',id:model.id,expectedRevision:1,probeOperationId:'probe'}).status,'committed');
  const role={kind:'role',name:'Reader',prompt:'Use the selected reference carefully.'},position={kind:'position',name:'Engineer',responsibility:'Answer with evidence'};
  for(const [id,value] of [['role',role],['position',position]])assert.equal(host.ai.save(request(op('AI',value.kind+'.write',value.kind+':'+id)),{id,intent:id,expectedRevision:0,value}).status,'committed');
  request(op('AI','role.read','role:role'));request(op('AI','position.read','position:position'));
  const agent={kind:'agent',name:'Worker',roleId:'role',positionId:'position',model:{connectionId:connection.id,modelId:model.id}};
  assert.equal(host.ai.save(request(op('AI','agent.write','agent:agent')),{id:'agent',intent:'agent',expectedRevision:0,value:agent}).status,'committed');request(op('AI','agent.read','agent:agent'));
  const context=await space({kind:'context.create',intent:'context',location:a,name:'Project'}),other=await space({kind:'context.create',intent:'other',location:b,name:'Other'});assert.equal(context.status,'committed');assert.equal(other.status,'committed');
  const workspace=await space({kind:'space.create',intent:'space',name:'Workspace'}),groupA=await space({kind:'group.create',intent:'group-a',spaceId:workspace.id,name:'A'}),groupB=await space({kind:'group.create',intent:'group-b',spaceId:workspace.id,name:'B'});
  request(op('space','space.read','space:'+workspace.id));for(const g of [groupA,groupB])request(op('space','group.read','group:'+g.id));
  assert.equal((await space({kind:'context.group',intent:'assign',contextId:context.id,spaceId:workspace.id,groupId:groupA.id,expectedRevision:0})).status,'committed');
  assert.equal((await space({kind:'context.group',intent:'move',contextId:context.id,spaceId:workspace.id,groupId:groupB.id,expectedRevision:1})).status,'committed');
  for(const [owner,targetType,targetId] of [['AI','role','role'],['AI','agent','agent'],['connections/api','model',model.id]])
   assert.equal((await space({kind:'association.add',intent:'ref-'+targetId,contextId:context.id,owner,targetType,targetId,purpose:'selected'})).status,'committed');
  assert.equal((await space({kind:'address.add',intent:'resource',contextId:context.id,name:'Reference',address:file,purpose:'reference',type:'file',source:'local'})).status,'committed');
  const fileTarget=localFileTarget('reference'),fileRead=request(op('local','read',fileTarget,context.id));
  assert.equal((await host.localFiles.register(fileRead,fileTarget,file)).status,'bound');
  const observed=await host.localFiles.read(fileRead,fileTarget);assert.equal(observed.status,'ok');
  const inputText='question with '+observed.value.content;
  assert.equal(change(context.id,'chat',{kind:'create'}).status,'committed');
  assert.equal(change(context.id,'input',{kind:'append',messageId:'input',segments:[{id:'p',text:inputText}]}).status,'committed');
  assert.equal(change(context.id,'begin',{kind:'begin',generationId:'gen',inputMessageId:'input'}).status,'committed');
  return {connection,model,role,agent,context,other,workspace,groupB,fileTarget,inputText};
 }
 return {root,file,op,bind,request,apiRequest,chatRequest,chat,change,view,space,sendInput,setup,calls,get host(){return host;},
  setMode(value){mode=value;},waitForRequest(){return new Promise(r=>{arrive=r;});},
  revoke:operation=>manage('revoke',operation),
  async restart(){const old=host;assert.equal((await old.stop()).status,'stopped');sources.delete(source);source={};identity={...identity,relationshipGeneration:identity.relationshipGeneration+1};sources.set(source,identity);granted.clear();host=await startFoundations(options);hosts.push(host);return old;}
 };
}
test('B2-01..07 real Context to Agent/model to selected file to streamed conversation survives host restart and immutable resend',async t=>{
 const f=await fixture(t),state=await f.setup(),ctx=state.context.id;
 assert.equal((await f.view(ctx)).value.associations.length,3);
 assert.equal((await f.view(state.other.id)).value.associations.length,0);
 const deltas=[],input=f.sendInput(state);input.onText=text=>deltas.push(text);
 assert.equal((await f.host.conversations.generation.send(input)).status,'committed');assert.equal(deltas.join(''),'answer: '+state.inputText);
 const wire=f.calls.at(-1);assert.deepEqual(wire.messages,[{role:'system',content:state.role.prompt},{role:'user',content:state.inputText}]);assert.equal(wire.model,'fixture-chat');
 const before=f.chat(ctx).conversation,operation=f.host.connections.operations.get('generation');assert.equal(operation.phase,'observed');assert.equal(operation.attempts,1);
 const oldRead=input.requests.read,old=await f.restart();assert.equal(f.host.status,'ready');assert.equal(old.api.query(input.requests.api,{kind:'model',id:state.model.id}).status,'unavailable');
 assert.equal(f.host.conversations.service.read(oldRead,'chat').status,'denied');
 f.apiRequest('connection.read','connection:'+state.connection.id);f.apiRequest('model.read','model:'+state.model.id);
 for(const [kind,id] of [['role','role'],['agent','agent']])f.request(f.op('AI',kind+'.read',kind+':'+id));
 assert.deepEqual(f.chat(ctx).conversation,before);assert.equal((await f.view(ctx)).value.associations.length,3);
 f.request(f.op('space','space.read','space:'+state.workspace.id));f.request(f.op('space','group.read','group:'+state.groupB.id));
 const organization=await f.host.space.query(f.request(f.op('space','context.organization.read','context:'+ctx,ctx)),{kind:'context.organization',id:ctx});assert.equal(organization.value.groupId,state.groupB.id);
 const read=f.request(f.op('local','read',state.fileTarget,ctx));assert.equal((await f.host.localFiles.read(read,state.fileTarget)).status,'unavailable');assert.equal((await f.host.localFiles.register(read,state.fileTarget,f.file)).status,'bound');
 const count=f.calls.length,again=f.sendInput(state);
 assert.equal((await f.host.api.send(again.requests.api,'generation',{...again.preparation,messages:wire.messages})).status,'blocked');assert.equal(f.calls.length,count);assert.deepEqual(f.host.connections.operations.get('generation'),operation);
 assert.equal(f.change(ctx,'resend',{kind:'resend',messageId:'revised',replaces:'input',generationId:'next',segments:[{id:'p',text:'revised question'}]}).status,'committed');
 assert.equal((await f.host.conversations.generation.send(f.sendInput(state,{generationId:'next',operationId:'next-operation',replyId:'next-reply',requestId:'next-request'}))).status,'committed');
 assert.deepEqual(f.calls.at(-1).messages,[{role:'system',content:state.role.prompt},{role:'user',content:'revised question'}]);
 assert.deepEqual(f.chat(ctx).conversation.messages.map(m=>m.id),['input','reply','revised','next-reply']);assert.equal(await readFile(f.file,'utf8'),'selected reference');
});
test('B2-03/05/07/08 real cancellation, Provider errors, disabled connection and corrupt configuration preserve truthful states',async t=>{
 const f=await fixture(t),state=await f.setup(),ctx=state.context.id,input=f.sendInput(state);
 const cancel=f.chatRequest('cancel',ctx);f.setMode('wait');const arrived=f.waitForRequest(),pending=f.host.conversations.generation.send(input);
 await arrived;const current=f.chat(ctx).conversation;
 assert.equal(f.host.conversations.generation.cancel(cancel,'chat','gen','cancel',current.revision).status,'committed');await pending;
 assert.equal(f.chat(ctx).conversation.generations[0].status,'cancelled');assert.equal(f.chat(ctx).conversation.messages.length,1);assert.equal(f.host.connections.operations.get('generation').phase,'unknown');
 f.setMode('error');assert.equal(f.change(ctx,'begin-error',{kind:'begin',generationId:'error',inputMessageId:'input'}).status,'committed');
 assert.equal((await f.host.conversations.generation.send(f.sendInput(state,{generationId:'error',operationId:'error-operation',replyId:'error-reply',requestId:'error-request'}))).status,'committed');
 assert.equal(f.chat(ctx).conversation.generations.find(g=>g.id==='error').status,'unknown');
 const failed=f.host.connections.operations.get('error-operation');assert.equal(failed.phase,'unknown');assert.equal(JSON.stringify(failed).includes('private-provider-error'),false);
 const count=f.calls.length,receipt=f.request(f.op('conversations','receipt.read','operation:error-operation',ctx));
 assert.equal(f.host.conversations.generation.recover({read:f.chatRequest('read',ctx),finish:f.chatRequest('finish',ctx),receipt},'chat','error','recover-error').status,'unavailable');assert.equal(f.calls.length,count);
 const edit=f.apiRequest('connection.edit','connection:'+state.connection.id);
 assert.equal(f.host.api.execute(edit,{kind:'connection.edit',intent:'disable',id:state.connection.id,expectedRevision:1,enabled:false}).status,'committed');
 assert.equal(f.change(ctx,'begin-disabled',{kind:'begin',generationId:'disabled',inputMessageId:'input'}).status,'committed');
 const disabled=f.sendInput(state,{generationId:'disabled',operationId:'disabled-operation',replyId:'disabled-reply',requestId:'disabled-request'});disabled.preparation.connectionRevision=2;
 assert.equal((await f.host.conversations.generation.send(disabled)).status,'committed');assert.equal(f.chat(ctx).conversation.generations.find(g=>g.id==='disabled').status,'failed');
 assert.equal(f.host.connections.operations.get('disabled-operation'),undefined);assert.equal(f.calls.length,count);
 await f.host.stop();const path=join(f.root,'api-configurations.sqlite'),db=openSqliteStore(path,'api-configurations');const snap=db.read();db.commit({intent:'corrupt-fixture',expectedRevision:snap.revision,value:{format:99}});const damaged=db.read();db.close();
 await f.restart();assert.equal(f.host.status,'degraded');assert.equal(f.host.api,undefined);assert.equal(f.host.ai,undefined);assert.equal(f.host.conversations,undefined);assert.ok(f.host.permissions);assert.equal((await f.view(ctx)).value.id,ctx);
 const check=openSqliteStore(path,'api-configurations');try{assert.deepEqual(check.read(),damaged);}finally{check.close();}
});
test('B2-02/03/06/08 a real successful API receipt recovers a full-chain logical generation after restart without resending',async t=>{
 const f=await fixture(t),state=await f.setup(),ctx=state.context.id,input=f.sendInput(state);
 f.revoke(f.op('conversations','finish','conversation:chat',ctx));
 assert.equal((await f.host.conversations.generation.send(input)).status,'denied');
 assert.equal(f.host.connections.operations.get('generation').phase,'observed');assert.equal(f.chat(ctx).conversation.messages.length,1);const count=f.calls.length;
 await f.restart();
 const requests={read:f.chatRequest('read',ctx),finish:f.chatRequest('finish',ctx),receipt:f.request(f.op('conversations','receipt.read','operation:generation',ctx))};
 assert.equal(f.host.conversations.generation.recover(requests,'chat','gen','recover').status,'committed');
 assert.equal(f.chat(ctx).conversation.messages[1].segments[0].text,'answer: '+state.inputText);assert.equal(f.calls.length,count);assert.equal(f.host.connections.operations.get('generation').attempts,1);
 assert.equal((await f.view(ctx)).value.id,ctx);
});
