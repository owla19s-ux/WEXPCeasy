import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {fixture} from './fixture.mjs';

test('removing a primary address refuses exhausted Context revision without corrupting persistent data',async t=>{
 const h=await fixture(t),s=await h.open(),c=await h.create(s);
 const address=await h.exec(s,{kind:'address.add',contextId:c.id,intent:'address',name:'main',address:'https://example.org'});
 assert.equal(address.status,'committed');
 assert.equal((await h.exec(s,{kind:'primary.select',contextId:c.id,intent:'primary',id:address.id,expectedRevision:1})).status,'committed');
 await s.close();
 const db=openSqliteStore(join(h.a,'wex-context.sqlite'),'space-context'),snap=db.read();
 snap.value.context.revision=Number.MAX_SAFE_INTEGER;
 assert.equal(db.commit({intent:'exhausted-fixture',expectedRevision:snap.revision,value:snap.value}).status,'committed');
 const before=db.read();db.close();
 const reopened=await h.open();
 const result=await h.exec(reopened,{kind:'address.remove',contextId:c.id,intent:'remove',id:address.id,expectedRevision:1});
 assert.deepEqual(result,{status:'rejected',reason:'revision_exhausted'});
 const q=await h.query(reopened,c.id);
 assert.equal(q.status,'ok');assert.equal(q.value.primaryAddress,address.id);
 assert.equal(q.value.revision,Number.MAX_SAFE_INTEGER);assert.equal(q.value.resources.length,1);
 await reopened.close();
 const check=openSqliteStore(join(h.a,'wex-context.sqlite'),'space-context');
 assert.deepEqual(check.read(),before);check.close();
 const finalService=await h.open();assert.equal((await h.query(finalService,c.id)).status,'ok');
});
