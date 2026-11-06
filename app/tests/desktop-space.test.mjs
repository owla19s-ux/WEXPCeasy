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
 return {access,host,context,setAllow:value=>allow=value,count:()=>confirmations};
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
