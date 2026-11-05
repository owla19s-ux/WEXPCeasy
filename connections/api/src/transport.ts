import type {Json} from '../../../shared/src/index.js';
import {createHash} from 'node:crypto';
import type {PermissionReader,Decision} from '../../../permissions/src/index.js';
import type {createOperationLedger} from '../../src/index.js';
import type {ApiService} from './service.js';
import type {CredentialReference,Preparation} from './model.js';
import {canonical,capture,object,text,revision} from './model.js';
import {decodeChatStream} from './stream.js';
import {decodeChatResponse} from './response.js';
import type {ChatStreamResult} from './stream.js';
function requestCorrelation(response:Response):{providerRequestId?:string}{
 const id=response.headers.get('x-request-id');
 return id&&/^[-a-zA-Z0-9_.:]{1,256}$/.test(id)?{providerRequestId:id}:{};
}
function providerError(status:number):string {
 return status===401||status===403?'provider_authorization':status===429?'provider_rate_limited':status>=300&&status<400?'redirect_refused':'provider_http_error';
}
export type ApiDirectoryResult=
 | {status:'ok';operationId:string;observation:{connectionId:string;connectionRevision:number;source:'provider';observedAt:string;modelIds:string[];providerRequestId?:string}}
 | {status:'blocked'|'unknown';operationId:string;reason:string};
export type ApiProbeResult=
 | {status:'ok';operationId:string;observation:{connectionId:string;connectionRevision:number;modelId:string;modelRevision:number;source:'probe';observedAt:string;usage:ChatStreamResult['usage'];providerRequestId?:string}}
 | {status:'blocked'|'unknown';operationId:string;reason:string};
type Ledger=ReturnType<typeof createOperationLedger>;
export type ApiSendResult={status:'ok';operationId:string;result:ChatStreamResult&{providerRequestId?:string}}|{status:'blocked'|'unknown';operationId:string;reason:string};
export interface ApiCredentialBinding {
 readonly reference:Readonly<CredentialReference>;
 readonly connectionId:string;
 readonly connectionRevision:number;
 readonly endpoint:string;
 readonly provider:string;
}
/** Trusted host port. It must authorize use of this exact revision and destination. */
export interface ApiCredentialPort {
 resolve(request:object,binding:Readonly<ApiCredentialBinding>):string|undefined;
}
export interface ApiTransportOptions {
 derivePrepareRequest(request:object):object|undefined;
 credentials?:ApiCredentialPort;
}
/** Host-owned ledger; no retries, credential storage, or tool execution. */
export function createApiTransport(api:ApiService,permission:PermissionReader,ledger:Ledger,options:ApiTransportOptions){
 let stopped=false;const active=new Set<AbortController>(),pending=new Set<Promise<void>>();
 async function diagnose(request:object,operationId:string,targetId:string,expectedRevision:number,timeoutMs:number,signal:AbortSignal|undefined,probe?:{modelRevision:number}):Promise<ApiDirectoryResult|ApiProbeResult>{
  const blocked=(reason:string):ApiDirectoryResult=>({status:'blocked',operationId,reason});
  if(stopped||signal?.aborted)return blocked('stopped_or_cancelled');
  if(!text(operationId)||!text(targetId)||!revision(expectedRevision)||!revision(timeoutMs)||timeoutMs>2147483647)return blocked('invalid_diagnostic_request');
  const controller=new AbortController();
  const abort=()=>controller.abort();
  let settle!:()=>void;
  const finished=new Promise<void>(resolve=>{settle=resolve;});
  pending.add(finished);
  active.add(controller);
  signal?.addEventListener('abort',abort,{once:true});
  let timer:ReturnType<typeof setTimeout>|undefined;
  let timedOut=false,dispatched=false;
  const receiptId=probe?'api-probe-result':'api-directory-result';
  let correlation:{providerRequestId?:string}={};
  const unknown=(reason:string):ApiDirectoryResult=>{
   try{ledger.observe(operationId,receiptId,{reason,...correlation},'unknown');}catch{}
   return {status:'unknown',operationId,reason};
  };
  try{
   const decision=permission.evaluate(request);
   if(decision.status!=='allow')return blocked('not_allowed');
   const resolve=()=>probe?api.probeModel(request,targetId):{connection:api.directoryConnection(request,targetId),model:undefined};
   const {connection,model}=resolve();
   const connectionId=connection.id;
   if(probe&&model?.revision!==probe.modelRevision)return blocked('model_revision_changed');
   if(connection.revision!==expectedRevision||!connection.enabled)return blocked('configuration_changed_or_disabled');
   if(connection.protocol!=='openai-chat')return blocked('diagnostic_protocol_unsupported');
   if(!probe&&connection.endpointMode!=='base')return blocked('directory_route_unsupported');
   const url=new URL(connection.endpoint);
   if(connection.endpointMode==='base')url.pathname=url.pathname.replace(/\/$/,'')+(probe?'/chat/completions':'/models');
   const probeBody=model?{model:model.modelId,messages:[{role:'user',content:'Reply with OK.'}],stream:false,max_tokens:8}:null;
   const current=()=>{
    if(stopped||controller.signal.aborted)return false;
    try{
     const latest=resolve();
     return canonical(permission.recheck(request,decision))===canonical(decision)
      &&canonical(latest.connection)===canonical(connection)
      &&(!model||canonical(latest.model)===canonical(model));
    }catch{return false;}
   };
   if(ledger.get(operationId))return blocked('already_recorded_no_automatic_retry');
   if(!current())return blocked('authorization_or_configuration_changed');
   let token:string|undefined;
   if(connection.credentialRef){
    if(!options.credentials)return blocked('credential_backend_unavailable');
    if(url.protocol!=='https:')return blocked('credential_requires_https');
    token=options.credentials.resolve(request,Object.freeze({
     reference:connection.credentialRef,connectionId,connectionRevision:expectedRevision,
     endpoint:url.href,provider:connection.provider
    }));
    if(typeof token!=='string'||token.length>8192||!/^[-a-zA-Z0-9._~+/]+=*$/.test(token))return blocked('credential_unavailable');
   }
   if(!current())return blocked('authorization_or_configuration_changed');
   const fingerprint=createHash('sha256').update(canonical({scope:decision.scope,connection,model:model??null,probeBody,url:url.href,timeoutMs})).digest('hex');
   if(ledger.prepare(operationId,fingerprint,{connectionId,configRevision:expectedRevision,adapterId:'connections/api',adapterVersion:probe?'openai-chat-probe-1':'openai-chat-models-1',endpoint:url.href}).status!=='ok')
    return {status:'unknown',operationId,reason:'prepare_unconfirmed'};
   if(!current())return blocked('authorization_or_configuration_changed');
   if(ledger.markDispatched(operationId).status!=='ok')return {status:'unknown',operationId,reason:'dispatch_record_unconfirmed'};
   if(!current()){
    const receipt=ledger.observe(operationId,'api-not-dispatched',{externalDispatched:false},'observed');
    return receipt.status==='ok'?blocked('authorization_or_configuration_changed'):{status:'unknown',operationId,reason:'blocked_receipt_unconfirmed'};
   }
   timer=setTimeout(()=>{timedOut=true;abort();},timeoutMs);
   dispatched=true;
   const response=await fetch(url,{method:probe?'POST':'GET',...(probeBody?{body:JSON.stringify(probeBody)}:{}),redirect:'manual',signal:controller.signal,headers:{accept:'application/json',...(probeBody?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{})}});
   if(!current())return unknown('authorization_or_configuration_changed');
   const receivedCorrelation=requestCorrelation(response);
   if(!token||!JSON.stringify(receivedCorrelation).includes(token))correlation=receivedCorrelation;
   if(!response.ok)return unknown(providerError(response.status));
   if(!response.body||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??''))return unknown('invalid_response_content_type');
   const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
   let bytes=0,body='';
   try{
    while(true){
     const chunk=await reader.read();
     if(!current())return unknown('authorization_or_configuration_changed');
     if(chunk.done)break;
     bytes+=chunk.value.byteLength;
     if(bytes>1024*1024)return unknown('directory_response_too_large');
     body+=decoder.decode(chunk.value,{stream:true});
    }
    body+=decoder.decode();
   }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   if(model){
    const bytes=new TextEncoder().encode(body);
    const result=await decodeChatResponse((async function*(){yield bytes;})(),{signal:controller.signal});
    if(!result.text.trim())return unknown('empty_probe_response');
    if(token&&JSON.stringify(result).includes(token))return unknown('credential_echoed');
    const observation={connectionId,connectionRevision:expectedRevision,modelId:model.id,modelRevision:model.revision,source:'probe' as const,observedAt:new Date().toISOString(),usage:result.usage,...correlation};
    if(!current())return unknown('authorization_or_configuration_changed');
    if(ledger.observe(operationId,receiptId,observation,'observed').status!=='ok')
     return {status:'unknown',operationId,reason:'result_persistence_unconfirmed'};
    if(!current())return {status:'unknown',operationId,reason:'authorization_or_configuration_changed'};
    return {status:'ok',operationId,observation};
   }
   const decoded:unknown=JSON.parse(body);
   if(!object(decoded)||!Array.isArray(decoded.data)||decoded.data.length>4096)return unknown('invalid_model_directory');
   const ids=new Set<string>();
   for(const row of decoded.data){
    if(!object(row)||!text(row.id)||ids.has(row.id))return unknown('invalid_model_directory');
    ids.add(row.id);
   }
   const observation={connectionId,connectionRevision:expectedRevision,source:'provider' as const,observedAt:new Date().toISOString(),modelIds:[...ids],...correlation};
   if(token&&JSON.stringify(observation).includes(token))return unknown('credential_echoed');
   if(!current())return unknown('authorization_or_configuration_changed');
   if(ledger.observe(operationId,receiptId,observation,'observed').status!=='ok')
    return {status:'unknown',operationId,reason:'result_persistence_unconfirmed'};
   if(!current())return {status:'unknown',operationId,reason:'authorization_or_configuration_changed'};
   return {status:'ok',operationId,observation};
  }catch{
   return dispatched?unknown(timedOut?'timeout':stopped?'stopped':signal?.aborted?'cancelled':(probe?'probe_response_unconfirmed':'directory_response_unconfirmed')):blocked('directory_unavailable');
  }finally{
   if(timer)clearTimeout(timer);
   signal?.removeEventListener('abort',abort);
   active.delete(controller);
   abort();
   pending.delete(finished);
   settle();
  }
 }
 return Object.freeze({
 async stop(){stopped=true;for(const controller of active)controller.abort();await Promise.all([...pending]);},
 async refreshDirectory(request:object,operationId:string,connectionId:string,expectedRevision:number,timeoutMs:number,signal?:AbortSignal):Promise<ApiDirectoryResult>{
  const result=await diagnose(request,operationId,connectionId,expectedRevision,timeoutMs,signal);
  if(result.status!=='ok')return result;
  if(result.observation.source==='provider')return {...result,observation:result.observation};
  throw Error('unexpected_diagnostic_result');
 },
 async probeGeneration(request:object,operationId:string,modelId:string,connectionRevision:number,modelRevision:number,timeoutMs:number,signal?:AbortSignal):Promise<ApiProbeResult>{
  if(!revision(modelRevision))return {status:'blocked',operationId,reason:'invalid_model_revision'};
  const result=await diagnose(request,operationId,modelId,connectionRevision,timeoutMs,signal,{modelRevision});
  if(result.status!=='ok')return result;
  if(result.observation.source==='probe')return {...result,observation:result.observation};
  throw Error('unexpected_diagnostic_result');
 },
 async send(request:object,operationId:string,input:Preparation,signal?:AbortSignal):Promise<ApiSendResult>{
  let settle!:()=>void;const finished=new Promise<void>(resolve=>{settle=resolve;});pending.add(finished);
  const blocked=(reason:string):ApiSendResult=>({status:'blocked',operationId,reason});
  let dispatched=false,controller:AbortController|undefined,timer:ReturnType<typeof setTimeout>|undefined,timedOut=false;
  const abort=()=>controller?.abort();
  let correlation:{providerRequestId?:string}={};
  const unknown=(reason:string):ApiSendResult=>{try{ledger.observe(operationId,'api-result',{reason,...correlation},'unknown');}catch{}return {status:'unknown',operationId,reason};};
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
   if(snapshot.timeoutMs>2147483647)return blocked('timeout_out_of_range');
   const current=()=>{if(!allowed())return false;const next=api.prepare(prepareRequest,p);return next.status==='ok'&&next.snapshot.fingerprint===snapshot.fingerprint;};
   const fingerprint=createHash('sha256').update(canonical({scope:initial.scope,snapshot:snapshot.fingerprint})).digest('hex');
   if(ledger.get(operationId))return blocked('already_recorded_no_automatic_retry');
   if(!current())return blocked('authorization_or_configuration_changed');
   let token:string|undefined;
   const reference=snapshot.connection.credentialRef;
   if(reference!==null){
    if(!options.credentials)return blocked('credential_backend_unavailable');
    if(new URL(snapshot.url).protocol!=='https:')return blocked('credential_requires_https');
    try{
     token=options.credentials.resolve(request,Object.freeze({
      reference,connectionId:snapshot.connection.id,connectionRevision:snapshot.connection.revision,
      endpoint:snapshot.url,provider:snapshot.connection.provider
     }));
    }catch{return blocked('credential_unavailable');}
    if(typeof token!=='string'||token.length>8192||!/^[-a-zA-Z0-9._~+/]+=*$/.test(token))return blocked('credential_unavailable');
    if(!current())return blocked('authorization_or_configuration_changed');
   }
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
   const response=await fetch(snapshot.url,{method:'POST',redirect:'manual',headers:{'content-type':'application/json',accept:snapshot.body.stream?'text/event-stream':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(snapshot.body),signal:controller.signal});
   if(!current())return unknown('authorization_or_configuration_changed');
   const receivedCorrelation=requestCorrelation(response);
   if(!token||!JSON.stringify(receivedCorrelation).includes(token))correlation=receivedCorrelation;
   if(!response.ok)return unknown(providerError(response.status));
   const contentType=snapshot.body.stream?/^text\/event-stream(?:\s*;|$)/i:/^application\/json(?:\s*;|$)/i;
   if(!contentType.test(response.headers.get('content-type')??'')||!response.body)return unknown('invalid_response_content_type');
   const stream=response.body,abortSignal=controller.signal;
   async function* chunks(){const reader=stream!.getReader();try{while(true){if(!current())throw Error('authorization_changed');const item=await reader.read();if(!current())throw Error('authorization_changed');if(item.done)break;yield item.value;}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}}
   const result=await (snapshot.body.stream?decodeChatStream(chunks(),{signal:abortSignal,...(snapshot.tools?{tools:snapshot.tools}:{})}):decodeChatResponse(chunks(),{signal:abortSignal,...(snapshot.tools?{tools:snapshot.tools}:{})}));
   if(!current())return unknown('authorization_or_configuration_changed');
   if(token&&JSON.stringify(result).includes(token))return unknown('credential_echoed');
   const receipt=ledger.observe(operationId,'api-result',{text:result.text,usage:result.usage,...correlation,...(result.toolCalls?{toolCalls:result.toolCalls as unknown as Json}:{})},'observed');
   if(receipt.status!=='ok')return {status:'unknown',operationId,reason:'result_persistence_unconfirmed'};
   if(!current())return {status:'unknown',operationId,reason:'authorization_or_configuration_changed'};
   return {status:'ok',operationId,result:{...result,...correlation}};
  }catch{return dispatched?unknown(timedOut?'timeout':stopped?'stopped':signal?.aborted?'cancelled':'response_unconfirmed'):blocked('dependency_unavailable');}
  finally{if(timer)clearTimeout(timer);signal?.removeEventListener('abort',abort);if(controller){active.delete(controller);controller.abort();}pending.delete(finished);settle();}
 }
 });
}
