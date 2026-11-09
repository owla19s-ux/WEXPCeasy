import {useState} from 'react';
import type {DesktopSpaceInput,DesktopSpaceReply} from './index.js';
type Detail=Extract<DesktopSpaceReply,{view:'context'}>;
export function ContextTools({detail,busy,run,call,reload}:{detail:Detail;busy:boolean;run:(work:()=>Promise<void>)=>Promise<void>;call:(input:DesktopSpaceInput)=>Promise<DesktopSpaceReply|undefined>;reload:()=>Promise<void>}){
 const [connections,setConnections]=useState<{id:string;adapter:string;enabled:boolean}[]>([]),[connectionId,setConnectionId]=useState(''),[tools,setTools]=useState<{targetId:string;name:string}[]>([]),[targetId,setTargetId]=useState(''),[purpose,setPurpose]=useState('');
 async function mutate(input:DesktopSpaceInput){const r=await call(input);if(r?.status==='committed')await reload();}
 return <div data-context-tools><h4>Context 工具引用</h4><p>工具可见、关联和选择均不授予执行权限。失联或无权的引用可能不在当前投影中显示；重新读取以核对状态。</p>
 {detail.tools.map(tool=><article key={tool.id}><strong>{tool.targetId}</strong><small>{tool.owner}/{tool.targetType} · {tool.availability} · 修订 {tool.revision} · 观察 {tool.observedAt}</small><p>{tool.purpose} · {tool.enabled?'已选择':'未启用'}</p>
 <button disabled={busy} onClick={()=>void run(()=>mutate({kind:'tool.set',contextId:detail.context.id,id:tool.id,expectedRevision:tool.revision,enabled:!tool.enabled}))}>{tool.enabled?'停用工具选择':'启用工具选择'}</button>
 <button disabled={busy} onClick={()=>void run(()=>mutate({kind:'tool.remove',contextId:detail.context.id,id:tool.id,expectedRevision:tool.revision}))}>解除工具引用</button></article>)}
 <button disabled={busy} onClick={()=>void run(async()=>{setTools([]);setTargetId('');setConnectionId('');const r=await call({kind:'tool.connections',contextId:detail.context.id});if(r?.status==='ok'&&r.view==='tool-connections')setConnections(r.connections);})}>读取可关联工具连接</button>
 <label>工具连接<select disabled={busy} value={connectionId} onChange={e=>{setConnectionId(e.target.value);setTools([]);setTargetId('');}}><option value="">请选择</option>{connections.map(c=><option key={c.id} value={c.id} disabled={!c.enabled}>{c.adapter} / {c.id}{c.enabled?'':'（停用）'}</option>)}</select></label>
 <button disabled={busy||!connectionId} onClick={()=>void run(async()=>{setTools([]);setTargetId('');const r=await call({kind:'tool.candidates',contextId:detail.context.id,connectionId});if(r?.status==='ok'&&r.view==='tool-candidates')setTools(r.tools);})}>发现可关联工具</button>
 <form aria-label="Context 工具引用" onSubmit={e=>{e.preventDefault();void run(async()=>{await mutate({kind:'tool.add',contextId:detail.context.id,targetId,purpose});setTargetId('');});}}>
 <label>工具能力<select required disabled={busy} value={targetId} onChange={e=>setTargetId(e.target.value)}><option value="">请选择</option>{tools.map(t=><option key={t.targetId} value={t.targetId}>{t.name}</option>)}</select></label>
 <label>关联用途<input disabled={busy} value={purpose} maxLength={4096} onChange={e=>setPurpose(e.target.value)}/></label><button disabled={busy||!targetId} type="submit">关联工具引用</button></form></div>;
}
