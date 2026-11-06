import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSqliteStore} from '../../dist/shared/src/index.js';
for(const [name,sql] of [
 ['missing snapshot with surviving intents',"DELETE FROM snapshots WHERE ns='test'"],
 ['malformed snapshot JSON',"UPDATE snapshots SET body='{broken' WHERE ns='test'"],
 ['invalid snapshot revision',"UPDATE snapshots SET revision=-1 WHERE ns='test'"],
]){
 test('Store blocks '+name+' without blank reconstruction or overwriting corruption',()=>{
  const dir=mkdtempSync(join(tmpdir(),'wex-store-damage-')),file=join(dir,'data.sqlite');
  let store=openSqliteStore(file,'test');let raw;
  try{
   assert.equal(store.commit({intent:'original',expectedRevision:0,value:{healthy:true}}).status,'committed');
   store.close();raw=new DatabaseSync(file);raw.exec(sql);
   const before=raw.prepare('SELECT * FROM snapshots WHERE ns=?').get('test');
   store=openSqliteStore(file,'test');
   assert.throws(()=>store.read());
   const expectedRevision=name.startsWith('missing')?0:name.startsWith('invalid')?0:1;
   assert.deepEqual(store.commit({intent:'overwrite',expectedRevision,value:{healthy:false}}),{status:'not_committed',reason:'storage_unavailable'});
   assert.deepEqual(raw.prepare('SELECT * FROM snapshots WHERE ns=?').get('test'),before);
   assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM intents WHERE ns=?').get('test').n,1);
   const other=openSqliteStore(file,'other');assert.deepEqual(other.read(),{revision:0,value:null});other.close();
  }finally{raw?.close();store.close();rmSync(dir,{recursive:true,force:true});}
 });
}
