import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startFoundations} from '../../dist/app/src/index.js';
import {createDesktopSpace} from '../../dist/app/src/desktop-space.js';
// Native confirmation and directory chooser are platform fixtures; all domain services and SQLite are real.
async function fixture(t){
 const base=await mkdtemp(join(tmpdir(),'wex-desktop-space-')),root=join(base,'public'),context=join(base,'context');
 for(const [path,id] of [[root,'public-root'],[context,'context-root']]){await mkdir(path);await writeFile(join(path,'.wex-root.json'),JSON.stringify({format:1,id}));}
 let allow=true,confirmations=0;
 const access=createDesktopSpace({rootId:'public-root',confirm:async()=>{confirmations++;return allow;},chooseDirectory:async()=>context});
 const host=await startFoundations({dataRoot:root,...access.policy,space:{deriveRequest:access.derive}});
 access.attach(host);t.after(async()=>{access.close();await host.stop();await rm(base,{recursive:true,force:true});});
 return {access,host,root,context,setAllow:value=>allow=value,count:()=>confirmations};
}
test('desktop Space rejects unlisted capabilities and authority/path injection before native prompts',async t=>{
 const f=await fixture(t);
 for(const input of [null,{kind:'context.destroy',id:'x'},{kind:'space.create',name:'x',authorized:true},{kind:'context.create',name:'x',location:'/tmp/injected'},{kind:'snapshot',scope:{}}]){
  assert.equal((await f.access.request(input)).status,'rejected');
 }
 assert.equal(f.count(),0);
});
test('native decline cannot grant or mutate and closed session cannot be reused',async t=>{
 const f=await fixture(t);f.setAllow(false);
 assert.equal((await f.access.request({kind:'space.create',name:'private'})).status,'cancelled');
 f.setAllow(true);const snap=await f.access.request({kind:'snapshot'});assert.equal(snap.status,'ok');assert.deepEqual(snap.spaces,[]);
 f.access.close();assert.equal((await f.access.request({kind:'snapshot'})).status,'unavailable');
});
test('desktop Space create/edit/group movement and restart use real owner interfaces',async t=>{
 const f=await fixture(t);
 const space=await f.access.request({kind:'space.create',name:'Workspace'});assert.equal(space.status,'committed');
 const group=await f.access.request({kind:'group.create',spaceId:space.id,name:'Group'});assert.equal(group.status,'committed');
 const context=await f.access.request({kind:'context.create',name:'Context',description:'before'});assert.equal(context.status,'committed');
 assert.equal((await f.access.request({kind:'context.edit',id:context.id,expectedRevision:1,name:'Renamed',description:'after'})).status,'committed');
 assert.equal((await f.access.request({kind:'context.group',contextId:context.id,spaceId:space.id,groupId:group.id,expectedRevision:0})).status,'committed');
 const detail=await f.access.request({kind:'context.open',id:context.id});assert.equal(detail.status,'ok');assert.equal(detail.context.id,context.id);assert.equal(detail.context.name,'Renamed');assert.equal(detail.organization.groupId,group.id);
 assert.equal((await f.access.request({kind:'context.group',contextId:context.id,spaceId:space.id,groupId:null,expectedRevision:1})).status,'committed');
 assert.equal((await f.access.request({kind:'space.directory',id:space.id,expectedRevision:1})).status,'committed');
 const snapshot=await f.access.request({kind:'snapshot'});assert.equal(snapshot.contexts.length,1);assert.equal(snapshot.spaces[0].directory,f.context);
 assert.equal((await f.access.request({kind:'context.edit',id:context.id,expectedRevision:1,name:'stale'})).status,'rejected');
});

test('desktop Space persists across a new host and a fresh permission session',async t=>{
 const f=await fixture(t),created=await f.access.request({kind:'space.create',name:'Persisted'});
 assert.equal(created.status,'committed');f.access.close();assert.equal((await f.host.stop()).status,'stopped');
 const next=createDesktopSpace({rootId:'public-root',confirm:async()=>true,chooseDirectory:async()=>undefined});
 const reopened=await startFoundations({dataRoot:f.root,...next.policy,space:{deriveRequest:next.derive}});next.attach(reopened);
 try{const snapshot=await next.request({kind:'snapshot'});assert.equal(snapshot.status,'ok');assert.equal(snapshot.spaces[0].id,created.id);assert.equal(snapshot.spaces[0].name,'Persisted');}
 finally{next.close();await reopened.stop();}
});

test('closing while native consent is pending prevents late writes',async t=>{
 const base=await mkdtemp(join(tmpdir(),'wex-space-consent-'));await writeFile(join(base,'.wex-root.json'),JSON.stringify({format:1,id:'public-root'}));
 let resolveConsent,entered;const entering=new Promise(r=>entered=r);
 const access=createDesktopSpace({rootId:'public-root',confirm:()=>{entered();return new Promise(r=>resolveConsent=r);},chooseDirectory:async()=>undefined});
 const host=await startFoundations({dataRoot:base,...access.policy,space:{deriveRequest:access.derive}});access.attach(host);
 try{const pending=access.request({kind:'space.create',name:'late'});await entering;access.close();resolveConsent(true);assert.equal((await pending).status,'unavailable');}
 finally{await host.stop();await rm(base,{recursive:true,force:true});}
});

test('desktop category navigation and Space reassignment preserve owner revisions',async t=>{
 const f=await fixture(t);
 const category=await f.access.request({kind:'category.create',name:'Projects'});assert.equal(category.status,'committed');
 const created=await f.access.request({kind:'space.create',name:'Workspace',categoryId:category.id});assert.equal(created.status,'committed');
 assert.equal((await f.access.request({kind:'category.edit',id:category.id,expectedRevision:1,name:'Renamed category'})).status,'committed');
 const snapshot=await f.access.request({kind:'snapshot'});assert.equal(snapshot.categories[0].name,'Renamed category');assert.equal(snapshot.spaces[0].categoryId,category.id);
 assert.equal((await f.access.request({kind:'category.edit',id:category.id,expectedRevision:1,name:'Stale'})).status,'rejected');
});
test('desktop address lifecycle keeps remote primary and separate local operation references',async t=>{
 const f=await fixture(t),created=await f.access.request({kind:'context.create',name:'Resources'});
 const remote=await f.access.request({kind:'address.add',contextId:created.id,name:'Main repository',address:'https://github.com/example/project',notes:'remote source',purpose:['reference','operation']});assert.equal(remote.status,'committed');
 const local=await f.access.request({kind:'address.add',contextId:created.id,name:'Outputs',address:'file:///selected/output',notes:'separate location',purpose:['output']});assert.equal(local.status,'committed');
 assert.equal((await f.access.request({kind:'primary.select',contextId:created.id,id:remote.id,expectedRevision:1})).status,'committed');
 let detail=await f.access.request({kind:'context.open',id:created.id});assert.equal(detail.context.primaryAddress,remote.id);assert.equal(detail.resources.length,2);assert.equal(detail.resources[0].status,'unverified');
 assert.equal((await f.access.request({kind:'address.edit',contextId:created.id,id:local.id,expectedRevision:1,name:'Artifacts',address:'file:///selected/output',notes:'updated',purpose:['output','reference']})).status,'committed');
 assert.equal((await f.access.request({kind:'address.edit',contextId:created.id,id:local.id,expectedRevision:1,name:'Stale',address:'x'})).status,'rejected');
 assert.equal((await f.access.request({kind:'address.remove',contextId:created.id,id:remote.id,expectedRevision:1})).status,'committed');
 detail=await f.access.request({kind:'context.open',id:created.id});assert.equal(detail.context.primaryAddress,null);assert.equal(detail.resources[0].name,'Artifacts');
});
