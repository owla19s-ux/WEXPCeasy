import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
import {createPermissions} from '../../../dist/permissions/src/index.js';
import {createReadBoundary} from '../../../dist/connections/src/index.js';
import * as local from '../../../dist/connections/local/src/index.js';
async function fixture(t,options={}){
 assert.equal(typeof local.createLocalDirectoryBindings,'function');
 const root=await mkdtemp(join(tmpdir(),'wex-directory-')),dir=join(root,'selected');
 await mkdir(dir);await writeFile(join(dir,'a.txt'),'private content');await mkdir(join(dir,'child'));
 const outside=join(root,'outside');await mkdir(outside);await writeFile(join(outside,'secret.txt'),'outside');
 await symlink(outside,join(dir,'link'),'dir');
 const db=openSqliteStore(join(root,'permissions.sqlite'),'permissions'),request={};
 let allowed=true;
 const target=local.localDirectoryTarget('selected'),scope={subject:'user',entry:'conversation',conversation:'chat',context:null,resource:'local',action:'read',target,relationship:'direct',relationshipGeneration:1};
 const permission=createPermissions(db,{current:r=>r===request?{...scope,kind:'conversation',moduleEnabled:true,globalEnabled:true,conversationEnabled:true,sourceAllowed:allowed}:undefined,canManage:()=>true,canReadHistory:()=>false});
 permission.grant({intent:'grant',expectedRevision:0,scope});
 const bindings=local.createLocalDirectoryBindings(permission);
 const reader=createReadBoundary(permission,local.createLocalDirectoryReader(bindings.resolve,options));
 t.after(async()=>{await bindings.close();db.close();await rm(root,{recursive:true,force:true});});
 return {root,dir,request,target,bindings,reader,revoke(){allowed=false;}};
}
test('authorized directory listing reports only shallow names and kinds with real filesystem identity',async t=>{
 const h=await fixture(t);assert.deepEqual(await h.bindings.register(h.request,h.target,h.dir),{status:'bound'});
 const result=await h.reader.read(h.request,h.target);assert.equal(result.status,'ok');
 assert.deepEqual(result.value.entries,[{name:'a.txt',kind:'file'},{name:'child',kind:'directory'},{name:'link',kind:'symlink'}]);
 assert.equal(result.value.complete,true);assert.match(result.value.version,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(result).includes('private content'),false);assert.equal(JSON.stringify(result).includes('secret.txt'),false);
});
test('directory enumeration is bounded and explicitly reports an incomplete observation',async t=>{
 const h=await fixture(t,{maxEntries:2});await h.bindings.register(h.request,h.target,h.dir);
 const result=await h.reader.read(h.request,h.target);assert.equal(result.status,'ok');
 assert.equal(result.value.entries.length,2);assert.equal(result.value.complete,false);assert.equal('total'in result.value,false);
});
test('directory binding denies path probes and refuses replacement identities',async t=>{
 const h=await fixture(t);
 assert.deepEqual(await h.bindings.register({},h.target,h.dir),await h.bindings.register({},h.target,join(h.root,'missing')));
 await h.bindings.register(h.request,h.target,h.dir);
 await rename(h.dir,h.dir+'-original');await mkdir(h.dir);await writeFile(join(h.dir,'new-private'),'secret');
 assert.equal((await h.reader.read(h.request,h.target)).status,'unavailable');
 assert.deepEqual(await h.bindings.register(h.request,h.target,h.dir),{status:'conflict'});
});
test('revocation or unavailable scanner never returns an empty successful directory projection',async t=>{
 const h=await fixture(t,{scanner:{async open(){throw Error('platform unavailable');}}});
 await h.bindings.register(h.request,h.target,h.dir);
 assert.equal((await h.reader.read(h.request,h.target)).status,'unavailable');
 h.revoke();assert.equal((await h.reader.read(h.request,h.target)).status,'denied');
});
test('file targets cannot be reinterpreted as directory targets',async t=>{
 const h=await fixture(t);assert.throws(()=>local.localDirectoryTarget('../private'));
 assert.equal((await h.bindings.register(h.request,local.localFileTarget('selected'),h.dir)).status,'denied');
});
