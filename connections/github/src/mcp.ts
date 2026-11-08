import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {tmpdir} from 'node:os';
import type {ConnectionConfig,AdapterAccess} from '../../src/index.js';
import type {Json} from '../../../shared/src/index.js';

export type GitHubMcpTool=Awaited<ReturnType<Client['listTools']>>['tools'][number];
export type GitHubMcpToolResult=Awaited<ReturnType<Client['callTool']>>;
export interface GitHubMcpAdapterOptions {
 /** Trusted executable and launcher configuration; never taken from a tool request. */
 runtime:Readonly<{command:string;expectedSha256:string;prefixArgs?:readonly string[]}>;
 resolveCredential(connection:Readonly<ConnectionConfig>,access:AdapterAccess):Promise<string|undefined>;
 timeoutMs?:number;
}
export interface GitHubMcpAdapterStatus {
 state:'stopped'|'starting'|'connected'|'error';
 connectionId?:string;
 server?:Readonly<{name:string;version:string}>;
 toolCount:number;
}
/** One trusted-host session per connection and authority lease.
 * This is a protocol adapter, not an authorization or Operation boundary.
 * The host must authorize each tool and record writes through Connections before calling.
 * Tool annotations are descriptive metadata and never grant authority.
 * Failed or interrupted calls are never replayed; remote effects may remain unknown.
 */
export function createGitHubMcpAdapter(options:GitHubMcpAdapterOptions){
 const runtime=Object.freeze({...options.runtime,prefixArgs:Object.freeze([...(options.runtime.prefixArgs??[])])});
 const resolveCredential=options.resolveCredential,timeoutMs=options.timeoutMs??15000;
 if(!isAbsolute(runtime.command)||!/^([0-9a-f]{64})$/.test(runtime.expectedSha256)||
  runtime.prefixArgs.some(arg=>typeof arg!=='string'||arg.includes(String.fromCharCode(0)))||
  typeof resolveCredential!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)
  throw Error('invalid_github_mcp_options');
 let client:Client|undefined,transport:StdioClientTransport|undefined,directory:string|undefined;
 let connection:Readonly<ConnectionConfig>|undefined,authority:AdapterAccess|undefined;
 let server:Readonly<{name:string;version:string}>|undefined;
 let state:GitHubMcpAdapterStatus['state']='stopped';
 let tools:GitHubMcpTool[]=[];
 let credentialFingerprint:string|undefined;
 let lifetime=new AbortController(),stopping=false;
 let tail:Promise<unknown>=Promise.resolve();
 const unavailable=()=>Error('github_mcp_unavailable');
 function enqueue<T>(work:()=>Promise<T>):Promise<T>{
  const result=tail.then(work);tail=result.catch(()=>{});return result;
 }
 function ensure(signal?:AbortSignal):void{
  let allowed=false;
  try{allowed=authority?.check()===true;}catch{/* Authority details stay private. */}
  if(stopping||lifetime.signal.aborted||signal?.aborted||!allowed)throw unavailable();
 }
 async function release():Promise<void>{
  // Retain failed cleanup handles so a subsequent stop can retry release.
  let failed=false;
  try{if(client){await client.close();client=undefined;}}catch{failed=true;}
  try{if(transport){await transport.close();transport=undefined;}}catch{failed=true;}
  try{if(directory){await rm(directory,{recursive:true,force:true});directory=undefined;}}catch{failed=true;}
  tools=[];server=undefined;credentialFingerprint=undefined;
  if(failed)throw unavailable();
 }
 async function operation<T>(work:(signal:AbortSignal)=>Promise<T>,signal?:AbortSignal):Promise<T>{
  const deadline=new AbortController();
  const timer=setTimeout(()=>deadline.abort(),timeoutMs);
  const combined=AbortSignal.any([lifetime.signal,deadline.signal,...(signal?[signal]:[])]);
  let rejectAbort:(error:Error)=>void=()=>{};
  const aborted=new Promise<never>((_resolve,reject)=>{rejectAbort=reject;});
  const abort=()=>rejectAbort(unavailable());
  combined.addEventListener('abort',abort,{once:true});
  try{
   // Install rejection handlers before authority checks can abort the lifetime.
   const result=await Promise.race([Promise.resolve().then(()=>{ensure(combined);return work(combined);}),aborted]);
   ensure(combined);return result;
  }catch{
   lifetime.abort();state='error';
   try{await release();}catch{/* stop remains responsible for retrying release. */}
   throw unavailable();
  }finally{clearTimeout(timer);combined.removeEventListener('abort',abort);}
 }
 async function discover(signal:AbortSignal):Promise<GitHubMcpTool[]>{
  const discovered:GitHubMcpTool[]=[],names=new Set<string>(),cursors=new Set<string>();
  let cursor:string|undefined;
  // Explicit rejection rather than silently reporting a truncated successful catalog.
  for(let page=0;page<1024;page++){
   ensure(signal);
   const result=await client!.listTools(cursor?{cursor}:{},{signal,timeout:timeoutMs});
   ensure(signal);
   for(const tool of result.tools){
    if(!tool.name||names.has(tool.name))throw unavailable();
    names.add(tool.name);discovered.push(tool);
   }
   cursor=result.nextCursor;
   if(!cursor){tools=discovered;return structuredClone(tools);}
   if(cursors.has(cursor))throw unavailable();
   cursors.add(cursor);
  }
  throw unavailable();
 }
 return Object.freeze({
  start(input:Readonly<ConnectionConfig>,access:AdapterAccess,signal?:AbortSignal):Promise<void>{
   // Capture synchronously, before the caller can mutate its configuration.
   const captured=Object.freeze({...input});
   return enqueue(async()=>{
    if(state==='connected'){
     if(JSON.stringify(connection)!==JSON.stringify(captured))
      throw Error('github_mcp_connection_mismatch');
     const previous=authority;authority=access;
     await operation(async combined=>{
      // A session is reusable; the previous invocation's authorization is not.
      if(previous!==access){
       const token=await resolveCredential(captured,access);ensure(combined);
       if(typeof token!=='string'||!token||createHash('sha256').update(token).digest('hex')!==credentialFingerprint)
        throw unavailable();
      }
     },signal);return;
    }
    if(stopping)throw unavailable();
    // A failed session needs explicit stop before reuse: no implicit reconnect/replay.
    if(state!=='stopped')throw unavailable();
    connection=captured;authority=access;lifetime=new AbortController();state='starting';
    await operation(async combined=>{
     ensure(combined);
     if(captured.adapter!=='github'||captured.endpoint!=='https://api.github.com'||
      !captured.enabled||!captured.id||!captured.credentialRef)throw unavailable();
     const hash=createHash('sha256');
     for await(const chunk of createReadStream(runtime.command,{signal:combined}))hash.update(chunk);
     if(hash.digest('hex')!==runtime.expectedSha256)throw unavailable();
     ensure(combined);
     const token=await resolveCredential(captured,access);
     ensure(combined);
     if(typeof token!=='string'||!token||/[\u0000-\u0020\u007f]/.test(token))throw unavailable();
     credentialFingerprint=createHash('sha256').update(token).digest('hex');
     directory=await mkdtemp(join(tmpdir(),'wex-github-mcp-'));
     ensure(combined);
     transport=new StdioClientTransport({
      command:runtime.command,args:[...runtime.prefixArgs,'stdio','--toolsets=all'],
      cwd:directory,stderr:'ignore',
      env:{GITHUB_PERSONAL_ACCESS_TOKEN:token,GITHUB_HOST:'https://github.com',
       HOME:directory,USERPROFILE:directory,APPDATA:directory,LOCALAPPDATA:directory},
     });
     client=new Client({name:'WEXPCeasy',version:'0.1.1'});
     const sessionLifetime=lifetime;
     client.onclose=()=>{
      if(lifetime!==sessionLifetime||sessionLifetime.signal.aborted||stopping)return;
      state='error';tools=[];server=undefined;sessionLifetime.abort();
     };
     await client.connect(transport,{signal:combined,timeout:timeoutMs});
     ensure(combined);
     const observed=client.getServerVersion();
     if(observed?.name!=='github-mcp-server')throw unavailable();
     server=Object.freeze({...observed});
     await discover(combined);state='connected';
    },signal);
   });
  },
  listTools(signal?:AbortSignal):Promise<GitHubMcpTool[]>{
   return enqueue(async()=>{
    if(state!=='connected')throw unavailable();
    return operation(discover,signal);
   });
  },
  callTool(name:string,args:Record<string,Json>,signal?:AbortSignal):Promise<GitHubMcpToolResult>{
   // Snapshot now so a queued mutation cannot retarget an authorized operation.
   let captured:Record<string,Json>;
   try{captured=structuredClone(args);}catch{return Promise.reject(Error('invalid_github_mcp_arguments'));}
   if(!captured||typeof captured!=='object'||Array.isArray(captured))
    return Promise.reject(Error('invalid_github_mcp_arguments'));
   return enqueue(async()=>{
    if(state!=='connected')throw unavailable();
    // Check access even when the requested tool does not exist.
    await operation(async()=>{},signal);
    if(!tools.some(tool=>tool.name===name))throw Error('github_mcp_tool_unavailable');
    return operation(async combined=>{
     ensure(combined);
     return client!.callTool({name,arguments:captured},undefined,{signal:combined,timeout:timeoutMs});
    },signal);
   });
  },
  status():Readonly<GitHubMcpAdapterStatus>{
   return Object.freeze({state,...(connection?{connectionId:connection.id}:{}),
    ...(server?{server:Object.freeze({...server})}:{}),toolCount:tools.length});
  },
  stop():Promise<void>{
   stopping=true;lifetime.abort();
   return enqueue(async()=>{
    try{await release();connection=undefined;authority=undefined;state='stopped';}
    catch{state='error';throw unavailable();}
    finally{stopping=false;}
   });
  },
 });
}
