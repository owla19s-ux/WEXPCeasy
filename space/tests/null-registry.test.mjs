import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {openSpaceService} from '../../dist/space/src/index.js';
import {fixture} from './fixture.mjs';
test('null persisted Space registry is unavailable and cannot replace organization or Context locators with empty data',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);
 assert.equal((await h.exec(s,{kind:'space.create',intent:'space',name:'Existing'})).status,'committed');
 const file=join(h.root,'wex-space.sqlite'),db=openSqliteStore(file,'space-registry');
 const body=openSqliteStore(join(h.a,'wex-context.sqlite'),'space-context'),contextBefore=body.read();body.close();
 const snap=db.read();assert.equal(db.commit({intent:'damage',expectedRevision:snap.revision,value:null}).status,'committed');const before=db.read();
 try{
  const query=await s.query(h.request('organization.list','root:root'),{kind:'organization',entity:'space'});
  assert.equal(query.status,'unavailable');
  assert.equal((await h.exec(s,{kind:'space.create',intent:'overwrite',name:'Replacement'})).status,'unavailable');
  assert.deepEqual(db.read(),before);await s.close();
  const opened=await openSpaceService({dataRoot:h.root,permission:h.permission});
  try{assert.equal(opened.status,'unavailable');}finally{if(opened.status==='ready')await opened.service.close();}
  assert.deepEqual(db.read(),before);
  const check=openSqliteStore(join(h.a,'wex-context.sqlite'),'space-context');
  try{assert.deepEqual(check.read(),contextBefore);assert.equal(check.read().value.context.id,c.id);}finally{check.close();}
 }finally{db.close();}
});
