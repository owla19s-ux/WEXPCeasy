import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {fixture} from './fixture.mjs';

const association={id:'stored-reference',revision:1,owner:'AI',targetType:'role',targetId:'role-1',purpose:'selected'};
const tool={id:'stored-tool',revision:1,owner:'connections',targetType:'tool',targetId:'compiler',purpose:'build',enabled:true};
for(const [name,corrupt] of [
 ['role identity persisted as a tool',s=>s.tools.push({...association,enabled:true})],
 ['unsupported association identity',s=>s.associations.push({...association,owner:'unknown-owner',targetType:'unknown-type'})],
 ['duplicate tool identities',s=>s.tools.push(tool,{...tool,id:'duplicate-tool'})],
 ['duplicate association identities',s=>s.associations.push(association,{...association,id:'duplicate-reference'})]
])test(`persisted ${name} blocks reads and writes without repairing or discarding data`,async t=>{
 const h=await fixture(t,{owner:{async resolve(_request,target){return {status:'available',...target,sourceRevision:'1',observedAt:'2026-11-05T00:00:00Z'};}}});
 const s=await h.open(),c=await h.create(s),path=join(h.a,'wex-context.sqlite');
 const db=openSqliteStore(path,'space-context'),snap=db.read();corrupt(snap.value);
 assert.equal(db.commit({intent:'corrupt-fixture',expectedRevision:snap.revision,value:snap.value}).status,'committed');const before=db.read();db.close();
 assert.deepEqual(await h.query(s,c.id),{status:'unavailable',reason:'corrupt_context'});
 const write=await h.exec(s,{kind:'address.add',contextId:c.id,intent:'must-not-write',name:'new',address:'https://example.org'});
 assert.deepEqual(write,{status:'unavailable',reason:'corrupt_context'});
 await s.close();const reopened=await h.open();assert.deepEqual(await h.query(reopened,c.id),{status:'unavailable',reason:'corrupt_context'});
 const check=openSqliteStore(path,'space-context');assert.deepEqual(check.read(),before);check.close();
});
