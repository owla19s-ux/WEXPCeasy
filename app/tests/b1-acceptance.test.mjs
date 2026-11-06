import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {createPermissions} from '../../dist/permissions/src/index.js';
import {createApiService} from '../../dist/connections/api/src/index.js';
import {createAiConfigurations} from '../../dist/AI/src/index.js';
import {createConversations,createConversationGeneration} from '../../dist/conversations/src/index.js';
import {createOperationLedger} from '../../dist/connections/src/index.js';
// B1 black-box acceptance: public exports only. Identity/model/Provider observations below
// are explicit fixtures; process termination, SQLite files and Permissions are real.
// These tests do not assert authenticated GitHub, paid Provider, Windows or B2 acceptance.
const modules=Object.fromEntries(['shared','permissions','connections/api','AI','conversations','connections'].map(name=>[name,new URL('../../dist/'+name+'/src/index.js',import.meta.url).href]));
const actor={subject:'user',entry:'acceptance',conversation:null,context:null,relationship:'session',relationshipGeneration:1};
function environment(t){
 const dir=mkdtempSync(join(tmpdir(),'wex-b1-acceptance-')),stores=[];
 const open=(name,namespace)=>{const db=openSqliteStore(join(dir,name+'.sqlite'),namespace);stores.push(db);return db;};
 t.after(()=>{for(const db of stores)db.close();rmSync(dir,{recursive:true,force:true});});
 const db=open('permissions','permissions'),requests=new WeakMap(),approved=new WeakSet();
 const p=createPermissions(db,{current:r=>{const scope=requests.get(r);return scope?{...scope,kind:'local',entryEnabled:true,conversationEnabled:false,moduleEnabled:true,globalEnabled:true,sourceAllowed:true}:undefined;},canManage:c=>approved.has(c),canReadHistory:()=>false});
 const bind=(resource,action,target)=>{const request={};requests.set(request,{...actor,resource,action,target});return request;};
 let sequence=0;
 const manage=(kind,request)=>{const change={intent:'acceptance-'+(++sequence),expectedRevision:db.read().revision,scope:requests.get(request)};approved.add(change);assert.equal(p[kind](change).status,'committed');};
 const permits=(request,resource,action,target)=>{const d=p.evaluate(request);return d.status==='allow'&&d.scope.resource===resource&&d.scope.action===action&&d.scope.target===target;};
 return {dir,open,p,bind,grant:r=>manage('grant',r),revoke:r=>manage('revoke',r),permits};
}
function child(dir,body){
 const program=`import {join} from 'node:path';import {writeSync} from 'node:fs';
 import {openSqliteStore} from ${JSON.stringify(modules.shared)};
 import {createApiService} from ${JSON.stringify(modules['connections/api'])};
 import {createAiConfigurations} from ${JSON.stringify(modules.AI)};
 import {createConversations} from ${JSON.stringify(modules.conversations)};
 import {createOperationLedger} from ${JSON.stringify(modules.connections)};
 const dir=process.argv[1];const actor=${JSON.stringify(actor)};
 const done=value=>{writeSync(1,JSON.stringify(value));process.exit(0);};
 ${body}`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',program,dir],{encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
}
test('B1-03/B1-07 public API configuration survives abrupt process exit and requires fresh grants to read or replay',t=>{
 const h=environment(t);
 const command={kind:'connection.create',intent:'connection-create',name:'Fixture',provider:'custom',protocol:'openai-chat',endpoint:'https://example.org/v1',endpointMode:'base',credentialRef:null,enabled:true,parameters:{}};
 const result=child(h.dir,`
  const db=openSqliteStore(join(dir,'api.sqlite'),'api-configurations'),requests=new WeakMap();let id=0;
  const permission={evaluate(r){const scope=requests.get(r);return scope?{status:'allow',revision:1,generation:1,scope}:{status:'deny',reason:'not_bound'};},recheck(r){return this.evaluate(r);}};
  const request=(action,target)=>{const r={};requests.set(r,{...actor,resource:'connections/api',action,target});return r;};
  const api=createApiService(db,permission,{id:()=> 'api-'+(++id)});
  const result=api.execute(request('connection.create','api:connections'),${JSON.stringify(command)});
  if(result.status!=='committed')throw Error(JSON.stringify(result));done(result);
 `);
 const db=h.open('api','api-configurations'),before=db.read(),api=createApiService(db,h.p);
 const read=h.bind('connections/api','connection.read','connection:'+result.id);
 assert.equal(api.query(read,{kind:'connection',id:result.id}).status,'rejected');
 h.grant(read);assert.equal(api.query(read,{kind:'connection',id:result.id}).value.name,'Fixture');
 const replay=h.bind('connections/api','connection.create','api:connections');h.grant(replay);
 assert.deepEqual(api.execute(replay,command),result);assert.deepEqual(db.read(),before);
 h.revoke(read);assert.equal(api.query(read,{kind:'connection',id:result.id}).status,'rejected');api.stop();
});
test('B1-04/B1-07 public AI role, position and Agent identities survive process exit without carrying authorization',t=>{
 const h=environment(t),role={kind:'role',name:'Reviewer',prompt:'Review'};
 child(h.dir,`
  const db=openSqliteStore(join(dir,'ai.sqlite'),'ai-configurations'),ai=createAiConfigurations(db,()=>true,()=>true);
  const values={role:${JSON.stringify(role)},position:{kind:'position',name:'Engineer',responsibility:'Implement'},agent:{kind:'agent',name:'Worker',roleId:'role',positionId:'position',model:{connectionId:'connection',modelId:'model'}}};
  for(const [id,value] of Object.entries(values))if(ai.save({}, {id,intent:id+'-create',expectedRevision:0,value}).status!=='committed')throw Error('save failed');
  done({saved:true});
 `);
 const db=h.open('ai','ai-configurations'),before=db.read();
 const ai=createAiConfigurations(db,(r,a)=>h.permits(r,'AI',a.kind+'.'+a.action,a.kind+':'+a.id));
 const read=h.bind('AI','agent.read','agent:agent');assert.equal(ai.read(read,'agent','agent').status,'denied');
 h.grant(read);const agent=ai.read(read,'agent','agent').entry;
 assert.equal(agent.roleId,'role');assert.equal(agent.positionId,'position');assert.deepEqual(agent.model,{connectionId:'connection',modelId:'model'});
 const write=h.bind('AI','role.write','role:role');h.grant(write);
 assert.deepEqual(ai.save(write,{id:'role',intent:'role-create',expectedRevision:0,value:role}),{status:'committed',revision:1});assert.deepEqual(db.read(),before);
 h.revoke(read);assert.equal(ai.read(read,'agent','agent').status,'denied');
});
test('B1-05/B1-06/B1-07 public generation recovery after process exit reads one authorized Operation receipt and never resends',t=>{
 const h=environment(t);
 child(h.dir,`
  const db=openSqliteStore(join(dir,'conversations.sqlite'),'conversations'),service=createConversations(db,()=>true);
  const change=(intent,expectedRevision,change)=>{const r=service.change({}, {conversationId:'chat',intent,expectedRevision,change});if(r.status!=='committed')throw Error(JSON.stringify(r));};
  change('create',0,{kind:'create'});change('append',1,{kind:'append',messageId:'input',segments:[{id:'p',text:'question'}]});
  change('begin',2,{kind:'begin',generationId:'gen',inputMessageId:'input'});
  change('dispatch',3,{kind:'dispatch',generationId:'gen',operationId:'operation',requestId:'request',replyId:'reply'});
  const os=openSqliteStore(join(dir,'operations.sqlite'),'connection-operations'),ledger=createOperationLedger(os);
  if(ledger.prepare('operation','fixture-request').status!=='ok'||ledger.markDispatched('operation').status!=='ok'||ledger.observe('operation','api-result',{requestId:'request',text:'answer'},'observed').status!=='ok')throw Error('receipt failed');
  done({saved:true});
 `);
 const db=h.open('conversations','conversations'),os=h.open('operations','connection-operations'),ledger=createOperationLedger(os);
 const service=createConversations(db,(r,a,id)=>h.permits(r,'conversations',a,'conversation:'+id));
 const requests={read:h.bind('conversations','read','conversation:chat'),finish:h.bind('conversations','finish','conversation:chat'),receipt:h.bind('conversations','receipt.read','operation:operation')};
 assert.equal(service.read(requests.read,'chat').status,'denied');h.grant(requests.read);h.grant(requests.finish);
 let sends=0;
 const generation=createConversationGeneration(service,{async send(){sends++;throw Error('must not resend');}},(r,id)=>{
  const decision=h.p.evaluate(r);if(!h.permits(r,'conversations','receipt.read','operation:'+id))return;
  const value=ledger.get(id)?.observations.find(o=>o.id==='api-result'&&o.phase==='observed')?.value;
  if(h.p.recheck(r,decision).status==='allow')return value;
 });
 const before=db.read(),operation=ledger.get('operation');
 assert.equal(generation.recover(requests,'chat','gen','recover').status,'unavailable');assert.deepEqual(db.read(),before);
 h.grant(requests.receipt);assert.equal(generation.recover(requests,'chat','gen','recover').status,'committed');
 const chat=service.read(requests.read,'chat').conversation;assert.deepEqual(chat.messages.map(m=>m.id),['input','reply']);assert.equal(chat.generations[0].status,'completed');
 assert.equal(sends,0);assert.deepEqual(ledger.get('operation'),operation);assert.equal(operation.attempts,1);
 h.revoke(requests.read);assert.equal(service.read(requests.read,'chat').status,'denied');
});
