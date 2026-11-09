import {useEffect,useRef,useState} from 'react';
import type {DesktopBridge,DesktopPermissionReply} from './index.js';
export function PermissionSettings({bridge}:{bridge:DesktopBridge}){
 const [data,setData]=useState<Extract<DesktopPermissionReply,{status:'ok'}>>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const epoch=useRef(0),running=useRef(false),action=useRef(0);
 async function call(input:Parameters<DesktopBridge['permissions']>[0]){const captured=epoch.current;const reply=await bridge.permissions(input);if(captured!==epoch.current)throw Error('stale_permission_settings_request');return reply;}
 async function refresh(){const r=await call({kind:'snapshot'});if(!r.ok||r.value.status!=='ok')throw Error(r.ok?r.value.status:r.error);setData(r.value);}
 async function run(work:()=>Promise<void>){if(running.current)return;action.current++;const captured=epoch.current;running.current=true;setBusy(true);setMessage('');try{await work();}catch(e){if(captured===epoch.current){setData(undefined);setMessage(e instanceof Error?e.message:'权限不可用');}}finally{if(captured===epoch.current){running.current=false;setBusy(false);}}}
 useEffect(()=>{const unsubscribe=bridge.onAccessChanged(()=>{epoch.current++;running.current=false;setBusy(false);setData(undefined);setMessage('授权已变更，请重新读取当前窗口授权。');});return ()=>{epoch.current++;action.current++;running.current=false;unsubscribe();};},[bridge]);
 return <div data-permission-settings><h3>当前窗口授权</h3><p>此处显示当前本地窗口经可信确认取得的精确授权。AI 角色和 Context 关联不产生授权；新的业务操作仍需确认。</p>
 <p>此页只管理当前窗口授权；全局策略和对话等级尚不能在此配置，未决入口保持关闭。</p>
 {data?.source&&<p>授权来源：本机可信确认 · 主体 {data.source.subject}<small>适用窗口 {data.source.entry} · 关系 {data.source.relationship} / {data.source.relationshipGeneration} · 无 Conversation 范围</small>模块准入：{data.source.moduleEnabled?'启用':'关闭'} · 全局访问准入：{data.source.globalEnabled?'启用':'关闭'} · 本地窗口准入：{data.source.entryEnabled?'启用':'关闭'}</p>}
 <button disabled={busy} onClick={()=>void run(refresh)}>读取当前窗口授权</button><p role="status">{message}</p>
 {data&&<ul>{data.entries.map(entry=><li key={entry.id}><strong>{entry.resource} / {entry.action}</strong><small>{entry.target} · {entry.context??'无 Context'}</small>
 <button disabled={busy} onClick={()=>void run(async()=>{const captured=epoch.current,operation=action.current;const r=await bridge.permissions({kind:'revoke',id:entry.id,expectedRevision:data.revision});if(operation!==action.current)return;if(!r.ok||r.value.status!=='committed')throw Error(r.ok?r.value.status==='unknown'?'撤权结果未知，请重新读取核对；Intent '+r.value.intent:r.value.status+('reason'in r.value?': '+r.value.reason:''):r.error);setMessage('已撤销；在途操作不能继续使用此授权。');if(captured===epoch.current)await refresh();})}>撤销此授权</button></li>)}</ul>}</div>;
}
