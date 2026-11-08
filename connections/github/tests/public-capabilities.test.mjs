import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
import * as connections from '../../../dist/connections/src/index.js';
import * as github from '../../../dist/connections/github/src/index.js';
const command=process.execPath,expectedSha256=createHash('sha256').update(readFileSync(command)).digest('hex');
const fixturePath=fileURLToPath(new URL('./fixtures/mcp-tools-server.mjs',import.meta.url));
function setup(t,extra={}){
 assert.equal(typeof github.createGitHubMcpCapabilityAdapter,'function','GitHub must implement the public capability adapter');
 const directory=mkdtempSync(join(tmpdir(),'wex-github-public-'));
 const configs=openSqliteStore(join(directory,'configs.sqlite'),'configs'),operations=openSqliteStore(join(directory,'operations.sqlite'),'operations');
 t.after(()=>{configs.close();operations.close();rmSync(directory,{recursive:true,force:true});});
 let allowed=true;
 const permission={evaluate(request){return allowed?{status:'allow',scope:request.scope,revision:1,generation:1}:{status:'deny'};},recheck(request){return this.evaluate(request);}};
 const adapter=github.createGitHubMcpCapabilityAdapter({runtime:{command,expectedSha256,prefixArgs:[fixturePath,'ok']},timeoutMs:5000,resolveCredential:async c=>'token-'+c.id,...extra});
 const service=connections.createConnectionService(permission,configs,operations,[],{capabilityAdapters:[adapter],shutdownTimeoutMs:10000});
 t.after(()=>service.stop());
 const config={id:'one',adapter:'github',endpoint:'https://api.github.com',credentialRef:'ref-one',enabled:true};
 service.configs.put(config,0,'one');
 const request=(target,action)=>({scope:{subject:'user',entry:'conversation',conversation:'c',context:null,resource:'github',target,action,relationship:'direct',relationshipGeneration:1}});
 const invoke=(id,name='get_repository',args={},connectionId='one',revision=service.configs.read().revision)=>service.invoke('github',request(connections.capabilityInvocationTarget('github',connectionId,name,args),'write'),id,connectionId,revision,name,args,'intent');
 return {service,adapter,config,request,invoke,deny(){allowed=false;}};
}
test('Connections discovers real MCP schemas and journals repository PR and Actions results through one port',async t=>{
 const f=setup(t),s=f.service;
 const found=await s.discover('github',f.request(connections.capabilityDiscoveryTarget('github','one'),'read'),'one',1);
 assert.equal(found.status,'ok');assert.deepEqual(found.value.map(t=>t.name),['get_repository','pull_request_read','actions_list']);
 let pid;
 for(const [i,name]of ['get_repository','pull_request_read','actions_list'].entries()){
  assert.equal((await f.invoke('op'+i,name,{nested:{value:i},fail:true})).status,'observed');
  const result=s.operations.get('op'+i).observations[0].value;
  assert.equal(result.isError,true);assert.equal(result.content[0].text,name);
  assert.deepEqual(result.structuredContent.arguments,{nested:{value:i},fail:true});
  if(pid)assert.equal(result.structuredContent.pid,pid);pid=result.structuredContent.pid;
 }
 assert.equal((await f.invoke('op0','get_repository',{nested:{value:0},fail:true})).reason,'already_recorded_no_automatic_retry');
 assert.ok(!JSON.stringify(s.operations.read()).includes('token-one'));
});
test('configured connection instances never share an MCP process',async t=>{
 const f=setup(t),s=f.service;
 s.configs.put({...f.config,id:'two',credentialRef:'ref-two'},1,'two');
 await f.invoke('first');await f.invoke('second','get_repository',{},'two');
 assert.notEqual(s.operations.get('first').observations[0].value.structuredContent.pid,s.operations.get('second').observations[0].value.structuredContent.pid);
});
test('configured credential revision changes replace the old MCP session',async t=>{
 const f=setup(t),s=f.service;
 await f.invoke('first');const before=s.operations.get('first').observations[0].value.structuredContent.pid;
 s.configs.put({...f.config,credentialRef:'ref-next'},1,'rotate');
 await f.invoke('second');
 assert.notEqual(s.operations.get('second').observations[0].value.structuredContent.pid,before);
});
test('revoked capability access prevents credential lookup and tool dispatch',async t=>{
 let calls=0;const f=setup(t,{resolveCredential:async()=>{calls++;return 'fixture-token';}});
 f.deny();assert.equal((await f.invoke('denied')).status,'blocked');assert.equal(calls,0);
 assert.equal(f.service.operations.read().operations.length,0);
});
