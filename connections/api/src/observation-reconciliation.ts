import type {ModelObservation} from './model.js';
import {fail} from './model.js';

/** Reconcile a text/stream probe with existing verified capability evidence.
 * A narrow probe must not erase provider parameters, limits or other verified capabilities.
 */
export function reconcileTextProbeObservation(
 observed:ModelObservation,prior:ModelObservation|null,connectionRevision:number,probeOperationId:string
):ModelObservation{
 if(!prior||prior.connectionRevision!==connectionRevision)return observed;
 if(prior.modalities?.text?.input==='unsupported'||prior.modalities?.text?.output==='unsupported'){
  fail('probe_would_replace_verified_evidence');
 }
 const losesCapability=(Object.keys(prior.capabilities) as Array<keyof typeof prior.capabilities>).some(key=>{
  const value=prior.capabilities[key];
  return (value==='supported'||value==='unsupported')&&observed.capabilities[key]!==value;
 });
 const confirmsStream=observed.capabilities.stream==='supported'
  &&prior.capabilities.stream!=='unsupported'
  &&prior.capabilities.text!=='unsupported';
 if(confirmsStream){
  return {...prior,capabilities:{...prior.capabilities,text:'supported',stream:'supported'},
   streamProbe:{operationId:probeOperationId,observedAt:observed.observedAt}};
 }
 if(losesCapability||Object.keys(prior.parameters).length||Object.keys(prior.limits??{}).length){
  fail('probe_would_replace_verified_evidence');
 }
 return prior.modalities?{...observed,modalities:prior.modalities}:observed;
}
