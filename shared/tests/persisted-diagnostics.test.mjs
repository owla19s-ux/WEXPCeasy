import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import * as shared from '../../dist/shared/src/index.js';
test('technical diagnostics persist only whitelisted codes across real SQLite reopen',()=>{
 assert.equal(typeof shared.createPersistedDiagnostics,'function');
 const dir=mkdtempSync(join(tmpdir(),'wex-diagnostics-')),file=join(dir,'diagnostics.sqlite');let db=shared.openSqliteStore(file,'technical-diagnostics');
 try{
  let log=shared.createPersistedDiagnostics(db);
  assert.equal(log.emit({module:'app',level:'error',code:'module_unavailable',apiKey:'must-not-persist',path:'/private/path',message:'private'}).status,'written');
  const result=log.read();assert.equal(result.status,'ok');assert.equal(result.records.length,1);
  assert.deepEqual(result.records[0].entry,{kind:'technical',module:'app',level:'error',code:'module_unavailable'});
  assert.equal(result.records[0].sequence,1);assert.ok(Number.isFinite(Date.parse(result.records[0].observedAt)));
  assert.equal(JSON.stringify(db.read()).includes('must-not-persist'),false);assert.equal(JSON.stringify(db.read()).includes('/private/path'),false);
  const before=db.read();db.close();db=shared.openSqliteStore(file,'technical-diagnostics');log=shared.createPersistedDiagnostics(db);
  assert.deepEqual(db.read(),before);assert.deepEqual(log.read(),result);
  assert.equal(log.emit({module:'app',level:'error',code:'release_failed'}).status,'written');
  assert.deepEqual(log.read().records.map(x=>x.sequence),[1,2]);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('technical diagnostic capacity failure preserves old records instead of deleting them',()=>{
 assert.equal(typeof shared.createPersistedDiagnostics,'function');
 const db=shared.openSqliteStore(':memory:','technical-diagnostics');
 try{
  const log=shared.createPersistedDiagnostics(db,{maxEntries:1});
  assert.equal(log.emit({module:'shared',level:'error',code:'storage_unavailable'}).status,'written');const before=db.read();
  assert.equal(log.emit({module:'app',level:'error',code:'release_failed'}).status,'failed');assert.deepEqual(db.read(),before);
  assert.equal(log.read().records.length,1);
 }finally{db.close();}
});
test('uncertain technical log commit is not reported written or automatically retried',()=>{
 assert.equal(typeof shared.createPersistedDiagnostics,'function');
 const db=shared.openSqliteStore(':memory:','technical-diagnostics');let commits=0;
 try{
  const log=shared.createPersistedDiagnostics({...db,commit(input){commits++;db.commit(input);return {status:'unknown',intent:input.intent};}});
  assert.equal(log.emit({module:'app',level:'error',code:'release_failed'}).status,'failed');
  assert.equal(commits,1);assert.equal(log.read().records.length,1);
 }finally{db.close();}
});
test('damaged technical log formats and secret fields refuse opening without repair or overwrite',()=>{
 assert.equal(typeof shared.createPersistedDiagnostics,'function');
 for(const value of [
  null,
  {format:99,domain:'technical-diagnostics',records:[]},
  {format:1,domain:'technical-diagnostics',records:[{sequence:1,observedAt:'2026-11-06T00:00:00.000Z',entry:{kind:'technical',module:'app',level:'error',code:'release_failed',token:'secret'}}]},
 ]){
  const db=shared.openSqliteStore(':memory:','technical-diagnostics');
  try{db.commit({intent:'damage',expectedRevision:0,value});const before=db.read();assert.throws(()=>shared.createPersistedDiagnostics(db));assert.deepEqual(db.read(),before);}
  finally{db.close();}
 }
});
