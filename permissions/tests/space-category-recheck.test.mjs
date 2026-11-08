import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {createPermissions} from '../../dist/permissions/src/index.js';
import {openSpaceService} from '../../dist/space/src/index.js';
// Real Permissions and Space with real SQLite. Only trusted local identity and fault timing are supplied.
async function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'wex-category-permission-')),root=join(dir,'root');
 mkdirSync(root);writeFileSync(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 const db=openSqliteStore(join(root,'permissions.sqlite'),'permissions'),facts=new WeakMap(),approved=new WeakSet(),services=[];
 let sequence=0,hook;
 const permission=createPermissions(db,{current:r=>{const scope=facts.get(r);return scope?{...scope,kind:'local',entryEnabled:true,moduleEnabled:true,globalEnabled:true,conversationEnabled:false,sourceAllowed:true}:undefined;},canManage:c=>approved.has(c),canReadHistory:()=>false});
 function bind(action,target,context=null){const request={};facts.set(request,{subject:'user',entry:'window',conversation:null,context,resource:'space',action,target,relationship:'session',relationshipGeneration:1});return request;}
 function manage(kind,request){const c={intent:'manage-'+(++sequence),expectedRevision:db.read().revision,scope:facts.get(request)};approved.add(c);assert.equal(permission[kind](c).status,'committed');}
 const options={dataRoot:root,permission,deriveRequest(parent,scope){return facts.has(parent)?bind(scope.action,scope.target,scope.context):undefined;},
  openStore(path,namespace){
   const store=openSqliteStore(path,namespace);if(namespace!=='space-registry')return store;
   const fire=phase=>{if(hook?.phase===phase){const current=hook;hook=undefined;current.run();}};
   return {...store,read(){const value=store.read();fire('read');return value;},commit(input){const result=store.commit(input);if(result.status==='committed'&&input.intent.endsWith(':prepare'))fire('prepared');return result;}};
  }};
 async function open(){const result=await openSpaceService(options);assert.equal(result.status,'ready');services.push(result.service);return result.service;}
 const s=await open();
 const snapshot=()=>{const store=openSqliteStore(join(root,'wex-space.sqlite'),'space-registry');try{return store.read();}finally{store.close();}};
 t.after(async()=>{for(const service of services)await service.close();db.close();rmSync(dir,{recursive:true,force:true});});
 return {s,open,bind,manage,permission,snapshot,arm(phase,run){hook={phase,run};}};
}
for(const kind of ['space.create','space.edit'])for(const phase of ['read','prepared']){
 test('real Permissions stop '+kind+' category reference at '+phase+' and preserve its outcome across reopen',async t=>{
  const h=await fixture(t),createCategory=h.bind('category.create','root:root');h.manage('grant',createCategory);
  const category=await h.s.execute(createCategory,{kind:'category.create',intent:'category',name:'Private'});assert.equal(category.status,'committed');
  let existing;
  if(kind==='space.edit'){const r=h.bind('space.create','root:root');h.manage('grant',r);existing=await h.s.execute(r,{kind:'space.create',intent:'original',name:'Original'});assert.equal(existing.status,'committed');}
  const request=h.bind(kind,existing?'space:'+existing.id:'root:root'),readCategory=h.bind('category.read','category:'+category.id);
  h.manage('grant',request);h.manage('grant',readCategory);
  const prior=h.permission.evaluate(request);assert.equal(prior.status,'allow');assert.equal(prior.scope.conversation,null);
  const command={kind,intent:'linked',name:'Changed',categoryId:category.id,...(existing?{id:existing.id,expectedRevision:1}:{})};
  const before=h.snapshot();h.arm(phase,()=>h.manage('revoke',readCategory));
  assert.notEqual((await h.s.execute(request,command)).status,'committed');
  assert.notEqual(h.permission.recheck(request,prior).status,'allow');
  const after=h.snapshot();assert.deepEqual(after.value.spaces,before.value.spaces);
  assert.equal(after.revision,before.revision+(phase==='prepared'?1:0));
  await h.s.close();const reopened=await h.open();
  assert.deepEqual(h.snapshot(),after);
  assert.equal((await reopened.execute(request,command)).status,'rejected');
  h.manage('grant',readCategory);
  const retried=await reopened.execute(request,command);
  assert.equal(retried.status,phase==='prepared'?'unknown':'committed');
  if(phase==='prepared')assert.deepEqual(h.snapshot(),after);
 });
}
test('real category permission revocation hides a committed Space receipt until explicitly granted again',async t=>{
 const h=await fixture(t),categoryRequest=h.bind('category.create','root:root');h.manage('grant',categoryRequest);
 const category=await h.s.execute(categoryRequest,{kind:'category.create',intent:'category',name:'Private'});
 const create=h.bind('space.create','root:root'),read=h.bind('category.read','category:'+category.id);
 h.manage('grant',create);h.manage('grant',read);
 const command={kind:'space.create',intent:'linked',name:'Space',categoryId:category.id},result=await h.s.execute(create,command);
 assert.equal(result.status,'committed');const before=h.snapshot();
 await h.s.close();const reopened=await h.open();h.manage('revoke',read);
 assert.equal((await reopened.execute(create,command)).status,'rejected');assert.deepEqual(h.snapshot(),before);
 h.manage('grant',read);assert.deepEqual(await reopened.execute(create,command),result);assert.deepEqual(h.snapshot(),before);
});
