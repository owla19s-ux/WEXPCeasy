import {randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {localFileTarget,localDirectoryTarget} from '../../connections/local/src/index.js';
import type {FoundationHost,FoundationOptions} from './foundations.js';
import type {LocalOperation} from './local-entries.js';
import {createDesktopAuthority} from './desktop-authority.js';
import type {DesktopAuthority} from './desktop-authority.js';
import type {SpaceCommand,SpaceQuery,QueryResult,ProjectionScope} from '../../space/src/index.js';
import type {DesktopSpaceInput,DesktopSpaceReply} from '../../UI/src/index.js';
const schemas:Record<string,readonly string[]>={
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
  else if(key==='mode'){if(!['file','directory'].includes(String(value)))return;}
  else if(key==='clear'){if(typeof value!=='boolean')return;}
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
const titles:Record<string,string>={'resource.read':'查看已关联资源','category.create':'创建 Space 类别','category.edit':'编辑 Space 类别','address.add':'添加 Context 地址引用','address.edit':'编辑地址引用','address.remove':'解除地址引用（保留外部原资源）','primary.select':'选择 Context 主地址','space.create':'创建 Space','space.edit':'编辑 Space','space.directory':'变更 Space 工作目录关联','group.create':'创建分组','group.edit':'编辑分组','context.create':'创建 Context','context.edit':'编辑 Context','context.group':'移动 Context 分组','context.open':'查看 Context'};
const key=(op:LocalOperation)=>JSON.stringify(op);
/** Native-confirmed local UI adapter. Domain data remains in Space; no Renderer identity/grant/path API. */
export function createDesktopSpace(options:{authority?:DesktopAuthority;rootId:string;confirm:(summary:string)=>Promise<boolean>;chooseDirectory:()=>Promise<string|undefined>}){
 const authority=options.authority??createDesktopAuthority(),policy=authority.policy;
 const pending=new Map<string,LocalOperation>();
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
 async function readResource(input:Extract<DesktopSpaceInput,{kind:'resource.read'}>):Promise<DesktopSpaceReply>{
  const read=()=>query({kind:'context',id:input.contextId},operation('context.read','context:'+input.contextId,input.contextId));
  const before=await read();if(before.status!=='ok')return {status:'unavailable',reason:'context_unavailable'};
  const resource=(before.value as import('../../space/src/index.js').ContextView).resources.find(item=>item.id===input.id);
  if(!resource)return {status:'rejected',reason:'resource_unavailable'};
  let path:string;
  try{const url=new URL(resource.address);if(url.protocol!=='file:')return {status:'rejected',reason:'resource_connector_required'};path=fileURLToPath(url);}catch{return {status:'rejected',reason:'local_file_url_required'};}
  if(!await authority.confirm(options.confirm,'本次'+(input.mode==='file'?'读取文件内容':'列出目录（不读取子项内容）')+'：'+resource.name+'\n'+path+'\n仅访问此引用；不复制文件，不授予写入或子项读取权限。'))return {status:'cancelled'};
  if(closed)return {status:'unavailable',reason:'session_closed'};
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
  if(input.mode==='file'&&typeof value.content==='string')return {status:'ok',view:'file',contextId:input.contextId,addressId:resource.id,content:value.content,version:value.version};
  if(input.mode==='directory'&&Array.isArray(value.entries)&&typeof value.complete==='boolean')return {status:'ok',view:'directory',contextId:input.contextId,addressId:resource.id,entries:value.entries,complete:value.complete,version:value.version};
  return {status:'unavailable',reason:'invalid_resource_observation'};
 }
 async function perform(input:DesktopSpaceInput):Promise<DesktopSpaceReply>{
  if(!await authority.confirm(options.confirm,input.kind==='snapshot'?'读取当前数据根已登记的 Space、Group 和 Context。仅允许本次本地读取，不授予 AI、网络或文件内容访问。':'本次操作：'+titles[input.kind]+('name'in input?' — '+input.name:'')+('id'in input?'；对象 ID：'+input.id:'')+('contextId'in input?'；Context ID：'+input.contextId:'')+('spaceId'in input?'；Space ID：'+input.spaceId:'')+('address'in input?'；地址：'+input.address:'')+('categoryId'in input?'；类别：'+(input.categoryId??'未分类'):'')+('groupId'in input?'；分组：'+(input.groupId??'不分组'):'')+'。仅操作所选对象，不授予 AI 或外部连接权限。'))return {status:'cancelled'};
  if(closed) return {status:'unavailable',reason:'session_closed'};
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
   return {status:'ok',view:'context',context:{id:value.id,revision:value.revision,name:value.name,description:value.description,primaryAddress:value.primaryAddress},resources:value.resources,tools:value.tools,location:(location.value as {location:string}).location,organization:organization.value as never};
  }
  let command:SpaceCommand;
  if(input.kind==='context.create'||input.kind==='space.directory'){
   const location=input.kind==='space.directory'&&input.clear?null:await options.chooseDirectory();
   if(location===undefined)return {status:'cancelled'};
   if(closed)return {status:'unavailable',reason:'session_closed'};
   command=input.kind==='context.create'?{kind:input.kind,name:input.name,description:input.description??'',location:resolve(location!),intent:randomUUID()}:
    {kind:input.kind,id:input.id,expectedRevision:input.expectedRevision,location:location===null?null:resolve(location),intent:randomUUID()};
  }else command={...input,intent:randomUUID()} as SpaceCommand;
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
 return Object.freeze({policy,derive,attach(value:FoundationHost){if(host)throw Error('already_attached');host=value;authority.attach(value);},
  async request(raw:unknown):Promise<DesktopSpaceReply>{
   const input=capture(raw);if(!input)return {status:'rejected',reason:'invalid_request'};
   if(closed||!host?.space||!host.local)return {status:'unavailable',reason:'space_unavailable'};
   if(busy)return {status:'unavailable',reason:'operation_in_progress'};
   busy=true;try{return await authority.run(()=>perform(input))??{status:'unavailable',reason:'operation_in_progress'};}catch{return {status:'unavailable',reason:'operation_unavailable'};}finally{busy=false;}
  },
  close(){closed=true;authority.close();}
 });
}
