import {lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {inspectRoot,directoryLock,openSqliteStore} from '../../shared/src/index.js';
import type {Root,RootLock,ManagedStore,Store,LockResult} from '../../shared/src/index.js';
import {createPermissions} from '../../permissions/src/index.js';
import type {TrustPort,Permissions} from '../../permissions/src/index.js';
import {createApiService,createApiTransport} from '../../connections/api/src/index.js';
import type {ApiService,ApiOptions} from '../../connections/api/src/index.js';
import {createOperationLedger} from '../../connections/src/index.js';
import {createConnectionService} from '../../connections/src/index.js';
import type {ConnectionClient,ConfiguredDispatchAdapter} from '../../connections/src/index.js';
import {openSpaceService} from '../../space/src/index.js';
import type {SpaceService,SpaceOptions} from '../../space/src/index.js';
import {createLocalEntries} from './local-entries.js';
import type {LocalEntryOptions,LocalEntryClient} from './local-entries.js';
import {assemble} from './assembly.js';
import type {Host} from './assembly.js';
export type FoundationApiClient=Pick<ApiService,'execute'|'query'|'prepare'|'resolve'>&Pick<ReturnType<typeof createApiTransport>,'send'>;
export interface FoundationOptions {api?:ApiOptions;dataRoot:string;expectedRootId?:string;trust:TrustPort;lock?:RootLock;openStore?:(path:string,namespace:string)=>ManagedStore;connections?:{adapters:readonly ConfiguredDispatchAdapter[];shutdownTimeoutMs?:number};local?:LocalEntryOptions;space?:Pick<SpaceOptions,'owner'|'deriveRequest'|'id'>}
export interface FoundationHost extends Host {readonly api?:FoundationApiClient;readonly permissions?:Permissions;readonly connections?:ConnectionClient;readonly space?:SpaceService;readonly local?:LocalEntryClient}
async function openDomainStore(root:Root,name:string,namespace:string,open:(path:string,namespace:string)=>ManagedStore):Promise<ManagedStore>{
 for(const suffix of ['', '-journal','-wal','-shm']){
  try{const info=await lstat(join(root.path,name+suffix));if(info.isSymbolicLink()||!info.isFile())throw Error('unsafe store path');}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 }
 if((await inspectRoot(root.path,root.id)).status!=='available')throw Error('root changed');
 return open(join(root.path,name),namespace);
}
async function closeStores(stores:Set<ManagedStore>):Promise<void>{
 let failed=false;
 for(const store of stores){try{store.close();stores.delete(store);}catch{failed=true;}}
 if(failed)throw Error('store_close_unconfirmed');
}
/** No business registry is exposed; callers are trusted main-process code, not Renderer/IPC. */
export async function startFoundations(options:FoundationOptions):Promise<FoundationHost>{
 const probe=await inspectRoot(options.dataRoot,options.expectedRootId);
 if(probe.status!=='available')return Object.freeze({status:'failed',diagnostics:[{module:'shared',reason:'initialization_failed' as const}],stop:async()=>({status:'stopped' as const,failed:[]})});
 let lease:LockResult;
 try{lease=await (options.lock??directoryLock).acquire(probe.root);}catch{lease={status:'unavailable'};}
 if(lease.status!=='acquired')return Object.freeze({status:'failed',diagnostics:[{module:'shared',reason:'initialization_failed' as const}],stop:async()=>({status:'stopped' as const,failed:[]})});
 let api:FoundationApiClient|undefined,apiService:ApiService|undefined,apiTransport:ReturnType<typeof createApiTransport>|undefined,apiLedger:ReturnType<typeof createOperationLedger>|undefined;
 let permissions:Permissions|undefined,connections:ConnectionClient|undefined,space:SpaceService|undefined;const release=lease.release;
 const open=options.openStore??openSqliteStore,orphans=new Set<ManagedStore>(),spaceOrphans=new Set<ManagedStore>(),apiOrphans=new Set<ManagedStore>();
 const local=options.local?createLocalEntries(options.local):undefined;let stopping=false,rootActive=true;
 const trust:TrustPort={
  current(request){if(stopping)return;if(local?.owns(request))return local.current(request);const facts=options.trust.current(request);return local&&facts?.kind==='local'?undefined:facts;},
  canManage(change){return !stopping&&options.trust.canManage(change);},
  canReadHistory(request){return !stopping&&options.trust.canReadHistory(request);}
 };
 // Space borrows only this host's acquired public-root lease; Context roots still acquire real locks.
 const spaceLock:RootLock={async acquire(root){
  if(root.path===probe.root.path&&root.id===probe.root.id)return rootActive?{status:'acquired',release:async()=>{}}:{status:'unavailable'};
  return (options.lock??directoryLock).acquire(root);
 }};
 const host=await assemble([
 {id:'shared',requires:[],async start(){
 const store=await openDomainStore(probe.root,'permissions.sqlite','permissions',open);
 return {value:Object.freeze({read:()=>store.read(),commit:(...a:Parameters<Store['commit']>)=>store.commit(...a),query:(intent:string)=>store.query(intent)}),stop:async()=>{store.close();}};
 }},
 {id:'permissions',requires:['shared'],async start(deps){
 permissions=createPermissions(deps['shared'] as Store,trust);
 return {value:Object.freeze({evaluate:permissions.evaluate,recheck:permissions.recheck}),stop:async()=>{permissions=undefined;}};
 }},
 ...(options.space?[{id:'space',requires:['permissions'],async start(deps:Readonly<Record<string,unknown>>){
  const stores=new Set<ManagedStore>();
  const trackedOpen:NonNullable<SpaceOptions['openStore']>=(path,namespace)=>{
   const db=open(path,namespace);const tracked:ManagedStore={...db,close(){db.close();stores.delete(tracked);}};stores.add(tracked);return tracked;
  };
  try{
   const opened=await openSpaceService({...options.space,dataRoot:probe.root.path,expectedRootId:probe.root.id,permission:deps['permissions'] as Pick<Permissions,'evaluate'|'recheck'>,lock:spaceLock,openStore:trackedOpen,
    ...(options.space!.deriveRequest?{deriveRequest:options.space!.deriveRequest}:local?{deriveRequest:(parent,scope)=>local.client.derive(parent,scope)}:{})});
   if(opened.status!=='ready')throw Error('space_unavailable');space=opened.service;const service=space;
   return {value:service,stop:async()=>{await service.close();await closeStores(stores);space=undefined;}};
  }catch(error){try{await closeStores(stores);}catch{for(const db of stores)spaceOrphans.add(db);}throw error;}
 }}]:[]),
 ...((options.connections||options.api)?[{id:'connections',requires:['permissions'],async start(deps:Readonly<Record<string,unknown>>){
  const stores=new Set<ManagedStore>();
  try{
   const configs=await openDomainStore(probe.root,'connections-configs.sqlite','connection-configs',open);stores.add(configs);
   const operations=await openDomainStore(probe.root,'connections-operations.sqlite','connection-operations',open);stores.add(operations);
   const service=createConnectionService(deps['permissions'] as Pick<Permissions,'evaluate'|'recheck'>,configs,operations,options.connections?.adapters??[],options.connections??{});
   apiLedger=createOperationLedger(operations);
   connections=Object.freeze({configs:service.configs,operations:service.operations,dispatch:service.dispatch});
   return {value:connections,stop:async()=>{
    if((await service.stop()).status!=='stopped')throw Error('connections_still_running');
    await closeStores(stores);connections=undefined;
   }};
  }catch(error){
   try{await closeStores(stores);}catch{for(const store of stores)orphans.add(store);}
   throw error;
  }
 }}]:[]),
 ...(options.api?[{id:'api',requires:['permissions','connections'],async start(deps:Readonly<Record<string,unknown>>){
  const stores=new Set<ManagedStore>();
  try{
   const store=await openDomainStore(probe.root,'api-configurations.sqlite','api-configurations',open);stores.add(store);
   const permission=deps['permissions'] as Pick<Permissions,'evaluate'|'recheck'>;
   const derive=options.api!.deriveRequest??(local?((parent:object,scope:{action:string;target:string;context:string|null})=>local.client.derive(parent,scope)):undefined);
   const service=createApiService(store,permission,{...options.api,...(derive?{deriveRequest:derive}:{})});
   if(!apiLedger)throw Error('operation_ledger_unavailable');
   const transport=createApiTransport(service,permission,apiLedger,{derivePrepareRequest(parent){
    const decision=permission.evaluate(parent);if(decision.status!=='allow')return;
    return derive?.(parent,{action:'request.prepare',target:decision.scope.target,context:decision.scope.context});
   }});
   apiService=service;apiTransport=transport;
   api=Object.freeze({execute:service.execute,query:service.query,prepare:service.prepare,resolve:service.resolve,send:transport.send});
   return {value:api,stop:async()=>{service.stop();await transport.stop();await closeStores(stores);api=undefined;}};
  }catch(error){try{await closeStores(stores);}catch{for(const db of stores)apiOrphans.add(db);}throw error;}
 }}]:[])
 ],{required:['shared','permissions'],timeoutMs:1000});
 let stopPromise:ReturnType<Host['stop']>|undefined;
 const stop=()=>{
 stopping=true;local?.stop();apiService?.stop();void apiTransport?.stop();
 if(stopPromise)return stopPromise;
 const job=(async()=>{
 const result=await host.stop();
 // Keep root occupied when provider shutdown cannot confirm release.
 if(result.status==='incomplete')return result;
 try{await closeStores(orphans);}catch{return {status:'incomplete' as const,failed:['connections-storage']};}
 try{await closeStores(apiOrphans);}catch{return {status:'incomplete' as const,failed:['api-storage']};}
 try{await closeStores(spaceOrphans);}catch{return {status:'incomplete' as const,failed:['space-storage']};}
 try{await release();rootActive=false;return result;}catch{return {status:'incomplete' as const,failed:['root-lock']};}
 })();
 stopPromise=job;void job.then(result=>{if(result.status==='incomplete')stopPromise=undefined;});return job;
 };
 if(host.status==='failed')await stop();
 const current=permissions,currentConnections=connections,currentSpace=space,currentApi=api;
 return Object.freeze({...host,...(currentApi?{api:currentApi}:{}),...(current?{permissions:current}:{}),...(currentConnections?{connections:currentConnections}:{}),...(currentSpace?{space:currentSpace}:{}),...(local&&host.status!=='failed'?{local:local.client}:{}),stop});
}
