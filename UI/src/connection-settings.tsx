import {useEffect,useState} from 'react';
import type {DesktopBridge,DesktopConnectionsReply} from './index.js';
export function ConnectionSettings({bridge}:{bridge:DesktopBridge}){
 const [data,setData]=useState<Extract<DesktopConnectionsReply,{status:'ok'}>>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function refresh(){const r=await bridge.connections({kind:'snapshot'});if(!r.ok||r.value.status!=='ok')throw Error(r.ok?r.value.status:r.error);setData(r.value);}
 async function run(work:()=>Promise<void>){if(busy)return;setBusy(true);setMessage('');try{await work();}catch(e){setData(undefined);setMessage(e instanceof Error?e.message:'连接不可用');}finally{setBusy(false);}}
 useEffect(()=>bridge.onAccessChanged(()=>{setData(undefined);setMessage('授权已变更，请重新读取连接。');}),[bridge]);
 return <div data-connection-settings><h3>GitHub / Local 连接</h3><p>配置启用与远端就绪分开显示。API 与模型在独立设置页管理；Local 文件地址在 Space / Context 中按次确认访问。</p>
 <button disabled={busy} onClick={()=>void run(refresh)}>读取连接与操作记录</button><p role="status">{message}</p>
 {data&&<><p>Local 文件适配器：{data.localFiles?'已装配，访问时核验平台能力与授权':'不可用'}；目录扫描：{data.localDirectories?'已装配':'此平台尚无已验证原生扫描器'}。</p>
 {data.connections.length===0&&<p>当前没有已登记的 GitHub / Local 连接配置。</p>}
 <ul>{data.connections.map(c=><li key={c.id}><strong>{c.id} · {c.adapter}</strong><small>{c.endpoint}</small><p>{c.enabled?'配置启用':'配置停用'} · 远端状态未观测 · {c.hasCredential?'已引用凭证':'无凭证引用'}</p>
 <button disabled={busy} onClick={()=>void run(async()=>{const r=await bridge.connections({kind:'toggle',id:c.id,expectedRevision:data.revision,enabled:!c.enabled});if(!r.ok||r.value.status!=='committed')throw Error(r.ok?r.value.status:r.error);await refresh();})}>{c.enabled?'停用此连接':'启用此连接'}</button></li>)}</ul>
 <h4>Operation 摘要</h4><p>unknown 表示结果未知；此页不会自动重试。</p>
 <ul>{data.operations.map(o=><li key={o.id}><strong>{o.phase}</strong><small>{o.id} · {o.adapter??'API'} · 尝试 {o.attempts} 次</small></li>)}</ul></>}</div>;
}
