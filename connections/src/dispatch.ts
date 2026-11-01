import type {PermissionReader} from '../../permissions/src/index.js';
import type {Json} from '../../shared/src/index.js';
import type {createOperationLedger} from './operations.js';
type Ledger=ReturnType<typeof createOperationLedger>;
export interface DispatchAdapter {id:string;execute(target:string,payload:Json):Promise<Json>}
export type DispatchResult={status:'observed'|'blocked'|'unknown';reason:string;operationId:string};
/** No retry: uncertain attempts remain unknown until explicitly reconciled. */
export function createDispatchBoundary(permission:PermissionReader,ledger:Ledger,adapter:DispatchAdapter){
 return Object.freeze({async dispatch(request:object,id:string,target:string,fingerprint:string,payload:Json):Promise<DispatchResult>{
  const blocked=(reason:string):DispatchResult=>({status:'blocked',reason,operationId:id});
  if(!id||!target||!fingerprint)return blocked('invalid_request');
  try{
   const prior=ledger.get(id);
   if(prior)return prior.fingerprint!==fingerprint?blocked('intent_conflict'):blocked('already_recorded_no_automatic_retry');
   const decision=permission.evaluate(request);
   if(decision.status!=='allow')return blocked('authorization_'+decision.status);
   if(decision.scope.resource!==adapter.id||decision.scope.target!==target||decision.scope.action==='read')return blocked('scope_mismatch');
   const current=permission.recheck(request,decision);
   if(current.status!=='allow')return blocked('authorization_stale');
   const prepared=ledger.prepare(id,fingerprint);
   if(prepared.status!=='ok')return {status:'unknown',reason:'prepare_'+prepared.status,operationId:id};
   const final=permission.recheck(request,current);
   if(final.status!=='allow')return blocked('authorization_revoked');
   const recorded=ledger.markDispatched(id);
   if(recorded.status!=='ok')return {status:'unknown',reason:'dispatch_record_'+recorded.status,operationId:id};
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
