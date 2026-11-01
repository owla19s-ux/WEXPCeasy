import type {Store,Json,CommitResult} from '../../shared/src/index.js';
export type OperationPhase='prepared'|'observed'|'unknown';
export interface Operation {id:string;fingerprint:string;phase:OperationPhase;attempts:number;observations:Json[]}
interface State {format:1;operations:Operation[]}
export type OperationResult={status:'ok';operation:Operation;revision:number}|{status:'conflict'|'unavailable'|'unknown';reason:string};
function decode(v:Json):State{
 if(v===null)return {format:1,operations:[]};
 const s=v as unknown as State;
 if(s.format!==1||!Array.isArray(s.operations)||s.operations.some(o=>typeof o.id!=='string'||typeof o.fingerprint!=='string'||!Array.isArray(o.observations)||!Number.isSafeInteger(o.attempts)||!['prepared','observed','unknown'].includes(o.phase)))throw Error('invalid operation state');
 return s;
}
function copy<T>(v:T):T{return structuredClone(v);}
export function createOperationLedger(store:Store){
 function read():{revision:number;operations:Operation[]}{const s=store.read();return {revision:s.revision,operations:copy(decode(s.value).operations)};}
 function write(intent:string,revision:number,operations:Operation[]):CommitResult{return store.commit({intent,expectedRevision:revision,value:{format:1,operations:copy(operations)} as unknown as Json});}
 return Object.freeze({
  read,
  get(id:string):Operation|undefined{return read().operations.find(o=>o.id===id);},
  prepare(id:string,fingerprint:string):OperationResult{
   if(!id||!fingerprint)return {status:'conflict',reason:'invalid_request'};
   try{
    const snap=read(),prior=snap.operations.find(o=>o.id===id);
    if(prior)return prior.fingerprint===fingerprint?{status:'ok',operation:prior,revision:snap.revision}:{status:'conflict',reason:'intent_conflict'};
    const op:Operation={id,fingerprint,phase:'prepared',attempts:0,observations:[]};
    const result=write('operation:prepare:'+id,snap.revision,[...snap.operations,op]);
    if(result.status==='committed')return {status:'ok',operation:copy(op),revision:result.revision};
    return {status:result.status==='unknown'?'unknown':result.reason==='revision_conflict'?'conflict':'unavailable',reason:result.status==='unknown'?'commit_unknown':result.reason};
   }catch{return {status:'unavailable',reason:'store_failed'};}
  },
  observe(id:string,observationId:string,value:Json,phase:Exclude<OperationPhase,'prepared'>):OperationResult{
   if(!id||!observationId)return {status:'conflict',reason:'invalid_request'};
   try{
    const snap=read(),op=snap.operations.find(o=>o.id===id);
    if(!op)return {status:'conflict',reason:'not_prepared'};
    const intent='operation:observe:'+id+':'+observationId;
    const old=store.query(intent);
    if(old)return {status:'ok',operation:op,revision:snap.revision};
    const next:Operation={...op,phase,attempts:op.attempts+1,observations:[...op.observations,copy(value)]};
    const result=write(intent,snap.revision,snap.operations.map(o=>o.id===id?next:o));
    if(result.status==='committed')return {status:'ok',operation:copy(next),revision:result.revision};
    return {status:result.status==='unknown'?'unknown':result.reason==='revision_conflict'?'conflict':'unavailable',reason:result.status==='unknown'?'commit_unknown':result.reason};
   }catch{return {status:'unavailable',reason:'store_failed'};}
  }
 });
}
