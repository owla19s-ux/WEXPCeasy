import {open,realpath,stat} from 'node:fs/promises';
import type {FileHandle} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isAbsolute} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import type {PermissionReader,Decision} from '../../../permissions/src/index.js';
import type {LockResult} from '../../../shared/src/index.js';
import type {LocalFileResolver,LocalFileCapability} from './file-capability.js';

export interface LocalFileIdentity {readonly device:string;readonly inode:string}
export interface SelectedBindingOptions {
 readonly kind:'file'|'directory';readonly validateTarget:(target:string)=>void;
 /** Host resource coordinator. Required for writes; aliases of one inode receive the same identity.
  * A successful lease must cover conflicting WEX writers and unknown resource occupancy.
  */
 acquireWrite?:(identity:Readonly<LocalFileIdentity>)=>Promise<LockResult>;
}
type Allow=Extract<Decision,{status:'allow'}>;
type Binding={locator:string;path:string;identity:Readonly<LocalFileIdentity>};
/** Main-process selection bindings only. Registration grants no permission and never creates a file.
 * Rebind a different real object under a new target ID; no implicit path-based identity replacement.
 * Bindings are session-local: restart requires explicit registration and current authorization.
 */
export function createSelectedBindings(permission:PermissionReader,options:SelectedBindingOptions){
 const matches=(info:{isFile():boolean;isDirectory():boolean})=>options.kind==='file'?info.isFile():info.isDirectory();
 const files=new Map<string,Binding>(),pending=new Set<()=>Promise<void>>();
 let closing=false,closed=false,quarantined=false,active=0;
 function authorize(request:object,target:string,action?:'read'|'write'):Allow|undefined{
  try{const d=permission.evaluate(request);
   if(d.status==='allow'&&d.scope.resource==='local'&&d.scope.target===target&&
    (action?d.scope.action===action:['read','write'].includes(d.scope.action)))return d;
  }catch{/* no identity or permission evidence */}
 }
 function current(request:object,decision:Allow):boolean {
  try{return !closing&&!quarantined&&isDeepStrictEqual(permission.recheck(request,decision),decision);}catch{return false;}
 }
 function identity(value:{dev:bigint;ino:bigint}):Readonly<LocalFileIdentity>{
  if(value.ino<=0n||value.dev<0n)throw Error('local_identity_unavailable');
  return Object.freeze({device:String(value.dev),inode:String(value.ino)});
 }
 async function register(request:object,target:string,path:string):Promise<{status:'bound'|'denied'|'unavailable'|'conflict'}>{
  if(closing||quarantined)return {status:'unavailable'};
  const decision=authorize(request,target,options.kind==='directory'?'read':undefined);if(!decision)return {status:'denied'};
  try{
   options.validateTarget(target);
   if(typeof path!=='string'||!isAbsolute(path))return {status:'unavailable'};
   const canonical=await realpath(path),info=await stat(canonical,{bigint:true});
   if(!matches(info)||await realpath(path)!==canonical)return {status:'unavailable'};
   const selected=identity(info);
   if(!current(request,decision))return {status:closing||quarantined?'unavailable':'denied'};
   const prior=files.get(target);
   if(prior&&(prior.path!==canonical||!isDeepStrictEqual(prior.identity,selected)))return {status:'conflict'};
   if(!prior)files.set(target,{locator:path,path:canonical,identity:selected});
   return {status:'bound'};
  }catch{return {status:'unavailable'};}
 }
 const resolve:LocalFileResolver=async(target,mode,access)=>{
  options.validateTarget(target);
  if(closing||quarantined||!access||access.check()!==true||(mode!=='read'&&mode!=='write')||(options.kind==='directory'&&mode!=='read'))throw Error('local_capability_unavailable');
  const decision=authorize(access.request,target,mode);if(!decision)throw Error('local_capability_unavailable');
  const selected=files.get(target);if(!selected)throw Error('local_capability_unavailable');
  let handle:FileHandle|undefined,lease:Extract<LockResult,{status:'acquired'}>|undefined,released=false,cleanupPromise:Promise<void>|undefined;
  active++;const retained=new Set<()=>Promise<void>>();
  const check=()=>!released&&files.get(target)===selected&&access.check()===true&&current(access.request,decision);
  const cleanup=():Promise<void>=>{
   if(cleanupPromise)return cleanupPromise;
   const job=(async()=>{for(const cleanup of retained){await cleanup();retained.delete(cleanup);}if(handle){await handle.close();handle=undefined;}if(lease){await lease.release();lease=undefined;}pending.delete(cleanup);})();
   cleanupPromise=job;void job.catch(()=>{quarantined=true;cleanupPromise=undefined;});return job;
  };
  pending.add(cleanup);
  try{
   if(!check()||await realpath(selected.locator)!==selected.path)throw Error('local_capability_unavailable');
   if(mode==='write'){
    if(!options.acquireWrite)throw Error('local_write_lease_unavailable');
    const acquired=await options.acquireWrite(selected.identity);
    if(acquired.status!=='acquired')throw Error('local_write_lease_unavailable');
    lease=acquired;
   }
   if(!check()||typeof constants.O_NOFOLLOW!=='number')throw Error('local_capability_unavailable');
   const directoryFlag=options.kind==='directory'?constants.O_DIRECTORY:0;
   if(typeof directoryFlag!=='number')throw Error('local_capability_unavailable');
   handle=await open(selected.path,(mode==='write'?constants.O_RDWR:constants.O_RDONLY)|constants.O_NOFOLLOW|directoryFlag);
   const info=await handle.stat({bigint:true});
   if(!matches(info)||!isDeepStrictEqual(identity(info),selected.identity)||
    await realpath(selected.locator)!==selected.path||!check())throw Error('local_capability_unavailable');
   const file=handle;
   const capability:LocalFileCapability=Object.freeze({handle:file,exclusive:mode==='write'&&!!lease,check,
    retain(cleanup:()=>Promise<void>){if(released||typeof cleanup!=='function')throw Error('local_capability_released');retained.add(cleanup);},
    async release(){if(!released){released=true;active--;}await cleanup();}});
   return capability;
  }catch{
   released=true;active--;
   await cleanup();throw Error('local_capability_unavailable');
  }
 };
 async function close():Promise<void>{
  if(closed)return;closing=true;
  if(active)throw Error('local_access_in_flight');
  for(const cleanup of pending)await cleanup();
  files.clear();closed=true;
 }
 return Object.freeze({register,resolve,close});
}
