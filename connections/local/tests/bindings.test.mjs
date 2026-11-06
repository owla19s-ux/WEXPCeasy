import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
import {createPermissions} from '../../../dist/permissions/src/index.js';
import {createReadBoundary,createConnectionService} from '../../../dist/connections/src/index.js';
import * as local from '../../../dist/connections/local/src/index.js';
async function fixture(t,options={}){
 assert.equal(typeof local.createLocalFileBindings,'function');
 const dir=await mkdtemp(join(tmpdir(),'wex-bound-file-')),file=join(dir,'file.txt');await writeFile(file,'original');
 const pstore=openSqliteStore(join(dir,'state.sqlite'),'permissions'),cs=openSqliteStore(join(dir,'state.sqlite'),'configs'),os=openSqliteStore(join(dir,'state.sqlite'),'operations');
 const facts=new WeakMap(),permission=createPermissions(pstore,{current:r=>facts.get(r),canManage:()=>true,canReadHistory:()=>false});
 const target=local.localFileTarget('selected');
 let n=0,releaseCount=0;
 function request(action,resourceTarget=target){
  const r={},scope={subject:'user',entry:'conversation',conversation:'chat',context:null,resource:'local',action,target:resourceTarget,relationship:'direct',relationshipGeneration:1};
  facts.set(r,{...scope,kind:'conversation',moduleEnabled:true,globalEnabled:true,conversationEnabled:true,sourceAllowed:true});
  assert.equal(permission.grant({intent:'grant-'+(++n),expectedRevision:pstore.read().revision,scope}).status,'committed');return r;
 }
 const read=request('read'),write=request('write');
 const bindings=local.createLocalFileBindings(permission,{async acquireWrite(identity){
  assert.ok(identity.inode);options.beforeLease?.();
  return {status:'acquired',async release(){releaseCount++;}};
 }});
 const reader=createReadBoundary(permission,local.createLocalFileReader(bindings.resolve));
 const service=createConnectionService(permission,cs,os,[local.createLocalFileAdapter(bindings.resolve)]);
 service.configs.put({id:'files',adapter:'local',endpoint:'local:files',credentialRef:null,enabled:true},0,'create');
 t.after(async()=>{await service.stop();await bindings.close();pstore.close();cs.close();os.close();await rm(dir,{recursive:true,force:true});});
 return {dir,file,target,read,write,bindings,reader,service,request,
  deny(r){facts.set(r,{...facts.get(r),sourceAllowed:false});},
  releaseCount:()=>releaseCount,
  put:(version,content='changed',id='op')=>service.dispatch('local',write,id,'files',1,target,id,{kind:'replace',expectedVersion:version,content})};
}
test('trusted Local binding uses real Permissions, selected file identity and the existing Operation boundary',async t=>{
 const h=await fixture(t);
 assert.deepEqual(await h.bindings.register(h.read,h.target,h.file),{status:'bound'});
 const observed=await h.reader.read(h.read,h.target);assert.equal(observed.status,'ok');assert.equal(observed.value.content,'original');
 assert.equal((await h.put(observed.value.version)).status,'observed');
 assert.equal(await readFile(h.file,'utf8'),'changed');assert.equal(h.releaseCount(),1);
 const after=await h.reader.read(h.read,h.target);assert.equal(after.status,'ok');assert.equal(after.value.content,'changed');
});
test('unauthorized registration cannot probe path existence or bind a target',async t=>{
 const h=await fixture(t);
 const a=await h.bindings.register({},h.target,h.file),b=await h.bindings.register({},h.target,join(h.dir,'missing'));
 assert.deepEqual(a,b);assert.equal(a.status,'denied');
 assert.equal((await h.reader.read(h.read,h.target)).status,'unavailable');
});
test('replaced selected file is refused instead of following the old locator to a new identity',async t=>{
 const h=await fixture(t);await h.bindings.register(h.read,h.target,h.file);
 await rename(h.file,h.file+'.original');await writeFile(h.file,'private replacement');
 const result=await h.reader.read(h.read,h.target);assert.equal(result.status,'unavailable');assert.equal('value'in result,false);
 assert.deepEqual(await h.bindings.register(h.read,h.target,h.file),{status:'conflict'});
 assert.equal(await readFile(h.file,'utf8'),'private replacement');
});
test('permission revoked during file lease acquisition prevents writing and releases the acquired lease',async t=>{
 let revoke=()=>{};const h=await fixture(t,{beforeLease(){revoke();}});
 await h.bindings.register(h.read,h.target,h.file);const observed=await h.reader.read(h.read,h.target);
 revoke=()=>h.deny(h.write);
 await h.put(observed.value.version);
 assert.equal(await readFile(h.file,'utf8'),'original');assert.equal(h.releaseCount(),1);
});
test('closing Local bindings invalidates registered access without granting a replacement request',async t=>{
 const h=await fixture(t);await h.bindings.register(h.read,h.target,h.file);await h.bindings.close();
 assert.equal((await h.reader.read(h.read,h.target)).status,'unavailable');
 assert.deepEqual(await h.bindings.register(h.read,h.target,h.file),{status:'unavailable'});
});
