import {randomUUID} from 'node:crypto';
import type {FoundationHost} from './foundations.js';
import type {DesktopAuthority} from './desktop-authority.js';
import type {CredentialTarget} from './credential-prompt.js';
import type {LocalOperation} from './local-entries.js';
import type {ApiCommand,ApiMutation,ApiQuery,ApiQueryResult,ApiConnection,ApiModel,Parameters} from '../../connections/api/src/index.js';
import {supportedApiProtocols} from '../../connections/api/src/index.js';
import type {DesktopApiInput,DesktopApiReply,ApiCommonParameters} from '../../UI/src/index.js';
const definitions:Record<string,{required:string[];optional?:string[]}>={
 snapshot:{required:['kind']},models:{required:['kind','connectionId']},
 'connection.create':{required:['kind','name','provider','endpoint','endpointMode','enabled'],optional:['parameters','protocol']},
 'connection.edit':{required:['kind','id','expectedRevision'],optional:['name','provider','protocol','endpoint','endpointMode','enabled','parameters']},
 'connection.delete':{required:['kind','id','expectedRevision']},
 'connection.refresh':{required:['kind','id','expectedRevision']},
 'model.create':{required:['kind','connectionId','name','modelId'],optional:['parameters']},
 'model.edit':{required:['kind','id','expectedRevision'],optional:['name','parameters']},
 'model.delete':{required:['kind','id','expectedRevision']},
 'model.probe':{required:['kind','id','expectedRevision'],optional:['stream']},
 'credential.set':{required:['kind','connectionId','expectedRevision']},'credential.revoke':{required:['kind','connectionId','expectedRevision']}
};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
function capture(raw:unknown):DesktopApiInput|undefined{
 if(!object(raw)||typeof raw.kind!=='string'||!Object.hasOwn(definitions,raw.kind))return;
 const rule=definitions[raw.kind]!,keys=[...rule.required,...(rule.optional??[])];
 if(rule.required.some(k=>!Object.hasOwn(raw,k))||Reflect.ownKeys(raw).some(k=>typeof k!=='string'||!keys.includes(k)))return;
 const out:Record<string,unknown>={};
 for(const [key,value] of Object.entries(raw)){
  if(key==='parameters'){
   if(!object(value)||Object.keys(value).some(k=>!['temperature','top_p','max_tokens'].includes(k)))return;
   const params:ApiCommonParameters={};
   for(const [name,setting] of Object.entries(value)){
    if(!object(setting)||!['value','provider-default','disabled'].includes(String(setting.mode)))return;
    if(setting.mode==='value'){
     if(Reflect.ownKeys(setting).length!==2||!Object.hasOwn(setting,'value')||typeof setting.value!=='number'||!Number.isFinite(setting.value))return;
     (params as Record<string,unknown>)[name]={mode:'value',value:setting.value};
    }else{if(Reflect.ownKeys(setting).length!==1)return;(params as Record<string,unknown>)[name]={mode:setting.mode};}
   }out[key]=params;continue;
  }
  if(['enabled','stream'].includes(key)){if(typeof value!=='boolean')return;}
  else if(key==='expectedRevision'){if(!Number.isSafeInteger(value)||Number(value)<1)return;}
  else if(typeof value!=='string'||!value.trim()||value.length>4096)return;
  if(key==='endpointMode'&&!['base','request'].includes(String(value)))return;
  if(key==='protocol'&&!supportedApiProtocols().includes(String(value)))return;
  out[key]=value;
 }
 return out as unknown as DesktopApiInput;
}
const titles:Record<string,string>={snapshot:'查看 API 连接配置',models:'查看模型列表','connection.create':'创建连接','connection.edit':'修改连接','connection.delete':'删除连接配置','connection.refresh':'准备读取服务端模型目录','model.create':'创建模型配置','model.edit':'修改模型配置','model.delete':'删除模型配置','model.probe':'准备验证模型','credential.set':'配置或替换此连接的加密凭证','credential.revoke':'解除凭证并停用此连接'};
const key=(op:LocalOperation)=>JSON.stringify(op);
/** Main-only concrete settings adapter. No generic execute, raw credential input or model-declared capability path. */
export function createDesktopApi(options:{authority:DesktopAuthority;confirm:(summary:string)=>Promise<boolean>;requestCredential:(target:CredentialTarget)=>Promise<string|undefined>;cancelCredential:()=>void}){
 const {authority}=options,pending=new Map<string,LocalOperation>();
 let host:FoundationHost|undefined,closed=false,reading=false,active:AbortController|undefined;
 const op=(action:string,target:string,resource='connections/api'):LocalOperation=>({resource,action,target,context:null});
 const derive=(parent:object,wanted:{action:string;target:string;context:string|null})=>{
  if(closed||!authority.owns(parent,'connections/api')||!['connection.read','model.read','model.probe','request.prepare'].includes(wanted.action))return;
  const scope={resource:'connections/api',...wanted};
  if(!authority.enabled(scope)){if(reading&&['connection.read','model.read'].includes(wanted.action))pending.set(key(scope),scope);return;}
  return authority.derive(parent,wanted);
 };
 async function query(input:ApiQuery,scope:LocalOperation):Promise<ApiQueryResult>{
  authority.permit(scope);
  for(let n=0;n<6;n++){
   pending.clear();reading=true;let result:ApiQueryResult;
   try{result=host!.api!.query(authority.bind(scope)!,input);}finally{reading=false;}
   if(closed)throw Error('host_closed');if(!pending.size)return result;if(pending.size>2000)throw Error('projection_limit');
   for(const value of pending.values())authority.permit(value);
  }throw Error('projection_unavailable');
 }
 async function connection(id:string):Promise<ApiConnection>{
  const result=await query({kind:'connection',id},op('connection.read','connection:'+id));
  if(result.status!=='ok'||Array.isArray(result.value)||!('endpoint'in result.value))throw Error('connection_unavailable');return result.value;
 }
 async function model(id:string):Promise<ApiModel>{
  const result=await query({kind:'model',id},op('model.read','model:'+id));
  if(result.status!=='ok'||Array.isArray(result.value)||!('modelId'in result.value))throw Error('model_unavailable');return result.value;
 }
 function execute(command:ApiCommand):ApiMutation{
  const target=command.kind==='connection.create'?'api:connections':command.kind==='model.create'?'connection:'+command.connectionId:
   command.kind.startsWith('connection.')?'connection:'+('id'in command?command.id:''):'model:'+('id'in command?command.id:'');
  const scope=op(command.kind,target);authority.permit(scope);return host!.api!.execute(authority.bind(scope)!,command);
 }
 async function perform(input:DesktopApiInput):Promise<DesktopApiReply>{
  const allowed=await authority.confirm(options.confirm,'API 设置操作：'+titles[input.kind]+('name'in input?' — '+input.name:'')+('endpoint'in input?'；地址：'+input.endpoint:'')+('id'in input?'；对象 ID：'+input.id:'')+('connectionId'in input?'；连接 ID：'+input.connectionId:'')+'。配置保存不会自动向 Provider 发送请求。');
  if(closed)return {status:'unavailable',reason:'host_closed'};if(!allowed)return {status:'cancelled'};
  if(input.kind==='snapshot'){
   const result=await query({kind:'connections'},op('connection.list','api:connections'));
   return result.status==='ok'?{status:'ok',view:'connections',connections:result.value as ApiConnection[],credentialBackend:host?.credentials?.available()??false}:result as DesktopApiReply;
  }
  if(input.kind==='models'){
   await connection(input.connectionId);
   const result=await query({kind:'models',connectionId:input.connectionId},op('model.list','connection:'+input.connectionId));
   return result.status==='ok'?{status:'ok',view:'models',models:result.value as ApiModel[]}:result as DesktopApiReply;
  }
  if(input.kind==='credential.set'||input.kind==='credential.revoke'){
   const current=await connection(input.connectionId);
   if(current.revision!==input.expectedRevision)return {status:'rejected',reason:'revision_conflict'};
   if(!host?.credentials)return {status:'unavailable',reason:'credential_backend_unavailable'};
   if(input.kind==='credential.revoke'){
    // Confirmed disable/clear first: an uncertain vault cleanup cannot keep a connection routable.
    const detached=execute({kind:'connection.edit',intent:randomUUID(),id:current.id,expectedRevision:current.revision,credentialRef:null,enabled:false});
    if(detached.status!=='committed'||!current.credentialRef)return detached;
    const scope=op('credential.revoke','credential:'+current.credentialRef.id,'credentials');authority.permit(scope);
    const result=host.credentials.revoke(authority.bind(scope)!,{id:current.credentialRef.id,expectedRevision:current.credentialRef.revision,intent:randomUUID()});
    return result.status==='committed'?detached:{...detached,notice:'credential_record_cleanup_unconfirmed'};
   }
   if(!host.credentials.available())return {status:'unavailable',reason:'credential_backend_unavailable'};
   if(new URL(current.endpoint).protocol!=='https:')return {status:'rejected',reason:'credential_requires_https'};
   const management=op('connection.edit','connection:'+current.id);authority.permit(management);
   const managementRequest=authority.bind(management)!,managementDecision=host.permissions!.evaluate(managementRequest);
   if(managementDecision.status!=='allow')return {status:'rejected',reason:'permission_unavailable'};
   const secret=await options.requestCredential({connectionName:current.name,provider:current.provider,endpoint:current.endpoint});
   if(closed)return {status:'unavailable',reason:'host_closed'};if(secret===undefined)return {status:'cancelled'};
   if(host.permissions!.recheck(managementRequest,managementDecision).status!=='allow')return {status:'rejected',reason:'authorization_changed'};
   const id=randomUUID(),scope=op('credential.write','credential:'+id,'credentials');authority.permit(scope);
   const stored=host.credentials.put(authority.bind(scope)!,{id,intent:randomUUID(),expectedRevision:0,binding:{connectionId:current.id,endpoint:current.endpoint,provider:current.provider},secret});
   if(stored.status==='unknown')return stored;
   if(stored.status!=='committed')return {status:'unavailable',reason:'credential_save_'+stored.status};
   const linked=execute({kind:'connection.edit',intent:randomUUID(),id:current.id,expectedRevision:current.revision,credentialRef:stored.reference});
   if(linked.status==='committed'&&current.credentialRef){
    const oldScope=op('credential.revoke','credential:'+current.credentialRef.id,'credentials');authority.permit(oldScope);
    const cleanup=host.credentials.revoke(authority.bind(oldScope)!,{id:current.credentialRef.id,expectedRevision:current.credentialRef.revision,intent:randomUUID()});
    if(cleanup.status!=='committed')return {...linked,notice:'previous_credential_cleanup_unconfirmed'};
   }return linked;
  }
  if(input.kind==='model.probe'||input.kind==='connection.refresh'){
   const selected=input.kind==='model.probe'?await model(input.id):undefined;
   const current=await connection(selected?.connectionId??input.id);
   if((selected?.revision??current.revision)!==input.expectedRevision)return {status:'rejected',reason:'revision_conflict'};
   const approved=await authority.confirm(options.confirm,(selected?'测试并保存模型观测：'+selected.name+'（'+selected.modelId+'）':'读取服务端模型目录')+'\n'+current.endpoint+'\n将发送真实网络请求，可能由 Provider 计费。结果未知时保留原 Operation，不自动重试。');
   if(closed)return {status:'unavailable',reason:'host_closed'};if(!approved)return {status:'cancelled'};
   const operationId=randomUUID();active=new AbortController();
   try{
    if(!selected){
     const scope=op('directory.refresh','connection:'+current.id);authority.permit(scope);
     const result=await host!.api!.refreshDirectory(authority.bind(scope)!,operationId,current.id,current.revision,20000,active.signal);
     if(result.status==='ok')return {status:'ok',view:'directory',operationId,modelIds:result.observation.modelIds,observedAt:result.observation.observedAt};
     return result.status==='unknown'?{status:'unknown',intent:operationId,operationId}:{status:'rejected',reason:result.reason,operationId};
    }
    const scope=op('model.probe','model:'+selected.id);authority.permit(scope);authority.permit(op('model.observe','model:'+selected.id));
    const result=await host!.api!.probeGeneration(authority.bind(scope)!,operationId,selected.id,current.revision,selected.revision,20000,active.signal,input.kind==='model.probe'?(input.stream??true):true);
    if(result.status!=='ok')return result.status==='unknown'?{status:'unknown',intent:operationId,operationId}:{status:'rejected',reason:result.reason,operationId};
    if(closed)return {status:'unavailable',reason:'host_closed',operationId};
    const saved=execute({kind:'model.observe',intent:randomUUID(),id:selected.id,expectedRevision:selected.revision,probeOperationId:operationId});
    return {...saved,operationId};
   }finally{active=undefined;}
  }
  if(input.kind==='connection.create')return execute({...input,intent:randomUUID(),protocol:input.protocol??'openai-chat',credentialRef:null,parameters:input.parameters??{}});
  if(input.kind==='connection.edit'){
   const current=await connection(input.id);
   return execute({...input,intent:randomUUID(),...(input.parameters?{parameters:{...current.parameters,...input.parameters} as Parameters}:{})});
  }
  if(input.kind==='model.create'){await connection(input.connectionId);return execute({...input,intent:randomUUID(),parameters:input.parameters??{}});}
  if(input.kind==='model.edit'){
   const current=await model(input.id);
   return execute({...input,intent:randomUUID(),...(input.parameters?{parameters:{...current.parameters,...input.parameters} as Parameters}:{})});
  }
  if(input.kind==='connection.delete'||input.kind==='model.delete')return execute({...input,intent:randomUUID()});
  return {status:'rejected',reason:'unsupported_operation'};
 }
 return Object.freeze({derive,
  attach(value:FoundationHost){if(host)throw Error('already_attached');host=value;authority.attach(value);},
  async request(raw:unknown):Promise<DesktopApiReply>{
   const input=capture(raw);if(!input)return {status:'rejected',reason:'invalid_request'};
   if(closed||!host?.api||!host.local)return {status:'unavailable',reason:'api_unavailable'};
   try{return await authority.run(()=>perform(input))??{status:'unavailable',reason:'operation_in_progress'};}
   catch{return {status:'unavailable',reason:'settings_operation_unavailable'};}
  },
  cancel(){active?.abort();options.cancelCredential();},
  close(){closed=true;active?.abort();options.cancelCredential();authority.close();}
 });
}
