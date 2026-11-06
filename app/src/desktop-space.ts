import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import type {FoundationHost,FoundationOptions} from './foundations.js';
import type {LocalOperation} from './local-entries.js';
import type {Change,Scope} from '../../permissions/src/index.js';
import type {SpaceCommand,SpaceQuery,QueryResult,ProjectionScope} from '../../space/src/index.js';
import type {DesktopSpaceInput,DesktopSpaceReply} from '../../UI/src/index.js';
const schemas:Record<string,readonly string[]>={
 snapshot:['kind'],'context.open':['kind','id'],
 'space.create':['kind','name','description'],'space.edit':['kind','id','expectedRevision','name','description'],
 'space.directory':['kind','id','expectedRevision','clear'],
 'group.create':['kind','spaceId','name'],'group.edit':['kind','id','expectedRevision','name'],
 'context.create':['kind','name','description'],'context.edit':['kind','id','expectedRevision','name','description'],
 'context.group':['kind','contextId','spaceId','groupId','expectedRevision']
};
function capture(input:unknown):DesktopSpaceInput|undefined{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.getPrototypeOf(input)!==Object.prototype)return;
 const row=input as Record<string,unknown>,keys=schemas[String(row.kind)];if(!keys||Reflect.ownKeys(input).some(k=>typeof k!=='string'||!keys.includes(k)))return;
 const out:Record<string,unknown>={};
 for(const key of Object.keys(row)){
  const value=row[key];
  if(key==='expectedRevision'){if(!Number.isSafeInteger(value)||Number(value)<0)return;}
  else if(key==='clear'){if(typeof value!=='boolean')return;}
  else if(key==='groupId'&&value===null){}
  else if(typeof value!=='string'||(key!=='description'&&!value.trim())||value.length>4096)return;
  out[key]=value;
 }
 const required=keys.filter(k=>!['description','clear'].includes(k));
 if(required.some(k=>!Object.hasOwn(out,k)))return;
 return out as unknown as DesktopSpaceInput;
}
const key=(op:LocalOperation)=>JSON.stringify(op);
/** Native-confirmed local UI adapter. Domain data remains in Space; no Renderer identity/grant/path API. */
export function createDesktopSpace(options:{rootId:string;confirm:(summary:string)=>Promise<boolean>;chooseDirectory:()=>Promise<string|undefined>}){
 const source={},historyToken={},session=randomUUID(),management=new WeakSet<object>(),requests=new WeakMap<object,LocalOperation>();
 const enabled=new Set<string>(),pending=new Map<string,LocalOperation>();
 let host:FoundationHost|undefined,closed=false,busy=false,reading=false;
 const identity={subject:'desktop-user',entry:'desktop:'+session,relationship:'desktop:'+session,relationshipGeneration:1,moduleEnabled:true,globalEnabled:true,sourceAllowed:true,entryEnabled:true};
 const policy:Pick<FoundationOptions,'trust'|'local'>={
  trust:{current:()=>undefined,canManage:change=>!closed&&management.has(change),canReadHistory:r=>!closed&&r===historyToken},
  local:{current:(candidate,op)=>!closed&&candidate===source&&enabled.has(key(op))?identity:undefined}
 };
 const operation=(action:string,target:string,context:string|null=null):LocalOperation=>({resource:'space',action,target,context});
 const bind=(op:LocalOperation)=>{const request=host?.local?.bind(source,op);if(request)requests.set(request,op);return request;};
 function permit(op:LocalOperation){
  if(closed||!host?.permissions||!host.local)throw Error('space_unavailable');
  enabled.add(key(op));const request=bind(op);if(!request)throw Error('entry_unavailable');
  if(host.permissions.evaluate(request).status==='allow')return;
  const history=host.permissions.history(historyToken);if(history.status!=='ok')throw Error('permission_history_unavailable');
  const scope:Scope={subject:identity.subject,entry:identity.entry,relationship:identity.relationship,relationshipGeneration:1,conversation:null,...op};
  const change:Change={intent:randomUUID(),expectedRevision:history.revision,scope};
  management.add(change);const result=host.permissions.grant(change);management.delete(change);
  if(result.status!=='committed')throw Error('permission_commit_unconfirmed');
 }
 const derive=(parent:object,wanted:ProjectionScope):object|undefined=>{
  if(closed||!requests.has(parent)||!['context.read','space.read','group.read','category.read'].includes(wanted.action))return;
  const op=operation(wanted.action,wanted.target,wanted.context);
  if(!enabled.has(key(op))){if(reading)pending.set(key(op),op);return;}
  const child=host?.local?.derive(parent,wanted);if(child)requests.set(child,op);return child;
 };
 async function query(input:SpaceQuery,op:LocalOperation):Promise<QueryResult>{
  permit(op);
  for(let round=0;round<6;round++){
   pending.clear();reading=true;
   let result:QueryResult;
   try{result=await host!.space!.query(bind(op)!,input);}finally{reading=false;}
   if(closed)throw Error('session_closed');
   if(!pending.size)return result;
   // Discovery is read-only. Grant exact derived reads covered by this native-confirmed operation,
   // then start a fresh query so permission revisions are never changed inside a domain recheck.
   if(pending.size>2000)throw Error('projection_limit');
   for(const scope of pending.values())permit(scope);
  }
  throw Error('projection_unavailable');
 }
 async function perform(input:DesktopSpaceInput):Promise<DesktopSpaceReply>{
  if(!await options.confirm(input.kind==='snapshot'?'读取当前数据根已登记的 Space、Group 和 Context。仅允许本次本地读取，不授予 AI、网络或文件内容访问。':'本次操作：'+input.kind+('name'in input?' — '+input.name:'')+('id'in input?'；对象 ID：'+input.id:'')+('contextId'in input?'；Context ID：'+input.contextId:'')+('spaceId'in input?'；Space ID：'+input.spaceId:'')+('groupId'in input?'；分组：'+(input.groupId??'不分组'):'')+'。仅修改所选对象，不授予 AI 或外部连接权限。'))return {status:'cancelled'};
  if(closed) return {status:'unavailable',reason:'session_closed'};
  if(input.kind==='snapshot'){
   const spaces=await query({kind:'organization',entity:'space'},operation('organization.list','root:'+options.rootId));
   const groups=await query({kind:'organization',entity:'group'},operation('organization.list','root:'+options.rootId));
   const contexts=await query({kind:'contexts'},operation('context.list','root:'+options.rootId));
   if(spaces.status!=='ok'||groups.status!=='ok'||contexts.status!=='ok')return {status:'unavailable',reason:'snapshot_unavailable'};
   const organizations=[];
   let complete=contexts.complete??true;
   for(const item of contexts.value as {id:string}[]){
    const org=await query({kind:'context.organization',id:item.id},operation('context.organization.read','context:'+item.id,item.id));
    if(org.status==='ok')organizations.push(org.value);else complete=false;
   }
   return {status:'ok',view:'snapshot',spaces:spaces.value as never,groups:groups.value as never,contexts:contexts.value as never,organizations:organizations as never,complete};
  }
  if(input.kind==='context.open'){
   const context=await query({kind:'context',id:input.id},operation('context.read','context:'+input.id,input.id));
   const organization=await query({kind:'context.organization',id:input.id},operation('context.organization.read','context:'+input.id,input.id));
   if(context.status!=='ok'||organization.status!=='ok')return {status:'unavailable',reason:'context_unavailable'};
   const value=context.value as {id:string;revision:number;name:string;description:string};
   return {status:'ok',view:'context',context:{id:value.id,revision:value.revision,name:value.name,description:value.description},organization:organization.value as never};
  }
  let command:SpaceCommand;
  if(input.kind==='context.create'||input.kind==='space.directory'){
   const location=input.kind==='space.directory'&&input.clear?null:await options.chooseDirectory();
   if(location===undefined)return {status:'cancelled'};
   if(closed)return {status:'unavailable',reason:'session_closed'};
   command=input.kind==='context.create'?{kind:input.kind,name:input.name,description:input.description??'',location:resolve(location!),intent:randomUUID()}:
    {kind:input.kind,id:input.id,expectedRevision:input.expectedRevision,location:location===null?null:resolve(location),intent:randomUUID()};
  }else command={...input,intent:randomUUID()} as SpaceCommand;
  if(command.kind==='context.group'){
   const current=await query({kind:'context.organization',id:command.contextId},operation('context.organization.read','context:'+command.contextId,command.contextId));
   if(current.status!=='ok')return {status:'unavailable',reason:'organization_unavailable'};
  }
  if('spaceId'in command)permit(operation('space.read','space:'+command.spaceId));
  if('groupId'in command&&command.groupId)permit(operation('group.read','group:'+command.groupId));
  const context='contextId'in command?command.contextId:command.kind==='context.edit'?command.id:null;
  const target=command.kind==='context.create'?resolve(command.location):context?'context:'+context:
   'id'in command?command.kind.split('.')[0]+':'+command.id:command.kind==='group.create'?'space:'+command.spaceId:'root:'+options.rootId;
  const op=operation(command.kind,target,context);permit(op);
  // Never automatically replay writes, including unknown results.
  return await host!.space!.execute(bind(op)!,command) as DesktopSpaceReply;
 }
 return Object.freeze({policy,derive,attach(value:FoundationHost){if(host)throw Error('already_attached');host=value;},
  async request(raw:unknown):Promise<DesktopSpaceReply>{
   const input=capture(raw);if(!input)return {status:'rejected',reason:'invalid_request'};
   if(closed||!host?.space||!host.local)return {status:'unavailable',reason:'space_unavailable'};
   if(busy)return {status:'unavailable',reason:'operation_in_progress'};
   busy=true;try{return await perform(input);}catch{return {status:'unavailable',reason:'operation_unavailable'};}finally{busy=false;}
  },
  close(){closed=true;enabled.clear();host?.local?.close(source);}
 });
}
