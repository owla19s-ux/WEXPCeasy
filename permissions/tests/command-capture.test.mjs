import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createPermissions} from '../../dist/permissions/src/index.js';
import {openSqliteStore} from '../../dist/shared/src/index.js';
const scope={subject:'user',entry:'local',conversation:null,context:null,resource:'file',action:'write',target:'approved',relationship:'direct',relationshipGeneration:1};
for(const kind of ['grant','revoke']){
 for(const field of ['scope','intent','expectedRevision']){
  test(kind+' cannot retarget its approved command during Store read: '+field,t=>{
   const dir=mkdtempSync(join(tmpdir(),'wex-command-')),db=openSqliteStore(join(dir,'permissions.sqlite'),'permissions');
   t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
   const command={intent:'approved',expectedRevision:0,scope:{...scope}};
   const before=db.read();
   const permissions=createPermissions({...db,read(){const snap=db.read();
    if(field==='scope')command.scope.target='injected';
    else if(field==='intent')command.intent='injected';
    else command.expectedRevision=1;
    return snap;
   }},{current:()=>undefined,canManage:c=>c===command,canReadHistory:()=>true});
   assert.notEqual(permissions[kind](command).status,'committed');
   assert.deepEqual(db.read(),before);
   assert.equal(db.query('injected'),undefined);
  });
 }
}
test('an unchanged identity-bound management command commits and replays its original receipt',t=>{
 const dir=mkdtempSync(join(tmpdir(),'wex-command-ok-')),db=openSqliteStore(join(dir,'permissions.sqlite'),'permissions');
 t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
 const command={intent:'approved',expectedRevision:0,scope:{...scope}};
 const p=createPermissions(db,{current:()=>undefined,canManage:c=>c===command,canReadHistory:()=>true});
 assert.deepEqual(p.grant(command),{status:'committed',intent:'approved',revision:1});
 assert.deepEqual(p.grant(command),{status:'committed',intent:'approved',revision:1});
 assert.equal(p.history({}).records[0].scope.target,'approved');
});

for(const kind of ['grant','revoke'])test(kind+' receipt query cannot substitute a different approved command',t=>{
 const dir=mkdtempSync(join(tmpdir(),'wex-receipt-command-')),db=openSqliteStore(join(dir,'permissions.sqlite'),'permissions');
 t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
 const command={intent:'original',expectedRevision:0,scope:{...scope}};
 const trust={current:()=>undefined,canManage:c=>c===command,canReadHistory:()=>true};
 assert.equal(createPermissions(db,trust)[kind](command).status,'committed');
 const before=db.read();
 const p=createPermissions({...db,query(intent){const proof=db.query(intent);command.scope.target='injected';return proof;}},trust);
 assert.equal(p[kind](command).status,'denied');
 assert.deepEqual(db.read(),before);
});
