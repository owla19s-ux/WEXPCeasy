import type {Json} from '../../../shared/src/index.js';
import type {Parameters,ModelObservation} from './model.js';
import {canonical,fail,parameterValue} from './model.js';

/** Build only verified wire parameters; preserve explicit source conflicts until A1 defines precedence. */
export function resolvePreparationParameters(
 connection:Parameters,model:Parameters,request:Parameters,
 observed:Pick<ModelObservation,'parameters'>
):{values:Record<string,Json>;sources:Record<string,string[]>;settings:Map<string,{setting:Parameters[string];sources:string[]}>}{
 const values:Record<string,Json>={},sources:Record<string,string[]>={};
 const settings=new Map<string,{setting:Parameters[string];sources:string[]}>();
 for(const [source,params] of [['connection',connection],['model',model],['request',request]] as const){
  for(const [name,setting] of Object.entries(params)){
   const prior=settings.get(name);
   if(prior){
    if(canonical(prior.setting)!==canonical(setting))fail('parameter_conflict');
    prior.sources.push(source);
   }else settings.set(name,{setting,sources:[source]});
  }
 }
 for(const [name,row] of settings){
  sources[name]=row.sources;
  if(row.setting.mode!=='value')continue;
  const spec=observed.parameters[name];
  if(!spec)fail('parameter_unsupported');
  if(!parameterValue(row.setting.value,spec))fail('parameter_invalid');
  values[name]=row.setting.value;
 }
 return {values,sources,settings};
}
