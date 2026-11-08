import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {stageGitHubRuntime} from '../stage-github-runtime.mjs';
import {desktopGitHubOptions,BUNDLED_GITHUB_MCP_SOURCE} from '../../dist/app/src/desktop-github-runtime.js';
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'wex-stage-mcp-')),directory=join(root,'build'),resourcesPath=join(root,'payload/resources');await mkdir(directory,{recursive:true});
 const command=join(directory,'github-mcp-server.exe'),bytes=Buffer.from('fixture binary; never launched');await writeFile(command,bytes);
 const source=join(directory,'github-mcp-server-'+BUNDLED_GITHUB_MCP_SOURCE);await mkdir(source);await writeFile(join(source,'LICENSE'),'Permission is hereby granted, free of charge, fixture license.');
 const build={sourceRepository:'github/github-mcp-server',sourceCommit:BUNDLED_GITHUB_MCP_SOURCE,sourceArchiveSha256:'a'.repeat(64),sourceModified:false,license:'MIT',platform:'win32',arch:'x64',command,binarySha256:createHash('sha256').update(bytes).digest('hex'),goVersion:'go version go1.27.3 windows/amd64'};
 const buildPath=join(root,'build.json');await writeFile(buildPath,JSON.stringify(build));
 t.after(()=>rm(root,{recursive:true,force:true}));return {root,build,buildPath,resourcesPath};
}
test('packaging stages binary license and provenance usable after relocation',async t=>{
 const f=await fixture(t);await stageGitHubRuntime({buildPath:f.buildPath,resourcesPath:f.resourcesPath});
 const options=desktopGitHubOptions({packaged:true,platform:'win32',arch:'x64',resourcesPath:f.resourcesPath});
 assert.equal(options.mcpRuntime.command,join(f.resourcesPath,'github-mcp/github-mcp-server.exe'));
 assert.equal(options.mcpRuntime.expectedSha256,f.build.binarySha256);
 assert.equal((await readFile(join(f.resourcesPath,'github-mcp/provenance.json'),'utf8')).includes(f.build.command),false,'build machine path leaked into installed runtime');
});
test('packaging refuses mismatched or modified official build evidence',async t=>{
 const f=await fixture(t);
 for(const change of [{sourceCommit:'0'.repeat(40)},{sourceModified:true},{binarySha256:'0'.repeat(64)},{platform:'linux'},{arch:'arm64'}]){
  await writeFile(f.buildPath,JSON.stringify({...f.build,...change}));
  await assert.rejects(stageGitHubRuntime({buildPath:f.buildPath,resourcesPath:f.resourcesPath}),/github_runtime_build_invalid/);
 }
});
