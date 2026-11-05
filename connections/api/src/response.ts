import {checkFinishReason,checkRefusal} from './terminal.js';
import {decodeUsage} from './usage.js';
import {closed} from './model.js';
import {captureTools,createToolAccumulator} from './tools.js';
import type {ToolDefinition} from './model.js';
import type {ChatStreamResult} from './stream.js';
export interface ChatResponseOptions {allowReasoning?:boolean;tools?:readonly ToolDefinition[];signal?:AbortSignal;maxBytes?:number;maxTextBytes?:number}
/** Bounded Chat JSON response with explicitly declared tool proposals. Never returns raw provider errors or partial content. */
export async function decodeChatResponse(source:AsyncIterable<Uint8Array>,options:ChatResponseOptions={}):Promise<ChatStreamResult>{
 const declarations=captureTools(options.tools),accumulator=createToolAccumulator(declarations);
 const limit=(value:number|undefined,fallback:number)=>{const n=value??fallback;if(!Number.isSafeInteger(n)||n<=0)throw Error('invalid_response_limit');return n;};
 const maxBytes=limit(options.maxBytes,8*1024*1024),maxText=limit(options.maxTextBytes,4*1024*1024),decoder=new TextDecoder('utf-8',{fatal:true});
 let bytes=0,body='';const check=()=>{if(options.signal?.aborted)throw Error('response_cancelled');};
 check();
 try{for await(const chunk of source){check();if(!(chunk instanceof Uint8Array))throw Error('invalid_response_bytes');bytes+=chunk.byteLength;if(bytes>maxBytes)throw Error('response_byte_limit');body+=decoder.decode(chunk,{stream:true});}body+=decoder.decode();}catch(error){if(error instanceof TypeError)throw Error('invalid_response_encoding');throw error;}
 check();
 const record=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('invalid_response_object');return v as Record<string,unknown>;};
 let response:Record<string,unknown>;try{response=record(JSON.parse(body));}catch{throw Error('invalid_response_json');}
 if(response.error!==undefined)throw Error('provider_response_error');
 if(!Array.isArray(response.choices)||response.choices.length!==1)throw Error('unsupported_response_choices');
 const choice=record(response.choices[0]);if(choice.index!==0)throw Error('unsuccessful_response_finish');
 checkFinishReason(choice.finish_reason);
 const message=record(choice.message);
 if(Object.keys(message).some(key=>!['role','content','refusal',...(options.allowReasoning?['reasoning_content']:[]),...(declarations.length?['tool_calls']:[])].includes(key)))throw Error('unsupported_response_message');
 checkRefusal(message.refusal);
 if(message.tool_calls!==undefined){if(!Array.isArray(message.tool_calls))throw Error('invalid_tool_calls');accumulator.push(message.tool_calls.map((v:unknown,index:number)=>{if(!closed(v,['id','type','function']))throw Error('invalid_tool_calls');return {...v,index};}));}
 const toolCalls=accumulator.finish(choice.finish_reason);
 if(toolCalls.length&&(message.content===null||message.content===undefined))message.content='';
 if(message.role!=='assistant'||typeof message.content!=='string')throw Error('invalid_response_message');
 const reasoning=message.reasoning_content??'';
 if(typeof reasoning!=='string')throw Error('invalid_response_reasoning');
 if(Buffer.byteLength(message.content,'utf8')+Buffer.byteLength(reasoning,'utf8')>maxText)throw Error('response_text_limit');
 let usage:ChatStreamResult['usage']=null;
 if(response.usage!==undefined&&response.usage!==null)usage=decodeUsage(response.usage);
 return {text:message.content,usage,...(reasoning?{reasoning}:{}),...(toolCalls.length?{toolCalls}:{} )};
}
