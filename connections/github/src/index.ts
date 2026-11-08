import type {GitHubMcpRuntime,GitHubMcpOptions} from './mcp-options.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {tmpdir} from 'node:os';
import {Octokit} from 'octokit';
import type {ConnectionConfig,ConfiguredDispatchAdapter,ReadAdapter,AdapterAccess,ConfiguredReadAdapter} from '../../src/index.js';
import type {Json,CredentialReference,CredentialBinding} from '../../../shared/src/index.js';

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
export type GitHubClientFactory=(connection:Readonly<ConnectionConfig>,access?:AdapterAccess,signal?:AbortSignal)=>GitHubOfficialClient|Promise<GitHubOfficialClient>;
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

/** Trusted host ports only. The resolver binds the stored credential reference to this invocation. */
export interface GitHubOfficialClientOptions {
 resolveCredential(connection:Readonly<ConnectionConfig>,access:AdapterAccess):Promise<string|undefined>;
 fetch?:typeof globalThis.fetch;
 timeoutMs?:number;
}
export function createGitHubOfficialClientFactory(options:GitHubOfficialClientOptions):GitHubClientFactory {
 const resolveCredential=options.resolveCredential,transport=options.fetch??globalThis.fetch;
 const timeoutMs=options.timeoutMs??15000;
 if(typeof resolveCredential!=='function'||typeof transport!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)
  throw Error('invalid_github_client_options');
 return async(connection,access,cancellation)=>{
  const expiresAt=performance.now()+timeoutMs;
  const current=capture(connection);
  const cancelled=()=>{if(cancellation?.aborted)throw Error('github_request_cancelled');};
  cancelled();
  const check=()=>{try{return access?.check()===true;}catch{return false;}};
  if(!access||!check()||!current.credentialRef)throw Error('github_access_unavailable');
  let secret:string|undefined;
  const deadline=new AbortController();
  const timer=setTimeout(()=>deadline.abort(),Math.max(1,Math.ceil(expiresAt-performance.now())));
  const preparation=cancellation?AbortSignal.any([deadline.signal,cancellation]):deadline.signal;
  let rejectAbort:(error:Error)=>void=()=>{};
  const aborted=new Promise<never>((_resolve,reject)=>{rejectAbort=reject;});
  const abort=()=>rejectAbort(Error('github_credential_unavailable'));
  preparation.addEventListener('abort',abort,{once:true});
  try{
   if(preparation.aborted||performance.now()>=expiresAt)throw Error('github_credential_unavailable');
   secret=await Promise.race([Promise.resolve().then(()=>{
    if(preparation.aborted)throw Error('github_credential_unavailable');
    return resolveCredential(current,access);
   }),aborted]);
  }catch{
   cancelled();throw Error('github_credential_unavailable');
  }finally{clearTimeout(timer);preparation.removeEventListener('abort',abort);}
  cancelled();
  if(!check())throw Error('github_access_unavailable');
  if(typeof secret!=='string'||!secret||/[\u0000-\u0020\u007f]/.test(secret))throw Error('github_credential_unavailable');
  const sdk=new Octokit({
   auth:secret,baseUrl:'https://api.github.com',
   retry:{enabled:false},throttle:{enabled:false},
   log:{debug(){},info(){},warn(){},error(){}},
   request:{fetch:async(url:Parameters<typeof globalThis.fetch>[0],init?:Parameters<typeof globalThis.fetch>[1])=>{
    if(!check())throw Error('github_access_unavailable');
    cancelled();
    const remaining=expiresAt-performance.now();
    if(remaining<=0)throw Error('github_request_cancelled');
    const signal=AbortSignal.any([AbortSignal.timeout(Math.ceil(remaining)),...(init?.signal?[init.signal]:[]),...(cancellation?[cancellation]:[])]);
    if(signal.aborted)throw Error('github_request_cancelled');
    return transport(url,{...init,signal,redirect:'error'});
   }},
  });
  async function invoke(call:()=>Promise<{data:unknown}>):Promise<{data:unknown}>{
   cancelled();
   if(!check())throw Error('github_access_unavailable');
   try{
    const result=await call();
    cancelled();
    if(!check())throw Error('github_access_unavailable');
    return {data:result.data};
   }catch(error){
    cancelled();
    if(!check())throw Error('github_access_unavailable');
    const status=error&&typeof error==='object'&&'status'in error?error.status:undefined;
    throw Object.assign(Error('github_request_unavailable'),
     Number.isSafeInteger(status)?{status}:{});
   }
  }
  const client:GitHubOfficialClient={rest:{repos:{
   getContent:input=>invoke(()=>sdk.rest.repos.getContent(input)),
   createOrUpdateFileContents:input=>invoke(()=>sdk.rest.repos.createOrUpdateFileContents(input)),
  }}};
  return Object.freeze({rest:Object.freeze({repos:Object.freeze(client.rest.repos)})});
 };
}

/** Produced by a trusted installation/verification path, never by Renderer/model input.
 * expectedSha256 is the installed executable hash from a verified official archive.
 * prefixArgs supports a trusted launcher; it is not a per-request command interface. */
export type {GitHubMcpRuntime,GitHubMcpOptions} from './mcp-options.js';
const mcpVersion='2.1.0';
const uriComponent=(value:string)=>encodeURIComponent(value).replace(/[!'()*]/g,
 char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());
/** A fresh read-only process per invocation prevents credential/session reuse across scopes.
 * Only a regular UTF-8 file at an exact commit is supported; branches/directories/symlinks fail closed. */
export function createGitHubMcpFileReader(options:GitHubMcpOptions):ConfiguredReadAdapter {
 const runtime=Object.freeze({...options.runtime,prefixArgs:Object.freeze([...(options.runtime.prefixArgs??[])])});
 const resolveCredential=options.resolveCredential,timeoutMs=options.timeoutMs??15000;
 if(!isAbsolute(runtime.command)||!/^([0-9a-f]{64})$/.test(runtime.expectedSha256)||
  runtime.prefixArgs.some(arg=>typeof arg!=='string'||arg.includes(String.fromCharCode(0)))||
  !Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000||typeof resolveCredential!=='function')
  throw Error('invalid_github_mcp_options');
 return Object.freeze({id:'github',version:'0.1.1',
  async read(connection:Readonly<ConnectionConfig>,target:string,signal:AbortSignal,access?:AdapterAccess):Promise<Json>{
   let client:Client|undefined,transport:StdioClientTransport|undefined,directory:string|undefined;
   const deadline=new AbortController();
   const timer=setTimeout(()=>deadline.abort(),timeoutMs);
   const combined=AbortSignal.any([signal,deadline.signal]);
   const ensure=()=>{
    let authorized=false;try{authorized=access?.check()===true;}catch{/* Never expose authority errors. */}
    if(combined.aborted||!authorized)throw Error('github_mcp_unavailable');
   };
   async function credential(current:Readonly<ConnectionConfig>):Promise<string|undefined>{
    ensure();
    let rejectAbort:(reason:Error)=>void=()=>{};
    const abort=()=>rejectAbort(Error('github_mcp_unavailable'));
    const aborted=new Promise<never>((_resolve,reject)=>{rejectAbort=reject;});
    combined.addEventListener('abort',abort,{once:true});
    try{
     ensure();return await Promise.race([Promise.resolve().then(()=>resolveCredential(current,access!)),aborted]);
    }finally{combined.removeEventListener('abort',abort);}
   }
   try{
    ensure();const current=capture(connection),file=parse(target);
    if(!/^[0-9a-f]{40}$/.test(file.ref)||!current.credentialRef)throw Error('github_mcp_unavailable');
    const hash=createHash('sha256');
    for await(const chunk of createReadStream(runtime.command,{signal:combined}))hash.update(chunk);
    if(hash.digest('hex')!==runtime.expectedSha256)throw Error('github_mcp_unavailable');
    ensure();const token=await credential(current);ensure();
    if(typeof token!=='string'||!token||/[\u0000-\u0020\u007f]/.test(token))throw Error('github_mcp_unavailable');
    directory=await mkdtemp(join(tmpdir(),'wex-github-mcp-'));ensure();
    transport=new StdioClientTransport({
     command:runtime.command,args:[...runtime.prefixArgs,'stdio','--toolsets=','--tools=get_file_contents','--read-only'],
     cwd:directory,stderr:'ignore',
     env:{GITHUB_PERSONAL_ACCESS_TOKEN:token,GITHUB_HOST:'https://github.com',
      HOME:directory,USERPROFILE:directory,APPDATA:directory,LOCALAPPDATA:directory},
    });
    client=new Client({name:'WEXPCeasy',version:'0.1.1'});
    const requestOptions={signal:combined,timeout:timeoutMs};
    await client.connect(transport,requestOptions);ensure();
    const version=client.getServerVersion();
    if(version?.name!=='github-mcp-server'||version.version.replace(/^v/,'')!==mcpVersion)
     throw Error('github_mcp_unavailable');
    let cursor:string|undefined,found=false;const cursors=new Set<string>();
    for(let page=0;page<10;page++){
     const tools=await client.listTools(cursor?{cursor}:{},requestOptions);ensure();
     if(JSON.stringify(tools).length>131072||tools.tools.length>512)throw Error('github_mcp_unavailable');
     for(const tool of tools.tools)if(tool.name==='get_file_contents'&&tool.annotations?.readOnlyHint===true&&
      tool.inputSchema.type==='object')found=true;
     cursor=tools.nextCursor;
     if(!cursor)break;
     if(cursors.has(cursor)||page===9)throw Error('github_mcp_unavailable');
     cursors.add(cursor);
    }
    if(!found)throw Error('github_mcp_unavailable');
    ensure();
    const result=await client.callTool({name:'get_file_contents',arguments:{
     owner:file.owner,repo:file.repo,path:file.path,sha:file.ref,
    }},undefined,requestOptions);ensure();
    if(result.isError||!Array.isArray(result.content)||result.content.length!==2)throw Error('github_mcp_unavailable');
    const blocks:unknown[]=result.content;
    const resourceBlock=blocks.find((block):block is Record<string,unknown>=>object(block)&&block['type']==='resource');
    const message=blocks.find((block):block is Record<string,unknown>=>object(block)&&block['type']==='text');
    if(!resourceBlock||resourceBlock.type!=='resource'||!object(resourceBlock.resource)||
     typeof resourceBlock.resource['text']!=='string'||!message||message.type!=='text')
     throw Error('github_mcp_unavailable');
    const resource=resourceBlock.resource,text=resource['text'] as string;
    const expectedUri='repo://'+uriComponent(file.owner)+'/'+uriComponent(file.repo)+'/sha/'+file.ref+
     '/contents/'+file.path.split('/').map(uriComponent).join('/');
    const bytes=Buffer.from(text,'utf8');
    if(resource['uri']!==expectedUri||bytes.length>limit||bytes.toString('utf8')!==text)
     throw Error('github_mcp_unavailable');
    const blobSha=createHash('sha1').update('blob '+bytes.length+String.fromCharCode(0)).update(bytes).digest('hex');
    // Upstream 2.1.0 changes this message for symlink dereferencing/fallback; reject those results.
    const expectedMessage=bytes.length===0?'successfully downloaded empty file (SHA: '+blobSha+')':
     'successfully downloaded text file (SHA: '+blobSha+')';
    if(message.text!==expectedMessage)throw Error('github_mcp_unavailable');
    ensure();return {...file,sha:blobSha,content:text,size:bytes.length};
   }catch{throw Error('github_mcp_unavailable');}
   finally{
    let cleanupFailed=false;
    try{if(client)await client.close();}catch{cleanupFailed=true;}
    try{if(transport)await transport.close();}catch{cleanupFailed=true;}
    try{if(directory)await rm(directory,{recursive:true,force:true});}catch{cleanupFailed=true;}
    clearTimeout(timer);
    if(cleanupFailed)throw Error('github_mcp_unavailable');
    ensure();
   }
  },
 });
}

/** Opaque config metadata only: an exact vault reference, never a Key or implicit latest revision. */
export function githubCredentialRef(reference:Readonly<CredentialReference>):string {
 if(!reference||typeof reference.id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(reference.id)||
  !Number.isSafeInteger(reference.revision)||reference.revision<1)throw Error('invalid_github_credential_reference');
 return 'github-credential:'+JSON.stringify([reference.id,reference.revision]);
}
/** Trusted host binding facts derived from this connector's canonical configuration. */
export function githubCredentialTarget(connection:Readonly<ConnectionConfig>):{
 reference:Readonly<CredentialReference>;binding:Readonly<CredentialBinding>
}|undefined {
 try{
  const current=capture(connection);
  if(typeof current.id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(current.id)||
   typeof current.credentialRef!=='string'||!current.credentialRef.startsWith('github-credential:'))return;
  const fields:unknown=JSON.parse(current.credentialRef.slice('github-credential:'.length));
  if(!Array.isArray(fields)||fields.length!==2)return;
  const reference={id:fields[0],revision:fields[1]} as CredentialReference;
  if(githubCredentialRef(reference)!==current.credentialRef)return;
  return Object.freeze({reference:Object.freeze(reference),
   binding:Object.freeze({connectionId:current.id,endpoint:current.endpoint,provider:'github'})});
 }catch{return;}
}

export {createGitHubMcpAdapter} from './mcp.js';
export type {GitHubMcpAdapter,GitHubMcpToolResult} from './mcp.js';
