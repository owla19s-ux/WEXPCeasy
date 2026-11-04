import type {ChatStreamResult} from './stream.js';
export interface ChatResponseOptions {signal?:AbortSignal;maxBytes?:number;maxTextBytes?:number}
/** Bounded text-only Chat JSON response. Never returns raw provider errors or partial content. */
export async function decodeChatResponse(source:AsyncIterable<Uint8Array>,options:ChatResponseOptions={}):Promise<ChatStreamResult>{
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
 const choice=record(response.choices[0]);if(choice.index!==0||choice.finish_reason!=='stop')throw Error('unsuccessful_response_finish');
 const message=record(choice.message);
 if(Object.keys(message).some(key=>!['role','content'].includes(key)))throw Error('unsupported_response_message');
 if(message.role!=='assistant'||typeof message.content!=='string')throw Error('invalid_response_message');
 if(Buffer.byteLength(message.content,'utf8')>maxText)throw Error('response_text_limit');
 let usage:ChatStreamResult['usage']=null;
 if(response.usage!==undefined&&response.usage!==null){const u=record(response.usage),a=u.prompt_tokens,b=u.completion_tokens,c=u.total_tokens;if(![a,b,c].every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0))throw Error('invalid_response_usage');usage={inputTokens:a as number,outputTokens:b as number,totalTokens:c as number};}
 return {text:message.content,usage};
}
