import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,open,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
import {createConnectionService,createReadBoundary} from '../../../dist/connections/src/index.js';
const local=await import('../../../dist/connections/local/src/index.js').catch(()=>({}));
const config={id:'files',adapter:'local',endpoint:'local:files',credentialRef:null,enabled:true};
async function fixture(t){
 assert.equal(typeof local.createLocalFileAdapter,'function');
 const dir=await mkdtemp(join(tmpdir(),'wex-local-')),file=join(dir,'selected.txt');
 await writeFile(file,'original');let allowed=true,exclusive=true,loseRelease=false;
 const target=local.localFileTarget('selected'),resolutions=[];
 const resolve=async(actual,mode)=>{
  assert.equal(actual,target);resolutions.push(mode);
  const handle=await open(file,mode==='write'?'r+':'r');
  return {handle,exclusive,check:()=>allowed,async release(){await handle.close();if(loseRelease)throw Error('release acknowledgement lost');}};
 };
 const scope={subject:'user',entry:'conversation',conversation:'chat',context:null,resource:'local',action:'write',target,relationship:'direct',relationshipGeneration:1};
 const permission={evaluate(){return {status:'allow',revision:1,generation:1,scope};},recheck(request){return this.evaluate(request);}};
 const configs=openSqliteStore(join(dir,'state.sqlite'),'configs'),operations=openSqliteStore(join(dir,'state.sqlite'),'operations');
 const adapter=local.createLocalFileAdapter(resolve),service=createConnectionService(permission,configs,operations,[adapter]);
 service.configs.put(config,0,'create');
 const observe=async()=>local.createLocalFileReader(resolve).read(target,new AbortController().signal);
 const put=(id,expectedVersion,content)=>service.dispatch('local',{},id,'files',1,target,id,{kind:'replace',expectedVersion,content});
 t.after(async()=>{await service.stop();configs.close();operations.close();await rm(dir,{recursive:true,force:true});});
 return {dir,file,target,observe,put,service,resolutions,deny(){allowed=false;},shared(){exclusive=false;},loseRelease(){loseRelease=true;}};
}
test('Local real-file replacement uses expected version and durable Operation prevents a duplicate write',async t=>{
 const h=await fixture(t),before=await h.observe();
 assert.equal(before.content,'original');assert.match(before.version,/^[a-f0-9]{64}$/);
 assert.equal((await h.put('write',before.version,'replacement')).status,'observed');
 assert.equal(await readFile(h.file,'utf8'),'replacement');
 const after=await h.observe();assert.notEqual(after.version,before.version);
 assert.equal((await h.put('write',before.version,'replacement')).status,'blocked');
 assert.equal(h.resolutions.filter(x=>x==='write').length,1);
 const recovered=openSqliteStore(join(h.dir,'state.sqlite'),'operations');
 assert.equal(recovered.read().value.operations[0].phase,'observed');recovered.close();
});
test('Local stale content version reports conflict without overwriting an external edit',async t=>{
 const h=await fixture(t),before=await h.observe();await writeFile(h.file,'external');
 assert.equal((await h.put('stale',before.version,'must-not-write')).status,'observed');
 assert.equal(await readFile(h.file,'utf8'),'external');
 assert.equal(JSON.stringify(h.service.operations.get('stale')).includes('version_conflict'),true);
});
test('Local missing exclusive lease or revoked capability refuses actual writes',async t=>{
 for(const deny of ['deny','shared']){
  const h=await fixture(t),before=await h.observe();h[deny]();
  assert.equal((await h.put(deny,before.version,'must-not-write')).status,'observed');
  assert.equal(await readFile(h.file,'utf8'),'original');
 }
});
test('Local adapter never resolves arbitrary path targets',async t=>{
 const h=await fixture(t),reader=local.createLocalFileReader(async()=>{throw Error('must not resolve');});
 await assert.rejects(()=>reader.read('../../private',new AbortController().signal),/target/);
 assert.throws(()=>local.localFileTarget('../private'));
});

test('Local write followed by uncertain release retains unknown Operation and cannot be blindly rewritten',async t=>{
 const h=await fixture(t),before=await h.observe();h.loseRelease();
 assert.equal((await h.put('lost-release',before.version,'written once')).status,'unknown');
 assert.equal(await readFile(h.file,'utf8'),'written once');
 assert.equal(h.service.operations.get('lost-release').phase,'unknown');
 assert.equal((await h.put('lost-release',before.version,'written once')).status,'blocked');
 assert.equal(h.resolutions.filter(x=>x==='write').length,1);
 const recovered=openSqliteStore(join(h.dir,'state.sqlite'),'operations');
 assert.equal(recovered.read().value.operations[0].phase,'unknown');recovered.close();
});
