import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,chmod,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createGitHubOfficialClientFactory,createGitHubMcpFileReader} from '../../../dist/connections/github/src/index.js';
import {verifyGitHubRead} from './live-read.mjs';
const version='2.1.0';
const archive=process.platform==='win32'?'github-mcp-server_Windows_x86_64.zip':'github-mcp-server_Linux_x86_64.tar.gz';
const archiveSha=process.platform==='win32'?'ddce274916ebf31346dee71a0ed3345e80cd36b060a0bfb8160db0afc411e9d3':'a442f9db287cea01008bcb55fe6bc0292270301046c3edbd1a8b22d6e4157b2b';
assert.equal(process.arch,'x64');
assert.ok(['linux','win32'].includes(process.platform));
const token=process.env.WEX_GITHUB_READ_TOKEN;
assert.ok(token,'read-only acceptance token required');
const [owner,repo]=process.env.GITHUB_REPOSITORY.split('/');
const ref=process.env.GITHUB_SHA;
const resolveCredential=async(connection,access)=>{
 assert.equal(connection.credentialRef,'github-actions-readonly');assert.equal(access.check(),true);return token;
};
const sdk=createGitHubOfficialClientFactory({resolveCredential,timeoutMs:30000});
const sdkEvidence=await verifyGitHubRead({github:sdk,owner,repo,ref,workspacePath:process.cwd()});
const directory=await mkdtemp(join(tmpdir(),'wex-official-mcp-'));
try{
 const response=await fetch('https://github.com/github/github-mcp-server/releases/download/v'+version+'/'+archive,{signal:AbortSignal.timeout(60000)});
 assert.equal(response.ok,true,'official archive download failed');
 const bytes=Buffer.from(await response.arrayBuffer());assert.ok(bytes.length<100*1024*1024);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),archiveSha,'official archive integrity');
 const archivePath=join(directory,archive);await writeFile(archivePath,bytes);
 execFileSync('tar',['-xf',archivePath,'-C',directory],{stdio:'ignore'});
 const command=join(directory,process.platform==='win32'?'github-mcp-server.exe':'github-mcp-server');
 if(process.platform!=='win32')await chmod(command,0o700);
 const binary=await readFile(command),expectedSha256=createHash('sha256').update(binary).digest('hex');
 const readAdapter=createGitHubMcpFileReader({runtime:{command,expectedSha256},resolveCredential,timeoutMs:30000});
 const mcpEvidence=await verifyGitHubRead({readAdapter,provider:'github-mcp-server',owner,repo,ref,workspacePath:process.cwd()});
 await writeFile('github-official-components-evidence.json',JSON.stringify({
  sha:ref,platform:process.platform,node:process.version,
  versions:{octokit:'5.0.5',mcpSdk:'1.26.0',server:version},
  license:'MIT',archive,archiveSha256:archiveSha,binarySha256:expectedSha256,
  sdk:sdkEvidence,mcp:mcpEvidence,remoteMutations:0,
  limitations:['Read-only isolated CI identity; no product credential/desktop wiring or installer acceptance','MCP supports exact-commit regular UTF-8 files only','GH-01 through GH-12 broad coverage remains incomplete'],
 },null,2));
 console.info('Official SDK and native MCP read acceptance passed; remote mutations: 0.');
}finally{await rm(directory,{recursive:true,force:true});}
