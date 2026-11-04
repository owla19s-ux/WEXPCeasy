import type {Store,Root} from '../../shared/src/index.js';
import {Failure,body,command,canonical,fail,nonempty} from './model.js';
import type {Body,Intent,Registry} from './model.js';
export interface ExistingContext {state:Body;creation:Intent}
/** Observe an existing v1 body and its original confirmed creation; no writes or ID allocation. */
export function readExistingContext(store:Store,root:Root):ExistingContext {
 try{
  const snap=store.read();
  const value=snap.value as unknown as {context?:{id?:unknown}}|null;
  if(!value||!nonempty(value.context?.id))return fail('missing_context_identity','unavailable');
  const state=body(snap.value,root.id,value.context.id);
  const creations=state.intents.filter(i=>i.phase==='committed'&&i.id===state.context.id&&i.revision===1&&store.query(i.key+':create')?.revision===1);
  if(creations.length!==1)return fail('creation_proof_missing_or_ambiguous','unavailable');
  const creation=creations[0]!;let original;
  try{original=command(JSON.parse(creation.command) as unknown);}catch{return fail('corrupt_creation_proof','unavailable');}
  if(original.kind!=='context.create'||canonical(original)!==creation.command)return fail('corrupt_creation_proof','unavailable');
  return {state,creation};
 }catch(e){if(e instanceof Failure)throw e;return fail('context_unreadable','unavailable');}
}
/** Repairs only the selected body's locator. Different locations/identities are never merged. */
export function attachRegistration(registry:Registry,existing:ExistingContext,root:Root):{id:string;revision:number}{
 const {state,creation}=existing,id=state.context.id;
 if([...registry.categories,...registry.spaces,...registry.groups].some(x=>x.id===id))return fail('identity_conflict');
 const current=registry.contexts.find(x=>x.id===id);
 if(registry.contexts.some(x=>x.id!==id&&(x.location===root.path||x.key===creation.key)))return fail('identity_conflict');
 if(current){
  if(current.location!==root.path||current.rootId!==root.id||current.key!==creation.key||current.command!==creation.command)return fail('identity_conflict');
  current.phase='ready';
 }else registry.contexts.push({id,location:root.path,rootId:root.id,phase:'ready',key:creation.key,command:creation.command});
 return {id,revision:state.context.revision};
}
