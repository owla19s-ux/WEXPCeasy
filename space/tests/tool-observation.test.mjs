import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {fixture} from './fixture.mjs';
const target={owner:'connections',targetType:'tool',targetId:'compiler'};
const observedAt='2026-11-05T00:00:00Z';

test('owner-visible unavailable tools retain selection identity and recover through current observations without body writes',async t=>{
 let availability='available';
 const h=await fixture(t,{owner:{async resolve(_request,t){return {status:'available',...t,availability,sourceRevision:'owner-2',observedAt};}}});
 const s=await h.open(),c=await h.create(s),tool=await h.exec(s,{kind:'tool.add',intent:'tool',contextId:c.id,...target,purpose:'compile'});assert.equal(tool.status,'committed');
 const path=join(h.a,'wex-context.sqlite'),db=openSqliteStore(path,'space-context'),before=db.read();db.close();
 for(const state of ['unavailable','conflict','available']){
  availability=state;const view=(await h.query(s,c.id)).value;
  assert.equal(view.tools.length,1);assert.equal(view.tools[0].id,tool.id);assert.equal(view.tools[0].enabled,true);assert.equal(view.tools[0].revision,1);
  assert.equal(view.tools[0].availability,state);assert.equal(view.tools[0].sourceRevision,'owner-2');assert.equal(view.tools[0].observedAt,observedAt);assert.equal(view.revision,1);
 }
 const check=openSqliteStore(path,'space-context');assert.deepEqual(check.read(),before);check.close();
 assert.equal((await h.exec(s,{kind:'tool.set',contextId:c.id,intent:'disable',id:tool.id,expectedRevision:1,enabled:false})).status,'committed');
 availability='unavailable';await s.close();const reopened=await h.open();const restored=(await h.query(reopened,c.id)).value.tools[0];
 assert.equal(restored.id,tool.id);assert.equal(restored.enabled,false);assert.equal(restored.availability,'unavailable');assert.equal(restored.revision,2);
});

test('denied, unproven and unknown tool observations cannot expose persisted selections',async t=>{
 let response;
 const h=await fixture(t,{owner:{async resolve(_request,t){return response??{status:'available',...t,sourceRevision:'1',observedAt};}}});
 const s=await h.open(),c=await h.create(s);await h.exec(s,{kind:'tool.add',intent:'tool',contextId:c.id,...target,purpose:'private-tool'});
 for(const value of [{status:'denied'},{status:'unavailable'},{status:'available',...target,availability:'unavailable'},{status:'available',...target,availability:'arbitrary',sourceRevision:'1',observedAt},{status:'available',...target,availability:null,sourceRevision:'1',observedAt}]){
  response=value;const result=await h.query(s,c.id);assert.equal(result.status,'ok');assert.deepEqual(result.value.tools,[]);assert.equal(JSON.stringify(result).includes('private-tool'),false);
 }
 response=undefined;const legacy=(await h.query(s,c.id)).value.tools;assert.equal(legacy.length,1);assert.equal(legacy[0].availability,'unknown','visible identity alone does not prove capability availability');
});
