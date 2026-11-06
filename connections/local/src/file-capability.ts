import type {FileHandle} from 'node:fs/promises';
import type {AdapterAccess} from '../../src/index.js';
/** Trusted host capability; never accepted from Renderer/model input.
 * Host opens the selected exact file, pins identity and rechecks current request permissions.
 * exclusive refers to WEX resource coordination, not control of external processes.
 */
export interface LocalFileCapability {handle:FileHandle;exclusive:boolean;check():boolean;release():Promise<void>}
export type LocalFileResolver=(target:string,mode:'read'|'write',access?:AdapterAccess)=>Promise<LocalFileCapability>;
