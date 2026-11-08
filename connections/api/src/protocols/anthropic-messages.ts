import type {ChatStreamOptions,ChatStreamResult} from '../stream.js';
import type {Json} from '../../../../shared/src/index.js';
import {parseUniqueJson} from '../json.js';

type RecordValue=Record<string,unknown>;
function record(value:unknown):RecordValue{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_anthropic_response');
 return value as RecordValue;
}
function text(value:unknown):string{
 if(typeof value!=='string')throw Error('invalid_anthropic_response');
 return value;
}
function count(value:unknown):number{
 if(!Number.isSafeInteger(value)||Number(value)<0)throw Error('invalid_anthropic_usage');
 return Number(value);
}
function usage(value:unknown):ChatStreamResult['usage']{
 if(value===null||value===undefined)return null;
 const u=record(value),inputTokens=count(u.input_tokens),outputTokens=count(u.output_tokens);
 const cacheRead=u.cache_read_input_tokens===undefined?0:count(u.cache_read_input_tokens);
 const cacheCreate=u.cache_creation_input_tokens===undefined?0:count(u.cache_creation_input_tokens);
 return {inputTokens:inputTokens+cacheRead+cacheCreate,outputTokens,totalTokens:inputTokens+cacheRead+cacheCreate+outputTokens,
  ...(cacheRead?{cachedInputTokens:cacheRead}:{})};
}
function terminal(reason:unknown){
 if(reason==='end_turn'||reason==='stop_sequence')return;
 if(reason==='max_tokens')throw Error('provider_length_truncated');
 if(reason==='refusal')throw Error('provider_refusal');
 throw Error('unsupported_anthropic_stop_reason');
}

/** Native Messages input, not a Chat Completions-shaped payload. */
export function encodeAnthropicMessages(body:Record<string,unknown>):Json{
 const keys=Object.keys(body);
 if(keys.some(k=>!['model','messages','stream','max_tokens','temperature','top_p','stop_sequences'].includes(k)))
  throw Error('unsupported_anthropic_parameter');
 if(typeof body.model!=='string'||!body.model||typeof body.stream!=='boolean'||!Array.isArray(body.messages))
  throw Error('invalid_anthropic_request');
 if(!Number.isSafeInteger(body.max_tokens)||Number(body.max_tokens)<=0)throw Error('anthropic_max_tokens_required');
 if(body.messages.length===0)throw Error('invalid_anthropic_request');
 const messages:{role:'user'|'assistant';content:string}[]=[],system:string[]=[];
 let previousSystem=true;
 for(const raw of body.messages){
  const m=record(raw),role=m.role,content=text(m.content);
  if(role==='system'){
   if(!previousSystem)throw Error('unsupported_anthropic_system_position');
   system.push(content);
  }else if(role==='user'||role==='assistant'){
   previousSystem=false;
   messages.push({role,content});
  }else throw Error('unsupported_anthropic_role');
 }
 if(!messages.length)throw Error('invalid_anthropic_request');
 const result:Record<string,Json>={model:body.model,stream:body.stream,max_tokens:Number(body.max_tokens),messages};
 if(system.length)result.system=system.join('\n\n');
 for(const k of ['temperature','top_p','stop_sequences']){
  if(body[k]!==undefined)result[k]=body[k] as Json;
 }
 return result;
}

export function anthropicRoute(connection:{endpoint:string;endpointMode:'base'|'request'},kind:'models'|'completions'='completions'):URL{
 const url=new URL(connection.endpoint);
 if(connection.endpointMode==='base')url.pathname=url.pathname.replace(/\/$/,'')+(kind==='models'?'/models':'/messages');
 return url;
}
export function anthropicHeaders(stream:boolean,token?:string):Record<string,string>{
 return {'content-type':'application/json',accept:stream?'text/event-stream':'application/json',
  'anthropic-version':'2023-06-01',...(token?{'x-api-key':token}:{})};
}

/** Decode native Messages JSON or incremental named SSE events. No tool/thinking claims until implemented. */
export async function decodeAnthropicMessages(source:AsyncIterable<Uint8Array>,stream:boolean,options:ChatStreamOptions={}):Promise<ChatStreamResult>{
 const maxBytes=options.maxBytes??8*1024*1024,maxText=options.maxTextBytes??4*1024*1024;
 const maxFrame=options.maxFrameBytes??256*1024,maxFrames=options.maxFrames??100000;
 if([maxBytes,maxText,maxFrame,maxFrames].some(n=>!Number.isSafeInteger(n)||n<=0))throw Error('invalid_stream_limit');
 const decoder=new TextDecoder('utf-8',{fatal:true});
 let size=0,output='',providerResponseId:string|undefined,providerModelId:string|undefined;
 const check=()=>{if(options.signal?.aborted)throw Error('stream_cancelled');};
 const append=(part:string)=>{
  output+=part;if(Buffer.byteLength(output,'utf8')>maxText)throw Error('stream_text_limit');
  check();if(stream&&part)options.onText?.(part);check();
 };
 if(!stream){
  let data='';
  for await(const chunk of source){
   check();if(!(chunk instanceof Uint8Array))throw Error('invalid_stream_bytes');
   size+=chunk.byteLength;if(size>maxBytes)throw Error('stream_byte_limit');
   data+=decoder.decode(chunk,{stream:true});
  }
  data+=decoder.decode();check();
  const message=record(parseUniqueJson(data));
  if(message.type!=='message'||message.role!=='assistant'||!Array.isArray(message.content))throw Error('invalid_anthropic_response');
  terminal(message.stop_reason);
  for(const block of message.content){
   const b=record(block);if(b.type!=='text')throw Error('unsupported_anthropic_content');
   append(text(b.text));
  }
  return {text:output,usage:usage(message.usage),
   ...(typeof message.id==='string'?{providerResponseId:message.id}:{}),
   ...(typeof message.model==='string'?{providerModelId:message.model}:{})};
 }
 let started=false,finished=false,openBlock=false,blockIndex=0,nextIndex=0;
 let terminalReason:unknown,inputUsage:unknown,outputTokens:unknown;
 let fragment='',eventName='',dataParts:string[]=[],frameBytes=0,frames=0;
 const feed=(name:string,raw:string)=>{
  if(++frames>maxFrames)throw Error('stream_frame_limit');
  const event=record(parseUniqueJson(raw));
  if(event.type!==name)throw Error('invalid_anthropic_stream_event');
  if(name==='ping')return;
  if(name==='message_start'){
   if(started||finished)throw Error('duplicate_anthropic_message_start');
   const m=record(event.message);
   if(m.role!=='assistant'||m.type!=='message'||!Array.isArray(m.content)||m.content.length!==0)throw Error('invalid_anthropic_response');
   started=true;providerResponseId=typeof m.id==='string'?m.id:undefined;
   providerModelId=typeof m.model==='string'?m.model:undefined;
   inputUsage=m.usage;outputTokens=record(m.usage).output_tokens;return;
  }
  if(!started||finished)throw Error('invalid_anthropic_stream_order');
  if(name==='content_block_start'){
   const block=record(event.content_block);
   if(openBlock||event.index!==nextIndex||block.type!=='text')throw Error('unsupported_anthropic_content');
   openBlock=true;blockIndex=nextIndex;nextIndex++;
   if(block.text!==undefined)append(text(block.text));
  }else if(name==='content_block_delta'){
   if(!openBlock||event.index!==blockIndex)throw Error('invalid_anthropic_stream_order');
   const delta=record(event.delta);
   if(delta.type!=='text_delta')throw Error('unsupported_anthropic_content');
   append(text(delta.text));
  }else if(name==='content_block_stop'){
   if(!openBlock||event.index!==blockIndex)throw Error('invalid_anthropic_stream_order');
   openBlock=false;
  }else if(name==='message_delta'){
   if(openBlock)throw Error('invalid_anthropic_stream_order');
   terminalReason=record(event.delta).stop_reason;
   if(event.usage!==undefined)outputTokens=record(event.usage).output_tokens;
  }else if(name==='message_stop'){
   if(openBlock||terminalReason===undefined)throw Error('incomplete_anthropic_stream');
   terminal(terminalReason);finished=true;
  }else throw Error('unsupported_anthropic_event');
 };
 const finishEvent=()=>{
  if(!dataParts.length){eventName='';frameBytes=0;return;}
  if(!eventName)throw Error('invalid_anthropic_stream_event');
  feed(eventName,dataParts.join('\n'));dataParts=[];eventName='';frameBytes=0;
 };
 const line=(value:string)=>{
  if(value.endsWith('\r'))value=value.slice(0,-1);
  if(value===''){finishEvent();return;}
  if(value.startsWith(':'))return;
  if(value.startsWith('event:'))eventName=value.slice(6).trim();
  else if(value.startsWith('data:'))dataParts.push(value.slice(5).trimStart());
 };
 for await(const chunk of source){
  check();if(!(chunk instanceof Uint8Array))throw Error('invalid_stream_bytes');
  size+=chunk.byteLength;if(size>maxBytes)throw Error('stream_byte_limit');
  fragment+=decoder.decode(chunk,{stream:true});
  let split:number;
  while((split=fragment.indexOf('\n'))!==-1){
   const value=fragment.slice(0,split);fragment=fragment.slice(split+1);
   frameBytes+=Buffer.byteLength(value,'utf8')+1;if(frameBytes>maxFrame)throw Error('stream_frame_limit');
   line(value);check();
  }
  if(Buffer.byteLength(fragment,'utf8')+frameBytes>maxFrame)throw Error('stream_frame_limit');
 }
 fragment+=decoder.decode();check();
 if(fragment.trim())throw Error('incomplete_anthropic_stream');
 if(dataParts.length||!finished)throw Error('incomplete_anthropic_stream');
 const u=record(inputUsage),all=usage({...u,output_tokens:outputTokens});
 return {text:output,usage:all,...(providerResponseId?{providerResponseId}:{}),...(providerModelId?{providerModelId}:{})};
}

export function anthropicResponseIdentity(result:ChatStreamResult){
 return {...(result.providerResponseId===undefined?{}:{providerResponseId:result.providerResponseId}),
  ...(result.providerModelId===undefined?{}:{providerModelId:result.providerModelId})};
}


/** A single complete native Models page; pagination is not silently truncated. */
export function decodeAnthropicDirectory(body:string):string[]{
 let data:RecordValue;
 try{data=record(parseUniqueJson(body));}catch{throw Error('invalid_model_directory');}
 if(!Array.isArray(data.data)||data.data.length>4096)throw Error('invalid_model_directory');
 if(data.has_more===true)throw Error('model_directory_incomplete');
 const ids=new Set<string>();
 for(const raw of data.data){
  const item=record(raw),id=item.id;
  if(typeof id!=='string'||!id.trim()||ids.has(id))throw Error('invalid_model_directory');
  ids.add(id);
 }
 return [...ids];
}

/** Minimal fixed-cost text probe. Tools are a separate capability, not inferred from success. */
export function anthropicProbeBody(model:{modelId:string},probe:{stream:boolean;tools:boolean}):Json{
 if(probe.tools)throw Error('unsupported_anthropic_tool_probe');
 return {model:model.modelId,max_tokens:8,stream:probe.stream,
  messages:[{role:'user',content:'Reply with OK.'}]};
}
