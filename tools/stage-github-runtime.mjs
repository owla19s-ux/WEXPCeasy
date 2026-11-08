import {mkdir,readFile,writeFile,copyFile,lstat,rm} from 'node:fs/promises';
import {join,dirname,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {BUNDLED_GITHUB_MCP_SOURCE,validateBundledGitHubProvenance,desktopGitHubOptions} from '../dist/app/src/desktop-github-runtime.js';

/** Stage the existing pinned source builder's output; never download or select a runtime at app startup. */
export async function stageGitHubRuntime({buildPath,resourcesPath}){
 let destination,created=false;
 try{
  const build=JSON.parse(await readFile(buildPath,'utf8'));
  const metadata=validateBundledGitHubProvenance({format:1,...Object.fromEntries(['sourceRepository','sourceCommit','sourceArchiveSha256','sourceModified','platform','arch','binarySha256','license','goVersion'].map(k=>[k,build[k]]))});
  if(typeof build.command!=='string'||!isAbsolute(build.command))throw Error('invalid_command');
  const binaryStat=await lstat(build.command);if(!binaryStat.isFile()||binaryStat.isSymbolicLink()||binaryStat.size<=0||binaryStat.size>128*1024*1024)throw Error('invalid_binary');
  const binary=await readFile(build.command);
  if(createHash('sha256').update(binary).digest('hex')!==metadata.binarySha256)throw Error('binary_changed');
  const licensePath=join(dirname(build.command),'github-mcp-server-'+BUNDLED_GITHUB_MCP_SOURCE,'LICENSE');
  const licenseStat=await lstat(licensePath);if(!licenseStat.isFile()||licenseStat.isSymbolicLink()||licenseStat.size>262144)throw Error('invalid_license');
  const license=await readFile(licensePath);if(!license.toString('utf8').includes('Permission is hereby granted'))throw Error('invalid_license');
  await mkdir(resourcesPath,{recursive:true});destination=join(resourcesPath,'github-mcp');await mkdir(destination);created=true;
  await copyFile(build.command,join(destination,'github-mcp-server.exe'));
  await writeFile(join(destination,'LICENSE'),license);
  await writeFile(join(destination,'provenance.json'),JSON.stringify(metadata,null,2));
  desktopGitHubOptions({packaged:true,platform:'win32',arch:'x64',resourcesPath});
  return metadata;
 }catch(error){if(created)await rm(destination,{recursive:true,force:true});throw Error('github_runtime_build_invalid',{cause:error});}
}
