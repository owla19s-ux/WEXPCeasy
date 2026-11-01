import {createHash} from 'node:crypto';
import type {PermissionReader} from '../../permissions/src/index.js';
import type {Json} from '../../shared/src/index.js';
import type {OperationConnection,createOperationLedger} from './operations.js';
type Ledger=ReturnType<typeof createOperationLedger>;
export interface DispatchAdapter {readonly id:string;execute(target:string,payload:Json):Promise<Json>}
export interface DispatchGuard {readonly connection:OperationConnection;check():boolean}
export type DispatchResult={status:'observed'|'blocked'|'unknown';reason:string;operationId:string};
function canonical(value:Json,ancestors=new Set<object>()):string {
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('invalid_payload');return JSON.stringify(value);}
 if(typeof value!=='object'||ancestors.has(value))throw Error('invalid_payload');
 ancestors.add(value);
 try{
  if(Array.isArray(value))return '['+Array.from(value,x=>canonical(x,ancestors)).join(',')+']';
  if(Object.getPrototypeOf(value)!==Object.prototype)throw Error('invalid_payload');
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k]!,ancestors)).join(',')+'}';
 }finally{ancestors.delete(value);}
}
/** This boundary never automatically retries an operation whose intent has been recorded. */
export function createDispatchBoundary(permission:PermissionReader,ledger:Ledger,adapter:DispatchAdapter,guard?:DispatchGuard){
 return Object.freeze({async dispatch(request:object,id:string,target:string,fingerprint:string,payload:Json):Promise<DispatchResult>{
  const blocked=(reason:string):DispatchResult=>({status:'blocked',reason,operationId:id});
  if(typeof id!=='string'||!id||typeof target!=='string'||!target||typeof fingerprint!=='string'||!fingerprint)return blocked('invalid_request');
  let capturedPayload:Json;
  try{canonical(payload);capturedPayload=structuredClone(payload);}catch{return blocked('invalid_payload');}
  try{
   const decision=permission.evaluate(request);
   if(decision.status!=='allow')return blocked('authorization_'+decision.status);
   if(decision.scope.resource!==adapter.id||decision.scope.target!==target||decision.scope.action!=='write')return blocked('scope_mismatch');
   if(guard&&!guard.check())return blocked('connection_changed');
   const boundFingerprint=createHash('sha256').update(canonical([decision.scope.subject,decision.scope.entry,decision.scope.conversation,decision.scope.context,decision.scope.relationship,decision.scope.relationshipGeneration,adapter.id,target,decision.scope.action,fingerprint,capturedPayload,...(guard?[guard.connection as unknown as Json]:[])])).digest('hex');
   const prior=ledger.get(id);
   if(prior)return prior.fingerprint!==boundFingerprint?blocked('intent_conflict'):blocked('already_recorded_no_automatic_retry');
   const current=permission.recheck(request,decision);
   if(current.status!=='allow')return blocked('authorization_stale');
   const prepared=ledger.prepare(id,boundFingerprint,guard?.connection);
   if(prepared.status==='conflict')return blocked('prepare_conflict');
   if(prepared.status!=='ok')return {status:'unknown',reason:'prepare_'+prepared.status,operationId:id};
   if(prepared.operation.phase!=='prepared')return blocked('already_recorded_no_automatic_retry');
   const final=permission.recheck(request,current);
   if(final.status!=='allow')return blocked('authorization_revoked');
   const reserved=ledger.markDispatched(id);
   if(reserved.status==='conflict')return blocked('already_reserved');
   if(reserved.status!=='ok')return {status:'unknown',reason:'dispatch_record_'+reserved.status,operationId:id};
   const notDispatched=(reason:string):DispatchResult=>{
    const receipt=ledger.observe(id,'host-not-dispatched',{reason,externalDispatched:false},'observed');
    return receipt.status==='ok'?blocked(reason):{status:'unknown',reason:'blocked_receipt_'+receipt.status,operationId:id};
   };
   if(permission.recheck(request,final).status!=='allow')return notDispatched('authorization_revoked');
   if(guard&&!guard.check())return notDispatched('connection_changed');
   try{
    const value=await adapter.execute(target,capturedPayload);
    const observed=ledger.observe(id,'result',value,'observed');
    return observed.status==='ok'?{status:'observed',reason:'result_recorded',operationId:id}:{status:'unknown',reason:'result_persistence_'+observed.status,operationId:id};
   }catch{
    ledger.observe(id,'exception',{reason:'adapter_exception'},'unknown');
    return {status:'unknown',reason:'external_outcome_unconfirmed',operationId:id};
   }
  }catch{return {status:'unknown',reason:'dependency_unavailable',operationId:id};}
 }});
}
