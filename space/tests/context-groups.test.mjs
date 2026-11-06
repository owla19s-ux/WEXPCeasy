import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {renameSync} from 'node:fs';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {openSpaceService} from '../../dist/space/src/index.js';
import {fixture} from './fixture.mjs';
const query=(h,s,id)=>s.query(h.request('context.organization.read','context:'+id,id),{kind:'context.organization',id});
const move=(h,s,id,spaceId,groupId,expectedRevision,intent)=>h.exec(s,{kind:'context.group',contextId:id,spaceId,groupId,expectedRevision,intent});
async function setup(t,extra={}){
 const h=await fixture(t),s=await h.open(extra),c=await h.create(s);
 const space=await h.exec(s,{kind:'space.create',intent:'space',name:'Space'});
 const a=await h.exec(s,{kind:'group.create',intent:'group-a',spaceId:space.id,name:'A'});
 const b=await h.exec(s,{kind:'group.create',intent:'group-b',spaceId:space.id,name:'B'});
 return {h,s,c,space,a,b};
}
function body(h){const db=openSqliteStore(join(h.a,'wex-context.sqlite'),'space-context');try{return db.read();}finally{db.close();}}
test('Context ID group assignment, move and ungroup persist without changing the body or data directory',async t=>{
 const {h,s,c,space,a,b}=await setup(t),before=body(h);
 assert.deepEqual((await query(h,s,c.id)).value,{contextId:c.id,revision:0,spaceId:null,groupId:null});
 assert.equal((await move(h,s,c.id,space.id,a.id,0,'assign')).status,'committed');
 assert.equal((await move(h,s,c.id,space.id,b.id,1,'move')).revision,2);
 assert.deepEqual((await query(h,s,c.id)).value,{contextId:c.id,revision:2,spaceId:space.id,groupId:b.id});
 assert.equal((await move(h,s,c.id,space.id,null,2,'ungroup')).revision,3);
 await s.close();const reopened=await h.open();
 assert.deepEqual((await query(h,reopened,c.id)).value,{contextId:c.id,revision:3,spaceId:space.id,groupId:null});
 assert.deepEqual(body(h),before);assert.equal((await h.query(reopened,c.id)).value.id,c.id);
});
test('queued group moves use organization revisions and exact replay never moves a Context back',async t=>{
 const {h,s,c,space,a,b}=await setup(t);
 const original=await move(h,s,c.id,space.id,a.id,0,'assign');assert.equal(original.status,'committed');
 const [winner,stale]=await Promise.all([move(h,s,c.id,space.id,b.id,1,'winner'),move(h,s,c.id,space.id,null,1,'stale')]);
 assert.equal(winner.status,'committed');assert.equal(stale.reason,'revision_conflict');
 await s.close();const reopened=await h.open();
 assert.deepEqual(await move(h,reopened,c.id,space.id,a.id,0,'assign'),original);
 assert.equal((await move(h,reopened,c.id,space.id,b.id,0,'assign')).reason,'intent_conflict');
 assert.equal((await query(h,reopened,c.id)).value.groupId,b.id);
});
test('moving a registered Context while its data directory is offline never creates or migrates its body',async t=>{
 const {h,s,c,space,a,b}=await setup(t),before=body(h);
 assert.equal((await move(h,s,c.id,space.id,a.id,0,'assign')).status,'committed');
 renameSync(h.a,h.a+'-offline');
 try{assert.equal((await move(h,s,c.id,space.id,b.id,1,'offline')).status,'committed');assert.equal((await query(h,s,c.id)).value.groupId,b.id);}
 finally{renameSync(h.a+'-offline',h.a);}
 assert.deepEqual(body(h),before);
});
test('group assignment rejects a Group from a different Space and leaves the original organization intact',async t=>{
 const {h,s,c,space,a}=await setup(t),other=await h.exec(s,{kind:'space.create',intent:'other',name:'Other'});
 const foreign=await h.exec(s,{kind:'group.create',intent:'foreign',spaceId:other.id,name:'Foreign'});
 assert.equal((await move(h,s,c.id,space.id,a.id,0,'assign')).status,'committed');
 assert.equal((await move(h,s,c.id,space.id,foreign.id,1,'wrong')).reason,'group_space_mismatch');
 assert.equal((await query(h,s,c.id)).value.groupId,a.id);
});
test('group movement requires independent destination reads and revocation blocks writes and receipt replay',async t=>{
 const {h,s,c,space,a,b}=await setup(t),evaluate=h.permission.evaluate.bind(h.permission);
 let hidden=true;
 h.permission.evaluate=r=>{const d=evaluate(r);return hidden&&d.status==='allow'&&d.scope.action==='group.read'?{status:'deny',reason:'private'}:d;};
 assert.equal((await move(h,s,c.id,space.id,a.id,0,'assign')).reason,'reference_unavailable');
 hidden=false;assert.equal((await move(h,s,c.id,space.id,a.id,0,'assign')).status,'committed');
 hidden=true;assert.equal((await move(h,s,c.id,space.id,b.id,1,'hidden')).reason,'reference_unavailable');
 assert.notEqual((await query(h,s,c.id)).status,'ok');
 h.revoke();assert.equal((await move(h,s,c.id,space.id,a.id,0,'assign')).status,'rejected');
});
for(const committed of [false,true]){
 test('uncertain group apply '+(committed?'recovers the original durable receipt':'stays observation-only')+' after restart',async t=>{
  let once=true;const {h,s,c,space,a}=await setup(t,{openStore(path,ns){
   const db=openSqliteStore(path,ns);return ns!=='space-registry'?db:{...db,commit(input){
    if(once&&input.intent.endsWith(':apply')&&input.value.contexts?.some(c=>c.organization)){once=false;if(committed)db.commit(input);return {status:'unknown',intent:input.intent};}
    return db.commit(input);
   }};
  }});
  const first=await move(h,s,c.id,space.id,a.id,0,'assign');assert.equal(first.status,'unknown');
  await s.close();const reopened=await h.open(),result=await move(h,reopened,c.id,space.id,a.id,0,'assign');
  assert.equal(result.status,committed?'committed':'unknown');
  assert.equal((await query(h,reopened,c.id)).value.revision,committed?1:0);assert.equal(body(h).revision,1);
 });
}
test('legacy organization inspection is read-only and does not add missing organization fields',async t=>{
 const {h,s,c}=await setup(t),db=openSqliteStore(join(h.root,'wex-space.sqlite'),'space-registry');
 try{const before=db.read();assert.equal((await query(h,s,c.id)).value.revision,0);assert.deepEqual(db.read(),before);assert.equal(Object.hasOwn(before.value.contexts[0],'organization'),false);}finally{db.close();}
});
for(const [label,damage] of [
 ['unknown fields',org=>{org.token='must-not-project';}],
 ['invalid revision',org=>{org.revision=0;}],
 ['foreign Group',org=>{org.groupId='missing';}],
]){
 test('damaged persisted Context organization rejects '+label+' without data repair',async t=>{
  const {h,s,c,space,a}=await setup(t);
  assert.equal((await move(h,s,c.id,space.id,a.id,0,'assign')).status,'committed');await s.close();
  const db=openSqliteStore(join(h.root,'wex-space.sqlite'),'space-registry');const snap=db.read();damage(snap.value.contexts[0].organization);
  db.commit({intent:'damage',expectedRevision:snap.revision,value:snap.value});const before=db.read();db.close();
  const result=await openSpaceService({dataRoot:h.root,permission:h.permission});assert.equal(result.status,'unavailable');
  const check=openSqliteStore(join(h.root,'wex-space.sqlite'),'space-registry');try{assert.deepEqual(check.read(),before);}finally{check.close();}
 });
}
