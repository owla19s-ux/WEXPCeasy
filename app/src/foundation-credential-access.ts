import type {CredentialCipher,createCredentialVault} from '../../shared/src/index.js';
import type {Permissions,Decision} from '../../permissions/src/index.js';
type CredentialFacade=Pick<ReturnType<typeof createCredentialVault>,'put'|'query'|'revoke'>&{available():boolean};

/** The trusted credential management facade; no vault resolver is exposed to callers. */
export function createFoundationCredentialFacade(
 vault:ReturnType<typeof createCredentialVault>,
 cipher:CredentialCipher,
 permission:Pick<Permissions,'evaluate'>,
 management:WeakMap<object,Extract<Decision,{status:'allow'}>>,
 isStopping:()=>boolean
):CredentialFacade{
 const ready=(request:object,action:string,id:string)=>{
  if(isStopping())return;
  const decision=permission.evaluate(request);
  if(decision.status!=='allow'||decision.scope.resource!=='credentials'||decision.scope.action!==action||decision.scope.target!=='credential:'+id||decision.scope.context!==null)return;
  management.set(request,decision);return vault;
 };
 return Object.freeze({
  available(){try{return !isStopping()&&cipher.available()===true;}catch{return false;}},
  put(request:object,input:Parameters<CredentialFacade['put']>[1]){
   if(isStopping())return {status:'unavailable' as const};
   const selected=ready(request,'credential.write',input.id);if(!selected)return {status:'denied' as const};
   try{return selected.put(request,input);}finally{management.delete(request);}
  },
  query(request:object,input:Parameters<CredentialFacade['query']>[1]){
   if(isStopping())return {status:'unavailable' as const};
   const selected=ready(request,'credential.receipt',input.id);if(!selected)return {status:'denied' as const};
   try{return selected.query(request,input);}finally{management.delete(request);}
  },
  revoke(request:object,input:Parameters<CredentialFacade['revoke']>[1]){
   if(isStopping())return {status:'unavailable' as const};
   const selected=ready(request,'credential.revoke',input.id);if(!selected)return {status:'denied' as const};
   try{return selected.revoke(request,input);}finally{management.delete(request);}
  }
 });
}
