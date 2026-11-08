import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {randomBytes,createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import {startFoundations} from '../../dist/app/src/index.js';
import {githubFileTarget,githubCredentialRef} from '../../dist/connections/github/src/index.js';
const file={owner:'owner',repo:'repo',ref:'a'.repeat(40),path:'file.txt'},target=githubFileTarget(file);
const body=()=>new Response(JSON.stringify({type:'file',path:file.path,sha:'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0',encoding:'base64',content:'aGVsbG8=',size:5}),{status:200,headers:{'content-type':'application/json'}});
async function setup(t,githubOfficial,extra={}){
 const root=await mkdtemp(join(tmpdir(),'wex-github-host-'));
 await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 const key=randomBytes(32),counts={unseal:0};
 const cipher={available:()=>true,seal(value){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);
  const bytes=Buffer.concat([c.update(value,'utf8'),c.final()]);return Buffer.concat([iv,bytes,c.getAuthTag()]).toString('base64');},
 unseal(value){counts.unseal++;const b=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(-16));
  return Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString('utf8');}};
 const facts=new WeakMap(),approved=new WeakSet(),history={},requests=new Map();let host,n=0;
 const identity={subject:'user',entry:'native-fixture',conversation:null,relationship:'session',relationshipGeneration:1,
  kind:'local',entryEnabled:true,moduleEnabled:true,globalEnabled:true,sourceAllowed:true,conversationEnabled:false};
 const options={dataRoot:root,credentials:{cipher},githubOfficial,trust:{current:r=>facts.get(r),canManage:c=>approved.has(c),canReadHistory:r=>r===history},...extra};
 host=await startFoundations(options);
 t.after(async()=>{await host.stop();await rm(root,{recursive:true,force:true});});
 function request(resource,action,permissionTarget){
  const k=JSON.stringify([resource,action,permissionTarget]);if(requests.has(k))return requests.get(k);
  const r={},scope={subject:identity.subject,entry:identity.entry,conversation:null,context:null,resource,action,target:permissionTarget,relationship:'session',relationshipGeneration:1};
  facts.set(r,{...identity,...scope});requests.set(k,r);
  const change={intent:'grant-'+(++n),expectedRevision:host.permissions.history(history).revision,scope};approved.add(change);
  assert.equal(host.permissions.grant(change).status,'committed');return r;
 }
 function save(secret='fixture-token',expectedRevision=0,binding={connectionId:'gh',endpoint:'https://api.github.com',provider:'github'}){
  return host.credentials.put(request('credentials','credential.write','credential:key-a'),{id:'key-a',intent:'save-'+(++n),expectedRevision,binding,secret});
 }
 const config=(revision=1,id='gh')=>({id,adapter:'github',endpoint:'https://api.github.com',credentialRef:githubCredentialRef({id:'key-a',revision}),enabled:true});
 return {root,options,counts,request,save,config,
  revoke(resource,action,permissionTarget){
   const r=request(resource,action,permissionTarget),f=facts.get(r);
   const scope={subject:f.subject,entry:f.entry,conversation:f.conversation,context:f.context,resource:f.resource,action:f.action,target:f.target,relationship:f.relationship,relationshipGeneration:f.relationshipGeneration};
   const change={intent:'revoke-'+(++n),expectedRevision:host.permissions.history(history).revision,scope};approved.add(change);
   assert.equal(host.permissions.revoke(change).status,'committed');
  },get host(){return host;},
  async reopen(){assert.equal((await host.stop()).status,'stopped');host=await startFoundations(options);assert.equal(host.status,'ready');return host;}};
}
test('official GitHub host requires credential custody and never falls back to unbound credentials',async t=>{
 const root=await mkdtemp(join(tmpdir(),'wex-github-no-vault-'));await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 const host=await startFoundations({dataRoot:root,trust:{current:()=>undefined,canManage:()=>false,canReadHistory:()=>false},githubOfficial:{}});
 t.after(async()=>{await host.stop();await rm(root,{recursive:true,force:true});});
 assert.equal(host.status,'degraded');assert.equal(host.connections,undefined);
 assert.ok(host.diagnostics.some(d=>d.module==='connections'));
});
test('official GitHub host consumes the encrypted vault and restores config and grants after restart',async t=>{
 let calls=0;
 const h=await setup(t,{fetch:async(_url,init)=>{calls++;assert.equal(new Headers(init.headers).get('authorization'),'token fixture-token');return body();}});
 assert.equal(h.host.status,'ready');assert.ok(h.host.connections);assert.equal('resolve'in h.host.credentials,false);
 assert.equal(h.save().status,'committed');assert.equal(h.host.connections.configs.put(h.config(),0,'config').status,'ok');
 assert.equal((await h.host.connections.read('github',{},'gh',1,target)).status,'denied');assert.equal(calls,0);
 const r=h.request('github','read',target);
 assert.equal((await h.host.connections.read('github',r,'gh',1,target)).value.content,'hello');assert.equal(calls,1);
 assert.ok(!JSON.stringify(h.host.connections.configs.read()).includes('fixture-token'));
 const old=h.host.connections;await h.reopen();
 assert.equal((await old.read('github',r,'gh',1,target)).status,'unavailable');
 assert.equal((await h.host.connections.read('github',r,'gh',1,target)).value.content,'hello');assert.equal(calls,2);
 await h.host.stop();assert.equal((await readFile(join(h.root,'wex-credentials.sqlite'))).includes(Buffer.from('fixture-token')),false);
});
test('official GitHub host rejects stale key revisions cross-connection reuse and revoked keys',async t=>{
 let calls=0,secret='fixture-token';
 const h=await setup(t,{fetch:async(_url,init)=>{calls++;assert.equal(new Headers(init.headers).get('authorization'),'token '+secret);return body();}});
 assert.equal(h.save().status,'committed');assert.equal(h.host.connections.configs.put(h.config(),0,'config').status,'ok');
 const r=h.request('github','read',target);
 assert.equal((await h.host.connections.read('github',r,'gh',1,target)).status,'ok');
 secret='fixture-rotated';assert.equal(h.save(secret,1).status,'committed');
 assert.notEqual((await h.host.connections.read('github',r,'gh',1,target)).status,'ok');assert.equal(calls,1);
 assert.equal(h.host.connections.configs.put(h.config(2),1,'rotate-reference').status,'ok');
 assert.equal((await h.host.connections.read('github',r,'gh',2,target)).status,'ok');assert.equal(calls,2);
 assert.equal(h.host.connections.configs.put(h.config(2,'other'),2,'copy-reference').status,'ok');
 assert.notEqual((await h.host.connections.read('github',r,'other',3,target)).status,'ok');assert.equal(calls,2);
 assert.equal(h.host.credentials.revoke(h.request('credentials','credential.revoke','credential:key-a'),{id:'key-a',intent:'revoke-key',expectedRevision:2}).status,'committed');
 assert.notEqual((await h.host.connections.read('github',r,'gh',3,target)).status,'ok');assert.equal(calls,2);
});
test('official GitHub host selects the connector MCP runtime while keeping credentials private',async t=>{
 const command=process.execPath,expectedSha256=createHash('sha256').update(readFileSync(command)).digest('hex');
 const fixture=fileURLToPath(new URL('../../connections/github/tests/fixtures/mcp-server.mjs',import.meta.url));
 const h=await setup(t,{mcpRuntime:{command,expectedSha256,prefixArgs:[fixture,'ok']},fetch:async()=>{throw Error('MCP reads must not use Octokit');}});
 assert.equal(h.save().status,'committed');assert.equal(h.host.connections.configs.put(h.config(),0,'config').status,'ok');
 const result=await h.host.connections.read('github',h.request('github','read',target),'gh',1,target);
 assert.equal(result.status,'ok');assert.equal(result.value.content,'hello');assert.ok(!JSON.stringify(result).includes('fixture-token'));
 assert.equal(h.counts.unseal,1);
});
test('official GitHub host retains its root while an admitted SDK read drains during stop',async t=>{
 let entered,finish;const started=new Promise(r=>{entered=r;}),released=new Promise(r=>{finish=r;});
 const h=await setup(t,{fetch:async()=>{entered();await released;return body();}},{connections:{adapters:[],shutdownTimeoutMs:20}});
 assert.equal(h.save().status,'committed');assert.equal(h.host.connections.configs.put(h.config(),0,'config').status,'ok');
 const pending=h.host.connections.read('github',h.request('github','read',target),'gh',1,target);
 try{
  await Promise.race([started,pending.then(()=>{throw Error('SDK read did not start');})]);assert.equal((await h.host.stop()).status,'incomplete');
  const contender=await startFoundations(h.options);assert.equal(contender.status,'failed');await contender.stop();
 }finally{finish();}
 assert.notEqual((await pending).status,'ok');assert.equal((await h.host.stop()).status,'stopped');
 await h.reopen();
});

test('vault rechecks real GitHub permission revocation after unsealing and after restart',async t=>{
 let calls=0;const h=await setup(t,{fetch:async()=>{calls++;return body();}});
 assert.equal(h.save().status,'committed');assert.equal(h.host.connections.configs.put(h.config(),0,'config').status,'ok');
 const r=h.request('github','read',target),unseal=h.options.credentials.cipher.unseal;
 h.options.credentials.cipher.unseal=value=>{const secret=unseal(value);h.revoke('github','read',target);return secret;};
 assert.notEqual((await h.host.connections.read('github',r,'gh',1,target)).status,'ok');assert.equal(calls,0);
 assert.equal(h.counts.unseal,1);await h.reopen();
 assert.equal((await h.host.connections.read('github',r,'gh',1,target)).status,'denied');assert.equal(calls,0);
});
test('host never falls back from an invalid selected MCP runtime to SDK or unseals a credential',async t=>{
 let calls=0;const h=await setup(t,{mcpRuntime:{command:process.execPath,expectedSha256:'0'.repeat(64)},fetch:async()=>{calls++;return body();}});
 assert.equal(h.save().status,'committed');assert.equal(h.host.connections.configs.put(h.config(),0,'config').status,'ok');
 assert.notEqual((await h.host.connections.read('github',h.request('github','read',target),'gh',1,target)).status,'ok');
 assert.equal(calls,0);assert.equal(h.counts.unseal,0);
});
test('host rejects ambiguous legacy and official GitHub assembly instead of choosing a client',async t=>{
 const h=await setup(t,{}, {githubFiles:{client:async()=>{throw Error('must not resolve');}}});
 assert.equal(h.host.status,'degraded');assert.equal(h.host.connections,undefined);assert.equal(h.counts.unseal,0);
});

test('official GitHub host exposes generic MCP capabilities through Connections',async t=>{
 const ports=await import('../../dist/connections/src/index.js');
 const command=process.execPath,expectedSha256=createHash('sha256').update(readFileSync(command)).digest('hex');
 const fixture=fileURLToPath(new URL('../../connections/github/tests/fixtures/mcp-generic-server.mjs',import.meta.url));
 const h=await setup(t,{mcpRuntime:{command,expectedSha256,prefixArgs:[fixture,'ok']},fetch:async()=>{throw Error('generic MCP must not use Octokit');}});
 assert.equal(h.save().status,'committed');assert.equal(h.host.connections.configs.put(h.config(),0,'config').status,'ok');
 assert.equal(typeof h.host.connections.discover,'function');
 const listed=await h.host.connections.discover('github',h.request('github','read',ports.connectionToolsTarget('gh')),'gh',1);
 assert.equal(listed.status,'ok');assert.equal(listed.value.length,3);
 const pids=[];
 for(const [index,name] of ['pull_request_read','actions_list'].entries()){
  const args={owner:'owner',repo:'repo',method:'list'},r=h.request('github','write',ports.connectionToolTarget('gh',name,args));
  assert.equal((await h.host.connections.invoke('github',r,'tool-'+index,'gh',1,name,args,'intent-'+index)).status,'observed');
  pids.push(h.host.connections.operations.get('tool-'+index).observations[0].value.structuredContent.pid);
 }
 assert.equal(new Set(pids).size,1);
 await h.reopen();
 const args={method:'list'},r=h.request('github','write',ports.connectionToolTarget('gh','actions_list',args));
 assert.equal((await h.host.connections.invoke('github',r,'after-restart','gh',1,'actions_list',args,'after-restart')).status,'observed');
});
