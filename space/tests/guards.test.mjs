import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';

test('tool selections reject role, Agent and API identities before persisting them',async t=>{
 const h=await fixture(t,{owner:{async resolve(_r,target){return {status:'available',...target,sourceRevision:'1',observedAt:'2026-11-05T00:00:00Z'};}}});
 const s=await h.open(),c=await h.create(s);
 for(const [owner,targetType] of [['AI','role'],['AI','agent'],['connections/api','api'],['connections/api','model']]){
  const result=await h.exec(s,{kind:'tool.add',intent:targetType,contextId:c.id,owner,targetType,targetId:'selected',purpose:'test'});
  assert.deepEqual(result,{status:'rejected',reason:'unsupported_target'});
 }
 assert.deepEqual((await h.query(s,c.id)).value.tools,[]);
 await s.close();const reopened=await h.open();assert.deepEqual((await h.query(reopened,c.id)).value.tools,[]);
});

test('category create and rename reject unresolved duplicate names without changing revisions',async t=>{
 const h=await fixture(t),s=await h.open();
 const a=await h.exec(s,{kind:'category.create',intent:'a',name:'个人'});
 const b=await h.exec(s,{kind:'category.create',intent:'b',name:'公开'});
 assert.deepEqual(await h.exec(s,{kind:'category.create',intent:'duplicate',name:'个人'}),{status:'rejected',reason:'duplicate_category_name_unsupported'});
 assert.deepEqual(await h.exec(s,{kind:'category.edit',intent:'rename',id:b.id,expectedRevision:1,name:'个人'}),{status:'rejected',reason:'duplicate_category_name_unsupported'});
 assert.deepEqual(await h.exec(s,{kind:'category.create',intent:'a',name:'个人'}),a);
 assert.equal((await h.exec(s,{kind:'category.edit',intent:'same-name',id:a.id,expectedRevision:1,name:'个人'})).status,'committed');
 const q=await s.query(h.request('organization.list','root:root'),{kind:'organization',entity:'category'});
 assert.deepEqual(q.value.map(x=>[x.id,x.name,x.revision]),[[a.id,'个人',2],[b.id,'公开',1]]);
});

test('organization query rechecks earlier object permissions after later projections',async t=>{
 const h=await fixture(t),s=await h.open();
 const a=await h.exec(s,{kind:'space.create',intent:'a',name:'private A'});
 const b=await h.exec(s,{kind:'space.create',intent:'b',name:'public B'});await s.close();
 let revoked=false;const evaluate=h.permission.evaluate.bind(h.permission);
 h.permission.evaluate=r=>{const d=evaluate(r);return revoked&&d.status==='allow'&&d.scope.target===`space:${a.id}`?{status:'deny',reason:'revoked'}:d;};
 const reopened=await h.open({deriveRequest(parent,scope){if(scope.target===`space:${b.id}`)revoked=true;return h.request(scope.action,scope.target,scope.context);}});
 const q=await reopened.query(h.request('organization.list','root:root'),{kind:'organization',entity:'space'});
 assert.equal(q.status,'ok');assert.deepEqual(q.value.map(x=>x.name),['public B']);
});

test('organization query redacts a category revoked while projecting a later Space',async t=>{
 const h=await fixture(t),s=await h.open();
 const cat=await h.exec(s,{kind:'category.create',intent:'cat',name:'private category'});
 await h.exec(s,{kind:'space.create',intent:'a',name:'A',categoryId:cat.id});
 const b=await h.exec(s,{kind:'space.create',intent:'b',name:'B'});await s.close();
 let revoked=false;const evaluate=h.permission.evaluate.bind(h.permission);
 h.permission.evaluate=r=>{const d=evaluate(r);return revoked&&d.status==='allow'&&d.scope.target===`category:${cat.id}`?{status:'deny',reason:'revoked'}:d;};
 const reopened=await h.open({deriveRequest(parent,scope){if(scope.target===`space:${b.id}`)revoked=true;return h.request(scope.action,scope.target,scope.context);}});
 const q=await reopened.query(h.request('organization.list','root:root'),{kind:'organization',entity:'space'});
 assert.equal(q.status,'ok');assert.deepEqual(q.value.map(x=>[x.name,x.categoryId]),[['A',null],['B',null]]);
});
