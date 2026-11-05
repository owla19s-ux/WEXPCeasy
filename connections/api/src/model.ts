import type {Json} from '../../../shared/src/index.js';
export type ToolSchema=({type:'object';properties:Record<string,ToolSchema>;required?:string[];additionalProperties:false}|{type:'array';items:ToolSchema}|{type:'string'|'number'|'integer'|'boolean'|'null';enum?:Json[]})&{description?:string};
export interface ToolDefinition {name:string;description?:string;parameters:ToolSchema}
export interface ToolProposal {id:string;name:string;arguments:Record<string,Json>}
export type ParameterSetting={mode:'value';value:Json}|{mode:'provider-default'|'disabled'};
export type Parameters=Record<string,ParameterSetting>;
export interface CredentialReference {id:string;revision:number}
export interface ApiConnection {id:string;revision:number;name:string;provider:string;protocol:string;endpoint:string;endpointMode:'base'|'request';credentialRef:CredentialReference|null;enabled:boolean;parameters:Parameters}
export type Capability='text'|'stream'|'tools'|'image'|'reasoning';
export type CapabilityState='supported'|'unsupported'|'unknown'|'unverified';
export interface ParameterSpec {type:'number'|'integer'|'boolean'|'string'|'object'|'array'|'null';minimum?:number;maximum?:number;enum?:Json[]}
export interface ModelObservation {connectionId:string;connectionRevision:number;modelId:string;source:'provider'|'probe';sourceRevision:string;observedAt:string;capabilities:Record<Capability,CapabilityState>;parameters:Record<string,ParameterSpec>}
export interface ApiModel {id:string;revision:number;connectionId:string;name:string;modelId:string;parameters:Parameters;observation:ModelObservation|null}
/** Returns existing verified observations; network probes require their own controlled operation. */
export interface ModelObserver {resolve(request:object,connection:Readonly<ApiConnection>,model:Readonly<ApiModel>):ModelObservation|undefined}
interface Base {intent:string}
interface Edit extends Base {id:string;expectedRevision:number}
export type ApiCommand=
 | (Base&{kind:'connection.create';name:string;provider:string;protocol:string;endpoint:string;endpointMode:'base'|'request';credentialRef:CredentialReference|null;enabled:boolean;parameters:Parameters})
 | (Edit&{kind:'connection.edit';name?:string;provider?:string;protocol?:string;endpoint?:string;endpointMode?:'base'|'request';credentialRef?:CredentialReference|null;enabled?:boolean;parameters?:Parameters})
 | (Base&{kind:'model.create';connectionId:string;name:string;modelId:string;parameters:Parameters})
 | (Edit&{kind:'model.edit';name?:string;parameters?:Parameters})
 | (Edit&{kind:'model.observe';probeOperationId?:string});
export type ApiMutation={status:'committed';id:string;revision:number}|{status:'rejected'|'unavailable'|'failed_no_commit';reason:string}|{status:'unknown';intent:string;id?:string};
export type ApiQuery={kind:'connection'|'model';id:string}|{kind:'connections'}|{kind:'models';connectionId:string};
export type ApiQueryResult={status:'ok';value:ApiConnection|ApiModel|Array<ApiConnection|ApiModel>}|Exclude<ApiMutation,{status:'committed'}>;
export interface Preparation {tools?:ToolDefinition[];requestId:string;connectionId:string;connectionRevision:number;modelId:string;modelRevision:number;context:string|null;parameters:Parameters;messages:{role:'system'|'user'|'assistant';content:string}[];timeoutMs:number;stream:boolean}
export interface RequestSnapshot {tools?:readonly ToolDefinition[];requestId:string;context:string|null;conversation:string|null;connection:Readonly<ApiConnection>;model:Readonly<ApiModel>;url:string;body:Readonly<{model:string;messages:Preparation['messages'];stream:boolean;[key:string]:Json}>;parameterSources:Record<string,string[]>;parameterSettings:Parameters;timeoutMs:number;fingerprint:string}
export interface Intent {key:string;command:string;id:string;revision:number;phase:'prepared'|'committed'}
export interface State {format:1;domain:'api-configurations';connections:ApiConnection[];models:ApiModel[];intents:Intent[]}
export class Failure extends Error {constructor(readonly reason:string,readonly status:'rejected'|'unavailable'|'failed_no_commit'='rejected'){super(reason);}}
export function fail(reason:string,status:Failure['status']='rejected'):never{throw new Failure(reason,status);}
export const text=(x:unknown):x is string=>typeof x==='string'&&x.trim().length>0&&x.length<=4096;
export const revision=(x:unknown):x is number=>Number.isSafeInteger(x)&&Number(x)>0;
export const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
export function closed(x:unknown,required:string[],optional:string[]=[]):x is Record<string,unknown>{return object(x)&&required.every(k=>Object.hasOwn(x,k))&&Object.keys(x).every(k=>[...required,...optional].includes(k));}
export function canonical(input:unknown,seen=new Set<object>(),depth=0):string {
 if(depth>64)fail('input_too_deep');
 if(input===null||typeof input==='boolean'||typeof input==='string')return JSON.stringify(input);
 if(typeof input==='number'&&Number.isFinite(input))return JSON.stringify(input);
 if(!input||typeof input!=='object'||seen.has(input))return fail('invalid_request');seen.add(input);
 try{
  if(Array.isArray(input)){if(Object.keys(input).length!==input.length||!Array.from({length:input.length},(_,i)=>Object.hasOwn(input,i)).every(Boolean))fail('invalid_request');return '['+input.map(x=>canonical(x,seen,depth+1)).join(',')+']';}
  if(!object(input))return fail('invalid_request');
  return '{'+Object.keys(input).sort().map(k=>JSON.stringify(k)+':'+canonical(input[k],seen,depth+1)).join(',')+'}';
 }finally{seen.delete(input);}
}
export function capture<T>(input:T):T{return JSON.parse(canonical(input)) as T;}
export function freeze<T>(value:T):Readonly<T>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
const reserved=new Set(['model','messages','stream','tools','tool_choice','authorization','headers','apikey','api_key','endpoint','baseurl','base_url','onpayload','__proto__','constructor','prototype'].map(x=>x.toLowerCase().replace(/[-_]/g,'')));
function parameterName(k:string):boolean{return text(k)&&!reserved.has(k.toLowerCase().replace(/[-_]/g,''));}
export function parameters(input:unknown):input is Parameters {
 if(!object(input))return false;
 return Object.entries(input).every(([k,v])=>parameterName(k)&&object(v)&&((v['mode']==='value'&&closed(v,['mode','value'])&&validJson(v['value']))||(['provider-default','disabled'].includes(String(v['mode']))&&closed(v,['mode']))));
}
function validJson(value:unknown):boolean{try{canonical(value);return true;}catch{return false;}}
function credential(value:unknown):boolean{return value===null||(closed(value,['id','revision'])&&text(value['id'])&&revision(value['revision']));}
export function endpoint(value:string,mode:'base'|'request'):string {
 let url:URL;try{url=new URL(value);}catch{return fail('invalid_endpoint');}
 if(url.username||url.password||url.search||url.hash||!['https:','http:'].includes(url.protocol)||(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)))return fail('invalid_endpoint');
 if(mode==='base'&&url.pathname.replace(/\/$/,'').endsWith('/chat/completions'))return fail('ambiguous_endpoint');
 return url.href;
}
function connection(value:unknown):value is ApiConnection {
 if(!closed(value,['id','revision','name','provider','protocol','endpoint','endpointMode','credentialRef','enabled','parameters'])||!['id','name','provider','protocol','endpoint'].every(k=>text(value[k]))||!revision(value['revision'])||!['base','request'].includes(String(value['endpointMode']))||!credential(value['credentialRef'])||typeof value['enabled']!=='boolean'||!parameters(value['parameters']))return false;
 try{return endpoint(String(value['endpoint']),value['endpointMode'] as 'base'|'request')===value['endpoint'];}catch{return false;}
}
function baseType(value:Json,type:ParameterSpec['type']):boolean {
 return type==='null'?value===null:type==='array'?Array.isArray(value):type==='object'?object(value):type==='integer'?Number.isSafeInteger(value):type==='number'?typeof value==='number'&&Number.isFinite(value):typeof value===type;
}
export function parameterValue(value:Json,spec:ParameterSpec):boolean{return baseType(value,spec.type)&&(spec.minimum===undefined||typeof value==='number'&&value>=spec.minimum)&&(spec.maximum===undefined||typeof value==='number'&&value<=spec.maximum)&&(spec.enum===undefined||spec.enum.some(x=>canonical(x)===canonical(value)));}
function specs(value:unknown):boolean {
 return object(value)&&Object.entries(value).every(([name,s])=>{
  if(!parameterName(name)||!closed(s,['type'],['minimum','maximum','enum'])||!['number','integer','boolean','string','object','array','null'].includes(String(s['type'])))return false;
  if(['minimum','maximum'].some(k=>Object.hasOwn(s,k)&&(!['number','integer'].includes(String(s['type']))||typeof s[k]!=='number'||!Number.isFinite(s[k]))))return false;
  if(typeof s['minimum']==='number'&&typeof s['maximum']==='number'&&s['minimum']>s['maximum'])return false;
  return !Object.hasOwn(s,'enum')||(Array.isArray(s['enum'])&&s['enum'].length>0&&validJson(s['enum'])&&s['enum'].every(x=>baseType(x as Json,s['type'] as ParameterSpec['type'])));
 });
}
export function observation(value:unknown):value is ModelObservation {
 return closed(value,['connectionId','connectionRevision','modelId','source','sourceRevision','observedAt','capabilities','parameters'])&&text(value['connectionId'])&&revision(value['connectionRevision'])&&text(value['modelId'])&&['provider','probe'].includes(String(value['source']))&&text(value['sourceRevision'])&&typeof value['observedAt']==='string'&&Number.isFinite(Date.parse(value['observedAt']))&&closed(value['capabilities'],['text','stream','tools','image','reasoning'])&&Object.values(value['capabilities']).every(v=>['supported','unsupported','unknown','unverified'].includes(String(v)))&&specs(value['parameters']);
}
function model(value:unknown):value is ApiModel{return closed(value,['id','revision','connectionId','name','modelId','parameters','observation'])&&['id','connectionId','name','modelId'].every(k=>text(value[k]))&&revision(value['revision'])&&parameters(value['parameters'])&&(value['observation']===null||observation(value['observation']));}
export function decode(value:Json):State {
 if(value===null)return {format:1,domain:'api-configurations',connections:[],models:[],intents:[]};
 try{
 if(!closed(value,['format','domain','connections','models','intents'])||value['format']!==1||value['domain']!=='api-configurations')return fail('incompatible_or_corrupt','unavailable');
 const s=value as unknown as State;
 if(!Array.isArray(s.connections)||!s.connections.every(connection)||!Array.isArray(s.models)||!s.models.every(m=>model(m)&&s.connections.some(c=>c.id===m.connectionId)&&(m.observation===null||(m.observation.connectionId===m.connectionId&&m.observation.modelId===m.modelId)))||new Set([...s.connections,...s.models].map(x=>x.id)).size!==s.connections.length+s.models.length||new Set(s.models.map(m=>canonical([m.connectionId,m.modelId]))).size!==s.models.length)return fail('corrupt_api_state','unavailable');
 if(!Array.isArray(s.intents)||!s.intents.every(i=>closed(i,['key','command','id','revision','phase'])&&text(i.key)&&typeof i.command==='string'&&text(i.id)&&revision(i.revision)&&['prepared','committed'].includes(i.phase))||new Set(s.intents.map(i=>i.key)).size!==s.intents.length)return fail('corrupt_api_intents','unavailable');
 return s;
 }catch(e){if(e instanceof Failure)throw e;return fail('corrupt_api_state','unavailable');}
}
export function command(value:unknown):ApiCommand {
 const c=capture(value);if(!object(c)||!text(c['kind']))return fail('invalid_request');
 const kind=c['kind'];let required:string[],optional:string[]=[];
 if(kind==='connection.create')required=['name','provider','protocol','endpoint','endpointMode','credentialRef','enabled','parameters'];
 else if(kind==='connection.edit'){required=['id','expectedRevision'];optional=['name','provider','protocol','endpoint','endpointMode','credentialRef','enabled','parameters'];}
 else if(kind==='model.create')required=['connectionId','name','modelId','parameters'];
 else if(kind==='model.edit'){required=['id','expectedRevision'];optional=['name','parameters'];}
 else if(kind==='model.observe'){required=['id','expectedRevision'];optional=['probeOperationId'];}else return fail('unsupported_command');
 if(!closed(c,['kind','intent',...required],optional)||!text(c['intent'])||String(c['intent']).length>256)return fail('invalid_request');
 for(const [key,v] of Object.entries(c)){
  if(['kind','intent'].includes(key))continue;
  if(key==='parameters'){if(!parameters(v))fail('invalid_request');}
  else if(key==='credentialRef'){if(!credential(v))fail('invalid_request');}
  else if(key==='expectedRevision'){if(!revision(v))fail('invalid_request');}
  else if(key==='enabled'){if(typeof v!=='boolean')fail('invalid_request');}
  else if(key==='endpointMode'){if(!['base','request'].includes(String(v)))fail('invalid_request');}
  else if(!text(v))fail('invalid_request');
 }
 if(kind==='connection.edit'&&!optional.some(k=>Object.hasOwn(c,k)))return fail('empty_edit');
 if(kind==='model.edit'&&!optional.some(k=>Object.hasOwn(c,k)))return fail('empty_edit');
 return c as unknown as ApiCommand;
}
