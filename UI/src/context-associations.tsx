import {useEffect,useRef,useState} from 'react';
import type {AssociationItem,DesktopBridge} from './index.js';
/** Discovery uses each owner's existing public list; only references are sent to Space. */
export function ContextAssociations({bridge,contextId,associations,complete,reload,onOpen}:{bridge:DesktopBridge;contextId:string;associations:AssociationItem[];complete:boolean;reload:()=>Promise<void>;onOpen?:(id?:string)=>void}){
 const [candidates,setCandidates]=useState<{owner:string;targetType:string;targetId:string;name:string}[]>([]),[selected,setSelected]=useState(''),[replace,setReplace]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');const epoch=useRef(0),running=useRef(false);
 useEffect(()=>{const clear=()=>{epoch.current++;running.current=false;setBusy(false);setCandidates([]);setSelected('');setReplace('');setMessage('授权已变更，请重新读取引用。');};const unsubscribe=bridge.onAccessChanged(clear);return ()=>{epoch.current++;unsubscribe();};},[bridge,contextId]);
 async function run(work:(valid:()=>void)=>Promise<void>){if(running.current)return;const n=epoch.current;running.current=true;setBusy(true);setMessage('');const valid=()=>{if(n!==epoch.current)throw Error('stale_reference_request');};try{await work(valid);}catch(e){if(n===epoch.current)setMessage(e instanceof Error?e.message:'引用不可用');}finally{if(n===epoch.current){running.current=false;setBusy(false);}}}
 async function discover(kind:'settings'|'conversations',valid:()=>void){
  const reply=kind==='settings'?await bridge.ai({kind:'snapshot'}):await bridge.conversations({kind:'snapshot'});valid();
  if(!reply.ok||reply.value.status!=='ok')throw Error('发现不可用');const value=reply.value;
  if('entries'in value)setCandidates(value.entries.filter(e=>e.kind==='role'||e.kind==='position').map(e=>({owner:'AI',targetType:e.kind,targetId:e.id,name:e.name})));
  else if('conversations'in value)setCandidates(value.conversations.map(c=>({owner:'conversations',targetType:'conversation',targetId:c.id,name:c.messages[0]?.segments[0]?.text.slice(0,40)??'空对话'})));
  setSelected('');
 }
 return <section aria-label="Context 设定与会话引用"><h3>设定与会话引用</h3><p>引用不授予执行权限；本轮设定在对话中显式选择。</p>{!complete&&<p role="status">部分引用当前不可见或不可用，原持久引用仍保留。</p>}<p role="status">{message}</p>
 <button disabled={busy} onClick={()=>void run(valid=>discover('settings',valid))}>发现角色与岗位</button><button disabled={busy} onClick={()=>void run(valid=>discover('conversations',valid))}>发现已有会话</button>
 <label>引用目标<select disabled={busy} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">请选择</option>{candidates.map((c,i)=><option key={i} value={String(i)}>{c.targetType} · {c.name}</option>)}</select></label>
 <label>替换引用<select disabled={busy} value={replace} onChange={e=>setReplace(e.target.value)}><option value="">新增引用</option>{associations.map(a=><option key={a.id} value={a.id}>{a.targetType} · {a.targetId}</option>)}</select></label>
 <button disabled={busy||selected===''} onClick={()=>void run(async valid=>{const c=candidates[Number(selected)];if(!c)throw Error('请选择目标');const old=associations.find(a=>a.id===replace);const target={owner:c.owner,targetType:c.targetType,targetId:c.targetId};const r=await bridge.space(old?{kind:'association.replace',contextId,id:old.id,expectedRevision:old.revision,...target,purpose:old.purpose}:{kind:'association.add',contextId,...target,purpose:'reference'});valid();if(!r.ok||r.value.status!=='committed')throw Error(r.ok?r.value.status:r.error);await reload();valid();setReplace('');})}>保存引用</button>
 <ul>{associations.map(a=><li key={a.id}>{a.targetType} · {a.targetId} · {a.purpose} <button disabled={busy} onClick={()=>void run(async valid=>{const r=await bridge.space({kind:'association.remove',contextId,id:a.id,expectedRevision:a.revision});valid();if(!r.ok||r.value.status!=='committed')throw Error(r.ok?r.value.status:r.error);await reload();})}>解除引用</button>{a.owner==='conversations'&&onOpen&&<button disabled={busy} onClick={()=>onOpen(a.targetId)}>打开关联会话</button>}</li>)}</ul>
 {onOpen&&<button disabled={busy} onClick={()=>onOpen()}>在 Context 中新建会话</button>}
 </section>;
}
