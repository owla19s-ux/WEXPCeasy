import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
import * as connections from '../../../dist/connections/src/index.js';
import * as github from '../../../dist/connections/github/src/index.js';
const fixture=fileURLToPath(new URL('./fixtures/mcp-generic-server.mjs',import.meta.url));
const runtime={command:process.execPath,expectedSha256:createHash('sha256').update(readFileSync(process.execPath)).digest('hex'),prefixArgs:[fixture,'ok']};
test('public Connections uses one MCP process across separate authorization leases',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'wex-mcp-port-'));
 const config=openSqliteStore(join(dir,'configs.sqlite'),'configs'),operations=openSqliteStore(join(dir,'operations.sqlite'),'operations');
 const facts=new WeakMap();let credentials=0,valid=true;
 const permission={evaluate:r=>facts.has(r)?{status:'allow',scope:facts.get(r),revision:1,generation:1}:{status:'deny'},recheck(r){return this.evaluate(r);}};
 const adapter=github.createGitHubMcpConnectionAdapter({runtime,timeoutMs:5000,resolveCredential:async(_c,access)=>{assert.equal(access.check(),true);credentials++;return valid?'fixture-token':undefined;}});
 const service=connections.createConnectionService(permission,config,operations,[],{capabilityAdapters:[adapter]});
 t.after(async()=>{await service.stop();config.close();operations.close();rmSync(dir,{recursive:true,force:true});});
 function request(action,target){const r={};facts.set(r,{subject:'u',entry:'native',conversation:null,context:null,resource:'github',action,target,relationship:'session',relationshipGeneration:1});return r;}
 service.configs.put({id:'gh',adapter:'github',endpoint:'https://api.github.com',credentialRef:'fixture-ref',enabled:true},0,'create');
 assert.equal((await service.discover('github',{},'gh',1)).status,'denied');assert.equal(credentials,0);
 const catalog=await service.discover('github',request('read',connections.connectionToolsTarget('gh')),'gh',1);
 assert.equal(catalog.status,'ok');assert.deepEqual(catalog.value.map(t=>t.name),['get_file_contents','pull_request_read','actions_list']);
 const pids=[];
 for(const [index,name] of ['get_file_contents','pull_request_read','actions_list'].entries()){
  const args={repo:'repo',nested:{sequence:index}};
  const r=request('write',connections.connectionToolTarget('gh',name,args));
  const result=await service.invoke('github',r,'op'+index,'gh',1,name,args,'intent'+index);
  assert.equal(result.status,'observed');
  const value=service.operations.get('op'+index).observations[0].value;
  assert.deepEqual(value.structuredContent.arguments,args);pids.push(value.structuredContent.pid);
 }
 assert.equal(new Set(pids).size,1);assert.equal(credentials,4);
 valid=false;
 const args={},r=request('write',connections.connectionToolTarget('gh','actions_list',args));
 assert.equal((await service.invoke('github',r,'revoked','gh',1,'actions_list',args,'revoked')).status,'unknown');
 assert.equal(service.operations.get('revoked').phase,'unknown');
 assert.equal((await service.invoke('github',r,'revoked','gh',1,'actions_list',args,'revoked')).reason,'already_recorded_no_automatic_retry');
});
