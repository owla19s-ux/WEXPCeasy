import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startFoundations} from '../../dist/app/src/index.js';
import {openSqliteStore} from '../../dist/shared/src/index.js';
const owners=[
 {id:'ai',namespace:'ai-configurations',file:'ai-configurations.sqlite',options:{ai:{bindRead:()=>undefined}},bad:{version:99,entries:[],receipts:[],apiKey:'must-not-log'}},
 {id:'conversations',namespace:'conversations',file:'conversations.sqlite',options:{conversations:true},bad:{format:99,conversations:[],receipts:{},apiKey:'must-not-log'}},
];
for(const owner of owners){
 for(const [label,value] of [['future format',owner.bad],['persisted null',null]]){
  test(owner.id+' storage '+label+' degrades the optional module before exposing a client',async t=>{
   const root=await mkdtemp(join(tmpdir(),'wex-storage-ready-')),hosts=[];
   await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
   const db=openSqliteStore(join(root,owner.file),owner.namespace);
   db.commit({intent:'damage',expectedRevision:0,value});const before=db.read();db.close();
   t.after(async()=>{for(const h of hosts)await h.stop();await rm(root,{recursive:true,force:true});});
   const h=await startFoundations({dataRoot:root,trust:{current:()=>undefined,canManage:()=>false,canReadHistory:()=>false},...owner.options});hosts.push(h);
   assert.equal(h.status,'degraded');assert.equal(h[owner.id],undefined);assert.ok(h.permissions);
   assert.ok(h.diagnostics.some(d=>d.module===owner.id&&d.reason==='initialization_failed'));
   assert.equal(JSON.stringify(h.diagnostics).includes('must-not-log'),false);
   assert.equal((await h.stop()).status,'stopped');
   const check=openSqliteStore(join(root,owner.file),owner.namespace);
   try{assert.deepEqual(check.read(),before);}finally{check.close();}
  });
 }
 test(owner.id+' failed storage inspection retains uncertain partial resources until stop retry',async t=>{
  const root=await mkdtemp(join(tmpdir(),'wex-storage-close-')),hosts=[];let fail=true,attempts=0;
  await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
  const db=openSqliteStore(join(root,owner.file),owner.namespace);db.commit({intent:'damage',expectedRevision:0,value:owner.bad});db.close();
  const trust={current:()=>undefined,canManage:()=>false,canReadHistory:()=>false};
  t.after(async()=>{fail=false;for(const h of hosts)await h.stop();await rm(root,{recursive:true,force:true});});
  const h=await startFoundations({dataRoot:root,trust,...owner.options,openStore(path,ns){
   const store=openSqliteStore(path,ns);
   return ns!==owner.namespace?store:{...store,close(){attempts++;if(fail)throw Error('close uncertain');store.close();}};
  }});hosts.push(h);
  assert.equal(h.status,'degraded');assert.equal(h[owner.id],undefined);assert.ok(attempts>=1);
  assert.equal((await h.stop()).status,'incomplete');
  const rival=await startFoundations({dataRoot:root,trust});hosts.push(rival);assert.equal(rival.status,'failed');
  fail=false;assert.equal((await h.stop()).status,'stopped');
  const reopened=await startFoundations({dataRoot:root,trust});hosts.push(reopened);assert.equal(reopened.status,'ready');
 });
}
