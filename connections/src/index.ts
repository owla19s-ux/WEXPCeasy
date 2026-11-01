import type {PermissionReader} from '../../permissions/src/index.js';
export interface ReadAdapter {readonly id:string;read(target:string,signal:AbortSignal):Promise<unknown>}
export type ReadResult={status:'ok';value:unknown}|{status:'denied'|'unavailable'|'cancelled';reason:string};
export function createReadBoundary(permission:PermissionReader,adapter:ReadAdapter){
 return {async read(request:object,target:string,signal=new AbortController().signal):Promise<ReadResult>{
  if(signal.aborted)return {status:'cancelled',reason:'aborted'};
  const first=permission.evaluate(request);
  if(first.status!=='allow')return {status:'denied',reason:'not_allowed'};
  if(first.scope.resource!==adapter.id||first.scope.target!==target||first.scope.action!=='read')return {status:'denied',reason:'scope_mismatch'};
  const current=permission.recheck(request,first);
  if(current.status!=='allow')return {status:'denied',reason:'stale'};
  try{
   const value=await adapter.read(target,signal);
   if(signal.aborted||permission.recheck(request,current).status!=='allow')return {status:'denied',reason:'revoked_or_cancelled'};
   return {status:'ok',value};
  }catch{return {status:'unavailable',reason:'adapter_failed'};}
 }};
}

export {createOperationLedger} from './operations.js';
export type {Operation,OperationResult,OperationPhase} from './operations.js';

export {createDispatchBoundary} from './dispatch.js';
export type {DispatchAdapter,DispatchResult} from './dispatch.js';
