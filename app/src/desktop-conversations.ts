import {randomUUID} from 'node:crypto';
import type {FoundationHost} from './foundations.js';
import type {DesktopAuthority} from './desktop-authority.js';
import type {LocalOperation} from './local-entries.js';
import type {ConversationChange,Conversation} from '../../conversations/src/index.js';
import type {ApiConnection,ApiModel} from '../../connections/api/src/index.js';
import type {DesktopConversationInput,DesktopConversationReply,ConversationText} from '../../UI/src/index.js';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(v);
function capture(raw:unknown):DesktopConversationInput|undefined{
 if(!object(raw)||typeof raw.kind!=='string')return;
 const fields:Record<string,string[]>={snapshot:['kind'],create:['kind'],open:['kind','id'],send:['kind','id','expectedRevision','agentId','text'],resend:['kind','id','expectedRevision','agentId','text','replaces'],select:['kind','id','expectedRevision','messageId','segmentIds'],recover:['kind','id','generationId']};
 const keys=Object.hasOwn(fields,raw.kind)?fields[raw.kind]:undefined;
 if(!keys||Reflect.ownKeys(raw).length!==keys.length||!keys.every(k=>Object.hasOwn(raw,k)))return;
 for(const [k,v] of Object.entries(raw)){
  if(k==='kind')continue;
  if(k==='expectedRevision'){if(!Number.isSafeInteger(v)||Number(v)<1)return;}
  else if(k==='text'){if(typeof v!=='string'||!v.trim()||v.length>32000)return;}
  else if(k==='segmentIds'){if(!Array.isArray(v)||v.length>256||!v.every(id)||new Set(v).size!==v.length)return;}
  else if(!id(v))return;
 }
 return structuredClone(raw) as unknown as DesktopConversationInput;
}
export function createDesktopConversations(options:{authority:DesktopAuthority;confirm:(summary:string)=>Promise<boolean>;onText?:(event:ConversationText)=>void}){
 const a=options.authority;
 let host:FoundationHost|undefined,closed=false,active:{id:string;generationId:string;cancel:object}|undefined;
 const op=(resource:string,action:string,target:string):LocalOperation=>({resource,action,target,context:null});
 const chat=(action:string,id:string)=>op('conversations',action,'conversation:'+id);
 function grant(scope:LocalOperation){a.permit(scope);const request=a.bind(scope);if(!request)throw Error('permission_unavailable');return request;}
 function read(id:string):Conversation{
  const r=host!.conversations!.service.read(grant(chat('read',id)),id);if(r.status!=='ok')throw Error('conversation_unavailable');return r.conversation;
 }
 function change(id:string,expectedRevision:number,command:ConversationChange){
  return host!.conversations!.service.change(grant(chat(command.kind,id)),{conversationId:id,intent:randomUUID(),expectedRevision,change:command});
 }
 function ai(kind:'agent'|'role'|'position',id:string){
  const scope=op('AI',kind+'.read',kind+':'+id),r=host!.ai!.read(grant(scope),kind,id);
  if(r.status!=='ok')throw Error('configuration_unavailable');return r.entry;
 }
 function api(kind:'connection'|'model',id:string){
  const scope=op('connections/api',kind+'.read',kind+':'+id),r=host!.api!.query(grant(scope),{kind,id});
  if(r.status!=='ok'||Array.isArray(r.value))throw Error('configuration_unavailable');return r.value;
 }
 async function perform(input:DesktopConversationInput):Promise<DesktopConversationReply>{
  if(!await a.confirm(options.confirm,input.kind==='snapshot'?'读取已保存的普通对话列表及当前获准的历史。':input.kind==='send'||input.kind==='resend'?'准备发送对话输入（'+input.text.length+' 字符）。随后会展示实际 Provider 与模型并再次确认网络发送。':'本次普通对话操作：'+input.kind+('id'in input?' / '+input.id:'')))return {status:'cancelled'};
  if(input.kind==='create'){
   const id=randomUUID(),r=change(id,0,{kind:'create'});return r.status==='committed'?{...r,id}:r;
  }
  if(input.kind==='snapshot'){
   const scope=op('conversations','list','conversation:*');grant(scope);
   for(let n=0;n<6;n++){
    const pending:LocalOperation[]=[];
    const result=host!.conversations!.service.list(a.bind(scope)!,id=>{
     const s=chat('read',id);if(!a.enabled(s)){pending.push(s);return;}return a.bind(s);
    });
    if(!pending.length)return result;
    if(pending.length>2000)return {status:'unavailable',reason:'projection_limit'};
    for(const s of pending)grant(s);
   }return {status:'unavailable',reason:'projection_unavailable'};
  }
  const current=read(input.id);
  if(input.kind==='open')return {status:'ok',conversation:current};
  if(input.kind==='recover'){
   const generation=current.generations.find(g=>g.id===input.generationId);
   if(!generation?.operationId)return {status:'invalid_transition'};
   return host!.conversations!.generation!.recover({read:grant(chat('read',input.id)),receipt:grant(op('conversations','receipt.read','operation:'+generation.operationId)),finish:grant(chat('finish',input.id))},input.id,input.generationId,randomUUID());
  }
  if(current.revision!==input.expectedRevision)return {status:'revision_conflict'};
  if(input.kind==='select')return change(input.id,input.expectedRevision,{kind:'select',messageId:input.messageId,segmentIds:input.segmentIds});
  if(!host?.api||!host.ai||!host.conversations?.generation)return {status:'unavailable',reason:'generation_unavailable'};
  const agent=ai('agent',input.agentId);if(agent.kind!=='agent')return {status:'reference_unavailable'};
  const role=ai('role',agent.roleId);if(role.kind!=='role')return {status:'reference_unavailable'};
  ai('position',agent.positionId);
  const model=api('model',agent.model.modelId) as ApiModel,connection=api('connection',agent.model.connectionId) as ApiConnection;
  if(model.connectionId!==connection.id)return {status:'reference_unavailable'};
  if(!await a.confirm(options.confirm,'向 Provider 发送真实对话请求：'+connection.name+'\n'+connection.endpoint+'\n模型：'+model.name+' ('+model.modelId+')\n包括当前对话历史、角色提示词和本次输入，可能产生费用。输入：\n'+input.text))return {status:'cancelled'};
  // Capture all exact permissions before dispatch. The running round keeps this configuration snapshot.
  grant(op('connections/api','request.prepare','model:'+model.id));
  const requests={read:grant(chat('read',input.id)),dispatch:grant(chat('dispatch',input.id)),api:grant(op('connections/api','request.send','model:'+model.id)),
   finish:grant(chat('finish',input.id)),fail:grant(chat('fail',input.id)),unknown:grant(chat('unknown',input.id))};
  const cancel=grant(chat('cancel',input.id));grant(chat('append',input.id));grant(chat(input.kind==='resend'?'resend':'begin',input.id));
  const generationId=randomUUID(),messageId=randomUUID();
  let r;
  if(input.kind==='resend')r=change(input.id,current.revision,{kind:'resend',replaces:input.replaces!,messageId,generationId,segments:[{id:'text',text:input.text}]});
  else{
   r=change(input.id,current.revision,{kind:'append',messageId,segments:[{id:'text',text:input.text}]});
   if(r.status==='committed')r=change(input.id,r.revision,{kind:'begin',generationId,inputMessageId:messageId});
  }
  if(r.status!=='committed')return r;
  active={id:input.id,generationId,cancel};
  try{
   return await host.conversations.generation.send({conversationId:input.id,generationId,operationId:randomUUID(),replyId:randomUUID(),intent:randomUUID(),expectedRevision:r.revision,requests,systemPrompt:role.prompt,
    preparation:{requestId:randomUUID(),connectionId:connection.id,connectionRevision:connection.revision,modelId:model.id,modelRevision:model.revision,context:null,parameters:{},timeoutMs:60000,stream:true},
    onText:text=>{if(!closed)options.onText?.({conversationId:input.id,generationId,text});}});
  }finally{active=undefined;}
 }
 function cancel():DesktopConversationReply{
  if(!active||!host?.conversations?.generation)return {status:'unavailable',reason:'no_active_generation'};
  const r=host.conversations.service.read(a.bind(chat('read',active.id))!,active.id);
  if(r.status!=='ok')return r;
  return host.conversations.generation.cancel(active.cancel,active.id,active.generationId,randomUUID(),r.conversation.revision);
 }
 return Object.freeze({attach(value:FoundationHost){if(host)throw Error('already_attached');host=value;a.attach(value);},cancel,
  async request(raw:unknown):Promise<DesktopConversationReply>{
   const input=capture(raw);if(!input)return {status:'rejected',reason:'invalid_request'};
   if(closed||!host?.conversations)return {status:'unavailable',reason:'conversations_unavailable'};
   try{return await a.run(()=>perform(input))??{status:'unavailable',reason:'operation_in_progress'};}catch{return {status:'unavailable',reason:'conversation_operation_unavailable'};}
  },close(){cancel();closed=true;}
 });
}
