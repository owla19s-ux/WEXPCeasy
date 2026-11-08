import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
for(const kind of ['space.create','space.edit']){
 for(const at of [1,2]){
  test(kind+' rechecks category access '+(at===1?'before preparation':'after preparation')+' without applying the reference',async t=>{
   const h=await fixture(t),s=await h.open();
   const category=await h.exec(s,{kind:'category.create',intent:'category',name:'Private'});
   const existing=kind==='space.edit'?await h.exec(s,{kind:'space.create',intent:'existing',name:'Original'}):undefined;
   assert.equal(category.status,'committed');
   const evaluate=h.permission.evaluate.bind(h.permission),recheck=h.permission.recheck.bind(h.permission);
   let categoryChecked=false,revoked=false,checks=0;
   h.permission.evaluate=r=>{
    const d=evaluate(r);
    if(d.status==='allow'&&d.scope.action==='category.read'){
     categoryChecked=true;if(revoked)return {status:'deny',reason:'category_revoked'};
    }
    return d;
   };
   h.permission.recheck=(r,d)=>{
    if(categoryChecked&&d.scope.action===kind&&++checks===at)revoked=true;
    return recheck(r,d);
   };
   const command={kind,intent:'linked',name:'Changed',categoryId:category.id,...(existing?{id:existing.id,expectedRevision:1}:{})};
   const result=await h.exec(s,command);
   assert.notEqual(result.status,'committed');
   const read=service=>service.query(h.request('organization.list','root:root'),{kind:'organization',entity:'space'});
   const expected=existing?[[existing.id,'Original',null,1]]:[];
   const project=q=>q.value.map(x=>[x.id,x.name,x.categoryId,x.revision]);
   assert.deepEqual(project(await read(s)),expected);
   await s.close();const reopened=await h.open();
   assert.deepEqual(project(await read(reopened)),expected);
  });
 }
}
test('category visibility is required to replay an original Space receipt after restart',async t=>{
 const h=await fixture(t),s=await h.open();
 const category=await h.exec(s,{kind:'category.create',intent:'category',name:'Private'});
 const command={kind:'space.create',intent:'linked',name:'Space',categoryId:category.id};
 const original=await h.exec(s,command);assert.equal(original.status,'committed');
 await s.close();const reopened=await h.open();
 assert.deepEqual(await h.exec(reopened,command),original);
 const evaluate=h.permission.evaluate.bind(h.permission);
 h.permission.evaluate=r=>{const d=evaluate(r);return d.status==='allow'&&d.scope.action==='category.read'?{status:'deny',reason:'revoked'}:d;};
 assert.equal((await h.exec(reopened,command)).status,'rejected');
});
