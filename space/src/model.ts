import type {Json} from '../../shared/src/index.js';
export interface Named {id:string;revision:number;name:string}
export interface Category extends Named {}
export interface Space extends Named {description:string;categoryId:string|null;directory?:string|null}
export interface Group extends Named {spaceId:string;order:number}
export interface Context extends Named {description:string;config:{[key:string]:Json};primaryAddress:string|null}
export type AddressPurpose=string|string[];
export interface Address extends Named {address:string;notes:string;purpose:AddressPurpose;type?:string;source?:string;status:'unverified'}
export interface Target {owner:string;targetType:string;targetId:string}
/** Shared write/read invariant: target identity must match the relation subtype. */
export function supportedTarget(value:Target,kind:'association'|'tool'):boolean {
 return kind==='tool'?value.owner==='connections'&&value.targetType==='tool':
  (value.owner==='AI'&&['role','agent'].includes(value.targetType))||
  (value.owner==='connections/api'&&['api','model'].includes(value.targetType));
}
export interface Association extends Target {id:string;revision:number;purpose:string}
export interface Tool extends Association {enabled:boolean}
export type ToolAvailability='available'|'unavailable'|'conflict'|'unknown';
/** Ephemeral owner projection; never persisted in Tool selection records. */
export interface ToolView extends Tool {availability:ToolAvailability;sourceRevision:string;observedAt:string}
export interface ContextView extends Context {resources:Address[];associations:Association[];tools:ToolView[]}
export type Mutation={status:'committed';id:string;revision:number}|{status:'rejected'|'unavailable'|'failed_no_commit';reason:string}|{status:'unknown';intent:string;id?:string};
export type ContextSummary={status:'available';id:string;revision:number;name:string;description:string}|{status:'unavailable';id:string;reason:string};
export interface ContextOrganization {contextId:string;revision:number;spaceId:string|null;groupId:string|null}
export interface ContextLocation {id:string;location:string;registration:'pending'|'ready';status:'available'|'unavailable';observedAt:string;revision?:number;reason?:string}
export type QueryResult={status:'ok';value:ContextView|ContextLocation|ContextOrganization|Array<Category|Space|Group|ContextSummary>;complete?:boolean}|Exclude<Mutation,{status:'committed'}>;
interface Base {intent:string}
interface Revision extends Base {id:string;expectedRevision:number}
interface InContext extends Base {contextId:string}
export type SpaceCommand=
 | (Base&{kind:'category.create';name:string})
 | (Revision&{kind:'category.edit';name:string})
 | (Base&{kind:'space.create';name:string;description?:string;categoryId?:string|null})
 | (Revision&{kind:'space.edit';name:string;description?:string;categoryId?:string|null})
 | (Revision&{kind:'space.directory';location:string|null})
 | (Base&{kind:'group.create';spaceId:string;name:string})
 | (Revision&{kind:'group.edit';name:string;order?:number})
 | (Base&{kind:'context.create';location:string;name:string;description?:string})
 | (Base&{kind:'context.attach';location:string;expectedContextId?:string})
 | (Revision&{kind:'context.edit';name:string;description?:string})
 | (InContext&{kind:'context.group';spaceId:string;groupId:string|null;expectedRevision:number})
 | (InContext&{kind:'address.add';name:string;address:string;notes?:string;purpose?:AddressPurpose;type?:string|null;source?:string|null})
 | (InContext&Revision&{kind:'address.edit';name:string;address:string;notes?:string;purpose?:AddressPurpose;type?:string|null;source?:string|null})
 | (InContext&Revision&{kind:'address.remove'|'association.remove'|'tool.remove'})
 | (InContext&{kind:'primary.select';id:string|null;expectedRevision:number})
 | (InContext&Target&{kind:'association.add'|'tool.add';purpose:string})
 | (InContext&Revision&Target&{kind:'association.replace';purpose:string})
 | (InContext&Revision&{kind:'tool.set';enabled:boolean});
export type SpaceQuery={kind:'context.organization';id:string}|{kind:'contexts'}|{kind:'context';id:string}|{kind:'context.location';id:string}|{kind:'organization';entity:'category'|'space'|'group'};
export interface ProjectionScope {action:string;target:string;context:string|null}
export type OwnerObservation=({status:'available';sourceRevision:string;observedAt:string;availability?:ToolAvailability}&Target)|{status:'denied'|'unavailable'|'unsupported'};
/** available confirms visible target identity; optional availability describes current capability state.
 * denied/unavailable without identity evidence cannot disclose a stored selection. */
export interface OwnerPort {resolve(request:object,target:Target):Promise<OwnerObservation>}
export interface Intent {key:string;command:string;id:string;revision:number;phase:'prepared'|'committed'}
export interface Registration {id:string;location:string;rootId:string;phase:'pending'|'ready';key:string;command:string;organization?:{revision:number;spaceId:string;groupId:string|null}}
export interface Registry {format:1;domain:'space';rootId:string;categories:Category[];spaces:Space[];groups:Group[];contexts:Registration[];intents:Intent[]}
export interface Body {format:1;domain:'context';rootId:string;context:Context;resources:Address[];associations:Association[];tools:Tool[];intents:Intent[]}
export class Failure extends Error {constructor(readonly status:'rejected'|'unavailable'|'failed_no_commit',readonly reason:string){super(reason);}}
export function fail(reason:string,status:Failure['status']='rejected'):never{throw new Failure(status,reason);}
export const nonempty=(x:unknown):x is string=>typeof x==='string'&&x.trim().length>0&&x.length<=4096;
const revision=(x:unknown):x is number=>Number.isSafeInteger(x)&&Number(x)>0;
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function exact(value:unknown,keys:string[]):boolean{return object(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));}
export function canonical(value:unknown):string {
 if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(!object(value))return fail('invalid_command');
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
/** Preserve legacy scalar purposes; reject sparse/ambiguous multi-purpose input. */
function addressPurpose(value:unknown):value is AddressPurpose {
 return typeof value==='string'||(Array.isArray(value)&&Object.keys(value).length===value.length&&
  Array.from({length:value.length},(_,i)=>Object.hasOwn(value,i)&&nonempty(value[i])).every(Boolean)&&new Set(value).size===value.length);
}
function address(value:unknown):value is Address {
 if(!named(value)||!object(value))return false;
 return exact(value,['id','revision','name','address','notes','purpose','status',...(Object.hasOwn(value,'type')?['type']:[]),...(Object.hasOwn(value,'source')?['source']:[])])&&
  nonempty(value['address'])&&typeof value['notes']==='string'&&addressPurpose(value['purpose'])&&value['status']==='unverified'&&
  (!Object.hasOwn(value,'type')||nonempty(value['type']))&&(!Object.hasOwn(value,'source')||nonempty(value['source']));
}
const fields:Record<string,string[]>={
 'category.create':['name'],'category.edit':['id','expectedRevision','name'],
 'space.create':['name','description','categoryId'],'space.edit':['id','expectedRevision','name','description','categoryId'],
 'space.directory':['id','expectedRevision','location'],
 'group.create':['spaceId','name'],'group.edit':['id','expectedRevision','name','order'],
 'context.attach':['location','expectedContextId'],
 'context.group':['contextId','spaceId','groupId','expectedRevision'],
 'context.create':['location','name','description'],'context.edit':['id','expectedRevision','name','description'],
 'address.add':['contextId','name','address','notes','purpose','type','source'],'address.edit':['contextId','id','expectedRevision','name','address','notes','purpose','type','source'],
 'address.remove':['contextId','id','expectedRevision'],'association.remove':['contextId','id','expectedRevision'],'tool.remove':['contextId','id','expectedRevision'],
 'primary.select':['contextId','id','expectedRevision'],
 'association.add':['contextId','owner','targetType','targetId','purpose'],'association.replace':['contextId','id','expectedRevision','owner','targetType','targetId','purpose'],
 'tool.add':['contextId','owner','targetType','targetId','purpose'],'tool.set':['contextId','id','expectedRevision','enabled']
};
/** A closed command schema: unknown fields cannot become persisted credentials or foreign state. */
export function command(input:unknown):SpaceCommand {
 if(!object(input)||!nonempty(input['kind']))return fail('invalid_command');
 const kind=input['kind'],allowed=Object.hasOwn(fields,kind)?fields[kind]:undefined;if(!allowed)return fail('unsupported_command');
 if(!nonempty(input['intent'])||String(input['intent']).length>256||Object.keys(input).some(k=>!['kind','intent',...allowed].includes(k)))return fail('invalid_command');
 for(const k of allowed){
  const x=input[k];
  if((kind==='address.add'||kind==='address.edit')&&k==='purpose'){if(x!==undefined&&!addressPurpose(x))return fail('invalid_command');}
  else if((kind==='address.add'||kind==='address.edit')&&['type','source'].includes(k)){if(x!==undefined&&x!==null&&!nonempty(x))return fail('invalid_command');}
  else if(['description','notes','purpose'].includes(k)){if(x!==undefined&&typeof x!=='string')return fail('invalid_command');}
  else if(k==='expectedContextId'){if(x!==undefined&&!nonempty(x))return fail('invalid_command');}
  else if(k==='location'&&kind==='space.directory'&&x===null)continue;
  else if(k==='categoryId'){if(x!==undefined&&x!==null&&!nonempty(x))return fail('invalid_command');}
  else if(k==='order'){if(x!==undefined&&(!Number.isSafeInteger(x)||Number(x)<0))return fail('invalid_command');}
  else if(k==='groupId'&&kind==='context.group'&&x===null)continue;
  else if(k==='expectedRevision'){if(kind==='context.group'?!Number.isSafeInteger(x)||Number(x)<0:!revision(x))return fail('invalid_command');}
  else if(k==='enabled'){if(typeof x!=='boolean')return fail('invalid_command');}
  else if(k==='id'&&kind==='primary.select'&&x===null)continue;
  else if(!nonempty(x))return fail('invalid_command');
 }
 canonical(input);return structuredClone(input) as unknown as SpaceCommand;
}
const named=(x:unknown):x is Named=>object(x)&&nonempty(x['id'])&&revision(x['revision'])&&nonempty(x['name']);
const target=(x:unknown):x is Association=>object(x)&&nonempty(x['id'])&&revision(x['revision'])&&nonempty(x['owner'])&&nonempty(x['targetType'])&&nonempty(x['targetId'])&&typeof x['purpose']==='string';
function intents(value:unknown):value is Intent[]{return Array.isArray(value)&&value.every(x=>exact(x,['key','command','id','revision','phase'])&&object(x)&&nonempty(x['key'])&&typeof x['command']==='string'&&nonempty(x['id'])&&revision(x['revision'])&&['prepared','committed'].includes(String(x['phase'])))&&new Set(value.map(x=>x.key)).size===value.length;}
function uniqueTargets(values:Target[]):boolean{return new Set(values.map(x=>JSON.stringify([x.owner,x.targetType,x.targetId]))).size===values.length;}
function unique(values:{id:string}[]):boolean{return new Set(values.map(x=>x.id)).size===values.length;}
function envelope(value:unknown,domain:string,rootId:string):asserts value is Record<string,unknown>{
 if(!object(value)||value['format']!==1||value['domain']!==domain)return fail('incompatible_or_corrupt','unavailable');
 if(value['rootId']!==rootId)return fail('identity_conflict','unavailable');
 if(!intents(value['intents']))return fail('corrupt_intents','unavailable');
}
function validOrganization(value:unknown,state:Registry):boolean{
 if(!exact(value,['revision','spaceId','groupId']))return false;
 const position=value as NonNullable<Registration['organization']>;
 return revision(position.revision)&&nonempty(position.spaceId)&&state.spaces.some(space=>space.id===position.spaceId)&&
  (position.groupId===null||nonempty(position.groupId)&&state.groups.some(group=>group.id===position.groupId&&group.spaceId===position.spaceId));
}
export function registry(value:Json,rootId:string):Registry {
 if(value===null)return {format:1,domain:'space',rootId,categories:[],spaces:[],groups:[],contexts:[],intents:[]};
 envelope(value,'space',rootId);const s=value as unknown as Registry;
 if(!exact(s,['format','domain','rootId','categories','spaces','groups','contexts','intents'])||!Array.isArray(s.categories)||!s.categories.every(x=>named(x)&&exact(x,['id','revision','name']))||!Array.isArray(s.spaces)||!s.spaces.every(x=>named(x)&&exact(x,['id','revision','name','description','categoryId',...(Object.hasOwn(x,'directory')?['directory']:[])])&&(!Object.hasOwn(x,'directory')||x.directory===null||nonempty(x.directory))&&typeof x.description==='string'&&(x.categoryId===null||s.categories.some(c=>c.id===x.categoryId)))||!Array.isArray(s.groups)||!s.groups.every(x=>named(x)&&exact(x,['id','revision','name','spaceId','order'])&&Number.isSafeInteger(x.order)&&x.order>=0&&s.spaces.some(p=>p.id===x.spaceId))||!Array.isArray(s.contexts)||!s.contexts.every(x=>object(x)&&exact(x,['id','location','rootId','phase','key','command',...(Object.hasOwn(x,'organization')?['organization']:[])])&&nonempty(x.id)&&nonempty(x.location)&&nonempty(x.rootId)&&nonempty(x.key)&&typeof x.command==='string'&&['pending','ready'].includes(x.phase)&&(!Object.hasOwn(x,'organization')||x.phase==='ready'&&validOrganization(x.organization,s)))||!unique([...s.categories,...s.spaces,...s.groups,...s.contexts])||new Set(s.contexts.map(x=>x.location)).size!==s.contexts.length||new Set(s.contexts.map(x=>x.key)).size!==s.contexts.length)return fail('corrupt_registry','unavailable');
 return s;
}
export function body(value:Json,rootId:string,expectedId:string):Body {
 envelope(value,'context',rootId);const s=value as unknown as Body;
 if(named(s.context)&&s.context.id!==expectedId)return fail('identity_conflict','unavailable');
 if(!exact(s,['format','domain','rootId','context','resources','associations','tools','intents'])||!named(s.context)||!exact(s.context,['id','revision','name','description','config','primaryAddress'])||s.context.id!==expectedId||typeof s.context.description!=='string'||(!object(s.context.config)||Object.keys(s.context.config).length!==0)||!Array.isArray(s.resources)||!s.resources.every(address)||!Array.isArray(s.associations)||!s.associations.every(x=>target(x)&&supportedTarget(x,'association')&&exact(x,['id','revision','owner','targetType','targetId','purpose']))||!Array.isArray(s.tools)||!s.tools.every(x=>target(x)&&supportedTarget(x,'tool')&&exact(x,['id','revision','owner','targetType','targetId','purpose','enabled'])&&typeof x.enabled==='boolean')||!uniqueTargets(s.associations)||!uniqueTargets(s.tools)||!unique([s.context,...s.resources,...s.associations,...s.tools])||(s.context.primaryAddress!==null&&!s.resources.some(x=>x.id===s.context.primaryAddress)))return fail('corrupt_context','unavailable');
 return s;
}
export function allocate(state:Registry|Body,id:()=>string):string {
 const value=id();const used='contexts'in state?[...state.categories,...state.spaces,...state.groups,...state.contexts]:[state.context,...state.resources,...state.associations,...state.tools];
 if(!nonempty(value)||used.some(x=>x.id===value)||state.intents.some(x=>x.id===value))return fail('id_collision');return value;
}
export function expected(value:{revision:number},revision:number):void{if(value.revision!==revision)fail('revision_conflict');if(value.revision===Number.MAX_SAFE_INTEGER)fail('revision_exhausted');}
export function find<T extends {id:string}>(values:T[],id:string):T{return values.find(x=>x.id===id)??fail('not_found');}
