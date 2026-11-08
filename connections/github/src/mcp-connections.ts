import {isDeepStrictEqual} from 'node:util';
import type {Json} from '../../../shared/src/index.js';
import type {AdapterAccess,ConnectionConfig,ConfiguredCapabilityAdapter} from '../../src/index.js';
import {createGitHubMcpAdapter} from './mcp.js';
import type {GitHubMcpAdapter,GitHubMcpAdapterOptions} from './mcp.js';

/** Transient transport cache only. Configs, authorization and Operations stay in Connections. */
export function createGitHubMcpCapabilityAdapter(options:GitHubMcpAdapterOptions):ConfiguredCapabilityAdapter{
 const capturedOptions:GitHubMcpAdapterOptions={...options,
  runtime:{...options.runtime,prefixArgs:[...(options.runtime.prefixArgs??[])]},
  ...(options.toolsets?{toolsets:[...options.toolsets]}:{}),
 };
 const entries=new Map<string,{connection:Readonly<ConnectionConfig>;adapter:GitHubMcpAdapter}>();
 let selectionTail:Promise<unknown>=Promise.resolve(),stopping=false,stopPromise:Promise<void>|undefined;
 async function use<T>(connection:Readonly<ConnectionConfig>,signal:AbortSignal,access:AdapterAccess,work:(adapter:GitHubMcpAdapter)=>Promise<T>):Promise<T>{
  const current=Object.freeze({...connection});
  const ensure=()=>{let allowed=false;try{allowed=access?.check()===true;}catch{}
   if(stopping||signal.aborted||!allowed)throw Error('github_mcp_unavailable');};
  // Serialize creation/replacement, not calls across unrelated connection instances.
  const selection=selectionTail.then(async()=>{
   ensure();
   const previous=entries.get(current.id);
   if(previous&&isDeepStrictEqual(previous.connection,current))return previous.adapter;
   if(previous){await previous.adapter.stop();entries.delete(current.id);}
   ensure();
   const adapter=createGitHubMcpAdapter(current,capturedOptions);
   entries.set(current.id,{connection:current,adapter});
   return adapter;
  });
  selectionTail=selection.then(()=>{},()=>{});
  const adapter=await selection;ensure();return work(adapter);
 }
 return Object.freeze({
  id:'github',version:'0.1.1',
  discover(connection:Readonly<ConnectionConfig>,signal:AbortSignal,access:AdapterAccess){
   return use(connection,signal,access,adapter=>adapter.listTools(signal,access));
  },
  invoke(connection:Readonly<ConnectionConfig>,name:string,args:Record<string,Json>,signal:AbortSignal,access:AdapterAccess):Promise<Json>{
   return use(connection,signal,access,async adapter=>(await adapter.callTool(name,args,signal,access)) as unknown as Json);
  },
  stop(){
   if(stopPromise)return stopPromise;
   stopping=true;
   const pending=(async()=>{
    await selectionTail;
    let failed=false;
    await Promise.all([...entries].map(async([id,entry])=>{
     try{await entry.adapter.stop();entries.delete(id);}catch{failed=true;}
    }));
    if(failed)throw Error('github_mcp_unavailable');
   })();
   stopPromise=pending;void pending.catch(()=>{stopPromise=undefined;});return pending;
  },
 });
}
