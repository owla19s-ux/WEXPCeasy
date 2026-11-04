import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {inspectRoot,directoryLock} from '../../shared/src/index.js';
import type {Json,Store,ManagedStore,Root,RootLock,Snapshot} from '../../shared/src/index.js';
import type {PermissionReader,Decision} from '../../permissions/src/index.js';
import {Failure,fail,command,canonical,registry,body,allocate,expected,find,nonempty} from './model.js';
import type {SpaceCommand,SpaceQuery,Mutation,QueryResult,ProjectionScope,OwnerPort,Registry,Body,Intent,Association} from './model.js';
import {openStore} from './storage.js';
import type {OpenStore} from './storage.js';
export interface SpaceOptions {
 dataRoot:string;expectedRootId?:string;permission:PermissionReader;
 /** Trusted host derives an object-scoped request. Never bind this port to Renderer claims. */
 deriveRequest?:(parent:object,scope:ProjectionScope)=>object|undefined;
 owner?:OwnerPort;id?:()=>string;lock?:RootLock;openStore?:OpenStore;
}
export interface SpaceService {
 execute(request:object,input:SpaceCommand,signal?:AbortSignal):Promise<Mutation>;
 query(request:object,input:SpaceQuery):Promise<QueryResult>;
 close():Promise<void>;
}
export type SpaceOpenResult={status:'ready';service:SpaceService}|{status:'unavailable';reason:string};
type Allow=Extract<Decision,{status:'allow'}>;
function errorResult(e:unknown,intent:string):Exclude<Mutation,{status:'committed'}>{return e instanceof Failure?{status:e.status,reason:e.reason}:{status:'unknown',intent};}
function scope(c:SpaceCommand,root:Root):ProjectionScope {
 const context='contextId'in c?c.contextId:c.kind==='context.edit'?c.id:null;
 return {action:c.kind,context,target:c.kind==='context.create'?resolve(c.location):context?`context:${context}`:'id'in c?`${c.kind.split('.')[0]}:${c.id}`:c.kind==='group.create'?`space:${c.spaceId}`:`root:${root.id}`};
}
function authorize(p:PermissionReader,request:object,needed:ProjectionScope):Allow{
 let d:Decision;try{d=p.evaluate(request);}catch{return fail('permission_unavailable','unavailable');}
 if(d.status!=='allow')return fail(d.reason);
 if(d.scope.resource!=='space'||d.scope.action!==needed.action||d.scope.target!==needed.target||d.scope.context!==needed.context)return fail('scope_mismatch');
 return d;
}
function recheck(p:PermissionReader,r:object,d:Allow):void {
 let now:Decision;try{now=p.recheck(r,d);}catch{return fail('permission_unavailable','unavailable');}
 if(now.status!=='allow'||canonical(now)!==canonical(d))return fail(now.status==='allow'?'stale_authorization':now.reason);
}
function keyFor(d:Allow,intent:string,root:Root):string {
 return createHash('sha256').update(canonical({root:root.id,scope:d.scope,intent})).digest('hex');
}
/** All store mutations include business-intent records; prepared-but-unconfirmed work is observation-only on retry. */
function mutate<S extends Registry|Body>(store:Store,snap:Snapshot,state:S,key:string,c:SpaceCommand,p:PermissionReader,r:object,d:Allow,signal:AbortSignal|undefined,change:(next:S)=>{id:string;revision:number}):Mutation {
 const fingerprint=canonical(c),prior=state.intents.find(x=>x.key===key);
 if(prior){
  if(prior.command!==fingerprint)return fail('intent_conflict');recheck(p,r,d);
  if(prior.phase!=='committed'||!store.query(key+':apply'))return {status:'unknown',intent:c.intent,id:prior.id};
  return {status:'committed',id:prior.id,revision:prior.revision};
 }
 const next=structuredClone(state),changed=change(next),out={id:changed.id,revision:changed.revision};
 const record:Intent={key,command:fingerprint,...out,phase:'committed'};
 const prepared=structuredClone(state);prepared.intents.push({...record,phase:'prepared'});
 recheck(p,r,d);if(signal?.aborted)return fail('cancelled');
 const prep=store.commit({intent:key+':prepare',expectedRevision:snap.revision,value:prepared as unknown as Json});
 if(prep.status==='unknown')return {status:'unknown',intent:c.intent,id:out.id};
 if(prep.status!=='committed')return {status:'failed_no_commit',reason:prep.reason};
 next.intents.push(record);recheck(p,r,d);if(signal?.aborted)return fail('cancelled');
 const result=store.commit({intent:key+':apply',expectedRevision:prep.revision,value:next as unknown as Json});
 if(result.status==='unknown')return {status:'unknown',intent:c.intent,id:out.id};
 if(result.status!=='committed')return {status:'failed_no_commit',reason:result.reason};
 return {status:'committed',id:out.id,revision:out.revision};
}
function organization(state:Registry,c:SpaceCommand,id:()=>string):{id:string;revision:number}{
 switch(c.kind){
 case 'category.create':{const item={id:allocate(state,id),revision:1,name:c.name};state.categories.push(item);return item;}
 case 'category.edit':{const item=find(state.categories,c.id);expected(item,c.expectedRevision);item.name=c.name;item.revision++;return item;}
 case 'space.create':{if(c.categoryId)find(state.categories,c.categoryId);const item={id:allocate(state,id),revision:1,name:c.name,description:c.description??'',categoryId:c.categoryId??null};state.spaces.push(item);return item;}
 case 'space.edit':{const item=find(state.spaces,c.id);expected(item,c.expectedRevision);if(c.categoryId)find(state.categories,c.categoryId);item.name=c.name;if(c.description!==undefined)item.description=c.description;if(c.categoryId!==undefined)item.categoryId=c.categoryId;item.revision++;return item;}
 case 'group.create':{find(state.spaces,c.spaceId);const item={id:allocate(state,id),revision:1,name:c.name,spaceId:c.spaceId,order:state.groups.filter(g=>g.spaceId===c.spaceId).length};state.groups.push(item);return item;}
 case 'group.edit':{const item=find(state.groups,c.id);expected(item,c.expectedRevision);item.name=c.name;if(c.order!==undefined)item.order=c.order;item.revision++;return item;}
 default:return fail('unsupported_command');
 }
}
function contextChange(state:Body,c:SpaceCommand,id:()=>string):{id:string;revision:number}{
 switch(c.kind){
 case 'context.edit':{expected(state.context,c.expectedRevision);state.context.name=c.name;if(c.description!==undefined)state.context.description=c.description;state.context.revision++;return state.context;}
 case 'address.add':{const item={id:allocate(state,id),revision:1,name:c.name,address:c.address,notes:c.notes??'',purpose:c.purpose??'',status:'unverified' as const};state.resources.push(item);return item;}
 case 'address.edit':{const item=find(state.resources,c.id);expected(item,c.expectedRevision);Object.assign(item,{name:c.name,address:c.address,notes:c.notes??'',purpose:c.purpose??'',revision:item.revision+1});return item;}
 case 'primary.select':{expected(state.context,c.expectedRevision);if(c.id!==null)find(state.resources,c.id);state.context.primaryAddress=c.id;state.context.revision++;return state.context;}
 case 'association.add':case 'tool.add':{
 const values=c.kind==='tool.add'?state.tools:state.associations;
 if(values.some(x=>x.owner===c.owner&&x.targetType===c.targetType&&x.targetId===c.targetId))return fail('duplicate_target_unsupported');
 const item={id:allocate(state,id),revision:1,owner:c.owner,targetType:c.targetType,targetId:c.targetId,purpose:c.purpose};
 if(c.kind==='tool.add')state.tools.push({...item,enabled:true});else state.associations.push(item);return item;
 }
 case 'association.replace':{const item=find(state.associations,c.id);expected(item,c.expectedRevision);if(state.associations.some(x=>x.id!==c.id&&x.owner===c.owner&&x.targetType===c.targetType&&x.targetId===c.targetId))return fail('duplicate_target_unsupported');Object.assign(item,{owner:c.owner,targetType:c.targetType,targetId:c.targetId,purpose:c.purpose,revision:item.revision+1});return item;}
 case 'tool.set':{const item=find(state.tools,c.id);expected(item,c.expectedRevision);item.enabled=c.enabled;item.revision++;return item;}
 case 'address.remove':case 'association.remove':case 'tool.remove':{
 const values=c.kind==='address.remove'?state.resources:c.kind==='association.remove'?state.associations:state.tools;
 const item=find<Association|Body['resources'][number]>(values,c.id);expected(item,c.expectedRevision);values.splice(values.indexOf(item as never),1);
 if(c.kind==='address.remove'&&state.context.primaryAddress===c.id){state.context.primaryAddress=null;state.context.revision++;}
 return {id:item.id,revision:item.revision+1};
 }
 default:return fail('unsupported_command');
 }
}
export async function openSpaceService(options:SpaceOptions):Promise<SpaceOpenResult>{
 const probe=await inspectRoot(options.dataRoot,options.expectedRootId);if(probe.status!=='available')return {status:'unavailable',reason:probe.reason};
 const root=probe.root,lock=options.lock??directoryLock,id=options.id??randomUUID;
 let registryStore:ManagedStore|undefined;const lease=await lock.acquire(root).catch(()=>({status:'unavailable' as const}));
 if(lease.status!=='acquired')return {status:'unavailable',reason:'root_lock_unavailable'};
 try{registryStore=await openStore(root,'wex-space.sqlite','space-registry',true,options.openStore);registry(registryStore.read().value,root.id);}
 catch(e){try{registryStore?.close();await lease.release();}catch{/* uncertain lease retained */}return {status:'unavailable',reason:e instanceof Failure?e.reason:'storage_unavailable'};}
 const store=registryStore;let closing=false,closed=false,quarantined=false,storeClosed=false,tail=Promise.resolve(),closePromise:Promise<void>|undefined;const orphans=new Set<()=>Promise<void>>();
 function run<T>(work:()=>Promise<T>,unavailable:T):Promise<T>{if(closing||closed||quarantined)return Promise.resolve(unavailable);const job=tail.then(work);tail=job.then(()=>{},()=>{});return job;}
 async function registrySnapshot(){if((await inspectRoot(root.path,root.id)).status!=='available')return fail('root_changed','unavailable');const snap=store.read();return {snap,state:registry(snap.value,root.id)};}
 async function inContext<T>(location:string,rootId:string|undefined,create:boolean,work:(db:ManagedStore,contextRoot:Root)=>Promise<T>):Promise<T>{
 const probe=await inspectRoot(location,rootId);if(probe.status!=='available')return fail(probe.reason,'unavailable');
 if(probe.root.path===root.path)return fail('context_requires_separate_root');
 const lease=await lock.acquire(probe.root);if(lease.status!=='acquired')return fail('context_lock_unavailable','unavailable');
 let db:ManagedStore|undefined;const cleanup=async()=>{if(db){db.close();db=undefined;}await lease.release();orphans.delete(cleanup);};orphans.add(cleanup);
 try{db=await openStore(probe.root,'wex-context.sqlite','space-context',create,options.openStore);return await work(db,probe.root);}
 finally{try{await cleanup();}catch{quarantined=true;throw Error('context_release_unconfirmed');}}
 }
 async function create(request:object,c:Extract<SpaceCommand,{kind:'context.create'}>,d:Allow,key:string,signal:AbortSignal|undefined):Promise<Mutation>{
 const {snap,state}=await registrySnapshot(),fingerprint=canonical(c);let entry=state.contexts.find(x=>x.key===key);
 if(entry&&entry.command!==fingerprint)return fail('intent_conflict');
 if(entry){const current=await inspectRoot(c.location,entry.rootId);if(current.status!=='available'||current.root.path!==entry.location)return fail('creation_location_changed','unavailable');}
 if(!entry){
  const p=await inspectRoot(c.location);if(p.status!=='available')return fail(p.reason,'unavailable');
  if(state.contexts.some(x=>x.location===p.root.path))return fail('location_occupied');
  if(p.root.path===root.path)return fail('context_requires_separate_root');
  entry={id:allocate(state,id),location:p.root.path,rootId:p.root.id,phase:'pending',key,command:fingerprint};state.contexts.push(entry);
  recheck(options.permission,request,d);if(signal?.aborted)return fail('cancelled');
  const pending=store.commit({intent:key+':pending',expectedRevision:snap.revision,value:state as unknown as Json});
  if(pending.status==='unknown')return {status:'unknown',intent:c.intent,id:entry.id};
  if(pending.status!=='committed')return {status:'failed_no_commit',reason:pending.reason};
 }
 const registration=entry;
 const result=await inContext(registration.location,registration.rootId,registration.phase==='pending',async(db,contextRoot)=>{
  const snap=db.read();
  if(snap.value!==null){
   const b=body(snap.value,contextRoot.id,registration.id);const record=b.intents.find(x=>x.key===key);
   if(!record||record.command!==fingerprint||!db.query(key+':create'))return fail('identity_conflict','unavailable');
   return {status:'committed' as const,id:registration.id,revision:record.revision};
  }
  if(registration.phase==='ready')return fail('missing_data','unavailable');
  const next:Body={format:1,domain:'context',rootId:contextRoot.id,context:{id:registration.id,revision:1,name:c.name,description:c.description??'',config:{},primaryAddress:null},resources:[],associations:[],tools:[],intents:[{key,command:fingerprint,id:registration.id,revision:1,phase:'committed'}]};
  recheck(options.permission,request,d);if(signal?.aborted)return fail('cancelled');
  const write=db.commit({intent:key+':create',expectedRevision:snap.revision,value:next as unknown as Json});
  return write.status==='committed'?{status:'committed' as const,id:registration.id,revision:1}:write.status==='unknown'?{status:'unknown' as const,intent:c.intent,id:registration.id}:{status:'failed_no_commit' as const,reason:write.reason};
 });
 if(result.status!=='committed')return result;
 if(registration.phase==='ready'){recheck(options.permission,request,d);return result;}
 // Once the body committed, no later registry/permission failure may claim "no commit".
 try{
  recheck(options.permission,request,d);const latest=await registrySnapshot();const record=latest.state.contexts.find(x=>x.key===key);
  if(!record||record.id!==registration.id)return {status:'unknown',intent:c.intent,id:registration.id};
  record.phase='ready';const ready=store.commit({intent:key+':ready',expectedRevision:latest.snap.revision,value:latest.state as unknown as Json});
  return ready.status==='committed'?result:{status:'unknown',intent:c.intent,id:registration.id};
 }catch{return {status:'unknown',intent:c.intent,id:registration.id};}
 }
 async function verifyTarget(r:object,c:SpaceCommand):Promise<void>{
 if(c.kind!=='association.add'&&c.kind!=='association.replace'&&c.kind!=='tool.add')return;
 const valid=(c.owner==='AI'&&['role','agent'].includes(c.targetType))||(c.owner==='connections/api'&&['api','model'].includes(c.targetType))||(c.kind==='tool.add'&&c.owner==='connections'&&c.targetType==='tool');
 if(!valid)return fail('unsupported_target');if(!options.owner)return fail('owner_unavailable','unavailable');
 let observation;try{observation=await options.owner.resolve(r,{owner:c.owner,targetType:c.targetType,targetId:c.targetId});}catch{return fail('owner_unavailable','unavailable');}
 if(observation.status!=='available')return fail('owner_unavailable','unavailable');
 if(observation.owner!==c.owner||observation.targetId!==c.targetId||observation.targetType!==c.targetType||!nonempty(observation.sourceRevision)||!Number.isFinite(Date.parse(observation.observedAt)))return fail('owner_identity_mismatch','unavailable');
 }
 const service:SpaceService={
 execute(request,input,signal){
  let c:SpaceCommand;try{c=command(input);}catch(e){return Promise.resolve(errorResult(e,'invalid'));}
  return run(async()=>{
  const intent=c.intent;try{
   if(signal?.aborted)return fail('cancelled');
   const d=authorize(options.permission,request,scope(c,root)),key=keyFor(d,c.intent,root);
   if(c.kind==='context.create')return await create(request,c,d,key,signal);
   const {snap,state}=await registrySnapshot();
   if(c.kind.startsWith('category.')||c.kind.startsWith('space.')||c.kind.startsWith('group.')){
    if((c.kind==='space.create'||c.kind==='space.edit')&&c.categoryId){
     const wanted={action:'category.read',target:`category:${c.categoryId}`,context:null};const derived=options.deriveRequest?.(request,wanted);
     if(!derived)return fail('reference_unavailable');
     try{const a=authorize(options.permission,derived,wanted);if(a.scope.subject!==d.scope.subject||a.scope.entry!==d.scope.entry||a.scope.conversation!==d.scope.conversation||a.scope.relationship!==d.scope.relationship||a.scope.relationshipGeneration!==d.scope.relationshipGeneration)return fail('reference_unavailable');recheck(options.permission,derived,a);}catch{return fail('reference_unavailable');}
    }
    return mutate(store,snap,state,key,c,options.permission,request,d,signal,n=>organization(n,c,id));
   }
   const contextId='contextId'in c?c.contextId:c.kind==='context.edit'?c.id:fail('unsupported_command');
   const entry=find(state.contexts,contextId);if(entry.phase!=='ready')return fail('context_pending','unavailable');
   return await inContext(entry.location,entry.rootId,false,async(db,contextRoot)=>{
    const snap=db.read(),state=body(snap.value,contextRoot.id,contextId);
    // An exact replay needs only current permission to observe its own historical result, not a live owner.
    if(!state.intents.some(x=>x.key===key))await verifyTarget(request,c);
    return mutate(db,snap,state,key,c,options.permission,request,d,signal,n=>contextChange(n,c,id));
   });
  }catch(e){return errorResult(e,intent);}
 },{status:'unavailable',reason:'space_stopping_or_quarantined'});},
 query(request,input){
  try{input=structuredClone(input);}catch{return Promise.resolve({status:'rejected',reason:'invalid_query'});}
  return run(async()=>{
  try{
   if(!input||typeof input!=='object')return fail('invalid_query');
   if(input.kind==='context'){
    if(!nonempty(input.id))return fail('invalid_query');
    const d=authorize(options.permission,request,{action:'context.read',target:`context:${input.id}`,context:input.id});
    const {state}=await registrySnapshot(),entry=find(state.contexts,input.id);if(entry.phase!=='ready')return fail('context_pending','unavailable');
    return await inContext(entry.location,entry.rootId,false,async(db,contextRoot)=>{
     const s=body(db.read().value,contextRoot.id,input.id),associations:Association[]=[],tools:Body['tools']=[];
     // Owner projections are revalidated on every query, never cached or inferred from persisted selection.
     for(const [items,out] of [[s.associations,associations],[s.tools,tools]] as const){
      for(const item of items){
       recheck(options.permission,request,d);if(!options.owner)continue;let observation;try{observation=await options.owner.resolve(request,{owner:item.owner,targetType:item.targetType,targetId:item.targetId});}catch{continue;}
       if(observation.status==='available'&&observation.owner===item.owner&&observation.targetType===item.targetType&&observation.targetId===item.targetId&&nonempty(observation.sourceRevision)&&Number.isFinite(Date.parse(observation.observedAt)))(out as Association[]).push(structuredClone(item));
      }
     }
     recheck(options.permission,request,d);return {status:'ok' as const,value:{...structuredClone(s.context),resources:structuredClone(s.resources),associations,tools}};
    });
   }
   if(input.kind!=='organization'||!['category','space','group'].includes(input.entity))return fail('invalid_query');
   const d=authorize(options.permission,request,{action:'organization.list',target:`root:${root.id}`,context:null});
   const {state}=await registrySnapshot();const items=input.entity==='category'?state.categories:input.entity==='space'?state.spaces:state.groups;
   const visible:typeof items=[];
   for(const item of items){
    const target={action:`${input.entity}.read`,target:`${input.entity}:${item.id}`,context:null};const derived=options.deriveRequest?.(request,target);
    if(!derived)continue;
    try{const a=authorize(options.permission,derived,target);if(a.scope.subject!==d.scope.subject||a.scope.entry!==d.scope.entry||a.scope.conversation!==d.scope.conversation||a.scope.relationship!==d.scope.relationship||a.scope.relationshipGeneration!==d.scope.relationshipGeneration)continue;recheck(options.permission,derived,a);
     const projected=structuredClone(item);
     const ref='categoryId'in projected?projected.categoryId:'spaceId'in projected?projected.spaceId:null;
     if(ref){const kind='categoryId'in projected?'category':'space';const wanted={action:`${kind}.read`,target:`${kind}:${ref}`,context:null};const linked=options.deriveRequest?.(request,wanted);let readable=false;
      try{if(linked){const check=authorize(options.permission,linked,wanted);readable=check.scope.subject===d.scope.subject&&check.scope.entry===d.scope.entry&&check.scope.conversation===d.scope.conversation&&check.scope.relationship===d.scope.relationship&&check.scope.relationshipGeneration===d.scope.relationshipGeneration;recheck(options.permission,linked,check);}}catch{readable=false;}
      if(!readable){if('categoryId'in projected)projected.categoryId=null;else continue;}
     }
     (visible as typeof item[]).push(projected);}catch{/* omit inaccessible projection, including its existence */}
   }
   recheck(options.permission,request,d);return {status:'ok' as const,value:visible};
  }catch(e){return e instanceof Failure?errorResult(e,'query'):{status:'unavailable',reason:'query_dependency_unavailable'};}
 },{status:'unavailable',reason:'space_stopping_or_quarantined'});},
 close(){
  if(closed)return Promise.resolve();if(closePromise)return closePromise;closing=true;
  const job=(async()=>{await tail;for(const cleanup of orphans)await cleanup();if(!storeClosed){store.close();storeClosed=true;}await lease.release();closed=true;})();
  closePromise=job;void job.catch(()=>{closePromise=undefined;});return job;
 }
 };
 return {status:'ready',service:Object.freeze(service)};
}
