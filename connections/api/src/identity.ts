import {text} from './model.js';

export interface ProviderIdentity {
 providerResponseId?:string;
 providerModelId?:string;
}

export function observeProviderIdentity(identity:ProviderIdentity,value:Record<string,unknown>):void {
 for(const [wire,key] of [['id','providerResponseId'],['model','providerModelId']] as const){
  const observed=value[wire];
  if(observed===undefined)continue;
  if(!text(observed)||observed.length>256||/[\u0000-\u001f\u007f]/u.test(observed))
   throw Error('invalid_provider_identity');
  if(identity[key]!==undefined&&identity[key]!==observed)throw Error('provider_identity_changed');
  identity[key]=observed;
 }
}
