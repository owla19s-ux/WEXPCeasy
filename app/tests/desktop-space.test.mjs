import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {startFoundations} from '../../dist/app/src/index.js';
import {createDesktopAuthority} from '../../dist/app/src/desktop-authority.js';
import {createDesktopSpace} from '../../dist/app/src/desktop-space.js';
// Native confirmation and directory chooser are platform fixtures; all domain services and SQLite are real.
async function fixture(t){
 const base=await mkdtemp(join(tmpdir(),'wex-desktop-space-')),root=join(base,'public'),context=join(base,'context');
 for(const [path,id] of [[root,'public-root'],[context,'context-root']]){await mkdir(path);await writeFile(join(path,'.wex-root.json'),JSON.stringify({format:1,id}));}
 let allow=true,confirmations=0,pause;
 const authority=createDesktopAuthority();
 const access=createDesktopSpace({authority,rootId:'public-root',confirm:async summary=>{confirmations++;if(pause&&summary.startsWith('保存本地文件：'))await pause();return allow;},chooseDirectory:async()=>context});
 const host=await startFoundations({dataRoot:root,...access.policy,space:{deriveRequest:access.derive},localFiles:{coordinateWrites:true},localDirectories:{}});
 access.attach(host);t.after(async()=>{access.close();await host.stop();await rm(base,{recursive:true,force:true});});
 return {access,host,root,context,authority,setAllow:value=>allow=value,pauseSave:value=>pause=value,count:()=>confirmations};
}
test('desktop Space rejects unlisted capabilities and authority/path injection before native prompts',async t=>{
 const f=await fixture(t);
 for(const input of [{kind:'__proto__'},{kind:'constructor'},null,{kind:'context.destroy',id:'x'},{kind:'space.create',name:'x',authorized:true},{kind:'context.create',name:'x',location:'/tmp/injected'},{kind:'snapshot',scope:{}}]){
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

test('Context resources read only through Local bindings and never follow injected payload paths',async t=>{
 const f=await fixture(t),file=join(f.context,'selected.txt');await writeFile(file,'selected content');
 const context=await f.access.request({kind:'context.create',name:'File preview'});
 const address=await f.access.request({kind:'address.add',contextId:context.id,name:'Selected file',address:pathToFileURL(file).href,purpose:['reference']});
 assert.equal(address.status,'committed');
 const value=await f.access.request({kind:'resource.read',contextId:context.id,id:address.id,mode:'file'});
 if(process.platform==='linux'){assert.equal(value.status,'ok');assert.equal(value.content,'selected content');assert.match(value.version,/^[a-f0-9]{64}$/);}
 else assert.ok(['ok','unavailable'].includes(value.status));
 assert.equal((await f.access.request({kind:'resource.read',contextId:context.id,id:address.id,mode:'file',path:'/private'})).status,'rejected');
 assert.equal((await f.access.request({kind:'resource.read',contextId:context.id,id:'missing',mode:'file'})).status,'rejected');
 assert.equal((await f.access.request({kind:'address.remove',contextId:context.id,id:address.id,expectedRevision:1})).status,'committed');
 assert.equal((await f.access.request({kind:'resource.read',contextId:context.id,id:address.id,mode:'file'})).status,'rejected');
});

test('categories and multi-address primary references survive a fresh SQLite host',async t=>{
 const f=await fixture(t);
 const category=await f.access.request({kind:'category.create',name:'Persistent category'});
 const space=await f.access.request({kind:'space.create',name:'Saved space',categoryId:category.id});
 const context=await f.access.request({kind:'context.create',name:'Saved context'});
 const address=await f.access.request({kind:'address.add',contextId:context.id,name:'Remote',address:'https://github.com/example/repo',notes:'original',purpose:['reference','operation']});
 await f.access.request({kind:'primary.select',contextId:context.id,id:address.id,expectedRevision:1});
 f.access.close();assert.equal((await f.host.stop()).status,'stopped');
 const access=createDesktopSpace({rootId:'public-root',confirm:async()=>true,chooseDirectory:async()=>undefined});
 const host=await startFoundations({dataRoot:f.root,...access.policy,space:{deriveRequest:access.derive}});access.attach(host);
 try{
  const snapshot=await access.request({kind:'snapshot'});assert.equal(snapshot.categories[0].id,category.id);assert.equal(snapshot.spaces[0].id,space.id);assert.equal(snapshot.spaces[0].categoryId,category.id);
  const detail=await access.request({kind:'context.open',id:context.id});assert.equal(detail.context.primaryAddress,address.id);assert.deepEqual(detail.resources[0].purpose,['reference','operation']);assert.equal(detail.resources[0].notes,'original');
 }finally{access.close();await host.stop();}
});

test('desktop Local save binds the observed file version, persists one Operation and rejects stale or redirected intent',async t=>{
 const f=await fixture(t),path=join(f.context,'editable.txt');await writeFile(path,'original');
 const context=await f.access.request({kind:'context.create',name:'Editor'});
 const address=await f.access.request({kind:'address.add',contextId:context.id,name:'Editable',address:pathToFileURL(path).href,purpose:['operation']});
 const read=()=>f.access.request({kind:'resource.read',contextId:context.id,id:address.id,mode:'file'});
 const observed=await read();assert.equal(observed.status,'ok');assert.equal(typeof observed.editToken,'string');
 const input={kind:'resource.save',contextId:context.id,id:address.id,editToken:observed.editToken,content:'edited'};
 assert.equal((await f.access.request({...input,path:'/injected'})).status,'rejected');
 f.setAllow(false);assert.equal((await f.access.request(input)).status,'cancelled');assert.equal(await readFile(path,'utf8'),'original');f.setAllow(true);
 let saved=await f.access.request(input);assert.equal(saved.status,'saved');assert.equal(await readFile(path,'utf8'),'edited');
 assert.equal(f.host.connections.operations.get(saved.operationId).phase,'observed');
 assert.equal((await f.access.request(input)).status,'rejected');
 const admitted=await read();let enter,release;const entered=new Promise(r=>enter=r);
 f.pauseSave(()=>{enter();return new Promise(r=>release=r);});
 const pending=f.access.request({...input,editToken:admitted.editToken,content:'revoked write'});await entered;
 const grants=await f.authority.settings({kind:'snapshot'},async()=>true);
 const grant=grants.entries.find(e=>e.resource==='local'&&e.action==='write');assert.ok(grant);
 assert.equal((await f.authority.settings({kind:'revoke',id:grant.id,expectedRevision:grants.revision},async()=>true)).status,'committed');
 release();assert.notEqual((await pending).status,'saved');f.pauseSave(undefined);
 assert.equal(await readFile(path,'utf8'),'edited');
 const next=await read();await writeFile(path,'external edit');
 saved=await f.access.request({...input,editToken:next.editToken,content:'must not overwrite'});assert.equal(saved.status,'rejected');assert.equal(saved.reason,'version_conflict');assert.equal(await readFile(path,'utf8'),'external edit');
 const latest=await read();
 assert.equal((await f.access.request({kind:'address.edit',contextId:context.id,id:address.id,expectedRevision:1,name:'Retargeted',address:pathToFileURL(join(f.context,'other.txt')).href,purpose:['operation']})).status,'committed');
 saved=await f.access.request({...input,editToken:latest.editToken,content:'wrong target'});assert.equal(saved.status,'rejected');assert.equal(await readFile(path,'utf8'),'external edit');
});

test('saved Local content and Operation survive a fresh host while old window observation tokens expire',async t=>{
 const f=await fixture(t),path=join(f.context,'restart.txt');await writeFile(path,'before restart');
 const context=await f.access.request({kind:'context.create',name:'Restart editor'});
 const address=await f.access.request({kind:'address.add',contextId:context.id,name:'File',address:pathToFileURL(path).href,purpose:['operation']});
 const read=await f.access.request({kind:'resource.read',contextId:context.id,id:address.id,mode:'file'});
 const saved=await f.access.request({kind:'resource.save',contextId:context.id,id:address.id,editToken:read.editToken,content:'saved before restart'});assert.equal(saved.status,'saved');
 f.access.close();assert.equal((await f.host.stop()).status,'stopped');
 const access=createDesktopSpace({rootId:'public-root',confirm:async()=>true,chooseDirectory:async()=>undefined});
 const host=await startFoundations({dataRoot:f.root,...access.policy,space:{deriveRequest:access.derive},localFiles:{coordinateWrites:true}});access.attach(host);
 try{
  assert.equal(host.connections.operations.get(saved.operationId).phase,'observed');
  assert.equal((await access.request({kind:'resource.save',contextId:context.id,id:address.id,editToken:read.editToken,content:'old window'})).status,'rejected');
  const observed=await access.request({kind:'resource.read',contextId:context.id,id:address.id,mode:'file'});assert.equal(observed.content,'saved before restart');
  assert.equal((await access.request({kind:'resource.save',contextId:context.id,id:address.id,editToken:observed.editToken,content:'saved after restart'})).status,'saved');
  assert.equal(await readFile(path,'utf8'),'saved after restart');
 }finally{access.close();await host.stop();}
});
