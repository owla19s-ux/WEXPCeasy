import {createConfiguredCapabilityBoundary} from './capabilities.js';
import type {ConfiguredCapabilityAdapter} from './capabilities.js';
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
 const capabilities=[...(options.capabilityAdapters??[])];
 if(capabilities.some(a=>!a||typeof a.id!=='string'||!a.id||typeof a.version!=='string'||!a.version||
  typeof a.discover!=='function'||typeof a.invoke!=='function'||typeof a.stop!=='function')||
  new Set(capabilities.map(a=>a.id)).size!==capabilities.length)throw Error('invalid_capability_adapters');
 const configs=createConnectionConfigs(configStore),ledger=createOperationLedger(operationStore);
 configs.read();ledger.read(); // Corrupt domain data must not be presented as an empty ready service.
 const boundaries=new Map(adapters.map(a=>[a.id,createConfiguredDispatchBoundary(permission,ledger,configs,a)]));
 const readBoundaries=new Map(readers.map(a=>[a.id,createConfiguredReadBoundary(permission,configs,a)]));
 const capabilityBoundaries=new Map(capabilities.map(a=>[a.id,createConfiguredCapabilityBoundary(permission,ledger,configs,a)]));
 const released=new Set<ConfiguredCapabilityAdapter>();let closing:Promise<{status:'stopped'|'incomplete'}>|undefined;
 async function releaseCapabilities():Promise<{status:'stopped'|'incomplete'}>{
  if(closing)return closing;
  const job=Promise.resolve().then(async()=>{
   let failed=false;
   for(const adapter of capabilities)if(!released.has(adapter)){
    try{await adapter.stop();released.add(adapter);}catch{failed=true;}
   }
   return {status:failed?'incomplete' as const:'stopped' as const};
  });
  closing=job;
  try{return await job;}finally{if(closing===job)closing=undefined;}
 }
 const pending=new Set<Promise<void>>();let stopping=false;
 function live<T>(read:()=>T):T {if(stopping)throw Error('connections_stopping');return read();}
 const client=Object.freeze({
  configs:Object.freeze({
   read:()=>live(configs.read),get:(id:string)=>live(()=>configs.get(id)),
   put:(config:ConnectionConfig,revision:number,intent:string):ConfigResult=>stopping?{status:'unavailable',reason:'connections_stopping'}:configs.put(config,revision,intent),
   remove:(id:string,revision:number,intent:string):ConfigRemovalResult=>stopping?{status:'unavailable',reason:'connections_stopping'}:configs.remove(id,revision,intent)
  }),
  operations:Object.freeze({read:()=>live(ledger.read),get:(id:string)=>live(()=>ledger.get(id))}),
  async discover(adapterId:string,request:object,connectionId:string,revision:number,signal?:AbortSignal):Promise<ReadResult>{
   if(stopping)return {status:'unavailable',reason:'connections_stopping'};
   const boundary=capabilityBoundaries.get(adapterId);if(!boundary)return {status:'unavailable',reason:'adapter_unavailable'};
   let finish!:()=>void;const token=new Promise<void>(resolve=>{finish=resolve;});pending.add(token);
   try{return await boundary.discover(request,connectionId,revision,signal);}
   finally{pending.delete(token);finish();}
  },
  async invoke(adapterId:string,request:object,id:string,connectionId:string,revision:number,toolName:string,args:Readonly<Record<string,Json>>,fingerprint:string):Promise<DispatchResult>{
   if(stopping)return {status:'blocked',reason:'connections_stopping',operationId:id};
   const boundary=capabilityBoundaries.get(adapterId);if(!boundary)return {status:'blocked',reason:'adapter_unavailable',operationId:id};
   let finish!:()=>void;const token=new Promise<void>(resolve=>{finish=resolve;});pending.add(token);
   try{return await boundary.invoke(request,id,connectionId,revision,toolName,args,fingerprint);}
   finally{pending.delete(token);finish();}
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
   stopping=true;
   let timer:ReturnType<typeof setTimeout>|undefined;
   const drained=(async()=>{
    if(pending.size)await Promise.all([...pending]);
    return releaseCapabilities();
   })();
   try{
    return await Promise.race([drained,new Promise<{status:'incomplete'}>(resolve=>{
     timer=setTimeout(()=>resolve({status:'incomplete'}),timeout);
    })]);
   }finally{if(timer)clearTimeout(timer);}
  }
 });
}
export type ConnectionService=ReturnType<typeof createConnectionService>;
export type ConnectionClient=Pick<ConnectionService,'configs'|'operations'|'dispatch'|'read'|'discover'|'invoke'>;
