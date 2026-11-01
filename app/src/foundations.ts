import {lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {inspectRoot,directoryLock,openSqliteStore} from '../../shared/src/index.js';
import type {Root,RootLock,ManagedStore,Store,LockResult} from '../../shared/src/index.js';
import {createPermissions} from '../../permissions/src/index.js';
import type {TrustPort,Permissions} from '../../permissions/src/index.js';
import {createConnectionService} from '../../connections/src/index.js';
import type {ConnectionClient,ConfiguredDispatchAdapter} from '../../connections/src/index.js';
import {assemble} from './assembly.js';
import type {Host} from './assembly.js';
export interface FoundationOptions {dataRoot:string;expectedRootId?:string;trust:TrustPort;lock?:RootLock;openStore?:(path:string,namespace:string)=>ManagedStore;connections?:{adapters:readonly ConfiguredDispatchAdapter[];shutdownTimeoutMs?:number}}
export interface FoundationHost extends Host {readonly permissions?:Permissions;readonly connections?:ConnectionClient}
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
 let permissions:Permissions|undefined,connections:ConnectionClient|undefined;const release=lease.release;
 const open=options.openStore??openSqliteStore,orphans=new Set<ManagedStore>();
 const host=await assemble([
 {id:'shared',requires:[],async start(){
 const store=await openDomainStore(probe.root,'permissions.sqlite','permissions',open);
 return {value:Object.freeze({read:()=>store.read(),commit:(...a:Parameters<Store['commit']>)=>store.commit(...a),query:(intent:string)=>store.query(intent)}),stop:async()=>{store.close();}};
 }},
 {id:'permissions',requires:['shared'],async start(deps){
 permissions=createPermissions(deps['shared'] as Store,options.trust);
 return {value:Object.freeze({evaluate:permissions.evaluate,recheck:permissions.recheck}),stop:async()=>{permissions=undefined;}};
 }},
 ...(options.connections?[{id:'connections',requires:['permissions'],async start(deps:Readonly<Record<string,unknown>>){
  const stores=new Set<ManagedStore>();
  try{
   const configs=await openDomainStore(probe.root,'connections-configs.sqlite','connection-configs',open);stores.add(configs);
   const operations=await openDomainStore(probe.root,'connections-operations.sqlite','connection-operations',open);stores.add(operations);
   const service=createConnectionService(deps['permissions'] as Pick<Permissions,'evaluate'|'recheck'>,configs,operations,options.connections!.adapters,options.connections!);
   connections=Object.freeze({configs:service.configs,operations:service.operations,dispatch:service.dispatch});
   return {value:connections,stop:async()=>{
    if((await service.stop()).status!=='stopped')throw Error('connections_still_running');
    await closeStores(stores);connections=undefined;
   }};
  }catch(error){
   try{await closeStores(stores);}catch{for(const store of stores)orphans.add(store);}
   throw error;
  }
 }}]:[])
 ],{required:['shared','permissions'],timeoutMs:1000});
 let stopPromise:ReturnType<Host['stop']>|undefined;
 const stop=()=>{
 if(stopPromise)return stopPromise;
 const job=(async()=>{
 const result=await host.stop();
 // Keep root occupied when provider shutdown cannot confirm release.
 if(result.status==='incomplete')return result;
 try{await closeStores(orphans);}catch{return {status:'incomplete' as const,failed:['connections-storage']};}
 try{await release();return result;}catch{return {status:'incomplete' as const,failed:['root-lock']};}
 })();
 stopPromise=job;void job.then(result=>{if(result.status==='incomplete')stopPromise=undefined;});return job;
 };
 if(host.status==='failed')await stop();
 const current=permissions,currentConnections=connections;
 return Object.freeze({...host,...(current?{permissions:current}:{}),...(currentConnections?{connections:currentConnections}:{}),stop});
}
