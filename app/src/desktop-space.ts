import {randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {capabilityDiscoveryTarget,capabilityReferenceTarget,parseCapabilityReference} from '../../connections/src/index.js';
import {localFileTarget,localDirectoryTarget} from '../../connections/local/src/index.js';
import type {FoundationHost,FoundationOptions} from './foundations.js';
import type {LocalOperation} from './local-entries.js';
import {createDesktopAuthority} from './desktop-authority.js';
import type {DesktopAuthority} from './desktop-authority.js';
import type {SpaceCommand,SpaceQuery,QueryResult,ProjectionScope} from '../../space/src/index.js';
import type {DesktopSpaceInput,DesktopSpaceReply} from '../../UI/src/index.js';
interface FileObservation {contextId:string;addressId:string;revision:number;address:string;path:string;target:string;version:string}
const schemas:Record<string,readonly string[]>={
 'association.add':['kind','contextId','owner','targetType','targetId','purpose'],'association.replace':['kind','contextId','id','expectedRevision','owner','targetType','targetId','purpose'],'association.remove':['kind','contextId','id','expectedRevision'],
 'tool.connections':['kind','contextId'],'tool.candidates':['kind','contextId','connectionId'],
 'tool.add':['kind','contextId','targetId','purpose'],'tool.set':['kind','contextId','id','expectedRevision','enabled'],'tool.remove':['kind','contextId','id','expectedRevision'],
 'resource.save':['kind','contextId','id','editToken','content'],
 'resource.read':['kind','contextId','id','mode'],
 'category.create':['kind','name'],'category.edit':['kind','id','expectedRevision','name'],
 'address.add':['kind','contextId','name','address','notes','purpose'],
 'address.edit':['kind','contextId','id','expectedRevision','name','address','notes','purpose'],
 'address.remove':['kind','contextId','id','expectedRevision'],
 'primary.select':['kind','contextId','id','expectedRevision'],
 snapshot:['kind'],'context.open':['kind','id'],
 'space.create':['kind','name','description','categoryId'],'space.edit':['kind','id','expectedRevision','name','description','categoryId'],
 'space.directory':['kind','id','expectedRevision','clear'],
 'group.create':['kind','spaceId','name'],'group.edit':['kind','id','expectedRevision','name'],
 'context.create':['kind','name','description'],'context.edit':['kind','id','expectedRevision','name','description'],
 'context.group':['kind','contextId','spaceId','groupId','expectedRevision']
};
function capture(input:unknown):DesktopSpaceInput|undefined{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.getPrototypeOf(input)!==Object.prototype)return;
 const row=input as Record<string,unknown>;if(typeof row.kind!=='string'||!Object.hasOwn(schemas,row.kind))return;const keys=schemas[row.kind];if(!keys||Reflect.ownKeys(input).some(k=>typeof k!=='string'||!keys.includes(k)))return;
 const out:Record<string,unknown>={};
 for(const key of Object.keys(row)){
  const value=row[key];
  if(key==='expectedRevision'){if(!Number.isSafeInteger(value)||Number(value)<0)return;}
  else if(key==='content'){if(typeof value!=='string'||Buffer.byteLength(value,'utf8')>1024*1024||Buffer.from(value,'utf8').toString('utf8')!==value)return;}
  else if(key==='mode'){if(!['file','directory'].includes(String(value)))return;}
  else if(key==='clear'||key==='enabled'){if(typeof value!=='boolean')return;}
  else if((key==='groupId'||key==='categoryId'||(key==='id'&&row.kind==='primary.select'))&&value===null){}
  else if(key==='purpose'&&Array.isArray(value)){
   if(value.length>32||Object.keys(value).length!==value.length||value.some(x=>typeof x!=='string'||!x.trim()||x.length>4096))return;
   out[key]=[...value];continue;
  }
  else if(typeof value!=='string'||(!['description','notes','purpose'].includes(key)&&!value.trim())||value.length>4096)return;
  out[key]=value;
 }
 const required=keys.filter(k=>!['description','clear','categoryId','notes','purpose'].includes(k));
 if(required.some(k=>!Object.hasOwn(out,k)))return;
 return out as unknown as DesktopSpaceInput;
}
const titles:Record<string,string>={'association.add':'添加设定/会话引用（不授权执行）','association.replace':'替换引用','association.remove':'解除引用（保留原对象）','tool.connections':'读取可关联工具连接（不授权执行）','tool.candidates':'读取可关联能力目录（不授权执行）','tool.add':'关联 Context 工具引用（不授权执行）','tool.set':'变更 Context 工具选择（不授权执行）','tool.remove':'解除 Context 工具引用（保留外部能力）','resource.read':'查看已关联资源','category.create':'创建 Space 类别','category.edit':'编辑 Space 类别','address.add':'添加 Context 地址引用','address.edit':'编辑地址引用','address.remove':'解除地址引用（保留外部原资源）','primary.select':'选择 Context 主地址','space.create':'创建 Space','space.edit':'编辑 Space','space.directory':'变更 Space 工作目录关联','group.create':'创建分组','group.edit':'编辑分组','context.create':'创建 Context','context.edit':'编辑 Context','context.group':'移动 Context 分组','context.open':'查看 Context'};
const key=(op:LocalOperation)=>JSON.stringify(op);
/** Native-confirmed local UI adapter. Domain data remains in Space; no Renderer identity/grant/path API. */
export function createDesktopSpace(options:{authority?:DesktopAuthority;rootId:string;confirm:(summary:string)=>Promise<boolean>;chooseDirectory:()=>Promise<string|undefined>}){
 const authority=options.authority??createDesktopAuthority(),policy=authority.policy;
 const pending=new Map<string,LocalOperation>(),observations=new Map<string,FileObservation>();
 let host:FoundationHost|undefined,closed=false,busy=false,reading=false;
 const operation=(action:string,target:string,context:string|null=null):LocalOperation=>({resource:'space',action,target,context});
 const permit=authority.permit,bind=authority.bind;
 const derive=(parent:object,wanted:ProjectionScope):object|undefined=>{
  if(closed||!authority.owns(parent,'space')||!['context.read','space.read','group.read','category.read'].includes(wanted.action))return;
  const op=operation(wanted.action,wanted.target,wanted.context);
  if(!authority.enabled(op)){if(reading)pending.set(key(op),op);return;}
  return authority.derive(parent,wanted);
 };
 async function query(input:SpaceQuery,op:LocalOperation):Promise<QueryResult>{
  permit(op);
  for(let round=0;round<6;round++){
   pending.clear();reading=true;
   let result:QueryResult;
   try{result=await host!.space!.query(bind(op)!,input);}finally{reading=false;}
   if(closed)throw Error('session_closed');
   if(!pending.size)return result;
   // Discovery is read-only. Grant exact derived reads covered by this native-confirmed operation,
   // then start a fresh query so permission revisions are never changed inside a domain recheck.
   if(pending.size>2000)throw Error('projection_limit');
   for(const scope of pending.values())permit(scope);
  }
  throw Error('projection_unavailable');
 }
 const configScope:LocalOperation={resource:'connections',action:'configuration.read',target:'connections:configurations',context:null};
 function toolScope(adapterId:string,connectionId:string):LocalOperation{return {resource:adapterId,action:'read',target:capabilityDiscoveryTarget(adapterId,connectionId),context:null};}
 function targetScope(target:{owner:string;targetType:string;targetId:string}):LocalOperation|undefined{
  if(target.owner==='AI'&&['role','position','agent'].includes(target.targetType))return {resource:'AI',action:target.targetType+'.read',target:target.targetType+':'+target.targetId,context:null};
  if(target.owner==='conversations'&&target.targetType==='conversation')return {resource:'conversations',action:'read',target:'conversation:'+target.targetId,context:null};
  return;
 }
 const owner:import('../../space/src/index.js').OwnerPort={async resolve(parent,target){
  if(closed||!host||!authority.owns(parent,'space'))return {status:'unsupported'};
  const scope=targetScope(target);
  if(scope){
   if(!authority.enabled(scope)){if(reading)pending.set(key(scope),scope);return {status:'denied'};}
   const request=authority.related(parent,scope);if(!request)return {status:'denied'};
   const result=target.owner==='AI'?host.ai?.read(request,target.targetType as 'role'|'position'|'agent',target.targetId):host.conversations?.service.read(request,target.targetId);
   if(result?.status!=='ok')return {status:result?.status==='denied'?'denied':'unavailable'};
   if(!authority.related(parent,scope))return {status:'denied'};
   const revision='entry'in result?result.entry.revision:result.conversation.revision;
   return {status:'available',...target,sourceRevision:String(revision),observedAt:new Date().toISOString()};
  }
  if(!host.connections||target.owner!=='connections'||target.targetType!=='tool')return {status:'unsupported'};
  const reference=parseCapabilityReference(target.targetId);if(!reference)return {status:'unsupported'};
  for(const scope of [configScope,toolScope(reference.adapterId,reference.connectionId)])if(!authority.enabled(scope)){if(reading)pending.set(key(scope),scope);return {status:'denied'};}
  const configRequest=authority.related(parent,configScope),request=authority.related(parent,toolScope(reference.adapterId,reference.connectionId));
  if(!configRequest||!request||host.permissions!.evaluate(configRequest).status!=='allow')return {status:'denied'};
  const configs=host.connections.configs.read();
  const result=await host.connections.discover(reference.adapterId,request,reference.connectionId,configs.revision);
  if(host.permissions!.evaluate(configRequest).status!=='allow'||host.permissions!.evaluate(request).status!=='allow'||!authority.related(parent,configScope)||!authority.related(parent,toolScope(reference.adapterId,reference.connectionId)))return {status:'denied'};
  if(host.connections.configs.read().revision!==configs.revision)return {status:'unavailable'};
  const available=result.status==='ok'&&Array.isArray(result.value)&&result.value.some(tool=>tool&&typeof tool==='object'&&!Array.isArray(tool)&&tool['name']===reference.name);
  const parentDecision=host.permissions!.evaluate(parent);
  // A currently visible connection proves the stored reference identity, not remote availability.
  // Only queries may retain an offline selection; creating a reference still requires fresh discovery.
  if(!available&&(parentDecision.status!=='allow'||parentDecision.scope.action!=='context.read'||!configs.items.some(c=>c.id===reference.connectionId&&c.adapter===reference.adapterId)))return {status:'unavailable'};
  return {status:'available',...target,availability:available?'available':'unavailable',sourceRevision:String(configs.revision),observedAt:new Date().toISOString()};
 }};
 async function readResource(input:Extract<DesktopSpaceInput,{kind:'resource.read'}>):Promise<DesktopSpaceReply>{
  const read=()=>query({kind:'context',id:input.contextId},operation('context.read','context:'+input.contextId,input.contextId));
  const before=await read();if(before.status!=='ok')return {status:'unavailable',reason:'context_unavailable'};
  const resource=(before.value as import('../../space/src/index.js').ContextView).resources.find(item=>item.id===input.id);
  if(!resource)return {status:'rejected',reason:'resource_unavailable'};
  let path:string;
  try{const url=new URL(resource.address);if(url.protocol!=='file:')return {status:'rejected',reason:'resource_connector_required'};path=fileURLToPath(url);}catch{return {status:'rejected',reason:'local_file_url_required'};}
  const confirmed=await authority.confirm(options.confirm,'本次'+(input.mode==='file'?'读取文件内容':'列出目录（不读取子项内容）')+'：'+resource.name+'\n'+path+'\n仅访问此引用；不复制文件，不授予写入或子项读取权限。');
  if(closed)return {status:'unavailable',reason:'session_closed'};
  if(!confirmed)return {status:'cancelled'};
  const id=createHash('sha256').update(JSON.stringify([input.contextId,resource.id,resource.revision,input.mode])).digest('hex');
  const target=input.mode==='file'?localFileTarget(id):localDirectoryTarget(id);
  const op:LocalOperation={resource:'local',action:'read',target,context:input.contextId};
  const port=input.mode==='file'?host?.localFiles:host?.localDirectories;
  if(!port)return {status:'unavailable',reason:'local_resource_unavailable'};
  permit(op);const request=bind(op)!;
  const registered=await port.register(request,target,path);
  if(registered.status!=='bound')return {status:'unavailable',reason:'local_resource_'+registered.status};
  const result=await port.read(request,target);
  if(result.status!=='ok')return {status:'unavailable',reason:'local_read_unavailable'};
  const after=await read();
  const current=after.status==='ok'?(after.value as import('../../space/src/index.js').ContextView).resources.find(item=>item.id===resource.id):undefined;
  if(!current||current.revision!==resource.revision||current.address!==resource.address||closed)return {status:'rejected',reason:'resource_changed'};
  const value=result.value as {version:string;content?:string;entries?:{name:string;kind:'file'|'directory'|'symlink'|'other'}[];complete?:boolean};
  if(!value||typeof value.version!=='string')return {status:'unavailable',reason:'invalid_resource_observation'};
  if(input.mode==='file'&&typeof value.content==='string'){
   const editToken=randomUUID();
   while(observations.size>=64)observations.delete(observations.keys().next().value!);
   observations.set(editToken,{contextId:input.contextId,addressId:resource.id,revision:resource.revision,address:resource.address,path,target,version:value.version});
   return {status:'ok',view:'file',contextId:input.contextId,addressId:resource.id,content:value.content,version:value.version,editToken};
  }
  if(input.mode==='directory'&&Array.isArray(value.entries)&&typeof value.complete==='boolean')return {status:'ok',view:'directory',contextId:input.contextId,addressId:resource.id,entries:value.entries,complete:value.complete,version:value.version};
  return {status:'unavailable',reason:'invalid_resource_observation'};
 }
 async function saveResource(input:Extract<DesktopSpaceInput,{kind:'resource.save'}>):Promise<DesktopSpaceReply>{
  const observed=observations.get(input.editToken);
  if(!observed||observed.contextId!==input.contextId||observed.addressId!==input.id)return {status:'rejected',reason:'file_observation_required'};
  const current=await query({kind:'context',id:input.contextId},operation('context.read','context:'+input.contextId,input.contextId));
  const resource=current.status==='ok'?(current.value as import('../../space/src/index.js').ContextView).resources.find(r=>r.id===input.id):undefined;
  if(!resource||resource.revision!==observed.revision||resource.address!==observed.address)return {status:'rejected',reason:'resource_changed'};
  if(!host?.connections||!host.localFiles)return {status:'unavailable',reason:'local_resource_unavailable'};
  const confirmed=await authority.confirm(options.confirm,'保存本地文件：'+resource.name+'\n'+observed.path+
   '\n基于读取版本：'+observed.version+'\n新内容 '+Buffer.byteLength(input.content,'utf8')+' 字节，SHA-256 '+createHash('sha256').update(input.content).digest('hex')+
   '\n仅替换这个已读取文件；必要时登记 Local 文件连接。不创建、删除或移动文件。外部变更会拒绝保存；结果未知不自动重试。');
  if(closed)return {status:'unavailable',reason:'session_closed'};if(!confirmed)return {status:'cancelled'};
  const configScope:LocalOperation={resource:'connections',action:'configuration.read',target:'connection:desktop-local-files',context:null};permit(configScope);
  const config=host.connections.configs.read();let revision=config.revision;
  const local=config.items.find(c=>c.id==='desktop-local-files');
  if(local&&(local.adapter!=='local'||local.endpoint!=='local:files'||local.credentialRef!==null||!local.enabled))return {status:'rejected',reason:'local_connection_unavailable'};
  if(!local){
   permit({...configScope,action:'configuration.write'});
   const created=host.connections.configs.put({id:'desktop-local-files',adapter:'local',endpoint:'local:files',credentialRef:null,enabled:true},revision,randomUUID());
   if(created.status!=='ok')return {status:'unavailable',reason:'local_configuration_'+created.status};revision=created.revision;
  }
  const scope:LocalOperation={resource:'local',action:'write',target:observed.target,context:input.contextId};permit(scope);
  const request=bind(scope)!;
  const registered=await host.localFiles.register(request,observed.target,observed.path);
  if(registered.status!=='bound')return {status:'rejected',reason:'local_file_'+registered.status};
  const latest=await query({kind:'context',id:input.contextId},operation('context.read','context:'+input.contextId,input.contextId));
  const live=latest.status==='ok'?(latest.value as import('../../space/src/index.js').ContextView).resources.find(r=>r.id===input.id):undefined;
  if(!live||live.revision!==observed.revision||live.address!==observed.address||closed)return {status:'rejected',reason:'resource_changed'};
  const operationId=randomUUID();
  const result=await host.connections.dispatch('local',request,operationId,'desktop-local-files',revision,observed.target,
   createHash('sha256').update(JSON.stringify([input.contextId,input.id,observed.version,input.content])).digest('hex'),
   {kind:'replace',expectedVersion:observed.version,content:input.content});
  if(result.status==='unknown'){observations.delete(input.editToken);return {status:'unknown',intent:operationId};}
  if(result.status!=='observed')return {status:'rejected',reason:result.reason,operationId};
  const receipt=host.connections.operations.get(operationId)?.observations.find(o=>o.id==='result')?.value;
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt))return {status:'unknown',intent:operationId};
  if(receipt.status!=='written')return {status:'rejected',reason:typeof receipt.reason==='string'?receipt.reason:'local_write_unconfirmed',operationId};
  if(typeof receipt.version!=='string'||!/^[a-f0-9]{64}$/.test(receipt.version))return {status:'unknown',intent:operationId};
  observations.delete(input.editToken);
  // A saved receipt remains authoritative, but cannot be disclosed after revocation or close.
  if(closed||host.permissions!.evaluate(request).status!=='allow')return {status:'unknown',intent:operationId};
  return {status:'saved',version:receipt.version as string,operationId};
 }
 async function perform(input:DesktopSpaceInput):Promise<DesktopSpaceReply>{
  // A save has its own exact native summary after resolving the previously observed reference.
  if(input.kind==='resource.save'){
   if(!await authority.confirm(options.confirm,'准备核对已读取的 Context 文件及保存目标。不会在核对前修改文件。'))return {status:'cancelled'};
   return saveResource(input);
  }
  const confirmed=await authority.confirm(options.confirm,input.kind==='snapshot'?'读取当前数据根已登记的 Space、Group 和 Context。仅允许本次本地读取，不授予 AI、网络或文件内容访问。':'本次操作：'+titles[input.kind]+('name'in input?' — '+input.name:'')+('id'in input?'；对象 ID：'+input.id:'')+('contextId'in input?'；Context ID：'+input.contextId:'')+('spaceId'in input?'；Space ID：'+input.spaceId:'')+('address'in input?'；地址：'+input.address:'')+('categoryId'in input?'；类别：'+(input.categoryId??'未分类'):'')+('groupId'in input?'；分组：'+(input.groupId??'不分组'):'')+'。仅操作所选对象，不授予 AI 或外部连接权限。');
  if(closed)return {status:'unavailable',reason:'session_closed'};
  if(!confirmed)return {status:'cancelled'};
  if(input.kind==='resource.read')return readResource(input);
  if(input.kind==='snapshot'){
   const categories=await query({kind:'organization',entity:'category'},operation('organization.list','root:'+options.rootId));
   const spaces=await query({kind:'organization',entity:'space'},operation('organization.list','root:'+options.rootId));
   const groups=await query({kind:'organization',entity:'group'},operation('organization.list','root:'+options.rootId));
   const contexts=await query({kind:'contexts'},operation('context.list','root:'+options.rootId));
   if(categories.status!=='ok'||spaces.status!=='ok'||groups.status!=='ok'||contexts.status!=='ok')return {status:'unavailable',reason:'snapshot_unavailable'};
   const organizations=[];
   let complete=contexts.complete??true;
   for(const item of contexts.value as {id:string}[]){
    const org=await query({kind:'context.organization',id:item.id},operation('context.organization.read','context:'+item.id,item.id));
    if(org.status==='ok')organizations.push(org.value);else complete=false;
   }
   return {status:'ok',view:'snapshot',categories:categories.value as never,spaces:spaces.value as never,groups:groups.value as never,contexts:contexts.value as never,organizations:organizations as never,complete};
  }
  if(input.kind==='context.open'){
   const context=await query({kind:'context',id:input.id},operation('context.read','context:'+input.id,input.id));
   const organization=await query({kind:'context.organization',id:input.id},operation('context.organization.read','context:'+input.id,input.id));
   const location=await query({kind:'context.location',id:input.id},operation('context.locate','context:'+input.id,input.id));
   if(context.status!=='ok'||organization.status!=='ok'||location.status!=='ok')return {status:'unavailable',reason:'context_unavailable'};
   const value=context.value as import('../../space/src/index.js').ContextView;
   return {status:'ok',view:'context',context:{id:value.id,revision:value.revision,name:value.name,description:value.description,primaryAddress:value.primaryAddress},resources:value.resources,associations:value.associations,associationsComplete:context.complete??true,tools:value.tools,location:(location.value as {location:string}).location,organization:organization.value as never};
  }
  if(input.kind==='tool.connections'||input.kind==='tool.candidates'){
   const context=await query({kind:'context',id:input.contextId},operation('context.read','context:'+input.contextId,input.contextId));
   if(context.status!=='ok'||!host?.connections)return {status:'unavailable',reason:'context_or_connections_unavailable'};
   permit(configScope);const request=bind(configScope)!;if(host.permissions!.evaluate(request).status!=='allow')return {status:'rejected',reason:'permission_unavailable'};
   const configs=host.connections.configs.read(),adapters=new Set(host.connections.capabilities().map(adapter=>adapter.id));
   if(input.kind==='tool.connections')return {status:'ok',view:'tool-connections',connections:configs.items.filter(c=>adapters.has(c.adapter)).map(c=>({id:c.id,adapter:c.adapter,enabled:c.enabled}))};
   const connection=configs.items.find(c=>c.id===input.connectionId&&adapters.has(c.adapter));if(!connection)return {status:'unavailable',reason:'connection_unavailable'};
   const contextRequest=bind(operation('context.read','context:'+input.contextId,input.contextId))!;
   const scope=toolScope(connection.adapter,connection.id);permit(scope);
   const result=await host.connections.discover(connection.adapter,bind(scope)!,connection.id,configs.revision);
   if(host.permissions!.evaluate(contextRequest).status!=='allow'||host.permissions!.evaluate(request).status!=='allow')return {status:'rejected',reason:'context_authorization_changed'};
   if(result.status!=='ok'||!Array.isArray(result.value))return {status:'unavailable',reason:'tool_catalog_unavailable'};
   const tools:{targetId:string;name:string}[]=[];
   for(const tool of result.value){if(!tool||typeof tool!=='object'||Array.isArray(tool)||typeof tool['name']!=='string')return {status:'unavailable',reason:'invalid_tool_catalog'};tools.push({targetId:capabilityReferenceTarget(connection.adapter,connection.id,tool['name']),name:tool['name']});}
   return {status:'ok',view:'tool-candidates',tools};
  }
  let command:SpaceCommand;
  if(input.kind==='context.create'||input.kind==='space.directory'){
   const location=input.kind==='space.directory'&&input.clear?null:await options.chooseDirectory();
   if(location===undefined)return {status:'cancelled'};
   if(closed)return {status:'unavailable',reason:'session_closed'};
   command=input.kind==='context.create'?{kind:input.kind,name:input.name,description:input.description??'',location:resolve(location!),intent:randomUUID()}:
    {kind:input.kind,id:input.id,expectedRevision:input.expectedRevision,location:location===null?null:resolve(location),intent:randomUUID()};
  }else if(input.kind==='tool.add'){
   const reference=parseCapabilityReference(input.targetId);if(!reference)return {status:'rejected',reason:'invalid_tool_reference'};
   permit(configScope);permit(toolScope(reference.adapterId,reference.connectionId));
   command={kind:'tool.add',contextId:input.contextId,owner:'connections',targetType:'tool',targetId:input.targetId,purpose:input.purpose,intent:randomUUID()};
  }else command={...input,intent:randomUUID()} as SpaceCommand;
  if(command.kind==='association.add'||command.kind==='association.replace'){const scope=targetScope(command);if(scope)permit(scope);}
  if(command.kind==='context.group'){
   const current=await query({kind:'context.organization',id:command.contextId},operation('context.organization.read','context:'+command.contextId,command.contextId));
   if(current.status!=='ok')return {status:'unavailable',reason:'organization_unavailable'};
  }
  if('categoryId'in command&&command.categoryId)permit(operation('category.read','category:'+command.categoryId));
  if('spaceId'in command)permit(operation('space.read','space:'+command.spaceId));
  if('groupId'in command&&command.groupId)permit(operation('group.read','group:'+command.groupId));
  const context='contextId'in command?command.contextId:command.kind==='context.edit'?command.id:null;
  const target=command.kind==='context.create'?resolve(command.location):context?'context:'+context:
   'id'in command?command.kind.split('.')[0]+':'+command.id:command.kind==='group.create'?'space:'+command.spaceId:'root:'+options.rootId;
  const op=operation(command.kind,target,context);permit(op);
  // Never automatically replay writes, including unknown results.
  return await host!.space!.execute(bind(op)!,command) as DesktopSpaceReply;
 }
 return Object.freeze({policy,derive,owner,attach(value:FoundationHost){if(host)throw Error('already_attached');host=value;authority.attach(value);},
  async request(raw:unknown):Promise<DesktopSpaceReply>{
   const input=capture(raw);if(!input)return {status:'rejected',reason:'invalid_request'};
   if(closed||!host?.space||!host.local)return {status:'unavailable',reason:'space_unavailable'};
   if(busy)return {status:'unavailable',reason:'operation_in_progress'};
   busy=true;try{return await authority.run(()=>perform(input))??{status:'unavailable',reason:'operation_in_progress'};}catch{return {status:'unavailable',reason:'operation_unavailable'};}finally{busy=false;}
  },
  close(){closed=true;observations.clear();authority.close();}
 });
}
