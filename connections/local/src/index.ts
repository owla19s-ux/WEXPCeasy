import type {LocalHandle} from './file-capability.js';
import {createHash} from 'node:crypto';
import type {ConnectionConfig,ConfiguredDispatchAdapter,ReadAdapter,AdapterAccess} from '../../src/index.js';
import type {Json} from '../../../shared/src/index.js';

import type {LocalFileResolver} from './file-capability.js';
export type {LocalFileCapability,LocalFileResolver} from './file-capability.js';
import {validateLocalFileTarget as validateTarget} from './target.js';
export {localFileTarget} from './target.js';
export {createLocalFileBindings} from './bindings.js';
export type {LocalFileBindingOptions,LocalFileIdentity} from './bindings.js';
const limit=1024*1024;
const digest=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
async function snapshot(handle:LocalHandle):Promise<{bytes:Buffer;version:string}> {
 const before=await handle.stat({bigint:true});
 if(!before.isFile()||before.size<0n||before.size>BigInt(limit))throw Error('unsupported_local_file');
 const bytes=Buffer.alloc(Number(before.size));let offset=0;
 while(offset<bytes.length){
  const {bytesRead}=await handle.read(bytes,offset,bytes.length-offset,offset);
  if(bytesRead===0)throw Error('local_file_changed');offset+=bytesRead;
 }
 const after=await handle.stat({bigint:true});
 const identity=(stat:typeof before)=>[stat.dev,stat.ino,stat.size,stat.mtimeNs,stat.ctimeNs].map(String).join(':');
 if(identity(before)!==identity(after))throw Error('local_file_changed');
 return {bytes,version:digest(identity(after)+':'+digest(bytes))};
}
/** Use through createReadBoundary. No payload path is opened here. */
export function createLocalFileReader(resolve:LocalFileResolver):ReadAdapter {
 return Object.freeze({id:'local',async read(target:string,signal:AbortSignal,access?:AdapterAccess):Promise<Json>{
  validateTarget(target);if(signal.aborted)throw Error('cancelled');
  const capability=await resolve(target,'read',access);
  try{
   if(capability.check()!==true)throw Error('local_permission_unavailable');
   const value=await snapshot(capability.handle);
   const content=new TextDecoder('utf-8',{fatal:true}).decode(value.bytes);
   if(signal.aborted||capability.check()!==true)throw Error('local_permission_unavailable');
   return {content,version:value.version,size:value.bytes.length};
  }finally{await capability.release();}
 }});
}
/** Existing-file replacement only. No create/delete/rename, directory scan, process or Git execution.
 * The descriptor stays pinned if a path is renamed. Crashes/partial writes or uncertain receipts are unknown;
 * Connections records the original Operation and must not automatically retry. No external-process atomic CAS claim.
 */
export function createLocalFileAdapter(resolve:LocalFileResolver):ConfiguredDispatchAdapter {
 return Object.freeze({id:'local',version:'0.1.1',async execute(connection:Readonly<ConnectionConfig>,target:string,payload:Json,access?:AdapterAccess):Promise<Json>{
  validateTarget(target);
  if(connection.adapter!=='local'||connection.endpoint!=='local:files'||connection.credentialRef!==null||!connection.enabled)return {status:'rejected',reason:'local_connection_unavailable'};
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
   Object.keys(payload).sort().join(',')!=='content,expectedVersion,kind'||payload['kind']!=='replace'||
   typeof payload['content']!=='string'||typeof payload['expectedVersion']!=='string'||
   !/^[a-f0-9]{64}$/.test(payload['expectedVersion']))return {status:'rejected',reason:'invalid_local_file_update'};
  const bytes=Buffer.from(payload['content'],'utf8');
  if(bytes.length>limit||bytes.toString('utf8')!==payload['content'])return {status:'rejected',reason:'invalid_local_file_update'};
  const capability=await resolve(target,'write',access);
  try{
   if(capability.exclusive!==true||capability.check()!==true)return {status:'rejected',reason:'local_write_capability_unavailable'};
   const before=await snapshot(capability.handle);
   if(before.version!==payload['expectedVersion'])return {status:'conflict',reason:'version_conflict'};
   // Recheck after asynchronous preflight, immediately before the first actual write.
   if(capability.check()!==true)return {status:'rejected',reason:'local_write_capability_unavailable'};
   let offset=0;
   while(offset<bytes.length){
    const {bytesWritten}=await capability.handle.write(bytes,offset,bytes.length-offset,offset);
    if(bytesWritten===0)throw Error('local_write_outcome_unconfirmed');offset+=bytesWritten;
   }
   await capability.handle.truncate(bytes.length);await capability.handle.sync();
   const after=await snapshot(capability.handle);
   if(!after.bytes.equals(bytes))throw Error('local_write_outcome_unconfirmed');
   return {status:'written',version:after.version,size:bytes.length};
  }finally{await capability.release();}
 }});
}

export {localDirectoryTarget} from './target.js';
export {createLocalDirectoryBindings,createLocalDirectoryReader} from './directories.js';
export type {LocalDirectoryCapability,LocalDirectoryResolver,LocalDirectoryEntry,LocalDirectoryCursor,LocalDirectoryScanner,LocalDirectoryReadOptions} from './directories.js';
