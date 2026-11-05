import {captureTools,createToolAccumulator} from './tools.js';
import type {ToolDefinition,ToolProposal} from './model.js';
/** OpenAI Chat SSE decoder with explicitly declared tool proposals. Transport/authorization remain host responsibilities. */
export interface ChatStreamOptions {onText?:(delta:string)=>void;tools?:readonly ToolDefinition[];signal?:AbortSignal;maxBytes?:number;maxFrameBytes?:number;maxFrames?:number;maxTextBytes?:number}
export interface ChatStreamResult {toolCalls?:ToolProposal[];text:string;usage:null|{inputTokens:number;outputTokens:number;totalTokens:number}}
export async function decodeChatStream(source:AsyncIterable<Uint8Array>,options:ChatStreamOptions={}):Promise<ChatStreamResult>{
 const declarations=captureTools(options.tools),accumulator=createToolAccumulator(declarations);let toolCalls:ToolProposal[]=[];
 const limit=(v:number|undefined,fallback:number)=>{const n=v??fallback;if(!Number.isSafeInteger(n)||n<=0)throw Error('invalid_stream_limit');return n;};
 const maxBytes=limit(options.maxBytes,8*1024*1024),maxFrame=limit(options.maxFrameBytes,256*1024),maxFrames=limit(options.maxFrames,100000),maxText=limit(options.maxTextBytes,4*1024*1024);
 const decoder=new TextDecoder('utf-8',{fatal:true}),encoder=new TextEncoder();
 let line='',data:string[]=[],frameBytes=0,bytes=0,frames=0,textBytes=0,text='',finished=false,done=false,roleSeen=false,usage:ChatStreamResult['usage']=null;
 const check=()=>{if(options.signal?.aborted)throw Error('stream_cancelled');};
 const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_stream_object');return value as Record<string,unknown>;};
 const consume=()=>{
  if(++frames>maxFrames)throw Error('stream_frame_limit');
  if(!data.length)return;
  const payload=data.join('\n');data=[];
  if(done)throw Error('stream_after_done');
  if(payload==='[DONE]'){if(!finished)throw Error('stream_missing_finish');done=true;return;}
  let chunk:Record<string,unknown>;try{chunk=record(JSON.parse(payload));}catch{throw Error('invalid_stream_json');}
  if(chunk.error!==undefined)throw Error('provider_stream_error');
  if(!Array.isArray(chunk.choices)||chunk.choices.length>1)throw Error('unsupported_stream_choices');
  if(chunk.usage!==undefined&&chunk.usage!==null){
   if((!finished&&!(chunk.choices.length===1&&['stop','tool_calls'].includes(String(record(chunk.choices[0]).finish_reason))))||usage!==null)throw Error('unexpected_stream_usage');
   const u=record(chunk.usage),a=u.prompt_tokens,b=u.completion_tokens,c=u.total_tokens;
   if(![a,b,c].every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0))throw Error('invalid_stream_usage');
   usage={inputTokens:a as number,outputTokens:b as number,totalTokens:c as number};
  }
  if(chunk.choices.length===0){if(!finished||chunk.usage===undefined||chunk.usage===null)throw Error('empty_stream_choices');return;}
  if(finished)throw Error('stream_after_finish');
  const choice=record(chunk.choices[0]);if(choice.index!==0)throw Error('unsupported_stream_choice');
  const delta=record(choice.delta);
  for(const key of Object.keys(delta))if(!['role','content',...(declarations.length?['tool_calls']:[])].includes(key))throw Error('unsupported_stream_delta');
  if(delta.tool_calls!==undefined)accumulator.push(delta.tool_calls);
  if(delta.role!==undefined){if(delta.role!=='assistant'||roleSeen||textBytes>0)throw Error('invalid_stream_role');roleSeen=true;}
  if(delta.content!==undefined&&delta.content!==null){if(typeof delta.content!=='string')throw Error('invalid_stream_content');textBytes+=encoder.encode(delta.content).length;if(textBytes>maxText)throw Error('stream_text_limit');text+=delta.content;}
  if(choice.finish_reason!==null&&choice.finish_reason!==undefined){toolCalls=accumulator.finish(choice.finish_reason);finished=true;}
 };
 const endLine=()=>{if(line===''){consume();frameBytes=0;}else if(!line.startsWith(':')){const split=line.indexOf(':'),field=split<0?line:line.slice(0,split);let value=split<0?'':line.slice(split+1);if(value.startsWith(' '))value=value.slice(1);if(field==='data')data.push(value);}line='';};
 let pendingCR=false;
 const feed=(value:string)=>{for(const char of value){if(pendingCR){pendingCR=false;if(char==='\n')continue;}frameBytes+=encoder.encode(char).length;if(frameBytes>maxFrame)throw Error('stream_frame_limit');if(char==='\r'){endLine();pendingCR=true;}else if(char==='\n')endLine();else line+=char;}};
 let emitted=0;
 const publish=()=>{
  check();
  if(options.onText&&emitted<text.length){
   options.onText(text.slice(emitted));
   emitted=text.length;
   check();
  }
 };
 check();
 try{for await(const chunk of source){check();if(!(chunk instanceof Uint8Array))throw Error('invalid_stream_bytes');bytes+=chunk.byteLength;if(bytes>maxBytes)throw Error('stream_byte_limit');feed(decoder.decode(chunk,{stream:true}));publish();}feed(decoder.decode());publish();}catch(error){if(error instanceof TypeError)throw Error('invalid_stream_encoding');throw error;}
 check();if(line.length||data.length||!done||!finished)throw Error('incomplete_stream');return {text,usage,...(toolCalls.length?{toolCalls}:{} )};
}
