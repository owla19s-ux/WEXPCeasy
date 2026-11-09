import {randomUUID} from 'node:crypto';
import type {FoundationHost} from './foundations.js';
import type {DesktopAuthority} from './desktop-authority.js';
import type {LocalOperation} from './local-entries.js';
import type {ConversationChange,Conversation} from '../../conversations/src/index.js';
import type {ApiConnection,ApiModel} from '../../connections/api/src/index.js';
import type {DesktopConversationInput,DesktopConversationReply,ConversationText,ConversationFileReference,DesktopSpaceReply} from '../../UI/src/index.js';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(v);
function capture(raw:unknown):DesktopConversationInput|undefined{
 if(!object(raw)||typeof raw.kind!=='string')return;
 const fields:Record<string,string[]>={snapshot:['kind'],create:['kind'],open:['kind','id'],append:['kind','id','expectedRevision','text'],send:['kind','id','expectedRevision','text'],resend:['kind','id','expectedRevision','text','replaces'],select:['kind','id','expectedRevision','messageId','segmentIds'],recover:['kind','id','generationId']};
 const keys=Object.hasOwn(fields,raw.kind)?[...fields[raw.kind]!,...(Object.hasOwn(raw,'contextId')?['contextId']:[]),...(['send','resend'].includes(raw.kind)?[Object.hasOwn(raw,'agentId')?'agentId':'selection']:[]),...(['send','resend','append'].includes(raw.kind)&&Object.hasOwn(raw,'attachments')?['attachments']:[])]:undefined;
 if(!keys||Reflect.ownKeys(raw).length!==keys.length||!keys.every(k=>Object.hasOwn(raw,k)))return;
 for(const [k,v] of Object.entries(raw)){
  if(k==='kind')continue;
  if(k==='selection'){if(!object(v)||Reflect.ownKeys(v).some(k=>!['roleId','positionId','connectionId','modelId'].includes(String(k)))||!id(v.connectionId)||!id(v.modelId)||(!id(v.roleId)&&!id(v.positionId))||('roleId'in v&&!id(v.roleId))||('positionId'in v&&!id(v.positionId)))return;}
  else if(k==='attachments'){if(!Array.isArray(v)||v.length>8||v.some(source=>!object(source)||Object.keys(source).sort().join(',')!=='addressId,contextId,kind,mime,version'||source.kind!=='local-reference'||source.mime!=='text/plain'||!id(source.contextId)||!id(source.addressId)||typeof source.version!=='string'||!/^[a-f0-9]{64}$/.test(source.version)))return;}
  else if(k==='expectedRevision'){if(!Number.isSafeInteger(v)||Number(v)<1)return;}
  else if(k==='text'){if(typeof v!=='string'||!v.trim()||v.length>32000)return;}
  else if(k==='segmentIds'){if(!Array.isArray(v)||v.length>256||!v.every(id)||new Set(v).size!==v.length)return;}
  else if(!id(v))return;
 }
 return structuredClone(raw) as unknown as DesktopConversationInput;
}
export function createDesktopConversations(options:{authority:DesktopAuthority;confirm:(summary:string)=>Promise<boolean>;readContext?:(id:string)=>Promise<import('../../space/src/index.js').ContextView|undefined>;onText?:(event:ConversationText)=>void;readAttachment?:(source:ConversationFileReference)=>Promise<DesktopSpaceReply>}){
 const a=options.authority;
 let host:FoundationHost|undefined,closed=false,active:{id:string;generationId:string;cancel:object;revision:number;cancelledRevision?:number}|undefined;
 let contextId:string|null=null;
 const op=(resource:string,action:string,target:string,context:string|null=null):LocalOperation=>({resource,action,target,context});
 const chat=(action:string,id:string)=>op('conversations',action,'conversation:'+id,contextId);
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
 async function environment(id:string){
  if(options.readContext){const value=await options.readContext(id);if(!value)throw Error('context_unavailable');return value;}
  if(!host?.space)throw Error('context_unavailable');
  const r=await host.space.query(grant(op('space','context.read','context:'+id,id)),{kind:'context',id});
  if(r.status!=='ok'||!('associations'in r.value))throw Error('context_unavailable');return r.value;
 }
 async function perform(input:DesktopConversationInput):Promise<DesktopConversationReply>{
  contextId=input.contextId??null;
  if(!await a.confirm(options.confirm,(contextId?'Context '+contextId+'：':'普通对话：')+(input.kind==='snapshot'?'读取已保存的普通对话列表及当前获准的历史。':input.kind==='send'||input.kind==='resend'?'准备发送对话输入（'+input.text.length+' 字符）。随后会展示实际 Provider 与模型并再次确认网络发送。':'本次普通对话操作：'+input.kind+('id'in input?' / '+input.id:''))))return {status:'cancelled'};
  let context=contextId?await environment(contextId):undefined;
  if(context){
   for(const target of context.associations){
    const scope=target.owner==='AI'?op('AI',target.targetType+'.read',target.targetType+':'+target.targetId):target.owner==='conversations'?op('conversations','read','conversation:'+target.targetId):undefined;
    if(scope)grant(scope);
   }
   // Re-query after exact owner reads are admitted; never infer a valid target from a saved ID alone.
   context=await environment(context.id);
  }
  if(input.kind==='create'){
   const id=randomUUID(),r=change(id,0,{kind:'create'});
   if(r.status!=='committed')return r;
   if(context){
    grant(op('conversations','read','conversation:'+id));
    const linked=await host!.space!.execute(grant(op('space','association.add','context:'+context.id,context.id)),{kind:'association.add',contextId:context.id,owner:'conversations',targetType:'conversation',targetId:id,purpose:'conversation',intent:randomUUID()});
    if(linked.status==='unknown')return {status:'unknown',id,intent:linked.intent,reason:'conversation_created_association_unknown'};
    if(linked.status!=='committed')return {status:'unavailable',reason:'conversation_created_unlinked:'+id};
   }
   return {...r,id};
  }
  if(input.kind==='snapshot'&&context){
   const conversations:Conversation[]=[];
   for(const ref of context.associations.filter(r=>r.owner==='conversations'&&r.targetType==='conversation'))conversations.push(read(ref.targetId));
   return {status:'ok',conversations};
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
  if(context&&!context.associations.some(r=>r.owner==='conversations'&&r.targetType==='conversation'&&r.targetId===input.id))return {status:'reference_unavailable'};
  const current=read(input.id);
  if(input.kind==='open')return {status:'ok',conversation:current};
  if(input.kind==='recover'){
   const generation=current.generations.find(g=>g.id===input.generationId);
   if(!generation?.operationId)return {status:'invalid_transition'};
   return host!.conversations!.generation!.recover({read:grant(chat('read',input.id)),receipt:grant(op('conversations','receipt.read','operation:'+generation.operationId,contextId)),finish:grant(chat('finish',input.id))},input.id,input.generationId,randomUUID());
  }
  if(current.revision!==input.expectedRevision)return {status:'revision_conflict'};
  const segments='text'in input?[{id:'text',text:input.text},...('attachments'in input?input.attachments??[]:[]).map((source,index)=>({id:'file-'+index,text:'文件引用（正文未发送）',source}))]:[];
  if(input.kind==='append')return change(input.id,input.expectedRevision,{kind:'append',messageId:randomUUID(),segments});
  if(input.kind==='select')return change(input.id,input.expectedRevision,{kind:'select',messageId:input.messageId,segmentIds:input.segmentIds});
  if(!host?.api||!host.ai||!host.conversations?.generation)return {status:'unavailable',reason:'generation_unavailable'};
  const settings:ReturnType<typeof ai>[]=[],prompts:string[]=[];
  let selection=input.selection;
  if(input.agentId){const agent=ai('agent',input.agentId);if(agent.kind!=='agent')return {status:'reference_unavailable'};settings.push(agent);selection={roleId:agent.roleId,positionId:agent.positionId,...agent.model};}
  if(!selection)return {status:'reference_unavailable'};
  if(selection.roleId){const role=ai('role',selection.roleId);if(role.kind!=='role')return {status:'reference_unavailable'};settings.push(role);prompts.push(role.prompt);}
  if(selection.positionId){const position=ai('position',selection.positionId);if(position.kind!=='position')return {status:'reference_unavailable'};settings.push(position);prompts.push(position.responsibility);}
  const model=api('model',selection.modelId) as ApiModel,connection=api('connection',selection.connectionId) as ApiConnection;
  if(context){
   const refs=input.agentId?[['agent',input.agentId]]:[...(selection.roleId?[['role',selection.roleId]]:[]),...(selection.positionId?[['position',selection.positionId]]:[])];
   if(refs.some(([kind,id])=>!context!.associations.some(r=>r.owner==='AI'&&r.targetType===kind&&r.targetId===id)))return {status:'reference_unavailable'};
  }
  if(model.connectionId!==connection.id)return {status:'reference_unavailable'};
  if(prompts.join('\n\n').length>32000)return {status:'rejected',reason:'combined_prompt_too_large'};
  if(!await a.confirm(options.confirm,'向 Provider 发送真实对话请求：'+(contextId?'Context '+contextId+'\n':'普通对话\n')+connection.name+'\n'+connection.endpoint+'\n模型：'+model.name+' ('+model.modelId+')\n包括当前对话历史、角色/岗位设定和本次输入，可能产生费用。输入：\n'+input.text))return {status:'cancelled'};
  for(const entry of settings)if(ai(entry.kind,entry.id).revision!==entry.revision)return {status:'revision_conflict'};
  if(api('model',model.id).revision!==model.revision||api('connection',connection.id).revision!==connection.revision)return {status:'revision_conflict'};
  if(context){const latest=await environment(context.id);const signature=(v:typeof context)=>JSON.stringify({id:v!.id,revision:v!.revision,associations:v!.associations});if(signature(latest)!==signature(context))return {status:'revision_conflict'};}
  // Capture all exact permissions before dispatch. The running round keeps this configuration snapshot.
  grant(op('connections/api','request.prepare','model:'+model.id,contextId));
  const requests={read:grant(chat('read',input.id)),dispatch:grant(chat('dispatch',input.id)),api:grant(op('connections/api','request.send','model:'+model.id,contextId)),
   finish:grant(chat('finish',input.id)),fail:grant(chat('fail',input.id)),unknown:grant(chat('unknown',input.id))};
  const cancel=grant(chat('cancel',input.id));grant(chat('append',input.id));grant(chat(input.kind==='resend'?'resend':'begin',input.id));
  if(context){
   const proof=a.bind(op('space','context.read','context:'+context.id,context.id))!;
   const proofs=[proof,...settings.map(entry=>a.bind(op('AI',entry.kind+'.read',entry.kind+':'+entry.id))!)];
   const valid=()=>!closed&&proofs.every(r=>host!.permissions!.evaluate(r).status==='allow');
   for(const action of ['read','dispatch','finish','fail','unknown'])a.constrain(chat(action,input.id),valid);
   a.constrain(op('connections/api','request.send','model:'+model.id,contextId),valid);
  }
  const generationId=randomUUID(),messageId=randomUUID();
  let r;
  if(input.kind==='resend')r=change(input.id,current.revision,{kind:'resend',replaces:input.replaces!,messageId,generationId,segments});
  else{
   r=change(input.id,current.revision,{kind:'append',messageId,segments});
   if(r.status==='committed')r=change(input.id,r.revision,{kind:'begin',generationId,inputMessageId:messageId});
  }
  if(r.status!=='committed')return r;
  active={id:input.id,generationId,cancel,revision:r.revision+1};
  try{
   const result=await host.conversations.generation.send({conversationId:input.id,generationId,operationId:randomUUID(),replyId:randomUUID(),intent:randomUUID(),expectedRevision:r.revision,requests,systemPrompt:prompts.join('\n\n'),
    preparation:{requestId:randomUUID(),connectionId:connection.id,connectionRevision:connection.revision,modelId:model.id,modelRevision:model.revision,context:contextId,parameters:{},timeoutMs:60000,stream:true},
    onText:text=>{if(!closed)options.onText?.({conversationId:input.id,generationId,text,...(contextId?{contextId}:{})});}});
   return active?.cancelledRevision?{status:'committed',revision:active.cancelledRevision}:result;
  }finally{active=undefined;}
 }
 function cancel():DesktopConversationReply{
  if(!active||!host?.conversations?.generation)return {status:'unavailable',reason:'no_active_generation'};
  const result=host.conversations.generation.cancel(active.cancel,active.id,active.generationId,randomUUID(),active.revision);
  if(result.status==='committed')active.cancelledRevision=result.revision;
  return result;
 }
 return Object.freeze({attach(value:FoundationHost){if(host)throw Error('already_attached');host=value;a.attach(value);},cancel,
  async request(raw:unknown):Promise<DesktopConversationReply>{
   const input=capture(raw);if(!input)return {status:'rejected',reason:'invalid_request'};
   if(closed||!host?.conversations)return {status:'unavailable',reason:'conversations_unavailable'};
   try{
    if('attachments'in input&&input.attachments?.length){
     if(!options.readAttachment)return {status:'unavailable',reason:'attachment_reader_unavailable'};
     for(const source of input.attachments){const observed=await options.readAttachment(source);
      if(closed)return {status:'unavailable',reason:'session_closed'};
      if(observed.status==='cancelled')return {status:'cancelled'};
      if(observed.status!=='ok'||observed.view!=='file'||observed.contextId!==source.contextId||observed.addressId!==source.addressId||observed.version!==source.version)return {status:'rejected',reason:'attachment_changed_or_unavailable'};
     }
    }
    return await a.run(()=>perform(input))??{status:'unavailable',reason:'operation_in_progress'};}catch{return {status:'unavailable',reason:'conversation_operation_unavailable'};}
  },close(){cancel();closed=true;}
 });
}
