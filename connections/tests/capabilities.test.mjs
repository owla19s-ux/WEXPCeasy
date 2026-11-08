import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import * as api from '../../dist/connections/src/index.js';
function setup(t,overrides={}){
 const dir=mkdtempSync(join(tmpdir(),'wex-capabilities-'));
 const configs=openSqliteStore(join(dir,'configs.sqlite'),'configs'),operations=openSqliteStore(join(dir,'operations.sqlite'),'operations');
 const facts=new WeakMap();let allowed=true,calls=0,discoveries=0,stops=0;
 const permission={evaluate:r=>allowed&&facts.has(r)?{status:'allow',scope:facts.get(r),revision:1,generation:1}:{status:'deny',reason:'fixture'},
  recheck(r){return this.evaluate(r);}};
 const adapter={id:'fixture',version:'1',async discover(_connection,_signal,access){assert.equal(access.check(),true);discoveries++;return [{name:'any_tool',inputSchema:{type:'object'}}];},
  async invoke(_connection,name,args,access){assert.equal(access.check(),true);calls++;return {content:[],structuredContent:{name,arguments:args},isError:!!args.fail};},
  async stop(){stops++;},...overrides};
 const service=api.createConnectionService(permission,configs,operations,[],{capabilityAdapters:[adapter],shutdownTimeoutMs:20});
 service.configs.put({id:'c',adapter:'fixture',endpoint:'fixture:server',credentialRef:null,enabled:true},0,'create');
 t.after(async()=>{await service.stop();configs.close();operations.close();rmSync(dir,{recursive:true,force:true});});
 function request(action,target){const r={};facts.set(r,{subject:'user',entry:'native',conversation:null,context:null,resource:'fixture',target,action,relationship:'direct',relationshipGeneration:1});return r;}
 return {service,request,revoke:()=>{allowed=false;},counts:()=>({calls,discoveries,stops})};
}
test('public capability discovery is authorized and denied requests reveal no connection state',async t=>{
 const h=setup(t);
 assert.equal(typeof h.service.discover,'function');
 assert.equal((await h.service.discover('fixture',{},'missing',99)).status,'denied');
 assert.deepEqual(h.counts(),{calls:0,discoveries:0,stops:0});
 const r=h.request('read',api.connectionToolsTarget('c'));
 const result=await h.service.discover('fixture',r,'c',1);
 assert.equal(result.status,'ok');assert.equal(result.value[0].name,'any_tool');
});
test('generic invocation binds arguments and preserves tool errors in the existing ledger',async t=>{
 const h=setup(t),args={repo:'repo',nested:{a:1,b:false},fail:true};
 const r=h.request('write',api.connectionToolTarget('c','any_tool',args));
 assert.equal((await h.service.invoke('fixture',r,'op','c',1,'any_tool',args,'intent')).status,'observed');
 const op=h.service.operations.get('op');
 assert.equal(op.connection.connectionId,'c');assert.equal(op.attempts,1);
 assert.deepEqual(op.observations[0].value,{content:[],structuredContent:{name:'any_tool',arguments:args},isError:true});
 assert.equal((await h.service.invoke('fixture',r,'op','c',1,'any_tool',args,'intent')).reason,'already_recorded_no_automatic_retry');
 assert.equal((await h.service.invoke('fixture',r,'other','c',1,'any_tool',{...args,repo:'other'},'intent')).status,'blocked');
 assert.equal(h.counts().calls,1);
 assert.equal(h.service.operations.prepare,undefined);
});
test('capability target is canonical but distinguishes every argument and connection',()=>{
 assert.equal(api.connectionToolTarget('c','tool',{a:1,b:2}),api.connectionToolTarget('c','tool',{b:2,a:1}));
 assert.notEqual(api.connectionToolTarget('c','tool',{a:1}),api.connectionToolTarget('other','tool',{a:1}));
 assert.throws(()=>api.connectionToolTarget('c','tool',{value:NaN}));
});
test('discovery refuses configuration changes and revocation during an admitted read',async t=>{
 for(const revoke of [true,false]){
  let h;
  h=setup(t,{async discover(){if(revoke)h.revoke();else h.service.configs.remove('c',1,'remove');return [{name:'secret'}];}});
  const result=await h.service.discover('fixture',h.request('read',api.connectionToolsTarget('c')),'c',1);
  assert.notEqual(result.status,'ok');
 }
});
test('failed tool calls remain unknown and cannot be replayed',async t=>{
 const h=setup(t,{async invoke(){throw Error('secret server failure');}}),args={};
 const r=h.request('write',api.connectionToolTarget('c','tool',args));
 const result=await h.service.invoke('fixture',r,'op','c',1,'tool',args,'intent');
 assert.equal(result.status,'unknown');assert.equal(h.service.operations.get('op').phase,'unknown');
 assert.ok(!JSON.stringify(result).includes('secret'));
 assert.equal((await h.service.invoke('fixture',r,'op','c',1,'tool',args,'intent')).reason,'already_recorded_no_automatic_retry');
});
test('service drains invocation receipts before stopping capability adapters',async t=>{
 let enter,finish;const entered=new Promise(r=>enter=r),wait=new Promise(r=>finish=r);
 const h=setup(t,{async invoke(){enter();await wait;return {content:[]};}});
 const r=h.request('write',api.connectionToolTarget('c','tool',{}));
 const pending=h.service.invoke('fixture',r,'op','c',1,'tool',{},'intent');await entered;
 assert.equal((await h.service.stop()).status,'incomplete');assert.equal(h.counts().stops,0);
 finish();assert.equal((await pending).status,'observed');assert.equal((await h.service.stop()).status,'stopped');
 assert.equal(h.counts().stops,1);
 assert.equal((await h.service.discover('fixture',r,'c',1)).reason,'connections_stopping');
});
test('capability shutdown failures keep service incomplete until release is confirmed',async t=>{
 let attempts=0;const h=setup(t,{async stop(){if(++attempts===1)throw Error('release failed');}});
 assert.equal((await h.service.stop()).status,'incomplete');assert.equal((await h.service.stop()).status,'stopped');
});
