import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SpacePanel} from './space.js';
import type {DesktopBridge,DesktopStatus} from './index.js';
declare global {interface Window {wexHost:DesktopBridge}}
const labels:Record<DesktopStatus['phase'],string>={starting:'正在启动',ready:'已就绪',degraded:'部分模块不可用',failed:'启动失败',stopping:'正在释放资源','release-pending':'资源释放未确认，请重试退出'};
function Desktop(){
 const [status,setStatus]=useState<DesktopStatus>({phase:'starting',diagnostics:[]}),[error,setError]=useState('');
 async function refresh(){try{const r=await window.wexHost.readStatus();if(r.ok){setStatus(r.value);setError('');}else setError('无法读取宿主状态');}catch{setError('桌面连接不可用');}}
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),1000);return()=>clearInterval(timer);},[]);
 async function quit(){try{const result=await window.wexHost.requestQuit();if(!result.ok)setError('退出请求被拒绝');}catch{setError('无法发送退出请求');}}
 return <main><header><span className="brand">WEXPCeasy</span><span>0.1.1 · 工作区</span></header>
 <aside className="host-status"><span role="status">{labels[status.phase]}</span><div><button onClick={()=>void refresh()}>刷新状态</button><button onClick={()=>void quit()}>{status.phase==='release-pending'?'重试退出':'退出应用'}</button></div></aside>
 {error&&<p role="alert">{error}</p>}{status.diagnostics.length>0&&<details><summary>模块诊断</summary><ul>{status.diagnostics.map((d,i)=><li key={i}>{d.module}：{d.reason}</li>)}</ul></details>}
 <SpacePanel bridge={window.wexHost}/><footer>业务访问需确认授权。关闭窗口会等待资源释放，释放失败时可重试退出。</footer></main>;
}
createRoot(document.getElementById('root')!).render(<Desktop/>);
