import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createSqliteStore,openSqliteStore} from '../../dist/shared/src/index.js';
import {storeContract,memoryStore} from './store-contract.mjs';
export function sqliteFixture(mode='normal'){
 const dir=mkdtempSync(join(tmpdir(),'wex-contract-'));const db=new DatabaseSync(join(dir,'data.db'));
 const port={prepare:s=>db.prepare(s),close:()=>db.close(),get isTransaction(){return db.isTransaction;},exec(sql){
 if(mode==='before'&&sql==='BEGIN IMMEDIATE')throw Error('unavailable before transaction');
 db.exec(sql);
 if(mode==='ack'&&sql==='COMMIT')throw Error('transport lost after durable commit');
 }};
 const store=createSqliteStore(port,'test');return {store,dispose(){store.close();rmSync(dir,{recursive:true,force:true});}};
}
test('shared provider: same contract vectors against SQLite real transactions with transport fault port',()=>storeContract(sqliteFixture));
test('consumer double: same success, failure, ACK-loss and conflict vectors',()=>storeContract(mode=>({store:memoryStore(mode),dispose(){}})));
test('actual SQLite read-only failure is confirmed not committed',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wex-ro-'));const path=join(dir,'s.db');let s=openSqliteStore(path,'test');s.close();
 const db=new DatabaseSync(path,{readOnly:true});s=createSqliteStore(db,'test');try{assert.equal(s.commit({intent:'x',expectedRevision:0,value:1}).status,'not_committed');assert.equal(s.read().revision,0);}finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
