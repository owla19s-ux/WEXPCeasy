import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {startFoundations} from '../../dist/app/src/index.js';
import {openSqliteStore,directoryLock} from '../../dist/shared/src/index.js';

// Platform identity verification is injected here; app/Space/permissions/SQLite are real.
async function fixture(t,extra={}){
 const dir=await mkdtemp(join(tmpdir(),'wex-app-local-')),root=join(dir,'public'),context=join(dir,'context');
 for(const [path,id] of [[root,'app-root'],[context,'context-root']]){await mkdir(path);await writeFile(join(path,'.wex-root.json'),JSON.stringify({format:1,id}));}
 const source={},sources=new WeakMap(),identity={subject:'user',entry:'window-1',relationship:'window-session',relationshipGeneration:1,moduleEnabled:true,globalEnabled:true,sourceAllowed:true,entryEnabled:true};sources.set(source,identity);
 const trust={current:()=>undefined,canManage:()=>true,canReadHistory:()=>true};
 const options={dataRoot:root,trust,local:{current:(sender,operation)=>sources.get(sender)},space:{},...extra};
 const host=await startFoundations(options),hosts=[host];let revision=0,seq=0;
 t.after(async()=>{for(const h of hosts)await h.stop();await rm(dir,{recursive:true,force:true});});
 function grant(op,facts=identity){const scope={subject:facts.subject,entry:facts.entry,relationship:facts.relationship,relationshipGeneration:facts.relationshipGeneration,conversation:null,...op};const r=host.permissions.grant({intent:`grant-${++seq}`,expectedRevision:revision,scope});assert.equal(r.status,'committed');revision=r.revision;return scope;}
 return {dir,root,context,source,sources,identity,options,host,hosts,grant,op:(action,target,ctx=null)=>({resource:'space',action,target,context:ctx})};
}

test('app optionally assembles Space under its single public-root lease and routes bound local requests',async t=>{
 const h=await fixture(t);assert.equal(h.host.status,'ready');assert.ok(h.host.space);assert.ok(h.host.local);
 const op=h.op('context.create',resolve(h.context)),request=h.host.local.bind(h.source,op);assert.ok(request);assert.deepEqual(Object.keys(request),[]);
 assert.equal((await h.host.space.execute(request,{kind:'context.create',intent:'create',location:h.context,name:'project'})).reason,'no_current_grant');
 h.grant(op);const c=await h.host.space.execute(request,{kind:'context.create',intent:'create',location:h.context,name:'project'});assert.equal(c.status,'committed');
 const read=h.op('context.read',`context:${c.id}`,c.id);h.grant(read);const readRequest=h.host.local.bind(h.source,read);
 assert.equal((await h.host.space.query(readRequest,{kind:'context',id:c.id})).value.name,'project');
 const list=h.op('context.list','root:app-root');h.grant(list);const visible=await h.host.space.query(h.host.local.bind(h.source,list),{kind:'contexts'});assert.equal(visible.status,'ok');assert.deepEqual(visible.value.map(x=>x.id),[c.id]);
 assert.equal(h.host.local.bind({...h.source},op),undefined);assert.notEqual(h.host.permissions.evaluate(structuredClone(request)).status,'allow');
 const rival=await startFoundations(h.options);h.hosts.push(rival);assert.equal(rival.status,'failed');
});

test('closing a local source invalidates old requests and prevents reopening the same instance',async t=>{
 const h=await fixture(t),op=h.op('organization.list','root:app-root');h.grant(op);const request=h.host.local.bind(h.source,op),prior=h.host.permissions.evaluate(request);assert.equal(prior.status,'allow');
 h.host.local.close(h.source);assert.notEqual(h.host.permissions.recheck(request,prior).status,'allow');assert.equal(h.host.local.bind(h.source,op),undefined);assert.equal(h.host.local.derive(request,{action:'space.read',target:'space:any',context:null}),undefined);
 const replacement={};h.sources.set(replacement,{...h.identity});assert.equal(h.host.local.bind(replacement,op),undefined,'replacement must advance the entry generation');
});

test('new source generation invalidates prior bindings and requires its own exact permission grant',async t=>{
 const h=await fixture(t),op=h.op('organization.list','root:app-root');h.grant(op);const old=h.host.local.bind(h.source,op),prior=h.host.permissions.evaluate(old);assert.equal(prior.status,'allow');
 const replacement={},identity={...h.identity,relationshipGeneration:2};h.sources.set(replacement,identity);
 const request=h.host.local.bind(replacement,op);assert.ok(request);assert.notEqual(h.host.permissions.evaluate(request).status,'allow');assert.notEqual(h.host.permissions.recheck(old,prior).status,'allow');
 h.grant(op,identity);assert.equal(h.host.permissions.evaluate(request).status,'allow');
});

test('local operation input is snapshotted and every recheck observes current host gates',async t=>{
 const h=await fixture(t),op=h.op('organization.list','root:app-root');h.grant(op);const request=h.host.local.bind(h.source,op);op.target='other';const d=h.host.permissions.evaluate(request);assert.equal(d.status,'allow');assert.equal(d.scope.target,'root:app-root');
 h.identity.entryEnabled=false;assert.equal(h.host.permissions.recheck(request,d).status,'deny');h.identity.entryEnabled=true;
 assert.equal(h.host.local.bind(h.source,{...h.op('read','x'),subject:'forged'}),undefined);
 assert.equal(h.host.local.bind(h.source,{...h.op('read','x'),context:undefined}),undefined);
});

test('host stop seals local requests and saved permission management before releasing resources',async t=>{
 const h=await fixture(t),op=h.op('organization.list','root:app-root');h.grant(op);const request=h.host.local.bind(h.source,op),p=h.host.permissions;
 const stopped=h.host.stop();assert.equal(h.host.local.bind(h.source,op),undefined);assert.notEqual(p.evaluate(request).status,'allow');
 assert.equal(p.grant({intent:'late',expectedRevision:1,scope:{}}).status,'denied');assert.equal(p.history({}).status,'denied');
 assert.equal((await stopped).status,'stopped');assert.equal((await h.host.space.query(request,{kind:'contexts'})).status,'unavailable');
 const replacement=await startFoundations(h.options);h.hosts.push(replacement);assert.equal(replacement.status,'ready');
});

test('optional Space initialization failure degrades host and leaves permissions available',async t=>{
 const h=await fixture(t,{openStore(path,ns){if(ns==='space-registry')throw Error('offline');return openSqliteStore(path,ns);}});
 assert.equal(h.host.status,'degraded');assert.equal(h.host.space,undefined);assert.ok(h.host.permissions);assert.ok(h.host.diagnostics.some(x=>x.module==='space'));assert.equal((await h.host.stop()).status,'stopped');
 const replacement=await startFoundations({dataRoot:h.root,trust:h.options.trust});h.hosts.push(replacement);assert.equal(replacement.status,'ready');assert.equal(replacement.space,undefined);assert.equal(replacement.local,undefined);
});

test('uncertain Space store close retains the app root lease until shutdown retry confirms closure',async t=>{
 let once=true;const h=await fixture(t,{openStore(path,ns){const db=openSqliteStore(path,ns);return ns!=='space-registry'?db:{...db,close(){if(once){once=false;throw Error('close-unconfirmed');}db.close();}};}});
 assert.equal(h.host.status,'ready');assert.equal((await h.host.stop()).status,'incomplete');const busy=await startFoundations({dataRoot:h.root,trust:h.options.trust});h.hosts.push(busy);assert.equal(busy.status,'failed');
 assert.equal((await h.host.stop()).status,'stopped');const replacement=await startFoundations(h.options);h.hosts.push(replacement);assert.equal(replacement.status,'ready');
});

test('closing a source during owner resolution blocks pending Space writes before commit',async t=>{
 let enter,release;const arrived=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
 const h=await fixture(t,{space:{owner:{async resolve(_request,target){enter();await gate;return {status:'available',...target,sourceRevision:'1',observedAt:'2026-11-05T00:00:00Z'};}}}});
 const create=h.op('context.create',resolve(h.context));h.grant(create);const c=await h.host.space.execute(h.host.local.bind(h.source,create),{kind:'context.create',intent:'c',location:h.context,name:'C'});assert.equal(c.status,'committed');
 const add=h.op('association.add',`context:${c.id}`,c.id);h.grant(add);
 const pending=h.host.space.execute(h.host.local.bind(h.source,add),{kind:'association.add',intent:'role',contextId:c.id,owner:'AI',targetType:'role',targetId:'r',purpose:'selected'});
 await arrived;h.host.local.close(h.source);release();assert.equal((await pending).status,'rejected');
 const db=openSqliteStore(join(h.context,'wex-context.sqlite'),'space-context');assert.deepEqual(db.read().value.associations,[]);db.close();
});

test('derived requests cannot switch to another entry generation between identity checks',async t=>{
 let calls=0;const source={},identity={subject:'user',entry:'switching-window',relationship:'session',relationshipGeneration:1,moduleEnabled:true,globalEnabled:true,sourceAllowed:true,entryEnabled:true};
 const h=await fixture(t,{local:{current(sender){if(sender!==source)return;calls++;return {...identity,relationshipGeneration:calls>=3?2:1};}}});
 const parent=h.host.local.bind(source,h.op('context.list','root:app-root'));assert.ok(parent);
 const derived=h.host.local.derive(parent,{action:'context.read',target:'context:one',context:'one'});assert.equal(derived,undefined);
});

test('closed bound requests never fall back to an unrelated legacy TrustPort identity',async t=>{
 const scope={subject:'legacy',entry:'legacy',conversation:'legacy',context:null,resource:'space',action:'organization.list',target:'root:app-root',relationship:'legacy',relationshipGeneration:1};
 const h=await fixture(t,{trust:{current:()=>({...scope,kind:'conversation',moduleEnabled:true,globalEnabled:true,conversationEnabled:true,sourceAllowed:true}),canManage:()=>true,canReadHistory:()=>true}});
 assert.equal(h.host.permissions.grant({intent:'legacy',expectedRevision:0,scope}).status,'committed');
 const request=h.host.local.bind(h.source,h.op('organization.list','root:app-root'));h.host.local.close(h.source);
 assert.equal(h.host.permissions.evaluate(request).status,'indeterminate','known revoked local binding must not become a legacy conversation request');
});

test('host shutdown waits for a pending Space owner observation while sealing requests and retaining root lock',async t=>{
 let enter,release;const arrived=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
 const h=await fixture(t,{space:{owner:{async resolve(_request,target){enter();await gate;return {status:'available',...target,sourceRevision:'1',observedAt:'2026-11-05T00:00:00Z'};}}}});
 const create=h.op('context.create',resolve(h.context));h.grant(create);const c=await h.host.space.execute(h.host.local.bind(h.source,create),{kind:'context.create',intent:'c',location:h.context,name:'C'});
 const add=h.op('association.add',`context:${c.id}`,c.id);h.grant(add);const request=h.host.local.bind(h.source,add);
 const pending=h.host.space.execute(request,{kind:'association.add',intent:'role',contextId:c.id,owner:'AI',targetType:'role',targetId:'r',purpose:'selected'});await arrived;
 let complete=false;const stopping=h.host.stop().then(r=>{complete=true;return r;});assert.notEqual(h.host.permissions.evaluate(request).status,'allow');
 const busy=await startFoundations(h.options);h.hosts.push(busy);assert.equal(busy.status,'failed');assert.equal(complete,false);
 release();assert.equal((await pending).status,'rejected');assert.equal((await stopping).status,'stopped');
 const db=openSqliteStore(join(h.context,'wex-context.sqlite'),'space-context');assert.deepEqual(db.read().value.associations,[]);db.close();
});

test('source closure inside the platform verifier cannot return a late allowed request',async t=>{
 let local,closing=false;const source={},identity={subject:'user',entry:'reentrant-window',relationship:'window-session',relationshipGeneration:1,moduleEnabled:true,globalEnabled:true,sourceAllowed:true,entryEnabled:true};
 const h=await fixture(t,{local:{current(sender){if(sender!==source)return;if(closing)local.close(source);return identity;}}});local=h.host.local;
 const op=h.op('organization.list','root:app-root');h.grant(op,identity);const request=local.bind(source,op);assert.equal(h.host.permissions.evaluate(request).status,'allow');closing=true;
 assert.notEqual(h.host.permissions.evaluate(request).status,'allow');
});

test('failed Space initialization retains ownership of an unclosed store for later shutdown retries',async t=>{
 let failClose=true;const h=await fixture(t,{openStore(path,ns){const db=openSqliteStore(path,ns);return ns!=='space-registry'?db:{...db,read(){throw Error('read-failed');},close(){if(failClose)throw Error('close-unconfirmed');db.close();}};}});
 assert.equal(h.host.status,'degraded');assert.equal(h.host.space,undefined);assert.equal((await h.host.stop()).status,'incomplete');
 const busy=await startFoundations({dataRoot:h.root,trust:h.options.trust});h.hosts.push(busy);assert.equal(busy.status,'failed');
 failClose=false;assert.equal((await h.host.stop()).status,'stopped');const replacement=await startFoundations({dataRoot:h.root,trust:h.options.trust,space:{}});h.hosts.push(replacement);assert.equal(replacement.status,'ready');
});

test('configured local binding rejects raw local facts supplied through the legacy TrustPort',async t=>{
 const op={resource:'space',action:'organization.list',target:'root:app-root',context:null};
 const facts={subject:'user',entry:'window-1',relationship:'window-session',relationshipGeneration:1,conversation:null,...op,kind:'local',moduleEnabled:true,globalEnabled:true,conversationEnabled:false,entryEnabled:true,sourceAllowed:true};
 const h=await fixture(t,{trust:{current:()=>facts,canManage:()=>true,canReadHistory:()=>true}});h.grant(op);
 assert.equal(h.host.permissions.evaluate({kind:'local',subject:'user'}).status,'indeterminate');
 assert.equal(h.host.permissions.evaluate(h.host.local.bind(h.source,op)).status,'allow');
});

test('host restart reopens Context data but rejects old request objects and requires the new entry grant',async t=>{
 const h=await fixture(t),create=h.op('context.create',resolve(h.context));h.grant(create);
 const c=await h.host.space.execute(h.host.local.bind(h.source,create),{kind:'context.create',intent:'create',location:h.context,name:'persistent project'});assert.equal(c.status,'committed');
 const read=h.op('context.read',`context:${c.id}`,c.id),priorScope=h.grant(read),oldRequest=h.host.local.bind(h.source,read);assert.equal((await h.host.space.query(oldRequest,{kind:'context',id:c.id})).status,'ok');
 assert.equal((await h.host.stop()).status,'stopped');const nextSource={},nextIdentity={...h.identity,relationshipGeneration:2};h.sources.set(nextSource,nextIdentity);
 const next=await startFoundations(h.options);h.hosts.push(next);assert.equal(next.status,'ready');assert.notEqual(next.permissions.evaluate(oldRequest).status,'allow');
 const request=next.local.bind(nextSource,read);assert.ok(request);assert.equal((await next.space.query(request,{kind:'context',id:c.id})).status,'rejected');
 const history=next.permissions.history({});assert.equal(history.status,'ok');assert.equal(next.permissions.grant({intent:'new-window-read',expectedRevision:history.revision,scope:{...priorScope,relationshipGeneration:2}}).status,'committed');
 const recovered=await next.space.query(request,{kind:'context',id:c.id});assert.equal(recovered.status,'ok');assert.equal(recovered.value.id,c.id);assert.equal(recovered.value.name,'persistent project');
});
