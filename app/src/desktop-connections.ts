import {randomUUID} from 'node:crypto';
import type {FoundationHost} from './foundations.js';
import type {DesktopAuthority} from './desktop-authority.js';
import type {DesktopConnectionsInput,DesktopConnectionsReply} from '../../UI/src/index.js';
export function createDesktopConnections(options:{authority:DesktopAuthority;confirm:(summary:string)=>Promise<boolean>}){
 const a=options.authority;let host:FoundationHost|undefined,closed=false;
 return Object.freeze({attach(value:FoundationHost){if(host)throw Error('already_attached');host=value;a.attach(value);},
  async request(raw:unknown):Promise<DesktopConnectionsReply>{
   if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.getPrototypeOf(raw)!==Object.prototype)return {status:'rejected',reason:'invalid_request'};
   const r=raw as Record<string,unknown>;
   const keys=r.kind==='snapshot'?['kind']:r.kind==='toggle'?['kind','id','expectedRevision','enabled']:undefined;
   if(!keys||Reflect.ownKeys(r).length!==keys.length||!keys.every(k=>Object.hasOwn(r,k))||
    r.kind==='toggle'&&(typeof r.id!=='string'||!r.id||r.id.length>4096||!Number.isSafeInteger(r.expectedRevision)||Number(r.expectedRevision)<0||typeof r.enabled!=='boolean'))return {status:'rejected',reason:'invalid_request'};
   const input=structuredClone(r) as unknown as DesktopConnectionsInput;
   if(closed||!host?.connections)return {status:'unavailable',reason:'connections_unavailable'};
   try{return await a.run(async()=>{
    if(!await a.confirm(options.confirm,input.kind==='snapshot'?'查看本数据根的连接配置及脱敏 Operation 摘要。不读取外部资源或凭证。':'设置连接 '+input.id+' 为'+(input.enabled?'启用':'停用')+'。启用不授予资源访问或执行权限。'))return {status:'cancelled'};
    const scope={resource:'connections',action:input.kind==='snapshot'?'configuration.read':'configuration.write',target:input.kind==='snapshot'?'connections:configurations':'connection:'+input.id,context:null};
    a.permit(scope);const request=a.bind(scope)!,decision=host!.permissions!.evaluate(request);
    if(decision.status!=='allow')return {status:'rejected',reason:'permission_unavailable'};
    if(input.kind==='toggle'){
     const selected=host!.connections!.configs.get(input.id);if(!selected)return {status:'rejected',reason:'connection_unavailable'};
     if(host!.permissions!.recheck(request,decision).status!=='allow')return {status:'rejected',reason:'authorization_changed'};
     const result=host!.connections!.configs.put({...selected,enabled:input.enabled},input.expectedRevision,randomUUID());
     return result.status==='ok'?{status:'committed',revision:result.revision}:result;
    }
    const snapshot=host!.connections!.configs.read();
    const historyScope={resource:'connections',action:'operation.list',target:'connections:operations',context:null};a.permit(historyScope);
    const historyRequest=a.bind(historyScope)!,before=host!.permissions!.evaluate(historyRequest);
    if(before.status!=='allow')return {status:'rejected',reason:'permission_unavailable'};
    const operations=host!.connections!.operations.read().operations.map(o=>({id:o.id,phase:o.phase,attempts:o.attempts,connectionId:o.connection?.connectionId??null,adapter:o.connection?.adapterId??null}));
    if(host!.permissions!.recheck(historyRequest,before).status!=='allow'||host!.permissions!.evaluate(request).status!=='allow')return {status:'rejected',reason:'authorization_changed'};
    return {status:'ok',revision:snapshot.revision,connections:snapshot.items.map(c=>({id:c.id,adapter:c.adapter,endpoint:c.endpoint,enabled:c.enabled,hasCredential:c.credentialRef!==null})),operations,
     localFiles:!!host!.localFiles,localDirectories:!!host!.localDirectories&&process.platform==='linux'};
   })??{status:'unavailable',reason:'operation_in_progress'};}catch{return {status:'unavailable',reason:'connections_operation_unavailable'};}
  },close(){closed=true;}
 });
}
