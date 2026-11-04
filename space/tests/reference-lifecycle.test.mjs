import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';

test('API and Role replacements retain relation IDs and survive restart without revising unrelated objects',async t=>{
 let online=true;
 const h=await fixture(t,{owner:{async resolve(_request,target){return online?{status:'available',...target,sourceRevision:'v2',observedAt:'2026-11-05T00:00:00Z'}:{status:'unavailable'};}}});
 const s=await h.open(),c=await h.create(s);
 const api=await h.exec(s,{kind:'association.add',contextId:c.id,intent:'api',owner:'connections/api',targetType:'api',targetId:'api-1',purpose:'model'});
 const role=await h.exec(s,{kind:'association.add',contextId:c.id,intent:'role',owner:'AI',targetType:'role',targetId:'role-1',purpose:'assistant'});
 assert.equal(api.status,'committed');assert.equal(role.status,'committed');
 const replace={kind:'association.replace',contextId:c.id,id:api.id,expectedRevision:1,intent:'replace-api',owner:'connections/api',targetType:'api',targetId:'api-2',purpose:'model'};
 const result=await h.exec(s,replace);assert.deepEqual(result,{status:'committed',id:api.id,revision:2});
 const before=(await h.query(s,c.id)).value;
 assert.equal(before.revision,1);assert.equal(before.associations.find(x=>x.id===role.id).revision,1);
 await s.close();const reopened=await h.open();online=false;
 assert.deepEqual(await h.exec(reopened,replace),result,'confirmed replay does not need an online owner');online=true;
 const restored=(await h.query(reopened,c.id)).value;
 assert.deepEqual(restored.associations.map(x=>[x.id,x.revision,x.targetId]),[[api.id,2,'api-2'],[role.id,1,'role-1']]);
 const changedRole=await h.exec(reopened,{kind:'association.replace',contextId:c.id,id:role.id,expectedRevision:1,intent:'replace-role',owner:'AI',targetType:'role',targetId:'role-2',purpose:'assistant'});
 assert.deepEqual(changedRole,{status:'committed',id:role.id,revision:2});
 await reopened.close();const finalService=await h.open();
 assert.deepEqual((await h.query(finalService,c.id)).value.associations.map(x=>[x.id,x.revision,x.targetId]),[[api.id,2,'api-2'],[role.id,2,'role-2']]);
 assert.equal((await h.exec(finalService,{kind:'association.remove',contextId:c.id,id:api.id,expectedRevision:2,intent:'remove-api'})).status,'committed');
 const final=(await h.query(finalService,c.id)).value;
 assert.equal(final.id,c.id);assert.equal(final.revision,1);assert.deepEqual(final.associations.map(x=>[x.id,x.revision,x.targetId]),[[role.id,2,'role-2']]);
});
