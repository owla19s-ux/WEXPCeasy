import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createPermissions} from '../../dist/permissions/src/index.js';
import {openSqliteStore} from '../../dist/shared/src/index.js';
const scope={subject:'user',entry:'entry',conversation:'conversation',context:null,resource:'file',action:'read',target:'selected',relationship:'direct',relationshipGeneration:1};
function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'wex-permission-recheck-')),file=join(dir,'permissions.sqlite');
 let db=openSqliteStore(file,'permissions'),manage=true,history=true,hook=()=>{};
 const approved=new WeakSet();
 const original={intent:'original',expectedRevision:0,scope};approved.add(original);
 const trust={current:()=>({...scope,kind:'conversation',moduleEnabled:true,globalEnabled:true,conversationEnabled:true,sourceAllowed:true}),
  canManage:change=>manage&&approved.has(change),canReadHistory:()=>history};
 assert.equal(createPermissions(db,trust).grant(original).status,'committed');db.close();db=openSqliteStore(file,'permissions');
 const p=createPermissions({...db,read(){const value=db.read();hook('read');return value;},query(intent){const result=db.query(intent);hook('query');return result;}},trust);
 t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
 return {db,p,original,approve:c=>approved.add(c),onRead(fn){hook=fn;},revokeManage(){manage=false;},revokeHistory(){history=false;}};
}
for(const [label,kind,command,phase] of [
 ['matching receipt','grant','same','read'],
 ['conflicting receipt','grant','conflict','read'],
 ['receipt query','grant','same','query'],
 ['new grant','grant','new','read'],
 ['new revoke','revoke','new','read'],
]){
 test('permission '+label+' is denied when management access is revoked during '+phase,t=>{
  const f=fixture(t),before=f.db.read();
  const change=command==='same'?f.original:command==='conflict'?{...f.original,scope:{...scope,target:'other'}}:{intent:'new',expectedRevision:1,scope};
  f.approve(change);f.onRead(at=>{if(at===phase)f.revokeManage();});
  assert.deepEqual(f.p[kind](change),{status:'denied',reason:'management_not_authorized'});
  assert.deepEqual(f.db.read(),before);
 });
}
test('permission history does not disclose persisted events after history access is revoked during storage read',t=>{
 const f=fixture(t),before=f.db.read();f.onRead(()=>f.revokeHistory());
 assert.deepEqual(f.p.history({}),{status:'denied'});assert.deepEqual(f.db.read(),before);
});
