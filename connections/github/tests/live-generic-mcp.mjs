import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
import {createConnectionService,capabilityDiscoveryTarget,capabilityInvocationTarget} from '../../../dist/connections/src/index.js';
import {createGitHubMcpAdapter,createGitHubMcpCapabilityAdapter} from '../../../dist/connections/github/src/index.js';
const upstream='99d6d6503a7b2a133e2f8a595d6d0ba24b4086d3';
const directory=await mkdtemp(join(tmpdir(),'wex-github-source-'));
const evidence={sha:process.env.GITHUB_SHA,upstream,node:process.version,platform:process.platform,
 remoteMutations:0,limitations:['No product UI/AI wiring or Windows installer acceptance','Only selected read tools exercised; discovery is not per-tool acceptance']};
let adapter,restricted,publicService,configStore,operationStore;
try{
 const response=await fetch('https://api.github.com/repos/github/github-mcp-server/tarball/'+upstream,{signal:AbortSignal.timeout(60000)});
 assert.equal(response.ok,true,'pinned official source download');
 const archive=join(directory,'source.tar.gz');
 await writeFile(archive,Buffer.from(await response.arrayBuffer()));
 execFileSync('tar',['-xzf',archive,'--strip-components=1','-C',directory],{stdio:'inherit'});
 const goMod=await readFile(join(directory,'go.mod'),'utf8');
 evidence.goRequirement=goMod.match(/^go (.+)$/m)?.[1];
 const command=join(directory,process.platform==='win32'?'github-mcp-server.exe':'github-mcp-server');
 execFileSync('go',['build','-trimpath','-o',command,'./cmd/github-mcp-server'],{cwd:directory,stdio:'inherit',timeout:600000});
 const expectedSha256=createHash('sha256').update(await readFile(command)).digest('hex');
 evidence.binarySha256=expectedSha256;
 assert.ok(process.env.WEX_GITHUB_READ_TOKEN,'CI read token required');
 const connection={id:'official-source',adapter:'github',endpoint:'https://api.github.com',credentialRef:'ci-read',enabled:true};
 adapter=createGitHubMcpAdapter(connection,{runtime:{command,expectedSha256},
  timeoutMs:60000,resolveCredential:async()=>process.env.WEX_GITHUB_READ_TOKEN});
 const access=()=>({request:{},check:()=>true}),signal=()=>new AbortController().signal;
 const tools=await adapter.listTools(signal(),access());
 assert.ok(tools.length>1);
 assert.ok(tools.every(t=>t.name&&t.inputSchema.type==='object'));
 evidence.server=adapter.status().serverVersion;
 evidence.toolConfiguration={toolsets:'all',readOnly:false};
 evidence.tools=tools; // Actual names and schemas, no hardcoded tool-count claim.
 evidence.toolCount=tools.length;
 restricted=createGitHubMcpAdapter(connection,{runtime:{command,expectedSha256},toolsets:['repos'],readOnly:true,
  timeoutMs:60000,resolveCredential:async()=>process.env.WEX_GITHUB_READ_TOKEN});
 const restrictedTools=await restricted.listTools(signal(),access());
 assert.ok(restrictedTools.length>0&&restrictedTools.length<tools.length,'runtime configuration must change the catalogue');
 assert.ok(!restrictedTools.some(t=>t.name==='create_or_update_file'),'read-only server must exclude file writes');
 evidence.restricted={toolsets:['repos'],readOnly:true,tools:restrictedTools,toolCount:restrictedTools.length};
 await restricted.stop();
 const [owner,repo]=process.env.GITHUB_REPOSITORY.split('/');
 const choose=(candidates)=>{const found=candidates.find(name=>tools.some(t=>t.name===name));assert.ok(found,'missing tools: '+candidates.join('/'));return found;};
 const calls=[
  {category:'repository',name:choose(['get_file_contents']),args:{owner,repo,path:'README.md',ref:process.env.GITHUB_SHA}},
  {category:'pull_requests',name:choose(['list_pull_requests','search_pull_requests','pull_request_read']),args:null},
  {category:'actions',name:choose(['actions_list','list_workflow_runs']),args:null}
 ];
 calls[1].args=calls[1].name==='search_pull_requests'?{query:'repo:'+owner+'/'+repo,perPage:1}:
  calls[1].name==='pull_request_read'?{method:'get',owner,repo,pullNumber:1}:{owner,repo,state:'all',perPage:1};
 calls[2].args=calls[2].name==='actions_list'?{method:'list_workflow_runs',owner,repo,perPage:1}:{owner,repo,perPage:1};
 configStore=openSqliteStore(join(directory,'connections.sqlite'),'configs');
 operationStore=openSqliteStore(join(directory,'operations.sqlite'),'operations');
 const permission={evaluate(request){return {status:'allow',scope:request.scope,revision:1,generation:1};},recheck(request){return this.evaluate(request);}};
 const request=(target,action)=>({scope:{subject:'ci',entry:'conversation',conversation:'official-read',context:null,resource:'github',target,action,relationship:'direct',relationshipGeneration:1}});
 publicService=createConnectionService(permission,configStore,operationStore,[],{
  capabilityAdapters:[createGitHubMcpCapabilityAdapter({runtime:{command,expectedSha256},timeoutMs:60000,resolveCredential:async()=>process.env.WEX_GITHUB_READ_TOKEN})],
  shutdownTimeoutMs:10000,
 });
 assert.equal(publicService.configs.put(connection,0,'official-source').status,'ok');
 const catalogue=await publicService.discover('github',request(capabilityDiscoveryTarget('github',connection.id),'read'),connection.id,1);
 assert.equal(catalogue.status,'ok');
 assert.deepEqual(catalogue.value.map(t=>t.name),tools.map(t=>t.name));
 evidence.publicConnections={authorization:'trusted CI scope fixture; no product App/IPC wiring',catalogueCount:catalogue.value.length,operations:[]};
 evidence.calls=[];
 for(const call of calls){
  const id='official-'+call.category;
  const outcome=await publicService.invoke('github',request(capabilityInvocationTarget('github',connection.id,call.name,call.args),'write'),
   id,connection.id,1,call.name,call.args,'official-read');
  assert.equal(outcome.status,'observed','public invocation must persist its observation');
  const op=publicService.operations.get(id);
  assert.equal(op.phase,'observed');assert.equal(op.attempts,1);
  const result=op.observations[0].value;
  evidence.publicConnections.operations.push({id:op.id,phase:op.phase,attempts:op.attempts,connection:op.connection});
  evidence.calls.push({category:call.category,name:call.name,isError:result.isError===true,
   contentTypes:result.content?.map(block=>block.type),structuredContent:result.structuredContent!==undefined});
  assert.notEqual(result.isError,true,'official '+call.category+' tool returned isError');
 }
 assert.equal((await publicService.stop()).status,'stopped');
 await adapter.stop();assert.equal(adapter.status().state,'stopped');
 evidence.status='passed';
 console.info(JSON.stringify({sha:evidence.sha,upstream,platform:evidence.platform,server:evidence.server,
  toolCount:evidence.toolCount,restrictedToolCount:evidence.restricted.toolCount,calls:evidence.calls,publicConnections:evidence.publicConnections,remoteMutations:0}));
}catch(error){
 evidence.status='failed';
 // Keep protocol/remote response bodies and credentials out of CI artifacts.
 evidence.failure=error instanceof Error&&error.code?'process_'+error.code:'source_build_or_protocol_or_tool_validation_failed';
 throw error;
}finally{
 await adapter?.stop();await restricted?.stop();
 if(publicService)assert.equal((await publicService.stop()).status,'stopped');
 configStore?.close();operationStore?.close();
 await writeFile('github-generic-mcp-evidence.json',JSON.stringify(evidence,null,2));
 await rm(directory,{recursive:true,force:true});
}
