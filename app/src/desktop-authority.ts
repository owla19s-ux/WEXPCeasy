import {randomUUID} from 'node:crypto';
import type {FoundationHost,FoundationOptions} from './foundations.js';
import type {LocalOperation} from './local-entries.js';
import type {DesktopPermissionInput,DesktopPermissionReply} from '../../UI/src/index.js';
import type {Change,Scope} from '../../permissions/src/index.js';
const key=(op:LocalOperation)=>JSON.stringify(op);
function capture(input:LocalOperation):Readonly<LocalOperation>{
 if(!input||typeof input!=='object'||Reflect.ownKeys(input).length!==4||!['resource','action','target','context'].every(k=>Object.hasOwn(input,k)))throw Error('invalid_scope');
 const op={resource:input.resource,action:input.action,target:input.target,context:input.context};
 if(![op.resource,op.action,op.target].every(v=>typeof v==='string'&&v.trim()&&v.length<=4096)||(op.context!==null&&(typeof op.context!=='string'||!op.context.trim()||op.context.length>4096)))throw Error('invalid_scope');
 return Object.freeze(op);
}
/** Per-window identity, operation admission and exact permission bindings only; no business state. */
export function createDesktopAuthority(){
 const source={},historyToken={},session=randomUUID(),management=new WeakSet<object>(),requests=new WeakMap<object,Readonly<LocalOperation>>();
 const enabled=new Set<string>();
 let host:FoundationHost|undefined,closed=false,busy=false,approvedRevision:number|undefined;
 const identity={subject:'desktop-user',entry:'desktop:'+session,relationship:'desktop:'+session,relationshipGeneration:1,moduleEnabled:true,globalEnabled:true,sourceAllowed:true,entryEnabled:true};
 const policy:Pick<FoundationOptions,'trust'|'local'>={
  trust:{current:()=>undefined,canManage:change=>!closed&&management.has(change),canReadHistory:r=>!closed&&r===historyToken},
  local:{current:(candidate,op)=>!closed&&candidate===source&&enabled.has(key(op))?identity:undefined}
 };
 function history(){
  const result=host?.permissions?.history(historyToken);if(result?.status!=='ok')throw Error('permission_history_unavailable');return result;
 }
 function validApproval(){
  if(closed||!busy||approvedRevision===undefined)throw Error('native_consent_required');
  const result=history();
  if(result.records.slice(approvedRevision).some(event=>event.kind==='revoke'))throw Error('authorization_changed');
  return result;
 }
 function bind(input:LocalOperation){
  const op=capture(input);if(closed||!enabled.has(key(op)))return;
  const request=host?.local?.bind(source,op);if(request)requests.set(request,op);return request;
 }
 function permit(input:LocalOperation){
  const op=capture(input),record=validApproval();
  if(!host?.permissions||!host.local)throw Error('entry_unavailable');
  enabled.add(key(op));const request=bind(op);if(!request)throw Error('entry_unavailable');
  if(host.permissions.evaluate(request).status==='allow')return;
  const scope:Scope={subject:identity.subject,entry:identity.entry,relationship:identity.relationship,relationshipGeneration:1,conversation:null,...op};
  const change:Change={intent:randomUUID(),expectedRevision:record.revision,scope};
  management.add(change);let result;try{result=host.permissions.grant(change);}finally{management.delete(change);}
  if(result.status!=='committed')throw Error('permission_commit_unconfirmed');
 }
 return Object.freeze({policy,permit,bind,
  related(parent:object,input:LocalOperation){
   const original=requests.get(parent);if(!original||closed)return;
   const before=host?.permissions?.evaluate(parent);if(before?.status!=='allow')return;
   const child=bind(input);if(!child||host?.permissions?.recheck(parent,before).status!=='allow')return;
   return child;
  },
  async settings(raw:unknown,native:(summary:string)=>Promise<boolean>):Promise<DesktopPermissionReply>{
   if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.getPrototypeOf(raw)!==Object.prototype)return {status:'rejected',reason:'invalid_request'};
   const r=raw as Record<string,unknown>;
   if(r.kind!=='snapshot'&&r.kind!=='revoke')return {status:'rejected',reason:'invalid_request'};
   if(Reflect.ownKeys(r).length!==(r.kind==='snapshot'?1:3))return {status:'rejected',reason:'invalid_request'};
   if(r.kind==='revoke'&&(typeof r.id!=='string'||!Number.isSafeInteger(r.expectedRevision)))return {status:'rejected',reason:'invalid_request'};
   const input=r as unknown as DesktopPermissionInput;
   // Revocation must be able to interrupt an in-flight generation; it does not reuse its approval.
   if(closed||!host?.permissions)return {status:'unavailable',reason:'host_closed'};
   const record=history();
   const current=[...enabled].map(id=>({id,...JSON.parse(id) as LocalOperation}));
   const entry=input.kind==='revoke'?current.find(v=>v.id===input.id):undefined;
   if(input.kind==='revoke'&&(!entry||record.revision!==input.expectedRevision))return {status:'rejected',reason:'revision_conflict'};
   if(await native(input.kind==='snapshot'?'查看当前窗口的精确授权范围。不会展示其他窗口或历史会话的授权。':'撤销此窗口授权：'+entry!.resource+' / '+entry!.action+' / '+entry!.target)!==true)return {status:'cancelled'};
   if(closed)return {status:'unavailable',reason:'host_closed'};
   const latest=history();if(latest.revision!==record.revision)return {status:'rejected',reason:'revision_conflict'};
   if(input.kind==='snapshot')return {status:'ok',revision:latest.revision,entries:current};
   const {resource,action,target,context}=entry!;
   const change:Change={intent:randomUUID(),expectedRevision:latest.revision,scope:{subject:identity.subject,entry:identity.entry,relationship:identity.relationship,relationshipGeneration:1,conversation:null,resource,action,target,context}};
   management.add(change);let result;try{result=host.permissions.revoke(change);}finally{management.delete(change);}
   if(result.status==='committed')enabled.delete(input.id);
   return result.status==='committed'?{status:'committed',revision:result.revision}:result.status==='unknown'?{status:'unknown',intent:result.intent}:{status:'rejected',reason:'revoke_not_committed'};
  },
  enabled:(op:LocalOperation)=>!closed&&enabled.has(key(capture(op))),
  owns:(request:object,resource:string)=>!closed&&requests.get(request)?.resource===resource,
  derive(parent:object,projection:Pick<LocalOperation,'action'|'target'|'context'>){
   const original=requests.get(parent);if(!original||closed)return;
   const op=capture({...original,...projection});if(!enabled.has(key(op)))return;
   const child=host?.local?.derive(parent,projection);if(child)requests.set(child,op);return child;
  },
  attach(value:FoundationHost){if(host&&host!==value)throw Error('authority_already_attached');host=value;if(closed)host.local?.close(source);},
  async confirm(native:(summary:string)=>Promise<boolean>,summary:string){
   if(closed||!busy)return false;
   if(await native(summary)!==true||closed)return false;
   const result=history();if(approvedRevision===undefined)approvedRevision=result.revision;else validApproval();
   return true;
  },
  async run<T>(work:()=>Promise<T>):Promise<T|undefined>{
   if(closed||busy)return;busy=true;approvedRevision=undefined;
   try{return await work();}finally{approvedRevision=undefined;busy=false;}
  },
  close(){closed=true;enabled.clear();approvedRevision=undefined;host?.local?.close(source);}
 });
}
export type DesktopAuthority=ReturnType<typeof createDesktopAuthority>;
