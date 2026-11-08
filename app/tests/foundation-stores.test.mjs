import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,rm,rename,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openDomainStore,closeStores} from '../../dist/app/src/foundation-stores.js';

async function fixture(t){
 const path=await mkdtemp(join(tmpdir(),'wex-foundation-stores-'));
 await writeFile(join(path,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 t.after(()=>rm(path,{recursive:true,force:true}));
 return {path,id:'root'};
}

test('storage opener accepts a verified root and preserves the intended namespace',async t=>{
 const root=await fixture(t);
 const calls=[],store={close(){}};
 assert.equal(await openDomainStore(root,'safe.sqlite','safe-domain',(path,namespace)=>{
  calls.push({path,namespace});return store;
 }),store);
 assert.deepEqual(calls,[{path:join(root.path,'safe.sqlite'),namespace:'safe-domain'}]);
});

test('storage opener refuses symbolic-link database and SQLite sidecars',async t=>{
 const root=await fixture(t),outside=join(root.path,'foreign');
 await writeFile(outside,'untouched');
 for(const suffix of ['','-journal','-wal','-shm']){
  const target=join(root.path,'safe.sqlite'+suffix);
  await symlink(outside,target);
  let called=false;
  await assert.rejects(openDomainStore(root,'safe.sqlite','safe-domain',()=>{
   called=true;return {close(){}};
  }),/unsafe store path/);
  assert.equal(called,false);
  await rm(target);
 }
});

test('storage opener refuses directory and changed root identity',async t=>{
 const root=await fixture(t);
 await mkdir(join(root.path,'safe.sqlite'));
 let called=false;
 await assert.rejects(openDomainStore(root,'safe.sqlite','safe-domain',()=>{
  called=true;return {close(){}};
 }),/unsafe store path/);
 assert.equal(called,false);
 await rm(join(root.path,'safe.sqlite'),{recursive:true});
 await writeFile(join(root.path,'.wex-root.json'),JSON.stringify({format:1,id:'other'}));
 await assert.rejects(openDomainStore(root,'safe.sqlite','safe-domain',()=>{
  called=true;return {close(){}};
 }),/root changed/);
 assert.equal(called,false);
});

test('storage close releases healthy stores and retains failed ones for explicit retry',async()=>{
 const trace=[],first={close(){trace.push('first');}};
 let fails=1;
 const second={close(){trace.push('second');if(fails-->0)throw Error('private close error');}};
 const third={close(){trace.push('third');}};
 const stores=new Set([first,second,third]);
 await assert.rejects(closeStores(stores),/store_close_unconfirmed/);
 assert.deepEqual(trace,['first','second','third']);
 assert.deepEqual([...stores],[second]);
 await closeStores(stores);
 assert.deepEqual(trace,['first','second','third','second']);
 assert.equal(stores.size,0);
});
