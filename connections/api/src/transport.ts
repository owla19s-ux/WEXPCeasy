import {parseUniqueJson} from './json.js';
import {captureResponseFormat,validateStructuredOutput} from './tools.js';
import {ProviderTerminalError} from './terminal.js';
import type {Json} from '../../../shared/src/index.js';
import {createHash} from 'node:crypto';
import type {PermissionReader,Decision} from '../../../permissions/src/index.js';
import type {createOperationLedger} from '../../src/index.js';
import type {ApiService} from './service.js';
import type {CredentialReference,Preparation} from './model.js';
import {canonical,capture,object,text,revision} from './model.js';
import {chatRoute,chatProbeBody,chatHeaders,chatContentType,decodeOpenAiChat,toolProbeDeclaration} from './protocols/openai-chat.js';
import type {ChatStreamResult} from './stream.js';
import {requestCorrelation,failureMetadata,networkFailure,providerError} from './network-diagnostics.js';
function responseIdentity(result:ChatStreamResult){
 return {
  ...(result.providerResponseId===undefined?{}:{providerResponseId:result.providerResponseId}),
  ...(result.providerModelId===undefined?{}:{providerModelId:result.providerModelId})
 };
}
export type ApiDirectoryResult=
 | {status:'ok';operationId:string;observation:{connectionId:string;connectionRevision:number;source:'provider';observedAt:string;modelIds:string[];providerRequestId?:string}}
 | {status:'blocked'|'unknown';operationId:string;reason:string};
export type ApiProbeResult=
 | {status:'ok';operationId:string;observation:{connectionId:string;connectionRevision:number;modelId:string;modelRevision:number;source:'probe';stream?:true;tools?:true;observedAt:string;usage:ChatStreamResult['usage'];providerRequestId?:string;providerResponseId?:string;providerModelId?:string}}
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
 async function diagnose(request:object,operationId:string,targetId:string,expectedRevision:number,timeoutMs:number,signal:AbortSignal|undefined,probe?:{modelRevision:number;stream:boolean;tools:boolean}):Promise<ApiDirectoryResult|ApiProbeResult>{
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
  let timedOut=false,dispatched=false,receivedHeaders=false;
  const interruption=()=>timedOut?'timeout':stopped?'stopped':signal?.aborted?'cancelled':undefined;
  const receiptId=probe?'api-probe-result':'api-directory-result';
  let correlation:{providerRequestId?:string;httpStatus?:number;retryAfterSeconds?:number}={};
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
   const url=chatRoute(connection,probe?'completions':'models');
   const probeBody=model?chatProbeBody(model,{stream:probe?.stream===true,tools:probe?.tools===true}):null;
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
   if(ledger.prepare(operationId,fingerprint,{connectionId,configRevision:expectedRevision,adapterId:'connections/api',adapterVersion:probe?(probe.tools?(probe.stream?'openai-chat-stream-tool-probe-1':'openai-chat-tool-probe-1'):probe.stream?'openai-chat-stream-probe-1':'openai-chat-probe-1'):'openai-chat-models-1',endpoint:url.href}).status!=='ok')
    return {status:'unknown',operationId,reason:'prepare_unconfirmed'};
   if(!current())return blocked('authorization_or_configuration_changed');
   if(ledger.markDispatched(operationId).status!=='ok')return {status:'unknown',operationId,reason:'dispatch_record_unconfirmed'};
   if(!current()){
    const receipt=ledger.observe(operationId,'api-not-dispatched',{externalDispatched:false},'observed');
    return receipt.status==='ok'?blocked('authorization_or_configuration_changed'):{status:'unknown',operationId,reason:'blocked_receipt_unconfirmed'};
   }
   timer=setTimeout(()=>{timedOut=true;abort();},timeoutMs);
   dispatched=true;
   const response=await fetch(url,{method:probe?'POST':'GET',...(probeBody?{body:JSON.stringify(probeBody)}:{}),redirect:'manual',signal:controller.signal,headers:chatHeaders(probe?.stream===true,token,!!probeBody)});
   if(!current())return unknown(interruption()??'authorization_or_configuration_changed');
   receivedHeaders=true;
   const receivedCorrelation=requestCorrelation(response);
   if(!token||!JSON.stringify(receivedCorrelation).includes(token))correlation=receivedCorrelation;
   if(!response.ok){correlation={...correlation,...failureMetadata(response,token)};return unknown(providerError(response.status));}
   const contentType=chatContentType(probe?.stream===true);
   if(!response.body||!contentType.test(response.headers.get('content-type')??''))return unknown('invalid_response_content_type');
   const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
   let bytes=0,body='';
   try{
    while(true){
     const chunk=await reader.read();
     if(!current())return unknown(interruption()??'authorization_or_configuration_changed');
     if(chunk.done)break;
     bytes+=chunk.value.byteLength;
     if(bytes>1024*1024)return unknown('directory_response_too_large');
     body+=decoder.decode(chunk.value,{stream:true});
    }
    body+=decoder.decode();
   }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   if(model){
    const bytes=new TextEncoder().encode(body);
    const allowReasoning=connection.provider==='deepseek'
     &&model.observation?.connectionRevision===connection.revision
     &&model.observation.capabilities.reasoning==='supported';
    const result=await decodeOpenAiChat((async function*(){yield bytes;})(),probe?.stream===true,{signal:controller.signal,allowReasoning,...(probe?.tools?{tools:[toolProbeDeclaration]}:{})});
    if(probe?.tools&&result.toolCalls?.length!==1)return unknown('tool_probe_proposal_missing');
    if(!probe?.tools&&!result.text.trim())return unknown('empty_probe_response');
    if(token&&JSON.stringify(result).includes(token))return unknown('credential_echoed');
    const observation={connectionId,connectionRevision:expectedRevision,modelId:model.id,modelRevision:model.revision,source:'probe' as const,...(probe?.tools?{tools:true as const}:{}),...(probe?.stream?{stream:true as const}:{}),observedAt:new Date().toISOString(),usage:result.usage,...responseIdentity(result),...correlation};
    if(!current())return unknown(interruption()??'authorization_or_configuration_changed');
    if(ledger.observe(operationId,receiptId,{...observation,scopeHash:createHash('sha256').update(canonical(decision.scope)).digest('hex')},'observed').status!=='ok')
     return {status:'unknown',operationId,reason:'result_persistence_unconfirmed'};
    if(!current())return {status:'unknown',operationId,reason:'authorization_or_configuration_changed'};
    return {status:'ok',operationId,observation};
   }
   let decoded:unknown;
   try{decoded=parseUniqueJson(body);}catch{return unknown('invalid_model_directory');}
   if(!object(decoded)||!Array.isArray(decoded.data)||decoded.data.length>4096)return unknown('invalid_model_directory');
   if(decoded.has_more===true)return unknown('model_directory_incomplete');
   const ids=new Set<string>();
   for(const row of decoded.data){
    if(!object(row)||!text(row.id)||ids.has(row.id))return unknown('invalid_model_directory');
    ids.add(row.id);
   }
   const observation={connectionId,connectionRevision:expectedRevision,source:'provider' as const,observedAt:new Date().toISOString(),modelIds:[...ids],...correlation};
   if(token&&JSON.stringify(observation).includes(token))return unknown('credential_echoed');
   if(!current())return unknown(interruption()??'authorization_or_configuration_changed');
   if(ledger.observe(operationId,receiptId,observation,'observed').status!=='ok')
    return {status:'unknown',operationId,reason:'result_persistence_unconfirmed'};
   if(!current())return {status:'unknown',operationId,reason:'authorization_or_configuration_changed'};
   return {status:'ok',operationId,observation};
  }catch(error){
   return dispatched?unknown(interruption()??(error instanceof ProviderTerminalError?error.reason:(!receivedHeaders?networkFailure(error):undefined)??(probe?'probe_response_unconfirmed':'directory_response_unconfirmed'))):blocked('directory_unavailable');
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
 async probeGeneration(request:object,operationId:string,modelId:string,connectionRevision:number,modelRevision:number,timeoutMs:number,signal?:AbortSignal,mode:boolean|'tools'|'stream-tools'=false):Promise<ApiProbeResult>{
  if(!revision(modelRevision))return {status:'blocked',operationId,reason:'invalid_model_revision'};
  const result=await diagnose(request,operationId,modelId,connectionRevision,timeoutMs,signal,{modelRevision,stream:mode===true||mode==='stream-tools',tools:mode==='tools'||mode==='stream-tools'});
  if(result.status!=='ok')return result;
  if(result.observation.source==='probe')return {...result,observation:result.observation};
  throw Error('unexpected_diagnostic_result');
 },
 async send(request:object,operationId:string,input:Preparation,signal?:AbortSignal,onText?:(delta:string)=>void):Promise<ApiSendResult>{
  let settle!:()=>void;const finished=new Promise<void>(resolve=>{settle=resolve;});pending.add(finished);
  const blocked=(reason:string):ApiSendResult=>({status:'blocked',operationId,reason});
  let receivedHeaders=false;
  let dispatched=false,controller:AbortController|undefined,timer:ReturnType<typeof setTimeout>|undefined,timedOut=false;
  let phaseTimer:ReturnType<typeof setTimeout>|undefined;
  let phaseTimeout:'headers_timeout'|'body_idle_timeout'|undefined;
  const clearPhase=()=>{if(phaseTimer)clearTimeout(phaseTimer);phaseTimer=undefined;};
  const startPhase=(ms:number|undefined,reason:NonNullable<typeof phaseTimeout>)=>{
   clearPhase();
   if(ms!==undefined)phaseTimer=setTimeout(()=>{phaseTimeout=reason;controller?.abort();},ms);
  };
  const abort=()=>controller?.abort();
  const interruption=()=>phaseTimeout??(timedOut?'timeout':stopped?'stopped':signal?.aborted?'cancelled':undefined);
  let correlation:{providerRequestId?:string;httpStatus?:number;retryAfterSeconds?:number}={};
  const unknown=(reason:string):ApiSendResult=>{try{ledger.observe(operationId,'api-result',{reason,...correlation},'unknown');}catch{}return {status:'unknown',operationId,reason};};
  try{
   if(stopped||signal?.aborted)return blocked('stopped_or_cancelled');
   if(typeof operationId!=='string'||!operationId)return blocked('invalid_operation');
   const p=capture(input);
   const decision=permission.evaluate(request);
   if(decision.status!=='allow'||decision.scope.resource!=='connections/api'||decision.scope.action!=='request.send'||decision.scope.target!==`model:${p.modelId}`||decision.scope.context!==p.context)return blocked('not_allowed');
   const initial=decision;
   const allowed=()=>{if(stopped||signal?.aborted||controller?.signal.aborted)return false;const next=permission.recheck(request,initial);return next.status==='allow'&&canonical(next)===canonical(initial);};
   const prepareRequest=options.derivePrepareRequest(request);if(!prepareRequest)return blocked('prepare_binding_unavailable');
   const preparedDecision=permission.evaluate(prepareRequest);
   const sameActor=(a:Extract<Decision,{status:'allow'}>,b:Extract<Decision,{status:'allow'}>)=>['subject','entry','conversation','context','relationship','relationshipGeneration'].every(k=>a.scope[k as keyof typeof a.scope]===b.scope[k as keyof typeof b.scope]);
   if(preparedDecision.status!=='allow'||!sameActor(initial,preparedDecision))return blocked('prepare_actor_mismatch');
   const prepared=api.prepare(prepareRequest,p);if(prepared.status!=='ok')return blocked('reason' in prepared&&prepared.reason==='timeout_out_of_range'?prepared.reason:'preparation_rejected');
   const snapshot=prepared.snapshot;
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
   startPhase(snapshot.headersTimeoutMs,'headers_timeout');
   dispatched=true;
   const response=await fetch(snapshot.url,{method:'POST',redirect:'manual',headers:chatHeaders(snapshot.body.stream,token),body:JSON.stringify(snapshot.body),signal:controller.signal});
   clearPhase();
   if(phaseTimeout)return unknown(phaseTimeout);
   if(!current())return unknown(interruption()??'authorization_or_configuration_changed');
   receivedHeaders=true;
   const receivedCorrelation=requestCorrelation(response);
   if(!token||!JSON.stringify(receivedCorrelation).includes(token))correlation=receivedCorrelation;
   if(!response.ok){correlation={...correlation,...failureMetadata(response,token)};return unknown(providerError(response.status));}
   const contentType=chatContentType(snapshot.body.stream);
   if(!contentType.test(response.headers.get('content-type')??'')||!response.body)return unknown('invalid_response_content_type');
   const stream=response.body,abortSignal=controller.signal;
   async function* chunks(){const reader=stream!.getReader();try{while(true){if(!current())throw Error('authorization_changed');startPhase(snapshot.idleTimeoutMs,'body_idle_timeout');const item=await reader.read();clearPhase();if(phaseTimeout)throw Error(phaseTimeout);if(!current())throw Error('authorization_changed');if(item.done)break;yield item.value;}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}}
   // Hold the suffix that might complete a credential echoed across SSE chunks.
   let pendingText='';
   const publish=(delta:string,final=false)=>{
    if(!onText)return;
    if(!current()||abortSignal.aborted)throw Error('authorization_changed');
    pendingText+=delta;
    if(token&&pendingText.includes(token))throw Error('credential_echoed');
    const end=final?pendingText.length:Math.max(0,pendingText.length-(token?token.length-1:0));
    if(end===0)return;
    const next=pendingText.slice(0,end);
    pendingText=pendingText.slice(end);
    onText(next);
   };
   const outputSchema=captureResponseFormat(snapshot.body.response_format);
   const allowReasoning=snapshot.connection.provider==='deepseek'&&snapshot.model.observation?.capabilities.reasoning==='supported';
   const result=await decodeOpenAiChat(chunks(),snapshot.body.stream,{signal:abortSignal,allowReasoning,...(snapshot.body.stream&&onText&&outputSchema===undefined?{onText:publish}:{}),...(snapshot.tools?{tools:snapshot.tools}:{})});
   if(!current())return unknown(interruption()??'authorization_or_configuration_changed');
   if(token&&JSON.stringify(result).includes(token))return unknown('credential_echoed');
   if(outputSchema!==undefined&&!result.toolCalls?.length){
    try{validateStructuredOutput(result.text,outputSchema);}catch{return unknown('invalid_structured_output');}
    if(snapshot.body.stream&&onText)publish(result.text,true);
   }
   if(snapshot.body.stream&&onText){publish('',true);if(!current()||abortSignal.aborted)return unknown(interruption()??'authorization_or_configuration_changed');}
   const receipt=ledger.observe(operationId,'api-result',{
    requestId:snapshot.requestId,
    ...(snapshot.toolContinuation?{sourceRequestId:snapshot.toolContinuation.sourceRequestId}:{}),
    text:result.text,usage:result.usage,...responseIdentity(result),...(result.reasoning?{reasoning:result.reasoning}:{}),...correlation,...(result.toolCalls?{toolCalls:result.toolCalls as unknown as Json}:{})},'observed');
   if(receipt.status!=='ok')return {status:'unknown',operationId,reason:'result_persistence_unconfirmed'};
   if(!current())return {status:'unknown',operationId,reason:'authorization_or_configuration_changed'};
   return {status:'ok',operationId,result:{...result,...correlation}};
  }catch(error){return dispatched?unknown(interruption()??(error instanceof ProviderTerminalError?error.reason:(!receivedHeaders?networkFailure(error):undefined)??'response_unconfirmed')):blocked('dependency_unavailable');}
  finally{clearPhase();if(timer)clearTimeout(timer);signal?.removeEventListener('abort',abort);if(controller){active.delete(controller);controller.abort();}pending.delete(finished);settle();}
 }
 });
}
