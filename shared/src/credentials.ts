import {isDeepStrictEqual} from 'node:util';
import type {Store,Json} from './storage.js';
export interface CredentialReference {readonly id:string;readonly revision:number}
export interface CredentialBinding {readonly connectionId:string;readonly endpoint:string;readonly provider:string}
/** Trusted platform encryption port. No plaintext or weak-storage fallback is permitted. */
export interface CredentialCipher {available():boolean;seal(secret:string):string;unseal(ciphertext:string):string}
export interface CredentialAccess {readonly action:'manage'|'use';readonly id:string;readonly binding:Readonly<CredentialBinding>}
interface Entry {id:string;revision:number;binding:CredentialBinding;ciphertext:string|null;revoked:boolean}
interface Receipt {intent:string;id:string;revision:number;storeRevision:number;operation:'put'|'revoke';binding:CredentialBinding}
interface State {format:2;domain:'credentials';entries:Entry[];intents:string[];receipts:Receipt[]}
export type CredentialReceipt={status:'committed';reference:CredentialReference;operation:'put'|'revoke';current:'current'|'superseded'|'revoked'}|{status:'unknown';intent:string}|{status:'denied'|'invalid'|'unavailable'};
export type CredentialMutation={status:'committed';reference:CredentialReference}|{status:'unknown';intent:string}|{status:'denied'|'invalid'|'conflict'|'unavailable'};
const exact=(value:unknown,keys:string[])=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype&&isDeepStrictEqual(Object.keys(value).sort(),[...keys].sort());
const id=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=4096;
function captureBinding(value:CredentialBinding):Readonly<CredentialBinding>{
 if(!exact(value,['connectionId','endpoint','provider'])||!id(value.connectionId)||!text(value.endpoint)||!text(value.provider))throw Error('invalid_binding');
 return Object.freeze({connectionId:value.connectionId,endpoint:value.endpoint,provider:value.provider});
}
/** Ciphertext-only custody. Trusted main/connector code consumes resolve; never expose it through UI IPC.
 * Lifetime of the Store belongs to the caller. Unknown writes are not retried here.
 */
export function createCredentialVault(store:Store,cipher:CredentialCipher,authorize:(request:object,access:CredentialAccess)=>boolean){
 function read(){
  const snapshot=store.read();
  const stored=snapshot.revision===0&&snapshot.value===null?{format:2,domain:'credentials',entries:[],intents:[],receipts:[]}:snapshot.value as unknown as State;
  const legacy=(stored as {format:number})?.format===1;
  if(!exact(stored,legacy?['format','domain','entries','intents']:['format','domain','entries','intents','receipts'])||(!legacy&&stored.format!==2)||stored.domain!=='credentials'||!Array.isArray(stored.entries)||!Array.isArray(stored.intents))throw Error('credential_store_unavailable');
  // Read-only legacy normalization; only a later confirmed mutation writes format 2.
  const state:State=legacy?{...stored,format:2,receipts:[]}:stored;
  const seen=new Set<string>();
  for(const entry of state.entries){
   if(!exact(entry,['id','revision','binding','ciphertext','revoked'])||!id(entry.id)||seen.has(entry.id)||!Number.isSafeInteger(entry.revision)||entry.revision<1||typeof entry.revoked!=='boolean'||(entry.revoked?entry.ciphertext!==null:typeof entry.ciphertext!=='string'||!entry.ciphertext||entry.ciphertext.length>262144))throw Error('credential_store_unavailable');
   captureBinding(entry.binding);seen.add(entry.id);
  }
  if(state.intents.some(intent=>!id(intent))||new Set(state.intents).size!==state.intents.length||state.intents.length!==snapshot.revision||state.entries.reduce((sum,entry)=>sum+entry.revision,0)!==snapshot.revision)throw Error('credential_store_unavailable');
  if(!Array.isArray(state.receipts))throw Error('credential_store_unavailable');
  const receiptIntents=new Set<string>();
  for(const receipt of state.receipts){
   const entry=state.entries.find(item=>item.id===receipt.id);
   if(!exact(receipt,['intent','id','revision','storeRevision','operation','binding'])||!id(receipt.intent)||receiptIntents.has(receipt.intent)||!entry||!Number.isSafeInteger(receipt.revision)||receipt.revision<1||receipt.revision>entry.revision||!Number.isSafeInteger(receipt.storeRevision)||receipt.storeRevision<1||state.intents[receipt.storeRevision-1]!==receipt.intent||!['put','revoke'].includes(receipt.operation))throw Error('credential_store_unavailable');
   captureBinding(receipt.binding);receiptIntents.add(receipt.intent);
  }
  return {snapshot,state};
 }
 read();
 const allowed=(request:object,action:CredentialAccess['action'],key:string,binding:Readonly<CredentialBinding>)=>{try{return authorize(request,Object.freeze({action,id:key,binding}))===true;}catch{return false;}};
 const available=()=>{try{return cipher.available()===true;}catch{return false;}};
 function commit(request:object,input:{id:string;intent:string;expectedRevision:number},binding:Readonly<CredentialBinding>,secret:string|undefined):CredentialMutation{
  if(!allowed(request,'manage',input.id,binding))return {status:'denied'};
  if(!id(input.id)||!id(input.intent)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||input.expectedRevision>=Number.MAX_SAFE_INTEGER)return {status:'invalid'};
  try{
   const {snapshot,state}=read(),prior=state.entries.find(item=>item.id===input.id);
   if(state.intents.includes(input.intent)||store.query(input.intent)||(prior?.revision??0)!==input.expectedRevision)return {status:'conflict'};
   if(secret===undefined&&!prior)return {status:'conflict'};
   let ciphertext:string|null=null;
   if(secret!==undefined){
    if(typeof secret!=='string'||!secret||secret.length>65536)return {status:'invalid'};
    if(!available())return {status:'unavailable'};
    const envelope=JSON.stringify({format:1,id:input.id,revision:input.expectedRevision+1,binding,secret});
    ciphertext=cipher.seal(envelope);
    if(typeof ciphertext!=='string'||!ciphertext||ciphertext===secret||ciphertext===envelope||ciphertext.length>262144||!available())return {status:'unavailable'};
   }
   const entry:Entry={id:input.id,revision:input.expectedRevision+1,binding:{...binding},ciphertext,revoked:secret===undefined};
   const next=structuredClone(state);const index=next.entries.findIndex(item=>item.id===input.id);
   if(index<0)next.entries.push(entry);else next.entries[index]=entry;next.intents.push(input.intent);
   next.receipts.push({intent:input.intent,id:entry.id,revision:entry.revision,storeRevision:snapshot.revision+1,operation:secret===undefined?'revoke':'put',binding:{...binding}});
   if(!allowed(request,'manage',input.id,binding))return {status:'denied'};
   const result=store.commit({intent:input.intent,expectedRevision:snapshot.revision,value:next as unknown as Json});
   return result.status==='committed'?{status:'committed',reference:{id:entry.id,revision:entry.revision}}:result.status==='unknown'?{status:'unknown',intent:input.intent}:result.reason==='revision_conflict'?{status:'conflict'}:{status:'unavailable'};
  }catch{return {status:'unavailable'};}
 }
 return Object.freeze({
  put(request:object,input:{id:string;intent:string;expectedRevision:number;binding:CredentialBinding;secret:string}):CredentialMutation{
   try{const binding=captureBinding(input.binding),captured={id:input.id,intent:input.intent,expectedRevision:input.expectedRevision},secret=input.secret;if(typeof secret!=='string')return {status:'invalid'};return commit(request,captured,binding,secret);}catch{return {status:'invalid'};}
  },
  revoke(request:object,input:{id:string;intent:string;expectedRevision:number}):CredentialMutation{
   try{const entry=read().state.entries.find(item=>item.id===input.id);if(!entry)return {status:'denied'};return commit(request,{id:input.id,intent:input.intent,expectedRevision:input.expectedRevision},captureBinding(entry.binding),undefined);}catch{return {status:'unavailable'};}
  },
  query(request:object,input:{id:string;intent:string;binding:CredentialBinding}):CredentialReceipt{
   try{
    const captured={id:input.id,intent:input.intent},binding=captureBinding(input.binding);
    if(!id(captured.id)||!id(captured.intent))return {status:'invalid'};
    if(!allowed(request,'manage',captured.id,binding))return {status:'denied'};
    const state=read().state,receipt=state.receipts.find(item=>item.intent===captured.intent);
    if(!receipt)return {status:'unknown',intent:captured.intent};
    if(receipt.id!==captured.id||!isDeepStrictEqual(receipt.binding,binding))return {status:'denied'};
    const proof=store.query(captured.intent);
    if(!allowed(request,'manage',captured.id,binding))return {status:'denied'};
    if(proof?.status!=='committed'||proof.revision!==receipt.storeRevision)return {status:'unknown',intent:captured.intent};
    const latest=read().state,again=latest.receipts.find(item=>item.intent===captured.intent),entry=latest.entries.find(item=>item.id===captured.id);
    if(!isDeepStrictEqual(receipt,again)||!entry||!allowed(request,'manage',captured.id,binding))return {status:'denied'};
    return {status:'committed',reference:{id:receipt.id,revision:receipt.revision},operation:receipt.operation,current:entry.revoked?'revoked':entry.revision===receipt.revision?'current':'superseded'};
   }catch{return {status:'unavailable'};}
  },
  resolve(request:object,reference:CredentialReference,input:CredentialBinding):{status:'ok';secret:string}|{status:'denied'|'unavailable'}{
   try{
    const binding=captureBinding(input),ref={id:reference.id,revision:reference.revision};
    if(!id(ref.id)||!Number.isSafeInteger(ref.revision)||ref.revision<1||!allowed(request,'use',ref.id,binding))return {status:'denied'};
    const entry=read().state.entries.find(item=>item.id===ref.id);
    if(!entry||entry.revoked||entry.revision!==ref.revision||!isDeepStrictEqual(entry.binding,binding))return {status:'denied'};
    if(!available())return {status:'unavailable'};
    const decoded=cipher.unseal(entry.ciphertext!);
    if(typeof decoded!=='string'||decoded.length>131072||!available())return {status:'unavailable'};
    const envelope=JSON.parse(decoded) as {format:number;id:string;revision:number;binding:CredentialBinding;secret:string};
    if(!exact(envelope,['format','id','revision','binding','secret'])||envelope.format!==1||envelope.id!==ref.id||envelope.revision!==ref.revision||!isDeepStrictEqual(envelope.binding,binding)||typeof envelope.secret!=='string'||!envelope.secret||envelope.secret.length>65536)return {status:'denied'};
    const secret=envelope.secret;
    const current=read().state.entries.find(item=>item.id===ref.id);
    if(!isDeepStrictEqual(entry,current)||!allowed(request,'use',ref.id,binding))return {status:'denied'};
    return {status:'ok',secret};
   }catch{return {status:'unavailable'};}
  }
 });
}
