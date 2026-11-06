import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import type {Store,Json} from './storage.js';
import {captureTechnicalDiagnostic,createDiagnostics} from './diagnostics.js';
import type {Diagnostic} from './diagnostics.js';
export interface DiagnosticRecord {readonly sequence:number;readonly observedAt:string;readonly entry:Diagnostic}
export interface PersistedDiagnosticOptions {maxEntries?:number}
interface State {format:1;domain:'technical-diagnostics';records:DiagnosticRecord[]}
const exact=(value:unknown,keys:string[])=>!!value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.getPrototypeOf(value)===Object.prototype&&isDeepStrictEqual(Object.keys(value).sort(),[...keys].sort());
/** Technical code-only log. No business data, permission history or Operation receipts belong here.
 * Capacity exhaustion refuses append without deleting records. Unknown commits are never blindly retried.
 * Store ownership and lifetime remain with the trusted host.
 */
export function createPersistedDiagnostics(store:Store,options:PersistedDiagnosticOptions={}){
 const limit=options.maxEntries??1000;
 if(!Number.isSafeInteger(limit)||limit<1||limit>10000)throw Error('invalid_diagnostic_limit');
 function load(){
  const snapshot=store.read();
  const state:State=snapshot.revision===0&&snapshot.value===null?
   {format:1,domain:'technical-diagnostics',records:[]}:snapshot.value as unknown as State;
  if(!exact(state,['format','domain','records'])||state.format!==1||state.domain!=='technical-diagnostics'||!Array.isArray(state.records))throw Error('invalid_diagnostic_store');
  for(const [index,record] of state.records.entries()){
   if(!exact(record,['sequence','observedAt','entry'])||record.sequence!==index+1||
    typeof record.observedAt!=='string'||!Number.isFinite(Date.parse(record.observedAt))||
    new Date(record.observedAt).toISOString()!==record.observedAt||
    !isDeepStrictEqual(captureTechnicalDiagnostic(record.entry),record.entry))throw Error('invalid_diagnostic_record');
  }
  return {snapshot,state};
 }
 load();
 const sink=createDiagnostics(entry=>{
  const {snapshot,state}=load();
  if(state.records.length>=limit)throw Error('diagnostic_capacity_reached');
  const record:DiagnosticRecord={sequence:state.records.length+1,observedAt:new Date().toISOString(),entry};
  const next:State={format:1,domain:'technical-diagnostics',records:[...state.records,record]};
  const result=store.commit({intent:'diagnostic:'+randomUUID(),expectedRevision:snapshot.revision,value:next as unknown as Json});
  if(result.status!=='committed')throw Error('diagnostic_write_unconfirmed');
 });
 return Object.freeze({emit:sink.emit,
  read():{status:'ok';records:DiagnosticRecord[]}|{status:'unavailable'}{
   try{return {status:'ok',records:structuredClone(load().state.records)};}catch{return {status:'unavailable'};}
  }
 });
}
