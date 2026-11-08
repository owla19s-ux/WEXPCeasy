import {capabilityDiscoveryTarget,capabilityInvocationTarget,captureCapabilityArguments} from '../../connections/src/index.js';
import {randomUUID,createHash} from 'node:crypto';
import type {FoundationHost} from './foundations.js';
import type {DesktopAuthority} from './desktop-authority.js';
import type {CredentialTarget} from './credential-prompt.js';
import {githubFileTarget,githubCredentialRef,githubCredentialTarget} from '../../connections/github/src/index.js';
import type {DesktopConnectionsInput,DesktopConnectionsReply,DesktopGitHubTool,ApiJson} from '../../UI/src/index.js';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const fields:Record<string,string[]>={
 snapshot:['kind'],toggle:['kind','id','expectedRevision','enabled'],
 'github.create':['kind','expectedRevision'],'credential.set':['kind','id','expectedRevision'],'credential.revoke':['kind','id','expectedRevision'],
 'github.tools':['kind','id','expectedRevision'],'github.invoke':['kind','id','expectedRevision','toolName','arguments'],
 'github.read':['kind','id','expectedRevision','file'],'github.write':['kind','id','expectedRevision','file','expectedSha','content','message']
};
function capture(raw:unknown):DesktopConnectionsInput|undefined{
 if(!object(raw)||typeof raw.kind!=='string'||!Object.hasOwn(fields,raw.kind))return;
 const keys=fields[raw.kind]!;
 if(Reflect.ownKeys(raw).length!==keys.length||!keys.every(k=>Object.hasOwn(raw,k)))return;
 if(raw.kind!=='snapshot'){
  if(!Number.isSafeInteger(raw.expectedRevision)||Number(raw.expectedRevision)<(raw.kind==='github.create'||raw.kind==='toggle'?0:1))return;
  if(raw.kind!=='github.create'&&(typeof raw.id!=='string'||!raw.id||raw.id.length>4096))return;
 }
 if(raw.kind==='toggle'&&typeof raw.enabled!=='boolean')return;
 if(raw.kind==='github.read'||raw.kind==='github.write'){
  const file=raw.file;if(!object(file)||Reflect.ownKeys(file).length!==4||!['owner','repo','ref','path'].every(k=>Object.hasOwn(file,k)))return;
  try{githubFileTarget(raw.file as unknown as import('../../connections/github/src/index.js').GitHubFile);}catch{return;}
 }
 if(raw.kind==='github.invoke'){
  if(typeof raw.toolName!=='string'||!raw.toolName.trim()||raw.toolName.length>256||!object(raw.arguments))return;
  try{
   captureCapabilityArguments(raw.arguments as Record<string,ApiJson>);
   if(Buffer.byteLength(JSON.stringify(raw.arguments),'utf8')>1024*1024)return;
  }catch{return;}
 }
 if(raw.kind==='github.write'&&(
  typeof raw.expectedSha!=='string'||!/^([0-9a-f]{40}|[0-9a-f]{64})$/.test(raw.expectedSha)||
  typeof raw.content!=='string'||Buffer.byteLength(raw.content,'utf8')>1024*1024||Buffer.from(raw.content,'utf8').toString('utf8')!==raw.content||
  typeof raw.message!=='string'||!raw.message.trim()||raw.message.length>4096))return;
 return structuredClone(raw) as unknown as DesktopConnectionsInput;
}
/** Main-only concrete connector entry. The Renderer supplies intent, never credentials or authorization facts. */
export function createDesktopConnections(options:{authority:DesktopAuthority;confirm:(summary:string)=>Promise<boolean>;requestCredential?:(target:CredentialTarget)=>Promise<string|undefined>;cancelCredential?:()=>void}){
 const a=options.authority;let host:FoundationHost|undefined,closed=false;
 const scope=(action:string,target:string,resource='connections')=>({resource,action,target,context:null});
 return Object.freeze({attach(value:FoundationHost){if(host)throw Error('already_attached');host=value;a.attach(value);},
  async request(raw:unknown):Promise<DesktopConnectionsReply>{
   const input=capture(raw);if(!input)return {status:'rejected',reason:'invalid_request'};
   if(closed||!host?.connections||!host.permissions)return {status:'unavailable',reason:'connections_unavailable'};
   try{return await a.run(async():Promise<DesktopConnectionsReply>=>{
    const file='file'in input?input.file:undefined;
    const summary=input.kind==='snapshot'?'查看本数据根的连接配置及脱敏 Operation 摘要。不读取外部资源或凭证。':
     input.kind==='github.tools'?'读取连接 '+input.id+' 的 GitHub 官方 MCP 工具目录。发现工具不授予调用权限。':
     input.kind==='github.invoke'?'调用 GitHub 官方 MCP 工具\n连接：'+input.id+'\n工具：'+input.toolName+'\n参数：'+JSON.stringify(input.arguments,null,2)+'\n工具可能修改远端资源。仅执行一次；结果未知时请核对原 Operation 和远端状态。':
     input.kind==='github.create'?'登记 GitHub 官方 API 连接。不会自动联网或授予仓库权限。':
     input.kind==='toggle'?'设置连接 '+input.id+' 为'+(input.enabled?'启用':'停用')+'。启用不授予资源访问或执行权限。':
     input.kind==='credential.set'?'通过独立安全窗口配置 GitHub 凭证；秘密只由主进程加密保管。':
     input.kind==='credential.revoke'?'解除 GitHub 凭证并停用此连接。':
     (input.kind==='github.read'?'读取 GitHub 文件':'向 GitHub 提交文件修改')+'\nhttps://github.com/'+file!.owner+'/'+file!.repo+'\n分支/修订：'+file!.ref+'\n文件：'+file!.path+
     (input.kind==='github.write'?'\n基于文件 SHA：'+input.expectedSha+'\n提交说明：'+input.message+'\n内容 '+Buffer.byteLength(input.content,'utf8')+' 字节；摘要 '+createHash('sha256').update(input.content).digest('hex')+'\n将执行一次真实远端写入。结果未知不会自动重试。':'\n将执行真实网络读取。');
    if(!await a.confirm(options.confirm,summary)||closed)return {status:'cancelled'};
    const configScope=scope(input.kind==='snapshot'||input.kind==='github.read'||input.kind==='github.write'||input.kind==='github.tools'||input.kind==='github.invoke'?'configuration.read':'configuration.write',input.kind==='snapshot'?'connections:configurations':input.kind==='github.create'?'connections:configurations':'connection:'+input.id);
    a.permit(configScope);const request=a.bind(configScope)!,decision=host!.permissions!.evaluate(request);
    if(decision.status!=='allow')return {status:'rejected',reason:'permission_unavailable'};
    const service=host!.connections!;
    if(input.kind==='snapshot'){
     const snapshot=service.configs.read(),historyScope=scope('operation.list','connections:operations');a.permit(historyScope);
     const hr=a.bind(historyScope)!,before=host!.permissions!.evaluate(hr);
     if(before.status!=='allow')return {status:'rejected',reason:'permission_unavailable'};
     const operations=service.operations.read().operations.map(o=>({id:o.id,phase:o.phase,attempts:o.attempts,connectionId:o.connection?.connectionId??null,adapter:o.connection?.adapterId??null}));
     if(host!.permissions!.recheck(hr,before).status!=='allow'||host!.permissions!.evaluate(request).status!=='allow')return {status:'rejected',reason:'authorization_changed'};
     return {status:'ok',revision:snapshot.revision,connections:snapshot.items.map(c=>({id:c.id,adapter:c.adapter,endpoint:c.endpoint,enabled:c.enabled,hasCredential:c.credentialRef!==null})),operations,
      localFiles:!!host!.localFiles,localDirectories:!!host!.localDirectories&&['linux','win32'].includes(process.platform),credentialBackend:host!.credentials?.available()??false,githubMcpConfigured:service.capabilities().some(c=>c.id==='github')};
    }
    const snapshot=service.configs.read();
    if(snapshot.revision!==input.expectedRevision)return {status:'conflict',reason:'revision_conflict'};
    const save=(value:Parameters<typeof service.configs.put>[0]):DesktopConnectionsReply=>{
     if(closed||host!.permissions!.evaluate(request).status!=='allow')return {status:'rejected',reason:'authorization_changed'};
     const result=service.configs.put(value,input.expectedRevision,randomUUID());
     return result.status==='ok'?{status:'committed',revision:result.revision}:result;
    };
    if(input.kind==='github.create')return save({id:randomUUID(),adapter:'github',endpoint:'https://api.github.com',credentialRef:null,enabled:true});
    const selected=snapshot.items.find(c=>c.id===input.id);if(!selected)return {status:'rejected',reason:'connection_unavailable'};
    if(input.kind==='toggle')return save({...selected,enabled:input.enabled});
    if(selected.adapter!=='github'||selected.endpoint!=='https://api.github.com')return {status:'rejected',reason:'github_connection_required'};
    if(input.kind==='credential.set'||input.kind==='credential.revoke'){
     if(!host!.credentials)return {status:'unavailable',reason:'credential_backend_unavailable'};
     const prior=githubCredentialTarget({...selected,enabled:true})?.reference;
     const revoke=(reference:{id:string;revision:number})=>{
      const op=scope('credential.revoke','credential:'+reference.id,'credentials');a.permit(op);
      return host!.credentials!.revoke(a.bind(op)!,{id:reference.id,expectedRevision:reference.revision,intent:randomUUID()});
     };
     if(input.kind==='credential.revoke'){
      const detached=save({...selected,enabled:false,credentialRef:null});
      if(detached.status!=='committed'||!prior)return detached;
      return revoke(prior).status==='committed'?detached:{...detached,notice:'credential_cleanup_unconfirmed'};
     }
     if(!host!.credentials.available()||!options.requestCredential)return {status:'unavailable',reason:'credential_backend_unavailable'};
     const secret=await options.requestCredential({connectionName:selected.id,provider:'github',endpoint:selected.endpoint});
     if(closed)return {status:'unavailable',reason:'host_closed'};if(secret===undefined)return {status:'cancelled'};
     if(host!.permissions!.recheck(request,decision).status!=='allow')return {status:'rejected',reason:'authorization_changed'};
     if(typeof secret!=='string'||!/^[-a-zA-Z0-9._~+/]+=*$/.test(secret)||secret.length>8192)return {status:'rejected',reason:'invalid_credential'};
     const id=randomUUID(),op=scope('credential.write','credential:'+id,'credentials');a.permit(op);
     const stored=host!.credentials.put(a.bind(op)!,{id,intent:randomUUID(),expectedRevision:0,binding:{connectionId:selected.id,endpoint:selected.endpoint,provider:'github'},secret});
     if(stored.status!=='committed')return {status:stored.status==='unknown'?'unknown':'unavailable',reason:'credential_save_'+stored.status};
     const linked=save({...selected,credentialRef:githubCredentialRef(stored.reference)});
     if(linked.status!=='committed'){revoke(stored.reference);return linked;}
     if(prior&&revoke(prior).status!=='committed')return {...linked,notice:'previous_credential_cleanup_unconfirmed'};
     return linked;
    }
    if(input.kind==='github.tools'||input.kind==='github.invoke'){
     if(!service.capabilities().some(c=>c.id==='github'))return {status:'unavailable',reason:'github_mcp_not_configured'};
     const target=input.kind==='github.tools'?capabilityDiscoveryTarget('github',input.id):capabilityInvocationTarget('github',input.id,input.toolName,input.arguments);
     const operation=scope(input.kind==='github.tools'?'read':'write',target,'github');a.permit(operation);
     const resourceRequest=a.bind(operation)!,before=host!.permissions!.evaluate(resourceRequest);
     if(before.status!=='allow')return {status:'rejected',reason:'permission_unavailable'};
     if(input.kind==='github.tools'){
      const result=await service.discover('github',resourceRequest,input.id,input.expectedRevision);
      if(closed||host!.permissions!.recheck(resourceRequest,before).status!=='allow')return {status:'rejected',reason:'authorization_changed'};
      if(result.status!=='ok')return {status:result.status==='cancelled'?'cancelled':'unavailable',reason:result.reason};
      if(!Array.isArray(result.value)||result.value.some(t=>!object(t)||typeof t.name!=='string'||!object(t.inputSchema)))
       return {status:'unavailable',reason:'invalid_tool_catalog'};
      return {status:'tools',tools:result.value as DesktopGitHubTool[]};
     }
     const operationId=randomUUID();
     const result=await service.invoke('github',resourceRequest,operationId,input.id,input.expectedRevision,input.toolName,input.arguments,
      createHash('sha256').update(JSON.stringify(input)).digest('hex'));
     if(result.status!=='observed')return {status:result.status==='unknown'?'unknown':'rejected',reason:result.reason,operationId};
     if(closed||host!.permissions!.recheck(resourceRequest,before).status!=='allow')return {status:'unknown',reason:'authorization_changed_after_dispatch',operationId};
     const receipt=service.operations.get(operationId)?.observations.find(o=>o.id==='result')?.value;
     if(!object(receipt)||!Array.isArray(receipt.content))return {status:'unknown',reason:'tool_result_unavailable',operationId};
     return {status:'tool-result',toolName:input.toolName,result:receipt,operationId};
    }
    const target=githubFileTarget(input.file),operation=scope(input.kind==='github.read'?'read':'write',target,'github');a.permit(operation);
    const resourceRequest=a.bind(operation)!,before=host!.permissions!.evaluate(resourceRequest);
    if(before.status!=='allow')return {status:'rejected',reason:'permission_unavailable'};
    if(input.kind==='github.read'){
     const result=await service.read('github',resourceRequest,input.id,input.expectedRevision,target);
     if(closed||host!.permissions!.recheck(resourceRequest,before).status!=='allow')return {status:'rejected',reason:'authorization_changed'};
     if(result.status!=='ok')return {status:result.status==='cancelled'?'cancelled':'unavailable',reason:result.reason};
     const value=result.value as {sha:string;content:string;size:number};
     return {status:'file',file:input.file,sha:value.sha,content:value.content,size:value.size};
    }
    const operationId=randomUUID(),result=await service.dispatch('github',resourceRequest,operationId,input.id,input.expectedRevision,target,createHash('sha256').update(JSON.stringify(input)).digest('hex'),{
     kind:'put',expectedSha:input.expectedSha,content:input.content,message:input.message
    });
    if(result.status!=='observed')return {status:result.status==='unknown'?'unknown':'rejected',reason:result.reason,operationId};
    // An observed receipt can be a conflict/rejection. Never equate persistence with a successful remote write.
    if(closed||host!.permissions!.recheck(resourceRequest,before).status!=='allow')return {status:'unknown',reason:'authorization_changed_after_dispatch',operationId};
    const receipt=service.operations.get(operationId)?.observations.find(o=>o.id==='result')?.value;
    if(!object(receipt)||receipt.status!=='written')return {status:'rejected',reason:object(receipt)&&typeof receipt.reason==='string'?receipt.reason:'github_write_unconfirmed',operationId};
    return {status:'written',sha:receipt.sha as string,commitSha:receipt.commitSha as string,operationId};
   })??{status:'unavailable',reason:'operation_in_progress'};}catch{return {status:'unavailable',reason:'connections_operation_unavailable'};}
  },close(){closed=true;options.cancelCredential?.();}
 });
}
