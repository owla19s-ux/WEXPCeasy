import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createGitHubMcpAdapter} from '../../../dist/connections/github/src/index.js';
const upstream='99d6d6503a7b2a133e2f8a595d6d0ba24b4086d3';
const directory=await mkdtemp(join(tmpdir(),'wex-github-source-'));
const evidence={sha:process.env.GITHUB_SHA,upstream,node:process.version,platform:process.platform,
 remoteMutations:0,limitations:['No product UI/AI wiring or Windows installer acceptance','Only selected read tools exercised; discovery is not per-tool acceptance']};
let adapter;
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
 evidence.calls=[];
 for(const call of calls){
  const result=await adapter.callTool(call.name,call.args,signal(),access());
  evidence.calls.push({category:call.category,name:call.name,isError:result.isError===true,
   contentTypes:result.content?.map(block=>block.type),structuredContent:result.structuredContent!==undefined});
  assert.notEqual(result.isError,true,'official '+call.category+' tool returned isError');
 }
 await adapter.stop();assert.equal(adapter.status().state,'stopped');
 evidence.status='passed';
}catch(error){
 evidence.status='failed';
 // Keep protocol/remote response bodies and credentials out of CI artifacts.
 evidence.failure=error instanceof Error&&error.code?'process_'+error.code:'source_build_or_protocol_or_tool_validation_failed';
 throw error;
}finally{
 await adapter?.stop();
 await writeFile('github-generic-mcp-evidence.json',JSON.stringify(evidence,null,2));
 await rm(directory,{recursive:true,force:true});
}
