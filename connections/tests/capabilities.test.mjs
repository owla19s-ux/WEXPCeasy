import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import * as api from '../../dist/connections/src/index.js';
function fixture(t,overrides={}){
 const dir=mkdtempSync(join(tmpdir(),'wex-capabilities-'));
 const configs=openSqliteStore(join(dir,'configs.sqlite'),'configs'),operations=openSqliteStore(join(dir,'operations.sqlite'),'operations');
 t.after(()=>{configs.close();operations.close();rmSync(dir,{recursive:true,force:true});});
 let allowed=true,reads=0;
 const permission={evaluate(request){return allowed?{status:'allow',scope:request.scope,revision:1,generation:1}:{status:'deny'};},recheck(request){return this.evaluate(request);}};
 const scope=(target,action)=>({scope:{subject:'user',entry:'conversation',conversation:'c',context:null,resource:'fixture',target,action,relationship:'direct',relationshipGeneration:1}});
 const adapter={id:'fixture',version:'1',async discover(c,signal,access){assert.equal(access.check(),true);return [{name:'tool',inputSchema:{type:'object'}}];},
  async invoke(c,name,args,signal,access){assert.equal(access.check(),true);return {content:[{type:'text',text:name}],structuredContent:args,isError:true};},
  async stop(){},...overrides};
 const configStore={read(){reads++;return configs.read();},commit:value=>configs.commit(value)};
 const create=()=>api.createConnectionService(permission,configStore,operations,[],{capabilityAdapters:[adapter],shutdownTimeoutMs:30});
 const service=create();
 service.configs.put({id:'c',adapter:'fixture',endpoint:'fixture:original',credentialRef:null,enabled:true},0,'config');
 const discover=()=>{assert.equal(typeof service.discover,'function','Connections must expose discover');return service.discover('fixture',scope(api.capabilityDiscoveryTarget('fixture','c'),'read'),'c',1);};
 const invoke=(id='op',args={value:1},signal)=>{assert.equal(typeof service.invoke,'function','Connections must expose invoke');return service.invoke('fixture',scope(api.capabilityInvocationTarget('fixture','c','tool',args),'write'),id,'c',1,'tool',args,'intent',signal);};
 return {service,adapter,create,configs,operations,scope,discover,invoke,deny(){allowed=false;},resetReads(){reads=0;},get reads(){return reads;}};
}
test('public capability targets bind connection, tool and canonical full arguments',()=>{
 assert.equal(typeof api.capabilityInvocationTarget,'function','public invocation target required');
 const a=api.capabilityInvocationTarget('fixture','one','tool',{b:2,a:1});
 assert.equal(a,api.capabilityInvocationTarget('fixture','one','tool',{a:1,b:2}));
 for(const value of [
  api.capabilityInvocationTarget('fixture','two','tool',{a:1,b:2}),
  api.capabilityInvocationTarget('fixture','one','other',{a:1,b:2}),
  api.capabilityInvocationTarget('fixture','one','tool',{a:2,b:2})
 ])assert.notEqual(a,value);
 assert.throws(()=>api.capabilityInvocationTarget('fixture','one','tool',{bad:NaN}));
 assert.throws(()=>api.capabilityInvocationTarget('fixture','one','tool',[]));
});
test('discover uses configured read authorization and invoke reuses the existing Operation ledger',async t=>{
 const f=fixture(t);t.after(()=>f.service.stop());
 assert.equal((await f.discover()).status,'ok');
 assert.equal(f.service.operations.read().operations.length,0);
 assert.equal((await f.invoke()).status,'observed');
 const op=f.service.operations.get('op');
 assert.equal(op.connection.connectionId,'c');assert.equal(op.connection.adapterVersion,'1');
 assert.deepEqual(op.observations[0].value,{content:[{type:'text',text:'tool'}],structuredContent:{value:1},isError:true});
 assert.equal(op.attempts,1);
 assert.equal((await f.invoke()).reason,'already_recorded_no_automatic_retry');
 assert.equal((await f.invoke('op',{value:2})).reason,'intent_conflict');
});
test('discovery denies authority before inspecting connection configuration',async t=>{
 const f=fixture(t);t.after(()=>f.service.stop());f.deny();f.resetReads();
 assert.equal((await f.discover()).status,'denied');assert.equal(f.reads,0);
 assert.equal((await f.invoke()).status,'blocked');assert.equal(f.reads,0);
});
test('tool annotations and a catalogue read grant cannot authorize execution',async t=>{
 let calls=0;
 const f=fixture(t,{async invoke(){calls++;return null;}});t.after(()=>f.service.stop());
 assert.equal(typeof f.service.invoke,'function');
 const args={value:1};
 const denied=await f.service.invoke('fixture',f.scope(api.capabilityInvocationTarget('fixture','c','tool',args),'read'),'op','c',1,'tool',args,'intent');
 assert.equal(denied.status,'blocked');assert.equal(calls,0);
 assert.equal(f.service.operations.read().operations.length,0);
});
test('retargeting arguments or connection does not reuse a trusted invocation grant',async t=>{
 let calls=0;const f=fixture(t,{async invoke(){calls++;return null;}});t.after(()=>f.service.stop());
 assert.equal(typeof f.service.invoke,'function');
 const request=f.scope(api.capabilityInvocationTarget('fixture','c','tool',{value:1}),'write');
 assert.equal((await f.service.invoke('fixture',request,'op','c',1,'tool',{value:2},'intent')).reason,'scope_mismatch');
 assert.equal((await f.service.invoke('fixture',request,'op','different',1,'tool',{value:1},'intent')).reason,'scope_mismatch');
 assert.equal(calls,0);
});
test('stale configuration blocks generic invocation and no Operation is created',async t=>{
 const f=fixture(t);t.after(()=>f.service.stop());
 f.service.configs.put({...f.service.configs.get('c'),enabled:false},1,'disable');
 assert.equal((await f.invoke()).reason,'config_revision_conflict');
 assert.equal(f.service.operations.read().operations.length,0);
});
test('protocol failures remain unknown across service restart without replay',async t=>{
 let calls=0;const f=fixture(t,{async invoke(){calls++;throw Error('private-remote-detail');}});t.after(()=>f.service.stop());
 assert.equal((await f.invoke()).status,'unknown');
 assert.equal(f.service.operations.get('op').phase,'unknown');
 await f.service.stop();
 const next=f.create();t.after(()=>next.stop());
 const result=await next.invoke('fixture',f.scope(api.capabilityInvocationTarget('fixture','c','tool',{value:1}),'write'),'op','c',1,'tool',{value:1},'intent');
 assert.equal(result.reason,'already_recorded_no_automatic_retry');assert.equal(calls,1);
 assert.ok(!JSON.stringify(next.operations.get('op')).includes('private-remote-detail'));
});
test('pre-cancelled generic invocation never reserves an Operation',async t=>{
 const f=fixture(t);t.after(()=>f.service.stop());const cancel=new AbortController();cancel.abort();
 assert.equal((await f.invoke('op',{value:1},cancel.signal)).status,'blocked');
 assert.equal(f.service.operations.read().operations.length,0);
});
test('shutdown aborts generic calls, persists unknown and waits for adapter cleanup',async t=>{
 let entered;const ready=new Promise(r=>entered=r);
 const f=fixture(t,{async invoke(c,name,args,signal){entered();await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}));return null;}});
 const running=f.invoke();await ready;
 assert.equal((await f.service.stop()).status,'stopped');
 assert.equal((await running).status,'unknown');
 assert.equal(api.createOperationLedger(f.operations).get('op').phase,'unknown');
 assert.equal((await f.invoke('after')).reason,'connections_stopping');
});
test('failed capability cleanup is incomplete and can be retried',async t=>{
 let attempts=0;const f=fixture(t,{async stop(){if(++attempts===1)throw Error('not_released');}});
 assert.equal((await f.service.stop()).status,'incomplete');
 assert.equal((await f.service.stop()).status,'stopped');assert.equal(attempts,2);
});

test('adapter version changes during discovery invalidate the captured configuration',async t=>{
 let f;
 f=fixture(t,{async discover(){f.adapter.version='changed';return [{name:'stale'}];}});
 t.after(()=>f.service.stop());
 assert.equal((await f.discover()).status,'denied');
});
test('revocation during a generic tool call cannot be journaled as an observed result',async t=>{
 let f;
 f=fixture(t,{async invoke(){f.deny();return {privateResult:'stale'};}});
 t.after(()=>f.service.stop());
 assert.equal((await f.invoke()).status,'unknown');
 assert.equal(f.service.operations.get('op').phase,'unknown');
});
