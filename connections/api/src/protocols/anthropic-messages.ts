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

export function anthropicRoute(connection:{endpoint:string;endpointMode:'base'|'request'}):URL{
 const url=new URL(connection.endpoint);
 if(connection.endpointMode==='base')url.pathname=url.pathname.replace(/\/$/,'')+'/messages';
 return url;
}
export function anthropicHeaders(stream:boolean,token?:string):Record<string,string>{
 return {'content-type':'application/json',accept:stream?'text/event-stream':'application/json',
  'anthropic-version':'2023-06-01',...(token?{'x-api-key':token}:{})};
}

export async function decodeAnthropicMessages(source:AsyncIterable<Uint8Array>,stream:boolean,options:ChatStreamOptions={}):Promise<ChatStreamResult>{
 const maxBytes=options.maxBytes??8*1024*1024,maxText=options.maxTextBytes??4*1024*1024;
 if(!Number.isSafeInteger(maxBytes)||maxBytes<=0||!Number.isSafeInteger(maxText)||maxText<=0)throw Error('invalid_stream_limit');
 const decoder=new TextDecoder('utf-8',{fatal:true});let input='',size=0;
 for await(const chunk of source){
  if(options.signal?.aborted)throw Error('stream_cancelled');
  if(!(chunk instanceof Uint8Array))throw Error('invalid_stream_bytes');
  size+=chunk.byteLength;if(size>maxBytes)throw Error('stream_byte_limit');
  input+=decoder.decode(chunk,{stream:true});
 }
 input+=decoder.decode();
 if(options.signal?.aborted)throw Error('stream_cancelled');
 if(!stream){
  const message=record(parseUniqueJson(input));
  if(message.type!=='message'||message.role!=='assistant'||!Array.isArray(message.content))throw Error('invalid_anthropic_response');
  terminal(message.stop_reason);
  let output='';
  for(const block of message.content){
   const b=record(block);
   if(b.type!=='text')throw Error('unsupported_anthropic_content');
   output+=text(b.text);
   if(Buffer.byteLength(output,'utf8')>maxText)throw Error('stream_text_limit');
  }
  return {text:output,usage:usage(message.usage),
   ...(typeof message.id==='string'?{providerResponseId:message.id}:{}),
   ...(typeof message.model==='string'?{providerModelId:message.model}:{})};
 }
 let started=false,finished=false,terminalReason:unknown,output='',tokensIn:unknown,tokensOut:unknown;
 let providerResponseId:string|undefined,providerModelId:string|undefined,openBlock=false;
 const feed=(name:string,raw:string)=>{
  const event=record(parseUniqueJson(raw));
  if(event.type!==name)throw Error('invalid_anthropic_stream_event');
  if(name==='ping')return;
  if(name==='message_start'){
   if(started)throw Error('duplicate_anthropic_message_start');
   const m=record(event.message);if(m.role!=='assistant'||m.type!=='message')throw Error('invalid_anthropic_response');
   started=true;providerResponseId=typeof m.id==='string'?m.id:undefined;
   providerModelId=typeof m.model==='string'?m.model:undefined;
   const u=record(m.usage);tokensIn=u;tokensOut=u.output_tokens;
   return;
  }
  if(!started||finished)throw Error('invalid_anthropic_stream_order');
  if(name==='content_block_start'){
   if(openBlock||event.index!==0||record(event.content_block).type!=='text')throw Error('unsupported_anthropic_content');
   openBlock=true;const initial=record(event.content_block).text;
   if(typeof initial==='string'&&initial){output+=initial;options.onText?.(initial);}
  }else if(name==='content_block_delta'){
   if(!openBlock||event.index!==0)throw Error('invalid_anthropic_stream_order');
   const delta=record(event.delta);if(delta.type!=='text_delta')throw Error('unsupported_anthropic_content');
   const part=text(delta.text);output+=part;if(Buffer.byteLength(output,'utf8')>maxText)throw Error('stream_text_limit');
   options.onText?.(part);
  }else if(name==='content_block_stop'){
   if(!openBlock||event.index!==0)throw Error('invalid_anthropic_stream_order');
   openBlock=false;
  }else if(name==='message_delta'){
   if(openBlock)throw Error('invalid_anthropic_stream_order');
   terminalReason=record(event.delta).stop_reason;
   if(event.usage!==undefined)tokensOut=record(event.usage).output_tokens;
  }else if(name==='message_stop'){
   if(openBlock||terminalReason===undefined)throw Error('incomplete_anthropic_stream');
   terminal(terminalReason);finished=true;
  }else throw Error('unsupported_anthropic_event');
 };
 let eventName='',data:string[]=[];
 for(const line of input.split(/\r?\n/)){
  if(!line){
   if(data.length){feed(eventName,data.join('\n'));eventName='';data=[];}
  }else if(line.startsWith('event:'))eventName=line.slice(6).trim();
  else if(line.startsWith('data:'))data.push(line.slice(5).trimStart());
  else if(line.startsWith(':'))continue;
 }
 if(data.length||!finished)throw Error('incomplete_anthropic_stream');
 const u=record(tokensIn),all=usage({...u,output_tokens:tokensOut});
 return {text:output,usage:all,...(providerResponseId?{providerResponseId}:{}),...(providerModelId?{providerModelId}:{})};
}
