import type {Store,Json,CommitResult} from '../../shared/src/index.js';
export interface Scope {readonly subject:string;readonly entry:string;readonly conversation:string|null;readonly context:string|null;readonly resource:string;readonly action:string;readonly target:string;readonly relationship:string;readonly relationshipGeneration:number}
export interface Facts extends Scope {readonly kind:'conversation'|'task'|'local'|'callback';readonly moduleEnabled:boolean;readonly globalEnabled:boolean;readonly conversationEnabled:boolean;readonly sourceAllowed:boolean;
 /** Explicit direct-user entry policy from the trusted host; never inferred from conversationEnabled. */
 readonly entryEnabled?:boolean}
export interface Change {readonly intent:string;readonly expectedRevision:number;readonly scope:Scope}
/** Injected by trusted host only; external/UI claims must never implement this port. */
export interface TrustPort {current(request:object):Facts|undefined;canManage(change:Change):boolean;canReadHistory(request:object):boolean}
export type Decision={readonly status:'allow';readonly revision:number;readonly generation:number;readonly scope:Scope}|{readonly status:'deny'|'indeterminate';readonly reason:string};
export interface PermissionReader {evaluate(request:object):Decision;recheck(request:object,prior:Decision):Decision}
export interface Permissions extends PermissionReader {grant(change:Change):Mutation;revoke(change:Change):Mutation;history(request:object):{status:'denied'|'unavailable'}|{status:'ok';revision:number;records:readonly Event[]}}
type Mutation=CommitResult|{status:'denied';reason:string};
interface Event {intent:string;kind:'grant'|'revoke';scope:Scope;generation:number;command:string}
interface State {format:1;generation:number;events:Event[]}
const fields=['subject','entry','conversation','context','resource','action','target','relationship','relationshipGeneration'] as const;
function scopeOf(input:Scope):Scope {return Object.fromEntries(fields.map(k=>[k,input[k]])) as unknown as Scope;}
function valid(s:Scope):boolean{return fields.every(k=>k==='context'||k==='conversation'?s[k]===null||typeof s[k]==='string'&&(k==='context'||s[k]!.length>0):k==='relationshipGeneration'?Number.isSafeInteger(s[k])&&s[k]>0:typeof s[k]==='string'&&s[k].length>0);}
function same(a:Scope,b:Scope):boolean{return fields.every(k=>a[k]===b[k]);}
function exact(value:unknown,keys:readonly string[]):boolean{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;
 const actual=Object.keys(value);return actual.length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
}
function decode(value:Json,revision:number):State{
 if(!Number.isSafeInteger(revision)||revision<0)throw Error('incompatible permission revision');
 if(value===null){if(revision!==0)throw Error('incompatible permission state');return {format:1,generation:0,events:[]};}
 const s=value as unknown as State;
 if(!exact(s,['format','generation','events'])||s.format!==1||!Array.isArray(s.events)||
  s.generation!==revision||s.events.length!==revision)throw Error('incompatible permission state');
 const intents=new Set<string>();
 for(const [index,event] of s.events.entries()){
  if(!exact(event,['intent','kind','scope','generation','command'])||!exact(event.scope,fields)||!valid(event.scope)||
   !['grant','revoke'].includes(event.kind)||typeof event.intent!=='string'||!event.intent||event.intent.length>256||
   intents.has(event.intent)||event.generation!==index+1||
   event.command!==JSON.stringify({kind:event.kind,expectedRevision:index,scope:scopeOf(event.scope)}))throw Error('incompatible permission event');
  intents.add(event.intent);
 }
 return s;
}
/** Readiness only; no permission facts are projected and no state is repaired. */
export function inspectPermissionStore(store:Store):{status:'ready'|'unavailable'}{
 try{const snap=store.read();decode(snap.value,snap.revision);return {status:'ready'};}catch{return {status:'unavailable'};}
}
export function createPermissions(store:Store,trust:TrustPort):Permissions{
 const evaluate=(request:object):Decision=>{
 try{
 const current=trust.current(request);if(!current)return {status:'indeterminate',reason:'trusted_facts_missing'};
 // Capture primitive facts before invoking storage; dependencies cannot retarget a checked request.
 const f={...scopeOf(current),kind:current.kind,moduleEnabled:current.moduleEnabled,globalEnabled:current.globalEnabled,conversationEnabled:current.conversationEnabled,sourceAllowed:current.sourceAllowed,entryEnabled:current.entryEnabled};
 if(!valid(f))return {status:'indeterminate',reason:'trusted_facts_missing'};
 if(f.kind==='local'){
  if(f.conversation!==null||f.entryEnabled===undefined)return {status:'indeterminate',reason:'entry_policy_unresolved'};
  if(f.entryEnabled!==true)return {status:'deny',reason:'scope_disabled_or_restricted'};
 }else if(f.kind==='conversation'){
  if(f.conversation===null)return {status:'indeterminate',reason:'trusted_facts_missing'};
  if(f.conversationEnabled!==true)return {status:'deny',reason:'scope_disabled_or_restricted'};
 }else return {status:'indeterminate',reason:'entry_policy_unresolved'};
 if(f.moduleEnabled!==true||f.globalEnabled!==true||f.sourceAllowed!==true)return {status:'deny',reason:'scope_disabled_or_restricted'};
 const snap=store.read(),state=decode(snap.value,snap.revision);
 const latest=state.events.findLast(e=>same(e.scope,f));
 if(latest?.kind!=='grant')return {status:'deny',reason:'no_current_grant'};
 return Object.freeze({status:'allow',revision:snap.revision,generation:state.generation,scope:Object.freeze(scopeOf(f))});
 }catch{return {status:'indeterminate',reason:'dependency_unavailable'};}
 };
 const mutate=(kind:'grant'|'revoke',change:Change):Mutation=>{
 try{
 if(!trust.canManage(change))return {status:'denied',reason:'management_not_authorized'};
 if(!valid(change.scope)||!change.intent||!Number.isSafeInteger(change.expectedRevision)||change.expectedRevision<0)return {status:'denied',reason:'invalid_scope'};
 const snap=store.read(),state=decode(snap.value,snap.revision);
 if(!trust.canManage(change))return {status:'denied',reason:'management_not_authorized'};
 const scope=scopeOf(change.scope);const command=JSON.stringify({kind,expectedRevision:change.expectedRevision,scope});
 const prior=state.events.find(e=>e.intent===change.intent);
 if(prior){
 if(prior.command!==command)return {status:'not_committed',reason:'intent_conflict'};
 const result=store.query(change.intent)??{status:'unknown' as const,intent:change.intent};
 if(!trust.canManage(change))return {status:'denied',reason:'management_not_authorized'};
 return result;
 }
 if(snap.revision!==change.expectedRevision)return {status:'not_committed',reason:'revision_conflict'};
 const event:Event={intent:change.intent,kind,scope,generation:state.generation+1,command};
 const next:State={format:1,generation:event.generation,events:[...state.events,event]};
 return store.commit({intent:change.intent,expectedRevision:change.expectedRevision,value:next as unknown as Json});
 }catch{return {status:'unknown',intent:change.intent};}
 };
 return Object.freeze({evaluate,
 recheck(request:object,prior:Decision):Decision{
 const now=evaluate(request);if(now.status!=='allow')return now;
 if(prior.status!=='allow'||prior.generation!==now.generation||prior.revision!==now.revision||!same(prior.scope,now.scope))return {status:'deny',reason:'stale_authorization'};
 return now;
 },
 grant:(c:Change)=>mutate('grant',c),revoke:(c:Change)=>mutate('revoke',c),
 history(request:object){try{
 if(!trust.canReadHistory(request))return {status:'denied' as const};
 const snap=store.read(),events=decode(snap.value,snap.revision).events;
 if(!trust.canReadHistory(request))return {status:'denied' as const};
 return {status:'ok' as const,revision:snap.revision,records:structuredClone(events)};
 }catch{return {status:'unavailable' as const};}}
 });
}
