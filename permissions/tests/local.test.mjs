import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPermissions} from '../../dist/permissions/src/index.js';
import {openSqliteStore} from '../../dist/shared/src/index.js';

// Host identity/entry facts are explicit test fixtures, not OS/IPC authentication.
const localScope={subject:'user',entry:'window-1',conversation:null,context:null,resource:'space',action:'context.read',target:'context:one',relationship:'ui-session',relationshipGeneration:1};
function setup(t){
 const dir=mkdtempSync(join(tmpdir(),'wex-local-')),path=join(dir,'permissions.sqlite');let db=openSqliteStore(path,'permissions');
 const requests=new WeakMap(),approved=new WeakSet();const trust={current:r=>requests.get(r),canManage:c=>approved.has(c),canReadHistory:r=>requests.has(r)};
 let p=createPermissions(db,trust),sequence=0;
 const bind=(patch={})=>{const r={};const f={...localScope,kind:'local',moduleEnabled:true,globalEnabled:true,conversationEnabled:false,sourceAllowed:true,entryEnabled:true,...patch};requests.set(r,f);return {request:r,facts:f};};
 function change(kind,scope=localScope){const c={intent:`${kind}-${++sequence}`,expectedRevision:db.read().revision,scope};approved.add(c);return p[kind](c);}
 t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
 return {bind,change,get p(){return p;},get db(){return db;},trust,reopen(){db.close();db=openSqliteStore(path,'permissions');p=createPermissions(db,trust);}};
}
test('local entry needs its own enabled policy and exact grant without a Conversation identity',t=>{
 const h=setup(t),r=h.bind();assert.equal(h.p.evaluate(r.request).status,'deny');assert.equal(h.change('grant').status,'committed');
 assert.equal(h.p.evaluate(h.bind({entryEnabled:false}).request).status,'deny','an explicitly closed local entry is a denial, not an unresolved policy');
 const d=h.p.evaluate(r.request);assert.equal(d.status,'allow');assert.equal(d.scope.conversation,null);assert.equal(h.p.recheck(r.request,d).status,'allow');
 for(const patch of [{entryEnabled:false},{entryEnabled:undefined},{moduleEnabled:false},{globalEnabled:false},{sourceAllowed:false},{entryEnabled:'true'},{globalEnabled:'true'}]){
  const other=h.bind(patch);assert.notEqual(h.p.evaluate(other.request).status,'allow');
 }
 assert.equal(h.p.evaluate({...r.request,entryEnabled:true,user:'user'}).status,'indeterminate');
});
test('local grants do not spread across subjects, windows, contexts, targets, actions or instance generations',t=>{
 const h=setup(t);assert.equal(h.change('grant').status,'committed');
 for(const patch of [{subject:'other'},{entry:'window-2'},{context:'other'},{target:'context:two'},{action:'context.edit'},{resource:'file'},{relationship:'other'},{relationshipGeneration:2},{conversation:'fake-conversation'}]){
  assert.notEqual(h.p.evaluate(h.bind(patch).request).status,'allow');
 }
 assert.equal(h.p.evaluate(h.bind().request).status,'allow');
});
test('conversation grants, task and callback facts do not authorize a local direct operation',t=>{
 const h=setup(t),conversationScope={...localScope,conversation:'conversation-1'};assert.equal(h.change('grant',conversationScope).status,'committed');
 assert.equal(h.p.evaluate(h.bind({kind:'conversation',conversation:'conversation-1',conversationEnabled:true}).request).status,'allow');
 assert.notEqual(h.p.evaluate(h.bind().request).status,'allow');assert.equal(h.change('grant').status,'committed');
 for(const kind of ['task','callback'])assert.equal(h.p.evaluate(h.bind({kind}).request).reason,'entry_policy_unresolved');
 assert.notEqual(h.p.evaluate(h.bind({kind:'conversation',conversationEnabled:true}).request).status,'allow');
});
test('local revocation invalidates prior decisions and regrant never revives an old decision',t=>{
 const h=setup(t),r=h.bind();h.change('grant');const prior=h.p.evaluate(r.request);assert.equal(prior.status,'allow');
 assert.equal(h.change('revoke').status,'committed');assert.equal(h.p.recheck(r.request,prior).status,'deny');
 assert.equal(h.change('grant').status,'committed');assert.equal(h.p.recheck(r.request,prior).reason,'stale_authorization');assert.equal(h.p.evaluate(r.request).status,'allow');
 r.facts.entryEnabled=false;assert.notEqual(h.p.recheck(r.request,h.p.evaluate(r.request)).status,'allow');
});
test('local null-conversation grants and revocations persist across real SQLite close/reopen',t=>{
 const h=setup(t),r=h.bind();assert.equal(h.change('grant').status,'committed');h.reopen();assert.equal(h.p.evaluate(r.request).status,'allow');
 assert.equal(h.change('revoke').status,'committed');h.reopen();assert.equal(h.p.evaluate(r.request).status,'deny');
 const history=h.p.history(r.request);assert.equal(history.status,'ok');assert.deepEqual(history.records.map(x=>[x.kind,x.scope.conversation]),[['grant',null],['revoke',null]]);
});
test('local evaluation snapshots trusted scope before reading mutable dependency state',t=>{
 const h=setup(t),r=h.bind();h.change('grant');
 const p=createPermissions({...h.db,read(){r.facts.target='context:changed';return h.db.read();}},h.trust);
 const d=p.evaluate(r.request);assert.equal(d.status,'allow');assert.equal(d.scope.target,'context:one');assert.equal(d.scope.conversation,null);
 assert.notEqual(p.recheck(r.request,d).status,'allow');
});
