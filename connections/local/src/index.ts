import {createHash} from 'node:crypto';
import type {FileHandle} from 'node:fs/promises';
import type {ConnectionConfig,ConfiguredDispatchAdapter,ReadAdapter} from '../../src/index.js';
import type {Json} from '../../../shared/src/index.js';

/** Trusted host capability, never an object supplied by Renderer/model input.
 * The host opens the authorized exact file, pins its identity, and supplies current permission recheck.
 * Writes additionally require exclusive WEX resource coordination; this is not a lock on external processes.
 * release owns handle/lease cleanup. Missing or uncertain host evidence must fail closed.
 */
export interface LocalFileCapability {
 handle:FileHandle;exclusive:boolean;check():boolean;release():Promise<void>;
}
export type LocalFileResolver=(target:string,mode:'read'|'write')=>Promise<LocalFileCapability>;
const limit=1024*1024;
export function localFileTarget(id:string):string {
 if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(id))throw Error('invalid_local_file_target');
 return 'local-file:'+id;
}
function validateTarget(target:string):void {
 if(typeof target!=='string'||!target.startsWith('local-file:')||localFileTarget(target.slice(11))!==target)throw Error('invalid_local_file_target');
}
const digest=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
async function snapshot(handle:FileHandle):Promise<{bytes:Buffer;version:string}> {
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
 return Object.freeze({id:'local',async read(target:string,signal:AbortSignal):Promise<Json>{
  validateTarget(target);if(signal.aborted)throw Error('cancelled');
  const capability=await resolve(target,'read');
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
 return Object.freeze({id:'local',version:'0.1.1',async execute(connection:Readonly<ConnectionConfig>,target:string,payload:Json):Promise<Json>{
  validateTarget(target);
  if(connection.adapter!=='local'||connection.endpoint!=='local:files'||connection.credentialRef!==null||!connection.enabled)return {status:'rejected',reason:'local_connection_unavailable'};
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
   Object.keys(payload).sort().join(',')!=='content,expectedVersion,kind'||payload['kind']!=='replace'||
   typeof payload['content']!=='string'||typeof payload['expectedVersion']!=='string'||
   !/^[a-f0-9]{64}$/.test(payload['expectedVersion']))return {status:'rejected',reason:'invalid_local_file_update'};
  const bytes=Buffer.from(payload['content'],'utf8');
  if(bytes.length>limit||bytes.toString('utf8')!==payload['content'])return {status:'rejected',reason:'invalid_local_file_update'};
  const capability=await resolve(target,'write');
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
