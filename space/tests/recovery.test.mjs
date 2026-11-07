import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,rmSync,existsSync,copyFileSync,renameSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {openSqliteStore,directoryLock} from '../../dist/shared/src/index.js';
import {createPermissions} from '../../dist/permissions/src/index.js';
import {fixture} from './fixture.mjs';
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const attach=(h,s,location=h.a,intent='attach',expectedContextId)=>h.exec(s,{kind:'context.attach',intent,location,...(expectedContextId?{expectedContextId}:{})});
const locate=(h,s,id)=>s.query(h.request('context.locate',`context:${id}`,id),{kind:'context.location',id});
function anotherRoot(h){const root=join(h.dir,'new-public');mkdirSync(root);writeFileSync(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'new-root'}));return root;}
test('explicit attach rebuilds a lost public locator without rewriting Context data or generating an ID',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);await h.exec(s,{kind:'address.add',contextId:c.id,intent:'address',name:'主仓',address:'https://example.org/main'});await s.close();
 const before=hash(join(h.a,'wex-context.sqlite'));rmSync(join(h.root,'wex-space.sqlite'));const r=await h.open({id(){throw Error('attach must not generate identity');}});
 const result=await attach(h,r);assert.equal(result.status,'committed');assert.equal(result.id,c.id);assert.equal((await h.query(r,c.id)).value.resources[0].name,'主仓');assert.equal(hash(join(h.a,'wex-context.sqlite')),before);assert.equal(existsSync(join(h.b,'wex-context.sqlite')),false);
 await r.close();const reopened=await h.open();assert.equal((await h.query(reopened,c.id)).value.id,c.id);
});
test('Context can attach to a new public data root while body and original creation provenance stay unchanged',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);await h.exec(s,{kind:'context.edit',intent:'rename',id:c.id,expectedRevision:1,name:'已有项目'});
 const before=hash(join(h.a,'wex-context.sqlite')),r=await h.open({dataRoot:anotherRoot(h)});const result=await attach(h,r);assert.equal(result.status,'committed');assert.equal(result.revision,2);assert.equal((await h.query(r,c.id)).value.name,'已有项目');assert.equal(hash(join(h.a,'wex-context.sqlite')),before);
});
test('reattach preserves original creation receipt and repeated attach intent returns its original result',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);const one=await attach(h,s);assert.equal(one.status,'committed');assert.equal((await attach(h,s,h.a,'attach-new')).id,c.id);assert.equal((await h.create(s)).id,c.id);
 await h.exec(s,{kind:'context.edit',intent:'edit',id:c.id,expectedRevision:1,name:'new'});assert.deepEqual(await attach(h,s),one);
});
test('same Context identity at a second physical location is blocked instead of merged or rebound',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);for(const file of ['wex-context.sqlite','.wex-root.json'])copyFileSync(join(h.a,file),join(h.b,file));const before=hash(join(h.b,'wex-context.sqlite'));
 const result=await attach(h,s,h.b);assert.equal(result.status,'rejected');assert.equal(result.reason,'identity_conflict');assert.equal(hash(join(h.b,'wex-context.sqlite')),before);assert.equal((await locate(h,s,c.id)).value.location,resolve(h.a));
});
test('empty or ordinary selected directories never become Contexts through attach',async t=>{
 const h=await fixture(t),s=await h.open();const empty=await attach(h,s);assert.equal(empty.status,'unavailable');assert.equal(existsSync(join(h.a,'wex-context.sqlite')),false);
 const ordinary=join(h.dir,'ordinary');mkdirSync(ordinary);writeFileSync(join(ordinary,'notes.txt'),'user notes');assert.equal((await attach(h,s,ordinary,'ordinary')).status,'unavailable');assert.equal(readFileSync(join(ordinary,'notes.txt'),'utf8'),'user notes');assert.equal(existsSync(join(ordinary,'.wex-root.json')),false);
});
test('future or damaged Context format is rejected during attach without resetting its data',async t=>{
 const h=await fixture(t),s=await h.open();const db=openSqliteStore(join(h.a,'wex-context.sqlite'),'space-context');db.commit({intent:'future',expectedRevision:0,value:{format:99,domain:'context'}});db.close();const before=hash(join(h.a,'wex-context.sqlite'));
 assert.equal((await attach(h,s)).status,'unavailable');assert.equal(hash(join(h.a,'wex-context.sqlite')),before);
});
test('expected identity and original creation evidence are checked before registering an existing body',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s),r=await h.open({dataRoot:anotherRoot(h)});assert.equal((await attach(h,r,h.a,'wrong','different-id')).reason,'identity_conflict');
 const db=openSqliteStore(join(h.a,'wex-context.sqlite'),'space-context'),snap=db.read();snap.value.intents[0].command='{invalid';db.commit({intent:'tamper',expectedRevision:snap.revision,value:snap.value});db.close();assert.equal((await attach(h,r,h.a,'tamper')).status,'unavailable');assert.equal((await h.query(r,c.id)).reason,'not_found');
});
test('attach repairs pending creation registration only after observing its committed body',async t=>{
 const h=await fixture(t);let fail=true;const s=await h.open({openStore(path,ns){const db=openSqliteStore(path,ns);return ns!=='space-registry'?db:{...db,commit(c){if(fail&&c.value.contexts?.some(x=>x.phase==='ready')){fail=false;return {status:'not_committed',reason:'storage_unavailable'};}return db.commit(c);}};}});
 const c=await h.create(s);assert.equal(c.status,'unknown');await s.close();const r=await h.open();const before=hash(join(h.a,'wex-context.sqlite'));assert.equal((await attach(h,r)).id,c.id);assert.equal((await h.create(r)).status,'committed');assert.equal(hash(join(h.a,'wex-context.sqlite')),before);
});
test('lost attach registry COMMIT reply is recovered after reopening without a second body write',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);await s.close();const before=hash(join(h.a,'wex-context.sqlite'));let once=true;const r=await h.open({openStore(path,ns){const db=openSqliteStore(path,ns);return ns!=='space-registry'?db:{...db,commit(c){const result=db.commit(c);if(once&&c.intent.endsWith(':apply')&&result.status==='committed'){once=false;return {status:'unknown',intent:c.intent};}return result;}};}});
 const result=await attach(h,r);assert.equal(result.status,'unknown');await r.close();const reopened=await h.open();assert.equal((await attach(h,reopened)).id,c.id);assert.equal(hash(join(h.a,'wex-context.sqlite')),before);
});
test('retargeted alias cannot replay the receipt of a different attached Context',async t=>{
 const h=await fixture(t),s=await h.open(),a=await h.create(s),b=await h.create(s,h.b,'b','B'),alias=join(h.dir,'selected');symlinkSync(h.a,alias,'dir');assert.equal((await attach(h,s,alias)).id,a.id);rmSync(alias);symlinkSync(h.b,alias,'dir');const result=await attach(h,s,alias);assert.equal(result.status,'unavailable');assert.equal('id'in result,false);assert.notEqual(a.id,b.id);
});
test('directory lease blocks attach and cancellation does not change the registry',async t=>{
 const h=await fixture(t),s=await h.open();await h.create(s);const before=hash(join(h.root,'wex-space.sqlite'));const lease=await directoryLock.acquire({path:h.a,id:'a-root'});assert.equal(lease.status,'acquired');assert.equal((await attach(h,s)).status,'unavailable');await lease.release();
 const cmd={kind:'context.attach',location:h.a,intent:'cancel'},ac=new AbortController();ac.abort();assert.equal((await s.execute(h.req(cmd),cmd,ac.signal)).reason,'cancelled');assert.equal(hash(join(h.root,'wex-space.sqlite')),before);assert.equal((await attach(h,s)).status,'committed');
});
test('permission revocation while inspecting an existing Context blocks registry changes',async t=>{
 const h=await fixture(t),first=await h.open();await h.create(first);await first.close();const r=await h.open({lock:{async acquire(root){const lease=await directoryLock.acquire(root);if(root.path===resolve(h.a))h.revoke();return lease;}}});const before=hash(join(h.root,'wex-space.sqlite'));const result=await attach(h,r);assert.equal(result.status,'rejected');assert.equal(result.reason,'fixture_denied');assert.equal(hash(join(h.root,'wex-space.sqlite')),before);
});
test('real local-entry refusal also applies to attach, without disclosing the Context identity',async t=>{
 let db;t.after(()=>db?.close());
 const h=await fixture(t),s=await h.open();await h.create(s);await s.close();db=openSqliteStore(join(h.dir,'permissions.sqlite'),'permissions');
 const scope={subject:'user',entry:'local',conversation:'none',context:null,resource:'space',action:'context.attach',target:resolve(h.a),relationship:'direct',relationshipGeneration:1};const permission=createPermissions(db,{current:()=>({...scope,kind:'local',moduleEnabled:true,globalEnabled:true,conversationEnabled:true,sourceAllowed:true}),canManage:()=>true,canReadHistory:()=>true});
 const r=await h.open({permission});const result=await attach(h,r);assert.equal(result.status,'rejected');assert.equal(result.reason,'entry_policy_unresolved');assert.equal('id'in result,false);
});
test('authorized location diagnostics distinguish missing volume data from deletion and never create replacements',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);const ready=await locate(h,s,c.id);assert.equal(ready.status,'ok');assert.equal(ready.value.status,'available');assert.equal(ready.value.registration,'ready');assert.equal(ready.value.location,resolve(h.a));assert.ok(Number.isFinite(Date.parse(ready.value.observedAt)));
 renameSync(h.a,h.a+'-offline');const missing=await locate(h,s,c.id);assert.equal(missing.status,'ok');assert.equal(missing.value.status,'unavailable');assert.equal(missing.value.location,resolve(h.a));assert.equal(existsSync(h.a),false);renameSync(h.a+'-offline',h.a);assert.equal((await locate(h,s,c.id)).value.status,'available');h.revoke();assert.equal((await locate(h,s,c.id)).status,'rejected');
});
test('workspace directory registration is independent from Context data and preserves offline paths',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s),sp=await h.exec(s,{kind:'space.create',intent:'space',name:'WEX'});const missing=join(h.dir,'offline-workspace');
 const result=await h.exec(s,{kind:'space.directory',intent:'directory',id:sp.id,expectedRevision:1,location:missing});assert.equal(result.status,'committed');assert.equal(existsSync(missing),false);assert.equal((await h.query(s,c.id)).value.revision,1);
 let q=await s.query(h.request('organization.list','root:root'),{kind:'organization',entity:'space'});assert.equal(q.value[0].directory,missing);assert.equal(q.value[0].revision,2);
 assert.equal((await h.exec(s,{kind:'space.directory',intent:'stale',id:sp.id,expectedRevision:1,location:null})).reason,'revision_conflict');await s.close();const r=await h.open();q=await r.query(h.request('organization.list','root:root'),{kind:'organization',entity:'space'});assert.equal(q.value[0].directory,missing);assert.equal((await h.exec(r,{kind:'space.directory',intent:'clear',id:sp.id,expectedRevision:2,location:null})).status,'committed');assert.equal((await h.query(r,c.id)).value.id,c.id);
});

test('unconfirmed attach apply remains unknown across restart instead of being replayed or misreported as a changed location',async t=>{
 const h=await fixture(t),s=await h.open();await h.create(s);await s.close();rmSync(join(h.root,'wex-space.sqlite'));let once=true;
 const r=await h.open({openStore(path,ns){const db=openSqliteStore(path,ns);return ns!=='space-registry'?db:{...db,commit(c){if(once&&c.intent.endsWith(':apply')){once=false;return {status:'unknown',intent:c.intent};}return db.commit(c);}};}});
 assert.equal((await attach(h,r)).status,'unknown');const before=hash(join(h.a,'wex-context.sqlite'));await r.close();const reopened=await h.open();assert.equal((await attach(h,reopened)).status,'unknown');assert.equal(hash(join(h.a,'wex-context.sqlite')),before);
});
test('literal legacy v1 registry reads without migration, missing directory defaults or revision changes',async t=>{
 const h=await fixture(t);const file=join(h.root,'wex-space.sqlite'),db=openSqliteStore(file,'space-registry');
 const legacy={format:1,domain:'space',rootId:'root',categories:[],spaces:[{id:'legacy',revision:7,name:'old',description:'v1',categoryId:null}],groups:[],contexts:[],intents:[]};db.commit({intent:'legacy-fixture',expectedRevision:0,value:legacy});db.close();const before=hash(file),s=await h.open();
 const q=await s.query(h.request('organization.list','root:root'),{kind:'organization',entity:'space'});assert.deepEqual(q.value,legacy.spaces);assert.equal(hash(file),before);
 assert.equal((await h.exec(s,{kind:'space.directory',intent:'directory',id:'legacy',expectedRevision:7,location:'D:/workspace'})).status,'committed');
});
test('creation proof cannot use a receipt revision that does not match the original body transaction',async t=>{
 const h=await fixture(t),s=await h.open();await h.create(s);const db=new DatabaseSync(join(h.a,'wex-context.sqlite'));db.prepare('UPDATE intents SET revision=123 WHERE ns=?').run('space-context');db.close();const before=hash(join(h.a,'wex-context.sqlite'));
 const r=await h.open({dataRoot:anotherRoot(h)});assert.equal((await attach(h,r)).status,'unavailable');assert.equal(hash(join(h.a,'wex-context.sqlite')),before);
});
test('exhausted business revision is rejected before persisting an invalid directory update',async t=>{
 const h=await fixture(t),s=await h.open();const sp=await h.exec(s,{kind:'space.create',intent:'space',name:'max'});await s.close();const file=join(h.root,'wex-space.sqlite'),db=openSqliteStore(file,'space-registry'),snap=db.read();snap.value.spaces[0].revision=Number.MAX_SAFE_INTEGER;db.commit({intent:'revision-fixture',expectedRevision:snap.revision,value:snap.value});db.close();const before=hash(file),r=await h.open();
 const result=await h.exec(r,{kind:'space.directory',intent:'overflow',id:sp.id,expectedRevision:Number.MAX_SAFE_INTEGER,location:'D:/workspace'});assert.equal(result.status,'rejected');assert.equal(result.reason,'revision_exhausted');assert.equal(hash(file),before);
});
test('missing body database diagnostics preserve the locator and do not create a blank database',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);rmSync(join(h.a,'wex-context.sqlite'));const result=await locate(h,s,c.id);assert.equal(result.status,'ok');assert.equal(result.value.status,'unavailable');assert.equal(result.value.reason,'missing_data');assert.equal(result.value.registration,'ready');assert.equal(existsSync(join(h.a,'wex-context.sqlite')),false);
});
const contexts=(h,s)=>s.query(h.request('context.list','root:root'),{kind:'contexts'});
test('visible Context list reads current bodies without requiring Space or Group placements',async t=>{
 const h=await fixture(t),s=await h.open(),a=await h.create(s),b=await h.create(s,h.b,'b','B');const q=await contexts(h,s);assert.equal(q.status,'ok');assert.equal(q.complete,true);assert.deepEqual(q.value.map(x=>[x.id,x.name,x.status]),[[a.id,'工程','available'],[b.id,'B','available']]);assert.ok(q.value.every(x=>!('location'in x)&&!('resources'in x)));
});
test('hidden Contexts cannot alter visible list content, counts or completeness',async t=>{
 const h=await fixture(t),first=await h.open(),a=await h.create(first);await first.close();const s=await h.open({deriveRequest(_parent,scope){return scope.target===`context:${a.id}`?h.request(scope.action,scope.target,scope.context):undefined;}});const before=await contexts(h,s);await h.create(s,h.b,'b','hidden');assert.deepEqual(await contexts(h,s),before);
});
test('authorized Context list reports partial source failure without using cached names or creating data',async t=>{
 const h=await fixture(t),s=await h.open(),a=await h.create(s),b=await h.create(s,h.b,'b','B');renameSync(h.b,h.b+'-offline');const q=await contexts(h,s);assert.equal(q.status,'ok');assert.equal(q.complete,false);assert.equal(q.value.find(x=>x.id===a.id).name,'工程');const unavailable=q.value.find(x=>x.id===b.id);assert.equal(unavailable.status,'unavailable');assert.equal('name'in unavailable,false);assert.equal(existsSync(h.b),false);renameSync(h.b+'-offline',h.b);assert.equal((await contexts(h,s)).complete,true);
});
test('Context enumeration denies after revocation during a later directory inspection',async t=>{
 const h=await fixture(t),first=await h.open();await h.create(first);await h.create(first,h.b,'b','B');await first.close();const s=await h.open({lock:{async acquire(root){const lease=await directoryLock.acquire(root);if(root.path===resolve(h.b))h.revoke();return lease;}}});const result=await contexts(h,s);assert.equal(result.status,'rejected');assert.equal(JSON.stringify(result).includes('工程'),false);assert.equal('value'in result,false);
});
test('Context list rejects projections bound to a different principal',async t=>{
 const h=await fixture(t),s=await h.open();await h.create(s);const evaluate=h.permission.evaluate.bind(h.permission);h.permission.evaluate=function(request){const d=evaluate(request);return d.status==='allow'&&d.scope.action==='context.read'?{...d,scope:{...d.scope,subject:'someone-else'}}:d;};const q=await contexts(h,s);assert.equal(q.status,'ok');assert.deepEqual(q.value,[]);
});
test('missing trusted projection binding is reported independently of whether Contexts exist',async t=>{
 const h=await fixture(t),s=await h.open({deriveRequest:undefined});const before=await contexts(h,s);await h.create(s);const after=await contexts(h,s);assert.deepEqual(after,before);assert.equal(after.status,'unavailable');assert.equal(after.reason,'projection_binding_unavailable');
});
test('failure completeness does not reveal a Context revoked during a later source inspection',async t=>{
 const h=await fixture(t),first=await h.open(),a=await h.create(first),b=await h.create(first,h.b,'b','B');await first.close();renameSync(h.a,h.a+'-offline');let hideA=false;
 const evaluate=h.permission.evaluate.bind(h.permission);h.permission.evaluate=function(request){const d=evaluate(request);return hideA&&d.status==='allow'&&d.scope.target===`context:${a.id}`?{status:'deny',reason:'revoked'}:d;};
 const s=await h.open({lock:{async acquire(root){const lease=await directoryLock.acquire(root);if(root.path===resolve(h.b))hideA=true;return lease;}}});const q=await contexts(h,s);assert.equal(q.status,'ok');assert.equal(q.complete,true);assert.deepEqual(q.value.map(x=>x.id),[b.id]);assert.equal(JSON.stringify(q).includes(a.id),false);
});
