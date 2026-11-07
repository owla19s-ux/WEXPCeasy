import {opendir} from 'node:fs/promises';
import type {LocalHandle} from './file-capability.js';
import {createHash} from 'node:crypto';
import type {PermissionReader} from '../../../permissions/src/index.js';
import type {Json} from '../../../shared/src/index.js';
import type {AdapterAccess,ReadAdapter} from '../../src/index.js';
import {createSelectedBindings} from './selection-bindings.js';
import {validateLocalDirectoryTarget} from './target.js';
export interface LocalDirectoryCapability {handle:LocalHandle;check():boolean;release():Promise<void>;retain(cleanup:()=>Promise<void>):void}
export type LocalDirectoryResolver=(target:string,access?:AdapterAccess)=>Promise<LocalDirectoryCapability>;
export interface LocalDirectoryEntry {name:string;kind:'file'|'directory'|'symlink'|'other'}
export interface LocalDirectoryCursor {read():Promise<LocalDirectoryEntry|null>;close():Promise<void>}
export interface LocalDirectoryScanner {open(handle:LocalHandle):Promise<LocalDirectoryCursor>}
export interface LocalDirectoryReadOptions {maxEntries?:number;scanner?:LocalDirectoryScanner}
export function createLocalDirectoryBindings(permission:PermissionReader){
 const selected=createSelectedBindings(permission,{kind:'directory',validateTarget:validateLocalDirectoryTarget});
 const resolve:LocalDirectoryResolver=async(target,access)=>{
  const capability=await selected.resolve(target,'read',access);
  if(!capability.retain){await capability.release();throw Error('directory_cleanup_unavailable');}
  return {handle:capability.handle,check:capability.check,release:capability.release,retain:capability.retain};
 };
 return Object.freeze({register:selected.register,resolve,close:selected.close});
}
const pinnedScanner:LocalDirectoryScanner={async open(handle){
 if(process.platform==='win32'&&handle.readDirectory)return {read:()=>handle.readDirectory!(),async close(){}};
 // Linux descriptor aliases pin the selected directory. Other platforms require a validated native scanner.
 if(process.platform!=='linux')throw Error('directory_scanner_unavailable');
 const dir=await opendir('/proc/self/fd/'+handle.fd);
 return {async read(){
  const entry=await dir.read();if(!entry)return null;
  return {name:entry.name,kind:entry.isSymbolicLink()?'symlink':entry.isFile()?'file':entry.isDirectory()?'directory':'other'};
 },close:()=>dir.close()};
}};
/** Bounded shallow observation. Names do not authorize child-content access; symlinks are never followed.
 * A version identifies an observation, not an atomic snapshot against external writers.
 */
export function createLocalDirectoryReader(resolve:LocalDirectoryResolver,options:LocalDirectoryReadOptions={}):ReadAdapter {
 const limit=options.maxEntries??1000,scanner=options.scanner??pinnedScanner;
 if(!Number.isSafeInteger(limit)||limit<1||limit>10000)throw Error('invalid_directory_limit');
 return Object.freeze({id:'local',async read(target:string,signal:AbortSignal,access?:AdapterAccess):Promise<Json>{
  validateLocalDirectoryTarget(target);if(signal.aborted)throw Error('cancelled');
  const capability=await resolve(target,access);let cursor:LocalDirectoryCursor|undefined;
  try{
   if(!capability.check())throw Error('directory_access_unavailable');
   const before=await capability.handle.stat({bigint:true});if(!before.isDirectory())throw Error('directory_identity_unavailable');
   cursor=await scanner.open(capability.handle);
   const opened=cursor;capability.retain(()=>opened.close());
   const entries:LocalDirectoryEntry[]=[],names=new Set<string>();let complete=true;
   for(;;){
    if(signal.aborted||!capability.check())throw Error('directory_access_unavailable');
    const entry=await cursor.read();if(entry===null)break;
    if(entries.length===limit){complete=false;break;}
    if(!entry||typeof entry.name!=='string'||!entry.name||entry.name==='.'||entry.name==='..'||
     entry.name.includes('/')||entry.name.includes('\u0000')||entry.name.includes('\ufffd')||
     !['file','directory','symlink','other'].includes(entry.kind)||names.has(entry.name))throw Error('invalid_directory_entry');
    names.add(entry.name);entries.push({name:entry.name,kind:entry.kind});
   }
   const after=await capability.handle.stat({bigint:true});
   const identity=(s:typeof before)=>[s.dev,s.ino,s.mtimeNs,s.ctimeNs].map(String).join(':');
   if(identity(before)!==identity(after)||signal.aborted||!capability.check())throw Error('directory_observation_changed');
   entries.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
   const version=createHash('sha256').update(identity(after)+':'+JSON.stringify({entries,complete})).digest('hex');
   return {entries:entries as unknown as Json,complete,version,observedAt:new Date().toISOString()};
  }finally{
   await capability.release();
  }
 }});
}
