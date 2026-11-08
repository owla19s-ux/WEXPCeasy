import {lstatSync,readFileSync} from 'node:fs';
import {join,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import type {GitHubMcpRuntime} from '../../connections/github/src/index.js';

export const BUNDLED_GITHUB_MCP_SOURCE='99d6d6503a7b2a133e2f8a595d6d0ba24b4086d3';
export interface BundledGitHubProvenance {
 format:1;sourceRepository:'github/github-mcp-server';sourceCommit:string;sourceArchiveSha256:string;
 sourceModified:false;platform:'win32';arch:'x64';binarySha256:string;license:'MIT';goVersion:string;
}
const keys=['format','sourceRepository','sourceCommit','sourceArchiveSha256','sourceModified','platform','arch','binarySha256','license','goVersion'];
const invalid=():never=>{throw Error('bundled_github_runtime_invalid');};
export function validateBundledGitHubProvenance(value:unknown):BundledGitHubProvenance {
 if(!value||typeof value!=='object'||Array.isArray(value))return invalid();
 const v=value as Record<string,unknown>;
 if(Object.keys(v).length!==keys.length||keys.some(key=>!Object.hasOwn(v,key))||
  v['format']!==1||v['sourceRepository']!=='github/github-mcp-server'||v['sourceCommit']!==BUNDLED_GITHUB_MCP_SOURCE||
  v['sourceModified']!==false||v['platform']!=='win32'||v['arch']!=='x64'||v['license']!=='MIT'||
  typeof v['goVersion']!=='string'||!/^go version go1\.27\.3 windows\/amd64$/.test(v['goVersion'])||
  !['binarySha256','sourceArchiveSha256'].every(k=>typeof v[k]==='string'&&/^[0-9a-f]{64}$/.test(v[k] as string)))return invalid();
 return Object.freeze({...v}) as unknown as BundledGitHubProvenance;
}
/** Installation facts only. Renderer input and user data never select an executable. */
export function desktopGitHubOptions(input:{packaged:boolean;resourcesPath:string;platform?:string;arch?:string}): {mcpRuntime?:Readonly<GitHubMcpRuntime>;fileReader?:'sdk'} {
 if(!input.packaged)return {};
 try{
  if((input.platform??process.platform)!=='win32'||(input.arch??process.arch)!=='x64'||!isAbsolute(input.resourcesPath))return invalid();
  const directory=join(input.resourcesPath,'github-mcp');
  for(const path of [input.resourcesPath,directory]){const s=lstatSync(path);if(!s.isDirectory()||s.isSymbolicLink())return invalid();}
  function bytes(name:string,limit:number){
   const path=join(directory,name),s=lstatSync(path);
   if(!s.isFile()||s.isSymbolicLink()||s.size<=0||s.size>limit)return invalid();
   const value=readFileSync(path);if(value.length>limit)return invalid();return value;
  }
  const metadata=validateBundledGitHubProvenance(JSON.parse(bytes('provenance.json',16384).toString('utf8')));
  if(!bytes('LICENSE',262144).toString('utf8').includes('Permission is hereby granted'))return invalid();
  const binary=bytes('github-mcp-server.exe',128*1024*1024);
  if(createHash('sha256').update(binary).digest('hex')!==metadata.binarySha256)return invalid();
  return Object.freeze({fileReader:'sdk',mcpRuntime:Object.freeze({command:join(directory,'github-mcp-server.exe'),expectedSha256:metadata.binarySha256})});
 }catch{return invalid();}
}
