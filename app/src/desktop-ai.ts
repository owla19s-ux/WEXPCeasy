import {randomUUID} from 'node:crypto';
import type {FoundationHost} from './foundations.js';
import type {DesktopAuthority} from './desktop-authority.js';
import type {LocalOperation} from './local-entries.js';
import type {DesktopAiInput,DesktopAiReply,AiConfiguration,AiEntry} from '../../UI/src/index.js';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:Record<string,unknown>,keys:string[])=>Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(v);
function capture(raw:unknown):DesktopAiInput|undefined{
 if(!object(raw))return;
 if(raw.kind==='snapshot'&&exact(raw,['kind']))return {kind:'snapshot'};
 if(raw.kind!=='save'||!exact(raw,['kind','id','expectedRevision','value'])||!id(raw.id)||!Number.isSafeInteger(raw.expectedRevision)||Number(raw.expectedRevision)<0||!object(raw.value))return;
 const v=raw.value;
 if(typeof v.name!=='string'||!v.name.trim()||v.name.length>256)return;
 if(v.kind==='role'&&exact(v,['kind','name','prompt'])&&typeof v.prompt==='string'&&v.prompt.trim()&&v.prompt.length<=32000||
    v.kind==='position'&&exact(v,['kind','name','responsibility'])&&typeof v.responsibility==='string'&&v.responsibility.trim()&&v.responsibility.length<=8000||
    v.kind==='agent'&&exact(v,['kind','name','roleId','positionId','model'])&&id(v.roleId)&&id(v.positionId)&&object(v.model)&&exact(v.model,['connectionId','modelId'])&&id(v.model.connectionId)&&id(v.model.modelId))
  return structuredClone(raw) as unknown as DesktopAiInput;
}
export function createDesktopAi(options:{authority:DesktopAuthority;confirm:(summary:string)=>Promise<boolean>}){
 const a=options.authority;let host:FoundationHost|undefined,closed=false,reading=false;
 const pending=new Map<string,LocalOperation>();
 function bindRead(parent:object,scope:LocalOperation){
  if(closed||!a.owns(parent,'AI')||scope.context!==null||
   !(scope.resource==='AI'&&['role.read','position.read','agent.read'].includes(scope.action)||scope.resource==='connections/api'&&scope.action==='model.read'))return;
  if(!a.enabled(scope)){if(reading)pending.set(JSON.stringify(scope),scope);return;}
  return a.related(parent,scope);
 }
 const op=(action:string,target:string):LocalOperation=>({resource:'AI',action,target,context:null});
 async function snapshot():Promise<DesktopAiReply>{
  for(const kind of ['role','position','agent'])a.permit(op(kind+'.list',kind+':*'));
  for(let n=0;n<6;n++){
   pending.clear();reading=true;const entries:AiEntry[]=[];
   try{for(const kind of ['role','position','agent'] as const){
    const result=host!.ai!.list(a.bind(op(kind+'.list',kind+':*'))!,kind);
    if(result.status!=='ok')return result;entries.push(...result.entries);
   }}finally{reading=false;}
   if(!pending.size)return {status:'ok',entries};
   if(pending.size>2000)return {status:'unavailable',reason:'projection_limit'};
   for(const scope of pending.values())a.permit(scope);
  }return {status:'unavailable',reason:'projection_unavailable'};
 }
 return Object.freeze({bindRead,attach(value:FoundationHost){if(host)throw Error('already_attached');host=value;a.attach(value);},
  async request(raw:unknown):Promise<DesktopAiReply>{
   const input=capture(raw);if(!input)return {status:'rejected',reason:'invalid_request'};
   if(closed||!host?.ai)return {status:'unavailable',reason:'ai_unavailable'};
   try{return await a.run(async()=>{
    if(!await a.confirm(options.confirm,input.kind==='snapshot'?'查看当前数据根的岗位、角色与 Agent 配置。':'保存 '+input.value.kind+' 配置：'+input.value.name+'。模型绑定不授予执行权限。'))return {status:'cancelled'};
    if(input.kind==='snapshot')return snapshot();
    const v:AiConfiguration=input.value;
    if(v.kind==='agent'){
     a.permit(op('role.read','role:'+v.roleId));a.permit(op('position.read','position:'+v.positionId));
     a.permit({resource:'connections/api',action:'model.read',target:'model:'+v.model.modelId,context:null});
    }
    const scope=op(v.kind+'.write',v.kind+':'+input.id);a.permit(scope);
    return host!.ai!.save(a.bind(scope)!,{id:input.id,intent:randomUUID(),expectedRevision:input.expectedRevision,value:v});
   })??{status:'unavailable',reason:'operation_in_progress'};}catch{return {status:'unavailable',reason:'ai_operation_unavailable'};}
  },close(){closed=true;}
 });
}
