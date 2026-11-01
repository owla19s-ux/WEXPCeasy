import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,appendFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startFoundations} from '../../dist/app/src/index.js';
import {openSqliteStore} from '../../dist/shared/src/index.js';
async function fixture(t,execute){
 const root=await mkdtemp(join(tmpdir(),'wex-app-connections-'));const hosts=[];
 t.after(async()=>{for(const h of hosts)await h.stop();await rm(root,{recursive:true,force:true});});
 await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'connections-root'}));
 const target=join(root,'external-effect.txt'),request={};
 const scope={subject:'user',entry:'conversation',conversation:'c',context:null,resource:'fixture',target,action:'write',relationship:'verified-install',relationshipGeneration:1};
 const trust={current:r=>r===request?{...scope,kind:'conversation',moduleEnabled:true,globalEnabled:true,conversationEnabled:true,sourceAllowed:true}:undefined,canManage:()=>true,canReadHistory:()=>false};
 const adapter={id:'fixture',version:'1',execute:execute??(async(_,path,payload)=>{await appendFile(path,payload.text);return {written:true};})};
 const start=async(extra={})=>{const h=await startFoundations({dataRoot:root,expectedRootId:'connections-root',trust,connections:{adapters:[adapter],shutdownTimeoutMs:10},...extra});hosts.push(h);return h;};
 const setup=h=>{assert.ok(h.connections);h.connections.configs.put({id:'connection',adapter:'fixture',endpoint:'local:fixture',credentialRef:null,enabled:true},0,'create');h.permissions.grant({scope,intent:'grant',expectedRevision:0});};
 const dispatch=h=>h.connections.dispatch('fixture',request,'op','connection',1,target,'intent',{text:'once\n'});
 return {root,target,start,setup,dispatch,scope,request};
}
test('trusted app consumes real configured connections and reopens without replay',async t=>{
 const f=await fixture(t);let h=await f.start();assert.equal(h.status,'ready');f.setup(h);
 assert.equal((await f.dispatch(h)).status,'observed');assert.equal((await h.stop()).status,'stopped');
 h=await f.start();assert.equal(h.status,'ready');assert.equal(h.connections.configs.get('connection').enabled,true);
 assert.equal((await f.dispatch(h)).reason,'already_recorded_no_automatic_retry');
 assert.equal(h.connections.operations.get('op').connection.adapterVersion,'1');assert.equal(await readFile(f.target,'utf8'),'once\n');
});
test('host keeps operation stores and root locked while adapter result is pending',async t=>{
 let release;const wait=new Promise(r=>release=r),f=await fixture(t,async()=>{await wait;return {ok:true};}),h=await f.start();f.setup(h);
 const pending=f.dispatch(h);assert.equal((await h.stop()).status,'incomplete');
 assert.equal((await f.start()).status,'failed');assert.equal((await f.dispatch(h)).reason,'connections_stopping');
 release();assert.equal((await pending).status,'observed');assert.equal((await h.stop()).status,'stopped');
 const reopened=await f.start();assert.equal(reopened.status,'ready');assert.equal(reopened.connections.operations.get('op').phase,'observed');
});
test('unsafe connection store path degrades only optional connections',async t=>{
 const f=await fixture(t),outside=await mkdtemp(join(tmpdir(),'wex-outside-'));t.after(()=>rm(outside,{recursive:true,force:true}));
 const target=join(outside,'store');await writeFile(target,'unchanged');await symlink(target,join(f.root,'connections-configs.sqlite'));
 const h=await f.start();assert.equal(h.status,'degraded');assert.equal(h.connections,undefined);assert.ok(h.permissions);assert.equal(await readFile(target,'utf8'),'unchanged');
 assert.equal(h.diagnostics.some(d=>d.module==='connections'&&d.reason==='initialization_failed'),true);
});
test('corrupt connection data is not replaced by an empty ready module',async t=>{
 const f=await fixture(t),store=openSqliteStore(join(f.root,'connections-configs.sqlite'),'connection-configs');
 store.commit({intent:'corrupt',expectedRevision:0,value:{format:999,items:[]}});store.close();
 const h=await f.start();assert.equal(h.status,'degraded');assert.equal(h.connections,undefined);await h.stop();
 const check=openSqliteStore(join(f.root,'connections-configs.sqlite'),'connection-configs');assert.equal(check.read().value.format,999);check.close();
});
test('connection store close failure retains root lease and retries only unclosed stores',async t=>{
 const f=await fixture(t);let attempts=0,released=0;
 const h=await f.start({lock:{acquire:async()=>({status:'acquired',release:async()=>{released++;}})},openStore:(path,namespace)=>{
  const real=openSqliteStore(path,namespace);return {...real,close(){if(namespace==='connection-operations'&&++attempts===1)throw Error('temporary close failure');real.close();}};
 }});
 assert.equal(h.status,'ready');assert.equal((await h.stop()).status,'incomplete');assert.equal(released,0);
 assert.equal((await h.stop()).status,'stopped');assert.equal(released,1);assert.equal(attempts,2);
});
test('failed initialization retains any unclosed partial stores until stop retry',async t=>{
 const f=await fixture(t);let attempts=0,released=0;
 const h=await f.start({lock:{acquire:async()=>({status:'acquired',release:async()=>{released++;}})},openStore:(path,namespace)=>{
  if(namespace==='connection-operations')throw Error('operation store unavailable');
  const real=openSqliteStore(path,namespace);return {...real,close(){if(namespace==='connection-configs'&&++attempts<=2)throw Error('partial close failure');real.close();}};
 }});
 assert.equal(h.status,'degraded');assert.equal(h.connections,undefined);assert.equal((await h.stop()).status,'incomplete');assert.equal(released,0);
 assert.equal((await h.stop()).status,'stopped');assert.equal(attempts,3);assert.equal(released,1);
});

test('separate app processes persist config, authorization and receipt without replay',async t=>{
 const {spawnSync}=await import('node:child_process');const f=await fixture(t);
 const script=`
 import {appendFile} from 'node:fs/promises';
 import {join} from 'node:path';
 import {startFoundations} from './dist/app/src/index.js';
 const [root,mode]=process.argv.slice(1),request={},target=join(root,'external-effect.txt');
 const scope={subject:'user',entry:'conversation',conversation:'c',context:null,resource:'fixture',target,action:'write',relationship:'verified-install',relationshipGeneration:1};
 const trust={current:r=>r===request?{...scope,kind:'conversation',moduleEnabled:true,globalEnabled:true,conversationEnabled:true,sourceAllowed:true}:undefined,canManage:()=>true,canReadHistory:()=>false};
 const adapter={id:'fixture',version:'1',async execute(_,path,payload){await appendFile(path,payload.text);return {written:true};}};
 const host=await startFoundations({dataRoot:root,expectedRootId:'connections-root',trust,connections:{adapters:[adapter]}});
 try{
  if(mode==='initial'){
   host.connections.configs.put({id:'connection',adapter:'fixture',endpoint:'local:fixture',credentialRef:null,enabled:true},0,'create');
   host.permissions.grant({scope,intent:'grant',expectedRevision:0});
  }
  const result=await host.connections.dispatch('fixture',request,'op','connection',1,target,'intent',{text:'once\\n'});
  console.log(JSON.stringify({status:host.status,result,operation:host.connections.operations.get('op')}));
 }finally{if((await host.stop()).status!=='stopped')process.exitCode=1;}
 `;
 const run=mode=>{const p=spawnSync(process.execPath,['--input-type=module','-e',script,f.root,mode],{encoding:'utf8',timeout:10000});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);};
 assert.equal(run('initial').result.status,'observed');const next=run('restart');
 assert.equal(next.status,'ready');assert.equal(next.result.reason,'already_recorded_no_automatic_retry');
 assert.equal(next.operation.connection.endpoint,'local:fixture');assert.equal(await readFile(f.target,'utf8'),'once\n');
});
