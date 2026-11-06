import type {ConnectionConfig,ConfiguredDispatchAdapter,ReadAdapter,AdapterAccess,ConfiguredReadAdapter} from '../../src/index.js';
import type {Json} from '../../../shared/src/index.js';

export interface GitHubFile {owner:string;repo:string;ref:string;path:string}
/** Structural subset of Octokit's official REST client; credentials and retry policy belong to the trusted host.
 * Supply a client bound to this exact connection, with automatic mutation retries disabled.
 * This module never accepts an SDK instance or credentials from a Renderer request. */
export interface GitHubOfficialClient {
 rest:{repos:{
  getContent?:(input:{owner:string;repo:string;ref:string;path:string;request:{signal:AbortSignal}})=>Promise<{data:unknown}>;
  createOrUpdateFileContents?:(input:{owner:string;repo:string;branch:string;path:string;message:string;content:string;sha?:string})=>Promise<{data:unknown}>;
 }};
}
export type GitHubClientFactory=(connection:Readonly<ConnectionConfig>,access?:AdapterAccess)=>GitHubOfficialClient|Promise<GitHubOfficialClient>;
const limit=1024*1024;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const sha=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(value);
function validate(file:GitHubFile):void {
 if(!file||typeof file.owner!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(file.owner)||
  typeof file.repo!=='string'||!/^[a-zA-Z0-9_.-]{1,100}$/.test(file.repo)||['.','..'].includes(file.repo)||
  typeof file.ref!=='string'||!file.ref||file.ref.length>255||/[\u0000-\u0020]/.test(file.ref)||
  typeof file.path!=='string'||!file.path||file.path.length>4096||/[\u0000-\u001f\\]/.test(file.path)||
  file.path.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('invalid_github_file_target');
}
/** Opaque exact permission target. A repository, ref and path cannot be retargeted through payload fields. */
export function githubFileTarget(file:GitHubFile):string {
 validate(file);return 'github-file:'+JSON.stringify([file.owner,file.repo,file.ref,file.path]);
}
function parse(target:string):GitHubFile {
 if(typeof target!=='string'||!target.startsWith('github-file:'))throw Error('invalid_github_file_target');
 const fields:unknown=JSON.parse(target.slice(12));
 if(!Array.isArray(fields)||fields.length!==4)throw Error('invalid_github_file_target');
 const file={owner:fields[0],repo:fields[1],ref:fields[2],path:fields[3]} as GitHubFile;
 if(githubFileTarget(file)!==target)throw Error('noncanonical_github_file_target');
 return file;
}
function capture(connection:Readonly<ConnectionConfig>):Readonly<ConnectionConfig> {
 if(connection.adapter!=='github'||connection.endpoint!=='https://api.github.com'||!connection.enabled)throw Error('github_connection_unavailable');
 return Object.freeze({...connection});
}
/** Use through createReadBoundary. Only UTF-8 regular-file content up to one MiB is supported here. */
export function createGitHubFileReader(connection:Readonly<ConnectionConfig>,client:GitHubClientFactory):ReadAdapter {
 const captured=capture(connection);
 return Object.freeze({id:'github',async read(target:string,signal:AbortSignal,access?:AdapterAccess):Promise<Json>{
  const file=parse(target);if(signal.aborted)throw Error('cancelled');
  if(access&&access.check()!==true)throw Error('adapter_access_unavailable');
  const repos=(await client(captured,access)).rest.repos;
  if(signal.aborted||(access&&access.check()!==true))throw Error('adapter_access_unavailable');
  if(!repos.getContent)throw Error('github_read_unsupported');
  const {data}=await repos.getContent({...file,request:{signal}});
  if(!object(data)||data['type']!=='file'||data['path']!==file.path||!sha(data['sha'])||
   data['encoding']!=='base64'||typeof data['content']!=='string'||data['content'].length>Math.ceil(limit/3)*4+32768||
   !Number.isSafeInteger(data['size'])||Number(data['size'])<0||Number(data['size'])>limit)throw Error('github_file_unavailable');
  const encoded=data['content'].replace(/[\r\n]/g,'');
  const bytes=Buffer.from(encoded,'base64');
  if(bytes.length!==data['size']||bytes.length>limit||bytes.toString('base64')!==encoded)throw Error('github_file_encoding_invalid');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(signal.aborted)throw Error('cancelled');
  return {...file,sha:data['sha'],content:text,size:bytes.length};
 }});
}
/** Built-in adapter for createConnectionService/createConfiguredDispatchBoundary.
 * A thrown SDK outcome remains unknown in the existing Operation ledger; no retry is performed here. */
export function createGitHubFileAdapter(client:GitHubClientFactory):ConfiguredDispatchAdapter {
 return Object.freeze({id:'github',version:'0.1.1',async execute(connection:Readonly<ConnectionConfig>,target:string,payload:Json,access?:AdapterAccess):Promise<Json>{
  const file=parse(target),captured=capture(connection);
  if(!object(payload)||Object.keys(payload).sort().join(',')!=='content,expectedSha,kind,message'||
   payload['kind']!=='put'||typeof payload['message']!=='string'||!payload['message'].trim()||payload['message'].length>4096||
   typeof payload['content']!=='string'||Buffer.byteLength(payload['content'],'utf8')>limit||
   !(payload['expectedSha']===null||sha(payload['expectedSha'])))return {status:'rejected',reason:'invalid_file_update'};
  if(access&&access.check()!==true)return {status:'rejected',reason:'adapter_access_unavailable'};
  const repos=(await client(captured,access)).rest.repos;
  if(access&&access.check()!==true)return {status:'rejected',reason:'adapter_access_unavailable'};
  if(!repos.createOrUpdateFileContents)return {status:'unsupported',reason:'github_write_unsupported'};
  let data:unknown;
  try {
   ({data}=await repos.createOrUpdateFileContents({owner:file.owner,repo:file.repo,branch:file.ref,path:file.path,
    message:payload['message'],content:Buffer.from(payload['content'],'utf8').toString('base64'),
    ...(payload['expectedSha']===null?{}:{sha:payload['expectedSha']})}));
  } catch(error) {
   const status=error&&typeof error==='object'&&'status'in error?error.status:undefined;
   if(status===409||status===422)return {status:'conflict',reason:'github_version_or_validation_conflict'};
   if(status===401||status===403||status===404)return {status:'unavailable',reason:'github_access_unavailable'};
   throw Error('github_outcome_unconfirmed');
  }
  if(!object(data)||!object(data['content'])||!object(data['commit'])||
   data['content']['path']!==file.path||!sha(data['content']['sha'])||!sha(data['commit']['sha']))throw Error('github_write_receipt_unconfirmed');
  return {status:'written',...file,sha:data['content']['sha'],commitSha:data['commit']['sha']};
 }});
}

/** Per-call connection capture and revocation are supplied by createConfiguredReadBoundary. */
export function createGitHubConfiguredFileReader(client:GitHubClientFactory):ConfiguredReadAdapter {
 return Object.freeze({id:'github',version:'0.1.1',
  read(connection:Readonly<ConnectionConfig>,target:string,signal:AbortSignal,access?:AdapterAccess):Promise<unknown>{
   return createGitHubFileReader(connection,client).read(target,signal,access);
  }});
}
