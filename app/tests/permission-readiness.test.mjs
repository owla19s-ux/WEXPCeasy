import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startFoundations} from '../../dist/app/src/index.js';
import {openSqliteStore} from '../../dist/shared/src/index.js';
const trust={current:()=>undefined,canManage:()=>false,canReadHistory:()=>false};
for(const [label,value] of [
 ['persisted null',null],
 ['future format',{format:99,generation:0,events:[]}],
 ['inconsistent history',{format:1,generation:1,events:[]}],
]){
 test('required permission storage '+label+' fails startup without exposing dependent clients or rewriting data',async t=>{
  const root=await mkdtemp(join(tmpdir(),'wex-required-permissions-')),hosts=[];
  await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
  const file=join(root,'permissions.sqlite'),db=openSqliteStore(file,'permissions');
  db.commit({intent:'damage',expectedRevision:0,value});const before=db.read();db.close();
  t.after(async()=>{for(const h of hosts)await h.stop();await rm(root,{recursive:true,force:true});});
  const options={dataRoot:root,trust,ai:{bindRead:()=>undefined},conversations:true,connections:{adapters:[]}};
  const h=await startFoundations(options);hosts.push(h);
  assert.equal(h.status,'failed');assert.equal(h.permissions,undefined);assert.equal(h.ai,undefined);
  assert.equal(h.conversations,undefined);assert.equal(h.connections,undefined);
  assert.ok(h.diagnostics.some(d=>d.module==='permissions'&&d.reason==='initialization_failed'));
  assert.equal((await h.stop()).status,'stopped');
  const check=openSqliteStore(file,'permissions');try{assert.deepEqual(check.read(),before);}finally{check.close();}
  const retry=await startFoundations({...options,openStore(){throw Error('storage unavailable');}});hosts.push(retry);
  assert.ok(retry.diagnostics.some(d=>d.module==='shared'&&d.reason==='initialization_failed'),'failed startup must release the root so a new attempt can reach storage');
 });
}
test('failed required permission inspection retains root ownership when storage close remains uncertain',async t=>{
 const root=await mkdtemp(join(tmpdir(),'wex-required-permission-close-')),hosts=[];let fail=true,attempts=0;
 await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 const file=join(root,'permissions.sqlite'),db=openSqliteStore(file,'permissions');db.commit({intent:'damage',expectedRevision:0,value:null});db.close();
 t.after(async()=>{fail=false;for(const h of hosts)await h.stop();await rm(root,{recursive:true,force:true});});
 const h=await startFoundations({dataRoot:root,trust,openStore(path,ns){
  const store=openSqliteStore(path,ns);return {...store,close(){attempts++;if(fail)throw Error('uncertain close');store.close();}};
 }});hosts.push(h);
 assert.equal(h.status,'failed');assert.equal(h.permissions,undefined);assert.ok(attempts>=1);
 assert.equal((await h.stop()).status,'incomplete');
 const rival=await startFoundations({dataRoot:root,trust});hosts.push(rival);
 assert.equal(rival.status,'failed');assert.equal(rival.diagnostics[0].module,'shared');
 fail=false;assert.equal((await h.stop()).status,'stopped');
 const retry=await startFoundations({dataRoot:root,trust});hosts.push(retry);
 assert.ok(retry.diagnostics.some(d=>d.module==='permissions'&&d.reason==='initialization_failed'));
});
