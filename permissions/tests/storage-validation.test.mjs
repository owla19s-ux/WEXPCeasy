import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import * as api from '../../dist/permissions/src/index.js';
import {openSqliteStore} from '../../dist/shared/src/index.js';
const scope={subject:'s',entry:'entry',conversation:'conversation',context:null,resource:'file',action:'read',target:'selected',relationship:'direct',relationshipGeneration:1};
const trust={current:()=>({...scope,kind:'conversation',moduleEnabled:true,globalEnabled:true,conversationEnabled:true,sourceAllowed:true}),canManage:()=>true,canReadHistory:()=>true};
function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'wex-permission-validation-')),file=join(dir,'permissions.sqlite');
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 let db=openSqliteStore(file,'permissions');const p=api.createPermissions(db,trust);
 for(const [index,kind] of ['grant','revoke','grant'].entries())assert.equal(p[kind]({intent:'event-'+index,expectedRevision:index,scope}).status,'committed');
 assert.equal(p.evaluate({}).status,'allow');db.close();
 return {open:()=>openSqliteStore(file,'permissions'),damage(change){
  const raw=new DatabaseSync(file);
  try{const row=raw.prepare('SELECT body FROM snapshots WHERE ns=?').get('permissions');const value=JSON.parse(row.body);change(value);raw.prepare('UPDATE snapshots SET body=? WHERE ns=?').run(JSON.stringify(value),'permissions');}finally{raw.close();}
 }};
}
for(const [label,damage] of [
 ['aggregate extra fields',s=>{s.secret='private';}],
 ['event extra fields',s=>{s.events[2].secret='private';}],
 ['scope extra fields',s=>{s.events[2].scope.secret='private';}],
 ['aggregate generation mismatch',s=>{s.generation=0;}],
 ['event generation mismatch',s=>{s.events[2].generation=1;}],
 ['missing event',s=>{s.events.splice(1,1);}],
 ['duplicate intent',s=>{s.events[2].intent=s.events[0].intent;}],
 ['command with different kind',s=>{const c=JSON.parse(s.events[2].command);c.kind='revoke';s.events[2].command=JSON.stringify(c);}],
 ['command with different scope',s=>{const c=JSON.parse(s.events[2].command);c.scope.target='other';s.events[2].command=JSON.stringify(c);}],
 ['command with wrong revision',s=>{const c=JSON.parse(s.events[2].command);c.expectedRevision=0;s.events[2].command=JSON.stringify(c);}],
 ['command with extra fields',s=>{const c=JSON.parse(s.events[2].command);c.secret='private';s.events[2].command=JSON.stringify(c);}],
]){
 test('persisted permissions reject '+label+' across real SQLite reopen without rewriting evidence',t=>{
  const f=fixture(t);f.damage(damage);const db=f.open();
  try{
   const before=db.read(),p=api.createPermissions(db,trust);
   assert.equal(p.evaluate({}).status,'indeterminate');
   assert.equal(p.history({}).status,'unavailable');
   assert.notEqual(p.grant({intent:'new',expectedRevision:before.revision,scope}).status,'committed');
   assert.deepEqual(db.read(),before);
  }finally{db.close();}
 });
}
test('permission store inspection validates healthy persisted history without exposing it or writing',t=>{
 const f=fixture(t),db=f.open();
 try{
  const before=db.read();assert.equal(typeof api.inspectPermissionStore,'function');
  assert.deepEqual(api.inspectPermissionStore(db),{status:'ready'});assert.deepEqual(db.read(),before);
  assert.equal(api.createPermissions(db,trust).evaluate({}).status,'allow');
 }finally{db.close();}
});
test('permission inspection reports unavailable without changing future or null persisted state',()=>{
 assert.equal(typeof api.inspectPermissionStore,'function');
 for(const value of [null,{format:99,generation:0,events:[]}]){
  const db=openSqliteStore(':memory:','permissions');
  try{db.commit({intent:'damage',expectedRevision:0,value});const before=db.read();assert.deepEqual(api.inspectPermissionStore(db),{status:'unavailable'});assert.deepEqual(db.read(),before);}finally{db.close();}
 }
});
