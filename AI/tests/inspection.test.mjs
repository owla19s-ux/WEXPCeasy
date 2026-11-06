import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import * as ai from '../../dist/AI/src/index.js';
test('AI storage inspection validates real persisted configuration without exposing business data or mutating it',()=>{
 assert.equal(typeof ai.inspectAiConfigurationStore,'function');
 const dir=mkdtempSync(join(tmpdir(),'wex-ai-inspect-')),file=join(dir,'ai.sqlite');let db=openSqliteStore(file,'ai');
 try{
  assert.deepEqual(ai.inspectAiConfigurationStore(db),{status:'ready'});
  const service=ai.createAiConfigurations(db,()=>true);
  assert.equal(service.save({}, {id:'role',intent:'create',expectedRevision:0,value:{kind:'role',name:'private role',prompt:'private prompt'}}).status,'committed');
  db.close();db=openSqliteStore(file,'ai');const before=db.read();
  assert.deepEqual(ai.inspectAiConfigurationStore(db),{status:'ready'});assert.deepEqual(db.read(),before);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('AI storage inspection reports damaged or future data unavailable without blank reconstruction',()=>{
 assert.equal(typeof ai.inspectAiConfigurationStore,'function');
 for(const value of [null,{version:99,entries:[],receipts:[]},{version:1,entries:[],receipts:'damaged'}]){
  const db=openSqliteStore(':memory:','ai');
  try{
   db.commit({intent:'damage',expectedRevision:0,value});const before=db.read();
   assert.deepEqual(ai.inspectAiConfigurationStore(db),{status:'unavailable'});assert.deepEqual(db.read(),before);
  }finally{db.close();}
 }
});
