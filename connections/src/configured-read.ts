import {isDeepStrictEqual} from 'node:util';
import type {PermissionReader} from '../../permissions/src/index.js';
import type {ConnectionConfig,createConnectionConfigs} from './config.js';
import type {AdapterAccess} from './adapter-access.js';
import {createReadBoundary} from './read.js';
import type {ReadResult} from './read.js';

export interface ConfiguredReadAdapter {
 readonly id:string;readonly version:string;
 read(connection:Readonly<ConnectionConfig>,target:string,signal:AbortSignal,access?:AdapterAccess):Promise<unknown>;
}
/** Authorize before configuration lookup; capture and recheck one connection for each individual read. */
export function createConfiguredReadBoundary(permission:PermissionReader,configs:ReturnType<typeof createConnectionConfigs>,adapter:ConfiguredReadAdapter){
 return Object.freeze({async read(request:object,connectionId:string,expectedRevision:number,target:string,signal=new AbortController().signal):Promise<ReadResult>{
  if(signal.aborted)return {status:'cancelled',reason:'aborted'};
  if(typeof connectionId!=='string'||!connectionId||typeof target!=='string'||!target||!Number.isSafeInteger(expectedRevision)||expectedRevision<1)return {status:'unavailable',reason:'invalid_request'};
  try{
   const decision=permission.evaluate(request);
   if(decision.status!=='allow')return {status:'denied',reason:'not_allowed'};
   if(decision.scope.resource!==adapter.id||decision.scope.target!==target||decision.scope.action!=='read')return {status:'denied',reason:'scope_mismatch'};
   const snapshot=configs.read();
   if(snapshot.revision!==expectedRevision)return {status:'unavailable',reason:'config_revision_conflict'};
   const config=snapshot.items.find(item=>item.id===connectionId);
   if(!config||!config.enabled||config.adapter!==adapter.id)return {status:'unavailable',reason:'connection_unavailable'};
   const version=adapter.version;
   if(typeof version!=='string'||!version)return {status:'unavailable',reason:'adapter_version_missing'};
   const captured=Object.freeze(structuredClone(config));
   const check=()=>{
    try{
     const current=configs.read(),item=current.items.find(row=>row.id===connectionId);
     return !signal.aborted&&current.revision===snapshot.revision&&adapter.id===captured.adapter&&adapter.version===version&&isDeepStrictEqual(item,captured);
    }catch{return false;}
   };
   const boundary=createReadBoundary(permission,{id:adapter.id,async read(target,signal,access){
    if(!access||!check())throw Error('connection_changed');
    const combined:AdapterAccess=Object.freeze({request:access.request,check:()=>access.check()&&check()});
    return adapter.read(captured,target,signal,combined);
   }});
   const result=await boundary.read(request,target,signal);
   if(result.status==='ok'&&!check())return {status:'denied',reason:'connection_changed'};
   return result;
  }catch{return {status:'unavailable',reason:'dependency_unavailable'};}
 }});
}
