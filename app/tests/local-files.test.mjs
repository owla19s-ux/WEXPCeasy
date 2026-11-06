import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startFoundations} from '../../dist/app/src/index.js';
import {localFileTarget} from '../../dist/connections/local/src/index.js';
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'wex-app-files-')),root=join(dir,'data'),file=join(dir,'selected.txt'),source={};
 await mkdir(root);await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));await writeFile(file,'original');
 const identity={subject:'user',entry:'window',relationship:'window-session',relationshipGeneration:1,moduleEnabled:true,globalEnabled:true,sourceAllowed:true,entryEnabled:true};
 let failRelease=false,seq=0;const hosts=[],target=localFileTarget('selected');
 const options={dataRoot:root,trust:{current:()=>undefined,canManage:()=>true,canReadHistory:()=>true},
  local:{current:sender=>sender===source?identity:undefined},
  localFiles:{async acquireWrite(){return {status:'acquired',async release(){if(failRelease)throw Error('release uncertain');}};}}};
 const start=async()=>{const h=await startFoundations(options);hosts.push(h);return h;};
 t.after(async()=>{failRelease=false;for(const h of hosts)await h.stop();await rm(dir,{recursive:true,force:true});});
 const op=action=>({resource:'local',action,target,context:null});
 const request=(h,action)=>h.local.bind(source,op(action));
 function grant(h,action){
  const history=h.permissions.history({});assert.equal(history.status,'ok');
  const scope={subject:identity.subject,entry:identity.entry,relationship:identity.relationship,relationshipGeneration:1,conversation:null,...op(action)};
  assert.equal(h.permissions.grant({intent:'grant-'+(++seq),expectedRevision:history.revision,scope}).status,'committed');
 }
 const setup=async h=>{
  assert.equal(h.status,'ready');assert.ok(h.localFiles,'selected-file host client must be present');assert.ok(h.connections);
  grant(h,'read');grant(h,'write');
  assert.equal(h.connections.configs.put({id:'files',adapter:'local',endpoint:'local:files',credentialRef:null,enabled:true},0,'config').status,'ok');
  assert.deepEqual(await h.localFiles.register(request(h,'read'),target,file),{status:'bound'});
 };
 const read=h=>h.localFiles.read(request(h,'read'),target);
 const put=(h,version)=>h.connections.dispatch('local',request(h,'write'),'operation','files',1,target,'write',{kind:'replace',expectedVersion:version,content:'changed'});
 return {file,target,identity,start,setup,request,read,put,failRelease(value){failRelease=value;}};
}
test('app assembles selected Local file access and restores durable receipt without restoring a path grant',async t=>{
 const f=await fixture(t),first=await f.start();await f.setup(first);
 const before=await f.read(first);assert.equal(before.status,'ok');assert.equal((await f.put(first,before.value.version)).status,'observed');
 assert.equal(await readFile(f.file,'utf8'),'changed');assert.equal((await first.stop()).status,'stopped');
 const reopened=await f.start();assert.equal(reopened.status,'ready');assert.ok(reopened.localFiles);
 assert.equal((await f.read(reopened)).status,'unavailable','restart must not implicitly attach external paths');
 assert.deepEqual(await reopened.localFiles.register(f.request(reopened,'read'),f.target,f.file),{status:'bound'});
 assert.equal((await f.read(reopened)).value.content,'changed');
 assert.equal((await f.put(reopened,before.value.version)).reason,'already_recorded_no_automatic_retry');
 assert.equal(reopened.connections.operations.get('operation').phase,'observed');
});
test('actual local source closure denies selected-file reads and registration',async t=>{
 const f=await fixture(t),h=await f.start();await f.setup(h);
 const request=f.request(h,'read');h.local.close({});assert.equal((await h.localFiles.read(request,f.target)).status,'ok');
 f.identity.entryEnabled=false;
 assert.equal((await h.localFiles.read(request,f.target)).status,'denied');
 assert.deepEqual(await h.localFiles.register(request,f.target,f.file),{status:'denied'});
 assert.equal(await readFile(f.file,'utf8'),'original');
});
test('uncertain Local resource release keeps host data root locked until stop retry confirms release',async t=>{
 const f=await fixture(t),h=await f.start();await f.setup(h);const before=await f.read(h);f.failRelease(true);
 assert.equal((await f.put(h,before.value.version)).status,'unknown');assert.equal(await readFile(f.file,'utf8'),'changed');
 assert.equal((await h.stop()).status,'incomplete');
 assert.equal((await f.start()).status,'failed');
 f.failRelease(false);assert.equal((await h.stop()).status,'stopped');assert.equal((await f.start()).status,'ready');
});
