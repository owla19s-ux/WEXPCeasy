export {createApiService} from './service.js';
export type {ApiService,ApiOptions,ApiDeletionGuard} from './service.js';
export type {ApiConnection,ApiModel,ApiCommand,ApiMutation,ApiQuery,ApiQueryResult,CredentialReference,Parameters,ParameterSetting,ParameterSpec,Capability,CapabilityState,ModelObservation,ModelObserver,Preparation,RequestSnapshot} from './model.js';
export {decodeChatStream} from './stream.js';
export type {ChatStreamOptions,ChatStreamResult} from './stream.js';
export {createApiTransport} from './transport.js';
export type {ApiSendResult,ApiDirectoryResult,ApiProbeResult,ApiTransportOptions,ApiCredentialBinding,ApiCredentialPort} from './transport.js';
export {decodeChatResponse} from './response.js';
export type {ChatResponseOptions} from './response.js';
export type {ToolDefinition,ToolSchema,ToolProposal} from './model.js';
export type {ChatUsage} from './usage.js';
export type {ToolRound,ToolRoundReader} from './continuation.js';
export type {ChatWireMessage} from './model.js';

/** Explicitly supported API wire protocol IDs; does not imply full provider capabilities. */
export {supportedApiProtocols} from './protocols/index.js';
