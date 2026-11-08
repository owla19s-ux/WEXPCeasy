import {lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {inspectRoot} from '../../shared/src/index.js';
import type {ManagedStore,Root} from '../../shared/src/index.js';

/** App-owned storage opening and release; business modules retain store schema ownership. */
export async function openDomainStore(root:Root,name:string,namespace:string,open:(path:string,namespace:string)=>ManagedStore):Promise<ManagedStore>{
 for(const suffix of ['', '-journal','-wal','-shm']){
  try{const info=await lstat(join(root.path,name+suffix));if(info.isSymbolicLink()||!info.isFile())throw Error('unsafe store path');}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 }
 if((await inspectRoot(root.path,root.id)).status!=='available')throw Error('root changed');
 return open(join(root.path,name),namespace);
}
export async function closeStores(stores:Set<ManagedStore>):Promise<void>{
 let failed=false;
 for(const store of stores){try{store.close();stores.delete(store);}catch{failed=true;}}
 if(failed)throw Error('store_close_unconfirmed');
}
