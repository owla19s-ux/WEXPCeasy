import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {createPermissions} from '../../dist/permissions/src/index.js';
test('null persisted permission state is indeterminate after reopen and cannot reset grant history',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wex-permission-null-')),file=join(dir,'permissions.sqlite'),request={};
 const scope={subject:'user',entry:'conversation',conversation:'chat',context:null,resource:'fixture',action:'read',target:'item',relationship:'direct',relationshipGeneration:1};
 const trust={current:r=>r===request?{...scope,kind:'conversation',moduleEnabled:true,globalEnabled:true,conversationEnabled:true,sourceAllowed:true}:undefined,canManage:()=>true,canReadHistory:()=>true};
 let db=openSqliteStore(file,'permissions');
 try{
  let permission=createPermissions(db,trust);
  assert.equal(permission.grant({intent:'grant',expectedRevision:0,scope}).status,'committed');
  assert.equal(permission.evaluate(request).status,'allow');
  db.commit({intent:'damage',expectedRevision:1,value:null});db.close();db=openSqliteStore(file,'permissions');
  const before=db.read();permission=createPermissions(db,trust);
  assert.equal(permission.evaluate(request).status,'indeterminate');
  assert.deepEqual(permission.history(request),{status:'unavailable'});
  assert.notEqual(permission.grant({intent:'replacement',expectedRevision:2,scope:{...scope,target:'another'}}).status,'committed');
  assert.deepEqual(db.read(),before);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
