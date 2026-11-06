import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {createAiConfigurations} from '../../dist/AI/src/index.js';

for(const [name,corrupt] of [
 ['duplicate identity',s=>s.entries.push({...s.entries[0]})],
 ['invalid revision',s=>s.entries[0].revision=0],
 ['unknown persisted fields',s=>s.entries[0].apiKey='must-not-project'],
 ['malformed receipt',s=>s.receipts[0].entry.revision=0],
 ['receipt command mismatch',s=>s.receipts[0].command='{}'],
 ['missing role reference',s=>s.entries.push({kind:'agent',id:'agent',revision:1,name:'A',roleId:'missing',positionId:'missing',model:{connectionId:'c',modelId:'m'}})],
]){
 test('AI refuses '+name+' across restart without overwriting damaged data',()=>{
  const dir=mkdtempSync(join(tmpdir(),'wex-ai-corrupt-')),file=join(dir,'ai.sqlite');
  let db=openSqliteStore(file,'ai');
  try{
   const ai=createAiConfigurations(db,()=>true);
   assert.equal(ai.save({}, {id:'role',intent:'create',expectedRevision:0,value:{kind:'role',name:'Role',prompt:'Prompt'}}).status,'committed');
   const snap=db.read();corrupt(snap.value);
   assert.equal(db.commit({intent:'damage',expectedRevision:snap.revision,value:snap.value}).status,'committed');
   db.close();db=openSqliteStore(file,'ai');
   const before=db.read(),reopened=createAiConfigurations(db,()=>true);
   assert.deepEqual(reopened.read({},'role','role'),{status:'unavailable'});
   assert.deepEqual(reopened.save({}, {id:'new',intent:'save',expectedRevision:0,value:{kind:'role',name:'New',prompt:'New'}}),{status:'unavailable'});
   assert.deepEqual(db.read(),before);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
 });
}
