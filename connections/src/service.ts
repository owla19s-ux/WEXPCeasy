import type {Store,Json} from '../../shared/src/index.js';
import type {PermissionReader} from '../../permissions/src/index.js';
import {createConnectionConfigs} from './config.js';
import type {ConnectionConfig,ConfigResult,ConfigRemovalResult} from './config.js';
import {createOperationLedger} from './operations.js';
import {createConfiguredDispatchBoundary} from './configured-dispatch.js';
import type {ConfiguredDispatchAdapter} from './configured-dispatch.js';
import type {DispatchResult} from './dispatch.js';

/** Trusted built-in adapter assembly; no dynamic discovery, probing or implicit grants. */
export function createConnectionService(permission:PermissionReader,configStore:Store,operationStore:Store,adapters:readonly ConfiguredDispatchAdapter[],options:{shutdownTimeoutMs?:number}={}){
 const timeout=options.shutdownTimeoutMs??1000;
 if(!Number.isFinite(timeout)||timeout<=0)throw Error('invalid_shutdown_timeout');
 if(adapters.some(a=>!a||typeof a.id!=='string'||!a.id||typeof a.version!=='string'||!a.version||typeof a.execute!=='function')||new Set(adapters.map(a=>a.id)).size!==adapters.length)throw Error('invalid_adapters');
 const configs=createConnectionConfigs(configStore),ledger=createOperationLedger(operationStore);
 configs.read();ledger.read(); // Corrupt domain data must not be presented as an empty ready service.
 const boundaries=new Map(adapters.map(a=>[a.id,createConfiguredDispatchBoundary(permission,ledger,configs,a)]));
 const pending=new Set<Promise<void>>();let stopping=false;
 function live<T>(read:()=>T):T {if(stopping)throw Error('connections_stopping');return read();}
 const client=Object.freeze({
  configs:Object.freeze({
   read:()=>live(configs.read),get:(id:string)=>live(()=>configs.get(id)),
   put:(config:ConnectionConfig,revision:number,intent:string):ConfigResult=>stopping?{status:'unavailable',reason:'connections_stopping'}:configs.put(config,revision,intent),
   remove:(id:string,revision:number,intent:string):ConfigRemovalResult=>stopping?{status:'unavailable',reason:'connections_stopping'}:configs.remove(id,revision,intent)
  }),
  operations:Object.freeze({read:()=>live(ledger.read),get:(id:string)=>live(()=>ledger.get(id))}),
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
   if(!pending.size)return {status:'stopped'};
   let timer:ReturnType<typeof setTimeout>|undefined;
   try{
    await Promise.race([Promise.all([...pending]),new Promise<void>(resolve=>{timer=setTimeout(resolve,timeout);})]);
    return {status:pending.size?'incomplete':'stopped'};
   }finally{if(timer)clearTimeout(timer);}
  }
 });
}
export type ConnectionService=ReturnType<typeof createConnectionService>;
export type ConnectionClient=Pick<ConnectionService,'configs'|'operations'|'dispatch'>;
