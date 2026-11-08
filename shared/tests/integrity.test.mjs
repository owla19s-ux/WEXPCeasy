import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSqliteStore,createSqliteStore} from '../../dist/shared/src/index.js';
function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'wex-store-integrity-')),path=join(dir,'store.sqlite');
 const store=openSqliteStore(path,'test'),raw=new DatabaseSync(path);
 t.after(()=>{raw.close();store.close();rmSync(dir,{recursive:true,force:true});});
 return {store,raw,path};
}
for(const [label,sql] of [
 ['missing latest receipt',"DELETE FROM intents WHERE ns='test' AND revision=2"],
 ['missing historical receipt',"DELETE FROM intents WHERE ns='test' AND revision=1"],
 ['receipt beyond current snapshot',"UPDATE intents SET revision=3 WHERE ns='test' AND revision=1"],
 ['duplicate receipt revision',"UPDATE intents SET revision=2 WHERE ns='test' AND revision=1"],
 ['snapshot not matching latest committed payload',`UPDATE snapshots SET body='{"value":"forged"}' WHERE ns='test'`],
 ['malformed latest request',`UPDATE intents SET request='{broken' WHERE ns='test' AND revision=2`],
 ['receipt with mismatched expected revision',`UPDATE intents SET request='{"expectedRevision":0,"value":{"value":"second"}}' WHERE ns='test' AND revision=2`],
 ['non-finite persisted JSON',`UPDATE snapshots SET body='1e400' WHERE ns='test'`],
]){
 test('Store refuses '+label+' in reads, receipt queries and original-intent replay',t=>{
  const {store,raw}=fixture(t);
  const first={intent:'first',expectedRevision:0,value:{value:'first'}};
  store.commit(first);store.commit({intent:'second',expectedRevision:1,value:{value:'second'}});
  raw.exec(sql);const before=raw.prepare("SELECT body,revision FROM snapshots WHERE ns='test'").get();
  assert.throws(()=>store.read());
  assert.throws(()=>store.query('first'));
  assert.deepEqual(store.commit(first),{status:'not_committed',reason:'storage_unavailable'});
  assert.deepEqual(store.commit({intent:'repair',expectedRevision:2,value:null}),{status:'not_committed',reason:'storage_unavailable'});
  assert.deepEqual(raw.prepare("SELECT body,revision FROM snapshots WHERE ns='test'").get(),before);
  const other=openSqliteStore(storePath(raw),'unrelated');assert.deepEqual(other.read(),{revision:0,value:null});other.close();
 });
}
function storePath(raw){return raw.prepare('PRAGMA database_list').get().file;}
test('historical receipt requests are validated before proving or replaying that intent',t=>{
 const {store,raw}=fixture(t);const first={intent:'first',expectedRevision:0,value:1};
 store.commit(first);store.commit({intent:'second',expectedRevision:1,value:2});
 raw.exec("UPDATE intents SET request='{}' WHERE ns='test' AND id='first'");
 assert.throws(()=>store.query('first'));
 assert.deepEqual(store.commit(first),{status:'not_committed',reason:'storage_unavailable'});
 assert.equal(store.read().revision,2);
});
test('invalid inputs and overflowing revisions never enter a transaction',t=>{
 const {store,raw}=fixture(t);
 for(const input of [null,{intent:1,expectedRevision:0,value:null},{intent:'overflow',expectedRevision:Number.MAX_SAFE_INTEGER,value:null},{intent:'extra',expectedRevision:0,value:null,extra:true}]){
  assert.deepEqual(store.commit(input),{status:'not_committed',reason:'invalid_request'});
 }
 const cyclic={};cyclic.self=cyclic;
 assert.equal(store.commit({intent:'cycle',expectedRevision:0,value:cyclic}).reason,'invalid_request');
 assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM intents').get().n,0);
 assert.deepEqual(store.read(),{revision:0,value:null});
});
test('a commit captures its exact input before calling a storage dependency',t=>{
 const {raw}=fixture(t);const input={intent:'original',expectedRevision:0,value:{text:'original'}};
 const port={prepare:s=>raw.prepare(s),close(){},get isTransaction(){return raw.isTransaction;},exec(sql){raw.exec(sql);if(sql==='BEGIN IMMEDIATE'){input.intent='injected';input.value.text='injected';}}};
 const store=createSqliteStore(port,'captured');
 assert.deepEqual(store.commit(input),{status:'committed',intent:'original',revision:1});
 assert.deepEqual(store.read(),{revision:1,value:{text:'original'}});
 assert.equal(store.query('injected'),undefined);
});
test('failed COMMIT plus failed rollback never exposes uncommitted receipts as durable proof',t=>{
 const {raw,path}=fixture(t);
 const port={prepare:s=>raw.prepare(s),close(){},get isTransaction(){return raw.isTransaction;},exec(sql){
  if(sql==='COMMIT'||sql==='ROLLBACK')throw Error('injected transaction uncertainty');raw.exec(sql);
 }};
 const store=createSqliteStore(port,'uncertain');
 assert.deepEqual(store.commit({intent:'uncertain',expectedRevision:0,value:1}),{status:'unknown',intent:'uncertain'});
 assert.throws(()=>store.query('uncertain'));assert.throws(()=>store.read());
 assert.deepEqual(store.commit({intent:'next',expectedRevision:1,value:2}),{status:'not_committed',reason:'storage_unavailable'});
 raw.exec('ROLLBACK');
 const reopened=openSqliteStore(path,'uncertain');try{assert.deepEqual(reopened.read(),{revision:0,value:null});assert.equal(reopened.query('uncertain'),undefined);}finally{reopened.close();}
});

test('Store does not expose or roll back a transaction started by its caller',t=>{
 const {raw}=fixture(t);const store=createSqliteStore(raw,'outside');
 raw.exec('BEGIN IMMEDIATE');
 try{
  assert.throws(()=>store.read());assert.throws(()=>store.query('external'));
  assert.deepEqual(store.commit({intent:'nested',expectedRevision:0,value:1}),{status:'not_committed',reason:'storage_unavailable'});
  assert.equal(raw.isTransaction,true);
 }finally{raw.exec('ROLLBACK');}
 assert.deepEqual(store.read(),{revision:0,value:null});
});
test('an old read-only Store remains readable when its optional revision index is absent',t=>{
 const {raw,path}=fixture(t);
 raw.exec('DROP INDEX IF EXISTS intents_namespace_revision');
 const readonly=new DatabaseSync(path,{readOnly:true});
 const store=createSqliteStore(readonly,'test');
 try{assert.deepEqual(store.read(),{revision:0,value:null});assert.equal(store.commit({intent:'readonly',expectedRevision:0,value:1}).status,'not_committed');}
 finally{store.close();}
});
test('an unobservable transaction state requires reopen after uncertain rollback',t=>{
 const {raw,path}=fixture(t);
 const port={prepare:s=>raw.prepare(s),close(){},exec(sql){raw.exec(sql);if(sql==='COMMIT')throw Error('lost ack');}};
 const store=createSqliteStore(port,'no-state');
 assert.equal(store.commit({intent:'durable',expectedRevision:0,value:'kept'}).status,'unknown');
 assert.throws(()=>store.query('durable'));
 const reopened=openSqliteStore(path,'no-state');
 try{assert.equal(reopened.query('durable').revision,1);assert.equal(reopened.read().value,'kept');}finally{reopened.close();}
});

test('quarantine cannot be bypassed through another Store wrapper on the same connection',t=>{
 const {raw}=fixture(t);
 const port={prepare:s=>raw.prepare(s),close(){},exec(sql){if(sql==='COMMIT'||sql==='ROLLBACK')throw Error('uncertain');raw.exec(sql);}};
 const first=createSqliteStore(port,'aliases'),second=createSqliteStore(port,'aliases');
 assert.equal(first.commit({intent:'pending',expectedRevision:0,value:'not durable'}).status,'unknown');
 assert.throws(()=>second.query('pending'));assert.throws(()=>second.read());
 assert.equal(second.commit({intent:'next',expectedRevision:1,value:'must not commit'}).status,'not_committed');
 raw.exec('ROLLBACK');
});
test('reentrant namespace writers cannot roll back another Store transaction on the same connection',t=>{
 const {raw}=fixture(t);let nested,once=true,second;
 const port={prepare:s=>raw.prepare(s),close(){},exec(sql){
  raw.exec(sql);
  if(sql==='BEGIN IMMEDIATE'&&once){once=false;nested=second.commit({intent:'nested',expectedRevision:0,value:2});}
 }};
 const first=createSqliteStore(port,'first'),other=createSqliteStore(port,'second');second=other;
 assert.equal(first.commit({intent:'outer',expectedRevision:0,value:1}).status,'committed');
 assert.deepEqual(nested,{status:'not_committed',reason:'storage_unavailable'});
 assert.deepEqual(first.read(),{revision:1,value:1});assert.deepEqual(other.read(),{revision:0,value:null});
});
