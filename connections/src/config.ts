import type {Store,Json,CommitResult} from '../../shared/src/index.js';
export interface ConnectionConfig {id:string;adapter:string;endpoint:string;credentialRef:string|null;enabled:boolean}
interface State {format:1;items:ConnectionConfig[]}
export type ConfigResult={status:'ok';revision:number;config:ConnectionConfig}|{status:'conflict'|'unavailable'|'unknown';reason:string};
export type ConfigRemovalResult={status:'ok';revision:number;id:string}|{status:'conflict'|'unavailable'|'unknown';reason:string};
function valid(x:ConnectionConfig):boolean {return !!x&&typeof x.id==='string'&&x.id.length>0&&typeof x.adapter==='string'&&x.adapter.length>0&&typeof x.endpoint==='string'&&x.endpoint.length>0&&(x.credentialRef===null||typeof x.credentialRef==='string')&&typeof x.enabled==='boolean';}
function decode(value:Json):State {
 if(value===null)return {format:1,items:[]};
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_config_state');
 const s=value as unknown as State;
 if(s.format!==1||!Array.isArray(s.items)||s.items.some(x=>!valid(x))||new Set(s.items.map(x=>x.id)).size!==s.items.length)throw Error('invalid_config_state');
 return s;
}
/** Host-owned configuration store. Caller must authorize configuration access. */
export function createConnectionConfigs(store:Store){
 const read=()=>{const s=store.read();return {revision:s.revision,items:structuredClone(decode(s.value).items)};};
 return Object.freeze({
  read,
  remove(id:string,expectedRevision:number,intent:string):ConfigRemovalResult{
   if(typeof id!=='string'||!id||typeof intent!=='string'||!intent||intent.length>256||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)return {status:'conflict',reason:'invalid_request'};
   try{
    const s=read();
    if(s.revision!==expectedRevision)return {status:'conflict',reason:'revision_conflict'};
    if(!s.items.some(x=>x.id===id))return {status:'conflict',reason:'not_found'};
    const items=s.items.filter(x=>x.id!==id);
    const result=store.commit({intent,expectedRevision,value:{format:1,items} as unknown as Json});
    if(result.status==='unknown')return {status:'unknown',reason:'commit_unknown'};
    if(result.status!=='committed')return {status:'conflict',reason:result.reason};
    const persisted=read();
    if(persisted.items.some(x=>x.id===id))return {status:'conflict',reason:'persisted_state_mismatch'};
    return {status:'ok',revision:persisted.revision,id};
   }catch{return {status:'unavailable',reason:'store_failed'};}
  },
  get(id:string){return read().items.find(x=>x.id===id);},
  put(config:ConnectionConfig,expectedRevision:number,intent:string):ConfigResult{
   if(!valid(config)||!intent||intent.length>256||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)return {status:'conflict',reason:'invalid_request'};
   try{
    const s=read();
    if(s.revision!==expectedRevision)return {status:'conflict',reason:'revision_conflict'};
    const items=[...s.items.filter(x=>x.id!==config.id),structuredClone(config)];
    const result:CommitResult=store.commit({intent,expectedRevision,value:{format:1,items} as unknown as Json});
    if(result.status==='committed'){
     const persisted=read().items.find(x=>x.id===config.id);
     if(!persisted||JSON.stringify(persisted)!==JSON.stringify(config))return {status:'conflict',reason:'intent_conflict'};
     return {status:'ok',revision:result.revision,config:structuredClone(persisted)};
    }
    if(result.status==='unknown')return {status:'unknown',reason:'commit_unknown'};
    return {status:'conflict',reason:result.reason};
   }catch{return {status:'unavailable',reason:'store_failed'};}
  }
 });
}
