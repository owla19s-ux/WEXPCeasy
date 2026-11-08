import {capabilityDiscoveryTarget,capabilityInvocationTarget,captureCapabilityArguments} from './capabilities.js';
import type {ConfiguredCapabilityAdapter} from './capabilities.js';
import type {AdapterAccess} from './adapter-access.js';
import {createConfiguredReadBoundary} from './configured-read.js';
import type {ConfiguredReadAdapter} from './configured-read.js';
import type {ReadResult} from './read.js';
import type {Store,Json} from '../../shared/src/index.js';
import type {PermissionReader} from '../../permissions/src/index.js';
import {createConnectionConfigs} from './config.js';
import type {ConnectionConfig,ConfigResult,ConfigRemovalResult} from './config.js';
import {createOperationLedger} from './operations.js';
import {createConfiguredDispatchBoundary} from './configured-dispatch.js';
import type {ConfiguredDispatchAdapter} from './configured-dispatch.js';
import type {DispatchResult} from './dispatch.js';

/** Trusted built-in adapter assembly; no dynamic discovery, probing or implicit grants. */
export function createConnectionService(permission:PermissionReader,configStore:Store,operationStore:Store,adapters:readonly ConfiguredDispatchAdapter[],options:{shutdownTimeoutMs?:number;readAdapters?:readonly ConfiguredReadAdapter[];capabilityAdapters?:readonly ConfiguredCapabilityAdapter[]}={}){
 const timeout=options.shutdownTimeoutMs??1000;
 if(!Number.isFinite(timeout)||timeout<=0)throw Error('invalid_shutdown_timeout');
 if(adapters.some(a=>!a||typeof a.id!=='string'||!a.id||typeof a.version!=='string'||!a.version||typeof a.execute!=='function')||new Set(adapters.map(a=>a.id)).size!==adapters.length)throw Error('invalid_adapters');
 const readers=options.readAdapters??[];
 if(readers.some(a=>!a||typeof a.id!=='string'||!a.id||typeof a.version!=='string'||!a.version||typeof a.read!=='function')||new Set(readers.map(a=>a.id)).size!==readers.length)throw Error('invalid_read_adapters');
 const capabilities=options.capabilityAdapters??[];
 if(capabilities.some(a=>!a||typeof a.id!=='string'||!a.id||typeof a.version!=='string'||!a.version||
  typeof a.discover!=='function'||typeof a.invoke!=='function'||typeof a.stop!=='function')||
  new Set(capabilities.map(a=>a.id)).size!==capabilities.length)throw Error('invalid_capability_adapters');
 const toolAdapters=new Map(capabilities.map(a=>[a.id,a]));
 const shutdown=new AbortController();
 const unreleased=new Set(capabilities),closing=new Map<ConfiguredCapabilityAdapter,Promise<void>>();
 const configs=createConnectionConfigs(configStore),ledger=createOperationLedger(operationStore);
 configs.read();ledger.read(); // Corrupt domain data must not be presented as an empty ready service.
 const boundaries=new Map(adapters.map(a=>[a.id,createConfiguredDispatchBoundary(permission,ledger,configs,a)]));
 const readBoundaries=new Map(readers.map(a=>[a.id,createConfiguredReadBoundary(permission,configs,a)]));
 const pending=new Set<Promise<void>>();let stopping=false;
 function live<T>(read:()=>T):T {if(stopping)throw Error('connections_stopping');return read();}
 const client=Object.freeze({
  configs:Object.freeze({
   read:()=>live(configs.read),get:(id:string)=>live(()=>configs.get(id)),
   put:(config:ConnectionConfig,revision:number,intent:string):ConfigResult=>stopping?{status:'unavailable',reason:'connections_stopping'}:configs.put(config,revision,intent),
   remove:(id:string,revision:number,intent:string):ConfigRemovalResult=>stopping?{status:'unavailable',reason:'connections_stopping'}:configs.remove(id,revision,intent)
  }),
  operations:Object.freeze({read:()=>live(ledger.read),get:(id:string)=>live(()=>ledger.get(id))}),
  async discover(adapterId:string,request:object,connectionId:string,revision:number,signal=new AbortController().signal):Promise<ReadResult>{
   if(stopping)return {status:'unavailable',reason:'connections_stopping'};
   const adapter=toolAdapters.get(adapterId);if(!adapter)return {status:'unavailable',reason:'adapter_unavailable'};
   let target:string;
   try{target=capabilityDiscoveryTarget(adapterId,connectionId);}catch{return {status:'unavailable',reason:'invalid_request'};}
   const combined=AbortSignal.any([signal,shutdown.signal]);
   let finish!:()=>void;
   const token=new Promise<void>(resolve=>{finish=resolve;});pending.add(token);
   try{
    return await createConfiguredReadBoundary(permission,configs,{
     get id(){return adapter.id;},get version(){return adapter.version;},
     async read(connection,_target,currentSignal,access){
      if(!access)throw Error('capability_access_unavailable');
      return adapter.discover(connection,currentSignal,access);
     },
    }).read(request,connectionId,revision,target,combined);
   }finally{pending.delete(token);finish();}
  },
  /** Generic execution uses the existing write-authorized dispatch and Operation boundary.
   * readOnlyHint is metadata, never a substitute for a trusted execution grant.
   * The raw tool result is an observation; isError is preserved rather than called success.
   */
  async invoke(adapterId:string,request:object,id:string,connectionId:string,revision:number,name:string,args:Record<string,Json>,fingerprint:string,signal=new AbortController().signal):Promise<DispatchResult>{
   const blocked=(reason:string):DispatchResult=>({status:'blocked',reason,operationId:id});
   if(stopping)return blocked('connections_stopping');
   if(signal.aborted)return blocked('aborted');
   const adapter=toolAdapters.get(adapterId);if(!adapter)return blocked('adapter_unavailable');
   let target:string,captured:Record<string,Json>;
   try{captured=captureCapabilityArguments(args);target=capabilityInvocationTarget(adapterId,connectionId,name,captured);}
   catch{return blocked('invalid_request');}
   const combined=AbortSignal.any([signal,shutdown.signal]);
   let finish!:()=>void;
   const token=new Promise<void>(resolve=>{finish=resolve;});pending.add(token);
   try{
    return await createConfiguredDispatchBoundary(permission,ledger,configs,{
     get id(){return adapter.id;},get version(){return adapter.version;},
     async execute(connection,_target,payload,access){
      if(!access||combined.aborted||stopping)throw Error('capability_access_unavailable');
      const scoped:AdapterAccess=Object.freeze({request:access.request,check:()=>!stopping&&!combined.aborted&&access.check()});
      const call=payload as {name:string;args:Record<string,Json>};
      if(!scoped.check())throw Error('capability_access_unavailable');
      const result=await adapter.invoke(connection,call.name,call.args,combined,scoped);
      if(!scoped.check())throw Error('capability_access_unavailable');
      return result;
     },
    }).dispatch(request,id,connectionId,revision,target,fingerprint,{name,args:captured});
   }finally{pending.delete(token);finish();}
  },
  async read(adapterId:string,request:object,connectionId:string,revision:number,target:string,signal?:AbortSignal):Promise<ReadResult>{
   if(stopping)return {status:'unavailable',reason:'connections_stopping'};
   const boundary=readBoundaries.get(adapterId);if(!boundary)return {status:'unavailable',reason:'adapter_unavailable'};
   let finish!:()=>void;
   const token=new Promise<void>(resolve=>{finish=resolve;});pending.add(token);
   try{return await boundary.read(request,connectionId,revision,target,signal);}
   finally{pending.delete(token);finish();}
  },
  async dispatch(adapterId:string,request:object,id:string,connectionId:string,revision:number,target:string,fingerprint:string,payload:Json):Promise<DispatchResult>{
   if(stopping)return {status:'blocked',reason:'connections_stopping',operationId:id};
   const boundary=boundaries.get(adapterId);
   if(!boundary)return {status:'blocked',reason:'adapter_unavailable',operationId:id};
   // Register before entering any trusted dependency or adapter callback (reentrancy).
   let finish!:()=>void;
   const token=new Promise<void>(resolve=>{finish=resolve;});pending.add(token);
   try{return await boundary.dispatch(request,id,connectionId,revision,target,fingerprint,payload);}
   finally{pending.delete(token);finish();}
  }
 });
 return Object.freeze({...client,
  async stop():Promise<{status:'stopped'|'incomplete'}>{
   stopping=true;shutdown.abort();
   // Release connector resources while in-flight calls settle their existing receipts.
   // Failed releases remain owned and are retried by the next stop(), never forgotten.
   for(const adapter of unreleased)if(!closing.has(adapter)){
    const release=Promise.resolve().then(()=>adapter.stop()).then(()=>{unreleased.delete(adapter);},()=>{})
     .finally(()=>{closing.delete(adapter);});
    closing.set(adapter,release);
   }
   if(!pending.size&&!unreleased.size)return {status:'stopped'};
   let timer:ReturnType<typeof setTimeout>|undefined;
   try{
    await Promise.race([Promise.all([...pending,...closing.values()]),new Promise<void>(resolve=>{timer=setTimeout(resolve,timeout);})]);
    return {status:pending.size||unreleased.size?'incomplete':'stopped'};
   }finally{if(timer)clearTimeout(timer);}
  }
 });
}
export type ConnectionService=ReturnType<typeof createConnectionService>;
export type ConnectionClient=Pick<ConnectionService,'configs'|'operations'|'dispatch'|'read'>;

export type ConnectionCapabilityClient=Pick<ConnectionService,'discover'|'invoke'>;
