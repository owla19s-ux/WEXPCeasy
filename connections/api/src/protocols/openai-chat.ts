import type {ApiConnection,ApiModel,ToolDefinition} from '../model.js';
import type {ChatStreamOptions,ChatStreamResult} from '../stream.js';
import {decodeChatStream} from '../stream.js';
import {decodeChatResponse} from '../response.js';

/** OpenAI Chat Completions wire conventions; not a generic Provider protocol. */
export const toolProbeDeclaration:ToolDefinition={
 name:'wex_probe',
 parameters:{type:'object',properties:{ok:{type:'boolean',enum:[true]}},required:['ok'],additionalProperties:false}
};

export function chatRoute(connection:Pick<ApiConnection,'endpoint'|'endpointMode'>,route:'models'|'completions'):URL {
 const url=new URL(connection.endpoint);
 if(connection.endpointMode==='base')url.pathname=url.pathname.replace(/\/$/,'')+(route==='models'?'/models':'/chat/completions');
 return url;
}

export function chatProbeBody(model:Pick<ApiModel,'modelId'>,probe:{stream:boolean;tools:boolean}){
 return {model:model.modelId,messages:[{role:'user',content:probe.tools?'Propose wex_probe with ok set to true.':'Reply with OK.'}],
  stream:probe.stream,max_tokens:probe.tools?64:8,
  ...(probe.tools?{tools:[{type:'function',function:toolProbeDeclaration}],
   tool_choice:{type:'function',function:{name:toolProbeDeclaration.name}}}:{})};
}

export function chatHeaders(stream:boolean,token?:string,hasBody=true):Record<string,string>{
 return {accept:stream?'text/event-stream':'application/json',...(hasBody?{'content-type':'application/json'}:{}),
  ...(token?{authorization:'Bearer '+token}:{})};
}

export function chatContentType(stream:boolean):RegExp {
 return stream?/^text\/event-stream(?:\s*;|$)/i:/^application\/json(?:\s*;|$)/i;
}

/** Decoding is protocol-specific; network access and authorization remain with Transport. */
export function decodeOpenAiChat(source:AsyncIterable<Uint8Array>,stream:boolean,options:ChatStreamOptions):Promise<ChatStreamResult>{
 return stream?decodeChatStream(source,options):decodeChatResponse(source,options);
}
