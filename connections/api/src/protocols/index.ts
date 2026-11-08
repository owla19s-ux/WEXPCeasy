import type {ApiConnection,ApiModel,ToolDefinition} from '../model.js';
import type {ChatStreamOptions,ChatStreamResult} from '../stream.js';
import {anthropicRoute,anthropicHeaders,encodeAnthropicMessages,decodeAnthropicMessages,anthropicResponseIdentity,decodeAnthropicDirectory,anthropicProbeBody} from './anthropic-messages.js';
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
 readonly supportsToolProbe:boolean;
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
 id:'openai-chat',supportsDirectory:true,supportsProbe:true,supportsToolProbe:true,encodeBody:(body:Record<string,unknown>)=>body,
 route:chatRoute,probeBody:chatProbeBody,headers:chatHeaders,contentType:chatContentType,
 decode:decodeOpenAiChat,directory:decodeChatModelDirectory,responseIdentity:chatResponseIdentity,
 probeTool:toolProbeDeclaration,
 generationVersion:'openai-chat-text-1',
 diagnosticVersion:(probe?:{stream:boolean;tools:boolean})=>
  probe?(probe.tools?(probe.stream?'openai-chat-stream-tool-probe-1':'openai-chat-tool-probe-1')
   :probe.stream?'openai-chat-stream-probe-1':'openai-chat-probe-1'):'openai-chat-models-1'
});

const anthropicMessages:ApiProtocolAdapter=Object.freeze({
 id:'anthropic-messages',supportsDirectory:true,supportsProbe:true,supportsToolProbe:false,
 encodeBody:encodeAnthropicMessages,
 route:(connection:Pick<ApiConnection,'endpoint'|'endpointMode'>,kind:'models'|'completions')=>anthropicRoute(connection,kind),
 probeBody:anthropicProbeBody,
 headers:(stream:boolean,token?:string)=>anthropicHeaders(stream,token),
 contentType:(stream:boolean)=>stream?/^text\/event-stream(?:\s*;|$)/i:/^application\/json(?:\s*;|$)/i,
 decode:decodeAnthropicMessages,
 directory:decodeAnthropicDirectory,
 responseIdentity:anthropicResponseIdentity,
 probeTool:toolProbeDeclaration,
 generationVersion:'anthropic-messages-text-1',
 diagnosticVersion:(probe?:{stream:boolean;tools:boolean})=>
  probe?(probe.tools?(()=>{throw Error('unsupported_anthropic_tool_probe');})():probe.stream?'anthropic-messages-stream-probe-1':'anthropic-messages-probe-1'):'anthropic-messages-models-1'
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
