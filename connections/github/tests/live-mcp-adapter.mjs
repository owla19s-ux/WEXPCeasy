import assert from 'node:assert/strict';
import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm,appendFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {startFoundations} from '../../../dist/app/src/index.js';
import {createGitHubMcpAdapter,githubCredentialRef,githubFileTarget} from '../../../dist/connections/github/src/index.js';
import {capabilityDiscoveryTarget,capabilityInvocationTarget} from '../../../dist/connections/src/index.js';
import {desktopGitHubOptions} from '../../../dist/app/src/desktop-github-runtime.js';

const upstream='99d6d6503a7b2a133e2f8a595d6d0ba24b4086d3';
const token=process.env.WEX_GITHUB_READ_TOKEN;
assert.ok(token,'read-only CI token missing');
const [owner,repo]=String(process.env.GITHUB_REPOSITORY).split('/');
assert.ok(owner&&repo,'repository missing');
const pr=Number(process.env.WEX_GITHUB_PR_NUMBER);
assert.ok(Number.isSafeInteger(pr)&&pr>0,'pull request number missing');
assert.match(process.env.GITHUB_SHA??'',/^[0-9a-f]{40}$/);
const build=JSON.parse(await readFile('github-mcp-runtime-build.json','utf8'));
assert.equal(build.sourceCommit,upstream);assert.equal(build.sourceModified,false);
const bundled=process.env.WEX_GITHUB_MCP_RESOURCES;
const bundledRuntime=bundled?desktopGitHubOptions({packaged:true,resourcesPath:resolve(bundled)}).mcpRuntime:undefined;
const command=bundledRuntime?.command??resolve(process.env.WEX_GITHUB_MCP_BINARY??'');
if(!bundled)assert.equal(command,build.command);
const expectedSha256=createHash('sha256').update(await readFile(command)).digest('hex');
assert.equal(expectedSha256,build.binarySha256,'compiled executable changed');
if(bundledRuntime)assert.equal(expectedSha256,bundledRuntime.expectedSha256,'packaged runtime differs from source build');
const runtime={command,expectedSha256};
const root=await mkdtemp(join(tmpdir(),'wex-live-mcp-host-'));
await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'official-mcp-live'}));
const evidence={sha:process.env.GITHUB_SHA,pr,sourceCommit:upstream,binarySha256:expectedSha256,
 runtimeSource:bundled?'packaged fixed desktop runtime':'explicit test runtime',
 platform:process.platform,node:process.version,remoteMutations:0,checks:[],status:'incomplete',
 limitations:['Read-only CI identity','Only repository file, PR read and workflow listing are executed',
  'Full catalog discovery does not prove every tool or write operation','No desktop UI or installer acceptance']};
let host,probe,restricted;
const key=randomBytes(32),facts=new WeakMap(),approved=new WeakSet(),history={};
let grants=0,unseals=0;
const cipher={available:()=>true,
 seal(value){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,c.update(value,'utf8'),c.final(),c.getAuthTag()]).toString('base64');},
 unseal(value){unseals++;const b=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(-16));return Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString('utf8');}};
function request(resource,action,target){
 const r={},scope={subject:'ci-user',entry:'ci-readonly',conversation:null,context:null,resource,action,target,relationship:'session',relationshipGeneration:1};
 facts.set(r,{...scope,kind:'local',entryEnabled:true,moduleEnabled:true,globalEnabled:true,sourceAllowed:true,conversationEnabled:false});
 const change={intent:'grant-'+(++grants),expectedRevision:host.permissions.history(history).revision,scope};approved.add(change);
 assert.equal(host.permissions.grant(change).status,'committed','WEX grant failed');return r;
}
function jsonValues(result){
 const roots=[result.structuredContent];
 for(const block of result.content??[])if(block.type==='text'){try{roots.push(JSON.parse(block.text));}catch{/* Plain MCP messages are valid content. */}}
 return roots;
}
function contains(value,predicate){
 if(!value||typeof value!=='object')return false;
 if(predicate(value))return true;
 return Object.values(value).some(child=>contains(child,predicate));
}
try{
 host=await startFoundations({dataRoot:root,credentials:{cipher},githubOfficial:{...(bundled?desktopGitHubOptions({packaged:true,resourcesPath:resolve(bundled)}):{mcpRuntime:runtime}),timeoutMs:60000},
  trust:{current:r=>facts.get(r),canManage:c=>approved.has(c),canReadHistory:r=>r===history}});
 assert.equal(host.status,'ready','WEX host unavailable');
 const saved=host.credentials.put(request('credentials','credential.write','credential:ci-key'),{
  id:'ci-key',intent:'save-ci-key',expectedRevision:0,
  binding:{connectionId:'github-ci',endpoint:'https://api.github.com',provider:'github'},secret:token});
 assert.equal(saved.status,'committed','credential custody failed');
 const config={id:'github-ci',adapter:'github',endpoint:'https://api.github.com',
  credentialRef:githubCredentialRef({id:'ci-key',revision:1}),enabled:true};
 assert.equal(host.connections.configs.put(config,0,'create-ci-connection').status,'ok');
 if(bundled){
  const target=githubFileTarget({owner,repo,ref:process.env.GITHUB_SHA,path:'package.json'});
  const read=await host.connections.read('github',request('github','read',target),config.id,1,target);
  assert.equal(read.status,'ok','packaged profile lost its SDK file compatibility');
  assert.deepEqual(JSON.parse(read.value.content),JSON.parse(await readFile('package.json','utf8')));
  evidence.checks.push({domain:'sdk-file-compatibility',path:'package.json',ref:read.value.ref});
 }
 // Observe the actual negotiated server identity with the same WEX protocol adapter.
 probe=createGitHubMcpAdapter(config,{runtime,timeoutMs:60000,resolveCredential:async()=>token});
 await probe.start(new AbortController().signal,{request:{},check:()=>true});
 const catalog=await probe.listTools(new AbortController().signal,{request:{},check:()=>true});evidence.server=probe.status().serverVersion;
 assert.equal(evidence.server.name,'github-mcp-server');assert.ok(catalog.length>0);
 assert.equal(new Set(catalog.map(t=>t.name)).size,catalog.length);
 restricted=createGitHubMcpAdapter(config,{runtime,toolsets:['repos'],readOnly:true,timeoutMs:60000,resolveCredential:async()=>token});
 const restrictedTools=await restricted.listTools(new AbortController().signal,{request:{},check:()=>true});
 assert.ok(restrictedTools.length>0&&restrictedTools.length<catalog.length);
 assert.ok(!restrictedTools.some(t=>t.name==='create_or_update_file'));
 evidence.restricted={toolsets:['repos'],readOnly:true,toolCount:restrictedTools.length};
 await restricted.stop();restricted=undefined;
 await probe.stop();probe=undefined;
 const discovery=await host.connections.discover('github',request('github','read',capabilityDiscoveryTarget('github',config.id)),config.id,1);
 assert.equal(discovery.status,'ok','public capability discovery failed');
 assert.deepEqual(discovery.value.map(t=>t.name).sort(),catalog.map(t=>t.name).sort(),'host lost official tools');
 evidence.toolCount=catalog.length;
 for(const tool of catalog){
  const publicTool=discovery.value.find(t=>t.name===tool.name);
  assert.deepEqual(publicTool.inputSchema,tool.inputSchema,'host changed tool schema');
 }
 const catalogText=JSON.stringify({sourceCommit:upstream,server:evidence.server,toolsets:'all',tools:discovery.value},null,2);
 assert.ok(!catalogText.includes(token),'credential appeared in catalog');
 await writeFile('github-mcp-official-catalog.json',catalogText);
 const cases=[
  {domain:'repos',name:'get_file_contents',args:{owner,repo,path:'README.md',sha:process.env.GITHUB_SHA}},
  {domain:'pull_requests',name:'pull_request_read',args:{method:'get',owner,repo,pullNumber:pr}},
  {domain:'actions',name:'actions_list',args:{method:'list_workflows',owner,repo,perPage:3}},
 ];
 const expectedReadme=(await readFile('README.md','utf8')).replace(/\r\n/g,'\n');
 for(const [index,item] of cases.entries()){
  assert.ok(catalog.some(t=>t.name===item.name),'required read tool missing: '+item.name);
  const id='official-read-'+index,target=capabilityInvocationTarget('github',config.id,item.name,item.args);
  const result=await host.connections.invoke('github',request('github','write',target),id,config.id,1,item.name,item.args,id);
  assert.equal(result.status,'observed','public invocation failed: '+item.name);
  const operation=host.connections.operations.get(id);assert.equal(operation.phase,'observed');assert.equal(operation.attempts,1);
  const value=operation.observations.find(o=>o.id==='result').value;
  assert.notEqual(value.isError,true,'official read tool returned an error: '+item.name);
  assert.ok(Array.isArray(value.content),'MCP content missing');
  const serialized=JSON.stringify(value);assert.ok(!serialized.includes(token),'credential appeared in MCP result');
  if(item.domain==='repos'){
   const texts=[];
   for(const block of value.content){if(block.type==='text')texts.push(block.text);if(block.type==='resource'&&typeof block.resource?.text==='string')texts.push(block.resource.text);}
   assert.ok(texts.some(text=>text.replace(/\r\n/g,'\n').includes(expectedReadme)),'official file content differs from tested commit');
  }else if(item.domain==='pull_requests'){
   assert.ok(jsonValues(value).some(root=>contains(root,object=>object.number===pr)),'actual PR identity missing');
  }else{
   assert.ok(jsonValues(value).some(root=>contains(root,object=>Array.isArray(object.workflows)&&object.workflows.length>0)),'actual workflow list missing');
  }
  evidence.checks.push({domain:item.domain,tool:item.name,operationId:id,phase:operation.phase,
   isError:value.isError??false,contentTypes:value.content.map(block=>block.type),
   structuredContent:!!value.structuredContent,resultSha256:createHash('sha256').update(serialized).digest('hex')});
 }
 assert.equal(unseals,bundled?5:4,'each public invocation must revalidate vault credentials');
 evidence.credentialResolutions=unseals;
 const stopped=await host.stop();assert.equal(stopped.status,'stopped','official runtime did not stop');host=undefined;
 evidence.status='passed';
 console.info('Pinned official MCP discovery and WEX repository/PR/Actions reads passed; remote mutations: 0.');
}finally{
 let cleanup=true;
 try{await probe?.stop();await restricted?.stop();}catch{cleanup=false;}
 try{if(host&&(await host.stop()).status!=='stopped')cleanup=false;}catch{cleanup=false;}
 try{await rm(root,{recursive:true,force:true});}catch{cleanup=false;}
 evidence.cleanupConfirmed=cleanup;
 await writeFile('github-mcp-live-evidence.json',JSON.stringify(evidence,null,2));
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,
  '### Official GitHub MCP adapter verification\n\n'+
  '- Source: `'+upstream+'`\n- Status: '+evidence.status+'\n- Discovered tools: '+(evidence.toolCount??'unavailable')+
  '\n- Read categories: '+evidence.checks.map(x=>x.domain).join(', ')+'\n- Remote mutations: 0\n- Cleanup: '+cleanup+'\n');
 assert.equal(cleanup,true,'official runtime cleanup unconfirmed');
}
