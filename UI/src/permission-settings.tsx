import {useState} from 'react';
import type {DesktopBridge,DesktopPermissionReply} from './index.js';
export function PermissionSettings({bridge}:{bridge:DesktopBridge}){
 const [data,setData]=useState<Extract<DesktopPermissionReply,{status:'ok'}>>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function refresh(){const r=await bridge.permissions({kind:'snapshot'});if(!r.ok||r.value.status!=='ok')throw Error(r.ok?r.value.status:r.error);setData(r.value);}
 async function run(work:()=>Promise<void>){if(busy)return;setBusy(true);setMessage('');try{await work();}catch(e){setData(undefined);setMessage(e instanceof Error?e.message:'权限不可用');}finally{setBusy(false);}}
 return <div data-permission-settings><h3>当前窗口授权</h3><p>此处显示当前本地窗口经可信确认取得的精确授权。AI 角色和 Context 关联不产生授权；新的业务操作仍需确认。</p>
 <button disabled={busy} onClick={()=>void run(refresh)}>读取当前窗口授权</button><p role="status">{message}</p>
 {data&&<ul>{data.entries.map(entry=><li key={entry.id}><strong>{entry.resource} / {entry.action}</strong><small>{entry.target} · {entry.context??'无 Context'}</small>
 <button disabled={busy} onClick={()=>void run(async()=>{const r=await bridge.permissions({kind:'revoke',id:entry.id,expectedRevision:data.revision});if(!r.ok||r.value.status!=='committed')throw Error(r.ok?r.value.status:r.error);setMessage('已撤销；在途操作不能继续使用此授权。');await refresh();})}>撤销此授权</button></li>)}</ul>}</div>;
}
