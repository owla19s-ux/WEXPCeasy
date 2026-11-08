import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {tmpdir} from 'node:os';
import type {AdapterAccess,ConnectionConfig} from '../../src/index.js';
import type {GitHubMcpOptions} from './mcp-options.js';
type Tool=Awaited<ReturnType<Client['listTools']>>['tools'][number];

export interface GitHubMcpAdapterOptions extends GitHubMcpOptions {
 /** Trusted host runtime selection; omitted toolsets enables all official toolsets. */
 toolsets?:readonly string[];
 readOnly?:boolean;
}
export type GitHubMcpToolResult=Awaited<ReturnType<Client['callTool']>>;
export interface GitHubMcpAdapter {
 start(signal:AbortSignal,access:AdapterAccess):Promise<void>;
 listTools(signal:AbortSignal,access:AdapterAccess):Promise<Tool[]>;
 callTool(name:string,args:Record<string,unknown>,signal:AbortSignal,access:AdapterAccess):Promise<GitHubMcpToolResult>;
 status():Readonly<{state:'disconnected'|'connected'|'stopped';serverVersion?:Readonly<{name:string;version:string}>}>;
 stop():Promise<void>;
}
interface Session {
 client:Client;transport:StdioClientTransport;directory:string;
 fingerprint:string;connected:boolean;
}

/** Trusted-host adapter bound to one captured connection and runtime.
 * Each invocation needs fresh AdapterAccess and credential resolution. A live session is
 * transport reuse, never an authorization grant. Mutations must be invoked by the
 * Connections Operation boundary; this adapter neither grants access nor retries calls.
 */
export function createGitHubMcpAdapter(connection:Readonly<ConnectionConfig>,options:GitHubMcpAdapterOptions):GitHubMcpAdapter {
 const current=Object.freeze({...connection});
 const toolsets=Object.freeze([...(options.toolsets??['all'])]),readOnly=options.readOnly??false;
 const runtime=Object.freeze({...options.runtime,prefixArgs:Object.freeze([...(options.runtime.prefixArgs??[])])});
 const resolveCredential=options.resolveCredential,timeoutMs=options.timeoutMs??15000;
 if(current.adapter!=='github'||current.endpoint!=='https://api.github.com'||!current.enabled||
  typeof current.id!=='string'||!current.id||!current.credentialRef||
  toolsets.some(name=>typeof name!=='string'||!/^[a-z][a-z0-9_]*$/.test(name))||typeof readOnly!=='boolean'||
  !isAbsolute(runtime.command)||!/^[0-9a-f]{64}$/.test(runtime.expectedSha256)||
  runtime.prefixArgs.some(arg=>typeof arg!=='string'||arg.includes(String.fromCharCode(0)))||
  typeof resolveCredential!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)
  throw Error('invalid_github_mcp_options');
 let session:Session|undefined;
 let tail:Promise<unknown>=Promise.resolve(),stopping=false,stopped=false,stopPromise:Promise<void>|undefined;
 const shutdown=new AbortController();
 async function dispose():Promise<void>{
  const previous=session;
  if(!previous)return;
  previous.connected=false;
  // Retain failed cleanup for stop() to retry; never claim resources were released.
  let failed=false;
  try{await previous.client.close();}catch{failed=true;}
  try{await previous.transport.close();}catch{failed=true;}
  try{await rm(previous.directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch{failed=true;}
  if(failed)throw Error('github_mcp_unavailable');
  if(session===previous)session=undefined;
 }
 function run<T>(signal:AbortSignal,access:AdapterAccess,work:(s:Session,ensure:()=>void,request:{signal:AbortSignal;timeout:number},dispatched:()=>void)=>Promise<T>):Promise<T>{
  const job=tail.then(async()=>{
   const deadline=new AbortController();
   const combined=AbortSignal.any([signal,deadline.signal,shutdown.signal]);
   const authorized=()=>{try{return access?.check()===true;}catch{return false;}};
   const ensure=()=>{if(stopping||combined.aborted||!authorized())throw Error('github_mcp_unavailable');};
   const timer=setTimeout(()=>deadline.abort(),timeoutMs);
   const revocation=setInterval(()=>{if(!authorized())deadline.abort();},50);
   const request={signal:combined,timeout:timeoutMs};
   let dispatched=false;
   let rejectAbort:(reason:Error)=>void=()=>{};
   const aborted=new Promise<never>((_resolve,reject)=>{rejectAbort=reject;});
   // The rejection is also handled while hashing/initializing rather than awaiting the resolver.
   void aborted.catch(()=>{});
   const abort=()=>rejectAbort(Error('github_mcp_unavailable'));
   combined.addEventListener('abort',abort,{once:true});
   try{
    ensure();
    const hash=createHash('sha256');
    for await(const chunk of createReadStream(runtime.command,{signal:combined}))hash.update(chunk);
    if(hash.digest('hex')!==runtime.expectedSha256)throw Error('github_mcp_unavailable');
    ensure();
    const token=await Promise.race([Promise.resolve().then(()=>{ensure();return resolveCredential(current,access);}),aborted]);
    ensure();
    if(typeof token!=='string'||!token||/[\u0000-\u0020\u007f]/.test(token))throw Error('github_mcp_unavailable');
    const fingerprint=createHash('sha256').update(token).digest('hex');
    if(session&&(!session.connected||session.fingerprint!==fingerprint))await dispose();
    ensure();
    if(!session){
     const directory=await mkdtemp(join(tmpdir(),'wex-github-mcp-'));
     // Assign resources before any cancellable await so all failure paths release them.
     const transport=new StdioClientTransport({
      command:runtime.command,args:[...runtime.prefixArgs,'stdio','--toolsets='+toolsets.join(','),...(readOnly?['--read-only']:[])],
      cwd:directory,stderr:'ignore',
      env:{GITHUB_PERSONAL_ACCESS_TOKEN:token,GITHUB_HOST:'https://github.com',
       HOME:directory,USERPROFILE:directory,APPDATA:directory,LOCALAPPDATA:directory},
     });
     // SDK connect() closes asynchronously when initialization fails. Join that
     // same close promise rather than racing another close against directory removal.
     const closeTransport=transport.close.bind(transport);
     let closing:Promise<void>|undefined;
     transport.close=()=>closing??=(closeTransport());
     const client=new Client({name:'WEXPCeasy',version:'0.1.1'});
     const created:Session={client,transport,directory,fingerprint,connected:false};
     session=created;
     client.onclose=()=>{created.connected=false;};
     ensure();
     await client.connect(transport,request);ensure();
     const version=client.getServerVersion();
     // Protocol negotiation belongs to the SDK, not a hardcoded server release number.
     if(version?.name!=='github-mcp-server')throw Error('github_mcp_unavailable');
     created.connected=true;
    }
    ensure();
    return await work(session,ensure,request,()=>{dispatched=true;});
   }catch(error){
    const unavailableTool=!dispatched&&error instanceof Error&&error.message==='github_mcp_tool_unavailable';
    if(!unavailableTool)await dispose();
    if(dispatched)throw Error('github_mcp_outcome_unconfirmed');
    throw Error(unavailableTool?'github_mcp_tool_unavailable':'github_mcp_unavailable');
   }finally{
    clearTimeout(timer);clearInterval(revocation);combined.removeEventListener('abort',abort);
   }
  });
  tail=job.catch(()=>{});
  return job;
 }
 async function discover(s:Session,ensure:()=>void,request:{signal:AbortSignal;timeout:number}):Promise<Tool[]>{
  const tools:Tool[]=[],names=new Set<string>(),cursors=new Set<string>();
  let cursor:string|undefined;
  do{
   ensure();
   const page=await s.client.listTools(cursor===undefined?{}:{cursor},request);ensure();
   for(const tool of page.tools){
    if(names.has(tool.name))throw Error('github_mcp_unavailable');
    names.add(tool.name);tools.push(tool);
   }
   cursor=page.nextCursor;
   if(cursor!==undefined){
    if(cursors.has(cursor))throw Error('github_mcp_unavailable');
    cursors.add(cursor);
   }
  }while(cursor!==undefined);
  return tools;
 }
 return Object.freeze({
  start:(signal:AbortSignal,access:AdapterAccess)=>run(signal,access,async()=>{}),
  listTools:(signal:AbortSignal,access:AdapterAccess)=>run(signal,access,discover),
  callTool(name:string,args:Record<string,unknown>,signal:AbortSignal,access:AdapterAccess){
   let captured:Record<string,unknown>;
   try{
    if(typeof name!=='string'||!name||!args||typeof args!=='object'||Array.isArray(args))throw Error();
    captured=structuredClone(args);
   }catch{return Promise.reject(Error('github_mcp_tool_unavailable'));}
   return run(signal,access,async(s,ensure,request,dispatched)=>{
    // Refresh the actual catalogue before dispatch, including tool-list changes.
    const tools=await discover(s,ensure,request);
    if(!tools.some(tool=>tool.name===name))throw Error('github_mcp_tool_unavailable');
    ensure();dispatched();
    const result=await s.client.callTool({name,arguments:captured},undefined,request);
    ensure();return result;
   });
  },
  status(){
   const version=session?.connected?session.client.getServerVersion():undefined;
   return Object.freeze({state:stopped?'stopped' as const:session?.connected?'connected' as const:'disconnected' as const,
    ...(version?{serverVersion:Object.freeze({name:version.name,version:version.version})}:{})});
  },
  stop(){
   if(stopPromise)return stopPromise;
   stopping=true;shutdown.abort();
   const pending=(async()=>{await tail;await dispose();stopped=true;})();
   stopPromise=pending;
   void pending.catch(()=>{stopPromise=undefined;});
   return pending;
  },
 });
}
