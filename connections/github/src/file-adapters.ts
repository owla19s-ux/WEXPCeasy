import type {ConnectionConfig,ConfiguredDispatchAdapter,ReadAdapter,AdapterAccess,ConfiguredReadAdapter} from '../../src/index.js';
import type {Json} from '../../../shared/src/index.js';
import type {GitHubClientFactory} from './index.js';
import {parseGitHubFileTarget as parse} from './file-target.js';

const limit=1024*1024;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const sha=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(value);
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
  const repos=(await client(captured,access,signal)).rest.repos;
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
   Buffer.from(payload['content'],'utf8').toString('utf8')!==payload['content']||
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

