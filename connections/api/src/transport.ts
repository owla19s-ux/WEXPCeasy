import {createHash} from 'node:crypto';
import type {PermissionReader,Decision} from '../../../permissions/src/index.js';
import type {createOperationLedger} from '../../src/index.js';
import type {ApiService} from './service.js';
import type {Preparation} from './model.js';
import {canonical,capture} from './model.js';
import {decodeChatStream} from './stream.js';
import type {ChatStreamResult} from './stream.js';
type Ledger=ReturnType<typeof createOperationLedger>;
export type ApiSendResult={status:'ok';operationId:string;result:ChatStreamResult}|{status:'blocked'|'unknown';operationId:string;reason:string};
export interface ApiTransportOptions {derivePrepareRequest(request:object):object|undefined}
/** Host-owned ledger; no retries, credential storage, or tool execution. */
export function createApiTransport(api:ApiService,permission:PermissionReader,ledger:Ledger,options:ApiTransportOptions){
 let stopped=false;const active=new Set<AbortController>();
 return Object.freeze({
 stop(){stopped=true;for(const controller of active)controller.abort();},
 async send(request:object,operationId:string,input:Preparation,signal?:AbortSignal):Promise<ApiSendResult>{
  const blocked=(reason:string):ApiSendResult=>({status:'blocked',operationId,reason});
  let dispatched=false,controller:AbortController|undefined,timer:ReturnType<typeof setTimeout>|undefined,timedOut=false;
  const abort=()=>controller?.abort();
  const unknown=(reason:string):ApiSendResult=>{try{ledger.observe(operationId,'api-result',{reason},'unknown');}catch{}return {status:'unknown',operationId,reason};};
  try{
   if(stopped||signal?.aborted)return blocked('stopped_or_cancelled');
   if(typeof operationId!=='string'||!operationId)return blocked('invalid_operation');
   const p=capture(input);
   const decision=permission.evaluate(request);
   if(decision.status!=='allow'||decision.scope.resource!=='connections/api'||decision.scope.action!=='request.send'||decision.scope.target!==`model:${p.modelId}`||decision.scope.context!==p.context)return blocked('not_allowed');
   const initial=decision;
   const allowed=()=>{if(stopped||signal?.aborted)return false;const next=permission.recheck(request,initial);return next.status==='allow'&&canonical(next)===canonical(initial);};
   const prepareRequest=options.derivePrepareRequest(request);if(!prepareRequest)return blocked('prepare_binding_unavailable');
   const preparedDecision=permission.evaluate(prepareRequest);
   const sameActor=(a:Extract<Decision,{status:'allow'}>,b:Extract<Decision,{status:'allow'}>)=>['subject','entry','conversation','context','relationship','relationshipGeneration'].every(k=>a.scope[k as keyof typeof a.scope]===b.scope[k as keyof typeof b.scope]);
   if(preparedDecision.status!=='allow'||!sameActor(initial,preparedDecision))return blocked('prepare_actor_mismatch');
   const prepared=api.prepare(prepareRequest,p);if(prepared.status!=='ok')return blocked('preparation_rejected');
   const snapshot=prepared.snapshot;
   if(!snapshot.body.stream)return blocked('stream_required');
   if(snapshot.connection.credentialRef!==null)return blocked('credential_backend_unavailable');
   const current=()=>{if(!allowed())return false;const next=api.prepare(prepareRequest,p);return next.status==='ok'&&next.snapshot.fingerprint===snapshot.fingerprint;};
   const fingerprint=createHash('sha256').update(canonical({scope:initial.scope,snapshot:snapshot.fingerprint})).digest('hex');
   if(ledger.get(operationId))return blocked('already_recorded_no_automatic_retry');
   if(!current())return blocked('authorization_or_configuration_changed');
   const reserved=ledger.prepare(operationId,fingerprint,{connectionId:snapshot.connection.id,configRevision:snapshot.connection.revision,adapterId:'connections/api',adapterVersion:'openai-chat-text-1',endpoint:snapshot.url});
   if(reserved.status!=='ok')return {status:'unknown',operationId,reason:'prepare_unconfirmed'};
   if(!current())return blocked('authorization_or_configuration_changed');
   const marked=ledger.markDispatched(operationId);if(marked.status!=='ok')return {status:'unknown',operationId,reason:'dispatch_record_unconfirmed'};
   if(!current()){
    const receipt=ledger.observe(operationId,'api-not-dispatched',{externalDispatched:false},'observed');return receipt.status==='ok'?blocked('authorization_or_configuration_changed'):{status:'unknown',operationId,reason:'blocked_receipt_unconfirmed'};
   }
   controller=new AbortController();active.add(controller);signal?.addEventListener('abort',abort,{once:true});
   if(stopped||signal?.aborted){const receipt=ledger.observe(operationId,'api-not-dispatched',{externalDispatched:false},'observed');return receipt.status==='ok'?blocked('stopped_or_cancelled'):{status:'unknown',operationId,reason:'blocked_receipt_unconfirmed'};}
   timer=setTimeout(()=>{timedOut=true;controller?.abort();},snapshot.timeoutMs);
   dispatched=true;
   const response=await fetch(snapshot.url,{method:'POST',redirect:'manual',headers:{'content-type':'application/json',accept:'text/event-stream'},body:JSON.stringify(snapshot.body),signal:controller.signal});
   if(!current())return unknown('authorization_or_configuration_changed');
   if(!response.ok)return unknown(response.status===401||response.status===403?'provider_authorization':response.status===429?'provider_rate_limited':response.status>=300&&response.status<400?'redirect_refused':'provider_http_error');
   if(!/^text\/event-stream(?:\s*;|$)/i.test(response.headers.get('content-type')??'')||!response.body)return unknown('invalid_stream_response');
   const stream=response.body,abortSignal=controller.signal;
   async function* chunks(){const reader=stream!.getReader();try{while(true){if(!current())throw Error('authorization_changed');const item=await reader.read();if(!current())throw Error('authorization_changed');if(item.done)break;yield item.value;}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}}
   const result=await decodeChatStream(chunks(),{signal:abortSignal});
   if(!current())return unknown('authorization_or_configuration_changed');
   const receipt=ledger.observe(operationId,'api-result',{text:result.text,usage:result.usage},'observed');
   if(receipt.status!=='ok')return {status:'unknown',operationId,reason:'result_persistence_unconfirmed'};
   if(!current())return {status:'unknown',operationId,reason:'authorization_or_configuration_changed'};
   return {status:'ok',operationId,result};
  }catch{return dispatched?unknown(timedOut?'timeout':stopped?'stopped':signal?.aborted?'cancelled':'response_unconfirmed'):blocked('dependency_unavailable');}
  finally{if(timer)clearTimeout(timer);signal?.removeEventListener('abort',abort);if(controller){active.delete(controller);controller.abort();}}
 }
 });
}
