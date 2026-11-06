import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createOperationLedger} from '../../dist/connections/src/index.js';
import {openSqliteStore} from '../../dist/shared/src/index.js';
for(const [name,damage] of [
 ['aggregate',state=>{state.token='must-not-project';}],
 ['Operation',state=>{state.operations[0].token='must-not-project';}],
 ['connection binding',state=>{state.operations[0].connection.token='must-not-project';}],
 ['observation envelope',state=>{state.operations[0].observations[0].token='must-not-project';}],
]){
 test('persisted '+name+' extra fields block ledger projection and mutation after real SQLite reopen',t=>{
  const dir=mkdtempSync(join(tmpdir(),'wex-ledger-schema-')),file=join(dir,'operations.sqlite');
  let db=openSqliteStore(file,'connection-operations');t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
  let ledger=createOperationLedger(db);
  const binding={connectionId:'connection',configRevision:1,adapterId:'fixture',adapterVersion:'1',endpoint:'local:fixture'};
  assert.equal(ledger.prepare('operation','fingerprint',binding).status,'ok');
  assert.equal(ledger.markDispatched('operation').status,'ok');
  assert.equal(ledger.observe('operation','result',{ok:true},'observed').status,'ok');
  const snap=db.read();damage(snap.value);db.commit({intent:'tamper',expectedRevision:snap.revision,value:snap.value});const before=db.read();
  db.close();db=openSqliteStore(file,'connection-operations');ledger=createOperationLedger(db);
  assert.throws(()=>ledger.read());assert.throws(()=>ledger.get('operation'));
  assert.equal(ledger.prepare('new','new-fingerprint').status,'unavailable');
  assert.equal(ledger.observe('operation','later',{ok:true},'observed').status,'unavailable');
  assert.deepEqual(db.read(),before);
 });
}
