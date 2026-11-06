import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {createConnectionConfigs,createOperationLedger} from '../../dist/connections/src/index.js';
function damaged(t,namespace,value){
 const dir=mkdtempSync(join(tmpdir(),'wex-null-state-')),path=join(dir,'state.sqlite');
 let db=openSqliteStore(path,namespace);
 db.commit({intent:'healthy',expectedRevision:0,value});
 db.commit({intent:'damaged',expectedRevision:1,value:null});db.close();
 db=openSqliteStore(path,namespace);t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});return db;
}
test('persisted null connection configuration is corruption, not a new empty configuration store',t=>{
 const config={id:'c',adapter:'fixture',endpoint:'fixture:remote',credentialRef:null,enabled:true};
 const db=damaged(t,'configs',{format:1,items:[config]}),before=db.read(),configs=createConnectionConfigs(db);
 assert.throws(()=>configs.read());
 assert.deepEqual(configs.put({...config,id:'new'},2,'overwrite'),{status:'unavailable',reason:'store_failed'});
 assert.deepEqual(db.read(),before);
});
test('persisted null Operation aggregate cannot erase unknown work and accept another dispatch',t=>{
 const db=damaged(t,'operations',{format:1,operations:[{id:'original',fingerprint:'original',phase:'unknown',attempts:1,observations:[{id:'error',phase:'unknown',value:{reason:'unconfirmed'}}]}]});
 const before=db.read(),ledger=createOperationLedger(db);
 assert.throws(()=>ledger.read());
 assert.equal(ledger.prepare('new','new').status,'unavailable');assert.deepEqual(db.read(),before);
});
