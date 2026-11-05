import type {Operation} from '../../src/index.js';
import {captureTools} from './tools.js';
import {createHash,randomUUID} from 'node:crypto';
import type {Store,Json} from '../../../shared/src/index.js';
import type {PermissionReader,Decision,Scope} from '../../../permissions/src/index.js';
import {Failure,fail,text,revision,closed,object,capture,canonical,freeze,parameters,parameterValue,endpoint,observation,decode,command} from './model.js';
import type {ApiCommand,ApiMutation,ApiQuery,ApiQueryResult,ApiConnection,ApiModel,ModelObserver,State,Intent,Preparation,RequestSnapshot,Parameters} from './model.js';
interface Projection {action:string;target:string;context:string|null}
export interface ApiOptions {id?:()=>string;observer?:ModelObserver;deriveRequest?:(parent:object,scope:Projection)=>object|undefined;maxSnapshotBytes?:number;readProbeOperation?:(id:string)=>Operation|undefined}
type Allow=Extract<Decision,{status:'allow'}>;
export interface ApiService {
 execute(request:object,input:ApiCommand,signal?:AbortSignal):ApiMutation;
 query(request:object,input:ApiQuery):ApiQueryResult;
 prepare(request:object,input:Preparation):{status:'ok';snapshot:Readonly<RequestSnapshot>}|Exclude<ApiMutation,{status:'committed'}>;
 resolve(request:object,target:{owner:string;targetType:string;targetId:string}):{status:'available';owner:string;targetType:string;targetId:string;sourceRevision:string;observedAt:string}|{status:'unavailable'|'denied'|'unsupported'};
 directoryConnection(request:object,id:string):Readonly<ApiConnection>;
 probeModel(request:object,id:string):{connection:Readonly<ApiConnection>;model:Readonly<ApiModel>};
 stop():void;
}
const actors=['subject','entry','conversation','relationship','relationshipGeneration'] as const;
const sameActor=(a:Scope,b:Scope)=>actors.every(k=>a[k]===b[k]);
function error(e:unknown,intent:string,query=false):Exclude<ApiMutation,{status:'committed'}>{return e instanceof Failure?{status:e.status,reason:e.reason}:query?{status:'unavailable',reason:'dependency_unavailable'}:{status:'unknown',intent};}
function expected(value:{revision:number},want:number){if(value.revision!==want)fail('revision_conflict');if(value.revision===Number.MAX_SAFE_INTEGER)fail('revision_exhausted');}
function find<T extends {id:string}>(items:T[],id:string):T{return items.find(x=>x.id===id)??fail('not_found');}
function target(c:ApiCommand):string{return c.kind==='connection.create'?'api:connections':c.kind==='model.create'?`connection:${c.connectionId}`:c.kind.startsWith('connection.')?`connection:${c.id}`:`model:${c.id}`;}
/** Domain-owned API configuration aggregate. Store/lock lifetime belongs to the trusted host. No network or credential resolution. */
export function createApiService(store:Store,permission:PermissionReader,options:ApiOptions={}):ApiService {
 decode(store.read().value);const allocate=options.id??randomUUID,maxBytes=options.maxSnapshotBytes??1024*1024;
 if(!Number.isSafeInteger(maxBytes)||maxBytes<=0)throw Error('invalid_snapshot_limit');let stopped=false;
 function live(){if(stopped)fail('api_stopping','unavailable');}
 function authorize(request:object,wanted:Projection):Allow {
  live();let d:Decision;try{d=permission.evaluate(request);}catch{return fail('permission_unavailable','unavailable');}
  live();if(d.status!=='allow')return fail(d.reason);
  if(d.scope.resource!=='connections/api'||d.scope.action!==wanted.action||d.scope.target!==wanted.target||d.scope.context!==wanted.context)return fail('scope_mismatch');return d;
 }
 function recheck(request:object,d:Allow){live();let now:Decision;try{now=permission.recheck(request,d);}catch{return fail('permission_unavailable','unavailable');}live();if(now.status!=='allow'||canonical(now)!==canonical(d))fail(now.status==='allow'?'stale_authorization':now.reason);}
 function snapshot(){live();const snap=store.read();return {snap,state:decode(snap.value)};}
 function id(s:State){const value=allocate();if(!text(value)||[...s.connections,...s.models,...s.intents].some(x=>x.id===value))fail('id_collision');return value;}
 function derived(parent:object,d:Allow,wanted:Projection){const request=options.deriveRequest?.(parent,wanted);if(!request)fail('reference_unavailable');try{const decision=authorize(request,wanted);if(!sameActor(d.scope,decision.scope))fail('reference_unavailable');recheck(request,decision);return {request,decision};}catch{return fail('reference_unavailable');}}
 function mutate(request:object,c:ApiCommand,d:Allow,signal?:AbortSignal):ApiMutation {
  const {snap,state}=snapshot(),key=createHash('sha256').update(canonical({scope:d.scope,intent:c.intent})).digest('hex'),fingerprint=canonical(c),prior=state.intents.find(x=>x.key===key);
  if(prior){if(prior.command!==fingerprint)fail('intent_conflict');recheck(request,d);const proof=prior.phase==='committed'?store.query(key+':apply'):undefined;recheck(request,d);if(!proof)return {status:'unknown',intent:c.intent,id:prior.id};return {status:'committed',id:prior.id,revision:prior.revision};}
  const next=capture(state);let verifyProbe=()=>{};let result:{id:string;revision:number};
  switch(c.kind){
   case 'connection.create':{const item:ApiConnection={id:id(next),revision:1,name:c.name,provider:c.provider,protocol:c.protocol,endpoint:endpoint(c.endpoint,c.endpointMode),endpointMode:c.endpointMode,credentialRef:c.credentialRef,enabled:c.enabled,parameters:c.parameters};next.connections.push(item);result=item;break;}
   case 'connection.edit':{const item=find(next.connections,c.id);expected(item,c.expectedRevision);for(const field of ['name','provider','protocol','endpoint','endpointMode','credentialRef','enabled','parameters'] as const)if(Object.hasOwn(c,field))Object.assign(item,{[field]:c[field]});item.endpoint=endpoint(item.endpoint,item.endpointMode);item.revision++;result=item;break;}
   case 'model.create':{find(next.connections,c.connectionId);if(next.models.some(m=>m.connectionId===c.connectionId&&m.modelId===c.modelId))fail('duplicate_model_unsupported');const item:ApiModel={id:id(next),revision:1,connectionId:c.connectionId,name:c.name,modelId:c.modelId,parameters:c.parameters,observation:null};next.models.push(item);result=item;break;}
   case 'model.edit':{const item=find(next.models,c.id);expected(item,c.expectedRevision);if(c.name!==undefined)item.name=c.name;if(c.parameters!==undefined)item.parameters=c.parameters;item.revision++;result=item;break;}
   case 'model.observe':{const item=find(next.models,c.id);expected(item,c.expectedRevision);const connection=find(next.connections,item.connectionId);let observed;
    if(c.probeOperationId){
     const probe=derived(request,d,{action:'model.probe',target:`model:${item.id}`,context:null});
     const operation=options.readProbeOperation?.(c.probeOperationId);
     const evidence=operation?.observations.find(row=>row.id==='api-probe-result'&&row.phase==='observed')?.value;
     const binding=operation?.connection;
     const scopeHash=createHash('sha256').update(canonical(probe.decision.scope)).digest('hex');
     if(operation?.phase!=='observed'||binding?.adapterId!=='connections/api'||!['openai-chat-probe-1','openai-chat-stream-probe-1'].includes(binding.adapterVersion)
       ||binding.connectionId!==connection.id||binding.configRevision!==connection.revision||!connection.enabled
       ||!object(evidence)||evidence.source!=='probe'||evidence.scopeHash!==scopeHash
       ||evidence.connectionId!==connection.id||evidence.connectionRevision!==connection.revision
       ||(evidence.stream===true)!==(binding.adapterVersion==='openai-chat-stream-probe-1')
       ||evidence.modelId!==item.id||evidence.modelRevision!==item.revision)
      fail('probe_evidence_mismatch','unavailable');
     verifyProbe=()=>recheck(probe.request,probe.decision);
     observed={connectionId:connection.id,connectionRevision:connection.revision,modelId:item.modelId,
      source:'probe',sourceRevision:c.probeOperationId,observedAt:evidence.observedAt,
      capabilities:{text:'supported',stream:evidence.stream===true?'supported':'unknown',tools:'unknown',image:'unknown',reasoning:'unknown'},parameters:{}};
    }else{
     if(!options.observer)fail('observer_unavailable','unavailable');

    try{observed=capture(options.observer.resolve(request,freeze(capture(connection)),freeze(capture(item))));}catch{return fail('observation_unavailable','unavailable');}
    }
    if(!observation(observed)||observed.connectionId!==connection.id||observed.connectionRevision!==connection.revision||observed.modelId!==item.modelId)fail('observation_identity_mismatch','unavailable');
    const priorEvidence=item.observation;
    if(c.probeOperationId&&priorEvidence?.connectionRevision===connection.revision){
     const losesCapability=(Object.keys(priorEvidence.capabilities) as Array<keyof typeof priorEvidence.capabilities>).some(key=>{
      const prior=priorEvidence.capabilities[key];
      return (prior==='supported'||prior==='unsupported')&&observed.capabilities[key]!==prior;
     });
     if(losesCapability||Object.keys(priorEvidence.parameters).length||Object.keys(priorEvidence.limits??{}).length)fail('probe_would_replace_verified_evidence');
    }
    item.observation=observed;item.revision++;result=item;break;}
  }
  const record:Intent={key,command:fingerprint,id:result.id,revision:result.revision,phase:'committed'},prepared=capture(state);prepared.intents.push({...record,phase:'prepared'});
  verifyProbe();recheck(request,d);if(signal?.aborted)fail('cancelled');
  const prep=store.commit({intent:key+':prepare',expectedRevision:snap.revision,value:prepared as unknown as Json});
  if(prep.status==='unknown')return {status:'unknown',intent:c.intent,id:result.id};if(prep.status!=='committed')return {status:'failed_no_commit',reason:prep.reason};
  next.intents.push(record);verifyProbe();recheck(request,d);if(signal?.aborted)fail('cancelled');
  const applied=store.commit({intent:key+':apply',expectedRevision:prep.revision,value:next as unknown as Json});
  return applied.status==='committed'?{status:'committed',id:result.id,revision:result.revision}:applied.status==='unknown'?{status:'unknown',intent:c.intent,id:result.id}:{status:'failed_no_commit',reason:applied.reason};
 }
 function query(request:object,input:ApiQuery):ApiQueryResult {
  try{const q=capture(input);if(!object(q))fail('invalid_query');
   if(q.kind==='connections'||q.kind==='models'){
    if(q.kind==='connections'?!closed(q,['kind']):!closed(q,['kind','connectionId'])||!text(q.connectionId))fail('invalid_query');
    const kind=q.kind==='connections'?'connection':'model',d=authorize(request,{action:`${kind}.list`,target:q.kind==='connections'?'api:connections':`connection:${q.connectionId}`,context:null});
    if(!options.deriveRequest)fail('projection_binding_unavailable','unavailable');const {state}=snapshot(),items=q.kind==='connections'?state.connections:state.models.filter(m=>m.connectionId===q.connectionId);
    const rows:{request:object;decision:Allow;value:ApiConnection|ApiModel}[]=[];
    for(const item of items){try{const r=derived(request,d,{action:`${kind}.read`,target:`${kind}:${item.id}`,context:null});rows.push({...r,value:capture(item)});}catch{/* omit inaccessible identities */}}
    const visible:Array<ApiConnection|ApiModel>=[];for(const row of rows){try{recheck(row.request,row.decision);visible.push(row.value);}catch{/* no stale names or counts */}}
    recheck(request,d);return {status:'ok',value:visible};
   }
   if(!closed(q,['kind','id'])||!['connection','model'].includes(q.kind)||!text(q.id))fail('invalid_query');const d=authorize(request,{action:`${q.kind}.read`,target:`${q.kind}:${q.id}`,context:null});
   const {state}=snapshot(),value=capture(q.kind==='connection'?find(state.connections,q.id):find(state.models,q.id));recheck(request,d);return {status:'ok',value};
  }catch(e){return error(e,'query',true);}
 }
 function prepare(request:object,input:Preparation):ReturnType<ApiService['prepare']>{
  try{
   const p=capture(input);if(!closed(p,['requestId','connectionId','connectionRevision','modelId','modelRevision','context','parameters','messages','timeoutMs','stream'],['tools','headersTimeoutMs','idleTimeoutMs'])||!text(p.requestId)||!text(p.connectionId)||!text(p.modelId)||!revision(p.connectionRevision)||!revision(p.modelRevision)||(p.context!==null&&!text(p.context))||!parameters(p.parameters)||!revision(p.timeoutMs)||typeof p.stream!=='boolean'||!Array.isArray(p.messages)||p.messages.length===0||!p.messages.every(m=>closed(m,['role','content'])&&['system','user','assistant'].includes(String(m.role))&&typeof m.content==='string'))fail('invalid_preparation');
   for(const limit of [p.headersTimeoutMs,p.idleTimeoutMs]){
    if(limit!==undefined&&(!revision(limit)||limit>2147483647))fail('invalid_phase_timeout');
   }
   let tools:ReturnType<typeof captureTools>;try{tools=captureTools(p.tools);}catch{fail('invalid_tool_declarations');}
   const d=authorize(request,{action:'request.prepare',target:`model:${p.modelId}`,context:p.context});
   // Requiring both reads protects metadata, credential references and model existence in returned plans.
   const cr=derived(request,d,{action:'connection.read',target:`connection:${p.connectionId}`,context:null}),mr=derived(request,d,{action:'model.read',target:`model:${p.modelId}`,context:null});
   const {state}=snapshot(),connection=find(state.connections,p.connectionId),model=find(state.models,p.modelId);
   if(connection.revision!==p.connectionRevision||model.revision!==p.modelRevision)fail('revision_conflict');if(model.connectionId!==connection.id)fail('model_connection_mismatch');if(!connection.enabled)fail('connection_disabled');if(connection.protocol!=='openai-chat')fail('unsupported_protocol');
   const observed=model.observation;if(!observed)fail('capability_unverified');if(observed.connectionRevision!==connection.revision)fail('capability_observation_stale');
   if(observed.capabilities.text!=='supported'||(p.stream&&observed.capabilities.stream!=='supported'))fail('capability_unsupported_or_unknown');
   if(tools.length&&observed.capabilities.tools!=='supported')fail('tool_capability_unverified');
   const values:Record<string,Json>={},sources:Record<string,string[]>={},settings=new Map<string,{setting:Parameters[string];sources:string[]}>();
   for(const [source,params] of [['connection',connection.parameters],['model',model.parameters],['request',p.parameters]] as const)for(const [name,setting] of Object.entries(params)){
    const prior=settings.get(name);if(prior){if(canonical(prior.setting)!==canonical(setting))fail('parameter_conflict');prior.sources.push(source);}else settings.set(name,{setting,sources:[source]});
   }
   for(const [name,row] of settings){sources[name]=row.sources;if(row.setting.mode!=='value')continue;const spec=observed.parameters[name];if(!spec)fail('parameter_unsupported');if(!parameterValue(row.setting.value,spec))fail('parameter_invalid');values[name]=row.setting.value;}
   const outputLimit=observed.limits?.maxOutputTokens;
   if(outputLimit!==undefined){
    for(const key of ['max_tokens','max_completion_tokens']){
     const value=values[key];
     if(typeof value==='number'&&value>outputLimit)fail('model_output_limit_exceeded');
    }
   }
   const url=new URL(connection.endpoint);if(connection.endpointMode==='base')url.pathname=url.pathname.replace(/\/$/,'')+'/chat/completions';
   const wireTools=tools.map(t=>({type:'function',function:t}));
   const data={...(tools.length?{tools}:{}),requestId:p.requestId,context:p.context,conversation:d.scope.conversation,connection:capture(connection),model:capture(model),url:url.href,body:{...values,model:model.modelId,messages:p.messages,stream:p.stream,...(tools.length?{tools:wireTools as unknown as Json}:{} )},parameterSources:sources,parameterSettings:Object.fromEntries([...settings].map(([name,row])=>[name,row.setting])),timeoutMs:p.timeoutMs,...(p.headersTimeoutMs===undefined?{}:{headersTimeoutMs:p.headersTimeoutMs}),...(p.idleTimeoutMs===undefined?{}:{idleTimeoutMs:p.idleTimeoutMs})};
   const encoded=canonical(data);if(Buffer.byteLength(encoded,'utf8')>maxBytes)fail('snapshot_too_large');
   recheck(cr.request,cr.decision);recheck(mr.request,mr.decision);recheck(request,d);
   return {status:'ok',snapshot:freeze({...data,fingerprint:createHash('sha256').update(encoded).digest('hex')})};
  }catch(e){return error(e,'prepare',true);}
 }
 return Object.freeze({
  execute(request:object,input:ApiCommand,signal?:AbortSignal):ApiMutation{let c:ApiCommand;try{c=command(input);}catch(e){return error(e,'invalid',true);}try{if(signal?.aborted)fail('cancelled');const d=authorize(request,{action:c.kind,target:target(c),context:null});return mutate(request,c,d,signal);}catch(e){return error(e,c.intent);}},
  query,prepare,
  probeModel(request:object,id:string){
   const wanted={target:`model:${id}`,context:null};
   const decision=authorize(request,{...wanted,action:'model.probe'});
   const modelRead=derived(request,decision,{...wanted,action:'model.read'});
   const {state}=snapshot();
   const model=find(state.models,id);
   const connectionRead=derived(request,decision,{target:`connection:${model.connectionId}`,context:null,action:'connection.read'});
   const connection=find(state.connections,model.connectionId);
   recheck(modelRead.request,modelRead.decision);
   recheck(connectionRead.request,connectionRead.decision);
   recheck(request,decision);
   return freeze(capture({connection,model}));
  },
  directoryConnection(request:object,id:string){
   const wanted={target:`connection:${id}`,context:null};
   const decision=authorize(request,{...wanted,action:'directory.refresh'});
   const read=derived(request,decision,{...wanted,action:'connection.read'});
   const connection=freeze(capture(find(snapshot().state.connections,id)));
   recheck(read.request,read.decision);
   recheck(request,decision);
   return connection;
  },
  resolve(request:object,input:{owner:string;targetType:string;targetId:string}){
   try{const t=capture(input);if(!closed(t,['owner','targetType','targetId'])||t.owner!=='connections/api'||!['api','model'].includes(t.targetType)||!text(t.targetId))return {status:'unsupported' as const};live();
    const parent=permission.evaluate(request);if(parent.status!=='allow')return {status:'denied' as const};const kind=t.targetType==='api'?'connection':'model',r=derived(request,parent,{action:`${kind}.read`,target:`${kind}:${t.targetId}`,context:null});const q=query(r.request,{kind,id:t.targetId});if(q.status!=='ok'||Array.isArray(q.value))return {status:'unavailable' as const};recheck(r.request,r.decision);
    const now=permission.recheck(request,parent);live();if(now.status!=='allow'||canonical(now)!==canonical(parent))return {status:'denied' as const};
    return {status:'available' as const,...t,sourceRevision:String(q.value.revision),observedAt:new Date().toISOString()};
   }catch{return {status:'unavailable' as const};}
  },
  stop(){stopped=true;}
 });
}
