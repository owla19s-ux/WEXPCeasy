import {createHash} from 'node:crypto';
import {mkdir,lstat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {directoryLock,inspectRoot} from '../../shared/src/index.js';
import type {LockResult} from '../../shared/src/index.js';
import type {AdapterAccess} from '../../connections/src/index.js';
import type {LocalFileIdentity} from '../../connections/local/src/index.js';
type Outcome={status:'observed'|'blocked'|'unknown';reason:string;operationId:string};
/** Technical cooperative OS lease, not an Operation ledger. All desktop Local writers serialize,
 * including aliases and independent public roots. Never infer stale ownership from time/PID.
 * A crash/unknown receipt leaves the directory occupied; only independent recovery may clear it.
 * The authoritative Connections ledger is also checked, including after a temp-directory cleanup.
 */
export function createLocalWriteCoordinator(directory=join(tmpdir(),'wex-local-writes-'+createHash('sha256').update(homedir()).digest('hex').slice(0,24))){
 const rootId='wex-local-write-coordination-v1';let active:object|undefined,busy=false;
 async function prepare(){
  let created=false;
  try{await mkdir(directory,{mode:0o700});created=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  const info=await lstat(directory);if(!info.isDirectory()||info.isSymbolicLink())throw Error('unsafe_coordination_directory');
  if(created)await writeFile(join(directory,'.wex-root.json'),JSON.stringify({format:1,id:rootId}),{flag:'wx',mode:0o600});
  const probe=await inspectRoot(directory,rootId);if(probe.status!=='available')throw Error('coordination_unavailable');
  return probe.root;
 }
 return Object.freeze({
  async acquire(identity:Readonly<LocalFileIdentity>,access?:AdapterAccess):Promise<LockResult>{
   if(!active||access?.request!==active||access.check()!==true||!/^\d+$/.test(identity.device)||!/^\d+$/.test(identity.inode))return {status:'unavailable'};
   // The enclosing dispatch owns release after the receipt, not the adapter's earlier handle cleanup.
   return {status:'acquired',release:async()=>{}};
  },
  async dispatch(request:object,id:string,unresolved:()=>boolean,execute:()=>Promise<Outcome>):Promise<Outcome>{
   const blocked=(reason:string):Outcome=>({status:'blocked',reason,operationId:id});
   if(busy)return blocked('local_write_in_progress');busy=true;
   let lease:Extract<LockResult,{status:'acquired'}>|undefined;
   try{
    if(unresolved())return blocked('local_write_requires_recovery');
    const acquired=await directoryLock.acquire(await prepare());
    if(acquired.status!=='acquired')return blocked('local_write_coordination_'+acquired.status);
    lease=acquired;active=request;
    if(unresolved()){await lease.release();lease=undefined;return blocked('local_write_requires_recovery');}
    const result=await execute();
    if(result.status!=='unknown'){await lease.release();lease=undefined;}
    return result;
   }catch{
    // Keep an acquired OS lease when the actual outcome or receipt cleanup is unconfirmed.
    return {status:lease?'unknown':'blocked',reason:'local_write_coordination_unavailable',operationId:id};
   }finally{active=undefined;busy=false;}
  }
 });
}
