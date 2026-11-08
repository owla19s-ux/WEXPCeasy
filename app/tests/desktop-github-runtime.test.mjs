import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {desktopGitHubOptions,BUNDLED_GITHUB_MCP_SOURCE} from '../../dist/app/src/desktop-github-runtime.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'wex-bundled-mcp-')),resources=join(root,'resources'),runtime=join(resources,'github-mcp');
 await mkdir(runtime,{recursive:true});
 const bytes=Buffer.from('fixture executable; never launched');
 const manifest={format:1,sourceRepository:'github/github-mcp-server',sourceCommit:BUNDLED_GITHUB_MCP_SOURCE,sourceArchiveSha256:'a'.repeat(64),sourceModified:false,platform:'win32',arch:'x64',binarySha256:hash(bytes),license:'MIT',goVersion:'go version go1.27.3 windows/amd64'};
 const command=join(runtime,'github-mcp-server.exe');
 await writeFile(command,bytes);await writeFile(join(runtime,'provenance.json'),JSON.stringify(manifest));await writeFile(join(runtime,'LICENSE'),'Permission is hereby granted, free of charge, fixture license.');
 t.after(()=>rm(root,{recursive:true,force:true}));
 return {root,resources,runtime,command,manifest,options:{packaged:true,platform:'win32',arch:'x64',resourcesPath:resources}};
}
test('packaged Windows resolves the bundled pinned runtime at a fixed installation path',async t=>{
 const f=await fixture(t),options=desktopGitHubOptions(f.options);
 assert.deepEqual(options,{fileReader:'sdk',mcpRuntime:{command:f.command,expectedSha256:f.manifest.binarySha256}});
 assert.equal(JSON.stringify(options).includes('prefixArgs'),false);
});
test('development entry retains its existing explicit-runtime behavior',()=>{
 assert.deepEqual(desktopGitHubOptions({packaged:false,platform:'linux',arch:'x64',resourcesPath:'/missing'}),{});
});
test('missing or damaged packaged executable never silently falls back to SDK',async t=>{
 const f=await fixture(t);await writeFile(f.command,'tampered');
 assert.throws(()=>desktopGitHubOptions(f.options),/bundled_github_runtime_invalid/);
 await rm(f.command);assert.throws(()=>desktopGitHubOptions(f.options),/bundled_github_runtime_invalid/);
});
test('runtime provenance rejects another source architecture modified build or arbitrary command',async t=>{
 const f=await fixture(t);
 for(const change of [{sourceCommit:'b'.repeat(40)},{platform:'linux'},{arch:'arm64'},{sourceModified:true},{command:'C:\\untrusted.exe'},{binarySha256:'invalid'},{sourceArchiveSha256:'invalid'},{license:'unknown'}]){
  await writeFile(join(f.runtime,'provenance.json'),JSON.stringify({...f.manifest,...change}));
  assert.throws(()=>desktopGitHubOptions(f.options),/bundled_github_runtime_invalid/,JSON.stringify(change));
 }
});
test('provenance is bounded and malformed or missing license is rejected',async t=>{
 const f=await fixture(t),path=join(f.runtime,'provenance.json');
 for(const value of ['{',' '.repeat(16385)]){await writeFile(path,value);assert.throws(()=>desktopGitHubOptions(f.options),/bundled_github_runtime_invalid/);}
 await writeFile(path,JSON.stringify(f.manifest));await rm(join(f.runtime,'LICENSE'));
 assert.throws(()=>desktopGitHubOptions(f.options),/bundled_github_runtime_invalid/);
});
test('runtime directory junction or symlink cannot redirect the fixed packaged location',async t=>{
 const f=await fixture(t),outside=join(f.root,'outside');await mkdir(outside);
 for(const name of ['github-mcp-server.exe','provenance.json','LICENSE'])await writeFile(join(outside,name),await readFile(join(f.runtime,name)));
 await rm(f.runtime,{recursive:true});await symlink(outside,f.runtime,process.platform==='win32'?'junction':'dir');
 assert.throws(()=>desktopGitHubOptions(f.options),/bundled_github_runtime_invalid/);
});
