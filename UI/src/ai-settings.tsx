import {useEffect,useRef,useState} from 'react';
import type {DesktopBridge,AiEntry,AiConfiguration} from './index.js';
export function AiSettings({bridge}:{bridge:DesktopBridge}){
 const [entries,setEntries]=useState<AiEntry[]>([]),[selected,setSelected]=useState<AiEntry>();
 const [kind,setKind]=useState<AiConfiguration['kind']>('role'),[name,setName]=useState(''),[text,setText]=useState('');
 const [roleId,setRoleId]=useState(''),[positionId,setPositionId]=useState(''),[connectionId,setConnectionId]=useState(''),[modelId,setModelId]=useState('');
 const [models,setModels]=useState<{id:string;connectionId:string;name:string}[]>([]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const epoch=useRef(0),running=useRef(false);
 async function checked<T,>(request:()=>Promise<T>):Promise<T>{const captured=epoch.current;const reply=await request();if(captured!==epoch.current)throw Error('stale_ai_settings_request');return reply;}
 async function refresh(){const r=await checked(()=>bridge.ai({kind:'snapshot'}));if(!r.ok||r.value.status!=='ok'){setEntries([]);throw Error(r.ok?r.value.status:r.error);}setEntries(r.value.entries);}
 async function run(work:()=>Promise<void>){if(running.current)return;const captured=epoch.current;running.current=true;setBusy(true);setMessage('');try{await work();}catch(e){if(captured===epoch.current){setEntries([]);setMessage(e instanceof Error?e.message:'配置不可用');}}finally{if(captured===epoch.current){running.current=false;setBusy(false);}}}
 function choose(e:AiEntry){setSelected(e);setKind(e.kind);setName(e.name);if(e.kind==='role')setText(e.prompt);if(e.kind==='position')setText(e.responsibility);if(e.kind==='agent'){setRoleId(e.roleId);setPositionId(e.positionId);setConnectionId(e.model.connectionId);setModelId(e.model.modelId);}}
 async function readModels(){
  const c=await checked(()=>bridge.api({kind:'snapshot'}));if(!c.ok||c.value.status!=='ok'||c.value.view!=='connections')throw Error('连接不可用');
  const rows:typeof models=[];
  for(const connection of c.value.connections){const m=await checked(()=>bridge.api({kind:'models',connectionId:connection.id}));if(!m.ok||m.value.status!=='ok'||m.value.view!=='models')throw Error('模型不可用');rows.push(...m.value.models.map(v=>({id:v.id,connectionId:v.connectionId,name:connection.name+' / '+v.name})));}
  setModels(rows);
 }
 useEffect(()=>{const unsubscribe=bridge.onAccessChanged(()=>{epoch.current++;running.current=false;setBusy(false);setEntries([]);setModels([]);setSelected(undefined);setName('');setText('');setRoleId('');setPositionId('');setConnectionId('');setModelId('');setMessage('授权已变更，请重新读取配置。');});return ()=>{epoch.current++;running.current=false;unsubscribe();};},[bridge]);
 return <div data-ai-settings><h3>Agent 与角色</h3><p>岗位、角色、Agent 独立保存；选择不增加权限。</p><button disabled={busy} onClick={()=>void run(refresh)}>读取 AI 配置</button><p role="status">{message}</p>
 <ul>{entries.map(e=><li key={e.kind+e.id}><button disabled={busy} onClick={()=>choose(e)}>{e.name}</button> · {e.kind}<small>{e.id} / 修订 {e.revision}</small></li>)}</ul>
 <button disabled={busy} onClick={()=>{setSelected(undefined);setName('');setText('');}}>新建配置</button>
 <form aria-label="AI 配置" onSubmit={e=>{e.preventDefault();void run(async()=>{
  const value:AiConfiguration=kind==='role'?{kind,name,prompt:text}:kind==='position'?{kind,name,responsibility:text}:{kind,name,roleId,positionId,model:{connectionId,modelId}};
  const r=await checked(()=>bridge.ai({kind:'save',id:selected?.id??crypto.randomUUID(),expectedRevision:selected?.revision??0,value}));
  if(!r.ok||r.value.status!=='committed')throw Error(r.ok?r.value.status:r.error);
  setMessage('配置已保存');setSelected(undefined);await refresh();
 });}}>
 <label>类型<select name="ai-kind" disabled={busy||!!selected} value={kind} onChange={e=>setKind(e.target.value as AiConfiguration['kind'])}><option value="role">角色</option><option value="position">岗位</option><option value="agent">Agent</option></select></label>
 <label>名称<input name="ai-name" required maxLength={256} disabled={busy} value={name} onChange={e=>setName(e.target.value)}/></label>
 {kind!=='agent'?<label>{kind==='role'?'角色提示词':'岗位职责'}<textarea name="ai-text" required maxLength={kind==='role'?32000:8000} disabled={busy} value={text} onChange={e=>setText(e.target.value)}/></label>:<>
 <label>角色<select name="ai-role" required disabled={busy} value={roleId} onChange={e=>setRoleId(e.target.value)}><option value="">请选择</option>{entries.filter(v=>v.kind==='role').map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
 <label>岗位<select name="ai-position" required disabled={busy} value={positionId} onChange={e=>setPositionId(e.target.value)}><option value="">请选择</option>{entries.filter(v=>v.kind==='position').map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
 <button type="button" disabled={busy} onClick={()=>void run(readModels)}>读取可选模型</button>
 <label>模型<select name="ai-model" required disabled={busy} value={modelId} onChange={e=>{setModelId(e.target.value);setConnectionId(models.find(m=>m.id===e.target.value)?.connectionId??'');}}><option value="">请选择</option>{models.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label></>}
 <button type="submit" disabled={busy}>保存 AI 配置</button></form></div>;
}
