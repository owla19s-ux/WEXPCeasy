import test from 'node:test';
import assert from 'node:assert/strict';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {createReadBoundary,createConnectionService} from '../../dist/connections/src/index.js';
function access(target,action){
 const request={};let allowed=true;
 const scope={subject:'user',entry:'conversation',conversation:'chat',context:null,resource:'fixture',action,target,relationship:'direct',relationshipGeneration:1};
 const permission={evaluate(r){return r===request&&allowed?{status:'allow',revision:1,generation:1,scope}:{status:'deny',reason:'revoked'};},recheck(r){return this.evaluate(r);}};
 return {request,permission,revoke(){allowed=false;}};
}
test('read adapter receives original request and an expiring current permission check',async()=>{
 const h=access('item','read');let retained;
 const reader=createReadBoundary(h.permission,{id:'fixture',async read(target,signal,context){
  assert.ok(context,'trusted access context must be supplied');
  assert.equal(context.request,h.request);assert.equal(Object.isFrozen(context),true);
  assert.equal(context.check(),true);retained=context;h.revoke();assert.equal(context.check(),false);
  return 'private';
 }});
 assert.equal((await reader.read(h.request,'item')).status,'denied');
 assert.ok(retained);assert.equal(retained.check(),false);
});
test('configured dispatch access check tracks permission and expires after adapter return',async()=>{
 const h=access('item','write'),cs=openSqliteStore(':memory:','configs'),os=openSqliteStore(':memory:','operations');let retained;
 try{
  const adapter={id:'fixture',version:'1',async execute(connection,target,payload,context){
   assert.ok(context,'trusted access context must be supplied');assert.equal(context.request,h.request);
   assert.equal(context.check(),true);retained=context;h.revoke();assert.equal(context.check(),false);return {status:'rejected'};
  }};
  const s=createConnectionService(h.permission,cs,os,[adapter]);
  s.configs.put({id:'c',adapter:'fixture',endpoint:'local:fixture',credentialRef:null,enabled:true},0,'create');
  assert.equal((await s.dispatch('fixture',h.request,'op','c',1,'item','intent',{})).status,'observed');
  assert.ok(retained);assert.equal(retained.check(),false);await s.stop();
 }finally{cs.close();os.close();}
});
test('configured adapter recheck sees configuration changes during asynchronous preflight',async()=>{
 const h=access('item','write'),cs=openSqliteStore(':memory:','configs'),os=openSqliteStore(':memory:','operations');let s,checked;
 const config={id:'c',adapter:'fixture',endpoint:'local:fixture',credentialRef:null,enabled:true};
 try{
  s=createConnectionService(h.permission,cs,os,[{id:'fixture',version:'1',async execute(connection,target,payload,context){
   assert.ok(context,'trusted access context must be supplied');
   assert.equal(context.check(),true);await Promise.resolve();
   assert.equal(s.configs.put({...config,enabled:false},1,'disable').status,'ok');
   checked=context.check();return {status:'rejected'};
  }}]);s.configs.put(config,0,'create');
  assert.equal((await s.dispatch('fixture',h.request,'op','c',1,'item','intent',{})).status,'observed');
  assert.equal(checked,false);await s.stop();
 }finally{cs.close();os.close();}
});
