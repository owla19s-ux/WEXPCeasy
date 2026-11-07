import {useState} from 'react';
import type {DesktopSpaceInput,DesktopSpaceReply,AddressItem} from './index.js';
type Detail=Extract<DesktopSpaceReply,{view:'context'}>;
type ResourcePreview=Extract<DesktopSpaceReply,{view:'file'|'directory'}>;
export function ContextAddresses({detail,busy,run,call,reload,onPreview}:{detail:Detail;busy:boolean;run:(work:()=>Promise<void>)=>Promise<void>;call:(input:DesktopSpaceInput)=>Promise<DesktopSpaceReply|undefined>;reload:()=>Promise<void>;onPreview:(value:ResourcePreview|undefined)=>void}){
 const [editing,setEditing]=useState<AddressItem>(),[name,setName]=useState(''),[address,setAddress]=useState(''),[notes,setNotes]=useState(''),[purposes,setPurposes]=useState<string[]>(['reference']);
 const reset=()=>{setEditing(undefined);setName('');setAddress('');setNotes('');setPurposes(['reference']);};
 const save=async()=>{
  onPreview(undefined);
  const common={contextId:detail.context.id,name,address,notes,purpose:purposes};
  const result=await call(editing?{kind:'address.edit',...common,id:editing.id,expectedRevision:editing.revision}:{kind:'address.add',...common});
  if(result?.status==='committed'){reset();await reload();}
 };
 const read=async(item:AddressItem,mode:'file'|'directory')=>{
  onPreview(undefined);const result=await call({kind:'resource.read',contextId:detail.context.id,id:item.id,mode});
  if(result?.status==='ok'&&(result.view==='file'||result.view==='directory'))onPreview(result);
 };
 const mutate=async(input:DesktopSpaceInput)=>{onPreview(undefined);const result=await call(input);if(result?.status==='committed')await reload();};
 return <div className="context-addresses"><h4>主地址与附加地址</h4><p>地址保存为引用，当前未验证；关联地址不会自动访问外部资源或授予工具权限。</p>
 {detail.resources.length===0&&<p>尚无地址引用。</p>}
 {detail.resources.map(item=><div className="address-card" key={item.id}><strong>{item.name}{detail.context.primaryAddress===item.id?' · 主地址':''}</strong><p className="address-value">{item.address}</p><p>{item.notes}</p><small>用途：{(Array.isArray(item.purpose)?item.purpose:[item.purpose]).map(p=>(({reference:'参考',operation:'操作',output:'产出'} as Record<string,string>)[p]??p)).join('、')} · 未验证</small><div className="actions">
 {item.address.startsWith('file:')&&<><button disabled={busy} onClick={()=>void run(()=>read(item,'file'))}>读取文件</button><button disabled={busy} onClick={()=>void run(()=>read(item,'directory'))}>展开目录</button></>}
 <button disabled={busy} onClick={()=>{setEditing(item);setName(item.name);setAddress(item.address);setNotes(item.notes);setPurposes(Array.isArray(item.purpose)?[...item.purpose]:[item.purpose]);}}>编辑地址</button>
 {detail.context.primaryAddress!==item.id&&<button disabled={busy} onClick={()=>void run(()=>mutate({kind:'primary.select',contextId:detail.context.id,id:item.id,expectedRevision:detail.context.revision}))}>设为主地址</button>}
 <button disabled={busy} onClick={()=>void run(()=>mutate({kind:'address.remove',contextId:detail.context.id,id:item.id,expectedRevision:item.revision}))}>解除引用</button></div></div>)}
 {detail.context.primaryAddress&&<button disabled={busy} onClick={()=>void run(()=>mutate({kind:'primary.select',contextId:detail.context.id,id:null,expectedRevision:detail.context.revision}))}>清除主地址选择</button>}
 <form aria-label="地址引用" onSubmit={event=>{event.preventDefault();void run(save);}}><h4>{editing?'编辑地址引用':'添加地址引用'}</h4><label>地址名称<input name="address-name" required disabled={busy} value={name} maxLength={4096} onChange={e=>setName(e.target.value)}/></label><label>地址<input name="address-value" required disabled={busy} value={address} maxLength={4096} onChange={e=>setAddress(e.target.value)}/></label><label>备注<textarea name="address-notes" disabled={busy} value={notes} maxLength={4096} onChange={e=>setNotes(e.target.value)}/></label>
 <fieldset disabled={busy}><legend>用途（可多选）</legend>{[['reference','参考'],['operation','操作'],['output','产出']].map(([value,label])=><label className="purpose" key={value}><input type="checkbox" checked={purposes.includes(value!)} onChange={e=>setPurposes(current=>e.target.checked?[...current,value!]:current.filter(x=>x!==value))}/>{label}</label>)}</fieldset>
 <button type="submit" disabled={busy||purposes.length===0}>保存地址</button>{editing&&<button type="button" disabled={busy} onClick={reset}>取消地址编辑</button>}</form>
 <h4>已获准的工具能力</h4>{detail.tools.length===0?<p>当前查询没有可显示的工具能力。</p>:detail.tools.map(tool=><p key={tool.id}>{tool.targetId} · {tool.owner}/{tool.targetType} · {tool.availability}（{tool.enabled?'已选择':'未启用'}）</p>)}</div>;
}
