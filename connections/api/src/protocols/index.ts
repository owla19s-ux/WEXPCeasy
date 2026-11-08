import type {ApiConnection,ApiModel,ToolDefinition} from '../model.js';
import type {ChatStreamOptions,ChatStreamResult} from '../stream.js';
import {anthropicRoute,anthropicHeaders,encodeAnthropicMessages,decodeAnthropicMessages} from './anthropic-messages.js';
import {
 chatRoute,chatProbeBody,chatHeaders,chatContentType,decodeOpenAiChat,
 toolProbeDeclaration,chatResponseIdentity,decodeChatModelDirectory
} from './openai-chat.js';

/**
 * Supported wire-protocol dispatch. This is the smallest operational adapter
 * contract for the currently implemented Chat-compatible transport.
 * Do not treat Chat-only methods as a frozen universal native-provider API:
 * broaden normalized request/events only alongside tested additional protocols.
 */
export interface ApiProtocolAdapter {
 readonly id:string;
 readonly supportsDirectory:boolean;
 readonly supportsProbe:boolean;
 readonly encodeBody:(body:Record<string,unknown>)=>unknown;
 readonly route:(connection:Pick<ApiConnection,'endpoint'|'endpointMode'>,kind:'models'|'completions')=>URL;
 readonly probeBody:(model:Pick<ApiModel,'modelId'>,probe:{stream:boolean;tools:boolean})=>unknown;
 readonly headers:(stream:boolean,token?:string,hasBody?:boolean)=>Record<string,string>;
 readonly contentType:(stream:boolean)=>RegExp;
 readonly decode:(source:AsyncIterable<Uint8Array>,stream:boolean,options:ChatStreamOptions)=>Promise<ChatStreamResult>;
 readonly directory:(body:string)=>string[];
 readonly responseIdentity:(result:ChatStreamResult)=>{providerResponseId?:string;providerModelId?:string};
 readonly probeTool:ToolDefinition;
 readonly generationVersion:string;
 readonly diagnosticVersion:(probe?:{stream:boolean;tools:boolean})=>string;
}

const openaiChat:ApiProtocolAdapter=Object.freeze({
 id:'openai-chat',supportsDirectory:true,supportsProbe:true,encodeBody:body=>body,
 route:chatRoute,probeBody:chatProbeBody,headers:chatHeaders,contentType:chatContentType,
 decode:decodeOpenAiChat,directory:decodeChatModelDirectory,responseIdentity:chatResponseIdentity,
 probeTool:toolProbeDeclaration,
 generationVersion:'openai-chat-text-1',
 diagnosticVersion:(probe?:{stream:boolean;tools:boolean})=>
  probe?(probe.tools?(probe.stream?'openai-chat-stream-tool-probe-1':'openai-chat-tool-probe-1')
   :probe.stream?'openai-chat-stream-probe-1':'openai-chat-probe-1'):'openai-chat-models-1'
});

const anthropicMessages:ApiProtocolAdapter=Object.freeze({
 id:'anthropic-messages',supportsDirectory:false,supportsProbe:false,
 encodeBody:encodeAnthropicMessages,
 route:(connection,kind)=>{
  if(kind!=='completions')throw Error('unsupported_anthropic_directory');
  return anthropicRoute(connection);
 },
 probeBody:()=>{throw Error('unsupported_anthropic_probe');},
 headers:(stream,token)=>anthropicHeaders(stream,token),
 contentType:stream=>stream?/^text\/event-stream(?:\s*;|$)/i:/^application\/json(?:\s*;|$)/i,
 decode:decodeAnthropicMessages,
 directory:()=>{throw Error('unsupported_anthropic_directory');},
 responseIdentity:chatResponseIdentity,
 probeTool:toolProbeDeclaration,
 generationVersion:'anthropic-messages-text-1',
 diagnosticVersion:()=>{throw Error('unsupported_anthropic_diagnostic');}
});

const adapters:ReadonlyMap<string,ApiProtocolAdapter>=new Map([
 [openaiChat.id,openaiChat],[anthropicMessages.id,anthropicMessages]
]);

/** Unknown protocols must fail closed; the Provider display name never selects wire behavior. */
export function resolveApiProtocol(id:string):ApiProtocolAdapter|undefined{
 return adapters.get(id);
}
export function supportedApiProtocols():readonly string[]{
 return Object.freeze([...adapters.keys()]);
}
