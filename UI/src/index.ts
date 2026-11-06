/** Serializable technical bridge only; business requests require separate reviewed contracts. */
export interface DesktopStatus {phase:'starting'|'ready'|'degraded'|'failed'|'stopping'|'release-pending';diagnostics:readonly {module:string;reason:string}[]}
export type HostReply<T>={ok:true;value:T}|{ok:false;error:string};
export interface DesktopBridge {api(input:DesktopApiInput):Promise<HostReply<DesktopApiReply>>;cancelApi():Promise<HostReply<{accepted:true}>>;space(input:DesktopSpaceInput):Promise<HostReply<DesktopSpaceReply>>;readStatus():Promise<HostReply<DesktopStatus>>;requestQuit():Promise<HostReply<{accepted:true}>>}

export interface SpaceName {id:string;revision:number;name:string}
export interface SpaceItem extends SpaceName {description:string;categoryId:string|null;directory?:string|null}
export interface GroupItem extends SpaceName {spaceId:string;order:number}
export type ContextItem=({status:'available';description:string}&SpaceName)|{status:'unavailable';id:string;reason:string};
export interface ContextOrganization {contextId:string;revision:number;spaceId:string|null;groupId:string|null}
export interface AddressItem extends SpaceName {address:string;notes:string;purpose:string|string[];status:'unverified';type?:string;source?:string}
export interface ToolItem {id:string;revision:number;owner:string;targetType:string;targetId:string;purpose:string;enabled:boolean;availability:'available'|'unavailable'|'conflict'|'unknown';sourceRevision:string;observedAt:string}
export type DesktopSpaceInput={kind:'resource.read';contextId:string;id:string;mode:'file'|'directory'}|{kind:'category.create';name:string}|{kind:'category.edit';id:string;expectedRevision:number;name:string}|
 {kind:'address.add';contextId:string;name:string;address:string;notes?:string;purpose?:string|string[]}|{kind:'address.edit';contextId:string;id:string;expectedRevision:number;name:string;address:string;notes?:string;purpose?:string|string[]}|
 {kind:'address.remove';contextId:string;id:string;expectedRevision:number}|{kind:'primary.select';contextId:string;id:string|null;expectedRevision:number}|{kind:'snapshot'}|{kind:'context.open';id:string}|
 {kind:'space.create';name:string;description?:string;categoryId?:string|null}|{kind:'space.edit';id:string;expectedRevision:number;name:string;description?:string;categoryId?:string|null}|
 {kind:'space.directory';id:string;expectedRevision:number;clear?:boolean}|
 {kind:'group.create';spaceId:string;name:string}|{kind:'group.edit';id:string;expectedRevision:number;name:string}|
 {kind:'context.create';name:string;description?:string}|{kind:'context.edit';id:string;expectedRevision:number;name:string;description?:string}|
 {kind:'context.group';contextId:string;spaceId:string;groupId:string|null;expectedRevision:number};
export type DesktopSpaceReply=
 {status:'ok';view:'file';contextId:string;addressId:string;content:string;version:string}|
 {status:'ok';view:'directory';contextId:string;addressId:string;entries:{name:string;kind:'file'|'directory'|'symlink'|'other'}[];complete:boolean;version:string}|
 {status:'ok';view:'snapshot';categories:SpaceName[];spaces:SpaceItem[];groups:GroupItem[];contexts:ContextItem[];organizations:ContextOrganization[];complete:boolean}|
 {status:'ok';view:'context';context:SpaceName&{description:string;primaryAddress:string|null};resources:AddressItem[];tools:ToolItem[];location:string;organization:ContextOrganization}|
 {status:'committed';id:string;revision:number}|
 {status:'cancelled'}|{status:'unknown';intent:string;id?:string}|
 {status:'unavailable'|'rejected'|'failed_no_commit';reason:string};

export type ApiJson=null|string|number|boolean|ApiJson[]|{[key:string]:ApiJson};
export type ApiParameter={mode:'value';value:ApiJson}|{mode:'provider-default'|'disabled'};
export type ApiCommonParameters=Partial<Record<'temperature'|'top_p'|'max_tokens',{mode:'value';value:number}|{mode:'provider-default'|'disabled'}>>;
export interface ApiConnectionView {id:string;revision:number;name:string;provider:string;protocol:string;endpoint:string;endpointMode:'base'|'request';credentialRef:{id:string;revision:number}|null;enabled:boolean;parameters:Record<string,ApiParameter>}
export interface ApiModelView {id:string;revision:number;connectionId:string;name:string;modelId:string;parameters:Record<string,ApiParameter>;observation:null|{source:'provider'|'probe';sourceRevision:string;observedAt:string;capabilities:Record<'text'|'stream'|'tools'|'image'|'reasoning','supported'|'unsupported'|'unknown'|'unverified'>;parameters:Record<string,{type:string;minimum?:number;maximum?:number;enum?:ApiJson[]}>}}
export type DesktopApiInput={kind:'snapshot'}|{kind:'models';connectionId:string}|
 {kind:'connection.create';name:string;provider:string;endpoint:string;endpointMode:'base'|'request';enabled:boolean;parameters?:ApiCommonParameters}|
 {kind:'connection.edit';id:string;expectedRevision:number;name?:string;provider?:string;endpoint?:string;endpointMode?:'base'|'request';enabled?:boolean;parameters?:ApiCommonParameters}|
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
