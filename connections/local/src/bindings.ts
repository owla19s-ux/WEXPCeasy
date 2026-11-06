import type {PermissionReader} from '../../../permissions/src/index.js';
import type {LockResult} from '../../../shared/src/index.js';
import {createSelectedBindings} from './selection-bindings.js';
import type {LocalFileIdentity} from './selection-bindings.js';
import {validateLocalFileTarget} from './target.js';
export type {LocalFileIdentity} from './selection-bindings.js';
export interface LocalFileBindingOptions {
 /** Trusted host coordinator; must include conflicting WEX writers and unknown occupancy. */
 acquireWrite?:(identity:Readonly<LocalFileIdentity>)=>Promise<LockResult>;
}
export function createLocalFileBindings(permission:PermissionReader,options:LocalFileBindingOptions={}){
 return createSelectedBindings(permission,{kind:'file',validateTarget:validateLocalFileTarget,...(options.acquireWrite?{acquireWrite:options.acquireWrite}:{})});
}
