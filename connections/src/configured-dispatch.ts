import type {PermissionReader} from '../../permissions/src/index.js';
import type {Json} from '../../shared/src/index.js';
import type {ConnectionConfig,createConnectionConfigs} from './config.js';
import type {createOperationLedger,OperationConnection} from './operations.js';
import {createDispatchBoundary} from './dispatch.js';
import type {DispatchResult} from './dispatch.js';

export interface ConfiguredDispatchAdapter {
 readonly id:string;
 readonly version:string;
 execute(connection:Readonly<ConnectionConfig>,target:string,payload:Json):Promise<Json>;
}
/** Trusted host entry: configuration is inspected only after target authorization. */
export function createConfiguredDispatchBoundary(permission:PermissionReader,ledger:ReturnType<typeof createOperationLedger>,configs:ReturnType<typeof createConnectionConfigs>,adapter:ConfiguredDispatchAdapter){
 return Object.freeze({async dispatch(request:object,id:string,connectionId:string,expectedRevision:number,target:string,fingerprint:string,payload:Json):Promise<DispatchResult>{
  const blocked=(reason:string):DispatchResult=>({status:'blocked',reason,operationId:id});
  if(typeof connectionId!=='string'||!connectionId||!Number.isSafeInteger(expectedRevision)||expectedRevision<1)return blocked('invalid_request');
  let capturedPayload:Json;
  try{capturedPayload=structuredClone(payload);}catch{return blocked('invalid_payload');}
  try{
   const decision=permission.evaluate(request);
   if(decision.status!=='allow')return blocked('authorization_'+decision.status);
   if(decision.scope.resource!==adapter.id||decision.scope.target!==target||decision.scope.action!=='write')return blocked('scope_mismatch');
   const snapshot=configs.read();
   if(snapshot.revision!==expectedRevision)return blocked('config_revision_conflict');
   const config=snapshot.items.find(c=>c.id===connectionId);
   if(!config)return blocked('connection_missing');
   if(!config.enabled)return blocked('connection_disabled');
   if(config.adapter!==adapter.id)return blocked('adapter_mismatch');
   const version=adapter.version;
   if(typeof version!=='string'||!version)return blocked('adapter_version_missing');
   const captured=Object.freeze(structuredClone(config));
   const connection:OperationConnection={connectionId,configRevision:snapshot.revision,adapterId:adapter.id,adapterVersion:version,endpoint:config.endpoint};
   const check=()=>{
    const current=configs.read();
    const item=current.items.find(c=>c.id===connectionId);
    return current.revision===connection.configRevision&&adapter.id===connection.adapterId&&adapter.version===connection.adapterVersion&&!!item&&item.enabled&&item.adapter===captured.adapter&&item.endpoint===captured.endpoint&&item.credentialRef===captured.credentialRef;
   };
   return await createDispatchBoundary(permission,ledger,{id:adapter.id,execute:(target,value)=>adapter.execute(captured,target,value)},{connection,check}).dispatch(request,id,target,fingerprint,capturedPayload);
  }catch{return {status:'unknown',reason:'dependency_unavailable',operationId:id};}
 }});
}
