import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {tmpdir} from 'node:os';
import type {ConnectionConfig,AdapterAccess,ConfiguredReadAdapter} from '../../src/index.js';
import type {Json} from '../../../shared/src/index.js';

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
import {parseGitHubFileTarget as parse} from './file-target.js';
export {githubFileTarget} from './file-target.js';
export type {GitHubFile} from './file-target.js';
function capture(connection:Readonly<ConnectionConfig>):Readonly<ConnectionConfig> {
 if(connection.adapter!=='github'||connection.endpoint!=='https://api.github.com'||!connection.enabled)throw Error('github_connection_unavailable');
 return Object.freeze({...connection});
}
export {createGitHubFileReader,createGitHubFileAdapter,createGitHubConfiguredFileReader} from './file-adapters.js';

export {createGitHubOfficialClientFactory} from './official-client.js';
export type {GitHubOfficialClientOptions} from './official-client.js';

/** Produced by a trusted installation/verification path, never by Renderer/model input.
 * expectedSha256 is the installed executable hash from a verified official archive.
 * prefixArgs supports a trusted launcher; it is not a per-request command interface. */
export interface GitHubMcpRuntime {
 command:string; expectedSha256:string; prefixArgs?:readonly string[];
}
export interface GitHubMcpOptions {
 runtime:Readonly<GitHubMcpRuntime>;
 resolveCredential:GitHubOfficialClientOptions['resolveCredential'];
 timeoutMs?:number;
}
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

export {githubCredentialRef,githubCredentialTarget} from './credentials.js';

/** General official GitHub MCP client adapter; separate from legacy file-only compatibility. */
export {createGitHubMcpAdapter} from './mcp.js';
export type {GitHubMcpAdapter,GitHubMcpAdapterOptions,GitHubMcpToolResult} from './mcp.js';
