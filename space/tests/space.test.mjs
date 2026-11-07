import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync,rmSync,existsSync,symlinkSync,renameSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {createPermissions} from '../../dist/permissions/src/index.js';
const api=await import('../../dist/space/src/index.js').catch(()=>({}));
import {fixture} from './fixture.mjs';
test('independent Context preserves identity and own-directory data across a real process restart',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);assert.equal(c.status,'committed');
 assert.equal((await h.query(s,c.id)).value.name,'工程');
 assert.equal(existsSync(join(h.a,'wex-context.sqlite')),true);
 await s.close();
 const child=spawnSync(process.execPath,['--input-type=module','-e',`import {openSqliteStore} from './dist/shared/src/index.js';const s=openSqliteStore(process.argv[1],'space-context');console.log(JSON.stringify(s.read().value.context));s.close();`,join(h.a,'wex-context.sqlite')],{cwd:process.cwd(),encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);assert.deepEqual(JSON.parse(child.stdout),{id:c.id,revision:1,name:'工程',description:'',config:{},primaryAddress:null});
 const reopened=await h.open();assert.equal((await h.query(reopened,c.id)).value.id,c.id);
 assert.equal((await h.create(reopened)).id,c.id);
});
test('category, Space and optional Group rename without changing Context or moving data',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);
 const cat=await h.exec(s,{kind:'category.create',intent:'category',name:'个人'});
 const sp=await h.exec(s,{kind:'space.create',intent:'space',name:'开发',categoryId:cat.id});
 const gr=await h.exec(s,{kind:'group.create',intent:'group',spaceId:sp.id,name:'WEX'});
 for(const [kind,obj,name] of [['category',cat,'公开'],['space',sp,'软件'],['group',gr,'项目']])assert.equal((await h.exec(s,{kind:`${kind}.edit`,intent:`rename-${kind}`,id:obj.id,expectedRevision:1,name})).status,'committed');
 const q=await s.query(h.request('organization.list','root:root'),{kind:'organization',entity:'space'});assert.equal(q.value[0].name,'软件');
 assert.equal((await h.query(s,c.id)).value.revision,1);assert.equal(existsSync(h.a),true);
 assert.equal((await h.exec(s,{kind:'placement.add',intent:'p',contextId:c.id,spaceId:sp.id})).reason,'unsupported_command');
});
test('main, operation, output and reference addresses remain independent and unverified',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);const refs=[];
 for(const [name,address,purpose] of [['主仓','https://github.com/a/b','main'],['操作','D:/work','operation'],['产出','E:/output','output'],['文档','https://example.org/spec','reference']])refs.push(await h.exec(s,{kind:'address.add',intent:name,contextId:c.id,name,address,notes:'备注',purpose}));
 assert.ok(refs.every(r=>r.status==='committed'));
 assert.equal((await h.exec(s,{kind:'primary.select',intent:'primary',contextId:c.id,id:refs[0].id,expectedRevision:1})).status,'committed');
 const first=await h.query(s,c.id);assert.equal(first.value.primaryAddress,refs[0].id);assert.equal(first.value.resources.length,4);assert.ok(first.value.resources.every(r=>r.status==='unverified'));
 assert.equal((await h.exec(s,{kind:'address.edit',intent:'edit',contextId:c.id,id:refs[1].id,expectedRevision:1,name:'本地',address:'F:/work',notes:'新备注',purpose:'operation'})).status,'committed');
 assert.equal((await h.exec(s,{kind:'address.remove',intent:'remove',contextId:c.id,id:refs[0].id,expectedRevision:1})).status,'committed');
 const after=(await h.query(s,c.id)).value;assert.equal(after.primaryAddress,null);assert.equal(after.resources.length,3);assert.equal(after.resources.find(r=>r.id===refs[2].id).revision,1);assert.equal(existsSync(h.a),true);
});
test('persisted original intent replays independently of unrelated later mutations; changed content conflicts',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);const cmd={kind:'address.add',intent:'address',contextId:c.id,name:'a',address:'https://example.org'};
 const a=await h.exec(s,cmd);await h.exec(s,{...cmd,intent:'b',name:'b'});await s.close();const r=await h.open();
 assert.deepEqual(await h.exec(r,cmd),a);assert.equal((await h.exec(r,{...cmd,name:'changed'})).reason,'intent_conflict');assert.equal((await h.query(r,c.id)).value.resources.length,2);
 assert.equal((await h.exec(r,{kind:'context.edit',intent:'edit',id:c.id,expectedRevision:1,name:'new'})).status,'committed');
 assert.equal((await h.exec(r,{kind:'context.edit',intent:'stale',id:c.id,expectedRevision:1,name:'old'})).reason,'revision_conflict');
});
test('permission denial, wrong target, cancellation and revoked replay disclose no prior result',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);
 h.revoke();assert.equal((await h.create(s)).status,'rejected');assert.equal((await h.query(s,c.id)).status,'rejected');h.allow();
 const cmd={kind:'context.edit',intent:'wrong',id:c.id,expectedRevision:1,name:'bad'};
 assert.equal((await h.exec(s,cmd,h.request('context.edit','context:other',c.id))).reason,'scope_mismatch');
 const ac=new AbortController();ac.abort();assert.equal((await s.execute(h.req(cmd),cmd,ac.signal)).reason,'cancelled');assert.equal((await h.query(s,c.id)).value.name,'工程');
});
test('real permissions blocks local entry; Space never disguises it as conversation',async t=>{
 let db;t.after(()=>db?.close());
 const h=await fixture(t);db=openSqliteStore(join(h.dir,'permission.sqlite'),'permissions');
 const scope={subject:'user',entry:'local',conversation:'none',context:null,resource:'space',action:'context.create',target:resolve(h.a),relationship:'direct',relationshipGeneration:1};
 const real=createPermissions(db,{current:()=>({...scope,kind:'local',moduleEnabled:true,globalEnabled:true,conversationEnabled:true,sourceAllowed:true}),canManage:()=>true,canReadHistory:()=>true});
 const s=await h.open({permission:real});const result=await h.create(s);assert.equal(result.status,'rejected');assert.equal(result.reason,'entry_policy_unresolved');assert.equal(existsSync(join(h.a,'wex-context.sqlite')),false);
});
test('missing directory reads never create replacement data and reconnect retains identity',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);renameSync(h.a,h.a+'-offline');assert.equal((await h.query(s,c.id)).status,'unavailable');assert.equal(existsSync(h.a),false);renameSync(h.a+'-offline',h.a);assert.equal((await h.query(s,c.id)).value.id,c.id);
});
test('Context creation recovers original ID after body commit and registry-ready failure',async t=>{
 const h=await fixture(t);let failReady=true;
 const s=await h.open({openStore(path,ns){const db=openSqliteStore(path,ns);return ns!=='space-registry'?db:{...db,commit(c){if(failReady&&c.value.contexts?.some(x=>x.phase==='ready')){failReady=false;return {status:'not_committed',reason:'storage_unavailable'};}return db.commit(c);}};}});
 const c=await h.create(s);assert.equal(c.status,'unknown');await s.close();const r=await h.open();const done=await h.create(r);assert.equal(done.status,'committed');assert.equal(done.id,c.id);assert.equal((await h.query(r,done.id)).value.name,'工程');
});
test('lost body COMMIT reply is observed on recovery rather than creating a second identity',async t=>{
 const h=await fixture(t);let once=true;const s=await h.open({openStore(path,ns){const db=openSqliteStore(path,ns);return ns!=='space-context'?db:{...db,commit(c){const r=db.commit(c);if(once&&r.status==='committed'){once=false;return {status:'unknown',intent:c.intent};}return r;}};}});
 const c=await h.create(s);assert.equal(c.status,'unknown');const result=await h.create(s);assert.equal(result.id,c.id);assert.equal(result.status,'committed');
});
test('future Context store is not overwritten',async t=>{
 const h=await fixture(t),s=await h.open();const db=openSqliteStore(join(h.a,'wex-context.sqlite'),'space-context');db.commit({intent:'foreign',expectedRevision:0,value:{format:99,domain:'context'}});db.close();
 assert.equal((await h.create(s)).status,'unavailable');const verify=openSqliteStore(join(h.a,'wex-context.sqlite'),'space-context');assert.equal(verify.read().value.format,99);verify.close();
});
test('owner-verified API and Role references persist separately; tools do not enable another Context',async t=>{
 const h=await fixture(t,{owner:{async resolve(_r,target){return {status:'available',...target,sourceRevision:'v1',observedAt:'2026-11-04T00:00:00Z'};}}}),s=await h.open(),a=await h.create(s),b=await h.create(s,h.b,'create-b','B');
 for(const [owner,targetType,targetId] of [['connections/api','api','api-a'],['AI','role','role-r']])assert.equal((await h.exec(s,{kind:'association.add',contextId:a.id,intent:targetId,owner,targetType,targetId,purpose:'selected'})).status,'committed');
 const tool=await h.exec(s,{kind:'tool.add',contextId:a.id,intent:'tool',owner:'connections',targetType:'tool',targetId:'compiler',purpose:'build'});assert.equal(tool.status,'committed');
 assert.equal((await h.exec(s,{kind:'tool.set',contextId:a.id,intent:'disable',id:tool.id,expectedRevision:1,enabled:false})).status,'committed');
 const va=(await h.query(s,a.id)).value,vb=(await h.query(s,b.id)).value;assert.deepEqual(va.associations.map(x=>x.targetId),['api-a','role-r']);assert.equal(va.tools[0].enabled,false);assert.equal(vb.tools.length,0);
 await s.close();const r=await h.open();assert.equal((await h.query(r,a.id)).value.associations.length,2);
});
test('unavailable owners, secret fields and Context cycles do not fabricate capabilities',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);
 assert.equal((await h.exec(s,{kind:'association.add',contextId:c.id,intent:'owner',owner:'AI',targetType:'role',targetId:'r',purpose:'role'})).status,'unavailable');
 assert.equal((await h.exec(s,{kind:'address.add',contextId:c.id,intent:'secret',name:'bad',address:'https://example.org',apiKey:'secret'})).reason,'invalid_command');
 assert.equal((await h.exec(s,{kind:'association.add',contextId:c.id,intent:'cycle',owner:'space',targetType:'context',targetId:c.id,purpose:'cycle'})).reason,'unsupported_target');
 assert.equal((await h.query(s,c.id)).value.associations.length,0);
});
test('organization listing filters per-object visibility and never returns a pre-filter count',async t=>{
 const h=await fixture(t),s=await h.open();await h.exec(s,{kind:'space.create',intent:'sp',name:'secret'});await s.close();
 const r=await h.open({deriveRequest(){return undefined;}});const q=await r.query(h.request('organization.list','root:root'),{kind:'organization',entity:'space'});assert.equal(q.status,'ok');assert.deepEqual(q.value,[]);assert.equal('total' in q,false);
});
test('root lease and unsafe SQLite symlink block opening without altering foreign files',async t=>{
 const h=await fixture(t),s=await h.open();assert.equal((await api.openSpaceService({dataRoot:h.root,permission:h.permission})).status,'unavailable');await s.close();
 const outside=join(h.dir,'outside');writeFileSync(outside,'DO NOT TOUCH');rmSync(join(h.root,'wex-space.sqlite'));symlinkSync(outside,join(h.root,'wex-space.sqlite'));assert.equal((await api.openSpaceService({dataRoot:h.root,permission:h.permission})).status,'unavailable');assert.equal(readFileSync(outside,'utf8'),'DO NOT TOUCH');
});
test('hidden organization objects cannot change completeness metadata',async t=>{
 const h=await fixture(t),s=await h.open();await s.close();
 const restricted=await h.open({deriveRequest(){return undefined;}});
 const before=await restricted.query(h.request('organization.list','root:root'),{kind:'organization',entity:'space'});
 await h.exec(restricted,{kind:'space.create',intent:'hidden',name:'hidden'});
 const after=await restricted.query(h.request('organization.list','root:root'),{kind:'organization',entity:'space'});
 assert.deepEqual(after,before,'even completeness must not reveal hidden object existence');
});
test('concurrent close is idempotent and confirmed before a replacement writer starts',async t=>{
 const h=await fixture(t),s=await h.open();await h.create(s);await Promise.all([s.close(),s.close()]);const r=await h.open();assert.equal((await h.query(r,'id-1')).status,'ok');
});
test('corrupt persisted objects with extra secret fields are unavailable rather than projected',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);const db=openSqliteStore(join(h.a,'wex-context.sqlite'),'space-context'),snap=db.read();snap.value.context.apiKey='must-not-project';db.commit({intent:'tamper',expectedRevision:snap.revision,value:snap.value});db.close();
 const q=await h.query(s,c.id);assert.equal(q.status,'unavailable');assert.equal(JSON.stringify(q).includes('must-not-project'),false);
});
test('unreadable category references cannot be probed through Space creation',async t=>{
 const h=await fixture(t),s=await h.open();const cat=await h.exec(s,{kind:'category.create',intent:'cat-secret',name:'private'});await s.close();const restricted=await h.open({deriveRequest(){return undefined;}});
 const a=await h.exec(restricted,{kind:'space.create',intent:'guess-a',name:'probe',categoryId:cat.id});
 const b=await h.exec(restricted,{kind:'space.create',intent:'guess-b',name:'probe',categoryId:'does-not-exist'});
 assert.deepEqual(a,b);assert.equal(a.status,'rejected');
});
test('queued commands are snapshots, not mutable caller objects',async t=>{
 let release,entered;const arrived=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 const h=await fixture(t,{owner:{async resolve(_r,target){entered();await gate;return {status:'available',...target,sourceRevision:'v1',observedAt:'2026-11-04T00:00:00Z'};}}}),s=await h.open(),c=await h.create(s);
 const first=h.exec(s,{kind:'association.add',contextId:c.id,intent:'role',owner:'AI',targetType:'role',targetId:'r',purpose:'test'});await arrived;
 const input={kind:'address.add',contextId:c.id,intent:'snapshot',name:'original',address:'https://example.org'};const next=h.exec(s,input);input.name='changed-after-call';release();await first;assert.equal((await next).status,'committed');
 assert.equal((await h.query(s,c.id)).value.resources[0].name,'original');
});
test('owner projections without source evidence are not reported as available selections',async t=>{
 let valid=true;const h=await fixture(t,{owner:{async resolve(_r,target){return valid?{status:'available',...target,sourceRevision:'v1',observedAt:'2026-11-04T00:00:00Z'}:{status:'available',...target};}}}),s=await h.open(),c=await h.create(s);
 await h.exec(s,{kind:'association.add',contextId:c.id,intent:'role',owner:'AI',targetType:'role',targetId:'r',purpose:'selected'});valid=false;assert.deepEqual((await h.query(s,c.id)).value.associations,[]);
});
test('prototype command names are rejected without touching domain state',async t=>{
 const h=await fixture(t),s=await h.open();assert.equal((await h.exec(s,{kind:'__proto__',intent:'invalid'})).status,'rejected');
});
test('visible Space projection does not reveal a hidden category relationship',async t=>{
 const h=await fixture(t),s=await h.open();const cat=await h.exec(s,{kind:'category.create',intent:'cat',name:'private'});await h.exec(s,{kind:'space.create',intent:'space',name:'visible',categoryId:cat.id});await s.close();
 const r=await h.open({deriveRequest(parent,scope){return scope.action==='category.read'?undefined:h.request(scope.action,scope.target,scope.context);}});
 const q=await r.query(h.request('organization.list','root:root'),{kind:'organization',entity:'space'});assert.equal(q.value[0].categoryId,null);
});

test('replaying creation through a retargeted directory alias does not expose the original Context',async t=>{
 const h=await fixture(t),s=await h.open();const alias=join(h.dir,'chosen');symlinkSync(h.a,alias,'dir');const c=await h.create(s,alias);assert.equal(c.status,'committed');rmSync(alias);symlinkSync(h.b,alias,'dir');
 const replay=await h.create(s,alias);assert.equal(replay.status,'unavailable');assert.equal('id' in replay,false);assert.equal(existsSync(join(h.b,'wex-context.sqlite')),false);
});
test('business-intent namespaces bind the exact capability and target scope',async t=>{
 const h=await fixture(t),s=await h.open();assert.equal((await h.exec(s,{kind:'category.create',intent:'same',name:'category'})).status,'committed');assert.equal((await h.exec(s,{kind:'space.create',intent:'same',name:'space'})).status,'committed');
});
test('lost mutation reply is recovered after restart without adding a second address',async t=>{
 const h=await fixture(t);let lose=true;const s=await h.open({openStore(path,ns){const db=openSqliteStore(path,ns);return ns!=='space-context'?db:{...db,commit(c){const result=db.commit(c);if(lose&&c.intent.endsWith(':apply')&&result.status==='committed'){lose=false;return {status:'unknown',intent:c.intent};}return result;}};}});
 const c=await h.create(s),cmd={kind:'address.add',contextId:c.id,intent:'lost',name:'address',address:'https://example.org'};const lost=await h.exec(s,cmd);assert.equal(lost.status,'unknown');await s.close();const r=await h.open();const replay=await h.exec(r,cmd);assert.equal(replay.status,'committed');assert.equal(replay.id,lost.id);assert.equal((await h.query(r,c.id)).value.resources.length,1);
});
test('unconfirmed prepared mutation remains observation-only through restart',async t=>{
 const h=await fixture(t);let lose=true;const s=await h.open({openStore(path,ns){const db=openSqliteStore(path,ns);return ns!=='space-context'?db:{...db,commit(c){if(lose&&c.intent.endsWith(':apply')){lose=false;return {status:'unknown',intent:c.intent};}return db.commit(c);}};}});
 const c=await h.create(s),cmd={kind:'address.add',contextId:c.id,intent:'unknown',name:'address',address:'https://example.org'};assert.equal((await h.exec(s,cmd)).status,'unknown');assert.equal((await h.exec(s,cmd)).status,'unknown');assert.equal((await h.query(s,c.id)).value.resources.length,0);await s.close();const r=await h.open();assert.equal((await h.exec(r,cmd)).status,'unknown');assert.equal((await h.query(r,c.id)).value.resources.length,0);
});
test('cancellation after confirmed mutation commit does not erase the committed fact',async t=>{
 const h=await fixture(t),ac=new AbortController();const s=await h.open({openStore(path,ns){const db=openSqliteStore(path,ns);return ns!=='space-context'?db:{...db,commit(c){const result=db.commit(c);if(c.intent.endsWith(':apply')&&result.status==='committed')ac.abort();return result;}};}});
 const c=await h.create(s),cmd={kind:'address.add',contextId:c.id,intent:'cancel-after',name:'address',address:'https://example.org'};assert.equal((await s.execute(h.req(cmd),cmd,ac.signal)).status,'committed');assert.equal((await h.query(s,c.id)).value.resources.length,1);
});
test('ID collisions never overwrite a Context or reuse its identity for an address',async t=>{
 const h=await fixture(t,{id:()=> 'collision'}),s=await h.open(),c=await h.create(s);assert.equal(c.status,'committed');assert.equal((await h.create(s,h.b,'different')).reason,'id_collision');assert.equal(existsSync(join(h.b,'wex-context.sqlite')),false);
 assert.equal((await h.exec(s,{kind:'address.add',contextId:c.id,intent:'address',name:'collision',address:'https://example.org'})).reason,'id_collision');assert.equal((await h.query(s,c.id)).value.resources.length,0);
});
test('offline owner does not prevent removing local references or leave a resurrected selection',async t=>{
 let available=true;const h=await fixture(t,{owner:{async resolve(_r,target){return available?{status:'available',...target,sourceRevision:'v1',observedAt:'2026-11-04T00:00:00Z'}:{status:'unavailable'};}}}),s=await h.open(),c=await h.create(s);
 const ref=await h.exec(s,{kind:'association.add',contextId:c.id,intent:'role',owner:'AI',targetType:'role',targetId:'r',purpose:'selected'});available=false;assert.equal((await h.query(s,c.id)).value.associations.length,0);
 assert.equal((await h.exec(s,{kind:'association.remove',contextId:c.id,intent:'remove',id:ref.id,expectedRevision:1})).status,'committed');available=true;assert.equal((await h.query(s,c.id)).value.associations.length,0);
});
test('query input cannot be changed to another Context after authorization',async t=>{
 const h=await fixture(t),s=await h.open(),a=await h.create(s),b=await h.create(s,h.b,'b','private B');
 const input={kind:'context',id:a.id},evaluate=h.permission.evaluate.bind(h.permission);
 h.permission.evaluate=function(request){const d=evaluate(request);if(d.status==='allow'&&d.scope.action==='context.read')queueMicrotask(()=>{input.id=b.id;});return d;};
 const result=await s.query(h.request('context.read',`context:${a.id}`,a.id),input);assert.equal(result.status,'ok');assert.equal(result.value.id,a.id);assert.equal(result.value.name,'工程');
});

test('corrupt SQLite snapshot is unavailable on read and is never reset to empty data',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);const db=new DatabaseSync(join(h.a,'wex-context.sqlite'));db.prepare('UPDATE snapshots SET body=? WHERE ns=?').run('{broken','space-context');db.close();
 const result=await h.query(s,c.id);assert.equal(result.status,'unavailable');const check=new DatabaseSync(join(h.a,'wex-context.sqlite'));assert.equal(check.prepare('SELECT body FROM snapshots WHERE ns=?').get('space-context').body,'{broken');check.close();
});
