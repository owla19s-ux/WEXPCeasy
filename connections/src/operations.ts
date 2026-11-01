import type {Store,Json,CommitResult} from '../../shared/src/index.js';
export type OperationPhase='prepared'|'dispatched'|'observed'|'unknown';
export interface Observation {id:string;phase:'observed'|'unknown';value:Json}
export interface Operation {id:string;fingerprint:string;phase:OperationPhase;attempts:number;observations:Observation[]}
interface State {format:1;operations:Operation[]}
export type OperationResult={status:'ok';operation:Operation;revision:number}|{status:'conflict'|'unavailable'|'unknown';reason:string};
const clone=<T>(v:T):T=>structuredClone(v);
function decode(v:Json):State {
 if(v===null)return {format:1,operations:[]};
 const s=v as unknown as State;
 if(s.format!==1||!Array.isArray(s.operations)||s.operations.some(o=>typeof o.id!=='string'||typeof o.fingerprint!=='string'||!Array.isArray(o.observations)||!Number.isSafeInteger(o.attempts)||!['prepared','dispatched','observed','unknown'].includes(o.phase)))throw Error('invalid_operation_state');
 return s;
}
function canonical(v:Json):string {
 if(v===null||typeof v!=='object')return JSON.stringify(v);
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k]!)).join(',')+'}';
}
export function createOperationLedger(store:Store){
 function read(){const s=store.read();return {revision:s.revision,operations:clone(decode(s.value).operations)};}
 function write(intent:string,revision:number,operations:Operation[]):CommitResult{return store.commit({intent,expectedRevision:revision,value:{format:1,operations:clone(operations)} as unknown as Json});}
 function result(commit:CommitResult,operation:Operation):OperationResult {
  return commit.status==='committed'?{status:'ok',operation:clone(operation),revision:commit.revision}:{status:commit.status==='unknown'?'unknown':commit.reason==='revision_conflict'?'conflict':'unavailable',reason:commit.status==='unknown'?'commit_unknown':commit.reason};
 }
 return Object.freeze({
  read,
  get(id:string){return read().operations.find(o=>o.id===id);},
  prepare(id:string,fingerprint:string):OperationResult {
   if(!id||!fingerprint)return {status:'conflict',reason:'invalid_request'};
   try{const s=read(),prior=s.operations.find(o=>o.id===id);
    if(prior)return prior.fingerprint===fingerprint?{status:'ok',operation:prior,revision:s.revision}:{status:'conflict',reason:'intent_conflict'};
    const op:Operation={id,fingerprint,phase:'prepared',attempts:0,observations:[]};
    return result(write('operation:prepare:'+id,s.revision,[...s.operations,op]),op);
   }catch{return {status:'unavailable',reason:'store_failed'};}
  },
  markDispatched(id:string):OperationResult {
   try{const s=read(),op=s.operations.find(o=>o.id===id);
    if(!op)return {status:'conflict',reason:'not_prepared'};
    if(op.phase!=='prepared')return {status:'conflict',reason:'already_dispatched'};
    const next:Operation={...op,phase:'dispatched',attempts:op.attempts+1};
    return result(write('operation:dispatch:'+id,s.revision,s.operations.map(o=>o.id===id?next:o)),next);
   }catch{return {status:'unavailable',reason:'store_failed'};}
  },
  observe(id:string,observationId:string,value:Json,phase:'observed'|'unknown'):OperationResult {
   if(!id||!observationId)return {status:'conflict',reason:'invalid_request'};
   try{const s=read(),op=s.operations.find(o=>o.id===id);
    if(!op)return {status:'conflict',reason:'not_prepared'};
    if(op.phase==='prepared')return {status:'conflict',reason:'not_dispatched'};
    const previous=op.observations.find(o=>o.id===observationId);
    if(previous)return previous.phase===phase&&canonical(previous.value)===canonical(value)?{status:'ok',operation:op,revision:s.revision}:{status:'conflict',reason:'observation_conflict'};
    const next:Operation={...op,phase,observations:[...op.observations,{id:observationId,phase,value:clone(value)}]};
    return result(write('operation:observe:'+id+':'+observationId,s.revision,s.operations.map(o=>o.id===id?next:o)),next);
   }catch{return {status:'unavailable',reason:'store_failed'};}
  }
 });
}
