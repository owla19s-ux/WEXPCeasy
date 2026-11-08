import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {startFoundations} from '../../dist/app/src/index.js';

const trust={current:()=>undefined,canManage:()=>false,canReadHistory:()=>false};
const credentials={cipher:{available:()=>false,seal(){throw Error('cipher unavailable');},unseal(){throw Error('cipher unavailable');}}};
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'wex-credential-recovery-'));
 await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 t.after(()=>rm(root,{recursive:true,force:true}));
 return root;
}
function damage(root){
 const db=openSqliteStore(join(root,'wex-credentials.sqlite'),'credentials');
 db.commit({intent:'damage',expectedRevision:0,value:{format:99,domain:'credentials',entries:[],intents:[],receipts:[],legacyRevision:0,secret:'must-not-log'}});
 const snapshot=db.read();db.close();return snapshot;
}

test('corrupt credential store degrades optional credentials without exposing a facade or rewriting data',async t=>{
 const root=await fixture(t),before=damage(root);
 const host=await startFoundations({dataRoot:root,trust,credentials});
 assert.equal(host.status,'degraded');
 assert.ok(host.permissions);
 assert.equal(host.credentials,undefined);
 assert.ok(host.diagnostics.some(d=>d.module==='credentials'&&d.reason==='initialization_failed'));
 assert.equal(JSON.stringify(host.diagnostics).includes('must-not-log'),false);
 assert.equal((await host.stop()).status,'stopped');
 const db=openSqliteStore(join(root,'wex-credentials.sqlite'),'credentials');
 try{assert.deepEqual(db.read(),before);}finally{db.close();}
});

test('credential initialization cleanup uncertainty keeps root occupied until retry completes',async t=>{
 const root=await fixture(t);damage(root);
 let failClose=true,closeCalls=0;
 const host=await startFoundations({dataRoot:root,trust,credentials,openStore(path,namespace){
  const db=openSqliteStore(path,namespace);
  return namespace!=='credentials'?db:{...db,close(){
   closeCalls++;
   if(failClose)throw Error('private close failure');
   db.close();
  }};
 }});
 t.after(async()=>{failClose=false;await host.stop();});
 assert.equal(host.status,'degraded');
 assert.equal(host.credentials,undefined);
 assert.ok(closeCalls>=1);
 assert.equal((await host.stop()).status,'incomplete');
 const rival=await startFoundations({dataRoot:root,trust});
 assert.equal(rival.status,'failed');
 assert.equal((await rival.stop()).status,'stopped');
 failClose=false;
 assert.equal((await host.stop()).status,'stopped');
 const reopened=await startFoundations({dataRoot:root,trust});
 assert.equal(reopened.status,'ready');
 assert.equal((await reopened.stop()).status,'stopped');
});
