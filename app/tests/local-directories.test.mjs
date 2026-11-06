import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startFoundations} from '../../dist/app/src/index.js';
import {localDirectoryTarget} from '../../dist/connections/local/src/index.js';
async function fixture(t,custom=false){
 const dir=await mkdtemp(join(tmpdir(),'wex-app-directory-')),root=join(dir,'data'),selected=join(dir,'selected'),source={};
 await mkdir(root);await mkdir(selected);await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 await writeFile(join(selected,'a.txt'),'not returned');await mkdir(join(selected,'child'));
 const identity={subject:'user',entry:'window',relationship:'window-session',relationshipGeneration:1,moduleEnabled:true,globalEnabled:true,sourceAllowed:true,entryEnabled:true};
 let fail=false,seq=0;const hosts=[],target=localDirectoryTarget('selected');
 const scanner={async open(){return {async read(){return null;},async close(){if(fail)throw Error('cursor release uncertain');}};}};
 const options={dataRoot:root,trust:{current:()=>undefined,canManage:()=>true,canReadHistory:()=>true},local:{current:sender=>sender===source?identity:undefined},localDirectories:custom?{scanner}:{}};
 const start=async(extra={})=>{const h=await startFoundations({...options,...extra});hosts.push(h);return h;};
 t.after(async()=>{fail=false;for(const h of hosts)await h.stop();await rm(dir,{recursive:true,force:true});});
 const request=h=>h.local.bind(source,{resource:'local',action:'read',target,context:null});
 const setup=async h=>{
  assert.equal(h.status,'ready');assert.ok(h.localDirectories,'directory client must be assembled');
  const history=h.permissions.history({});
  assert.equal(h.permissions.grant({intent:'grant-'+(++seq),expectedRevision:history.revision,scope:{subject:identity.subject,entry:identity.entry,relationship:identity.relationship,relationshipGeneration:1,conversation:null,resource:'local',action:'read',target,context:null}}).status,'committed');
  assert.deepEqual(await h.localDirectories.register(request(h),target,selected),{status:'bound'});
 };
 return {root,selected,source,target,start,setup,request,setFailure(v){fail=v;}};
}
test('App assembles authorized directory browsing and requires explicit selection again after restart',async t=>{
 const f=await fixture(t),h=await f.start();await f.setup(h);
 const result=await h.localDirectories.read(f.request(h),f.target);assert.equal(result.status,'ok');
 assert.deepEqual(result.value.entries,[{name:'a.txt',kind:'file'},{name:'child',kind:'directory'}]);
 assert.equal(JSON.stringify(result).includes('not returned'),false);
 assert.equal((await h.stop()).status,'stopped');const reopened=await f.start();
 assert.equal((await reopened.localDirectories.read(f.request(reopened),f.target)).status,'unavailable');
 assert.deepEqual(await reopened.localDirectories.register(f.request(reopened),f.target,f.selected),{status:'bound'});
 assert.equal((await reopened.localDirectories.read(f.request(reopened),f.target)).status,'ok');
});
test('actual local source closure denies directory listing and registration',async t=>{
 const f=await fixture(t),h=await f.start();await f.setup(h);const request=f.request(h);h.local.close(f.source);
 assert.equal((await h.localDirectories.read(request,f.target)).status,'denied');
 assert.deepEqual(await h.localDirectories.register(request,f.target,f.selected),{status:'denied'});
});
test('uncertain directory cursor cleanup keeps App root locked until stop retry confirms release',async t=>{
 const f=await fixture(t,true),h=await f.start();await f.setup(h);f.setFailure(true);
 assert.equal((await h.localDirectories.read(f.request(h),f.target)).status,'unavailable');
 assert.equal((await h.stop()).status,'incomplete');assert.equal((await f.start()).status,'failed');
 f.setFailure(false);assert.equal((await h.stop()).status,'stopped');assert.equal((await f.start()).status,'ready');
});
test('invalid directory limits degrade only optional connections and expose no partial directory client',async t=>{
 const f=await fixture(t),h=await f.start({localDirectories:{maxEntries:0}});
 assert.equal(h.status,'degraded');assert.equal(h.localDirectories,undefined);assert.ok(h.permissions);
 assert.equal((await h.stop()).status,'stopped');assert.equal((await f.start()).status,'ready');
});
