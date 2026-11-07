import type {AdapterAccess} from '../../src/index.js';
/** Trusted host capability; never accepted from Renderer/model input.
 * Host opens the selected exact file, pins identity and rechecks current request permissions.
 * exclusive refers to WEX resource coordination, not control of external processes.
 */
export interface LocalStat {dev:bigint;ino:bigint;size:bigint;mtimeNs:bigint;ctimeNs:bigint;isFile():boolean;isDirectory():boolean}
export interface LocalHandle {fd:number;stat(options:{bigint:true}):Promise<LocalStat>;
 read(buffer:Buffer,offset:number,length:number,position:number):Promise<{bytesRead:number}>;
 write(buffer:Buffer,offset:number,length:number,position:number):Promise<{bytesWritten:number}>;
 truncate(length:number):Promise<void>;sync():Promise<void>;close():Promise<void>;
 readDirectory?():Promise<{name:string;kind:'file'|'directory'|'symlink'|'other'}|null>;
}
export interface LocalFileCapability {handle:LocalHandle;exclusive:boolean;check():boolean;release():Promise<void>;retain?(cleanup:()=>Promise<void>):void}
export type LocalFileResolver=(target:string,mode:'read'|'write',access?:AdapterAccess)=>Promise<LocalFileCapability>;
