import test from 'node:test';
import assert from 'node:assert/strict';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import * as connections from '../../dist/connections/src/index.js';
const config={id:'c',adapter:'fixture',endpoint:'fixture:remote',credentialRef:'reference',enabled:true};
function fixture(t,adapter,options={}){
 const cs=openSqliteStore(':memory:','configs'),os=openSqliteStore(':memory:','operations'),request={};
 const scope={subject:'user',entry:'conversation',conversation:'chat',context:null,resource:'fixture',action:'read',target:'item',relationship:'direct',relationshipGeneration:1};
 const permission={evaluate:r=>r===request?{status:'allow',revision:1,generation:1,scope}:{status:'deny',reason:'not_granted'},recheck(r){return this.evaluate(r);}};
 const service=connections.createConnectionService(permission,cs,os,[],{readAdapters:[adapter],shutdownTimeoutMs:5,...options});
 service.configs.put(config,0,'create');
 t.after(async()=>{await service.stop();cs.close();os.close();});
 return {service,permission,request,read:()=>service.read('fixture',request,'c',1,'item')};
}
test('configured read denies before probing whether a connection exists',async()=>{
 assert.equal(typeof connections.createConfiguredReadBoundary,'function');let reads=0;
 const permission={evaluate:()=>({status:'deny',reason:'not_granted'}),recheck:()=>({status:'deny',reason:'not_granted'})};
 const boundary=connections.createConfiguredReadBoundary(permission,{read(){reads++;throw Error('must not inspect');}},{id:'fixture',version:'1',async read(){throw Error('must not fetch');}});
 assert.equal((await boundary.read({},'missing',1,'item')).status,'denied');assert.equal(reads,0);
});
test('configured read withholds data if connection is disabled during async preflight',async t=>{
 let h,checked;
 h=fixture(t,{id:'fixture',version:'1',async read(c,target,signal,access){
  assert.deepEqual(c,config);assert.equal(access.request,h.request);assert.equal(access.check(),true);await Promise.resolve();
  h.service.configs.put({...config,enabled:false},1,'disable');checked=access.check();return 'private';
 }});
 const result=await h.read();assert.equal(checked,false);assert.equal(result.status,'denied');assert.equal('value'in result,false);
});
test('configured read is tracked during shutdown and a stale connection revision never reaches adapter',async t=>{
 let release,entered,calls=0;
 const gate=new Promise(r=>release=r),arrived=new Promise(r=>entered=r);
 const h=fixture(t,{id:'fixture',version:'1',async read(){calls++;entered();await gate;return 'visible';}});
 assert.equal(typeof h.service.read,'function');
 assert.equal((await h.service.read('fixture',h.request,'c',2,'item')).status,'unavailable');assert.equal(calls,0);
 const pending=h.read();await arrived;
 assert.equal((await h.service.stop()).status,'incomplete');
 assert.equal((await h.read()).status,'unavailable');release();
 assert.deepEqual(await pending,{status:'ok',value:'visible'});assert.equal(calls,1);assert.equal((await h.service.stop()).status,'stopped');
});
