import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile,appendFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const upstream='99d6d6503a7b2a133e2f8a595d6d0ba24b4086d3';
const modulePath='connections/github/upstream/github-mcp-server';
const gitlink=execFileSync('git',['ls-tree','HEAD','--',modulePath],{encoding:'utf8'}).trim();
assert.equal(gitlink,'160000 commit '+upstream+'\t'+modulePath,'upstream gitlink changed');
assert.ok(['linux','win32'].includes(process.platform));
assert.equal(process.arch,'x64');
const directory=await mkdtemp(join(process.env.RUNNER_TEMP??tmpdir(),'wex-pinned-mcp-'));
let completed=false;
try{
 const url='https://codeload.github.com/github/github-mcp-server/tar.gz/'+upstream;
 const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
 assert.equal(response.ok,true,'fixed upstream source archive unavailable');
 const bytes=Buffer.from(await response.arrayBuffer());
 assert.ok(bytes.length>0&&bytes.length<100*1024*1024,'unexpected source archive size');
 const archive=join(directory,'source.tar.gz');await writeFile(archive,bytes);
 execFileSync('tar',['-xf',archive,'-C',directory],{stdio:'inherit'});
 const source=join(directory,'github-mcp-server-'+upstream);
 const license=await readFile(join(source,'LICENSE'),'utf8');
 assert.ok(license.includes('Permission is hereby granted'),'official MIT license missing');
 const module=await readFile(join(source,'go.mod'),'utf8');
 assert.match(module,/^go 1\.27\.3$/m,'review the fixed upstream Go requirement');
 const command=join(directory,process.platform==='win32'?'github-mcp-server.exe':'github-mcp-server');
 const goVersion=execFileSync('go',['version'],{encoding:'utf8'}).trim();
 // Go downloads module archives through the proxy; VCS fallback/cloning is disabled.
 const env={...process.env,GOTOOLCHAIN:'local',GOPROXY:'https://proxy.golang.org',GOSUMDB:'sum.golang.org',GOVCS:'*:off'};
 execFileSync('go',['build','-trimpath','-buildvcs=false','-o',command,'./cmd/github-mcp-server'],
  {cwd:source,env,stdio:'inherit',timeout:15*60*1000});
 const expectedSha256=createHash('sha256').update(await readFile(command)).digest('hex');
 const evidence={sourceRepository:'github/github-mcp-server',sourceCommit:upstream,sourceUrl:url,
  sourceArchiveSha256:createHash('sha256').update(bytes).digest('hex'),license:'MIT',goVersion,
  platform:process.platform,arch:process.arch,binarySha256:expectedSha256,command,
  buildArgs:['build','-trimpath','-buildvcs=false','./cmd/github-mcp-server'],sourceModified:false};
 await writeFile('github-mcp-runtime-build.json',JSON.stringify(evidence,null,2));
 assert.ok(process.env.GITHUB_OUTPUT,'GitHub Actions output file missing');
 await appendFile(process.env.GITHUB_OUTPUT,'command='+command+'\n');
 completed=true;
 console.info('Built unmodified official MCP source at '+upstream+'; no VCS clone used.');
}finally{if(!completed)await rm(directory,{recursive:true,force:true});}
