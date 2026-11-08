import {createHash} from 'node:crypto';
import type {Json} from '../../shared/src/index.js';
import type {PermissionReader} from '../../permissions/src/index.js';
import type {AdapterAccess} from './adapter-access.js';
import type {ConnectionConfig,createConnectionConfigs} from './config.js';
import type {createOperationLedger} from './operations.js';
import {createConfiguredReadBoundary} from './configured-read.js';
import {createConfiguredDispatchBoundary} from './configured-dispatch.js';

export interface ConfiguredCapabilityAdapter {
 readonly id:string;readonly version:string;
 discover(connection:Readonly<ConnectionConfig>,signal:AbortSignal,access:AdapterAccess):Promise<Json>;
 invoke(connection:Readonly<ConnectionConfig>,toolName:string,args:Readonly<Record<string,Json>>,access:AdapterAccess):Promise<Json>;
 stop():Promise<void>;
}
function canonical(value:Json,seen=new Set<object>()):string{
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(typeof value!=='object'||seen.has(value))throw Error('invalid_tool_arguments');
 seen.add(value);
 try{
  if(Array.isArray(value))return '['+Array.from(value,v=>canonical(v,seen)).join(',')+']';
  if(Object.getPrototypeOf(value)!==Object.prototype)throw Error('invalid_tool_arguments');
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k]!,seen)).join(',')+'}';
 }finally{seen.delete(value);}
}
function identifier(value:string):void{
 if(typeof value!=='string'||!value)throw Error('invalid_capability_target');
}
export function connectionToolsTarget(connectionId:string):string{
 identifier(connectionId);return 'connection-tools:'+JSON.stringify(connectionId);
}
/** Exact connection/tool/argument binding, without copying argument secrets into permission targets. */
export function connectionToolTarget(connectionId:string,toolName:string,args:Readonly<Record<string,Json>>):string{
 identifier(connectionId);identifier(toolName);
 if(!args||typeof args!=='object'||Array.isArray(args))throw Error('invalid_tool_arguments');
 const hash=createHash('sha256').update(canonical(args)).digest('hex');
 return 'connection-tool:'+JSON.stringify([connectionId,toolName,hash]);
}
/** Generic tools use the existing controlled-dispatch permission and Operation semantics.
 * No tool is classified as safe or granted permission from its MCP annotations.
 */
export function createConfiguredCapabilityBoundary(permission:PermissionReader,ledger:ReturnType<typeof createOperationLedger>,configs:ReturnType<typeof createConnectionConfigs>,adapter:ConfiguredCapabilityAdapter){
 return Object.freeze({
  async discover(request:object,connectionId:string,revision:number,signal?:AbortSignal){
   try{
    const target=connectionToolsTarget(connectionId);
    return await createConfiguredReadBoundary(permission,configs,{
     get id(){return adapter.id;},get version(){return adapter.version;},
     async read(connection,actual,cancellation,access){
      if(actual!==connectionToolsTarget(connection.id)||!access)throw Error('invalid_capability_target');
      return adapter.discover(connection,cancellation,access);
     },
    }).read(request,connectionId,revision,target,signal);
   }catch{return {status:'unavailable' as const,reason:'invalid_request'};}
  },
  async invoke(request:object,id:string,connectionId:string,revision:number,toolName:string,args:Readonly<Record<string,Json>>,fingerprint:string){
   try{
    // Bind the same immutable arguments to authorization, intent fingerprint and adapter call.
    const captured=structuredClone(args),target=connectionToolTarget(connectionId,toolName,captured);
    return await createConfiguredDispatchBoundary(permission,ledger,configs,{
     get id(){return adapter.id;},get version(){return adapter.version;},
     async execute(connection,actual,payload,access){
      if(!access||!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('invalid_capability_call');
      const name=payload['toolName'],values=payload['arguments'];
      if(typeof name!=='string'||!values||typeof values!=='object'||Array.isArray(values)||
       connectionToolTarget(connection.id,name,values)!==actual)throw Error('invalid_capability_call');
      return adapter.invoke(connection,name,values,access);
     },
    }).dispatch(request,id,connectionId,revision,target,fingerprint,{toolName,arguments:captured});
   }catch{return {status:'blocked' as const,reason:'invalid_request',operationId:id};}
  },
 });
}
