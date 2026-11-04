import type {Facts} from '../../permissions/src/index.js';
export interface LocalOperation {readonly resource:string;readonly action:string;readonly target:string;readonly context:string|null}
export interface LocalEntryFacts {
 readonly subject:string;readonly entry:string;readonly relationship:string;readonly relationshipGeneration:number;
 readonly moduleEnabled:boolean;readonly globalEnabled:boolean;readonly sourceAllowed:boolean;readonly entryEnabled:boolean;
}
/** Main-process verifier of the actual event source, never Renderer identity claims. */
export interface LocalEntryOptions {current(source:object,operation:Readonly<LocalOperation>):LocalEntryFacts|undefined}
/** Trusted host-only API; it creates request bindings, not grants or user authentication. */
export interface LocalEntryClient {
 bind(source:object,operation:LocalOperation):object|undefined;
 derive(parent:object,projection:Pick<LocalOperation,'action'|'target'|'context'>):object|undefined;
 close(source:object):void;
}
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=4096;
function operation(value:LocalOperation):Readonly<LocalOperation>|undefined {
 if(!value||typeof value!=='object'||Object.keys(value).length!==4||!['resource','action','target','context'].every(k=>Object.hasOwn(value,k)))return;
 const out={resource:value.resource,action:value.action,target:value.target,context:value.context};
 if(!text(out.resource)||!text(out.action)||!text(out.target)||(out.context!==null&&!text(out.context)))return;
 return Object.freeze(out);
}
const identity=(f:LocalEntryFacts)=>[f.subject,f.entry,f.relationship,f.relationshipGeneration] as const;
const same=(a:LocalEntryFacts,b:LocalEntryFacts)=>identity(a).every((v,i)=>v===identity(b)[i]);
export function createLocalEntries(options:LocalEntryOptions){
 const requests=new WeakMap<object,{source:object;operation:Readonly<LocalOperation>;identity:LocalEntryFacts}>(),closed=new WeakSet<object>();
 const entries=new Map<string,{source:WeakRef<object>;identity:LocalEntryFacts}>();let active=true;
 function observe(source:object,op:Readonly<LocalOperation>):LocalEntryFacts|undefined {
  if(!active||!source||typeof source!=='object'||closed.has(source))return;
  try{const value=options.current(source,op);if(!value)return;
   const f={subject:value.subject,entry:value.entry,relationship:value.relationship,relationshipGeneration:value.relationshipGeneration,moduleEnabled:value.moduleEnabled,globalEnabled:value.globalEnabled,sourceAllowed:value.sourceAllowed,entryEnabled:value.entryEnabled};
   if(!text(f.subject)||!text(f.entry)||!text(f.relationship)||!Number.isSafeInteger(f.relationshipGeneration)||f.relationshipGeneration<=0||![f.moduleEnabled,f.globalEnabled,f.sourceAllowed,f.entryEnabled].every(v=>typeof v==='boolean'))return;
   if(!active||closed.has(source))return;
   return Object.freeze(f);
  }catch{return;}
 }
 function bind(source:object,input:LocalOperation):object|undefined {
  const op=operation(input);if(!op)return;const f=observe(source,op);if(!f)return;
  const previous=entries.get(f.entry);
  if(previous&&(f.relationshipGeneration<previous.identity.relationshipGeneration||(f.relationshipGeneration===previous.identity.relationshipGeneration&&(source!==previous.source.deref()||!same(f,previous.identity)))))return;
  entries.set(f.entry,{source:new WeakRef(source),identity:f});const request=Object.freeze(Object.create(null)) as object;
  requests.set(request,{source,operation:op,identity:f});return request;
 }
 function current(request:object):Facts|undefined {
  const record=requests.get(request);if(!record)return;
  const f=observe(record.source,record.operation),entry=entries.get(record.identity.entry);
  if(!f||!entry||entry.source.deref()!==record.source||!same(entry.identity,record.identity)||!same(f,record.identity))return;
  return Object.freeze({...f,...record.operation,kind:'local' as const,conversation:null,conversationEnabled:false});
 }
 function derive(parent:object,projection:Pick<LocalOperation,'action'|'target'|'context'>):object|undefined {
  if(!projection||typeof projection!=='object'||Object.keys(projection).length!==3||!['action','target','context'].every(k=>Object.hasOwn(projection,k)))return;
  const record=requests.get(parent);if(!record||!current(parent))return;
  const derived=bind(record.source,{resource:record.operation.resource,action:projection.action,target:projection.target,context:projection.context});
  if(!derived||!same(requests.get(derived)!.identity,record.identity)||!current(parent))return;
  return derived;
 }
 const client:LocalEntryClient=Object.freeze({bind,derive,close(source:object){if(source&&typeof source==='object')closed.add(source);}});
 return {client,current,owns:(request:object)=>requests.has(request),stop(){active=false;entries.clear();}};
}
