import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
test('Space category reference is rechecked after main authorization and before persistence',async t=>{
 const h=await fixture(t),s=await h.open();
 const category=await h.exec(s,{kind:'category.create',intent:'category',name:'Private'});
 assert.equal(category.status,'committed');
 const evaluate=h.permission.evaluate.bind(h.permission),recheck=h.permission.recheck.bind(h.permission);
 let categoryChecked=false,revoked=false;
 h.permission.evaluate=r=>{
  const d=evaluate(r);
  if(d.status==='allow'&&d.scope.action==='category.read'){
   categoryChecked=true;
   if(revoked)return {status:'deny',reason:'category_revoked'};
  }
  return d;
 };
 h.permission.recheck=(r,d)=>{
  if(categoryChecked&&d.scope.action==='space.create')revoked=true;
  return recheck(r,d);
 };
 const result=await h.exec(s,{kind:'space.create',intent:'linked',name:'Space',categoryId:category.id});
 assert.notEqual(result.status,'committed');
 const list=await s.query(h.request('organization.list','root:root'),{kind:'organization',entity:'space'});
 assert.equal(list.status,'ok');assert.deepEqual(list.value,[]);
 await s.close();const reopened=await h.open();
 const restored=await reopened.query(h.request('organization.list','root:root'),{kind:'organization',entity:'space'});
 assert.deepEqual(restored.value,[]);
});
