import {lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {inspectRoot,openSqliteStore} from '../../shared/src/index.js';
import type {ManagedStore,Root} from '../../shared/src/index.js';
import {fail} from './model.js';
export type OpenStore=(path:string,namespace:string)=>ManagedStore;
/** Requires an existing host-initialized root, never creates directories while reading. */
export async function openStore(root:Root,name:string,namespace:string,create:boolean,open:OpenStore=openSqliteStore):Promise<ManagedStore>{
 for(const suffix of ['', '-journal','-wal','-shm']){
  try{const stat=await lstat(join(root.path,name+suffix));if(!stat.isFile()||stat.isSymbolicLink())return fail('unsafe_store_path','unavailable');}
  catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;if(!suffix&&!create)return fail('missing_data','unavailable');}
 }
 if((await inspectRoot(root.path,root.id)).status!=='available')return fail('root_changed','unavailable');
 return open(join(root.path,name),namespace);
}
