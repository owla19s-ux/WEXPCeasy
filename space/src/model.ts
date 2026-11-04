import type {Json} from '../../shared/src/index.js';
export interface Named {id:string;revision:number;name:string}
export interface Category extends Named {}
export interface Space extends Named {description:string;categoryId:string|null}
export interface Group extends Named {spaceId:string;order:number}
export interface Context extends Named {description:string;config:{[key:string]:Json};primaryAddress:string|null}
export interface Address extends Named {address:string;notes:string;purpose:string;status:'unverified'}
export interface Target {owner:string;targetType:string;targetId:string}
export interface Association extends Target {id:string;revision:number;purpose:string}
export interface Tool extends Association {enabled:boolean}
export interface ContextView extends Context {resources:Address[];associations:Association[];tools:Tool[]}
export type Mutation={status:'committed';id:string;revision:number}|{status:'rejected'|'unavailable'|'failed_no_commit';reason:string}|{status:'unknown';intent:string;id?:string};
export type QueryResult={status:'ok';value:ContextView|Array<Category|Space|Group>;complete?:boolean}|Exclude<Mutation,{status:'committed'}>;
interface Base {intent:string}
interface Revision extends Base {id:string;expectedRevision:number}
interface InContext extends Base {contextId:string}
export type SpaceCommand=
 | (Base&{kind:'category.create';name:string})
 | (Revision&{kind:'category.edit';name:string})
 | (Base&{kind:'space.create';name:string;description?:string;categoryId?:string|null})
 | (Revision&{kind:'space.edit';name:string;description?:string;categoryId?:string|null})
 | (Base&{kind:'group.create';spaceId:string;name:string})
 | (Revision&{kind:'group.edit';name:string;order?:number})
 | (Base&{kind:'context.create';location:string;name:string;description?:string})
 | (Revision&{kind:'context.edit';name:string;description?:string})
 | (InContext&{kind:'address.add';name:string;address:string;notes?:string;purpose?:string})
 | (InContext&Revision&{kind:'address.edit';name:string;address:string;notes?:string;purpose?:string})
 | (InContext&Revision&{kind:'address.remove'|'association.remove'|'tool.remove'})
 | (InContext&{kind:'primary.select';id:string|null;expectedRevision:number})
 | (InContext&Target&{kind:'association.add'|'tool.add';purpose:string})
 | (InContext&Revision&Target&{kind:'association.replace';purpose:string})
 | (InContext&Revision&{kind:'tool.set';enabled:boolean});
export type SpaceQuery={kind:'context';id:string}|{kind:'organization';entity:'category'|'space'|'group'};
export interface ProjectionScope {action:string;target:string;context:string|null}
export type OwnerObservation=({status:'available';sourceRevision:string;observedAt:string}&Target)|{status:'denied'|'unavailable'|'unsupported'};
export interface OwnerPort {resolve(request:object,target:Target):Promise<OwnerObservation>}
export interface Intent {key:string;command:string;id:string;revision:number;phase:'prepared'|'committed'}
export interface Registration {id:string;location:string;rootId:string;phase:'pending'|'ready';key:string;command:string}
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
const fields:Record<string,string[]>={
 'category.create':['name'],'category.edit':['id','expectedRevision','name'],
 'space.create':['name','description','categoryId'],'space.edit':['id','expectedRevision','name','description','categoryId'],
 'group.create':['spaceId','name'],'group.edit':['id','expectedRevision','name','order'],
 'context.create':['location','name','description'],'context.edit':['id','expectedRevision','name','description'],
 'address.add':['contextId','name','address','notes','purpose'],'address.edit':['contextId','id','expectedRevision','name','address','notes','purpose'],
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
  if(['description','notes','purpose'].includes(k)){if(x!==undefined&&typeof x!=='string')return fail('invalid_command');}
  else if(k==='categoryId'){if(x!==undefined&&x!==null&&!nonempty(x))return fail('invalid_command');}
  else if(k==='order'){if(x!==undefined&&(!Number.isSafeInteger(x)||Number(x)<0))return fail('invalid_command');}
  else if(k==='expectedRevision'){if(!revision(x))return fail('invalid_command');}
  else if(k==='enabled'){if(typeof x!=='boolean')return fail('invalid_command');}
  else if(k==='id'&&kind==='primary.select'&&x===null)continue;
  else if(!nonempty(x))return fail('invalid_command');
 }
 canonical(input);return structuredClone(input) as unknown as SpaceCommand;
}
const named=(x:unknown):x is Named=>object(x)&&nonempty(x['id'])&&revision(x['revision'])&&nonempty(x['name']);
const target=(x:unknown):x is Association=>object(x)&&nonempty(x['id'])&&revision(x['revision'])&&nonempty(x['owner'])&&nonempty(x['targetType'])&&nonempty(x['targetId'])&&typeof x['purpose']==='string';
function intents(value:unknown):value is Intent[]{return Array.isArray(value)&&value.every(x=>exact(x,['key','command','id','revision','phase'])&&object(x)&&nonempty(x['key'])&&typeof x['command']==='string'&&nonempty(x['id'])&&revision(x['revision'])&&['prepared','committed'].includes(String(x['phase'])))&&new Set(value.map(x=>x.key)).size===value.length;}
function unique(values:{id:string}[]):boolean{return new Set(values.map(x=>x.id)).size===values.length;}
function envelope(value:unknown,domain:string,rootId:string):asserts value is Record<string,unknown>{
 if(!object(value)||value['format']!==1||value['domain']!==domain)return fail('incompatible_or_corrupt','unavailable');
 if(value['rootId']!==rootId)return fail('identity_conflict','unavailable');
 if(!intents(value['intents']))return fail('corrupt_intents','unavailable');
}
export function registry(value:Json,rootId:string):Registry {
 if(value===null)return {format:1,domain:'space',rootId,categories:[],spaces:[],groups:[],contexts:[],intents:[]};
 envelope(value,'space',rootId);const s=value as unknown as Registry;
 if(!exact(s,['format','domain','rootId','categories','spaces','groups','contexts','intents'])||!Array.isArray(s.categories)||!s.categories.every(x=>named(x)&&exact(x,['id','revision','name']))||!Array.isArray(s.spaces)||!s.spaces.every(x=>named(x)&&exact(x,['id','revision','name','description','categoryId'])&&typeof x.description==='string'&&(x.categoryId===null||s.categories.some(c=>c.id===x.categoryId)))||!Array.isArray(s.groups)||!s.groups.every(x=>named(x)&&exact(x,['id','revision','name','spaceId','order'])&&Number.isSafeInteger(x.order)&&x.order>=0&&s.spaces.some(p=>p.id===x.spaceId))||!Array.isArray(s.contexts)||!s.contexts.every(x=>object(x)&&exact(x,['id','location','rootId','phase','key','command'])&&nonempty(x.id)&&nonempty(x.location)&&nonempty(x.rootId)&&nonempty(x.key)&&typeof x.command==='string'&&['pending','ready'].includes(x.phase))||!unique([...s.categories,...s.spaces,...s.groups,...s.contexts])||new Set(s.contexts.map(x=>x.location)).size!==s.contexts.length||new Set(s.contexts.map(x=>x.key)).size!==s.contexts.length)return fail('corrupt_registry','unavailable');
 return s;
}
export function body(value:Json,rootId:string,expectedId:string):Body {
 envelope(value,'context',rootId);const s=value as unknown as Body;
 if(!exact(s,['format','domain','rootId','context','resources','associations','tools','intents'])||!named(s.context)||!exact(s.context,['id','revision','name','description','config','primaryAddress'])||s.context.id!==expectedId||typeof s.context.description!=='string'||(!object(s.context.config)||Object.keys(s.context.config).length!==0)||!Array.isArray(s.resources)||!s.resources.every(x=>named(x)&&exact(x,['id','revision','name','address','notes','purpose','status'])&&nonempty(x.address)&&typeof x.notes==='string'&&typeof x.purpose==='string'&&x.status==='unverified')||!Array.isArray(s.associations)||!s.associations.every(x=>target(x)&&exact(x,['id','revision','owner','targetType','targetId','purpose']))||!Array.isArray(s.tools)||!s.tools.every(x=>target(x)&&exact(x,['id','revision','owner','targetType','targetId','purpose','enabled'])&&typeof x.enabled==='boolean')||!unique([s.context,...s.resources,...s.associations,...s.tools])||(s.context.primaryAddress!==null&&!s.resources.some(x=>x.id===s.context.primaryAddress)))return fail('corrupt_context','unavailable');
 return s;
}
export function allocate(state:Registry|Body,id:()=>string):string {
 const value=id();const used='contexts'in state?[...state.categories,...state.spaces,...state.groups,...state.contexts]:[state.context,...state.resources,...state.associations,...state.tools];
 if(!nonempty(value)||used.some(x=>x.id===value)||state.intents.some(x=>x.id===value))return fail('id_collision');return value;
}
export function expected(value:{revision:number},revision:number):void{if(value.revision!==revision)fail('revision_conflict');}
export function find<T extends {id:string}>(values:T[],id:string):T{return values.find(x=>x.id===id)??fail('not_found');}
