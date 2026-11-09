import {createHash} from 'node:crypto';
import type {Json} from '../../shared/src/index.js';
import type {AdapterAccess} from './adapter-access.js';
import type {ConnectionConfig} from './config.js';

/** Supplied by trusted assembly. Descriptions and annotations never grant authority. */
export interface ConfiguredCapabilityAdapter {
 readonly id:string;readonly version:string;
 discover(connection:Readonly<ConnectionConfig>,signal:AbortSignal,access:AdapterAccess):Promise<unknown>;
 invoke(connection:Readonly<ConnectionConfig>,name:string,args:Record<string,Json>,signal:AbortSignal,access:AdapterAccess):Promise<Json>;
 stop():Promise<void>;
}
function canonical(value:Json,ancestors=new Set<object>()):string {
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('invalid_capability_arguments');return JSON.stringify(value);}
 if(typeof value!=='object'||ancestors.has(value))throw Error('invalid_capability_arguments');
 ancestors.add(value);
 try{
  if(Array.isArray(value))return '['+Array.from(value,x=>canonical(x,ancestors)).join(',')+']';
  if(Object.getPrototypeOf(value)!==Object.prototype)throw Error('invalid_capability_arguments');
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key]!,ancestors)).join(',')+'}';
 }finally{ancestors.delete(value);}
}
function identity(value:string):void{if(typeof value!=='string'||!value)throw Error('invalid_capability_target');}
/** Discovery and invocation have distinct, connection-bound permission identities. */
export function capabilityDiscoveryTarget(adapterId:string,connectionId:string):string{
 identity(adapterId);identity(connectionId);
 return 'capability-discovery:'+JSON.stringify([adapterId,connectionId]);
}
/** Exact tool and full arguments are bound independently of any file-target model. */
export function capabilityInvocationTarget(adapterId:string,connectionId:string,name:string,args:Record<string,Json>):string{
 identity(adapterId);identity(connectionId);identity(name);
 return 'capability-invoke:'+createHash('sha256').update(canonical([adapterId,connectionId,name,captureCapabilityArguments(args)])).digest('hex');
}
export function captureCapabilityArguments(args:Record<string,Json>):Record<string,Json>{
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.getPrototypeOf(args)!==Object.prototype)
  throw Error('invalid_capability_arguments');
 return JSON.parse(canonical(args)) as Record<string,Json>;
}
/** Persistent selection identity only. This target is never accepted as an invocation grant. */
export function capabilityReferenceTarget(adapterId:string,connectionId:string,name:string):string{
 for(const value of [adapterId,connectionId,name])if(typeof value!=='string'||!value.trim()||value.length>1024)throw Error('invalid_capability_reference');
 const target='capability-reference:'+JSON.stringify([adapterId,connectionId,name]);
 if(target.length>4096)throw Error('invalid_capability_reference');return target;
}
export function parseCapabilityReference(target:string):{adapterId:string;connectionId:string;name:string}|undefined{
 try{if(typeof target!=='string'||!target.startsWith('capability-reference:'))return;
  const values:unknown=JSON.parse(target.slice('capability-reference:'.length));
  if(!Array.isArray(values)||values.length!==3||!values.every(v=>typeof v==='string'))return;
  const [adapterId,connectionId,name]=values as [string,string,string];
  if(capabilityReferenceTarget(adapterId,connectionId,name)!==target)return;
  return {adapterId,connectionId,name};
 }catch{return;}
}
