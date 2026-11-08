import {Octokit} from 'octokit';
import type {ConnectionConfig,AdapterAccess} from '../../src/index.js';
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

function capture(connection:Readonly<ConnectionConfig>):Readonly<ConnectionConfig> {
 if(connection.adapter!=='github'||connection.endpoint!=='https://api.github.com'||!connection.enabled)throw Error('github_connection_unavailable');
 return Object.freeze({...connection});
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

