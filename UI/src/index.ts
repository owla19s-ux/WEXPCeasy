/** Serializable technical bridge only; business requests require separate reviewed contracts. */
export interface DesktopStatus {phase:'starting'|'ready'|'degraded'|'failed'|'stopping'|'release-pending';diagnostics:readonly {module:string;reason:string}[]}
export type HostReply<T>={ok:true;value:T}|{ok:false;error:string};
export interface DesktopBridge {onAccessChanged(listener:()=>void):()=>void;connections(input:DesktopConnectionsInput):Promise<HostReply<DesktopConnectionsReply>>;ai(input:DesktopAiInput):Promise<HostReply<DesktopAiReply>>;conversations(input:DesktopConversationInput):Promise<HostReply<DesktopConversationReply>>;cancelConversations():Promise<HostReply<DesktopConversationReply>>;onConversationText(listener:(event:ConversationText)=>void):()=>void;permissions(input:DesktopPermissionInput):Promise<HostReply<DesktopPermissionReply>>;api(input:DesktopApiInput):Promise<HostReply<DesktopApiReply>>;cancelApi():Promise<HostReply<{accepted:true}>>;space(input:DesktopSpaceInput):Promise<HostReply<DesktopSpaceReply>>;readStatus():Promise<HostReply<DesktopStatus>>;requestQuit():Promise<HostReply<{accepted:true}>>}

export interface SpaceName {id:string;revision:number;name:string}
export interface SpaceItem extends SpaceName {description:string;categoryId:string|null;directory?:string|null}
export interface GroupItem extends SpaceName {spaceId:string;order:number}
export type ContextItem=({status:'available';description:string}&SpaceName)|{status:'unavailable';id:string;reason:string};
export interface ContextOrganization {contextId:string;revision:number;spaceId:string|null;groupId:string|null}
export interface AddressItem extends SpaceName {address:string;notes:string;purpose:string|string[];status:'unverified';type?:string;source?:string}
export interface ToolItem {id:string;revision:number;owner:string;targetType:string;targetId:string;purpose:string;enabled:boolean;availability:'available'|'unavailable'|'conflict'|'unknown';sourceRevision:string;observedAt:string}
export type DesktopSpaceInput={kind:'resource.save';contextId:string;id:string;editToken:string;content:string}|{kind:'resource.read';contextId:string;id:string;mode:'file'|'directory'}|{kind:'category.create';name:string}|{kind:'category.edit';id:string;expectedRevision:number;name:string}|
 {kind:'address.add';contextId:string;name:string;address:string;notes?:string;purpose?:string|string[]}|{kind:'address.edit';contextId:string;id:string;expectedRevision:number;name:string;address:string;notes?:string;purpose?:string|string[]}|
 {kind:'address.remove';contextId:string;id:string;expectedRevision:number}|{kind:'primary.select';contextId:string;id:string|null;expectedRevision:number}|{kind:'snapshot'}|{kind:'context.open';id:string}|
 {kind:'space.create';name:string;description?:string;categoryId?:string|null}|{kind:'space.edit';id:string;expectedRevision:number;name:string;description?:string;categoryId?:string|null}|
 {kind:'space.directory';id:string;expectedRevision:number;clear?:boolean}|
 {kind:'group.create';spaceId:string;name:string}|{kind:'group.edit';id:string;expectedRevision:number;name:string}|
 {kind:'context.create';name:string;description?:string}|{kind:'context.edit';id:string;expectedRevision:number;name:string;description?:string}|
 {kind:'context.group';contextId:string;spaceId:string;groupId:string|null;expectedRevision:number};
export type DesktopSpaceReply=
 {status:'saved';version:string;operationId:string}|
 {status:'ok';view:'file';contextId:string;addressId:string;content:string;version:string;editToken?:string}|
 {status:'ok';view:'directory';contextId:string;addressId:string;entries:{name:string;kind:'file'|'directory'|'symlink'|'other'}[];complete:boolean;version:string}|
 {status:'ok';view:'snapshot';categories:SpaceName[];spaces:SpaceItem[];groups:GroupItem[];contexts:ContextItem[];organizations:ContextOrganization[];complete:boolean}|
 {status:'ok';view:'context';context:SpaceName&{description:string;primaryAddress:string|null};resources:AddressItem[];tools:ToolItem[];location:string;organization:ContextOrganization}|
 {status:'committed';id:string;revision:number}|
 {status:'cancelled'}|{status:'unknown';intent:string;id?:string}|
 {status:'unavailable'|'rejected'|'failed_no_commit';reason:string;operationId?:string};

export type ApiJson=null|string|number|boolean|ApiJson[]|{[key:string]:ApiJson};
export type ApiParameter={mode:'value';value:ApiJson}|{mode:'provider-default'|'disabled'};
export type ApiCommonParameters=Partial<Record<'temperature'|'top_p'|'max_tokens',{mode:'value';value:number}|{mode:'provider-default'|'disabled'}>>;
export interface ApiConnectionView {id:string;revision:number;name:string;provider:string;protocol:string;endpoint:string;endpointMode:'base'|'request';credentialRef:{id:string;revision:number}|null;enabled:boolean;parameters:Record<string,ApiParameter>}
export interface ApiModelView {id:string;revision:number;connectionId:string;name:string;modelId:string;parameters:Record<string,ApiParameter>;observation:null|{source:'provider'|'probe';sourceRevision:string;observedAt:string;capabilities:Record<'text'|'stream'|'tools'|'image'|'reasoning','supported'|'unsupported'|'unknown'|'unverified'>;parameters:Record<string,{type:string;minimum?:number;maximum?:number;enum?:ApiJson[]}>}}
export type DesktopApiInput={kind:'snapshot'}|{kind:'models';connectionId:string}|
 {kind:'connection.create';name:string;provider:string;protocol?:string;endpoint:string;endpointMode:'base'|'request';enabled:boolean;parameters?:ApiCommonParameters}|
 {kind:'connection.edit';id:string;expectedRevision:number;name?:string;provider?:string;protocol?:string;endpoint?:string;endpointMode?:'base'|'request';enabled?:boolean;parameters?:ApiCommonParameters}|
 {kind:'connection.delete';id:string;expectedRevision:number}|
 {kind:'connection.refresh';id:string;expectedRevision:number}|
 {kind:'model.create';connectionId:string;name:string;modelId:string;parameters?:ApiCommonParameters}|
 {kind:'model.edit';id:string;expectedRevision:number;name?:string;parameters?:ApiCommonParameters}|
 {kind:'model.delete';id:string;expectedRevision:number}|
 {kind:'model.probe';id:string;expectedRevision:number;stream?:boolean}|
 {kind:'credential.set'|'credential.revoke';connectionId:string;expectedRevision:number};
export type DesktopApiReply=
 {status:'ok';view:'connections';connections:ApiConnectionView[];credentialBackend:boolean}|
 {status:'ok';view:'models';models:ApiModelView[]}|
 {status:'ok';view:'directory';operationId:string;modelIds:string[];observedAt:string}|
 {status:'committed';id:string;revision:number;operationId?:string;notice?:string}|
 {status:'cancelled'}|{status:'unknown';intent:string;operationId?:string}|
 {status:'unavailable'|'rejected'|'failed_no_commit';reason:string;operationId?:string};

export type AiConfiguration={kind:'role';name:string;prompt:string}|{kind:'position';name:string;responsibility:string}|{kind:'agent';name:string;roleId:string;positionId:string;model:{connectionId:string;modelId:string}};
export type AiEntry=AiConfiguration&{id:string;revision:number};
export type DesktopAiInput={kind:'snapshot'}|{kind:'save';id:string;expectedRevision:number;value:AiConfiguration};
export type DesktopAiReply={status:'ok';entries:AiEntry[]}|{status:'committed';revision:number}|{status:'invalid_request'|'storage_unavailable'|'cancelled'|'unavailable'|'denied'|'invalid'|'reference_unavailable'|'revision_conflict'|'intent_conflict'|'unknown'|'not_committed'|'conflict'|'rejected'|'not_found'|'failed_no_commit';reason?:string;intent?:string};
export interface ConversationView {id:string;revision:number;messages:{id:string;role:'user'|'assistant';segments:{id:string;text:string}[];replaces?:string}[];generations:{id:string;inputMessageId:string;status:string;operationId?:string}[];selections?:{messageId:string;segmentIds:string[]}[]}
export type DesktopConversationInput={kind:'snapshot'}|{kind:'create'}|{kind:'open';id:string}|
 {kind:'send'|'resend';id:string;expectedRevision:number;agentId:string;text:string;replaces?:string}|
 {kind:'select';id:string;expectedRevision:number;messageId:string;segmentIds:string[]}|
 {kind:'recover';id:string;generationId:string};
export type DesktopConversationReply={status:'ok';conversation:ConversationView}|{status:'ok';conversations:ConversationView[]}|
 {status:'committed';id?:string;revision:number}|{status:'invalid_request'|'storage_unavailable'|'cancelled'|'unavailable'|'denied'|'invalid'|'reference_unavailable'|'revision_conflict'|'intent_conflict'|'unknown'|'not_committed'|'conflict'|'rejected'|'not_found'|'failed_no_commit'|'invalid_transition'|'already_dispatched';reason?:string;operationId?:string};
export interface ConversationText {conversationId:string;generationId:string;text:string}
export type DesktopPermissionInput={kind:'snapshot'}|{kind:'revoke';id:string;expectedRevision:number};
export type DesktopPermissionReply={status:'ok';revision:number;entries:{id:string;resource:string;action:string;target:string;context:string|null}[]}|
 {status:'committed';revision:number}|{status:'unknown';intent:string}|{status:'rejected'|'unavailable';reason:string}|{status:'cancelled'};

export interface DesktopGitHubFile {owner:string;repo:string;ref:string;path:string}
export type DesktopConnectionsInput={kind:'snapshot'}|{kind:'toggle';id:string;expectedRevision:number;enabled:boolean}|
 {kind:'github.create';expectedRevision:number}|{kind:'credential.set';id:string;expectedRevision:number}|{kind:'credential.revoke';id:string;expectedRevision:number}|
 {kind:'github.read';id:string;expectedRevision:number;file:DesktopGitHubFile}|
 {kind:'github.write';id:string;expectedRevision:number;file:DesktopGitHubFile;expectedSha:string;content:string;message:string};
export type DesktopConnectionsReply={status:'ok';revision:number;connections:{id:string;adapter:string;endpoint:string;enabled:boolean;hasCredential:boolean}[];operations:{id:string;phase:string;attempts:number;connectionId:string|null;adapter:string|null}[];localFiles:boolean;localDirectories:boolean;credentialBackend?:boolean}|
 {status:'committed';revision:number;notice?:string}|{status:'file';file:DesktopGitHubFile;sha:string;content:string;size:number}|
 {status:'written';sha:string;commitSha:string;operationId:string}|{status:'rejected'|'unavailable'|'conflict'|'unknown';reason:string;operationId?:string}|{status:'cancelled'};
