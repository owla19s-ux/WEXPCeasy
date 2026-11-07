import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {LocalFileEditor} from './local-file-editor.js';
import type {LocalDrafts} from './local-file-editor.js';
import {ContextAddresses} from './space-addresses.js';
import type {DesktopSpaceInput,DesktopSpaceReply,DesktopBridge} from './index.js';
type Snapshot=Extract<DesktopSpaceReply,{view:'snapshot'}>;
type Detail=Extract<DesktopSpaceReply,{view:'context'}>;
type ResourcePreview=Extract<DesktopSpaceReply,{view:'file'|'directory'}>;
export interface SpaceSections {contextId:string|null;resourcePreview:ReactNode|null;dismissResourcePreview:()=>void;toolbar:ReactNode;categories:ReactNode;structure:ReactNode;content:ReactNode;summary:ReactNode}
export function SpacePanel({bridge,render}:{bridge:DesktopBridge;render?:(sections:SpaceSections)=>ReactNode}){
 const openSequence=useRef(0),selectedContext=useRef<string|null>(null),fileDrafts=useRef<LocalDrafts>(new Map());
 const [resourcePreview,setResourcePreview]=useState<ResourcePreview>();
 const [data,setData]=useState<Snapshot>(),[detail,setDetail]=useState<Detail>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [categoryFilter,setCategoryFilter]=useState(''),[categoryId,setCategoryId]=useState('');
 const [spaceId,setSpaceId]=useState(''),[groupId,setGroupId]=useState(''),[mode,setMode]=useState('space.create'),[name,setName]=useState(''),[description,setDescription]=useState('');
 useEffect(()=>bridge.onAccessChanged(()=>{openSequence.current++;selectedContext.current=null;fileDrafts.current.clear();setResourcePreview(undefined);setDetail(undefined);setData(undefined);setName('');setDescription('');setSpaceId('');setGroupId('');setCategoryId('');setCategoryFilter('');setMessage('授权已变更，请重新打开工作区。');}),[bridge]);
 async function call(input:DesktopSpaceInput){
  const reply=await bridge.space(input);if(!reply.ok)throw Error('桌面请求被拒绝');
  const result=reply.value;
  if(result.status==='cancelled'){setMessage('操作已取消');return;}
  if(result.status==='unknown'){setMessage('结果未确认，请刷新核对；不要重复提交。');return;}
  if(result.status!=='ok'&&result.status!=='committed')throw Error('操作未完成：'+result.reason);
  return result;
 }
 async function refresh(){
  const result=await call({kind:'snapshot'});if(result?.status==='ok'&&result.view==='snapshot'){setData(result);if(!result.complete)setMessage('部分 Context 不可用，已保留登记信息。');}
 }
 async function run(work:()=>Promise<void>){if(busy)return;setBusy(true);setMessage('');try{await work();}catch(error){setDetail(undefined);setData(undefined);setMessage(error instanceof Error?error.message:'操作失败');}finally{setBusy(false);}}
 async function open(id:string){const sequence=++openSequence.current;selectedContext.current=id;setResourcePreview(undefined);const result=await call({kind:'context.open',id});if(sequence!==openSequence.current)return;if(result?.status==='ok'&&result.view==='context'){setDetail(result);setName(result.context.name);setDescription(result.context.description);setMode('context.edit');}}
 async function submit(){
  let input:DesktopSpaceInput;
  if(mode==='category.create')input={kind:'category.create',name};
  else if(mode==='category.edit'){const selected=data?.categories.find(x=>x.id===categoryId);if(!selected)throw Error('请选择类别');input={kind:'category.edit',id:selected.id,expectedRevision:selected.revision,name};}
  else if(mode==='space.create')input={kind:'space.create',name,description,categoryId:categoryId||null};
  else if(mode==='context.create')input={kind:'context.create',name,description};
  else if(mode==='group.create'){if(!spaceId)throw Error('请先选择 Space');input={kind:'group.create',spaceId,name};}
  else if(mode==='space.edit'){const selected=data?.spaces.find(x=>x.id===spaceId);if(!selected)throw Error('请先选择 Space');input={kind:'space.edit',id:selected.id,expectedRevision:selected.revision,name,description,categoryId:categoryId||null};}
  else if(mode==='group.edit'){const selected=data?.groups.find(x=>x.id===groupId);if(!selected)throw Error('请先选择分组');input={kind:'group.edit',id:selected.id,expectedRevision:selected.revision,name};}
  else{if(!detail)throw Error('请先打开 Context');input={kind:'context.edit',id:detail.context.id,expectedRevision:detail.context.revision,name,description};}
  const result=await call(input);if(result?.status==='committed'){setMessage('已保存');await refresh();if(input.kind==='context.edit')await open(input.id);}
 }
 const positions=new Map(data?.organizations.map(x=>[x.contextId,x]));
 const contexts=data?.contexts.filter(c=>(!categoryFilter||data.spaces.some(s=>s.id===positions.get(c.id)?.spaceId&&s.categoryId===categoryFilter))&&(!spaceId||(positions.get(c.id)?.spaceId===spaceId&&(!groupId||positions.get(c.id)?.groupId===groupId))))??[];
 const selectedSpace=data?.spaces.find(s=>s.id===spaceId);
 const modes=[['category.create','新建类别'],['category.edit','编辑类别'],['space.create','新建 Space'],['group.create','新建分组'],['context.create','新建 Context'],['space.edit','编辑 Space'],['group.edit','编辑分组'],['context.edit','编辑 Context']];

 const toolbar=<><div className="workspace-title"><div><p className="eyebrow">工作区</p><h2>Space / Context</h2></div><button disabled={busy} onClick={()=>void run(refresh)}>{data?'刷新工作区':'打开工作区'}</button></div><p className="workspace-hint">读取和保存前会请求本次操作确认。</p>{message&&<p role="status">{message}</p>}</>;
 const categories=<div data-categories><h2>Space 类别</h2>{data?<><button aria-pressed={!categoryFilter} disabled={busy} onClick={()=>{setCategoryFilter('');setSpaceId('');setGroupId('');}}>全部类别</button>{data.categories.map(c=><button key={c.id} aria-pressed={categoryFilter===c.id} disabled={busy} onClick={()=>{setCategoryFilter(c.id);setSpaceId('');setGroupId('');}}>{c.name}</button>)}{data.categories.length===0&&<p>暂无类别，可在主操作区新建。</p>}</>:<p>打开工作区后加载类别。</p>}</div>;
 const structure=<nav aria-label="工作区导航">{data?<><button disabled={busy} onClick={()=>{setSpaceId('');setGroupId('');}}>全部 Context</button>
 {data.spaces.filter(s=>!categoryFilter||s.categoryId===categoryFilter).map(space=><div key={space.id}><button aria-pressed={spaceId===space.id} disabled={busy} onClick={()=>{setSpaceId(space.id);setGroupId('');setName(space.name);setDescription(space.description);setCategoryId(space.categoryId??'');setMode('space.edit');}}>{space.name}</button>
 {spaceId===space.id&&data.groups.filter(g=>g.spaceId===space.id).map(group=><button className="group" key={group.id} disabled={busy} aria-pressed={groupId===group.id} onClick={()=>{setGroupId(group.id);setName(group.name);setMode('group.edit');}}>{group.name}</button>)}</div>)}
 <h3>Context</h3>{contexts.length===0?<p>当前范围没有可显示的 Context。</p>:contexts.map(c=><button key={c.id} disabled={busy||c.status!=='available'} aria-pressed={detail?.context.id===c.id} onClick={()=>void run(()=>open(c.id))}>{c.status==='available'?c.name:'不可用 Context'}<small>{c.id}</small></button>)}</>:<p>尚未加载工作区。</p>}</nav>;
 const content=data?<div><form onSubmit={event=>{event.preventDefault();void run(submit);}}><label>操作<select value={mode} disabled={busy} onChange={event=>{setMode(event.target.value);setName('');setDescription('');}}>{modes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 {['category.edit','space.create','space.edit'].includes(mode)&&<label>{mode==='category.edit'?'选择类别':'Space 类别'}<select aria-label="表单类别" disabled={busy} value={categoryId} onChange={event=>{setCategoryId(event.target.value);if(mode==='category.edit')setName(data.categories.find(c=>c.id===event.target.value)?.name??'');}}><option value="">未分类</option>{data.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
 <label>名称<input required maxLength={4096} disabled={busy} value={name} onChange={event=>setName(event.target.value)}/></label><label>说明<textarea maxLength={4096} disabled={busy} value={description} onChange={event=>setDescription(event.target.value)}/></label><button disabled={busy} type="submit">{busy?'处理中…':'保存'}</button></form>
 {selectedSpace&&<div><h3>Space 工作目录</h3><p>{selectedSpace.directory??'未关联'}</p><button disabled={busy} onClick={()=>void run(async()=>{const result=await call({kind:'space.directory',id:selectedSpace.id,expectedRevision:selectedSpace.revision});if(result?.status==='committed')await refresh();})}>选择关联目录</button>{selectedSpace.directory&&<button disabled={busy} onClick={()=>void run(async()=>{const result=await call({kind:'space.directory',id:selectedSpace.id,expectedRevision:selectedSpace.revision,clear:true});if(result?.status==='committed')await refresh();})}>解除目录关联</button>}</div>}
 {detail&&<article><h3>{detail.context.name}</h3><p>{detail.context.description}</p><ContextAddresses key={detail.context.id} detail={detail} busy={busy} run={run} call={call} reload={()=>open(detail.context.id)} onPreview={value=>{if(!value||value.contextId===selectedContext.current)setResourcePreview(value);}}/>
 <small>Context ID：{detail.context.id}</small><p>记录目录：{detail.location}</p><p>当前 Space：{data.spaces.find(x=>x.id===detail.organization.spaceId)?.name??'未分配'}</p>
 <label>目标 Space<select id="context-space" disabled={busy||detail.organization.spaceId!==null} value={detail.organization.spaceId??spaceId} onChange={event=>setSpaceId(event.target.value)}><option value="">选择 Space</option>{data.spaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
 <label>目标分组<select id="context-group" disabled={busy} value={groupId} onChange={event=>setGroupId(event.target.value)}><option value="">不分组</option>{data.groups.filter(g=>g.spaceId===(detail.organization.spaceId??spaceId)).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
 <button disabled={busy||!(detail.organization.spaceId??spaceId)} onClick={()=>void run(async()=>{const result=await call({kind:'context.group',contextId:detail.context.id,spaceId:detail.organization.spaceId??spaceId,groupId:groupId||null,expectedRevision:detail.organization.revision});if(result?.status==='committed'){await refresh();await open(detail.context.id);}})}>移动到所选分组</button></article>}</div>:<div className="workspace-empty"><h2>连接你的工作空间</h2><p>打开工作区，继续管理 Space、Context 和关联资源。</p></div>;
 const summary=detail?<dl><dt>当前显示</dt><dd>{detail.context.name}</dd><dt>Context ID</dt><dd>{detail.context.id}</dd><dt>配置修订</dt><dd>{detail.context.revision}</dd><dt>关联地址</dt><dd>{detail.resources.length}</dd></dl>:<p>选择一个 Context 查看当前对象信息。</p>;
 const resourceView=resourcePreview?<div className="resource-read-preview">
  <small>来源：当前 Context 已获准地址 · 版本：{resourcePreview.version}</small>
  {resourcePreview.view==='file'?<LocalFileEditor key={resourcePreview.contextId+':'+resourcePreview.addressId} file={resourcePreview} bridge={bridge} drafts={fileDrafts.current} onRead={value=>{if(value.contextId===selectedContext.current)setResourcePreview(value);}}/>:<>
   <ul>{resourcePreview.entries.map(entry=><li key={entry.name}>{entry.name} · {entry.kind}</li>)}</ul>
   {!resourcePreview.complete&&<p>目录结果不完整，请缩小范围。</p>}
   <p>仅展示已返回的目录名称；不会自动读取符号链接或子目录。</p>
  </>}
 </div>:null;
 const sections:SpaceSections={contextId:detail?.context.id??null,resourcePreview:resourceView,dismissResourcePreview:()=>setResourcePreview(undefined),toolbar,categories,structure,content,summary};
 if(render)return <>{render(sections)}</>;
 return <section className="workspace">{toolbar}{categories}<div className="workspace-grid">{structure}{content}</div></section>;
}
