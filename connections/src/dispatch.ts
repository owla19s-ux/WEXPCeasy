import {createHash} from 'node:crypto';
import type {PermissionReader} from '../../permissions/src/index.js';
import type {Json} from '../../shared/src/index.js';
import type {createOperationLedger} from './operations.js';
type Ledger=ReturnType<typeof createOperationLedger>;
export interface DispatchAdapter {readonly id:string;execute(target:string,payload:Json):Promise<Json>}
export type DispatchResult={status:'observed'|'blocked'|'unknown';reason:string;operationId:string};
function canonical(value:Json):string {
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number') {if(!Number.isFinite(value))throw Error('invalid_payload');return JSON.stringify(value);}
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)throw Error('invalid_payload');
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k]!)).join(',')+'}';
}
/** This boundary never automatically retries an operation whose intent has been recorded. */
export function createDispatchBoundary(permission:PermissionReader,ledger:Ledger,adapter:DispatchAdapter){
 return Object.freeze({async dispatch(request:object,id:string,target:string,fingerprint:string,payload:Json):Promise<DispatchResult>{
  const blocked=(reason:string):DispatchResult=>({status:'blocked',reason,operationId:id});
  if(!id||!target||!fingerprint)return blocked('invalid_request');
  try{
   const decision=permission.evaluate(request);
   if(decision.status!=='allow')return blocked('authorization_'+decision.status);
   if(decision.scope.resource!==adapter.id||decision.scope.target!==target||decision.scope.action!=='write')return blocked('scope_mismatch');
   const boundFingerprint=createHash('sha256').update(canonical([decision.scope.subject,decision.scope.entry,decision.scope.conversation,decision.scope.context,decision.scope.relationship,decision.scope.relationshipGeneration,adapter.id,target,decision.scope.action,fingerprint,payload])).digest('hex');
   const prior=ledger.get(id);
   if(prior)return prior.fingerprint!==boundFingerprint?blocked('intent_conflict'):blocked('already_recorded_no_automatic_retry');
   const current=permission.recheck(request,decision);
   if(current.status!=='allow')return blocked('authorization_stale');
   const prepared=ledger.prepare(id,boundFingerprint);
   if(prepared.status==='conflict')return blocked('prepare_conflict');
   if(prepared.status!=='ok')return {status:'unknown',reason:'prepare_'+prepared.status,operationId:id};
   if(prepared.operation.phase!=='prepared')return blocked('already_recorded_no_automatic_retry');
   const final=permission.recheck(request,current);
   if(final.status!=='allow')return blocked('authorization_revoked');
   const reserved=ledger.markDispatched(id);
   if(reserved.status==='conflict')return blocked('already_reserved');
   if(reserved.status!=='ok')return {status:'unknown',reason:'dispatch_record_'+reserved.status,operationId:id};
   try{
    const value=await adapter.execute(target,payload);
    const observed=ledger.observe(id,'result',value,'observed');
    return observed.status==='ok'?{status:'observed',reason:'result_recorded',operationId:id}:{status:'unknown',reason:'result_persistence_'+observed.status,operationId:id};
   }catch{
    ledger.observe(id,'exception',{reason:'adapter_exception'},'unknown');
    return {status:'unknown',reason:'external_outcome_unconfirmed',operationId:id};
   }
  }catch{return {status:'unknown',reason:'dependency_unavailable',operationId:id};}
 }});
}
